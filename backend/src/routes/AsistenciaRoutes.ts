import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { soloAdministracion } from "../middleware/soloAdministracion";
import { body } from "express-validator";
import { handleInputErrors } from "../middleware/validation";
import { listarAsistencias, marcarEntrada, marcarEntradaPorQr, marcarSalida, misAsistencias } from "../controllers/AsistenciaController";
const router = Router();
/** @openapi
 * /api/asistencias/entrada:
 *   post: { tags: [Asistencias], summary: Marcar entrada con hora del servidor, security: [{ bearerAuth: [] }], responses: { 201: { description: Registrada } } }
 * /api/asistencias/salida:
 *   patch: { tags: [Asistencias], summary: Marcar salida con hora del servidor, security: [{ bearerAuth: [] }], responses: { 200: { description: Registrada } } }
 */
router.post("/entrada", authenticate, marcarEntrada);
router.post("/entrada-qr", authenticate, soloAdministracion, body("token").isString().notEmpty(), handleInputErrors, marcarEntradaPorQr);
router.patch("/salida", authenticate, marcarSalida);
router.get("/mias", authenticate, misAsistencias);
router.get("/", authenticate, soloAdministracion, listarAsistencias);
export default router;
