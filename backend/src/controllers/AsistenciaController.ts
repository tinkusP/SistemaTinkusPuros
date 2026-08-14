import type { Request, Response } from "express";
import Asistencia from "../models/Asistencia";
import Fraterno from "../models/Fraterno";
import Preregistro from "../models/Preregistro";
import { registrarAuditoria } from "../services/AuditoriaService";
import jwt from "jsonwebtoken";
import PerfilUsuario from "../models/PerfilUsuario";

const zona = "America/La_Paz";
const fechaClave = (fecha = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: zona, year: "numeric", month: "2-digit", day: "2-digit" }).format(fecha);
const poblar = [{ path: "usuarioId", select: "nombres apellidoPaterno apellidoMaterno ci email fotoPerfil" }, { path: "gestionId", select: "nombre anio" }, { path: "fraternoId", select: "numeroFraterno estado" }];
let indiceAnteriorEliminado: Promise<void> | null = null;

function prepararIndices() {
  if (!indiceAnteriorEliminado) {
    indiceAnteriorEliminado = Asistencia.collection.dropIndex("fraternoId_1_fechaClave_1")
      .then(() => undefined)
      .catch((error: { code?: number; codeName?: string }) => {
        if (error.code !== 27 && error.codeName !== "IndexNotFound") throw error;
      });
  }
  return indiceAnteriorEliminado;
}

async function fraternoActivo(usuarioId: unknown) {
  return Fraterno.findOne({ usuarioId, estado: "ACTIVO", fechaEliminado: null }).sort({ fechaIngreso: -1 });
}

async function participanteActivo(usuarioId: unknown) {
  const fraterno = await fraternoActivo(usuarioId);
  if (fraterno) return { fraterno, preregistro: null, usuarioId: fraterno.usuarioId, gestionId: fraterno.gestionId };
  const preregistro = await Preregistro.findOne({ usuarioId, fechaEliminado: null, estado: { $nin: ["RECHAZADO", "CANCELADO"] } }).sort({ fechaRegistro: -1 });
  if (!preregistro) return null;
  return { fraterno: null, preregistro, usuarioId: preregistro.usuarioId, gestionId: preregistro.gestionId };
}

export async function marcarEntrada(req: Request, res: Response) {
  await prepararIndices();
  const participante = await participanteActivo(req.usuario?._id);
  if (!participante) return res.status(403).json({ error: "Necesitas un preregistro vigente para registrar asistencia" });
  const ahora = new Date();
  try {
    const asistencia = await Asistencia.create({ fraternoId: participante.fraterno?._id, preregistroId: participante.preregistro?._id, usuarioId: participante.usuarioId, gestionId: participante.gestionId, fechaClave: fechaClave(ahora), fecha: ahora, horaEntrada: ahora, metodoEntrada: "PORTAL", usuarioRegistroEntrada: req.usuario?._id });
    await registrarAuditoria(req, { accion: "MARCAR_ENTRADA", modulo: "ASISTENCIAS", entidad: "Asistencia", entidadId: asistencia._id, descripcion: `Entrada registrada a las ${ahora.toISOString()}` });
    return res.status(201).json({ message: "Entrada registrada", asistencia });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) return res.status(409).json({ error: "La entrada de hoy ya fue registrada" });
    throw error;
  }
}

