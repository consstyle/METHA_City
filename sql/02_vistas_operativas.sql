-- ============================================================================
-- 02_vistas_operativas.sql  ·  MethaCity  ·  esquema `mc` (datos para agentes)
-- ----------------------------------------------------------------------------
-- Ejecutar como el rol PROPIETARIO de las tablas de MethaDesk, para que las
-- vistas (sin security_invoker) lean las tablas saltándose su RLS. mc_readonly
-- solo recibe SELECT sobre estas vistas, nunca sobre las tablas base.
--
-- Reglas de diseño
--   * Lista explícita de columnas (nunca SELECT *): lo que no está aquí no sale.
--   * Excluido siempre: contraseñas, hashes, tokens, e-mails, teléfonos,
--     tarifas horarias, nombres de quien actúa, adjuntos, URLs de ficheros/IFC,
--     historiales en texto libre, valores antiguos/nuevos del changelog.
--   * MethaDesk guarda casi todas las fechas como TEXT: se convierten con
--     mc.to_date() (NULL si no es ISO AAAA-MM-DD).
--   * Columnas no confirmadas en el snapshot de producción se leen con
--     to_jsonb(fila)->>'columna', que devuelve NULL en vez de fallar si no existe.
--   * Los permisos por proyecto/departamento NO se aplican aquí (MethaDesk los
--     aplica en la aplicación). Los aplica el backend de MethaCity con mc_auth.
-- ============================================================================
\set ON_ERROR_STOP on
BEGIN;

DROP SCHEMA IF EXISTS mc CASCADE;
CREATE SCHEMA mc;

-- ── Funciones auxiliares ────────────────────────────────────────────────────
CREATE FUNCTION mc.to_date(t text) RETURNS date
LANGUAGE plpgsql STABLE PARALLEL SAFE AS $$
BEGIN
  IF t IS NULL OR t !~ '^\d{4}-\d{2}-\d{2}' THEN
    RETURN NULL;
  END IF;
  RETURN left(t, 10)::date;
EXCEPTION WHEN others THEN
  RETURN NULL;
END
$$;

CREATE FUNCTION mc.heute() RETURNS date
LANGUAGE sql STABLE PARALLEL SAFE AS $$
  SELECT (now() AT TIME ZONE 'Europe/Zurich')::date
$$;

-- ── Catálogo de departamentos (espejo de ABTEILUNGEN_CONFIG, src/types/index.ts) ──
-- Si cambia ABTEILUNGEN_CONFIG en MethaDesk, actualizar esta lista.
CREATE VIEW mc.abteilung_katalog AS
SELECT v.id, v.name, v.farbe, v.reihenfolge
FROM (VALUES
  ('projektleiter',  'Projektleiter',  'indigo',  1),
  ('bauleiter',      'Bauleitung',     'sky',     2),
  ('planer',         'Planer',         'teal',    3),
  ('einkauf',        'Einkauf',        'amber',   4),
  ('avor',           'AVOR',           'purple',  5),
  ('schlosserei',    'Schlosserei',    'slate',   6),
  ('blech',          'Blechabteilung', 'orange',  7),
  ('werkhof',        'Werkhof',        'violet',  8),
  ('montage',        'Montage',        'green',   9),
  ('bau',            'Bau',            'red',    10),
  ('subunternehmer', 'Subunternehmer', 'cyan',   11),
  ('unternehmer',    'Unternehmer',    'rose',   12)
) AS v(id, name, farbe, reihenfolge);

-- ── Departamentos (jefe de departamento: solo nombre, sin e-mail) ───────────
CREATE VIEW mc.abteilungen AS
SELECT a.id, a.name, a."leiterName", a."updatedAt"
FROM public.abteilungen a;

-- ── Proyectos (sin borrados lógicos; sin dirección postal, sin ficheros) ────
CREATE VIEW mc.projekte WITH (security_barrier = true) AS
SELECT p.id,
       p.projektnummer,
       p.projektname,
       p.ort,
       p.kanton,
       p.status,
       COALESCE(p.archived, false) AS archived,
       p.projektleiter,
       p.bauleiter,
       p.polier,
       p."bimKonstrukteur",
       p."projektleiterIds",
       p."bauleiterIds",
       p."polierIds",
       p."bimKonstrukteurIds",
       p.created_at,
       p.updated_at
FROM public.projekte p
WHERE p."deletedAt" IS NULL;

