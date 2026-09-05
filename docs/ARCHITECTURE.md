# Arquitectura del sistema Tinkus Puros

## Visión general

El repositorio es un monorepo con tres aplicaciones independientes:

- `backend/`: API REST Express 5 + TypeScript + Mongoose/MongoDB.
- `frontend/`: SPA React 19 + Vite + React Router + React Query.
- `r2-worker/`: Worker de Cloudflare que almacena fotos y documentos en R2.

No se requiere una arquitectura nueva. El flujo predominante existente es:

`route -> middleware de autenticación/autorización/validación -> controller -> service/model`.

## Backend

- `src/models`: esquemas MongoDB y sus índices.
- `src/routes`: rutas, validaciones y permisos.
- `src/controllers`: coordinación HTTP y casos de uso.
- `src/services`: reglas reutilizables, consistencia, pagos, archivos y auditoría.
- `src/middleware`: autenticación, autorización, carga de archivos y auditoría.
- `src/security`: catálogo de permisos.
- `src/scripts`: migraciones y auditorías operativas explícitas.
- `tests`: pruebas de reglas sin modificar la base real.

`src/server.ts` registra las rutas bajo `/api`. `src/index.ts` conecta MongoDB e inicia el servidor.

## Frontend

- `src/types`: contratos TypeScript compartidos.
- `src/api`: clientes HTTP agrupados por módulo.
- `src/components`: componentes compartidos y formularios reutilizables.
- `src/views`: páginas asociadas a rutas.
- `src/layouts`: estructura del panel y portal.
- `src/hooks`: hooks transversales.
- `src/lib/axios.ts`: cliente HTTP base e interceptores.
- `src/router.tsx`: mapa de páginas y protección de rutas.

Las vistas históricas de guías todavía contienen componentes locales y tipos flexibles. Se deben extraer de forma incremental, no mediante una reescritura.

## Autenticación y permisos

1. `loginRoutes` autentica al perfil.
2. El token identifica a `PerfilUsuario`.
3. `middleware/auth.ts` carga el usuario autenticado.
4. `authorizePermission.ts` resuelve permisos desde los roles.
5. `soloAdministracion` y `soloAdministradorReal` restringen operaciones sensibles.

Los roles son referencias en `PerfilUsuario.roles`. El rol `GUIA` habilita las vistas y operaciones del bloque propio. Quitar el rol no elimina el perfil, preregistro, fraterno, pagos ni tallas.

## Flujo de bloques y guías

Relaciones principales:

- `Bloque.guiaId`: referencia principal heredada, conservada por compatibilidad.
- `Bloque.guiasIds`: lista vigente de hasta cuatro guías.
- `Bloque.cantidadGuiasHombres/Mujeres`: contadores derivados.
- `Guia.usuarioId`: persona propietaria del rol operativo.
- `Guia.preregistroId` y `Guia.gestionId`: contexto de inscripción y gestión.
- `DetalleBloque`: pertenencia de un fraterno a un bloque; no representa posiciones físicas.

`GuiaBloqueService` es la frontera de consistencia del vínculo guía-bloque. Al retirar una guía limpia ambas referencias y reconstruye los contadores desde las guías activas. Un movimiento o retiro se ejecuta en una transacción MongoDB.

Operaciones diferentes:

- Retirar del bloque: elimina la asociación, conserva `Guia.estado=ACTIVO` y el rol `GUIA`.
- Quitar rol: elimina toda asociación, cambia `Guia.estado=INACTIVO` y quita el rol `GUIA` del perfil.

## Flujo de fraternos

`PerfilUsuario` contiene la identidad; `Preregistro` la inscripción; `Fraterno` la membresía de la gestión. `DetalleBloque` solo enlaza un fraterno activo con un bloque. La restricción parcial permite historial inactivo y una sola asignación activa.

## Pagos, QR y tallas

- Planes y cálculo: `Cuota`, `DetalleCuota`, `ConfiguracionPago`, `PlanPagosService` y `SincronizacionCuotaService`.
- QR: `CredencialQrController/Routes` y API/vistas homónimas del frontend.
- Tallas: `TallaFraterno`, `PrendaIndumentaria`, `EntregaIndumentaria` y módulo `indumentaria`.

La lógica de bloques consume el estado calculado por pagos; no define fórmulas propias.

## Archivos en Cloudflare

`AlmacenamientoService` guarda y recupera fotos, carnets, matrículas y comprobantes por medio de `r2-worker`. El backend expone las rutas `/uploads/...` sin entregar el token R2 al navegador.

## Riesgos y deuda detectada

- `GuiaController.ts` sigue siendo grande y mezcla varios casos de uso; se inició la extracción por la regla crítica de asignación.
- `GuiaBloqueView.tsx` coordina demasiadas secciones y conserva numerosos `any` históricos.
- Algunos routes/controllers antiguos están comprimidos en líneas extensas, dificultando revisión.
- El lint general registra deuda previa en AuthContext, formularios de perfil, TokenRegistro, DataTables y distintas vistas.
- Existen archivos binarios y respaldos locales no versionados; no pertenecen al código de producción.
- `guiaId` es legado, pero no se elimina aún porque varias consultas lo consumen. Toda modificación debe mantenerlo sincronizado con `guiasIds`.

## Política para cambios futuros

Extraer una responsabilidad solo cuando tenga regla reutilizable o pruebas claras. Después de cada módulo ejecutar `npm test` en backend y `npm run build` en frontend. No eliminar `guiaId` hasta migrar y verificar todos sus consumidores.
