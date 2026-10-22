-- ============================================================================
-- 05_permisos.sql  ·  MethaCity  ·  privilegios de mc_readonly y mc_auth_readonly
-- ----------------------------------------------------------------------------
-- Ejecutar DESPUÉS de 01..04. Re-ejecutable.
-- Principio: cada rol solo ve su esquema; solo SELECT; nada en `public`.
-- ============================================================================
\set ON_ERROR_STOP on
BEGIN;

-- Nada heredado en el esquema de MethaDesk
REVOKE ALL ON SCHEMA public FROM mc_readonly, mc_auth_readonly;
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM mc_readonly, mc_auth_readonly;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM mc_readonly, mc_auth_readonly;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM mc_readonly, mc_auth_readonly;

-- Esquemas nuevos: sin acceso público
REVOKE ALL ON SCHEMA mc, mc_auth FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA mc FROM PUBLIC;

-- Datos operativos → mc_readonly
REVOKE ALL ON SCHEMA mc_auth FROM mc_readonly;
GRANT USAGE ON SCHEMA mc TO mc_readonly;
REVOKE ALL ON ALL TABLES IN SCHEMA mc FROM mc_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA mc TO mc_readonly;

-- Identidad y permisos → mc_auth_readonly (nada de `mc`)
REVOKE ALL ON SCHEMA mc FROM mc_auth_readonly;
GRANT USAGE ON SCHEMA mc_auth TO mc_auth_readonly;
REVOKE ALL ON ALL TABLES IN SCHEMA mc_auth FROM mc_auth_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA mc_auth TO mc_auth_readonly;

-- Funciones auxiliares: PostgreSQL comprueba EXECUTE con el usuario que consulta
-- (no con el propietario de la vista), así que mc_readonly las necesita. Son
-- funciones puras sobre texto/fecha, sin acceso a datos.
GRANT EXECUTE ON FUNCTION mc.to_date(text), mc.heute() TO mc_readonly;

COMMIT;
