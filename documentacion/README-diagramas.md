# Diagramas actuales del sistema Tinkus

Fecha de análisis: 7 de agosto de 2026.

## Archivos

- `diagrama-entidad-relacion-actual.drawio`: modelo de datos editable.
- `flujo-procesos-actual.drawio`: flujo funcional editable.
- Los archivos se abren con diagrams.net/draw.io mediante **Archivo > Abrir desde dispositivo**.

## Criterio utilizado

El DER se construyó desde los 24 modelos Mongoose presentes en `backend/src/models` y las rutas montadas en `backend/src/server.ts`. Las relaciones corresponden a campos `ObjectId` con `ref`; las cardinalidades 0..1 se deducen de referencias opcionales e índices únicos.

MongoDB no aplica claves foráneas como una base relacional. En el diagrama, `FK` significa una referencia lógica entre colecciones controlada por Mongoose y por la aplicación.

## Flujo resumido para exposición

1. Administración configura la gestión, fechas, cupos, tarifas, códigos QR y términos de pago.
2. La persona crea su cuenta, completa el perfil y presenta los documentos requeridos.
3. Con una gestión en inscripciones crea un preregistro único, acepta los términos y registra sus pagos.
4. Administración valida documentos, notas, cupo y comprobantes; el preregistro puede quedar observado, rechazado, en espera o aprobado.
5. La persona aprobada se convierte en fraterno o pasa por la evaluación de postulante a guía. Si resulta elegida se crea su registro de guía; en caso contrario continúa como fraterno.
6. Los guías organizan bloques, incorporan hasta cuatro guías y ubican fraternos por género, fila y columna.
7. Durante la gestión se controla asistencia, tallas, entrega/devolución de indumentaria, traspasos, comunicados, pasos y canciones.
8. Administración consulta reportes y auditoría; cada usuario consulta su estado, pagos, credencial QR, bloque, asistencia y notificaciones.

## Diferencias principales frente al esquema inicial

- `PerfilUsuario` ahora admite varios roles y varias gestiones.
- `Preregistro` es el centro del proceso de admisión y genera, según decisión, `Fraterno`, `PostulanteGuia` y eventualmente `Guia`.
- Los pagos se separan en cabecera `Cuota` y movimientos `DetalleCuota`, con configuración y aceptación versionada de términos.
- Los bloques admiten hasta cuatro guías y guardan cada posición en `DetalleBloque`.
- Se incorporaron asistencia por portal/administración/QR, indumentaria, autorizaciones de edición, videos, notificaciones y auditoría.
