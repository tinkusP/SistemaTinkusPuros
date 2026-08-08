import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { soloAdministracion } from "../middleware/soloAdministracion";
import { listarAsistenciasPostulantes, marcarEntradaPostulante, marcarEntradaPostulanteAdmin, marcarSalidaPostulante, marcarSalidaPostulanteAdmin, misAsistenciasPostulante } from "../controllers/AsistenciaPostulanteGuiaController";

const router = Router();
router.post("/entrada", authenticate, marcarEntradaPostulante);
router.patch("/salida", authenticate, marcarSalidaPostulante);
router.get("/mias", authenticate, misAsistenciasPostulante);
router.get("/", authenticate, soloAdministracion, listarAsistenciasPostulantes);
router.post("/:id/entrada", authenticate, soloAdministracion, marcarEntradaPostulanteAdmin);
router.patch("/:id/salida", authenticate, soloAdministracion, marcarSalidaPostulanteAdmin);
export default router;
