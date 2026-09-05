import { Router } from "express";
import { query } from "express-validator";
import { authenticate } from "../middleware/auth";
import { soloAdministracion, soloAdministradorReal } from "../middleware/soloAdministracion";
import { handleInputErrors } from "../middleware/validation";
import { reporteEjecutivo, reporteTallasPrimeraCuota } from "../controllers/ReporteController";
import { estadoAlmacenamiento, reporteTallas } from "../controllers/AlmacenamientoController";
import { reporteFormacion } from "../controllers/ReporteFormacionController";

const router = Router();
router.get("/formacion", authenticate, soloAdministracion, reporteFormacion);
router.get("/tallas", authenticate, soloAdministracion, reporteTallas);
router.get("/tallas-primera-cuota", authenticate, soloAdministradorReal, query("gestionId").optional().isMongoId(), handleInputErrors, reporteTallasPrimeraCuota);
router.get("/almacenamiento", authenticate, soloAdministracion, estadoAlmacenamiento);
router.get("/ejecutivo", authenticate, soloAdministracion, query("gestionId").optional().isMongoId(), handleInputErrors, reporteEjecutivo);

export default router;
