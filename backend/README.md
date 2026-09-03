# backentinkus
# Migración de permisos y bloques de guías

Después de desplegar el backend actualizado, ejecutar una vez:

```bash
npm run migrate:guias-bloques
```

La migración es idempotente: conserva los bloques e integrantes existentes, completa los permisos del rol `GUIA`, recalcula los contadores usados para controlar cupos concurrentes y retira únicamente los campos e índice obsoletos de fila/columna. También convierte el índice del guía responsable en opcional para permitir bloques administrativos de prueba. En Railway se ejecuta automáticamente antes de iniciar la nueva versión.
