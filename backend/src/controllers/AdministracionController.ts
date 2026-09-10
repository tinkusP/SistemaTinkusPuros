import type { Request, Response } from "express";
import AsistenciaEvento from "../models/AsistenciaEvento";
import Bloque from "../models/Bloque";
import Cuota from "../models/Cuota";
import DetalleBloque from "../models/DetalleBloque";
import DetalleCuota from "../models/DetalleCuota";
import EntregaIndumentaria from "../models/EntregaIndumentaria";
import Fraterno from "../models/Fraterno";
import Gestion from "../models/Gestion";
import TallaFraterno from "../models/TallaFraterno";
import { FILTRO_ASIGNACION_ACTIVA } from "../services/AsignacionBloqueService";
import { obtenerHistorialParticipacion } from "../services/CondicionFraternoService";
import { ARTICULOS_PACK, resumenPackFraterno } from "../services/EntregaPackService";
import { listarPendientesBloque } from "../services/PendientesBloqueService";
import { reportePagosCronologico } from "../services/ReportePagosCronologicoService";

export async function pendientesBloque(_req: Request, res: Response) { return res.json(await listarPendientesBloque()); }
export async function pagosCronologicos(_req: Request, res: Response) { return res.json(await reportePagosCronologico()); }

export async function fichaIntegralFraterno(req: Request, res: Response) {
  const fraterno: any = await Fraterno.findOne({ _id: req.params.id, fechaEliminado: null }).populate("usuarioId", "nombres apellidoPaterno apellidoMaterno ci telefono email sexo facultad carrera fotoPerfil fechaCreado").populate("gestionId", "nombre anio").lean();
  if (!fraterno) return res.status(404).json({ error: "Fraterno no encontrado" });
  const [asignacion, cuota, talla, pack, historial, asistencias] = await Promise.all([
    DetalleBloque.findOne({ fraternoId: fraterno._id, ...FILTRO_ASIGNACION_ACTIVA }).populate({ path: "bloqueId", select: "nombre guiaId guiasIds", populate: { path: "guiasIds", populate: { path: "usuarioId", select: "nombres apellidoPaterno apellidoMaterno telefono fotoPerfil" } } }).lean(),
    Cuota.findOne({ preregistroId: fraterno.preregistroId, fechaEliminado: null }).lean(),
    TallaFraterno.findOne({ $or: [{ fraternoId: fraterno._id }, { usuarioId: fraterno.usuarioId?._id }] }).lean(),
    resumenPackFraterno(fraterno._id), obtenerHistorialParticipacion(fraterno.usuarioId?._id, fraterno.gestionId?._id),
    AsistenciaEvento.find({ fraternoId: fraterno._id, estado: "PRESENTE" }).populate("eventoId", "nombre tipo fecha").sort({ horaIngreso: -1 }).lean(),
  ]);
  const pagos = cuota ? await DetalleCuota.find({ cuotaId: cuota._id, fechaEliminado: null }).sort({ numeroPago: 1, fechaPago: 1 }).lean() : [];
  const entregas: any[] = await EntregaIndumentaria.find({ fraternoId: fraterno._id }).populate("prendaId", "nombre").sort({ fechaEntrega: 1 }).lean();
  const lineaTiempo = [
    { fecha: fraterno.usuarioId?.fechaCreado, tipo: "REGISTRO", detalle: "Cuenta registrada" },
    { fecha: fraterno.fechaIngreso, tipo: "FRATERNO", detalle: `Ingreso como fraterno ${fraterno.numeroFraterno}` },
    ...(asignacion ? [{ fecha: asignacion.fechaAsignacion, tipo: "BLOQUE", detalle: `Asignado a ${(asignacion.bloqueId as any)?.nombre}` }] : []),
    ...pagos.flatMap((p: any) => [{ fecha: p.fechaPago, tipo: "PAGO_REGISTRADO", detalle: `Pago ${p.numeroPago} registrado` }, ...(p.fechaRevision ? [{ fecha: p.fechaRevision, tipo: "PAGO_REVISADO", detalle: `Pago ${p.numeroPago}: ${p.estadoRevision}` }] : [])]),
    ...entregas.map((e) => ({ fecha: e.fechaEntrega, tipo: "INDUMENTARIA", detalle: `${e.prendaId?.nombre}: ${e.estado}` })),
    ...asistencias.map((a: any) => ({ fecha: a.horaIngreso, tipo: "EVENTO", detalle: `Asistencia: ${a.eventoId?.nombre}` })),
  ].filter((item) => item.fecha).sort((a, b) => new Date(a.fecha as Date).getTime() - new Date(b.fecha as Date).getTime());
  return res.json({ fraterno, historial, bloque: asignacion?.bloqueId ?? null, fechaAsignacion: asignacion?.fechaAsignacion ?? null, cuota, pagos, talla, pack, asistencias, lineaTiempo });
}

