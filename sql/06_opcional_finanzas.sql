-- ============================================================================
-- 06_opcional_finanzas.sql  ·  MethaCity  ·  OPCIONAL — datos económicos
-- ----------------------------------------------------------------------------
-- NO se ejecuta por defecto. Contiene importes (costes, precios, horas).
-- Antes de usarlo hay que decidir qué datos pueden llegar a un modelo en la
-- nube (punto abierto 1 del plan). Crea el esquema `mc_finanz` y un tercer rol,
-- mc_finanz_readonly, para que el acceso a estos datos sea una decisión
-- explícita y revocable por separado.
-- ============================================================================
\set ON_ERROR_STOP on
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mc_finanz_readonly') THEN
    CREATE ROLE mc_finanz_readonly LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT
      NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 5;
  END IF;
END
$$;
ALTER ROLE mc_finanz_readonly SET default_transaction_read_only = on;
ALTER ROLE mc_finanz_readonly SET statement_timeout = '15s';
ALTER ROLE mc_finanz_readonly SET search_path = mc_finanz;
DO $$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO mc_finanz_readonly', current_database());
END
$$;

DROP SCHEMA IF EXISTS mc_finanz CASCADE;
CREATE SCHEMA mc_finanz;

CREATE VIEW mc_finanz.kosten AS
SELECT k.id, k."projektId", k.bezeichnung, k.betrag, k.kategorie, mc.to_date(k.datum) AS datum
FROM public.kosten k;

CREATE VIEW mc_finanz.material_preise AS
SELECT m.id, m."projektId", m."teilsystemId", m.bezeichnung, m.menge, m.einheit, m.preis, m.lieferant
FROM public.material m;

CREATE VIEW mc_finanz.ts_materialkosten AS
SELECT c.id,
       c."teilsystemId",
       c."projektId",
       c.bezeichnung,
       c."lieferantName",
       c.menge,
       c.einheit,
       c.einzelpreis,
       c.gesamtpreis,
       c.bestelldatum,
       c.lieferdatum
FROM public.ts_materialkosten c;

-- Horas agregadas por proyecto, departamento y mes: sin nombres de personas
-- ni tarifas individuales.
CREATE VIEW mc_finanz.stunden_monat AS
SELECT s."projektId",
       s."teilsystemId",
       s.abteilung,
       date_trunc('month', s.datum)::date AS monat,
       sum(s.stunden)                     AS stunden,
       sum(s.gesamtpreis)                 AS kosten,
       count(DISTINCT s."mitarbeiterId")  AS personen
FROM public.ts_stunden s
GROUP BY s."projektId", s."teilsystemId", s.abteilung, date_trunc('month', s.datum);

REVOKE ALL ON SCHEMA mc_finanz FROM PUBLIC;
GRANT USAGE ON SCHEMA mc_finanz TO mc_finanz_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA mc_finanz TO mc_finanz_readonly;
REVOKE ALL ON SCHEMA public FROM mc_finanz_readonly;
REVOKE ALL ON SCHEMA mc, mc_auth FROM mc_finanz_readonly;
-- mc_finanz.kosten usa mc.to_date (EXECUTE se comprueba con el usuario que consulta)
GRANT EXECUTE ON FUNCTION mc.to_date(text) TO mc_finanz_readonly;

COMMIT;
