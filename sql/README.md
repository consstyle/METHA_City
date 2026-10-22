# MethaCity · acceso de solo lectura a la base de datos de MethaDesk

Roles y vistas que dejan a MethaCity leer los datos de MethaDesk **sin poder escribir ni ver tablas base**.

> **Estado de la validación.** Los scripts se probaron con PGlite (PostgreSQL en WASM) contra una réplica del esquema construida con `easypanel-public.sql` más 19 migraciones de MethaDesk, con RLS activado y un propietario que no es superusuario. 60 comprobaciones pasan. **No se han ejecutado contra la base de datos real.** Antes de producción: `90_preflight.sql` y luego un ensayo sobre una copia (MethaDesk tiene `docs/RUNBOOK-TEST-ENV-DOKPLOY.md` y `docs/PLAN-STAGING-DEV.md`).

## Archivos (ejecutar en este orden con `psql`)

| Archivo | Qué hace | Quién lo ejecuta |
|---|---|---|
| `90_preflight.sql` | Comprueba propietario, RLS y que existan las 29 tablas / 297 columnas que usan las vistas. No modifica nada. | propietario de las tablas |
| `01_rollen.sql` | Crea `mc_readonly` y `mc_auth_readonly` (sin contraseña) con límites. | propietario |
| `02_vistas_operativas.sql` | Esquema `mc`: funciones auxiliares y 24 vistas de datos. | propietario |
| `03_vistas_indicadores.sql` | Indicadores por departamento, proyecto, pedidos, Lager y actividad. | propietario |
| `04_vistas_identidad.sql` | Esquema `mc_auth`: usuarios, proyectos asignados, permisos por departamento. | propietario |
| `05_permisos.sql` | `GRANT` / `REVOKE`. Re-ejecutable. | propietario |
| `06_opcional_finanzas.sql` | **Opcional.** Esquema `mc_finanz` y rol `mc_finanz_readonly` (importes). | propietario |
| `99_verificacion.sql` | Comprueba el aislamiento. | **conectado como `mc_readonly`** |

El «propietario» es el rol dueño de las tablas de MethaDesk (suele ser `postgres` en Supabase; `90_preflight.sql` lo comprueba). Las vistas **no** usan `security_invoker`: se ejecutan con los privilegios del propietario y por eso pueden leer tablas con RLS, mientras que `mc_readonly` solo tiene `SELECT` sobre las vistas.

```bash
psql "host=<db> dbname=postgres user=postgres" -f 90_preflight.sql
psql "host=<db> dbname=postgres user=postgres" -f 01_rollen.sql -f 02_vistas_operativas.sql -f 03_vistas_indicadores.sql -f 04_vistas_identidad.sql -f 05_permisos.sql
```

## Contraseñas (no van en los archivos)

Fijarlas con `psql` y guardarlas en 1Password y en las variables de entorno de Dokploy (nunca en el repositorio):

```sql
\password mc_readonly
\password mc_auth_readonly
```

## Conexión

- Conexión **directa a Postgres** por la red interna de Docker/Dokploy (puerto 5432 del servicio de Supabase DB). Sin pooler (Supavisor) ni Kong/PostgREST: el pooler en modo transacción ignora los ajustes del rol.
- **No publicar el puerto 5432.** El contenedor de MethaCity debe unirse a la red del servicio de base de datos de MethaDesk. Si se puede editar `pg_hba.conf`, limitar `mc_readonly` y `mc_auth_readonly` a la subred de MethaCity.
- Cadena de conexión: `postgresql://mc_readonly:<contraseña>@<servicio-db>:5432/postgres` (comprobar el nombre real del servicio y de la base de datos).
- Los agentes **no reciben esta cadena**. Solo el backend de MethaCity la tiene; los agentes llaman a herramientas del backend.
- Recomendado: el backend copia periódicamente los datos que necesita a su Supabase propio y las pantallas leen de ahí, para no consultar producción en cada visita.

## Qué se expone y qué no

