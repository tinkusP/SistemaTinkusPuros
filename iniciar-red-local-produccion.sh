#!/usr/bin/env bash
set -euo pipefail
RAIZ_PROYECTO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$RAIZ_PROYECTO"
docker compose -f docker-compose.local.yml up -d mongo
until docker compose -f docker-compose.local.yml exec -T mongo mongosh --quiet --username tinkus_local --password tinkus_local_2026 --authenticationDatabase admin --eval "db.adminCommand('ping').ok" >/dev/null 2>&1; do sleep 2; done
docker compose -f docker-compose.local.yml exec -T mongo mongosh --quiet --username tinkus_local --password tinkus_local_2026 --authenticationDatabase admin --eval 'try { rs.status().ok } catch (error) { rs.initiate({_id:"rs0",members:[{_id:0,host:"127.0.0.1:27017"}]}) }' >/dev/null
until docker compose -f docker-compose.local.yml exec -T mongo mongosh --quiet --username tinkus_local --password tinkus_local_2026 --authenticationDatabase admin --eval "quit(db.hello().isWritablePrimary ? 0 : 1)" >/dev/null 2>&1; do sleep 2; done
npm --prefix frontend run build
npm --prefix backend run build
IP_LOCAL="$(hostname -I 2>/dev/null | awk '{print $1}')"
CARPETA_CERT="$RAIZ_PROYECTO/certificados-locales"
mkdir -p "$CARPETA_CERT"
if [ ! -f "$CARPETA_CERT/tinkus-ca.key" ]; then
  openssl genrsa -out "$CARPETA_CERT/tinkus-ca.key" 4096
  openssl req -x509 -new -nodes -key "$CARPETA_CERT/tinkus-ca.key" -sha256 -days 3650 -out "$CARPETA_CERT/tinkus-ca.crt" -subj "/CN=Tinkus Puros CA Local"
fi
cat > "$CARPETA_CERT/servidor.ext" <<EOF
authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage=digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
subjectAltName=IP:${IP_LOCAL},IP:127.0.0.1,DNS:localhost
EOF
openssl genrsa -out "$CARPETA_CERT/servidor.key" 2048
openssl req -new -key "$CARPETA_CERT/servidor.key" -out "$CARPETA_CERT/servidor.csr" -subj "/CN=${IP_LOCAL}"
openssl x509 -req -in "$CARPETA_CERT/servidor.csr" -CA "$CARPETA_CERT/tinkus-ca.crt" -CAkey "$CARPETA_CERT/tinkus-ca.key" -CAcreateserial -out "$CARPETA_CERT/servidor.crt" -days 825 -sha256 -extfile "$CARPETA_CERT/servidor.ext"
echo "Sistema optimizado disponible en https://${IP_LOCAL:-IP-DE-TU-PC}:4001"
echo "Para habilitar la cámara instala y confía en el celular: $CARPETA_CERT/tinkus-ca.crt"
cd backend
NODE_ENV=production HTTPS_CERT_PATH="$CARPETA_CERT/servidor.crt" HTTPS_KEY_PATH="$CARPETA_CERT/servidor.key" HTTPS_CA_PATH="$CARPETA_CERT/tinkus-ca.crt" npm start
