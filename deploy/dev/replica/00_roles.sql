-- ============================================================================
-- 00_roles.sql  ·  réplica de MethaDesk (desarrollo)  ·  roles y base de datos
-- ----------------------------------------------------------------------------
-- Ejecutar como el superusuario del contenedor Postgres, conectado a la base
-- `postgres`:  psql -U postgres -d postgres -v md_owner_pw=... -f 00_roles.sql
--
-- Reproduce lo que hay en el servidor de MethaDesk:
--   * los roles de Supabase que nombran las migraciones (anon, authenticated, service_role)
--   * un propietario de las tablas que NO es superusuario pero sí puede crear roles
--     (md_owner; en Supabase ese papel lo hace `postgres`). Es lo que exige 90_preflight.sql.
-- ============================================================================
\set ON_ERROR_STOP on

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'md_owner') THEN
    CREATE ROLE md_owner LOGIN NOSUPERUSER CREATEROLE NOCREATEDB;
  END IF;
END
$$;

ALTER ROLE md_owner PASSWORD :'md_owner_pw';

SELECT 'CREATE DATABASE methadesk OWNER md_owner'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'methadesk')
\gexec
