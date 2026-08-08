import { Router } from "express";
import { body, param } from "express-validator";
import { authenticate } from "../middleware/auth";
import { handleInputErrors } from "../middleware/validation";
import { convertirBaucherAWebp, uploadBaucher } from "../middleware/uploadBaucher";
import { crearCuota, detalleCuota, eliminarPago, listarCuotas, obtenerMiCuota, registrarPago, revisarPago } from "../controllers/CuotaController";
import type { NextFunction, Request, Response } from "express";
import { habilitarCuotasMasivas } from "../controllers/CuotaMasivaController";
const router = Router(); const id = param("id").isMongoId();
const soloAdministracion = (req: Request, res: Response, next: NextFunction) => { const roles = req.usuario?.roles as unknown as { codigo?: string; nombre?: string }[] | undefined; const permitido = roles?.some((rol) => [rol.codigo, rol.nombre].some((valor) => String(valor ?? "").toUpperCase() === "ADMINISTRADOR")); if (!permitido) { res.status(403).json({ error: "Esta operación requiere rol de administrador" }); return; } next(); };
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
router.post("/", authenticate, soloAdministracion, body("preregistroId").isMongoId(), body("montoTotal").isFloat({ min: 0.01 }).toFloat(), body("fechaVencimiento").optional({ checkFalsy: true }).isISO8601(), handleInputErrors, crearCuota);
router.get("/mia", authenticate, obtenerMiCuota);
/** @openapi
 * /api/cuotas/{id}:
 *   get: { tags: [Cuotas], summary: Ver cuota y pagos parciales, security: [{ bearerAuth: [] }], parameters: [{ in: path, name: id, required: true, schema: { type: string } }], responses: { 200: { description: Detalle } } }
 */
router.get("/:id", authenticate, id, handleInputErrors, detalleCuota);
/** @openapi
 * /api/cuotas/{id}/pagos:
 *   post:
 *     tags: [Cuotas]
 *     summary: Registrar pago parcial con imagen de baucher
 *     security: [{ bearerAuth: [] }]
 *     requestBody: { required: true, content: { multipart/form-data: { schema: { type: object, required: [monto, nombrePagador, fechaPago, baucher], properties: { monto: { type: number }, nombrePagador: { type: string }, fechaPago: { type: string, format: date }, baucher: { type: string, format: binary } } } } } }
 *     responses: { 201: { description: Pendiente de revisión } }
 */
router.post("/:id/pagos", authenticate, id, uploadBaucher.single("baucher"), convertirBaucherAWebp, body("monto").isFloat({ min: 0.01 }).toFloat(), body("metodoPago").isIn(["EFECTIVO", "QR", "MIXTO"]), body("montoEfectivo").optional().isFloat({ min: 0 }).toFloat(), body("montoQr").optional().isFloat({ min: 0 }).toFloat(), body("nombrePagador").trim().notEmpty(), body("fechaPago").isISO8601(), handleInputErrors, registrarPago);
router.patch("/:id/pagos/:pagoId/revision", authenticate, soloAdministracion, id, param("pagoId").isMongoId(), uploadBaucher.single("respaldoAdmin"), convertirBaucherAWebp, body("estadoRevision").isIn(["PENDIENTE", "VERIFICADO", "OBSERVADO", "RECHAZADO"]), body("observacionRevision").optional().isLength({ max: 1000 }), handleInputErrors, revisarPago);
router.delete("/:id/pagos/:pagoId", authenticate, soloAdministracion, id, param("pagoId").isMongoId(), handleInputErrors, eliminarPago);
export default router;
