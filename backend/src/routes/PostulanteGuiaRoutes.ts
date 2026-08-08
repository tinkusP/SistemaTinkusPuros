import { Router } from "express";
import { body, param } from "express-validator";
import { authenticate } from "../middleware/auth";
import { handleInputErrors } from "../middleware/validation";
import { agregarMerito, actualizarPostulanteGuia, eliminarMerito, habilitarPostulanteGuia, habilitarPostulanteGuiaPorUsuario, listarPostulantesGuia, obtenerPostulanteGuia, retirarPostulanteGuia } from "../controllers/PostulanteGuiaController";
import { soloAdministracion } from "../middleware/soloAdministracion";
import { ESTADOS_POSTULANTE_GUIA } from "../models/PostulanteGuia";
const router = Router();
/**
 * @openapi
 * /api/postulantes-guia:
 *   get: { tags: [PostulantesGuia], summary: Listar candidatos a guía, security: [{ bearerAuth: [] }], responses: { 200: { description: Lista ordenada por puntaje } } }
 *   post:
 *     tags: [PostulantesGuia]
 *     summary: Habilitar un preregistro como postulante a guía
 *     security: [{ bearerAuth: [] }]
 *     requestBody: { required: true, content: { application/json: { schema: { type: object, required: [preregistroId], properties: { preregistroId: { type: string } } } } } }
 *     responses: { 201: { description: Habilitado }, 409: { description: Ya estaba habilitado } }
 */
router.get("/", authenticate, soloAdministracion, listarPostulantesGuia);
router.post("/", authenticate, soloAdministracion, body("preregistroId").isMongoId(), handleInputErrors, habilitarPostulanteGuia);
router.post("/por-usuario/:usuarioId", authenticate, soloAdministracion, param("usuarioId").isMongoId(), handleInputErrors, habilitarPostulanteGuiaPorUsuario);
router.delete("/:id", authenticate, soloAdministracion, param("id").isMongoId(), handleInputErrors, retirarPostulanteGuia);
/**
 * @openapi
 * /api/postulantes-guia/{id}:
 *   get: { tags: [PostulantesGuia], summary: Ver candidato y sus méritos, security: [{ bearerAuth: [] }], parameters: [{ in: path, name: id, required: true, schema: { type: string } }], responses: { 200: { description: Detalle } } }
 *   put: { tags: [PostulantesGuia], summary: Evaluar candidato, security: [{ bearerAuth: [] }], parameters: [{ in: path, name: id, required: true, schema: { type: string } }], responses: { 200: { description: Actualizado } } }
 */
router.get("/:id", authenticate, soloAdministracion, param("id").isMongoId(), handleInputErrors, obtenerPostulanteGuia);
router.put("/:id", authenticate, soloAdministracion, param("id").isMongoId(), body("estado").optional().isIn(ESTADOS_POSTULANTE_GUIA), ...["puntajeIniciativa", "puntajeOrganizacion", "puntajeEleccion"].map((c) => body(c).optional().isFloat({ min: 0, max: 100 }).toFloat()), handleInputErrors, actualizarPostulanteGuia);
/** @openapi
 * /api/postulantes-guia/{id}/meritos:
 *   post: { tags: [PostulantesGuia], summary: Registrar mérito y sumar puntos, security: [{ bearerAuth: [] }], parameters: [{ in: path, name: id, required: true, schema: { type: string } }], responses: { 201: { description: Mérito creado } } }
 */
router.post("/:id/meritos", authenticate, soloAdministracion, param("id").isMongoId(), body("titulo").trim().notEmpty(), body("tipo").isIn(["INICIATIVA", "ORGANIZACION", "LIDERAZGO", "PARTICIPACION", "OTRO"]), body("puntos").isFloat({ min: 0, max: 100 }).toFloat(), handleInputErrors, agregarMerito);
router.delete("/:id/meritos/:meritoId", authenticate, soloAdministracion, param("id").isMongoId(), param("meritoId").isMongoId(), handleInputErrors, eliminarMerito);
export default router;
