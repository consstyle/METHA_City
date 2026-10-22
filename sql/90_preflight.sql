-- ============================================================================
-- 90_preflight.sql  ·  MethaCity  ·  comprobaciones ANTES de crear las vistas
-- ----------------------------------------------------------------------------
-- Ejecutar como el rol que va a ejecutar 01..05 (propietario de las tablas de
-- MethaDesk), conectado a la base de datos de producción o de pruebas:
--   psql "host=... dbname=... user=..." -f 90_preflight.sql
-- NO modifica nada. Se detiene con error si falta alguna tabla o columna.
--
-- La lista de columnas esperadas está generada a partir de las dependencias
-- reales de las vistas (information_schema.view_column_usage). Si se cambia una
-- vista, hay que regenerarla.
-- ============================================================================
\set ON_ERROR_STOP on
\echo === 1. Quién soy y quién es el propietario de las tablas ===

SELECT current_user                                        AS rol_actual,
       r.rolsuper                                          AS superusuario,
       r.rolcreaterole                                     AS puede_crear_roles,
       r.rolbypassrls                                      AS ignora_rls,
       (SELECT tableowner FROM pg_tables
         WHERE schemaname = 'public' AND tablename = 'teilsysteme') AS propietario_de_teilsysteme,
       (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.teilsysteme'::regclass) AS rls_activo,
       (SELECT relforcerowsecurity FROM pg_class WHERE oid = 'public.teilsysteme'::regclass) AS rls_forzado,
       current_setting('server_version')                   AS version_postgres
FROM pg_roles r
WHERE r.rolname = current_user;

-- El rol actual debe ser propietario de las tablas (o ignorar RLS) y rls_forzado
-- debe ser false; si no, las vistas no podrían leer las tablas protegidas por RLS.
DO $$
DECLARE dueno text; forzado boolean; ok boolean;
BEGIN
  SELECT tableowner INTO dueno FROM pg_tables WHERE schemaname = 'public' AND tablename = 'teilsysteme';
  SELECT relforcerowsecurity INTO forzado FROM pg_class WHERE oid = 'public.teilsysteme'::regclass;
  SELECT (r.rolsuper OR r.rolbypassrls OR pg_has_role(current_user, dueno, 'member'))
    INTO ok FROM pg_roles r WHERE r.rolname = current_user;
  IF NOT ok THEN
    RAISE EXCEPTION 'El rol % no es propietario de las tablas (propietario: %). Las vistas deben crearse con el propietario.', current_user, dueno;
  END IF;
  IF forzado THEN
    RAISE EXCEPTION 'public.teilsysteme tiene RLS forzado: las vistas del propietario no podrían leerla.';
  END IF;
  IF NOT (SELECT rolcreaterole OR rolsuper FROM pg_roles WHERE rolname = current_user) THEN
    RAISE EXCEPTION 'El rol % no puede crear roles (necesario para 01_rollen.sql).', current_user;
  END IF;
  RAISE NOTICE 'OK    propietario y permisos de creación';
END
$$;

\echo === 2. Tablas y columnas que usan las vistas ===
DO $$
DECLARE faltan text;
BEGIN
  WITH erwartet(tabelle, spalten) AS (VALUES
  ('abt_page_permissions', ARRAY['abteilung_id', 'page_key']),
  ('abt_table_permissions', ARRAY['abteilung_id', 'can_export', 'can_read', 'table_id']),
  ('abteilungen', ARRAY['id', 'leiterName', 'name', 'updatedAt']),
  ('ausfuehrung_tasks', ARRAY['created_at', 'dauerTage', 'dueDate', 'estimatedHours', 'id', 'istVorgang', 'planStatus', 'priority', 'projektId', 'scheduledDate', 'sortOrder', 'status', 'teamId', 'teilsystemId', 'title', 'updated_at', 'vorgaengerId']),
  ('bestellungen', ARRAY['bestelldatum', 'containerBez', 'created_at', 'id', 'items', 'projektId', 'status', 'updated_at']),
  ('changelog', ARRAY['action', 'changedAt', 'entityId', 'entityType', 'field', 'id', 'projektId']),
  ('fahrzeug_reservierungen', ARRAY['endDatum', 'fahrzeugId', 'id', 'projektId', 'startDatum', 'status', 'zweck']),
  ('fahrzeuge', ARRAY['abgaswartung', 'baujahr', 'bezeichnung', 'geprueftBis', 'id', 'inventarnummer', 'kategorie', 'name', 'standort', 'status', 'typ']),
  ('kosten', ARRAY['betrag', 'bezeichnung', 'datum', 'id', 'kategorie', 'projektId']),
  ('lagerbewegungen', ARRAY['created_at', 'datum', 'einheit', 'entityId', 'entityType', 'id', 'lagerortId', 'menge', 'nachLagerplatzId', 'projektId', 'typ', 'vonLagerplatzId']),
  ('lagerorte', ARRAY['bereich', 'bezeichnung', 'id', 'name', 'projektId', 'typ']),
  ('lagerplaetze', ARRAY['bereich', 'bezeichnung', 'extern_typ', 'id', 'lagerortId', 'projektId']),
  ('lieferanten', ARRAY['aktiv', 'archiviert', 'id', 'kategorie', 'name']),
  ('maschinen', ARRAY['antrieb', 'category', 'id', 'name']),
  ('maschinen_anfragen', ARRAY['einsatzort', 'id', 'maschine_id', 'prioritaet', 'projekt_id', 'projekt_name', 'status', 'zeitraum_bis', 'zeitraum_von']),
  ('material', ARRAY['bezeichnung', 'created_at', 'einheit', 'id', 'lieferant', 'liefertermin', 'menge', 'name', 'preis', 'projektId', 'status', 'teilsystemId', 'updated_at']),
  ('pakete', ARRAY['bezeichnung', 'createdAt', 'id', 'lagerplatzId', 'projektId', 'status', 'teilsystemId', 'typ']),
  ('positionen', ARRAY['abteilung', 'bestelltAm', 'created_at', 'einheit', 'geliefertAm', 'id', 'lagerStatus', 'lieferant', 'material', 'menge', 'name', 'planStatus', 'posNummer', 'profil', 'projektId', 'status', 'teileart', 'teilsystemId', 'updated_at', 'verbautAm', 'weight']),
  ('projekte', ARRAY['archived', 'bauleiter', 'bauleiterIds', 'bimKonstrukteur', 'bimKonstrukteurIds', 'created_at', 'deletedAt', 'id', 'kanton', 'ort', 'polier', 'polierIds', 'projektleiter', 'projektleiterIds', 'projektname', 'projektnummer', 'status', 'updated_at']),
  ('subunternehmer', ARRAY['aktiv', 'archiviert', 'fachgebiet', 'id', 'name']),
  ('teams', ARRAY['abteilung', 'color', 'id', 'name', 'projektId']),
  ('teilsystem_abrufe', ARRAY['abgerufenAm', 'bestaetigtAm', 'flags', 'geliefertAm', 'id', 'liefertermin', 'lieferterminVorher', 'projektId', 'status', 'storniertAm', 'stornoGrund', 'teilsystemId', 'versendetAm']),
  ('teilsystem_gruppen', ARRAY['abteilung', 'createdAt', 'fertigAm', 'id', 'name', 'projektId', 'sortierung', 'status', 'teilsystemId', 'updatedAt']),
  ('teilsysteme', ARRAY['abgabePlaner', 'abrufLiefertermin', 'abrufStatus', 'abschnitt', 'abteilung', 'bauleitungErledigt', 'beschaffungsdauerTage', 'bestelldatum', 'created_at', 'eroeffnetAm', 'fertigung', 'gebaeude', 'geschoss', 'gewicht', 'herkunftsAbteilung', 'id', 'ks', 'lagerStatus', 'lagerplatzId', 'lieferant', 'lieferdatum', 'lieferdatumQuelle', 'lieferort', 'montageDauer', 'montageEnd', 'montageStart', 'montagetermin', 'montageterminQuelle', 'nachbearbeitung_datum', 'nachbearbeitung_erledigt_am', 'nachbearbeitung_grund', 'name', 'planFertigAm', 'planStatus', 'produktionBisQuelle', 'produktionEndeSoll', 'produktionStartSoll', 'produktionsdauerTage', 'projektId', 'status', 'subunternehmerName', 'teamName', 'teileart', 'teilsystemNummer', 'terminQuelle', 'unternehmer', 'updated_at', 'verantwortlich']),
  ('ts_materialkosten', ARRAY['bestelldatum', 'bezeichnung', 'einheit', 'einzelpreis', 'gesamtpreis', 'id', 'lieferantName', 'lieferdatum', 'menge', 'projektId', 'teilsystemId']),
  ('ts_stunden', ARRAY['abteilung', 'datum', 'gesamtpreis', 'mitarbeiterId', 'projektId', 'stunden', 'teilsystemId']),
  ('unterpositionen', ARRAY['abteilung', 'created_at', 'einheit', 'geliefertAm', 'gelieferteMenge', 'gewicht', 'id', 'lagerStatus', 'menge', 'name', 'planStatus', 'positionId', 'projektId', 'status', 'teilsystemId', 'untPosNummer', 'updated_at']),
  ('user_projekt_zuweisungen', ARRAY['projekt_id', 'user_id']),
  ('users', ARRAY['aktiv', 'alle_projekte', 'app_role', 'department', 'department_key', 'email', 'email_normalized', 'id', 'name', 'role', 'role_new'])
  ), soll AS (
    SELECT tabelle, unnest(spalten) AS spalte FROM erwartet
  ), fehlt AS (
    SELECT s.tabelle, s.spalte,
           CASE WHEN NOT EXISTS (SELECT 1 FROM information_schema.tables t
                                  WHERE t.table_schema = 'public' AND t.table_name = s.tabelle)
                THEN 'TABELLE FEHLT' ELSE 'SPALTE FEHLT' END AS problem
    FROM soll s
    WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns c
                       WHERE c.table_schema = 'public'
                         AND c.table_name = s.tabelle AND c.column_name = s.spalte)
  )
  SELECT string_agg(problem || ': ' || tabelle || '.' || spalte, E'\n' ORDER BY tabelle, spalte)
    INTO faltan FROM fehlt;
  IF faltan IS NOT NULL THEN
    RAISE EXCEPTION E'Faltan objetos en la base de datos:\n%', faltan;
  END IF;
  RAISE NOTICE 'OK    todas las tablas y columnas existen';
