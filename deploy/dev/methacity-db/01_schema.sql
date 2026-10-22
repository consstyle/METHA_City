-- ============================================================================
-- 01_schema.sql  ·  MethaCity  ·  esquema v0 de la Supabase PROPIA
-- ----------------------------------------------------------------------------
-- Base de datos de MethaCity (agentes, conversaciones, misiones, aprobaciones,
-- auditoría y caché de indicadores). Distinta de la de MethaDesk: allí solo se lee.
--
-- Ejecutar como `postgres` en la base de la Supabase de MethaCity (re-ejecutable):
--   docker exec -i <contenedor-supabase-db> psql -U postgres -d postgres -v ON_ERROR_STOP=1 < 01_schema.sql
--
-- Seguridad: RLS activado en todas las tablas y SIN políticas (denegado por defecto), como
-- hace MethaDesk. Solo el backend de MethaCity, con la clave service_role, accede. El
-- navegador nunca habla con esta base. Las políticas por usuario se añadirán si algún día
-- se usa Supabase Realtime desde el cliente.
-- ============================================================================
\set ON_ERROR_STOP on
BEGIN;

CREATE OR REPLACE FUNCTION public.mc_set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END
$$;

-- ── Agentes (un perfil de Hermes por agente) ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mc_agent (
  id               text PRIMARY KEY,                       -- = nombre del perfil de Hermes
  name             text NOT NULL,
  abteilung_ids    text[] NOT NULL DEFAULT '{}',           -- ids de ABTEILUNGEN_CONFIG que cubre
  role_kind        text NOT NULL DEFAULT 'abteilung'
                   CHECK (role_kind IN ('orchestrator','abteilung','extra')),
  building         text,                                   -- edificio de la ciudad
  hermes_api_port  integer,
  active           boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- ── Conversaciones y mensajes ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mc_conversation (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id    text NOT NULL REFERENCES public.mc_agent(id),
  user_email  text NOT NULL,
  title       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mc_conversation_user ON public.mc_conversation (user_email, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.mc_message (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  uuid NOT NULL REFERENCES public.mc_conversation(id) ON DELETE CASCADE,
  role             text NOT NULL CHECK (role IN ('user','agent','system','tool')),
  content          text NOT NULL,
  meta             jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mc_message_conv ON public.mc_message (conversation_id, created_at);

-- ── Misiones ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mc_mission (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title             text NOT NULL,
  goal              text NOT NULL,
  status            text NOT NULL DEFAULT 'entwurf'
                    CHECK (status IN ('entwurf','plan_offen','genehmigt','laeuft','fertig','abgebrochen','fehler')),
  created_by_email  text NOT NULL,
  plan              jsonb,                                  -- plan propuesto por el orquestador
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.mc_mission_step (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id   uuid NOT NULL REFERENCES public.mc_mission(id) ON DELETE CASCADE,
  ordinal      integer NOT NULL,
  agent_id     text NOT NULL REFERENCES public.mc_agent(id),
  instruction  text NOT NULL,
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','working','done','failed')),
  result       text,
  started_at   timestamptz,
  finished_at  timestamptz,
  UNIQUE (mission_id, ordinal)
);

-- ── Bandeja de aprobaciones ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mc_approval (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind              text NOT NULL CHECK (kind IN ('mission_plan','result','email_draft','notification','other')),
  mission_id        uuid REFERENCES public.mc_mission(id) ON DELETE SET NULL,
  agent_id          text REFERENCES public.mc_agent(id),
  title             text NOT NULL,
  payload           jsonb NOT NULL DEFAULT '{}'::jsonb,
  status            text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','expired')),
  requested_at      timestamptz NOT NULL DEFAULT now(),
  decided_by_email  text,
  decided_at        timestamptz,
  decision_note     text
);
CREATE INDEX IF NOT EXISTS idx_mc_approval_status ON public.mc_approval (status, requested_at DESC);

-- ── Auditoría: qué hizo cada agente y qué datos leyó ────────────────────────
CREATE TABLE IF NOT EXISTS public.mc_audit_log (
  id          bigserial PRIMARY KEY,
  at          timestamptz NOT NULL DEFAULT now(),
  actor       text NOT NULL,                                -- e-mail de usuario o id de agente
  action      text NOT NULL,
  entity      text,
  entity_id   text,
  details     jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_mc_audit_log_at ON public.mc_audit_log (at DESC);

CREATE TABLE IF NOT EXISTS public.mc_tool_call (
  id          bigserial PRIMARY KEY,
  at          timestamptz NOT NULL DEFAULT now(),
  agent_id    text NOT NULL,
  tool        text NOT NULL,                                -- p. ej. 'mc.abteilung_kennzahlen'
  args        jsonb NOT NULL DEFAULT '{}'::jsonb,
  ok          boolean NOT NULL,
  rows        integer,
  duration_ms integer,
  error       text
);
CREATE INDEX IF NOT EXISTS idx_mc_tool_call_at ON public.mc_tool_call (at DESC);

-- ── Caché de datos de MethaDesk (el backend copia aquí los indicadores) ─────
CREATE TABLE IF NOT EXISTS public.mc_snapshot (
  key         text PRIMARY KEY,                             -- p. ej. 'abteilung_kennzahlen'
  taken_at    timestamptz NOT NULL DEFAULT now(),
  source_at   timestamptz,                                  -- mc.meta.abgefragt_am de MethaDesk
  data        jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS public.mc_setting (
  key         text PRIMARY KEY,
  value       jsonb NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ── updated_at automático ───────────────────────────────────────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['mc_agent','mc_conversation','mc_mission'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%1$s_updated_at ON public.%1$I', t);
    EXECUTE format('CREATE TRIGGER trg_%1$s_updated_at BEFORE UPDATE ON public.%1$I
                    FOR EACH ROW EXECUTE FUNCTION public.mc_set_updated_at()', t);
  END LOOP;
END
$$;

-- ── RLS: denegado por defecto (solo service_role) ───────────────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['mc_agent','mc_conversation','mc_message','mc_mission','mc_mission_step',
                           'mc_approval','mc_audit_log','mc_tool_call','mc_snapshot','mc_setting'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM authenticated', t);
    END IF;
  END LOOP;
END
$$;

-- ── Agentes iniciales (uno por departamento + extras + orquestador) ─────────
INSERT INTO public.mc_agent (id, name, abteilung_ids, role_kind, building) VALUES
  ('chief',         'Methabau Chief',   '{}',                            'orchestrator', 'plaza'),
  ('projektleiter', 'Projektleiter',    '{projektleiter}',               'abteilung',    'projektleiter'),
  ('bauleitung',    'Bauleitung',       '{bauleiter}',                   'abteilung',    'bauleitung'),
  ('planer',        'Planer',           '{planer}',                      'abteilung',    'planer'),
  ('einkauf',       'Einkauf',          '{einkauf}',                     'abteilung',    'einkauf'),
  ('avor',          'AVOR',             '{avor}',                        'abteilung',    'avor'),
  ('produktion',    'Schlosserei/Blech','{schlosserei,blech}',           'abteilung',    'produktion'),
  ('werkhof',       'Werkhof',          '{werkhof}',                     'abteilung',    'werkhof'),
  ('montage',       'Montage',          '{montage}',                     'abteilung',    'montage'),
  ('bau',           'Bau',              '{bau}',                         'abteilung',    'bau'),
  ('externos',      'Externe',          '{subunternehmer,unternehmer}',  'abteilung',    'externos'),
  ('logistica',     'Lager',            '{}',                            'extra',        'lager'),
  ('flota',         'Fuhrpark',         '{}',                            'extra',        'fuhrpark'),
  ('admin',         'IT / Admin',       '{}',                            'extra',        'torre-it')
ON CONFLICT (id) DO NOTHING;

COMMIT;
