import type { Request, Response } from "express";
import AsistenciaEvento from "../models/AsistenciaEvento";
import Evento from "../models/Evento";
import Fraterno from "../models/Fraterno";
import Gestion from "../models/Gestion";
import DetalleBloque from "../models/DetalleBloque";
import { FILTRO_ASIGNACION_ACTIVA } from "../services/AsignacionBloqueService";
import { obtenerHistorialParticipacion } from "../services/CondicionFraternoService";
import { registrarAuditoria } from "../services/AuditoriaService";
import PerfilUsuario from "../models/PerfilUsuario";
import jwt from "jsonwebtoken";
import { duracionMinutosEvento, estadoAsistenciaEvento, formatearDuracionEvento } from "../services/EventoAsistenciaService";

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
  const conteos = await AsistenciaEvento.aggregate([{ $match: { estado: "PRESENTE" } }, { $group: { _id: "$eventoId", entradas: { $sum: 1 }, salidas: { $sum: { $cond: [{ $ne: [{ $ifNull: ["$horaSalida", null] }, null] }, 1, 0] } } } }]);
  const mapa = new Map(conteos.map((c) => [String(c._id), c]));
  return res.json({ eventos: eventos.map((e) => { const c = mapa.get(String(e._id)); return { ...e, presentes: c?.entradas ?? 0, entradas: c?.entradas ?? 0, salidas: c?.salidas ?? 0, dentro: (c?.entradas ?? 0) - (c?.salidas ?? 0) }; }) });
}

export async function cambiarEstadoEvento(req: Request, res: Response) {
  const evento = await Evento.findOneAndUpdate({ _id: req.params.id, fechaEliminado: null }, { $set: { estado: req.body.estado, ...(req.body.estado === "CERRADO" ? { fechaCierre: new Date() } : {}) } }, { new: true, runValidators: true });
  if (!evento) return res.status(404).json({ error: "Evento no encontrado" });
  await registrarAuditoria(req, { accion: "CAMBIAR_ESTADO_EVENTO", modulo: "EVENTOS", entidad: "Evento", entidadId: evento._id, descripcion: `${evento.nombre}: ${evento.estado}`, datosDespues: { estado: evento.estado } });
  return res.json({ message: "Estado del evento actualizado", evento });
}

