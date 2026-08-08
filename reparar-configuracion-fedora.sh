#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID}" -ne 0 ]; then
  echo "Ejecuta: sudo ./reparar-configuracion-fedora.sh"
  exit 1
fi

systemctl disable --now tinkus-app.service tinkus-mongo.service 2>/dev/null || true
rm -f /etc/systemd/system/tinkus-app.service
rm -f /etc/systemd/system/tinkus-mongo.service
rm -f /etc/systemd/system/systemd-logind.service.d/ignore-lid.conf
systemctl daemon-reload
systemctl reset-failed

echo "Configuración global retirada. No se reinició systemd-logind ni la sesión gráfica."
echo "Reinicia Fedora normalmente cuando termines tu trabajo para aplicar completamente el cambio."
