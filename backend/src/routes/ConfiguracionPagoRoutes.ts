import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { soloAdministracion } from "../middleware/soloAdministracion";
import { uploadQrPago } from "../middleware/uploadQrPago";
import { aceptarTerminos, guardarConfiguracion, obtenerConfiguracion, obtenerConfiguracionAdmin } from "../controllers/ConfiguracionPagoController";

const router = Router();
const campos = [
  "qrInterno1Cuota1", "qrExterno1Cuota1",
  "qrInterno2Cuota1", "qrInterno2Cuota2", "qrExterno2Cuota1", "qrExterno2Cuota2",
  "qrInterno3Cuota1", "qrInterno3Cuota2", "qrInterno3Cuota3",
  "qrExterno3Cuota1", "qrExterno3Cuota2", "qrExterno3Cuota3",
].map((name) => ({ name, maxCount: 1 }));

router.get("/mia", authenticate, obtenerConfiguracion);
router.post("/aceptar", authenticate, aceptarTerminos);
router.get("/admin", authenticate, soloAdministracion, obtenerConfiguracionAdmin);
router.put("/admin", authenticate, soloAdministracion, uploadQrPago.fields(campos), guardarConfiguracion);
export default router;