-- ── Teilsysteme (TS): núcleo del flujo de trabajo ───────────────────────────
CREATE VIEW mc.teilsysteme AS
SELECT t.id,
       t."projektId",
       t."teilsystemNummer",
       t.name,
       t.ks,
       t.status,
       t."planStatus",
       t.abteilung,
       t."herkunftsAbteilung",
       t.verantwortlich,
       t.fertigung,
       t.teileart,
       t.gewicht,
       mc.to_date(t.montagetermin)          AS montagetermin,
       mc.to_date(t."montageStart")         AS "montageStart",
       mc.to_date(t."montageEnd")           AS "montageEnd",
       t."montageDauer",
       mc.to_date(t."abgabePlaner")         AS "abgabePlaner",
       mc.to_date(t.lieferdatum)            AS lieferdatum,
       mc.to_date(t."produktionStartSoll")  AS "produktionStartSoll",
       mc.to_date(t."produktionEndeSoll")   AS "produktionEndeSoll",
       t."produktionsdauerTage",
       t."beschaffungsdauerTage",
       t."terminQuelle",
       t."lieferdatumQuelle",
       t."produktionBisQuelle",
       t."montageterminQuelle",
       t."bauleitungErledigt",
       t."abrufStatus",
       mc.to_date(t."abrufLiefertermin")    AS "abrufLiefertermin",
       mc.to_date(t."planFertigAm")         AS "planFertigAm",
       t.nachbearbeitung_grund,
       mc.to_date(t.nachbearbeitung_datum)         AS nachbearbeitung_datum,
       mc.to_date(t.nachbearbeitung_erledigt_am)   AS nachbearbeitung_erledigt_am,
       t."lagerStatus",
       t."lagerplatzId",
       mc.to_date(t.bestelldatum)           AS bestelldatum,
       t.lieferant,
       t.lieferort,
       t.gebaeude,
       t.geschoss,
       t.abschnitt,
       t."subunternehmerName",
       t.unternehmer,
       t."teamName",
       t."eroeffnetAm",
       t.created_at,
       t.updated_at
FROM public.teilsysteme t;

-- ── Posiciones y subposiciones ──────────────────────────────────────────────
CREATE VIEW mc.positionen AS
SELECT p.id,
       p."teilsystemId",
       p."projektId",
       p."posNummer",
       p.name,
       p.status,
       p."planStatus",
       p.abteilung,
       p.menge,
       p.einheit,
       p.material,
       p.teileart,
       p.profil,
       p.weight,
       p.lieferant,
       p."lagerStatus",
       mc.to_date(p."bestelltAm")  AS "bestelltAm",
       mc.to_date(p."geliefertAm") AS "geliefertAm",
       mc.to_date(p."verbautAm")   AS "verbautAm",
       p.created_at,
       p.updated_at
FROM public.positionen p;

CREATE VIEW mc.unterpositionen AS
SELECT u.id,
       u."positionId",
       u."teilsystemId",
       u."projektId",
       u."untPosNummer",
       u.name,
       u.status,
       u."planStatus",
       u.abteilung,
       u.menge,
       u.einheit,
       u.gewicht,
       u."lagerStatus",
       u."gelieferteMenge",
       mc.to_date(u."geliefertAm") AS "geliefertAm",
       u.created_at,
       u.updated_at
FROM public.unterpositionen u;

-- ── Grupos dentro de un TS ──────────────────────────────────────────────────
CREATE VIEW mc.gruppen AS
SELECT g.id,
       g."teilsystemId",
       g."projektId",
       g.name,
       g.abteilung,
       g.status,
       g.sortierung,
       mc.to_date(g."fertigAm") AS "fertigAm",
       g."createdAt",
       g."updatedAt"
FROM public.teilsystem_gruppen g;

-- ── Abrufe (la Bauleitung llama un TS a obra): sin e-mails ni usuarios ──────
CREATE VIEW mc.abrufe AS
SELECT a.id,
       a."teilsystemId",
       a."projektId",
       a.status,
       mc.to_date(a.liefertermin)         AS liefertermin,
       mc.to_date(a."lieferterminVorher") AS "lieferterminVorher",
       a."stornoGrund",
       a.flags,
       a."abgerufenAm",
       a."bestaetigtAm",
       a."versendetAm",
       a."geliefertAm",
       a."storniertAm"
FROM public.teilsystem_abrufe a;

-- ── Pedidos de material (Bau → Werkhof): resumen, sin detalle de artículos ──
-- `liefertermin` no figura en el snapshot de producción; to_jsonb la lee si existe.
CREATE VIEW mc.bestellungen AS
SELECT b.id,
       b."projektId",
       b.status,
       b."containerBez",
       mc.to_date(b.bestelldatum)                       AS bestelldatum,
       mc.to_date(to_jsonb(b)->>'liefertermin')         AS liefertermin,
       CASE WHEN jsonb_typeof(b.items) = 'array' THEN jsonb_array_length(b.items) ELSE 0 END AS "anzahlArtikel",
       CASE WHEN jsonb_typeof(b.items) = 'array' THEN (
         SELECT count(*) FROM jsonb_array_elements(b.items) e
         WHERE e->>'vorbereitet' IS DISTINCT FROM 'true'
       ) ELSE 0 END AS "anzahlOffen",
       b.created_at,
       b.updated_at
