import type { Request, Response } from "express";
import Fraterno from "../models/Fraterno";
import DetalleBloque from "../models/DetalleBloque";
import Cuota from "../models/Cuota";
import DetalleCuota from "../models/DetalleCuota";
import ConfiguracionPago from "../models/ConfiguracionPago";
import AceptacionTerminosPago from "../models/AceptacionTerminosPago";
import Preregistro from "../models/Preregistro";
import { registrarAuditoria } from "../services/AuditoriaService";

const poblar = [
  { path: "usuarioId", select: "nombres apellidoPaterno apellidoMaterno ci email telefono fotoPerfil" },
  { path: "gestionId", select: "nombre anio" },
  { path: "preregistroId", select: "numeroPreRegistro estado" },
  { path: "usuarioCreador", select: "nombres apellidoPaterno apellidoMaterno email" },
];

export async function listarFraternos(_req: Request, res: Response) {
  const fraternos = await Fraterno.find({ fechaEliminado: null }).populate(poblar).sort({ fechaIngreso: -1 });
  const enriquecidos = await Promise.all(fraternos.map(async (fraterno) => {
    const cuota = await Cuota.findOne({ preregistroId: fraterno.preregistroId, fechaEliminado: null });
    const pagos = cuota ? await DetalleCuota.find({ cuotaId: cuota._id, fechaEliminado: null }).populate("usuarioRevisor", "nombres apellidoPaterno").sort({ numeroPago: 1 }) : [];
    const configuracion = await ConfiguracionPago.findOne({ gestionId: fraterno.gestionId, activo: true }).select("versionTerminos terminos plazoPrimeraCuotaHoras");
    const aceptaciones = await AceptacionTerminosPago.find({ usuarioId: fraterno.usuarioId, gestionId: fraterno.gestionId }).sort({ versionTerminos: -1, fechaAceptacion: -1 });
    const ultimaAceptacion = aceptaciones[0];
    const estadoTerminos = !ultimaAceptacion ? "PENDIENTE" : ultimaAceptacion.versionTerminos === configuracion?.versionTerminos ? "ACEPTADOS" : "REQUIERE_NUEVA_ACEPTACION";
    const ahora = new Date();
    const prorrogaActiva = Boolean(cuota?.fechaProrroga && cuota.fechaVencimiento && cuota.fechaVencimiento > ahora && cuota.saldo > 0);
    const ultimoPago = pagos.at(-1);
    const estadoPago = cuota?.saldo === 0 ? "SALDADO" : pagos.some(p => p.estadoRevision === "PENDIENTE") ? "EN_VERIFICACION" : ultimoPago?.estadoRevision === "OBSERVADO" ? "OBSERVADO" : ultimoPago?.estadoRevision === "RECHAZADO" ? "RECHAZADO" : prorrogaActiva ? "PRORROGA" : cuota?.fechaVencimiento && cuota.fechaVencimiento < ahora ? "VENCIDO" : (cuota?.montoPagado ?? 0) > 0 ? "PAGO_PARCIAL" : pagos.length ? "PAGO_SUBIDO" : "SIN_PAGO";
    const fechaVencimiento = cuota?.fechaVencimiento;
    const milisegundosRestantes = fechaVencimiento ? fechaVencimiento.getTime() - ahora.getTime() : null;
    return {
      ...fraterno.toObject(),
      situacion: fraterno.estado,
      ocupaCupo: fraterno.estado === "ACTIVO" && !cuota?.cupoLiberado,
      estadoPago,
      cuota: cuota?.toObject() ?? null,
      pagos: pagos.map(p => p.toObject()),
      plazo: { fechaInicio: cuota?.fechaInicioPlazo, fechaVencimiento, horasRestantes: milisegundosRestantes === null ? null : Math.max(0, Math.ceil(milisegundosRestantes / 3600000)), prorrogaActiva },
      terminos: {
        estado: estadoTerminos,
        versionVigente: configuracion?.versionTerminos ?? null,
        versionAceptada: ultimaAceptacion?.versionTerminos ?? null,
        fechaAceptacion: ultimaAceptacion?.fechaAceptacion ?? null,
        contenidoAceptado: ultimaAceptacion?.contenidoTerminos ?? (ultimaAceptacion?.versionTerminos === configuracion?.versionTerminos ? configuracion?.terminos : null),
        ip: ultimaAceptacion?.ip,
        userAgent: ultimaAceptacion?.userAgent,
        historial: aceptaciones.map(a => ({ version: a.versionTerminos, fechaAceptacion: a.fechaAceptacion })),
      },
    };
  }));
  res.json({ fraternos: enriquecidos });
}