export async function marcarEntradaPorQr(req: Request, res: Response) {
  await prepararIndices();
  let payload: jwt.JwtPayload;
  try {
    payload = jwt.verify(String(req.body.token || ""), process.env.JWT_SECRET || "", { issuer: "tinkus-local" }) as jwt.JwtPayload;
  } catch {
    return res.status(400).json({ error: "QR inválido, alterado o vencido" });
  }
  if (payload.tipo !== "CREDENCIAL_QR" || !payload.sub) {
    return res.status(400).json({ error: "El QR no corresponde a una credencial válida" });
  }

  const usuario = await PerfilUsuario.findOne({ _id: payload.sub, fechaEliminado: null }).select("estado ci credencialQrVersion");
  if (!usuario) return res.status(404).json({ error: "El usuario del QR ya no existe" });
  if (usuario.estado !== "ACTIVO") return res.status(403).json({ error: "La cuenta no está activa; no se puede marcar asistencia" });
  if (!Number.isInteger(payload.versionQr) || Number(payload.versionQr) !== Number(usuario.credencialQrVersion ?? 0)) {
    return res.status(409).json({ error: "Este QR ya fue utilizado. Debe presentarse el nuevo código generado" });
  }

  const participante = await participanteActivo(usuario._id);
  if (!participante) return res.status(403).json({ error: "La persona no tiene un preregistro o fraterno vigente" });
  const ahora = new Date();
  try {
    const asistencia = await Asistencia.create({
      fraternoId: participante.fraterno?._id,
      preregistroId: participante.preregistro?._id,
      usuarioId: participante.usuarioId,
      gestionId: participante.gestionId,
      fechaClave: fechaClave(ahora),
      fecha: ahora,
      horaEntrada: ahora,
      metodoEntrada: "ADMINISTRACION",
      usuarioRegistroEntrada: req.usuario?._id,
    });
    await registrarAuditoria(req, {
      accion: "MARCAR_ENTRADA_QR",
      modulo: "ASISTENCIAS",
      entidad: "Asistencia",
      entidadId: asistencia._id,
      descripcion: `Administración confirmó presencialmente la entrada por QR de ${usuario.ci}`,
    });
    return res.status(201).json({ message: "Asistencia marcada correctamente", asistencia });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      return res.status(409).json({ error: "La asistencia de esta persona ya fue marcada hoy" });
    }
    throw error;
  }
}

export async function marcarSalida(req: Request, res: Response) {
  const participante = await participanteActivo(req.usuario?._id);
  if (!participante) return res.status(403).json({ error: "Necesitas un preregistro vigente para registrar asistencia" });
  const ahora = new Date();
  const asistencia = await Asistencia.findOneAndUpdate({ usuarioId: participante.usuarioId, gestionId: participante.gestionId, fechaClave: fechaClave(ahora), horaSalida: { $exists: false }, estado: "INCOMPLETA" }, { horaSalida: ahora, estado: "PRESENTE", metodoSalida: "PORTAL", usuarioRegistroSalida: req.usuario?._id }, { new: true });
  if (!asistencia) return res.status(409).json({ error: "Primero debes marcar entrada o la salida ya fue registrada" });
  await registrarAuditoria(req, { accion: "MARCAR_SALIDA", modulo: "ASISTENCIAS", entidad: "Asistencia", entidadId: asistencia._id, descripcion: `Salida registrada a las ${ahora.toISOString()}` });
  return res.json({ message: "Salida registrada", asistencia });
}

export async function misAsistencias(req: Request, res: Response) {
  const participante = await participanteActivo(req.usuario?._id);
  const asistencias = await Asistencia.find({ usuarioId: req.usuario?._id }).sort({ fecha: -1 }).limit(200);
  res.json({
    habilitado: Boolean(participante),
    motivoNoHabilitado: participante ? null : "Necesitas un preregistro vigente para registrar asistencia.",
    fraterno: participante?.fraterno ?? null,
    preregistro: participante?.preregistro ?? null,
    asistencias,
    hoy: asistencias.find((a) => a.fechaClave === fechaClave()) ?? null,
  });
}

export async function listarAsistencias(req: Request, res: Response) {
  const filtro: Record<string, unknown> = {};
  if (req.query.fecha) filtro.fechaClave = req.query.fecha;
  if (req.query.estado) filtro.estado = req.query.estado;
  res.json({ asistencias: await Asistencia.find(filtro).populate(poblar).sort({ fecha: -1 }).limit(2000) });
}
