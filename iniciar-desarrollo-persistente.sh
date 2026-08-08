#!/usr/bin/env bash
set -euo pipefail

if [ "${TINKUS_INHIBIDO:-0}" != "1" ]; then
  exec systemd-inhibit \
    --what=handle-lid-switch:sleep \
    --who="Tinkus local" \
    --why="Mantener frontend y backend disponibles en la red local" \
    --mode=block \
    env TINKUS_INHIBIDO=1 "$0" "$@"
fi

RAIZ_PROYECTO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CARPETA_LOGS="$RAIZ_PROYECTO/logs-desarrollo"
mkdir -p "$CARPETA_LOGS"

if pgrep -f "$RAIZ_PROYECTO/frontend/node_modules/.bin/vite" >/dev/null 2>&1 || pgrep -f "ts-node $RAIZ_PROYECTO/backend/src/index.ts" >/dev/null 2>&1; then
  echo "Tinkus parece estar ejecutándose. Detén primero las terminales anteriores con Ctrl+C."
  exit 1
fi

detener() {
  trap - INT TERM EXIT
  [ -n "${PID_FRONTEND:-}" ] && kill "$PID_FRONTEND" 2>/dev/null || true
  [ -n "${PID_BACKEND:-}" ] && kill "$PID_BACKEND" 2>/dev/null || true
  wait 2>/dev/null || true
}
trap detener INT TERM EXIT

echo "Iniciando backend y frontend en modo desarrollo..."
npm --prefix "$RAIZ_PROYECTO/backend" run dev >"$CARPETA_LOGS/backend.log" 2>&1 &
PID_BACKEND=$!
npm --prefix "$RAIZ_PROYECTO/frontend" run dev >"$CARPETA_LOGS/frontend.log" 2>&1 &
PID_FRONTEND=$!

IP_LOCAL="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for (i=1; i<=NF; i++) if ($i=="src") {print $(i+1); exit}}')"
echo "Sistema disponible en: https://${IP_LOCAL:-IP-DE-LA-LAPTOP}:5173"
echo "La suspensión por cierre de tapa queda bloqueada mientras este comando siga activo."
echo "Para detener todo y restaurar la suspensión, presiona Ctrl+C."

wait -n "$PID_BACKEND" "$PID_FRONTEND"
echo "Uno de los servicios se detuvo. Revisa $CARPETA_LOGS"
exit 1
