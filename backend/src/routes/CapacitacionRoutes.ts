import { Router } from "express";
import { query } from "express-validator";
import { authenticate } from "../middleware/auth";
import { soloAdministradorReal } from "../middleware/soloAdministracion";
import { handleInputErrors } from "../middleware/validation";
import { buscarUsuariosCapacitacion } from "../controllers/CapacitacionController";

const router = Router();
router.get("/usuarios", authenticate, soloAdministradorReal, query("tipo").optional().isIn(["GUIA", "FRATERNO"]), query("buscar").trim().isLength({ min: 2, max: 100 }), handleInputErrors, buscarUsuariosCapacitacion);
export default router;
