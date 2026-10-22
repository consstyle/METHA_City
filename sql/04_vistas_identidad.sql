-- ============================================================================
-- 04_vistas_identidad.sql  ·  MethaCity  ·  esquema `mc_auth` (identidad y permisos)
-- ----------------------------------------------------------------------------
-- SOLO para la capa de login/permisos del backend de MethaCity (rol
-- mc_auth_readonly). Las herramientas de los agentes usan mc_readonly y NO
-- tienen acceso a este esquema.
--
-- Sirve para reproducir en MethaCity los permisos que MethaDesk aplica en la
-- aplicación (no usa RLS): rol, departamento, proyectos asignados y páginas /
-- tablas permitidas por departamento.
--
-- Nunca se exponen: passwordHash, notfall_*, stundensatz, telefon, imagen de
-- perfil, contadores de sesión, datos de último acceso.
-- El rol efectivo en MethaDesk es normalizeRole(app_role ?? role_new ?? role)
-- (src/lib/services/authService.ts); el backend debe replicar normalizeRole.
-- ============================================================================
\set ON_ERROR_STOP on
BEGIN;

DROP SCHEMA IF EXISTS mc_auth CASCADE;
CREATE SCHEMA mc_auth;

CREATE VIEW mc_auth.benutzer AS
SELECT u.id,
       u.email,
       COALESCE(u.email_normalized, lower(u.email)) AS email_normalized,
       u.name,
       COALESCE(u.aktiv, true)                      AS aktiv,
       u.app_role,
       u.role_new,
       u.role,
       COALESCE(u.app_role, u.role_new, u.role)     AS role_effektiv,
       u.department_key,
       u.department,
       lower(COALESCE(NULLIF(u.department_key, ''), NULLIF(u.department, ''))) AS department_effektiv,
       COALESCE(u.alle_projekte, false)             AS alle_projekte,
       COALESCE((to_jsonb(u)->>'alle_projekte_ansicht')::boolean, false) AS alle_projekte_ansicht
FROM public.users u;

CREATE VIEW mc_auth.projekt_zuweisungen AS
SELECT z.user_id, z.projekt_id
FROM public.user_projekt_zuweisungen z;

CREATE VIEW mc_auth.abt_seiten AS
SELECT p.abteilung_id, p.page_key
FROM public.abt_page_permissions p;

CREATE VIEW mc_auth.abt_tabellen AS
SELECT t.abteilung_id, t.table_id, t.can_read, t.can_export
FROM public.abt_table_permissions t;

COMMIT;
