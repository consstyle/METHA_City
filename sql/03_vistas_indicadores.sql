-- ============================================================================
-- 03_vistas_indicadores.sql  ·  MethaCity  ·  indicadores derivados (esquema `mc`)
-- ----------------------------------------------------------------------------
-- Alimentan los edificios de la ciudad (un edificio por departamento) y el
-- panel de proyectos. Se calculan SOLO sobre las vistas de 02_*.sql.
--
-- DEFINICIONES A VALIDAR CON LOS DEPARTAMENTOS (son heurísticas):
--   abierto            = status no está en (fertig, geliefert, verbaut)
--   montage_ueberfaellig  = montagetermin < hoy y status <> verbaut
--   plan_ueberfaellig     = abgabePlaner < hoy y planStatus <> fertig
--   lieferung_ueberfaellig= lieferdatum < hoy, status no en (geliefert, verbaut)
--                           y abrufStatus <> geliefert
--   nachbearbeitung       = status = nachbearbeitung
--   abruf_aktiv           = abrufStatus en (abgerufen, bestaetigt, versendet)
--   hat_daten             = el departamento tiene al menos un TS o grupo (la vista siempre
--                           devuelve los 12 departamentos; sin esta marca, «sin datos» y «cero»
--                           no se distinguirían)
-- Solo cuentan proyectos no archivados.
-- Los ids se comparan como texto: en MethaDesk los mismos ids son uuid en unas tablas y TEXT en otras.
-- ============================================================================
\set ON_ERROR_STOP on
BEGIN;

DROP VIEW IF EXISTS mc.abteilung_kennzahlen;
DROP VIEW IF EXISTS mc.projekt_kennzahlen;
DROP VIEW IF EXISTS mc.bestellungen_kennzahlen;
DROP VIEW IF EXISTS mc.lager_kennzahlen;
DROP VIEW IF EXISTS mc.aktivitaet_taeglich;

