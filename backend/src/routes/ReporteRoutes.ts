import { Router } from "express";
import { revisarNominaSeparada, exportarNominaSeparada } from "../controllers/NominaSeparadaController";
import { obtenerAuditoriaIntegral } from "../services/AuditoriaIntegralService";
import { body, param, query } from "express-validator";
import { authenticate } from "../middleware/auth";
import { soloAdministracion, soloAdministradorReal } from "../middleware/soloAdministracion";
import { handleInputErrors } from "../middleware/validation";
import { auditoriaFinancieraGeneral, auditoriaParticipacion, controlFinancieroBloques, reporteEjecutivo, reporteEntregasRopa, reporteIntegrantesPorMatricula, reporteTallasPrimeraCuota } from "../controllers/ReporteController";
import { estadoAlmacenamiento, reporteTallas } from "../controllers/AlmacenamientoController";
import { reporteFormacion } from "../controllers/ReporteFormacionController";
import { centroControl, pagosCronologicos } from "../controllers/AdministracionController";
import { consultarNominaMatriculas, descargarDocumentoMatricula, exportarDocumentosMatriculasZip, exportarNominaOficial, registrarExportacionReporteMatriculas } from "../controllers/NominaMatriculasController";

const router = Router();
const validarListaNomina = [body("lista").isArray({ min: 1, max: 1000 }), body("lista.*").isString().bail().trim().isLength({ min: 1, max: 200 })];
router.post("/nomina-separada/revisar", authenticate, soloAdministradorReal, ...validarListaNomina, handleInputErrors, revisarNominaSeparada);
router.post("/nomina-separada/exportar", authenticate, soloAdministradorReal, ...validarListaNomina,
  body("huella").isString().matches(/^[a-f0-9]{64}$/), body("aceptarObservaciones").optional().isBoolean({ strict: true }), handleInputErrors, exportarNominaSeparada);
router.get("/auditoria-integral", authenticate, soloAdministradorReal, async (_req, res) => {
  res.json(await obtenerAuditoriaIntegral());
});
router.get("/formacion", authenticate, soloAdministracion, reporteFormacion);
router.get("/tallas", authenticate, soloAdministracion, reporteTallas);
router.get("/tallas-primera-cuota", authenticate, soloAdministradorReal, query("gestionId").optional().isMongoId(), handleInputErrors, reporteTallasPrimeraCuota);
router.get("/almacenamiento", authenticate, soloAdministracion, estadoAlmacenamiento);
router.get("/ejecutivo", authenticate, soloAdministracion, query("gestionId").optional().isMongoId(), handleInputErrors, reporteEjecutivo);
router.get("/pagos-cronologicos", authenticate, soloAdministracion, pagosCronologicos);
router.get("/centro-control", authenticate, soloAdministracion, centroControl);
router.get("/integrantes-matricula", authenticate, soloAdministradorReal, query("gestionId").optional().isMongoId(), handleInputErrors, reporteIntegrantesPorMatricula);
router.get("/entregas-ropa", authenticate, soloAdministracion, reporteEntregasRopa);
router.get("/control-financiero-bloques", authenticate, soloAdministradorReal, controlFinancieroBloques);
router.get("/auditoria-financiera", authenticate, soloAdministradorReal, auditoriaFinancieraGeneral);
router.get("/auditoria-participacion", authenticate, soloAdministradorReal, auditoriaParticipacion);
router.get("/nomina-matriculas", authenticate, soloAdministradorReal, query("gestionId").optional().isMongoId(), handleInputErrors, consultarNominaMatriculas);
router.post("/nomina-matriculas/oficial", authenticate, soloAdministradorReal,
  body("gestionId").optional().isMongoId(), body("usuarioIds").optional().isArray({ max: 1000 }), body("usuarioIds.*").optional().isMongoId(),
  handleInputErrors, exportarNominaOficial);
router.post("/nomina-matriculas/documentos-zip", authenticate, soloAdministradorReal,
  body("gestionId").optional().isMongoId(), body("usuarioIds").optional().isArray({ max: 1000 }), body("usuarioIds.*").optional().isMongoId(),
  handleInputErrors, exportarDocumentosMatriculasZip);
router.post("/nomina-matriculas/reporte-exportado", authenticate, soloAdministradorReal,
  body("cantidad").isInt({ min: 0, max: 100000 }), handleInputErrors, registrarExportacionReporteMatriculas);
router.get("/nomina-matriculas/documentos/:documentoId", authenticate, soloAdministradorReal,
  param("documentoId").isMongoId(), query("download").optional().isIn(["0", "1"]), handleInputErrors, descargarDocumentoMatricula);

export default router;
