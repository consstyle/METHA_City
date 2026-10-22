#!/usr/bin/env bash
# Comprueba el aislamiento de mc_readonly conectándose COMO ese rol (por TCP, con contraseña)
# y muestra los indicadores por departamento. Sale con error si hay algún FALLO.
#   ./scripts/verify.sh
set -euo pipefail

cd "$(dirname "$0")/.."
SQL_DIR="$(cd ../../sql && pwd)"
DB="${DB_CONTAINER:-methacity-dev-db}"
[ -f .env ] && { set -a; . ./.env; set +a; }
[ -n "${MC_READONLY_PW:-}" ] || { echo "ERROR: falta MC_READONLY_PW" >&2; exit 1; }

as_mc() { docker exec -i -e PGPASSWORD="$MC_READONLY_PW" "$DB" psql -h 127.0.0.1 -U mc_readonly -d methadesk -v ON_ERROR_STOP=1 "$@"; }

echo "== Verificación de aislamiento (como mc_readonly) =="
OUT="$(docker exec -i -e PGPASSWORD="$MC_READONLY_PW" "$DB" \
        psql -h 127.0.0.1 -U mc_readonly -d methadesk < "$SQL_DIR/99_verificacion.sql" 2>&1)"
echo "$OUT" | grep -E 'OK|FALLO|Verificaci' || true
if echo "$OUT" | grep -q 'FALLO'; then
  echo "RESULTADO: hay FALLOS. No uses este rol hasta corregirlos." >&2
  exit 1
fi

echo
echo "== Indicadores por departamento (datos sintéticos) =="
as_mc -c "SELECT abteilung, ts_gesamt, ts_offen, montage_ueberfaellig AS montage_atrasada,
                 montage_naechste_14_tage AS montage_14d, ts_nachbearbeitung AS retrabajo, ts_express
          FROM mc.abteilung_kennzahlen ORDER BY reihenfolge"

echo
echo "RESULTADO: todo correcto."