export async function registrarAsistenciaEvento(req: Request, res: Response) {
  const evento = await Evento.findOne({ _id: req.params.id, fechaEliminado: null });
  if (!evento) return res.status(404).json({ error: "Evento no encontrado" });
  if (evento.estado !== "ACTIVO") return res.status(409).json({ error: evento.estado === "CERRADO" ? "El evento está cerrado." : "El evento debe estar abierto para registrar asistencia." });
  const usuarioId = req.body.usuarioId;
  const usuario = await PerfilUsuario.findOne({ _id: usuarioId, fechaEliminado: null, estado: "ACTIVO" }).select("_id");
  if (!usuario) return res.status(404).json({ error: "Usuario activo no encontrado" });
  const fraterno = await Fraterno.findOne({ usuarioId, gestionId: evento.gestionId, fechaEliminado: null }).sort({ fechaIngreso: -1 });
  const existente: any = await AsistenciaEvento.findOne({ eventoId: evento._id, usuarioId, estado: "PRESENTE" });
  const ahora = new Date(), metodo = req.body.metodoRegistro ?? "MANUAL";
  if (existente?.horaSalida) return res.status(409).json({ error: `Esta persona ya registró su salida a las ${new Date(existente.horaSalida).toLocaleTimeString("es-BO", { timeZone: "America/La_Paz", hour: "2-digit", minute: "2-digit" })}.`, estado: "ASISTENCIA_COMPLETA", asistencia: existente });
  if (existente?.horaIngreso) {
    const salida: any = await AsistenciaEvento.findOneAndUpdate({ _id: existente._id, estado: "PRESENTE", $or: [{ horaSalida: { $exists: false } }, { horaSalida: null }] }, { $set: { horaSalida: ahora, metodoSalida: metodo, registradoSalidaPor: req.usuario?._id } }, { new: true });
    if (!salida) return res.status(409).json({ error: "La salida cambió durante la operación. Actualiza los datos." });
    await registrarAuditoria(req, { accion: "SALIDA_EVENTO", modulo: "EVENTOS", entidad: "AsistenciaEvento", entidadId: salida._id, descripcion: `Salida registrada en ${evento.nombre}`, datosAntes: { horaIngreso: salida.horaIngreso }, datosDespues: { horaSalida: salida.horaSalida, metodo } });
    return res.json({ message: "Salida registrada", accion: "SALIDA", estado: "ASISTENCIA_COMPLETA", asistencia: salida });
  }
  try {
    const asistencia = await AsistenciaEvento.create({ eventoId: evento._id, usuarioId, fraternoId: fraterno?._id, horaIngreso: ahora, metodoRegistro: metodo, observacion: req.body.observacion, registradoPor: req.usuario?._id });
    await registrarAuditoria(req, { accion: "ENTRADA_EVENTO", modulo: "EVENTOS", entidad: "AsistenciaEvento", entidadId: asistencia._id, descripcion: `Entrada registrada en ${evento.nombre}`, datosDespues: { eventoId: evento._id, usuarioId, horaIngreso: ahora, metodo } });
    return res.status(201).json({ message: "Entrada registrada", accion: "ENTRADA", estado: "DENTRO_DEL_EVENTO", asistencia });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) return res.status(409).json({ error: "La entrada fue registrada simultáneamente. Actualiza los datos." });
    throw error;
  }
}

export async function detalleEvento(req: Request, res: Response) {
  const evento: any = await Evento.findOne({ _id: req.params.id, fechaEliminado: null }).populate("gestionId", "nombre anio").lean();
  if (!evento) return res.status(404).json({ error: "Evento no encontrado" });
  const fraternos: any[] = await Fraterno.find({ gestionId: evento.gestionId?._id, estado: "ACTIVO", fechaEliminado: null }).populate("usuarioId", "nombres apellidoPaterno apellidoMaterno ci sexo telefono registroUniversitario estado").lean();
  const fraternosValidos = fraternos.filter((f) => f.usuarioId?.estado === "ACTIVO");
  const asistencias: any[] = await AsistenciaEvento.find({ eventoId: evento._id, estado: "PRESENTE" }).lean();
  const fraternoIds = fraternosValidos.map((f) => f._id);
  const asignaciones: any[] = await DetalleBloque.find({ fraternoId: { $in: fraternoIds }, ...FILTRO_ASIGNACION_ACTIVA }).populate("bloqueId", "nombre").lean();
  const bloque = new Map(asignaciones.map((a) => [String(a.fraternoId), a.bloqueId?.nombre ?? "SIN BLOQUE"]));
  const asistenciaPorUsuario = new Map(asistencias.map((a) => [String(a.usuarioId), a]));
  const filas = await Promise.all(fraternosValidos.map(async (f) => { const u:any=f.usuarioId,a:any=asistenciaPorUsuario.get(String(u._id)); const minutos=duracionMinutosEvento(a?.horaIngreso,a?.horaSalida); return { asistenciaId:a?._id??null,usuarioId:u._id,fraternoId:f._id,matricula:String(u.registroUniversitario??"").trim(),nombreCompleto:[u.apellidoPaterno,u.apellidoMaterno,u.nombres].filter(Boolean).join(" "),ci:u.ci,sexo:u.sexo,telefono:u.telefono??"",bloque:bloque.get(String(f._id))??"SIN BLOQUE",entrada:a?.horaIngreso??null,salida:a?.horaSalida??null,duracionMinutos:minutos,duracion:formatearDuracionEvento(minutos),estado:estadoAsistenciaEvento(a),metodoEntrada:a?.metodoRegistro??"",metodoSalida:a?.metodoSalida??"",observacion:a?.observacion??"",condicion:(await obtenerHistorialParticipacion(u._id,evento.gestionId?._id)).condicion}; }));
  const entradas=filas.filter((a)=>a.entrada).length,salidas=filas.filter((a)=>a.salida).length,dentro=filas.filter((a)=>a.estado==="DENTRO_DEL_EVENTO").length;
  const hombres = filas.filter((a) => a.sexo === "HOMBRE").length;
  return res.json({ evento, asistencias: filas, estadisticas: { totalEsperado:filas.length,entradas,salidas,dentro,completas:salidas,sinAsistencia:filas.length-entradas,presentes:entradas,hombres,mujeres:filas.length-hombres,nuevos:filas.filter((a)=>a.condicion==="NUEVO").length,antiguos:filas.filter((a)=>["ANTIGUO","REINCORPORADO"].includes(a.condicion)).length } });
}

