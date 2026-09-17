import { Router } from "express";
import multer from "multer";
import { tmpdir } from "node:os";
import { authenticate } from "../middleware/auth";
import { soloPropietarioRespaldo } from "../middleware/soloPropietarioRespaldo";
import {
  descargarRespaldoPreparado,
  estadoRespaldo,
  exportarRespaldo,
  exportarRespaldoOrganizado,
  importarRespaldo,
  prepararRespaldo,
} from "../controllers/RespaldoController";

const router = Router();
const recibirRespaldo = multer({
  dest: tmpdir(),
  limits: { files: 1, fileSize: 2 * 1024 * 1024 * 1024 },
});

router.use(authenticate, soloPropietarioRespaldo);
router.post("/exportar/preparar", prepararRespaldo);
router.get("/exportar/estado/:id", estadoRespaldo);
router.get("/exportar/descargar/:id", descargarRespaldoPreparado);
router.get("/exportar", exportarRespaldo);
router.get("/exportar-organizado", exportarRespaldoOrganizado);
router.post("/importar", recibirRespaldo.single("respaldo"), importarRespaldo);

export default router;