-- ── Por departamento (edificio) ─────────────────────────────────────────────
CREATE VIEW mc.abteilung_kennzahlen AS
WITH ts AS (
  SELECT lower(btrim(COALESCE(t.abteilung, ''))) AS abt_key, t.*
  FROM mc.teilsysteme t
  JOIN mc.projekte p ON p.id::text = t."projektId"::text AND NOT p.archived
),
ts_agg AS (
  SELECT abt_key,
         count(*)                                                        AS ts_gesamt,
         count(*) FILTER (WHERE status NOT IN ('fertig','geliefert','verbaut') OR status IS NULL) AS ts_offen,
         count(*) FILTER (WHERE status = 'in_planung')                   AS ts_in_planung,
         count(*) FILTER (WHERE status = 'offen')                        AS ts_offen_status,
         count(*) FILTER (WHERE status = 'in_arbeit')                    AS ts_in_arbeit,
         count(*) FILTER (WHERE status = 'bestellt')                     AS ts_bestellt,
         count(*) FILTER (WHERE status = 'fertig')                       AS ts_fertig,
         count(*) FILTER (WHERE status = 'teilgeliefert')                AS ts_teilgeliefert,
         count(*) FILTER (WHERE status = 'geliefert')                    AS ts_geliefert,
         count(*) FILTER (WHERE status = 'verbaut')                      AS ts_verbaut,
         count(*) FILTER (WHERE status = 'nachbearbeitung')              AS ts_nachbearbeitung,
         count(*) FILTER (WHERE status = 'express')                      AS ts_express,
         count(*) FILTER (WHERE montagetermin < mc.heute() AND status IS DISTINCT FROM 'verbaut') AS montage_ueberfaellig,
         count(*) FILTER (WHERE "abgabePlaner" < mc.heute() AND "planStatus" IS DISTINCT FROM 'fertig') AS plan_ueberfaellig,
         count(*) FILTER (WHERE lieferdatum < mc.heute()
                            AND status NOT IN ('geliefert','verbaut')
                            AND "abrufStatus" IS DISTINCT FROM 'geliefert')                      AS lieferung_ueberfaellig,
         count(*) FILTER (WHERE montagetermin BETWEEN mc.heute() AND mc.heute() + 14
                            AND status IS DISTINCT FROM 'verbaut')                               AS montage_naechste_14_tage,
         count(*) FILTER (WHERE "abrufStatus" IN ('abgerufen','bestaetigt','versendet'))        AS abruf_aktiv,
         min(montagetermin) FILTER (WHERE montagetermin >= mc.heute()
                                      AND status IS DISTINCT FROM 'verbaut')                     AS naechster_montagetermin
  FROM ts
  GROUP BY abt_key
),
gr_agg AS (
  SELECT lower(btrim(COALESCE(g.abteilung, ''))) AS abt_key,
         count(*) FILTER (WHERE g.status = 'offen')     AS gruppen_offen,
         count(*) FILTER (WHERE g.status = 'in_arbeit') AS gruppen_in_arbeit,
         count(*) FILTER (WHERE g.status = 'fertig')    AS gruppen_fertig
  FROM mc.gruppen g
  JOIN mc.projekte p ON p.id::text = g."projektId"::text AND NOT p.archived
  GROUP BY 1
)
SELECT k.id            AS abteilung_id,
       k.name          AS abteilung,
       k.farbe,
       k.reihenfolge,
       COALESCE(a.ts_gesamt, 0)               AS ts_gesamt,
       COALESCE(a.ts_offen, 0)                AS ts_offen,
       COALESCE(a.ts_in_planung, 0)           AS ts_in_planung,
       COALESCE(a.ts_offen_status, 0)         AS ts_offen_status,
       COALESCE(a.ts_in_arbeit, 0)            AS ts_in_arbeit,
       COALESCE(a.ts_bestellt, 0)             AS ts_bestellt,
       COALESCE(a.ts_fertig, 0)               AS ts_fertig,
       COALESCE(a.ts_teilgeliefert, 0)        AS ts_teilgeliefert,
       COALESCE(a.ts_geliefert, 0)            AS ts_geliefert,
       COALESCE(a.ts_verbaut, 0)              AS ts_verbaut,
       COALESCE(a.ts_nachbearbeitung, 0)      AS ts_nachbearbeitung,
       COALESCE(a.ts_express, 0)              AS ts_express,
       COALESCE(a.montage_ueberfaellig, 0)    AS montage_ueberfaellig,
       COALESCE(a.plan_ueberfaellig, 0)       AS plan_ueberfaellig,
       COALESCE(a.lieferung_ueberfaellig, 0)  AS lieferung_ueberfaellig,
       COALESCE(a.montage_naechste_14_tage,0) AS montage_naechste_14_tage,
       COALESCE(a.abruf_aktiv, 0)             AS abruf_aktiv,
       a.naechster_montagetermin,
       COALESCE(g.gruppen_offen, 0)           AS gruppen_offen,
       COALESCE(g.gruppen_in_arbeit, 0)       AS gruppen_in_arbeit,
       COALESCE(g.gruppen_fertig, 0)          AS gruppen_fertig,
       -- false = el departamento no tiene ningún TS ni grupo en proyectos activos: los ceros
       -- de esta fila son relleno, no datos (la interfaz muestra «sin datos»).
       (a.abt_key IS NOT NULL OR g.abt_key IS NOT NULL) AS hat_daten
FROM mc.abteilung_katalog k
LEFT JOIN ts_agg a ON a.abt_key = lower(k.name)
LEFT JOIN gr_agg g ON g.abt_key = lower(k.name);

