import type { Request, Response } from "express";
import Asistencia from "../models/Asistencia";
import PostulanteGuia from "../models/PostulanteGuia";
import Preregistro from "../models/Preregistro";
import { registrarAuditoria } from "../services/AuditoriaService";

const zona = "America/La_Paz";
const hoyClave = (fecha = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: zona, year: "numeric", month: "2-digit", day: "2-digit" }).format(fecha);
const estadosActivos = ["HABILITADO", "EN_EVALUACION", "ELEGIDO"];
const poblarAsistencia = [{ path: "usuarioId", select: "nombres apellidoPaterno apellidoMaterno ci email fotoPerfil" }, { path: "gestionId", select: "nombre anio" }];

async function candidatoDelUsuario(usuarioId: unknown) {
  const preregistros = await Preregistro.find({ usuarioId, fechaEliminado: null }).select("_id usuarioId gestionId numeroPreRegistro").sort({ fechaRegistro: -1 });
  if (!preregistros.length) return null;
  const candidato = await PostulanteGuia.findOne({ preregistroId: { $in: preregistros.map((p) => p._id) }, habilitado: true, fechaEliminado: null, estado: { $in: estadosActivos } }).sort({ fechaHabilitacion: -1 });
  if (!candidato) return null;
  const preregistro = preregistros.find((p) => String(p._id) === String(candidato.preregistroId));
  return preregistro ? { candidato, preregistro } : null;
}

async function registrarEntrada(req: Request, res: Response, postulanteId?: string) {
  let participante;
  if (postulanteId) {
    const candidato = await PostulanteGuia.findOne({ _id: postulanteId, habilitado: true, fechaEliminado: null, estado: { $in: estadosActivos } });
    if (candidato) {
      const preregistro = await Preregistro.findById(candidato.preregistroId);
      if (preregistro) participante = { candidato, preregistro };
    }
  } else participante = await candidatoDelUsuario(req.usuario?._id);
  if (!participante) return res.status(403).json({ error: "El usuario no es un postulante a guía habilitado" });
  const ahora = new Date();
  try {
    const asistencia = await Asistencia.create({ postulanteGuiaId: participante.candidato._id, preregistroId: participante.preregistro._id, usuarioId: participante.preregistro.usuarioId, gestionId: participante.preregistro.gestionId, fechaClave: hoyClave(ahora), fecha: ahora, horaEntrada: ahora, metodoEntrada: postulanteId ? "ADMINISTRACION" : "PORTAL", usuarioRegistroEntrada: req.usuario?._id });
    await registrarAuditoria(req, { accion: "MARCAR_ENTRADA_POSTULANTE_GUIA", modulo: "POSTULANTES_GUIA", entidad: "Asistencia", entidadId: asistencia._id, descripcion: `Entrada de postulante a guía registrada para ${hoyClave(ahora)}` });
    return res.status(201).json({ message: "Entrada registrada", asistencia });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) return res.status(409).json({ error: "La entrada de hoy ya fue registrada" });
    throw error;
  }
}

export const marcarEntradaPostulante = (req: Request, res: Response) => registrarEntrada(req, res);
export const marcarEntradaPostulanteAdmin = (req: Request, res: Response) => registrarEntrada(req, res, String(req.params.id));

async function registrarSalida(req: Request, res: Response, postulanteId?: string) {
  let participante;
  if (postulanteId) {
    const candidato = await PostulanteGuia.findById(postulanteId);
    const preregistro = candidato ? await Preregistro.findById(candidato.preregistroId) : null;
    if (candidato && preregistro) participante = { candidato, preregistro };
  } else participante = await candidatoDelUsuario(req.usuario?._id);
  if (!participante) return res.status(403).json({ error: "El usuario no es un postulante a guía habilitado" });
  const ahora = new Date();
  const asistencia = await Asistencia.findOneAndUpdate({ postulanteGuiaId: participante.candidato._id, fechaClave: hoyClave(ahora), estado: "INCOMPLETA", horaSalida: { $exists: false } }, { horaSalida: ahora, estado: "PRESENTE", metodoSalida: postulanteId ? "ADMINISTRACION" : "PORTAL", usuarioRegistroSalida: req.usuario?._id }, { new: true });
  if (!asistencia) return res.status(409).json({ error: "Primero debe registrarse la entrada o la salida ya fue marcada" });
  await registrarAuditoria(req, { accion: "MARCAR_SALIDA_POSTULANTE_GUIA", modulo: "POSTULANTES_GUIA", entidad: "Asistencia", entidadId: asistencia._id, descripcion: `Salida de postulante a guía registrada para ${hoyClave(ahora)}` });
  return res.json({ message: "Salida registrada", asistencia });
}

export const marcarSalidaPostulante = (req: Request, res: Response) => registrarSalida(req, res);
export const marcarSalidaPostulanteAdmin = (req: Request, res: Response) => registrarSalida(req, res, String(req.params.id));

export async function misAsistenciasPostulante(req: Request, res: Response) {
  const participante = await candidatoDelUsuario(req.usuario?._id);
  const asistencias = participante ? await Asistencia.find({ postulanteGuiaId: participante.candidato._id }).sort({ fecha: -1 }).limit(200) : [];
  return res.json({ habilitado: Boolean(participante), motivoNoHabilitado: participante ? null : "Tu postulación a guía todavía no está habilitada o ya fue cerrada.", postulante: participante?.candidato ?? null, asistencias, hoy: asistencias.find((a) => a.fechaClave === hoyClave()) ?? null });
}

export async function listarAsistenciasPostulantes(req: Request, res: Response) {
  const fecha = String(req.query.fecha || hoyClave());
  const postulantes = await PostulanteGuia.find({ habilitado: true, fechaEliminado: null, estado: { $in: estadosActivos } })
    .populate({ path: "preregistroId", select: "numeroPreRegistro usuarioId gestionId", populate: [{ path: "usuarioId", select: "nombres apellidoPaterno apellidoMaterno ci email fotoPerfil" }, { path: "gestionId", select: "nombre anio" }] })
    .sort({ puntajeTotal: -1 });
  const asistencias = await Asistencia.find({ postulanteGuiaId: { $in: postulantes.map((p) => p._id) }, fechaClave: fecha }).populate(poblarAsistencia).sort({ horaEntrada: 1 });
  return res.json({ fechaClave: fecha, postulantes, asistencias });
}
