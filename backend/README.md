# backentinkus
# Migración de permisos y bloques de guías

Después de desplegar el backend actualizado, ejecutar una vez:

```bash
npm run migrate:guias-bloques
```

La migración es idempotente: conserva los bloques e integrantes existentes, completa los permisos del rol `GUIA` y recalcula los contadores de guías y fraternos usados para controlar cupos concurrentes. En Railway también se ejecuta automáticamente antes de iniciar la nueva versión.
