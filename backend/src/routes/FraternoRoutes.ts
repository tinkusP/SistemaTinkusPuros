import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { soloAdministracion } from "../middleware/soloAdministracion";
import { listarFraternos, miBloqueYPosicion, miFraternidad } from "../controllers/FraternoController";
const router = Router();
/** @openapi
 * /api/fraternos:
 *   get: { tags: [Fraternos], summary: Listar fraternos, security: [{ bearerAuth: [] }], responses: { 200: { description: Lista } } }
 */
router.get("/mio", authenticate, miFraternidad);
router.get("/mi-bloque", authenticate, miBloqueYPosicion);
router.get("/", authenticate, soloAdministracion, listarFraternos);
export default router;
