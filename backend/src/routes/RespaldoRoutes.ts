import { Router } from "express";
import multer from "multer";
import { authenticate } from "../middleware/auth";
import { soloPropietarioRespaldo } from "../middleware/soloPropietarioRespaldo";
import { exportarRespaldo, exportarRespaldoOrganizado, importarRespaldo } from "../controllers/RespaldoController";

const router = Router();
const recibirRespaldo = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: 250 * 1024 * 1024 },
});

router.use(authenticate, soloPropietarioRespaldo);
router.get("/exportar", exportarRespaldo);
router.get("/exportar-organizado", exportarRespaldoOrganizado);
router.post("/importar", recibirRespaldo.single("respaldo"), importarRespaldo);

export default router;
