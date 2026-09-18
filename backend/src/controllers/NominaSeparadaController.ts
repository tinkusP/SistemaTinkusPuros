import type { Request, Response } from "express";
import { consultarNominaSeparada, generarExcelNominaSeparada } from "../services/NominaSeparadaService";

const administrador = (req: Request) => ({ id: String(req.usuario._id), nombre: [req.usuario.nombres, req.usuario.apellidoPaterno, req.usuario.apellidoMaterno].filter(Boolean).join(" ") });

export async function revisarNominaSeparada(req: Request, res: Response) {
  const reporte = await consultarNominaSeparada(req.body.lista);
  res.setHeader("Cache-Control", "no-store");
  res.json({ ...reporte, generadoEn: new Date().toISOString(), administrador: administrador(req) });
}

export async function exportarNominaSeparada(req: Request, res: Response) {
  const reporte = await consultarNominaSeparada(req.body.lista);
  res.setHeader("Cache-Control", "no-store");
  if (reporte.huella !== req.body.huella) return res.status(409).json({ error: "Los datos cambiaron después de la revisión. Revisa la lista nuevamente." });
  if (!reporte.filas.length) return res.status(422).json({ error: "No hay usuarios identificados inequívocamente para exportar." });
  const r = reporte.resumen;
  if ((r.noEncontrados || r.ambiguos || r.repetidos || r.requierenRevision) && req.body.aceptarObservaciones !== true) return res.status(422).json({ error: "Revisa las observaciones y confirma la exportación de los usuarios encontrados. No se exportarán coincidencias ambiguas." });
  const archivo = await generarExcelNominaSeparada(reporte, administrador(req));
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", 'attachment; filename="nomina_usuarios_separada.xlsx"');
  res.setHeader("Content-Length", archivo.length);
  return res.send(archivo);
}
