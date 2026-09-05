# Guía de entrega por módulo

## Antes de entregar código

Compartir `package.json`, configuración TypeScript, `.env.example` y los archivos transversales indicados. Nunca compartir `.env`, tokens, respaldos de base de datos ni documentos personales.

## Tarea: bloques y guías

Backend necesario:

- `src/models/{Bloque,Guia,DetalleBloque,Fraterno,PerfilUsuario,Rol,Gestion,Preregistro}.ts`
- `src/routes/GuiaRoutes.ts`
- `src/controllers/GuiaController.ts`
- `src/services/{BloqueService,GuiaBloqueService,AsignacionBloqueService,IndiceBloqueService,AuditoriaService}.ts`
- `src/middleware/{auth,authorizePermission,soloAdministracion,validation}.ts`
- `src/scripts/auditarGuiasBloques.ts`
- `tests/{bloque-reglas,asignaciones-bloques,guias-bloques,indices-bloques,permisos-roles}.test.js`

Frontend necesario:

- `src/types/{BloqueGuiaType,GuiaType,FraternoType}.ts`
- `src/api/{BloqueGuiaApi,GuiaApi,apiError}.ts`
- `src/views/guia/{GuiaBloqueView,MiBloqueGuiaView,DirectorioBloquesGuiaView,MisFraternosGuiaView}.tsx`
- `src/views/fraterno/MiBloqueFraternoView.tsx`
- `src/lib/axios.ts`, `src/hooks/useAuth.ts`, `src/router.tsx`

Reglas que no se deben romper:

- Un guía activo pertenece como máximo a un bloque activo.
- Dos guías hombres y dos mujeres por bloque.
- Retirar del bloque conserva el rol; quitar rol conserva todos los datos personales y de fraterno.
- `guiaId` y `guiasIds` deben permanecer sincronizados mientras exista compatibilidad heredada.
- 40 hombres, 80 mujeres y 120 integrantes; sin posiciones físicas.

## Tarea: pagos

Entregar modelos `Cuota`, `DetalleCuota`, `ConfiguracionPago`, `AceptacionTerminosPago`; controladores/rutas/APIs de cuotas; `PlanPagosService` y `SincronizacionCuotaService`; tipos/vistas/componentes de cuota. Incluir `Preregistro`, `Gestion`, auth y almacenamiento porque los comprobantes dependen de ellos.

## Tarea: usuarios y autenticación

Entregar `PerfilUsuario`, `Rol`, `TokenRegistro`; rutas/controladores de login, perfil, rol y token; middleware de auth/permisos; AuthContext, useAuth, layouts, vistas auth y APIs relacionadas.

## Tarea: fraternos y preregistros

Entregar `Fraterno`, `Preregistro`, `DocumentoUsuario`, `DetalleBloque`; rutas/controladores/servicios de fraterno y preregistro; APIs, tipos, formularios y vistas correspondientes. Añadir gestión, pagos, tallas y almacenamiento si se modifican fichas completas.

## Tarea: QR

Entregar `CredencialQrRoutes/Controller`, `TokenRegistroRoutes/Controller`, modelos de perfil/token, auth, APIs QR y vistas de credencial/escáner.

## Tarea: archivos Cloudflare R2

Entregar `AlmacenamientoService/Controller`, middleware `upload*`, `r2-worker/`, modelos que almacenan rutas y formularios consumidores. Configurar por separado `R2_WORKER_URL`, `R2_WORKER_TOKEN` y el secreto del Worker; no incluir valores reales en Git.

## Comprobación mínima del módulo de guías

1. Ejecutar `npm test` en `backend/`.
2. Ejecutar `npm run build` en `frontend/`.
3. Ejecutar `npm run audit:guias-bloques` en modo lectura con variables del entorno objetivo.
4. Probar retirar y reasignar una guía.
5. Probar quitar rol y confirmar que perfil, fraterno, pagos y tallas siguen presentes.
6. Confirmar que las listas cambian sin recargar manualmente.
