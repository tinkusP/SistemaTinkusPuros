import archiver from "archiver";
import type { Request, Response } from "express";
import path from "node:path";
import DocumentoUsuario from "../models/DocumentoUsuario";
import { descargarArchivoAlmacenado } from "../services/AlmacenamientoService";
import { registrarAuditoria } from "../services/AuditoriaService";
import { filasOficiales, generarNominaOficial, obtenerNominaMatriculas } from "../services/NominaMatriculasService";

const nombreSeguro = (valor: unknown, respaldo = "ARCHIVO") => String(valor ?? "")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || respaldo;

const idsSolicitados = (req: Request): string[] => Array.isArray(req.body?.usuarioIds)
  ? [...new Set<string>(req.body.usuarioIds.map((valor: unknown) => String(valor)))]
  : [];

const seleccionarPersonas = (personas: any[], solicitados: string[]) => {
  if (!solicitados.length) return personas;
  const permitidos = new Set(solicitados);
  return personas.filter((persona) => permitidos.has(String(persona.usuarioId)));
};

export async function consultarNominaMatriculas(req: Request, res: Response) {
  const reporte = await obtenerNominaMatriculas(req.query.gestionId ? String(req.query.gestionId) : undefined);
  return res.json(reporte);
}

export async function exportarNominaOficial(req: Request, res: Response) {
  try {
    const reporte = await obtenerNominaMatriculas(req.body?.gestionId ? String(req.body.gestionId) : undefined);
    const solicitados = idsSolicitados(req);
    const personas = seleccionarPersonas(reporte.personas, solicitados);
    if (solicitados.length !== personas.length) return res.status(400).json({ error: "La selección contiene usuarios que no tienen un documento real de matrícula vigente" });
    const noListos = personas.filter((persona) => !persona.listoNomina);
    if (noListos.length) return res.status(422).json({
      error: "Existen personas con datos incompletos o inconsistentes. Corrige los registros antes de generar la nómina oficial.",
      personas: noListos.map((persona) => ({ usuarioId: persona.usuarioId, nombre: persona.nombreCompleto, problemas: persona.inconsistencias })),
    });
    const archivo = await generarNominaOficial(filasOficiales(personas));
    await registrarAuditoria(req, {
      accion: "NOMINA_OFICIAL_MATRICULAS_EXPORTADA", modulo: "REPORTES", entidad: "DocumentoUsuario",
      descripcion: `Se exportó la nómina oficial con ${personas.length} persona(s)`, datosDespues: { cantidad: personas.length, gestionId: reporte.gestion?._id ?? null },
    });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="Nomina_Oficial_Tinkus_${new Date().toISOString().slice(0, 10)}.xlsx"`);
    res.setHeader("Content-Length", archivo.length);
    return res.send(archivo);
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "No se pudo generar la nómina oficial" });
  }
}

export async function registrarExportacionReporteMatriculas(req: Request, res: Response) {
  const cantidad = Math.max(0, Number(req.body?.cantidad ?? 0));
  await registrarAuditoria(req, {
    accion: "REPORTE_MATRICULAS_EXPORTADO", modulo: "REPORTES", entidad: "DocumentoUsuario",
    descripcion: `Se exportó el reporte administrativo de matrículas con ${cantidad} persona(s)`, datosDespues: { cantidad },
  });
  return res.json({ message: "Exportación registrada" });
}

export async function descargarDocumentoMatricula(req: Request, res: Response) {
  const documento: any = await DocumentoUsuario.findOne({
    _id: req.params.documentoId, tipoDocumento: "REGISTRO_UNIVERSITARIO", fechaEliminado: null, estado: { $ne: "ELIMINADO" },
  }).populate({ path: "perfilUsuario", match: { fechaEliminado: null, estado: { $ne: "ELIMINADO" } }, select: "nombres apellidoPaterno apellidoMaterno ci" }).lean();
  if (!documento?.perfilUsuario) return res.status(404).json({ error: "Documento de matrícula no encontrado" });
  try {
    const archivo = await descargarArchivoAlmacenado(documento.ruta);
    const usuario = documento.perfilUsuario;
    const extension = path.extname(documento.ruta) || ".bin";
    const nombre = `${nombreSeguro(usuario.ci, "SIN_CI")}_${nombreSeguro([usuario.nombres, usuario.apellidoPaterno, usuario.apellidoMaterno].filter(Boolean).join(" "), "USUARIO")}_MATRICULA${extension.toLowerCase()}`;
    await registrarAuditoria(req, {
      accion: "DOCUMENTO_MATRICULA_DESCARGADO", modulo: "REPORTES", entidad: "DocumentoUsuario", entidadId: documento._id,
      descripcion: `Se ${req.query.download === "1" ? "descargó" : "visualizó"} el documento de matrícula del CI ${usuario.ci}`,
    });
    res.setHeader("Content-Type", archivo.contentType);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Disposition", `${req.query.download === "1" ? "attachment" : "inline"}; filename="${nombre}"`);
    return res.send(archivo.contenido);
  } catch (error) {
    console.error("No se pudo recuperar el documento de matrícula", { documentoId: documento._id, error: error instanceof Error ? error.message : error });
    return res.status(404).json({ error: "El registro existe, pero el archivo físico de matrícula no está disponible" });
  }
}

export async function exportarDocumentosMatriculasZip(req: Request, res: Response) {
  const reporte = await obtenerNominaMatriculas(req.body?.gestionId ? String(req.body.gestionId) : undefined);
  const solicitados = idsSolicitados(req);
  const personas = seleccionarPersonas(reporte.personas, solicitados);
  if (solicitados.length !== personas.length) return res.status(400).json({ error: "La selección contiene usuarios sin documento real de matrícula vigente" });
  if (!personas.length) return res.status(400).json({ error: "No existen documentos de matrícula para descargar" });

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", "attachment; filename=Documentos_Matriculas_Tinkus_2026.zip");
  const zip = archiver("zip", { zlib: { level: 6 } });
  zip.on("error", (error) => {
    console.error("Error creando ZIP de matrículas", error);
    if (!res.headersSent) res.status(500).json({ error: "No se pudo crear el ZIP" }); else res.destroy(error);
  });
  zip.pipe(res);

  const faltantes: string[] = [];
  let agregados = 0;
  for (const persona of personas) {
    const documento: any = await DocumentoUsuario.findOne({ _id: persona.documentoId, tipoDocumento: "REGISTRO_UNIVERSITARIO", fechaEliminado: null, estado: { $ne: "ELIMINADO" } }).lean();
    if (!documento?.ruta) {
      faltantes.push(`${persona.ci} - ${persona.nombreCompleto}: registro sin ruta`);
      continue;
    }
    try {
      const archivo = await descargarArchivoAlmacenado(documento.ruta);
      const carpeta = persona.tipoOrigen === "INTERNO" ? "INTERNOS" : persona.tipoOrigen === "EXTERNO" ? "EXTERNOS" : "SIN_CLASIFICAR";
      const extension = path.extname(documento.ruta) || ".bin";
      const nombre = `${nombreSeguro(persona.ci, "SIN_CI")}_${nombreSeguro(persona.nombreCompleto, "USUARIO")}_MATRICULA${extension.toLowerCase()}`;
      zip.append(archivo.contenido, { name: `${carpeta}/${nombre}` });
      agregados += 1;
    } catch (error) {
      faltantes.push(`${persona.ci} - ${persona.nombreCompleto}: archivo físico no disponible`);
    }
  }
  if (faltantes.length) zip.append(`ARCHIVOS NO ENCONTRADOS (${faltantes.length})\n\n${faltantes.join("\n")}\n`, { name: "ARCHIVOS_NO_ENCONTRADOS.txt" });
  await registrarAuditoria(req, {
    accion: "DOCUMENTOS_MATRICULAS_ZIP_EXPORTADOS", modulo: "REPORTES", entidad: "DocumentoUsuario",
    descripcion: `Se exportaron ${agregados} documento(s) de matrícula en ZIP; ${faltantes.length} faltante(s)`,
    datosDespues: { solicitados: personas.length, agregados, faltantes: faltantes.length },
  });
  await zip.finalize();
}
