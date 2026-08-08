#!/usr/bin/env bash
set -euo pipefail
RAIZ_PROYECTO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "Iniciando Tinkus en modo local seguro (HTTPS)..."
exec "$RAIZ_PROYECTO/iniciar-red-local-produccion.sh"
