import type { Request, Response } from "express";
import path from "node:path";
import fs from "node:fs/promises";
import sharp from "sharp";
import ConfiguracionPago from "../models/ConfiguracionPago";
import Aceptacion from "../models/AceptacionTerminosPago";
import Preregistro from "../models/Preregistro";
import Gestion from "../models/Gestion";
import { registrarAuditoria } from "../services/AuditoriaService";
import { subirArchivoProcesado } from "../services/AlmacenamientoService";

const carpeta = path.resolve(process.cwd(), "public", "uploads", "qr-pagos");
type Archivos = Record<string, Express.Multer.File[]>;
type Origen = "INTERNO" | "EXTERNO";
type Plan = "1" | "2" | "3";
type QrPlanes = Partial<Record<Origen, Partial<Record<Plan, string[]>>>>;

const camposQr: Array<{ campo: string; origen: Origen; plan: Plan; indice: number }> = [
  { campo: "qrInterno1Cuota1", origen: "INTERNO", plan: "1", indice: 0 },
  { campo: "qrExterno1Cuota1", origen: "EXTERNO", plan: "1", indice: 0 },
  { campo: "qrInterno2Cuota1", origen: "INTERNO", plan: "2", indice: 0 },
  { campo: "qrInterno2Cuota2", origen: "INTERNO", plan: "2", indice: 1 },
  { campo: "qrExterno2Cuota1", origen: "EXTERNO", plan: "2", indice: 0 },
  { campo: "qrExterno2Cuota2", origen: "EXTERNO", plan: "2", indice: 1 },
  { campo: "qrInterno3Cuota1", origen: "INTERNO", plan: "3", indice: 0 },
  { campo: "qrInterno3Cuota2", origen: "INTERNO", plan: "3", indice: 1 },
  { campo: "qrInterno3Cuota3", origen: "INTERNO", plan: "3", indice: 2 },
  { campo: "qrExterno3Cuota1", origen: "EXTERNO", plan: "3", indice: 0 },
  { campo: "qrExterno3Cuota2", origen: "EXTERNO", plan: "3", indice: 1 },
  { campo: "qrExterno3Cuota3", origen: "EXTERNO", plan: "3", indice: 2 },
];

async function gestionUsuario(usuarioId: unknown) {
  const pre = await Preregistro.findOne({ usuarioId, fechaEliminado: null }).sort({ fechaRegistro: -1 });
  return pre?.gestionId;
}

export async function obtenerConfiguracion(req: Request, res: Response) {
  const gestionId = String(req.query.gestionId || await gestionUsuario(req.usuario?._id) || "");
  if (!gestionId) return res.status(404).json({ error: "No se encontró una gestión relacionada" });
  const config = await ConfiguracionPago.findOne({ gestionId, activo: true }).populate("gestionId", "nombre anio");
  if (!config) return res.status(404).json({ error: "Administración todavía no configuró los QR de pago" });
  const aceptada = await Aceptacion.findOne({ usuarioId: req.usuario?._id, gestionId, versionTerminos: config.versionTerminos });
  const objeto = config.toObject();
  if (!aceptada) {
    objeto.qrPagoTotal = undefined;
    objeto.qrPrimeraCuota = undefined;
    objeto.qrSegundaCuota = undefined;
    objeto.qrPlanes = undefined;
  }
  return res.json({ configuracion: objeto, terminosAceptados: Boolean(aceptada), aceptacion: aceptada });
}

export async function aceptarTerminos(req: Request, res: Response) {
  const gestionId = String(req.body.gestionId || await gestionUsuario(req.usuario?._id) || "");
  const config = await ConfiguracionPago.findOne({ gestionId, activo: true });
  if (!config) return res.status(404).json({ error: "No existe configuración de pagos" });
  const aceptacion = await Aceptacion.findOneAndUpdate(
    { usuarioId: req.usuario?._id, gestionId, versionTerminos: config.versionTerminos },
    { $setOnInsert: { fechaAceptacion: new Date(), ip: req.ip } },
    { upsert: true, new: true },
  );
  await registrarAuditoria(req, { accion: "ACEPTAR_TERMINOS", modulo: "CUOTAS", entidad: "AceptacionTerminosPago", entidadId: aceptacion._id, descripcion: `Se aceptaron términos de pago versión ${config.versionTerminos}` });
  return res.json({ message: "Términos y condiciones aceptados", aceptacion });
}

export async function guardarConfiguracion(req: Request, res: Response) {
  const gestion = req.body.gestionId
    ? await Gestion.findById(req.body.gestionId)
    : await Gestion.findOne({ estado: { $in: ["ACTIVA", "INSCRIPCIONES"] }, fechaEliminado: null }).sort({ anio: -1 });
  if (!gestion) return res.status(404).json({ error: "Gestión no encontrada" });
  const archivos = req.files as Archivos | undefined;
  const anterior = await ConfiguracionPago.findOne({ gestionId: gestion._id });
  const terminos = String(req.body.terminos || anterior?.terminos || "").trim();
  if (!terminos) return res.status(400).json({ error: "Debe escribir los términos y condiciones" });

  await fs.mkdir(carpeta, { recursive: true });
  const qrPlanes: QrPlanes = JSON.parse(JSON.stringify(anterior?.qrPlanes ?? {}));
  for (const dato of camposQr) {
    const archivo = archivos?.[dato.campo]?.[0];
    if (!archivo) continue;
    const nombre = `QR_${dato.origen}_${dato.plan}_CUOTA_${dato.indice + 1}_${gestion.anio}.webp`;
    const salida = path.join(carpeta, nombre);
    await sharp(archivo.path).rotate().resize({ width: 1400, height: 1400, fit: "inside", withoutEnlargement: true }).webp({ quality: 90 }).toFile(salida);
    await fs.unlink(archivo.path).catch(() => undefined);
    const ruta = `/uploads/qr-pagos/${nombre}`;
    const origen = qrPlanes[dato.origen] ?? {};
    const plan = [...(origen[dato.plan] ?? [])];
    plan[dato.indice] = ruta;
    origen[dato.plan] = plan;
    qrPlanes[dato.origen] = origen;
    await subirArchivoProcesado(ruta, salida, "image/webp");
  }

  const cambiaTerminos = Boolean(anterior && terminos !== anterior.terminos);
  const configuracion = await ConfiguracionPago.findOneAndUpdate(
    { gestionId: gestion._id },
    { $set: { qrPlanes, terminos, activo: true, fechaEditado: new Date(), usuarioEditor: req.usuario?._id }, $setOnInsert: { versionTerminos: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  if (cambiaTerminos) { configuracion.versionTerminos += 1; await configuracion.save(); }
  await registrarAuditoria(req, { accion: "CONFIGURAR_QR", modulo: "CUOTAS", entidad: "ConfiguracionPago", entidadId: configuracion._id, descripcion: "Se actualizaron los QR por plan y los términos de pago", datosDespues: configuracion.toObject() });
  return res.json({ message: "QR por plan y términos guardados", configuracion });
}

export async function obtenerConfiguracionAdmin(req: Request, res: Response) {
  const gestion = req.query.gestionId
    ? await Gestion.findById(req.query.gestionId)
    : await Gestion.findOne({ estado: { $in: ["ACTIVA", "INSCRIPCIONES"] }, fechaEliminado: null }).sort({ anio: -1 });
  const configuracion = gestion ? await ConfiguracionPago.findOne({ gestionId: gestion._id }) : null;
  return res.json({ gestion, configuracion });
}
