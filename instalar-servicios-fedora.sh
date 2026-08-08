#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID}" -ne 0 ]; then
  echo "Ejecuta este instalador con: sudo ./instalar-servicios-fedora.sh"
  exit 1
fi

RAIZ_PROYECTO="/home/jimmy/tinkus"
install -d -m 750 -o root -g jimmy /etc/tinkus
install -m 600 -o root -g root "$RAIZ_PROYECTO/backend/.env" /etc/tinkus/tinkus.env
install -m 644 -o root -g root "$RAIZ_PROYECTO/certificados-locales/servidor.crt" /etc/tinkus/servidor.crt
install -m 640 -o root -g jimmy "$RAIZ_PROYECTO/certificados-locales/servidor.key" /etc/tinkus/servidor.key
install -m 644 -o root -g root "$RAIZ_PROYECTO/certificados-locales/tinkus-ca.crt" /etc/tinkus/tinkus-ca.crt
install -d -m 755 /etc/systemd/system/systemd-logind.service.d
install -m 644 "$RAIZ_PROYECTO/servicios-fedora/ignore-lid.conf" /etc/systemd/system/systemd-logind.service.d/ignore-lid.conf
install -m 644 "$RAIZ_PROYECTO/servicios-fedora/tinkus-mongo.service" /etc/systemd/system/tinkus-mongo.service
install -m 644 "$RAIZ_PROYECTO/servicios-fedora/tinkus-app.service" /etc/systemd/system/tinkus-app.service

systemctl daemon-reload
systemctl enable --now tinkus-mongo.service tinkus-app.service

if systemctl is-active --quiet firewalld; then
  firewall-cmd --permanent --add-port=4001/tcp
  firewall-cmd --reload
fi

systemctl restart systemd-logind.service
echo
systemctl status tinkus-mongo.service tinkus-app.service --no-pager -n 12
echo
echo "Instalación terminada. Abre desde el celular: https://192.168.31.110:4001"
