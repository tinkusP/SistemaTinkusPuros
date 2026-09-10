import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { soloAdministracion } from "../middleware/soloAdministracion";
import { enviarAListaEspera, listarFraternos, miBloque, miFraternidad } from "../controllers/FraternoController";
import { fichaIntegralFraterno } from "../controllers/AdministracionController";
const router = Router();
/** @openapi
 * /api/fraternos:
 *   get: { tags: [Fraternos], summary: Listar fraternos, security: [{ bearerAuth: [] }], responses: { 200: { description: Lista } } }
 */
router.get("/mio", authenticate, miFraternidad);
router.get("/mi-bloque", authenticate, miBloque);
router.patch("/:id/lista-espera", authenticate, soloAdministracion, enviarAListaEspera);
router.get("/:id/ficha-integral", authenticate, soloAdministracion, fichaIntegralFraterno);
router.get("/", authenticate, soloAdministracion, listarFraternos);
export default router;
