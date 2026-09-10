import type { Request, Response } from "express";
import AsistenciaEvento from "../models/AsistenciaEvento";
import Evento from "../models/Evento";
import Fraterno from "../models/Fraterno";
import Gestion from "../models/Gestion";
import DetalleBloque from "../models/DetalleBloque";
import { FILTRO_ASIGNACION_ACTIVA } from "../services/AsignacionBloqueService";
import { obtenerHistorialParticipacion } from "../services/CondicionFraternoService";
import { registrarAuditoria } from "../services/AuditoriaService";

const gestionActiva = () => Gestion.findOne({ estado: { $in: ["ACTIVA", "INSCRIPCIONES"] }, fechaEliminado: null }).sort({ anio: -1 });

export async function crearEvento(req: Request, res: Response) {
  const gestion = req.body.gestionId ? await Gestion.findById(req.body.gestionId) : await gestionActiva();
  if (!gestion) return res.status(404).json({ error: "No existe gestión para el evento" });
  const evento = await Evento.create({ ...req.body, gestionId: gestion._id, creadoPor: req.usuario?._id });
  await registrarAuditoria(req, { accion: "CREAR_EVENTO", modulo: "EVENTOS", entidad: "Evento", entidadId: evento._id, descripcion: `Se creó el evento ${evento.nombre}`, datosDespues: { nombre: evento.nombre, tipo: evento.tipo, fecha: evento.fecha } });
  return res.status(201).json({ message: "Evento creado", evento });
}

export async function listarEventos(_req: Request, res: Response) {
  const eventos = await Evento.find({ fechaEliminado: null }).populate("gestionId", "nombre anio").sort({ fecha: -1 }).lean();
  const conteos = await AsistenciaEvento.aggregate([{ $match: { estado: "PRESENTE" } }, { $group: { _id: "$eventoId", presentes: { $sum: 1 } } }]);
  const mapa = new Map(conteos.map((c) => [String(c._id), c.presentes]));
  return res.json({ eventos: eventos.map((e) => ({ ...e, presentes: mapa.get(String(e._id)) ?? 0 })) });
}

export async function cambiarEstadoEvento(req: Request, res: Response) {
  const evento = await Evento.findOneAndUpdate({ _id: req.params.id, fechaEliminado: null }, { $set: { estado: req.body.estado, ...(req.body.estado === "CERRADO" ? { fechaCierre: new Date() } : {}) } }, { new: true, runValidators: true });
  if (!evento) return res.status(404).json({ error: "Evento no encontrado" });
  await registrarAuditoria(req, { accion: "CAMBIAR_ESTADO_EVENTO", modulo: "EVENTOS", entidad: "Evento", entidadId: evento._id, descripcion: `${evento.nombre}: ${evento.estado}`, datosDespues: { estado: evento.estado } });
  return res.json({ message: "Estado del evento actualizado", evento });
}

export async function registrarAsistenciaEvento(req: Request, res: Response) {
  const evento = await Evento.findOne({ _id: req.params.id, fechaEliminado: null, estado: { $in: ["PROGRAMADO", "ACTIVO"] } });
  if (!evento) return res.status(404).json({ error: "Evento disponible no encontrado" });
  const usuarioId = req.body.usuarioId;
  const fraterno = await Fraterno.findOne({ usuarioId, gestionId: evento.gestionId, fechaEliminado: null }).sort({ fechaIngreso: -1 });
  try {
    const asistencia = await AsistenciaEvento.create({ eventoId: evento._id, usuarioId, fraternoId: fraterno?._id, metodoRegistro: req.body.metodoRegistro ?? "MANUAL", observacion: req.body.observacion, registradoPor: req.usuario?._id });
    await registrarAuditoria(req, { accion: "REGISTRAR_ASISTENCIA_EVENTO", modulo: "EVENTOS", entidad: "AsistenciaEvento", entidadId: asistencia._id, descripcion: `Asistencia registrada en ${evento.nombre}`, datosDespues: { eventoId: evento._id, usuarioId, metodo: asistencia.metodoRegistro } });
    return res.status(201).json({ message: "Asistencia registrada", asistencia });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) return res.status(409).json({ error: "La persona ya tiene asistencia registrada en este evento" });
    throw error;
  }
}

export async function detalleEvento(req: Request, res: Response) {
  const evento: any = await Evento.findOne({ _id: req.params.id, fechaEliminado: null }).populate("gestionId", "nombre anio").lean();
  if (!evento) return res.status(404).json({ error: "Evento no encontrado" });
  const asistencias: any[] = await AsistenciaEvento.find({ eventoId: evento._id, estado: "PRESENTE" }).populate("usuarioId", "nombres apellidoPaterno apellidoMaterno ci sexo").sort({ horaIngreso: 1 }).lean();
  const fraternoIds = asistencias.map((a) => a.fraternoId).filter(Boolean);
  const asignaciones: any[] = await DetalleBloque.find({ fraternoId: { $in: fraternoIds }, ...FILTRO_ASIGNACION_ACTIVA }).populate("bloqueId", "nombre").lean();
  const bloque = new Map(asignaciones.map((a) => [String(a.fraternoId), a.bloqueId?.nombre ?? "SIN BLOQUE"]));
  const filas = await Promise.all(asistencias.map(async (a) => ({ ...a, bloque: bloque.get(String(a.fraternoId)) ?? "SIN BLOQUE", condicion: (await obtenerHistorialParticipacion(a.usuarioId?._id, evento.gestionId?._id)).condicion })));
  const hombres = filas.filter((a) => a.usuarioId?.sexo === "HOMBRE").length;
  return res.json({ evento, asistencias: filas, estadisticas: { presentes: filas.length, hombres, mujeres: filas.length - hombres, nuevos: filas.filter((a) => a.condicion === "NUEVO").length, antiguos: filas.filter((a) => ["ANTIGUO", "REINCORPORADO"].includes(a.condicion)).length } });
}
