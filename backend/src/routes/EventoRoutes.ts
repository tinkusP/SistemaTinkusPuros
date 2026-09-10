import { Router } from "express";
import { body, param } from "express-validator";
import { cambiarEstadoEvento, crearEvento, detalleEvento, listarEventos, registrarAsistenciaEvento } from "../controllers/EventoController";
import { authenticate } from "../middleware/auth";
import { soloAdministracion } from "../middleware/soloAdministracion";
import { handleInputErrors } from "../middleware/validation";

const router = Router();
router.use(authenticate, soloAdministracion);
router.get("/", listarEventos);
router.post("/", body("nombre").trim().isLength({ min: 2, max: 180 }), body("tipo").trim().isLength({ min: 2, max: 80 }), body("fecha").isISO8601(), body("horaInicio").optional({ checkFalsy: true }).matches(/^\d{2}:\d{2}$/), body("horaFin").optional({ checkFalsy: true }).matches(/^\d{2}:\d{2}$/), handleInputErrors, crearEvento);
router.get("/:id", param("id").isMongoId(), handleInputErrors, detalleEvento);
router.patch("/:id/estado", param("id").isMongoId(), body("estado").isIn(["PROGRAMADO", "ACTIVO", "CERRADO", "CANCELADO"]), handleInputErrors, cambiarEstadoEvento);
router.post("/:id/asistencias", param("id").isMongoId(), body("usuarioId").isMongoId(), body("metodoRegistro").isIn(["QR", "CI", "NOMBRE", "MANUAL"]), handleInputErrors, registrarAsistenciaEvento);
export default router;
