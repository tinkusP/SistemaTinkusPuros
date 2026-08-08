# Ejecución completamente local

El sistema usa tres servicios dentro de esta computadora:

- Aplicación web y API de producción mediante HTTPS: puerto `4001`, visible en la red local.
- Durante desarrollo, Vite también usa HTTPS en el puerto `5173` cuando existen los certificados locales.
- MongoDB: puerto `27017`, accesible únicamente desde esta computadora.

## Iniciar

```bash
./iniciar-red-local.sh
```

La terminal mostrará una dirección parecida a `https://192.168.1.20:4001`. Los celulares y computadoras conectados al mismo Wi-Fi deben abrir exactamente esa dirección. Si se ejecuta Vite directamente para desarrollo, se puede usar `https://192.168.1.20:5173`. Nunca se debe usar `http` para escanear QR, porque los navegadores bloquean la cámara fuera de HTTPS.

No se debe usar `localhost` desde el celular, porque en el celular `localhost` se refiere al propio teléfono.

## Habilitar la cámara en un celular

Antes del primer uso, copia al celular el archivo `certificados-locales/tinkus-ca.crt` e instala el certificado:

- Android: abre el archivo y elige instalarlo como certificado de CA. Según la marca, la opción también aparece en Ajustes > Seguridad > Cifrado y credenciales > Instalar certificado > Certificado de CA.
- iPhone/iPad: abre el archivo, instala el perfil desde Ajustes > Perfil descargado y después activa la confianza en Ajustes > General > Información > Ajustes de confianza de certificados.

Después, cierra y vuelve a abrir Chrome o Safari, entra a la dirección `https://IP-DE-LA-PC:4001`, pulsa **Abrir cámara** y selecciona **Permitir**. Si el permiso fue rechazado anteriormente, habilítalo desde los permisos del sitio o desde Ajustes > Aplicaciones > navegador > Permisos > Cámara.

El certificado solo debe instalarse en los dispositivos autorizados para administrar el sistema. Si cambia la dirección IP de la computadora, vuelve a ejecutar `./iniciar-red-local.sh`, instala el certificado actualizado y usa la nueva dirección mostrada.

## Detener MongoDB

```bash
docker compose -f docker-compose.local.yml down
```

Los datos no se eliminan al detener el contenedor; permanecen en el volumen `tinkus_mongodb_data`.

## Copiar la base anterior de Atlas

La primera vez, antes de registrar datos nuevos localmente, ejecuta:

```bash
./migrar-base-a-local.sh
```

El programa solicitará la URL de Atlas de manera oculta, copiará todas las colecciones y no guardará esa contraseña en archivos. La migración reemplaza el contenido de la base local, por lo que debe realizarse una sola vez al comienzo.

## Copias de seguridad

```bash
docker compose -f docker-compose.local.yml exec -T mongo mongodump --username tinkus_local --password tinkus_local_2026 --authenticationDatabase admin --db tinkus --archive > respaldo-tinkus.archive
```

MongoDB no queda publicado hacia otros equipos de la red. Los usuarios acceden al sistema mediante el frontend y su proxy `/api`.
