import { Router } from "express";
import { reporteFacultades } from "../controllers/FacultadController";
import { authenticate } from "../middleware/auth";
import { soloAdministracion } from "../middleware/soloAdministracion";
const router = Router();
router.get("/reporte", authenticate, soloAdministracion, reporteFacultades);
export default router;