export async function centroControl(_req: Request, res: Response) {
  const gestion = await Gestion.findOne({ estado: { $in: ["ACTIVA", "INSCRIPCIONES"] }, fechaEliminado: null }).sort({ anio: -1 }).lean();
  if (!gestion) return res.json({ gestion: null });
  const fraternos: any[] = await Fraterno.find({ gestionId: gestion._id, fechaEliminado: null }).select("_id usuarioId preregistroId").lean();
  const [pendientes, pagosReporte, asignados, tallas, entregas, bloques] = await Promise.all([
    listarPendientesBloque(), reportePagosCronologico(), DetalleBloque.countDocuments({ fraternoId: { $in: fraternos.map((f) => f._id) }, ...FILTRO_ASIGNACION_ACTIVA }),
    TallaFraterno.find({ $or: [{ fraternoId: { $in: fraternos.map((f) => f._id) } }, { usuarioId: { $in: fraternos.map((f) => f.usuarioId) } }] }).lean(),
    EntregaIndumentaria.find({ fraternoId: { $in: fraternos.map((f) => f._id) }, estado: "ENTREGADO" }).populate("prendaId", "nombre").lean(), Bloque.countDocuments({ gestionId: gestion._id, estado: "ACTIVO" }),
  ]);
  const porFraterno = new Map<string, Set<string>>();
  for (const e of entregas as any[]) { const clave = String(e.fraternoId); const set = porFraterno.get(clave) ?? new Set<string>(); set.add(e.prendaId?.nombre); porFraterno.set(clave, set); }
  const packs = fraternos.map((f) => { const n = ARTICULOS_PACK.filter((a) => porFraterno.get(String(f._id))?.has(a)).length; return n === 0 ? "PENDIENTE" : n === 4 ? "PACK_COMPLETO" : "ENTREGA_PARCIAL"; });
  const personasPagos: any[] = pagosReporte.personas;
  return res.json({ gestion: { _id: gestion._id, nombre: gestion.nombre, anio: gestion.anio }, personas: { total: fraternos.length }, pagos: { completos: personasPagos.filter((p) => p.estado === "PAGO_COMPLETO").length, parciales: personasPagos.filter((p) => p.estado === "PAGO_PARCIAL").length, sinPago: personasPagos.filter((p) => p.estado === "SIN_PAGO").length, pendientesRevision: personasPagos.reduce((s, p) => s + p.revisiones.pendientes, 0), observados: personasPagos.reduce((s, p) => s + p.revisiones.observados, 0) }, bloques: { total: bloques, conBloque: asignados, sinBloque: fraternos.length - asignados, listos: pendientes.personas.filter((p) => p.listo).length, faltaPago: pendientes.personas.filter((p) => p.estado.includes("PAGO") || p.estado.includes("CUOTA")).length, faltaTalla: pendientes.personas.filter((p) => p.estado.includes("TALLA")).length }, indumentaria: { completos: packs.filter((p) => p === "PACK_COMPLETO").length, parciales: packs.filter((p) => p === "ENTREGA_PARCIAL").length, sinEntrega: packs.filter((p) => p === "PENDIENTE").length, conAlgunaTalla: tallas.length } });
}
