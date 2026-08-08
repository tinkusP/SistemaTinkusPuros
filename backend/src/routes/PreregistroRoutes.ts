import { Router } from "express";
import { body, param, query } from "express-validator";
import { authenticate } from "../middleware/auth";
import { handleInputErrors } from "../middleware/validation";
import { soloAdministracion } from "../middleware/soloAdministracion";
import { ESTADOS_PREREGISTRO } from "../models/Preregistro";
import {
  actualizarPreregistro,
  crearPreregistro,
  eliminarPreregistro,
  obtenerMisPreregistros,
  obtenerPreregistroPorId,
  obtenerPreregistros,
} from "../controllers/PreregistroController";

const router = Router();
const idValido = param("id").isMongoId().withMessage("El ID del preregistro no es válido");
const notaValida = (campo: string) => body(campo).optional().isFloat({ min: 0, max: 100 }).withMessage(`${campo} debe estar entre 0 y 100`).toFloat();

/**
 * @openapi
 * components:
 *   schemas:
 *     Preregistro:
 *       type: object
 *       properties:
 *         _id: { type: string }
 *         usuarioId: { oneOf: [{ type: string }, { type: object }] }
 *         gestionId: { oneOf: [{ type: string }, { type: object }] }
 *         numeroPreRegistro: { type: string, example: PRE-2026-0001 }
 *         fechaRegistro: { type: string, format: date-time }
 *         estado:
 *           type: string
 *           enum: [PENDIENTE, OBSERVADO, APROBADO, RECHAZADO, LISTA_ESPERA, CANCELADO]
 *         aceptoReglamento: { type: boolean }
 *         examen1: { type: number, minimum: 0, maximum: 100 }
 *         examen2: { type: number, minimum: 0, maximum: 100 }
 *         examen3: { type: number, minimum: 0, maximum: 100 }
 *         examen4: { type: number, minimum: 0, maximum: 100 }
 *         examen5: { type: number, minimum: 0, maximum: 100 }
 *         examen6: { type: number, minimum: 0, maximum: 100 }
 *         promedioExamen: { type: number }
 *         puntajeTotal: { type: number }
 *         observacion: { type: string }
 *         aprobado: { type: boolean }
 */

/**
 * @openapi
 * /api/preregistros:
 *   post:
 *     tags: [Preregistros]
 *     summary: Crear un preregistro
 *     description: Si el cupo está lleno asigna automáticamente LISTA_ESPERA.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               usuarioId: { type: string }
 *               gestionId: { type: string }
 *               aceptoReglamento: { type: boolean }
 *     responses:
 *       201: { description: Preregistro creado }
 *       409: { description: Sin gestión disponible o preregistro duplicado }
 *   get:
 *     tags: [Preregistros]
 *     summary: Listar preregistros con filtros y paginación
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: estado, schema: { type: string } }
 *       - { in: query, name: gestionId, schema: { type: string } }
 *       - { in: query, name: usuarioId, schema: { type: string } }
 *       - { in: query, name: pagina, schema: { type: integer } }
 *       - { in: query, name: limite, schema: { type: integer } }
 *     responses:
 *       200: { description: Lista paginada de preregistros }
 */
router.post("/", authenticate, body("usuarioId").optional().isMongoId(), body("gestionId").optional().isMongoId(), body("aceptoReglamento").optional().isBoolean().toBoolean(), handleInputErrors, crearPreregistro);
router.get("/", authenticate, soloAdministracion, query("estado").optional({ checkFalsy: true }).isIn(ESTADOS_PREREGISTRO), query("gestionId").optional({ checkFalsy: true }).isMongoId(), query("usuarioId").optional({ checkFalsy: true }).isMongoId(), handleInputErrors, obtenerPreregistros);

/**
 * @openapi
 * /api/preregistros/mios:
 *   get:
 *     tags: [Preregistros]
 *     summary: Obtener historial del usuario autenticado
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Historial de preregistros }
 */
router.get("/mios", authenticate, obtenerMisPreregistros);

/**
 * @openapi
 * /api/preregistros/{id}:
 *   get:
 *     tags: [Preregistros]
 *     summary: Obtener detalle
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Detalle encontrado }
 *       404: { description: No encontrado }
 *   put:
 *     tags: [Preregistros]
 *     summary: Editar, revisar o calificar
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/Preregistro' }
 *     responses:
 *       200: { description: Actualizado }
 *   delete:
 *     tags: [Preregistros]
 *     summary: Eliminar lógicamente
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Cancelado y eliminado }
 */
router.get("/:id", authenticate, soloAdministracion, idValido, handleInputErrors, obtenerPreregistroPorId);
router.put("/:id", authenticate, soloAdministracion, idValido, body("estado").optional().isIn(ESTADOS_PREREGISTRO), body("aceptoReglamento").optional().isBoolean().toBoolean(), ...[1, 2, 3, 4, 5, 6].map((n) => notaValida(`examen${n}`)), body("puntajeTotal").optional().isFloat({ min: 0 }).toFloat(), body("observacion").optional().isLength({ max: 1000 }), handleInputErrors, actualizarPreregistro);
router.delete("/:id", authenticate, soloAdministracion, idValido, handleInputErrors, eliminarPreregistro);

export default router;