export async function enviarAListaEspera(req: Request, res: Response) {
  const motivo = String(req.body.motivo ?? "").trim();
  if (motivo.length < 3 || motivo.length > 500) return res.status(400).json({ error: "Debe indicar un motivo válido" });
  const fraterno = await Fraterno.findOne({ _id: req.params.id, fechaEliminado: null });
  if (!fraterno) return res.status(404).json({ error: "Fraterno no encontrado" });
  if (fraterno.estado === "LISTA_ESPERA") return res.status(409).json({ error: "El fraterno ya está en lista de espera" });
  const estadoAnterior = fraterno.estado;
  fraterno.estado = "LISTA_ESPERA"; fraterno.fechaEditado = new Date(); fraterno.usuarioEditor = req.usuario?._id; await fraterno.save();
  const cuota = await Cuota.findOneAndUpdate({ preregistroId: fraterno.preregistroId, fechaEliminado: null }, { $set: { cupoLiberado: true, fechaLiberacionCupo: new Date(), observacion: `Cupo liberado por lista de espera: ${motivo}`, fechaEditado: new Date(), usuarioEditor: req.usuario?._id } }, { new: true });
  await Preregistro.findByIdAndUpdate(fraterno.preregistroId, { $set: { estado: "LISTA_ESPERA", aprobado: false, observacion: motivo, fechaEditado: new Date(), usuarioEditor: req.usuario?._id } });
  await registrarAuditoria(req, { accion: "MOVER_LISTA_ESPERA", modulo: "FRATERNOS", entidad: "Fraterno", entidadId: fraterno._id, descripcion: `${fraterno.numeroFraterno} pasó de ${estadoAnterior} a LISTA_ESPERA. Motivo: ${motivo}`, datosAntes: { estado: estadoAnterior }, datosDespues: { estado: fraterno.estado, ocupaCupo: false, cuotaId: cuota?._id } });
  return res.json({ message: "Fraterno enviado a lista de espera y cupo liberado", fraterno });
}

export async function miFraternidad(req: Request, res: Response) {
  const fraterno = await Fraterno.findOne({ usuarioId: req.usuario?._id, estado: "ACTIVO", fechaEliminado: null })
    .populate(poblar).sort({ fechaIngreso: -1 });
  if (!fraterno) return res.status(404).json({ error: "Aún no eres fraterno o tu cuota no está pagada completamente" });
  return res.json({ fraterno });
}

export async function miBloqueYPosicion(req: Request, res: Response) {
  const fraterno = await Fraterno.findOne({ usuarioId: req.usuario?._id, estado: "ACTIVO", fechaEliminado: null }).populate(poblar).sort({ fechaIngreso: -1 });
  if (!fraterno) return res.status(404).json({ error: "Tu cuenta todavía no tiene un registro activo de fraterno" });
  const posicion = await DetalleBloque.findOne({ fraternoId: fraterno._id }).populate({
    path: "bloqueId",
    populate: [
      { path: "guiaId", populate: { path: "usuarioId", select: "nombres apellidoPaterno apellidoMaterno telefono" } },
      { path: "guiasIds", populate: { path: "usuarioId", select: "nombres apellidoPaterno apellidoMaterno telefono" } },
    ],
  });
  return res.json({ fraterno, posicion });
}
