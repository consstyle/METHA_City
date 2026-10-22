-- ============================================================================
-- 99_verificacion.sql  ·  MethaCity  ·  comprobación del aislamiento
-- ----------------------------------------------------------------------------
-- Ejecutar CONECTADO COMO mc_readonly (no como postgres):
--   psql "host=... dbname=... user=mc_readonly" -f 99_verificacion.sql
-- Cada línea empieza por OK o FALLO. Cualquier FALLO bloquea el uso del rol.
-- ============================================================================
\set ON_ERROR_STOP off
\echo === Verificación de mc_readonly ===

SELECT current_user                                   AS rol,
       current_setting('default_transaction_read_only') AS solo_lectura_por_defecto,
       current_setting('statement_timeout')           AS statement_timeout,
       current_setting('search_path')                 AS search_path;

-- 1) Debe poder leer sus vistas
DO $$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM mc.teilsysteme;
  RAISE NOTICE 'OK    lectura de mc.teilsysteme (% filas)', n;
  SELECT count(*) INTO n FROM mc.abteilung_kennzahlen;
  RAISE NOTICE 'OK    lectura de mc.abteilung_kennzahlen (% filas)', n;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'FALLO lectura de vistas mc: %', SQLERRM;
END
$$;

-- 2) NO debe poder leer tablas base de MethaDesk
DO $$
BEGIN
  PERFORM 1 FROM public.users LIMIT 1;
  RAISE NOTICE 'FALLO public.users es legible';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'OK    public.users bloqueada';
END
$$;
DO $$
BEGIN
  PERFORM 1 FROM public.teilsysteme LIMIT 1;
  RAISE NOTICE 'FALLO public.teilsysteme es legible';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'OK    public.teilsysteme bloqueada';
END
$$;

-- 3) NO debe poder leer identidad ni finanzas
DO $$
BEGIN
  PERFORM 1 FROM mc_auth.benutzer LIMIT 1;
  RAISE NOTICE 'FALLO mc_auth.benutzer es legible';
EXCEPTION WHEN insufficient_privilege OR invalid_schema_name OR undefined_table THEN
  RAISE NOTICE 'OK    mc_auth bloqueado';
END
$$;
DO $$
BEGIN
  PERFORM 1 FROM mc_finanz.kosten LIMIT 1;
  RAISE NOTICE 'FALLO mc_finanz.kosten es legible';
EXCEPTION WHEN insufficient_privilege OR invalid_schema_name OR undefined_table THEN
  RAISE NOTICE 'OK    mc_finanz bloqueado';
END
$$;

-- 4) NO debe poder escribir ni crear objetos
DO $$
BEGIN
  EXECUTE 'DELETE FROM mc.teilsysteme';
  RAISE NOTICE 'FALLO DELETE sobre mc.teilsysteme permitido';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'OK    DELETE bloqueado';
END
$$;
DO $$
BEGIN
  EXECUTE 'CREATE TABLE public.mc_prueba (x int)';
  RAISE NOTICE 'FALLO CREATE TABLE en public permitido';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'OK    CREATE TABLE en public bloqueado';
END
$$;
DO $$
BEGIN
  EXECUTE 'CREATE TABLE mc.mc_prueba (x int)';
  RAISE NOTICE 'FALLO CREATE TABLE en mc permitido';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'OK    CREATE TABLE en mc bloqueado';
END
$$;

-- 5) Ninguna vista de `mc` expone columnas sensibles
DO $$
DECLARE n int; r text;
BEGIN
  SELECT count(*), string_agg(table_name || '.' || column_name, ', ')
    INTO n, r
  FROM information_schema.columns
  WHERE table_schema = 'mc'
    AND column_name ~* '(passw|hash|token|secret|notfall|e_?mail|telefon|stundensatz|iban|url)';
  IF n = 0 THEN
    RAISE NOTICE 'OK    ninguna columna sensible en el esquema mc';
  ELSE
    RAISE NOTICE 'FALLO columnas sensibles en mc: %', r;
  END IF;
END
$$;

-- 6) No debe ser miembro de ningún otro rol (anon, authenticated, service_role, postgres...)
DO $$
DECLARE n int; r text;
BEGIN
  SELECT count(*), string_agg(rolname, ', ')
    INTO n, r
  FROM pg_roles
  WHERE pg_has_role(current_user, oid, 'member') AND rolname <> current_user;
  IF n = 0 THEN
    RAISE NOTICE 'OK    el rol no es miembro de otros roles';
  ELSE
    RAISE NOTICE 'FALLO el rol es miembro de: %', r;
  END IF;
END
$$;

\echo === Fin ===
