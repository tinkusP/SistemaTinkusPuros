import { Router } from "express";
import { body, param } from "express-validator";
import { authenticate } from "../middleware/auth";
import { handleInputErrors } from "../middleware/validation";
import { convertirBaucherAWebp, uploadBaucher } from "../middleware/uploadBaucher";
import { crearCuota, detalleCuota, editarPlanCuotasAdmin, elegirPlanCuotas, eliminarPago, listarCuotas, obtenerMiCuota, prorrogarCuotasVencidas, prorrogarPrimeraCuota, registrarPago, revisarPago, solicitarProrrogaPago, solicitarQrPago, validarPlazoAntesDeSubir } from "../controllers/CuotaController";
import { soloAdministracion, soloAdministradorReal } from "../middleware/soloAdministracion";
import { habilitarCuotasMasivas } from "../controllers/CuotaMasivaController";
const router = Router(); const id = param("id").isMongoId();
/** @openapi
 * /api/cuotas:
 *   get: { tags: [Cuotas], summary: Listar cuotas, security: [{ bearerAuth: [] }], responses: { 200: { description: Lista } } }
 *   post: { tags: [Cuotas], summary: Crear cuota para un preregistro, security: [{ bearerAuth: [] }], responses: { 201: { description: Creada }, 409: { description: Ya existe } } }
 */
router.get("/", authenticate, soloAdministracion, listarCuotas);
/** @openapi
 * /api/cuotas/habilitar-masivo:
 *   post:
 *     tags: [Cuotas]
 *     summary: Crear las cuotas faltantes de todos los preregistros vigentes
 *     description: Aplica tarifa INTERNO o EXTERNO desde PerfilUsuario y nunca duplica cuotas existentes.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tarifaInterno: { type: number, example: 750 }
 *               tarifaExterno: { type: number, example: 850 }
 *               fechaVencimiento: { type: string, format: date }
 *     responses:
 *       200: { description: Resumen de cuotas creadas y existentes }
 */
router.post("/habilitar-masivo", authenticate, soloAdministracion, body("tarifaInterno").optional().isFloat({ min: 0.01 }).toFloat(), body("tarifaExterno").optional().isFloat({ min: 0.01 }).toFloat(), body("fechaVencimiento").optional({ checkFalsy: true }).isISO8601(), handleInputErrors, habilitarCuotasMasivas);
router.patch("/prorroga/vencidas", authenticate, soloAdministracion, body("horas").isInt({ min: 1, max: 8760 }).toInt(), body("motivo").trim().isLength({ min: 3, max: 500 }), handleInputErrors, prorrogarCuotasVencidas);
router.post("/", authenticate, soloAdministracion, body("preregistroId").isMongoId(), body("fechaVencimiento").optional({ checkFalsy: true }).isISO8601(), handleInputErrors, crearCuota);
router.get("/mia", authenticate, obtenerMiCuota);
/** @openapi
 * /api/cuotas/{id}:
 *   get: { tags: [Cuotas], summary: Ver cuota y pagos parciales, security: [{ bearerAuth: [] }], parameters: [{ in: path, name: id, required: true, schema: { type: string } }], responses: { 200: { description: Detalle } } }
 */
router.get("/:id", authenticate, id, handleInputErrors, detalleCuota);
router.patch("/:id/plan/admin", authenticate, soloAdministradorReal, id, body("numeroCuotas").isInt({ min: 1, max: 3 }).toInt(), handleInputErrors, editarPlanCuotasAdmin);
router.patch("/:id/plan", authenticate, id, body("numeroCuotas").isInt({ min: 1, max: 3 }).toInt(), handleInputErrors, elegirPlanCuotas);
router.post("/:id/solicitar-qr", authenticate, id, body("numeroCuotas").isInt({ min: 1, max: 3 }).toInt(), body("numeroPago").isInt({ min: 1, max: 3 }).toInt(), handleInputErrors, solicitarQrPago);
router.post("/:id/solicitar-prorroga", authenticate, id, handleInputErrors, solicitarProrrogaPago);
router.patch("/:id/prorroga-primera-cuota", authenticate, soloAdministracion, id, body("horas").isInt({ min: 1, max: 8760 }).toInt(), body("motivo").trim().isLength({ min: 3, max: 500 }), handleInputErrors, prorrogarPrimeraCuota);
/** @openapi
 * /api/cuotas/{id}/pagos:
 *   post:
 *     tags: [Cuotas]
 *     summary: Registrar pago parcial con imagen de baucher
 *     security: [{ bearerAuth: [] }]
 *     requestBody: { required: true, content: { multipart/form-data: { schema: { type: object, required: [monto, nombrePagador, fechaPago, baucher], properties: { monto: { type: number }, nombrePagador: { type: string }, fechaPago: { type: string, format: date }, baucher: { type: string, format: binary } } } } } }
 *     responses: { 201: { description: Pendiente de revisión } }
 */
router.post("/:id/pagos", authenticate, id, validarPlazoAntesDeSubir, uploadBaucher.single("baucher"), convertirBaucherAWebp, body("monto").isFloat({ min: 0.01 }).toFloat(), body("metodoPago").equals("QR").withMessage("Los pagos de cuotas solo se registran mediante QR o depósito"), body("nombrePagador").trim().notEmpty().withMessage("Debe indicar a nombre de quién está el comprobante"), body("fechaPago").isISO8601(), handleInputErrors, registrarPago);
router.patch("/:id/pagos/:pagoId/revision", authenticate, soloAdministracion, id, param("pagoId").isMongoId(), uploadBaucher.single("respaldoAdmin"), convertirBaucherAWebp, body("estadoRevision").isIn(["PENDIENTE", "VERIFICADO", "OBSERVADO", "RECHAZADO"]), body("observacionRevision").optional().isLength({ max: 1000 }), handleInputErrors, revisarPago);
router.delete("/:id/pagos/:pagoId", authenticate, soloAdministracion, id, param("pagoId").isMongoId(), handleInputErrors, eliminarPago);
export default router;
