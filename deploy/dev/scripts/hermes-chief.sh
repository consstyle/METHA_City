#!/usr/bin/env bash
# Crea el perfil `chief` (orquestador) en el contenedor de Hermes, le pone su SOUL.md y su
# propia API (puerto 8643) y arranca su gateway. Re-ejecutable.
# Requisito: haber ejecutado ya el asistente `setup` (README, paso 4) y tener el contenedor en marcha.
#
# BASADO EN LA DOCUMENTACIÓN OFICIAL DE HERMES, NO PROBADO CONTRA EL CONTENEDOR REAL: si algún
# comando o ruta difiere en tu versión, detente y pega la salida en el chat.
set -euo pipefail

cd "$(dirname "$0")/.."
HC="${HERMES_CONTAINER:-methacity-dev-hermes}"
PROFILE="chief"
PROFILE_DIR="/opt/data/profiles/$PROFILE"
[ -f .env ] && { set -a; . ./.env; set +a; }
[ -n "${HERMES_CHIEF_API_KEY:-}" ] || { echo "ERROR: falta HERMES_CHIEF_API_KEY en .env" >&2; exit 1; }
[ "${#HERMES_CHIEF_API_KEY}" -ge 8 ] || { echo "ERROR: HERMES_CHIEF_API_KEY debe tener al menos 8 caracteres" >&2; exit 1; }
docker inspect -f '{{.State.Running}}' "$HC" 2>/dev/null | grep -q true || { echo "ERROR: $HC no está en marcha" >&2; exit 1; }

echo "== 1/4 Perfil $PROFILE (clonando la configuración y las claves del perfil por defecto) =="
if docker exec "$HC" test -d "$PROFILE_DIR"; then
  echo "   ya existe"
else
  docker exec "$HC" hermes profile create "$PROFILE" --clone
fi
docker exec "$HC" test -d "$PROFILE_DIR" || { echo "ERROR: no existe $PROFILE_DIR; revisa dónde crea Hermes los perfiles" >&2; exit 1; }

echo "== 2/4 SOUL.md =="
docker exec -i "$HC" sh -c "cat > $PROFILE_DIR/SOUL.md" < hermes/SOUL.chief.md

echo "== 3/4 API propia del perfil (puerto 8643) =="
docker exec -i -e KEY="$HERMES_CHIEF_API_KEY" "$HC" sh -c "
  touch $PROFILE_DIR/.env
  sed -i '/^API_SERVER_/d' $PROFILE_DIR/.env
  {
    echo 'API_SERVER_ENABLED=true'
    echo 'API_SERVER_HOST=0.0.0.0'
    echo 'API_SERVER_PORT=8643'
    echo \"API_SERVER_KEY=\$KEY\"
  } >> $PROFILE_DIR/.env
"

echo "== 4/4 Gateway del perfil =="
docker exec "$HC" hermes -p "$PROFILE" gateway restart || docker exec "$HC" hermes -p "$PROFILE" gateway start

echo
echo "Listo. Comprobación desde otro contenedor de la misma red:"
echo "  docker run --rm --network methacity-dev-net curlimages/curl -s http://$HC:8643/health"
echo "Conversación de prueba:"
echo "  docker exec -it $HC hermes -p $PROFILE chat"