FROM public.bestellungen b;

-- ── Material (sin precios: ver 06_opcional_finanzas.sql) ────────────────────
CREATE VIEW mc.material AS
SELECT m.id,
       m."projektId",
       m."teilsystemId",
       m.bezeichnung,
       m.name,
       m.menge,
       m.einheit,
       m.lieferant,
       mc.to_date(m.liefertermin) AS liefertermin,
       m.status,
       m.created_at,
       m.updated_at
FROM public.material m;

-- ── Lager ───────────────────────────────────────────────────────────────────
CREATE VIEW mc.lagerorte AS
SELECT l.id, l."projektId", l.name, l.bezeichnung, l.typ, l.bereich
FROM public.lagerorte l;

CREATE VIEW mc.lagerplaetze AS
SELECT l.id, l."lagerortId", l."projektId", l.bezeichnung, l.bereich, l.extern_typ
FROM public.lagerplaetze l;

CREATE VIEW mc.pakete AS
SELECT p.id, p."lagerplatzId", p."projektId", p."teilsystemId", p.bezeichnung, p.typ, p.status, p."createdAt"
FROM public.pakete p;

CREATE VIEW mc.lagerbewegungen AS
SELECT b.id,
       b."lagerortId",
       b."projektId",
       b.typ,
       b.menge,
       b.einheit,
       mc.to_date(b.datum) AS datum,
       b."entityType",
       b."entityId",
       b."vonLagerplatzId",
       b."nachLagerplatzId",
       b.created_at
FROM public.lagerbewegungen b;

-- ── Ejecución en obra: tareas y equipos (sin personas asignadas) ────────────
CREATE VIEW mc.ausfuehrung_tasks AS
SELECT t.id,
       t."projektId",
       t."teilsystemId",
       t.title,
       t.status,
       t.priority,
       mc.to_date(t."dueDate")       AS "dueDate",
       mc.to_date(t."scheduledDate") AS "scheduledDate",
       t."estimatedHours",
       t."planStatus",
       t."teamId",
       t."istVorgang",
       t."dauerTage",
       t."sortOrder",
       t."vorgaengerId",
       t.created_at,
       t.updated_at
FROM public.ausfuehrung_tasks t;

CREATE VIEW mc.teams AS
SELECT t.id, t.name, t."projektId", t.abteilung, t.color
FROM public.teams t;

-- ── Flota y máquinas (sin matrícula, sin quién reservó) ─────────────────────
CREATE VIEW mc.fahrzeuge AS
SELECT f.id,
       COALESCE(f.bezeichnung, f.name) AS bezeichnung,
       f.typ,
       f.kategorie,
       f.status,
       f.standort,
       f.inventarnummer,
       f.baujahr,
       mc.to_date(f."geprueftBis")  AS "geprueftBis",
       mc.to_date(f.abgaswartung)   AS abgaswartung
FROM public.fahrzeuge f;

CREATE VIEW mc.fahrzeug_reservierungen AS
SELECT r.id,
       r."fahrzeugId",
       r."projektId",
       mc.to_date(r."startDatum") AS "startDatum",
       mc.to_date(r."endDatum")   AS "endDatum",
       r.zweck,
       r.status
FROM public.fahrzeug_reservierungen r;

CREATE VIEW mc.maschinen AS
SELECT m.id, m.name, m.category, m.antrieb
FROM public.maschinen m;

CREATE VIEW mc.maschinen_anfragen AS
SELECT a.id,
       a.maschine_id,
       a.projekt_id,
       a.projekt_name,
       a.einsatzort,
       a.zeitraum_von,
       a.zeitraum_bis,
       a.status,
       a.prioritaet
FROM public.maschinen_anfragen a;

-- ── Proveedores y subcontratistas: sin datos de contacto ────────────────────
CREATE VIEW mc.lieferanten AS
SELECT l.id, l.name, l.kategorie, l.aktiv, l.archiviert
FROM public.lieferanten l;

CREATE VIEW mc.subunternehmer AS
SELECT s.id, s.name, s.fachgebiet, s.aktiv, s.archiviert
FROM public.subunternehmer s;

-- ── Auditoría: solo qué cambió y cuándo (sin valores, sin quién) ────────────
CREATE VIEW mc.aenderungen AS
SELECT c.id,
       c."entityId",
       c."entityType",
       c."projektId",
       c.field,
       c.action,
       c."changedAt"
FROM public.changelog c;

-- ── Marca de versión / frescura ─────────────────────────────────────────────
CREATE VIEW mc.meta AS
SELECT 1 AS schema_version, now() AS abgefragt_am, mc.heute() AS heute_zuerich;

COMMIT;
