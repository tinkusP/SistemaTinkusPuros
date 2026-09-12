import { Router } from "express";
import { query } from "express-validator";
import { authenticate } from "../middleware/auth";
import { soloAdministracion, soloAdministradorReal } from "../middleware/soloAdministracion";
import { handleInputErrors } from "../middleware/validation";
import { reporteEjecutivo, reporteEntregasRopa, reporteIntegrantesPorMatricula, reporteTallasPrimeraCuota } from "../controllers/ReporteController";
import { estadoAlmacenamiento, reporteTallas } from "../controllers/AlmacenamientoController";
import { reporteFormacion } from "../controllers/ReporteFormacionController";
import { centroControl, pagosCronologicos } from "../controllers/AdministracionController";

const router = Router();
router.get("/formacion", authenticate, soloAdministracion, reporteFormacion);
router.get("/tallas", authenticate, soloAdministracion, reporteTallas);
router.get("/tallas-primera-cuota", authenticate, soloAdministradorReal, query("gestionId").optional().isMongoId(), handleInputErrors, reporteTallasPrimeraCuota);
router.get("/almacenamiento", authenticate, soloAdministracion, estadoAlmacenamiento);
router.get("/ejecutivo", authenticate, soloAdministracion, query("gestionId").optional().isMongoId(), handleInputErrors, reporteEjecutivo);
router.get("/pagos-cronologicos", authenticate, soloAdministracion, pagosCronologicos);
router.get("/centro-control", authenticate, soloAdministracion, centroControl);
router.get("/integrantes-matricula", authenticate, soloAdministradorReal, query("gestionId").optional().isMongoId(), handleInputErrors, reporteIntegrantesPorMatricula);
router.get("/entregas-ropa", authenticate, soloAdministracion, reporteEntregasRopa);

export default router;
