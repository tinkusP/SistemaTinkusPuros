import { Router } from "express";
import { body } from "express-validator";
import { authenticate } from "../middleware/auth";
import { soloAdministracion } from "../middleware/soloAdministracion";
import { handleInputErrors } from "../middleware/validation";
import { listarTraspasos, traspasarCupo } from "../controllers/TraspasoController";
const router = Router();
/** @openapi
 * /api/traspasos:
 *   get: { tags: [Traspasos], summary: Listar historial, security: [{ bearerAuth: [] }], responses: { 200: { description: Lista } } }
 *   post: { tags: [Traspasos], summary: Traspasar preregistro y relaciones, security: [{ bearerAuth: [] }], responses: { 201: { description: Traspasado } } }
 */
router.use(authenticate, soloAdministracion);
router.get("/", listarTraspasos);
router.post("/", body("preregistroId").isMongoId(), body("usuarioDestinoId").isMongoId(), body("motivo").trim().isLength({ min: 3, max: 1000 }), body("observacion").optional().isLength({ max: 1500 }), handleInputErrors, traspasarCupo);
export default router;