| Esquema | Rol | Contenido |
|---|---|---|
| `mc` | `mc_readonly` | proyectos, TS, posiciones, subposiciones, grupos, Abrufe, pedidos (resumen), material (sin precios), Lager, tareas de obra, equipos, flota, máquinas, proveedores (sin contacto), auditoría (sin valores), catálogo de departamentos e indicadores |
| `mc_auth` | `mc_auth_readonly` | usuarios (id, e-mail, nombre, rol, departamento), proyectos asignados, páginas y tablas por departamento |
| `mc_finanz` (opcional) | `mc_finanz_readonly` | costes, precios de material, costes de material por TS, horas por mes |

**Nunca se exponen:** contraseñas y hashes, `notfall_*`, tarifas por hora, teléfonos, imágenes de perfil, datos de último acceso, e-mails de proveedores, direcciones postales, URLs de ficheros e IFC, historiales en texto libre, valores antiguos/nuevos del changelog, quién hizo cada cambio o movimiento, adjuntos del feedback, el feedback y la encuesta de satisfacción.

## Lo que hay que saber antes de usarlo

1. **Los permisos por proyecto y departamento no se aplican aquí.** MethaDesk no usa RLS: los aplica en la aplicación. Cualquier consulta con `mc_readonly` ve todos los proyectos. El backend de MethaCity debe aplicarlos con `mc_auth` (`projekt_zuweisungen`, `alle_projekte`, `abt_seiten`, `abt_tabellen`) y replicar `normalizeRole` de `src/lib/services/authService.ts`.
2. **Las fechas de MethaDesk son TEXT.** `mc.to_date()` devuelve NULL si el texto no empieza por `AAAA-MM-DD`. `90_preflight.sql` (punto 4) cuenta cuántos valores no son ISO en producción.
3. **Los indicadores son heurísticas** (definiciones al inicio de `03_vistas_indicadores.sql`): validar con cada departamento qué significa «abierto», «atrasado», etc.
4. **Los ids se comparan como texto** en los indicadores, porque en MethaDesk el mismo id es `uuid` en unas tablas y `TEXT` en otras.
5. **`bestellungen.liefertermin`** y **`users.alle_projekte_ansicht`** no figuran en el snapshot de producción; las vistas las leen con `to_jsonb(fila)->>'columna'` y devuelven NULL / `false` si no existen.
6. `mc.abteilung_katalog` es una copia de `ABTEILUNGEN_CONFIG` (`src/types/index.ts`). Si cambia allí, hay que cambiarla aquí.
7. `mc_readonly` necesita `EXECUTE` sobre `mc.to_date` y `mc.heute`: PostgreSQL comprueba ese permiso con el usuario que consulta, no con el propietario de la vista. Son funciones puras.
8. `default_transaction_read_only`, `statement_timeout` y los demás `ALTER ROLE ... SET` son defensa en profundidad: la sesión puede cambiarlos. La protección real son los privilegios (solo `SELECT` sobre vistas).

## Reglas de MethaDesk que afectan a esto (`CLAUDE.md`)

- **Backup:** las vistas y los roles viven en el mismo clúster, así que `pg_dump` del sistema (`ops/backup`) los incluye solos. No hay tablas nuevas, por tanto no hay que tocar `projektArchivTabellen.ts` ni `backupAbdeckung.ts`. Tras crearlos, ejecutar `sudo methadesk-backup.sh audit`.
- **Migraciones:** estos scripts usan comandos de `psql` (`\set`, `\echo`) y crean roles, por eso **no** están pensados como migración de la aplicación en `supabase/migrations`. Se ejecutan a mano desde el servidor. Si se quiere versionar en el repositorio de MethaDesk, hay que pedir antes tu OK (regla de no hacer push sin confirmación).
- **Nuevas columnas o tablas en MethaDesk:** no aparecen en MethaCity hasta que se añadan a una vista.

## Deshacer

```sql
DROP SCHEMA IF EXISTS mc CASCADE;
DROP SCHEMA IF EXISTS mc_auth CASCADE;
DROP SCHEMA IF EXISTS mc_finanz CASCADE;
REVOKE CONNECT ON DATABASE postgres FROM mc_readonly, mc_auth_readonly, mc_finanz_readonly;
DROP ROLE IF EXISTS mc_readonly, mc_auth_readonly, mc_finanz_readonly;
```

Esto no toca ninguna tabla de MethaDesk.
