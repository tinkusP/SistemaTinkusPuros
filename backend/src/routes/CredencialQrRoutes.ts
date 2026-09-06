import { Router } from "express";
import { body, param, query } from "express-validator";
import { authenticate } from "../middleware/auth";
import { soloAdministracion } from "../middleware/soloAdministracion";
import { handleInputErrors } from "../middleware/validation";
import {
  buscarIdentidades,
  identificarManualmente,
  miCredencialQr,
  verificarCredencialQr,
} from "../controllers/CredencialQrController";

const r = Router();

r.get("/mia", authenticate, miCredencialQr);
r.get(
  "/buscar",
  authenticate,
  soloAdministracion,
  query("q").isString().trim().isLength({ min: 2, max: 120 }),
  handleInputErrors,
  buscarIdentidades,
);
r.get(
  "/identidad/:id",
  authenticate,
  soloAdministracion,
  param("id").isMongoId(),
  handleInputErrors,
  identificarManualmente,
);
r.post(
  "/verificar",
  authenticate,
  soloAdministracion,
  body("token").isString().notEmpty(),
  handleInputErrors,
  verificarCredencialQr,
);

export default r;
