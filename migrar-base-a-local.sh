#!/usr/bin/env bash
set -euo pipefail

RAIZ_PROYECTO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$RAIZ_PROYECTO"

echo "Esta operación copiará una base MongoDB remota hacia la base local 'tinkus'."
if [[ -z "${BASE_REMOTA:-}" ]]; then
  read -r -p "Nombre de la base remota [test]: " BASE_REMOTA
fi
BASE_REMOTA="${BASE_REMOTA:-test}"
if [[ -z "${ORIGEN_MONGODB:-}" ]]; then
  read -r -s -p "Pega la URL mongodb+srv completa de Atlas: " ORIGEN_MONGODB
  echo ""
fi

if [[ "$ORIGEN_MONGODB" != mongodb* ]]; then
  echo "La URL proporcionada no es una conexión MongoDB válida."
  exit 1
fi

docker compose -f docker-compose.local.yml up -d mongo

echo "Copiando datos. La contraseña no se guardará en ningún archivo..."
docker run --rm --network host -e ORIGEN_MONGODB -e BASE_REMOTA mongo:8 \
  sh -c 'mongodump --uri="$ORIGEN_MONGODB" --db="$BASE_REMOTA" --archive' | \
docker run --rm --network host -i mongo:8 \
  : "${MONGODB_LOCAL_URI:?Define MONGODB_LOCAL_URI antes de ejecutar la migración}"
  mongorestore --uri="${MONGODB_LOCAL_URI}" --archive --drop --nsInclude="${BASE_REMOTA}.*" --nsFrom="${BASE_REMOTA}.*" --nsTo="tinkus.*"

unset ORIGEN_MONGODB
echo "Migración terminada. Ya puedes iniciar el sistema con ./iniciar-red-local.sh"
