import { Router } from "express";
import { body, param } from "express-validator";
import { authenticate } from "../middleware/auth";
import { handleInputErrors } from "../middleware/validation";
import { soloAdministracion } from "../middleware/soloAdministracion";
import { actualizarAnuncio, crearAnuncio, eliminarAnuncio, listarAnuncios, listarAuditoria, marcarLeida, misNotificaciones, registrarLogout } from "../controllers/ComunicacionController";
import { uploadAfiche } from "../middleware/uploadAfiche";
const router = Router();
/** @openapi
 * /api/comunicacion/anuncios:
 *   get: { tags: [Anuncios], summary: Listar anuncios, security: [{ bearerAuth: [] }], responses: { 200: { description: Lista } } }
 *   post: { tags: [Anuncios], summary: Crear y distribuir anuncio, security: [{ bearerAuth: [] }], responses: { 201: { description: Creado } } }
 */
router.get("/anuncios", authenticate, listarAnuncios);
router.post("/anuncios", authenticate, soloAdministracion, uploadAfiche.single("afiche"), body("titulo").trim().notEmpty(), body("contenido").trim().notEmpty(), handleInputErrors, crearAnuncio);
router.put("/anuncios/:id", authenticate, soloAdministracion, param("id").isMongoId(), handleInputErrors, actualizarAnuncio);
router.delete("/anuncios/:id", authenticate, soloAdministracion, param("id").isMongoId(), handleInputErrors, eliminarAnuncio);
/** @openapi
 * /api/comunicacion/notificaciones/mias:
 *   get: { tags: [Notificaciones], summary: Obtener notificaciones del usuario, security: [{ bearerAuth: [] }], responses: { 200: { description: Lista y contador } } }
 */
router.get("/notificaciones/mias", authenticate, misNotificaciones);
router.patch("/notificaciones/:id/leida", authenticate, param("id").isMongoId(), handleInputErrors, marcarLeida);
/** @openapi
 * /api/comunicacion/auditoria:
 *   get: { tags: [Auditoria], summary: Consultar actividad del sistema, security: [{ bearerAuth: [] }], responses: { 200: { description: Eventos } } }
 */
router.get("/auditoria", authenticate, soloAdministracion, listarAuditoria);
router.post("/auditoria/logout", authenticate, registrarLogout);
export default router;