-- ── Por proyecto (solar / edificio de obra) ─────────────────────────────────
CREATE VIEW mc.projekt_kennzahlen AS
SELECT p.id                AS "projektId",
       p.projektnummer,
       p.projektname,
       p.status            AS projekt_status,
       p.archived,
       count(t.id)                                                        AS ts_gesamt,
       count(t.id) FILTER (WHERE t.status = 'verbaut')                    AS ts_verbaut,
       count(t.id) FILTER (WHERE t.status = 'nachbearbeitung')            AS ts_nachbearbeitung,
       count(t.id) FILTER (WHERE t.status = 'express')                    AS ts_express,
       round(100.0 * count(t.id) FILTER (WHERE t.status = 'verbaut')
                   / NULLIF(count(t.id), 0), 1)                           AS ts_verbaut_prozent,
       COALESCE(sum(t.gewicht), 0)                                        AS gewicht_gesamt,
       COALESCE(sum(t.gewicht) FILTER (WHERE t.status = 'verbaut'), 0)    AS gewicht_verbaut,
       count(t.id) FILTER (WHERE t.montagetermin < mc.heute() AND t.status IS DISTINCT FROM 'verbaut') AS montage_ueberfaellig,
       count(t.id) FILTER (WHERE t."abgabePlaner" < mc.heute() AND t."planStatus" IS DISTINCT FROM 'fertig') AS plan_ueberfaellig,
       count(t.id) FILTER (WHERE t.lieferdatum < mc.heute()
                             AND t.status NOT IN ('geliefert','verbaut')
                             AND t."abrufStatus" IS DISTINCT FROM 'geliefert')                      AS lieferung_ueberfaellig,
       count(t.id) FILTER (WHERE t."abrufStatus" IN ('abgerufen','bestaetigt','versendet'))        AS abruf_aktiv,
       min(t.montagetermin) FILTER (WHERE t.montagetermin >= mc.heute()
                                      AND t.status IS DISTINCT FROM 'verbaut')                     AS naechster_montagetermin,
       max(t.updated_at)                                                  AS letzte_aenderung
FROM mc.projekte p
LEFT JOIN mc.teilsysteme t ON t."projektId"::text = p.id::text
GROUP BY p.id, p.projektnummer, p.projektname, p.status, p.archived;

-- ── Pedidos de material (edificio Werkhof / Bau) ────────────────────────────
CREATE VIEW mc.bestellungen_kennzahlen AS
SELECT b.status,
       count(*)                                                                AS anzahl,
       count(*) FILTER (WHERE b.liefertermin < mc.heute()
                          AND b.status IS DISTINCT FROM 'geliefert')           AS ueberfaellig,
       count(*) FILTER (WHERE b.liefertermin = mc.heute())                     AS heute,
       count(*) FILTER (WHERE b.liefertermin = mc.heute() + 1)                 AS morgen,
       count(*) FILTER (WHERE b.liefertermin IS NULL)                          AS ohne_termin,
       COALESCE(sum(b."anzahlOffen"), 0)                                       AS artikel_offen
FROM mc.bestellungen b
GROUP BY b.status;

-- ── Lager (edificio Lager): plazas y paquetes por zona ──────────────────────
CREATE VIEW mc.lager_kennzahlen AS
SELECT COALESCE(lp.bereich, 'ohne Bereich') AS bereich,
       count(DISTINCT lp.id)                AS lagerplaetze,
       count(pk.id)                         AS pakete,
       count(pk.id) FILTER (WHERE pk.status IS NOT NULL) AS pakete_mit_status
FROM mc.lagerplaetze lp
LEFT JOIN mc.pakete pk ON pk."lagerplatzId"::text = lp.id::text
GROUP BY COALESCE(lp.bereich, 'ohne Bereich');

-- ── Actividad diaria (mapa de calor), últimos 90 días ───────────────────────
CREATE VIEW mc.aktivitaet_taeglich AS
SELECT (c."changedAt" AT TIME ZONE 'Europe/Zurich')::date AS tag,
       c."projektId",
       c."entityType",
       count(*) AS aenderungen
FROM mc.aenderungen c
WHERE c."changedAt" >= now() - interval '90 days'
GROUP BY 1, 2, 3;

COMMIT;