END
$$;

\echo === 3. Columnas opcionales (las vistas funcionan sin ellas) ===
SELECT v.tabelle, v.spalte,
       EXISTS (SELECT 1 FROM information_schema.columns c
                WHERE c.table_schema = 'public' AND c.table_name = v.tabelle
                  AND c.column_name = v.spalte) AS existe
FROM (VALUES ('bestellungen', 'liefertermin'), ('users', 'alle_projekte_ansicht')) AS v(tabelle, spalte);

\echo === 4. Calidad de las fechas (texto que NO es AAAA-MM-DD; las vistas lo convierten en NULL) ===
SELECT 'teilsysteme.montagetermin' AS campo,
       count(*) FILTER (WHERE NULLIF(btrim(montagetermin), '') IS NOT NULL)                              AS con_valor,
       count(*) FILTER (WHERE NULLIF(btrim(montagetermin), '') IS NOT NULL AND montagetermin !~ '^\d{4}-\d{2}-\d{2}') AS no_iso
FROM public.teilsysteme
UNION ALL
SELECT 'teilsysteme.abgabePlaner',
       count(*) FILTER (WHERE NULLIF(btrim("abgabePlaner"), '') IS NOT NULL),
       count(*) FILTER (WHERE NULLIF(btrim("abgabePlaner"), '') IS NOT NULL AND "abgabePlaner" !~ '^\d{4}-\d{2}-\d{2}')
FROM public.teilsysteme
UNION ALL
SELECT 'teilsysteme.lieferdatum',
       count(*) FILTER (WHERE NULLIF(btrim(lieferdatum), '') IS NOT NULL),
       count(*) FILTER (WHERE NULLIF(btrim(lieferdatum), '') IS NOT NULL AND lieferdatum !~ '^\d{4}-\d{2}-\d{2}')
FROM public.teilsysteme;

\echo === 5. Estado previo de roles y esquemas de MethaCity ===
SELECT (SELECT string_agg(rolname, ', ') FROM pg_roles WHERE rolname LIKE 'mc\_%') AS roles_existentes,
       (SELECT string_agg(nspname, ', ') FROM pg_namespace WHERE nspname IN ('mc','mc_auth','mc_finanz')) AS esquemas_existentes;

\echo === Preflight terminado ===
