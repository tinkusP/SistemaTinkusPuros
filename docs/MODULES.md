# Módulos y archivos

## Bloques y guías

Backend:

- `models/Bloque.ts`, `Guia.ts`, `DetalleBloque.ts`, `Fraterno.ts`, `PerfilUsuario.ts`, `Rol.ts`.
- `routes/GuiaRoutes.ts`.
- `controllers/GuiaController.ts`.
- `services/BloqueService.ts`, `GuiaBloqueService.ts`, `AsignacionBloqueService.ts`, `IndiceBloqueService.ts`.
- `scripts/auditarGuiasBloques.ts`, `migrarPermisosYBloquesGuia.ts`.

Frontend:

- `types/BloqueGuiaType.ts`, `GuiaType.ts`.
- `api/BloqueGuiaApi.ts`, `GuiaApi.ts`.
- `views/guia/GuiaBloqueView.tsx`, `MiBloqueGuiaView.tsx`, `DirectorioBloquesGuiaView.tsx`, `MisFraternosGuiaView.tsx`.
- `views/fraterno/MiBloqueFraternoView.tsx`.

Endpoints principales:

- `GET /api/guias`: supervisión administrativa.
- `POST /api/guias/bloques`: crear bloque.
- `PATCH /api/guias/bloques/guias/:guiaId`: asignar, mover o retirar del bloque.
- `DELETE /api/guias/:guiaId/rol`: quitar rol y asociaciones de guía.
- `PATCH /api/guias/bloques/:bloqueId/nombre`: renombrar.
- `DELETE /api/guias/bloques/:bloqueId`: eliminar bloque.
- `GET /api/guias/mi-bloque`: bloque del guía.
- `GET /api/guias/directorio-bloques`: directorio.
- `POST/DELETE /api/guias/bloques/integrantes`: administrar integrantes.

Dependencias: autenticación, roles/permisos, gestión, preregistro, fraterno, pagos y tallas.

## Usuarios y autenticación

Backend: `PerfilUsuario`, `Rol`, `TokenRegistro`, `loginRoutes`, `perfilUsuarioRoutes`, `rolRoutes`, controladores asociados y middleware `auth`/`authorizePermission`.

Frontend: `Context/AuthContext.tsx`, `hooks/useAuth.ts`, `layouts/AuthLayout.tsx`, vistas `auth`, APIs `PerfilUsuarioApi`, `RolApi`, `TokenRegistroApi`.

## Fraternos

Backend: `Fraterno`, `Preregistro`, `DetalleBloque`, `FraternoRoutes/Controller/Service`, `PreregistroRoutes/Controller`.

Frontend: `types/FraternoType.ts`, `PreregistroType.ts`, APIs homónimas y vistas `fraterno`/`preregistro`.

## Pagos

Backend: `Cuota`, `DetalleCuota`, `ConfiguracionPago`, `AceptacionTerminosPago`, rutas/controladores de cuotas y configuración, `PlanPagosService`, `SincronizacionCuotaService`.

Frontend: `types/CuotaType.ts`, `api/CuotaApi.ts`, `ConfiguracionPagoApi.ts`, vistas y componentes `cuota`.

## QR

Backend: `CredencialQrRoutes/Controller`, `TokenRegistroRoutes/Controller`, middleware de autenticación.

Frontend: `api/CredencialQrApi.ts`, vistas `MiCredencialQrView.tsx`, `EscanerQrView.tsx`, `EscanerTokenRegistro.tsx`.

## Tallas e indumentaria

Backend: `TallaFraterno`, `PrendaIndumentaria`, `EntregaIndumentaria`, `IndumentariaRoutes/Controller`.

Frontend: `api/IndumentariaApi.ts`, vistas `IndumentariaView.tsx` y `MisTallasView.tsx`.

## Comunicados y auditoría

Backend: `Anuncio`, `Notificacion`, `Auditoria`, `ComunicacionRoutes/Controller`, `AuditoriaService`.

Frontend: `GuiaApi.ts` (funciones históricas), vistas/layouts `comunicacion` y `ComunicadosView`.

## Archivos y respaldos

Backend: `AlmacenamientoController/Service`, middleware `upload*`, `RespaldoRoutes/Controller`.

Cloudflare: `r2-worker/src/index.ts`, binding R2 `ARCHIVOS`.

Frontend: formularios de perfil/preregistro/pago y `api/RespaldoApi.ts`.