export async function registrarAsistenciaEventoQr(req: Request, res: Response) {
  try {
    const payload = jwt.verify(String(req.body.token ?? ""), process.env.JWT_SECRET || "", { issuer: "tinkus-local" }) as jwt.JwtPayload;
    if (payload.tipo !== "CREDENCIAL_QR" || !payload.sub || !Number.isInteger(payload.versionQr)) return res.status(400).json({ error: "El QR no corresponde a una credencial válida" });
    const usuario:any = await PerfilUsuario.findOne({ _id: payload.sub, fechaEliminado: null, estado: "ACTIVO" }).select("_id credencialQrVersion");
    if (!usuario) return res.status(404).json({ error: "El usuario del QR no existe o está inactivo" });
    if (Number(payload.versionQr) !== Number(usuario.credencialQrVersion ?? 0)) return res.status(409).json({ error: "Esta credencial QR fue revocada" });
    req.body.usuarioId = usuario._id; req.body.metodoRegistro = "QR";
    return registrarAsistenciaEvento(req, res);
  } catch { return res.status(400).json({ error: "QR inválido, alterado o vencido" }); }
}

export async function corregirAsistenciaEvento(req: Request, res: Response) {
  const motivo=String(req.body.motivo??"").trim(); if(motivo.length<5)return res.status(400).json({error:"Indica un motivo de al menos 5 caracteres"});
  const anterior:any=await AsistenciaEvento.findOne({_id:req.params.asistenciaId,eventoId:req.params.id,estado:"PRESENTE"}).lean();
  if(!anterior)return res.status(404).json({error:"Asistencia no encontrada"});
  const cambios:any={observacion:motivo}; if(req.body.horaIngreso!==undefined)cambios.horaIngreso=new Date(req.body.horaIngreso); if(req.body.horaSalida!==undefined)cambios.horaSalida=req.body.horaSalida?new Date(req.body.horaSalida):null;
  if(cambios.horaSalida&&new Date(cambios.horaSalida)<new Date(cambios.horaIngreso??anterior.horaIngreso))return res.status(400).json({error:"La salida no puede ser anterior a la entrada"});
  const asistencia=await AsistenciaEvento.findByIdAndUpdate(anterior._id,{$set:cambios},{new:true,runValidators:true});
  await registrarAuditoria(req,{accion:"CORREGIR_ASISTENCIA_EVENTO",modulo:"EVENTOS",entidad:"AsistenciaEvento",entidadId:anterior._id,descripcion:`Corrección administrativa: ${motivo}`,datosAntes:{horaIngreso:anterior.horaIngreso,horaSalida:anterior.horaSalida,observacion:anterior.observacion},datosDespues:{horaIngreso:asistencia?.horaIngreso,horaSalida:asistencia?.horaSalida,observacion:motivo}});
  return res.json({message:"Asistencia corregida y auditada",asistencia});
}
