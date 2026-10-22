#!/usr/bin/env bash
# Monta la réplica de MethaDesk en el contenedor Postgres de desarrollo y aplica el SQL de
# MethaCity (roles y vistas de solo lectura). Re-ejecutable; con --reset empieza de cero.
#
#   cd ~/methacity/deploy/dev && cp .env.example .env && nano .env   # rellenar contraseñas
#   ./scripts/bootstrap-replica.sh            # primera vez
#   ./scripts/bootstrap-replica.sh --reset    # borra la réplica y los roles mc_* y repite
#
# Requisitos: contenedor methacity-dev-db en marcha (variable DB_CONTAINER si se llama distinto)
# y la carpeta ../../sql (los scripts de MethaCity) junto a deploy/.
set -euo pipefail

cd "$(dirname "$0")/.."
DEV_DIR="$(pwd)"
SQL_DIR="$(cd ../../sql && pwd)"
DB="${DB_CONTAINER:-methacity-dev-db}"

die() { echo "ERROR: $*" >&2; exit 1; }

[ -f .env ] || die "falta .env (copia .env.example y rellénalo)"
set -a; . ./.env; set +a
for v in MD_OWNER_PW MC_READONLY_PW MC_AUTH_PW; do
  [ -n "${!v:-}" ] || die "falta $v en .env"
done
ENABLE_FINANZ="${ENABLE_FINANZ:-0}"
if [ "$ENABLE_FINANZ" = "1" ] && [ -z "${MC_FINANZ_PW:-}" ]; then die "ENABLE_FINANZ=1 pero falta MC_FINANZ_PW"; fi
docker inspect -f '{{.State.Running}}' "$DB" 2>/dev/null | grep -q true || die "el contenedor $DB no está en marcha"

# Superusuario por el socket local de Postgres (sin contraseña, solo dentro del contenedor)
psql_su()    { docker exec -i "$DB" psql -U postgres -d postgres -v ON_ERROR_STOP=1 "$@"; }
psql_owner() { docker exec -i "$DB" psql -U md_owner -d methadesk -v ON_ERROR_STOP=1 "$@"; }

if [ "${1:-}" = "--reset" ]; then
  echo "== Reset: borrando la base methadesk y los roles mc_* =="
  psql_su -c "DROP DATABASE IF EXISTS methadesk WITH (FORCE)"
  psql_su -c "DROP ROLE IF EXISTS mc_readonly, mc_auth_readonly, mc_finanz_readonly"
fi

echo "== 1/6 Roles y base de datos =="
psql_su -v md_owner_pw="$MD_OWNER_PW" < replica/00_roles.sql

if psql_owner -tAc "SELECT to_regclass('public.teilsysteme') IS NOT NULL" | grep -q t; then
  echo "== 2/6 y 3/6 La réplica ya existe (usa --reset para recrearla) =="
else
  echo "== 2/6 Esquema de MethaDesk (réplica) =="
  psql_owner < replica/10_schema.sql
  echo "== 3/6 Datos sintéticos =="
  psql_owner < replica/20_seed.sql
fi

echo "== 4/6 Preflight de MethaCity =="
psql_owner < "$SQL_DIR/90_preflight.sql"

echo "== 5/6 Roles, vistas y permisos de solo lectura =="
for f in 01_rollen 02_vistas_operativas 03_vistas_indicadores 04_vistas_identidad 05_permisos; do
  echo "-- $f.sql"
  psql_owner < "$SQL_DIR/$f.sql"
done
if [ "$ENABLE_FINANZ" = "1" ]; then
  echo "-- 06_opcional_finanzas.sql"
  psql_owner < "$SQL_DIR/06_opcional_finanzas.sql"
fi

echo "== 6/6 Contraseñas de los roles de solo lectura =="
# Las contraseñas viajan por -v: son visibles un instante en la lista de procesos del contenedor.
# Aceptable en desarrollo; en producción se fijan con \password.
psql_owner -v p1="$MC_READONLY_PW" -v p2="$MC_AUTH_PW" <<'SQL'
ALTER ROLE mc_readonly      PASSWORD :'p1';
ALTER ROLE mc_auth_readonly PASSWORD :'p2';
SQL
if [ "$ENABLE_FINANZ" = "1" ]; then
  psql_owner -v p3="$MC_FINANZ_PW" <<'SQL'
ALTER ROLE mc_finanz_readonly PASSWORD :'p3';
SQL
fi

echo
"$DEV_DIR/scripts/verify.sh"
