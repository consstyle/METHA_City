-- ============================================================================
-- 01_rollen.sql  ·  MethaCity  ·  Roles de solo lectura sobre la BD de MethaDesk
-- ----------------------------------------------------------------------------
-- Ejecutar UNA vez, como el rol propietario de las tablas de MethaDesk
-- (en Supabase self-hosted suele ser `postgres`; ver 90_preflight.sql).
--
-- Crea dos roles SIN contraseña (la contraseña se fija aparte, ver README):
--   mc_readonly       datos operativos para los agentes (esquema `mc`)
--   mc_auth_readonly  identidad y permisos, SOLO para la capa de login/permisos
--                     de MethaCity; nunca para herramientas de agentes (esquema `mc_auth`)
--
-- La seguridad real son los PRIVILEGIOS (solo SELECT sobre vistas). Las opciones
-- ALTER ROLE ... SET son defensa en profundidad: una sesión puede cambiarlas.
-- ============================================================================
\set ON_ERROR_STOP on

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mc_readonly') THEN
    CREATE ROLE mc_readonly LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT
      NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 10;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mc_auth_readonly') THEN
    CREATE ROLE mc_auth_readonly LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT
      NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 5;
  END IF;
END
$$;

-- Límites y modo solo lectura por defecto
ALTER ROLE mc_readonly SET default_transaction_read_only = on;
ALTER ROLE mc_readonly SET statement_timeout = '15s';
ALTER ROLE mc_readonly SET lock_timeout = '2s';
ALTER ROLE mc_readonly SET idle_in_transaction_session_timeout = '30s';
ALTER ROLE mc_readonly SET search_path = mc;

ALTER ROLE mc_auth_readonly SET default_transaction_read_only = on;
ALTER ROLE mc_auth_readonly SET statement_timeout = '5s';
ALTER ROLE mc_auth_readonly SET lock_timeout = '2s';
ALTER ROLE mc_auth_readonly SET idle_in_transaction_session_timeout = '30s';
ALTER ROLE mc_auth_readonly SET search_path = mc_auth;

-- Conexión a la base de datos actual (el nombre varía: `postgres` en Supabase)
DO $$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO mc_readonly, mc_auth_readonly', current_database());
END
$$;

-- Los roles nuevos no son miembros de ningún otro rol (anon, authenticated,
-- service_role, postgres...). No se asigna nada; 99_verificacion.sql lo comprueba.
