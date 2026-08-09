import type { Request, Response } from "express";
import fs from "node:fs/promises";
import Cuota from "../models/Cuota";
import DetalleCuota from "../models/DetalleCuota";
import Preregistro from "../models/Preregistro";
import PerfilUsuario from "../models/PerfilUsuario";
import ConfiguracionPago from "../models/ConfiguracionPago";
import AceptacionTerminosPago from "../models/AceptacionTerminosPago";
import Rol from "../models/Rol";
import Notificacion from "../models/Notificacion";
import { registrarAuditoria } from "../services/AuditoriaService";
import { promoverAFraternoSiCorresponde } from "../services/FraternoService";

const poblar = { path: "preregistroId", select: "numeroPreRegistro estado usuarioId gestionId", populate: [{ path: "usuarioId", select: "nombres apellidoPaterno apellidoMaterno ci email telefono fotoPerfil" }, { path: "gestionId", select: "nombre anio" }] };
const esAdministrador = (req: Request) => (req.usuario?.roles as unknown as { codigo?: string; nombre?: string }[] | undefined)?.some((r) => [r.codigo, r.nombre].some((v) => String(v ?? "").toUpperCase() === "ADMINISTRADOR")) ?? false;
const rutaComprobante = (archivo?: Express.Multer.File) => (archivo as (Express.Multer.File & { rutaPublica?: string }) | undefined)?.rutaPublica;
async function recalcular(cuotaId: string) { const cuota = await Cuota.findById(cuotaId); if (!cuota) return; const pagos = await DetalleCuota.aggregate([{ $match: { cuotaId: cuota._id, estadoRevision: "VERIFICADO", fechaEliminado: null } }, { $group: { _id: null, total: { $sum: "$monto" } } }]); cuota.montoPagado = pagos[0]?.total ?? 0; await cuota.save(); await promoverAFraternoSiCorresponde(cuotaId); }
async function cuotaPerteneceAlUsuario(cuotaId: string, usuarioId: unknown) { const cuota = await Cuota.findOne({ _id: cuotaId, fechaEliminado: null }).populate<{ preregistroId: { usuarioId: { toString(): string } } }>("preregistroId", "usuarioId"); return cuota && String(cuota.preregistroId.usuarioId) === String(usuarioId); }
const redondear = (valor: number) => Number(valor.toFixed(2));
const montoCuotaActual = (montoTotal: number, saldo: number, numeroCuotas: number, pagosVerificados: number) => {
  if (numeroCuotas <= 1 || pagosVerificados >= numeroCuotas - 1) return redondear(saldo);
  return Math.min(redondear(montoTotal / numeroCuotas), redondear(saldo));
};

async function asegurarCuotaPostulante(usuarioId: unknown) {
  const preregistro = await Preregistro.findOne({ usuarioId, estado: "APROBADO", aprobado: true, fechaEliminado: null })
    .sort({ fechaAprobacion: -1, fechaRegistro: -1 });
  if (!preregistro) return null;
  const existente = await Cuota.findOne({ preregistroId: preregistro._id, fechaEliminado: null });
  if (existente) return existente;
  const [usuario, configuracion] = await Promise.all([
    PerfilUsuario.findOne({ _id: usuarioId, estado: "ACTIVO" }).select("tipoOrigen"),
    ConfiguracionPago.findOne({ gestionId: preregistro.gestionId, activo: true }),
  ]);
  if (!usuario || !configuracion) return null;
  const esExterno = ["EXTERNO", "EXTERNO_UMSA", "EXTERNO_NO_UMSA"].includes(String(usuario.tipoOrigen));
  const montoTotal = esExterno ? configuracion.tarifaExterno : configuracion.tarifaInterno;
  const plazoHoras = configuracion.plazoPrimeraCuotaHoras || 72;
  try {
    return await Cuota.create({
      preregistroId: preregistro._id,
      tipoOrigenTarifa: esExterno ? "EXTERNO" : "INTERNO",
      tarifaAplicada: montoTotal,
      montoTotal,
      primeraCuotaMonto: Math.min(configuracion.primeraCuota || 300, montoTotal),
      montoPagado: 0,
      saldo: montoTotal,
      fechaVencimiento: new Date(Date.now() + plazoHoras * 60 * 60 * 1000),
      observacion: `Cuota habilitada para cuenta anterior. Plazo inicial: ${plazoHoras} horas.`,
    });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) return Cuota.findOne({ preregistroId: preregistro._id, fechaEliminado: null });
    throw error;
  }
}

export const crearCuota = async (req: Request, res: Response) => { try { const preregistro = await Preregistro.findOne({ _id: req.body.preregistroId, fechaEliminado: null }); if (!preregistro) return res.status(404).json({ error: "Preregistro no encontrado" }); const montoTotal = Number(req.body.montoTotal); const cuota = await Cuota.create({ preregistroId: preregistro._id, montoTotal, saldo: montoTotal, fechaVencimiento: req.body.fechaVencimiento || undefined, observacion: req.body.observacion, usuarioCreador: req.usuario?._id }); await cuota.populate(poblar); await registrarAuditoria(req, { accion: "CREAR", modulo: "CUOTAS", entidad: "Cuota", entidadId: cuota._id, descripcion: `Se creó una cuota de Bs ${montoTotal}`, datosDespues: cuota.toObject() }); return res.status(201).json({ message: "Cuota creada", cuota }); } catch (e) { if ((e as { code?: number }).code === 11000) return res.status(409).json({ error: "El preregistro ya tiene una cuota" }); return res.status(500).json({ error: "No se pudo crear la cuota" }); } };
export const listarCuotas = async (_req: Request, res: Response) => res.json({ cuotas: await Cuota.find({ fechaEliminado: null }).populate(poblar).sort({ fechaCreado: -1 }) });
export const obtenerMiCuota = async (req: Request, res: Response) => {
  const preregistros = await Preregistro.find({ usuarioId: req.usuario?._id, fechaEliminado: null }).select("_id estado");
  let cuota = await Cuota.findOne({ preregistroId: { $in: preregistros.map((p) => p._id) }, fechaEliminado: null }).populate(poblar).sort({ fechaCreado: -1 });
  if (!cuota) {
    const creada = await asegurarCuotaPostulante(req.usuario?._id);
    if (creada) cuota = await Cuota.findById(creada._id).populate(poblar);
  }
  if (!cuota) return res.status(404).json({ error: "Todavía no tienes una cuota asignada" });
  const pagos = await DetalleCuota.find({ cuotaId: cuota._id, fechaEliminado: null }).sort({ fechaPago: -1 });
  const tienePrimerPagoValido = pagos.some((p) => p.estadoRevision === "VERIFICADO");
  const tienePagoEnRevision = pagos.some((p) => p.estadoRevision === "PENDIENTE");
  let listaEspera = false;
  if (!tienePrimerPagoValido && !tienePagoEnRevision && cuota.fechaVencimiento && cuota.fechaVencimiento < new Date()) {
    cuota.estado = "VENCIDA"; await cuota.save();
    await Preregistro.updateOne({ _id: cuota.preregistroId }, { $set: { estado: "LISTA_ESPERA", aprobado: false, observacion: "Plazo vencido sin pago de primera cuota verificado" } });
    listaEspera = true;
  }
  return res.json({ cuota, pagos, listaEspera });
};
export const elegirPlanCuotas = async (req: Request, res: Response) => {
  const numeroCuotas = Number(req.body.numeroCuotas);
  if (![1, 2, 3].includes(numeroCuotas)) return res.status(400).json({ error: "El plan debe ser de 1, 2 o 3 cuotas" });
  const cuota = await Cuota.findOne({ _id: req.params.id, fechaEliminado: null, estado: { $nin: ["PAGADA", "CANCELADA"] } });
  if (!cuota) return res.status(404).json({ error: "Cuota no encontrada" });
  if (!(await cuotaPerteneceAlUsuario(String(cuota._id), req.usuario?._id))) return res.status(403).json({ error: "No puedes modificar una cuota ajena" });
  const yaInicio = await DetalleCuota.exists({ cuotaId: cuota._id, estadoRevision: { $in: ["PENDIENTE", "VERIFICADO"] }, fechaEliminado: null });
  if (yaInicio && cuota.numeroCuotasElegidas && cuota.numeroCuotasElegidas !== numeroCuotas) return res.status(409).json({ error: "El plan de cuotas ya no puede cambiarse porque existe un pago enviado o aprobado" });
  cuota.numeroCuotasElegidas = numeroCuotas as 1 | 2 | 3;
  await cuota.save();
  await registrarAuditoria(req, { accion: "ELEGIR_PLAN", modulo: "CUOTAS", entidad: "Cuota", entidadId: cuota._id, descripcion: `El usuario eligió pagar en ${numeroCuotas} cuota(s)` });
  return res.json({ message: `Plan de ${numeroCuotas} cuota(s) guardado`, cuota });
};
export const solicitarQrPago = async (req: Request, res: Response) => {
  const cuota = await Cuota.findOne({ _id: req.params.id, fechaEliminado: null }).populate<{ preregistroId: { numeroPreRegistro?: string; usuarioId?: { nombres?: string; apellidoPaterno?: string; ci?: string } } }>({ path: "preregistroId", select: "numeroPreRegistro usuarioId", populate: { path: "usuarioId", select: "nombres apellidoPaterno ci" } });
  if (!cuota) return res.status(404).json({ error: "Cuota no encontrada" });
  if (!(await cuotaPerteneceAlUsuario(String(cuota._id), req.usuario?._id))) return res.status(403).json({ error: "No puedes solicitar un QR para una cuota ajena" });
  const tipoQr = String(req.body.tipoQr ?? "").toUpperCase();
  if (!["TOTAL", "PRIMERA", "SEGUNDA"].includes(tipoQr)) return res.status(400).json({ error: "Tipo de QR inválido" });
  const roles = await Rol.find({ $or: [{ codigo: { $in: ["ADMINISTRADOR", "COORDINADOR", "CORDINADOR"] } }, { nombre: { $in: [/^administrador$/i, /^coordinador$/i, /^cordinador$/i] } }], estado: true, fechaEliminado: null }).select("_id");
  const destinatarios = await PerfilUsuario.find({ roles: { $in: roles.map((rol) => rol._id) }, estado: "ACTIVO", fechaEliminado: null }).select("_id");
  const usuario = cuota.preregistroId?.usuarioId;
  const nombre = [usuario?.nombres, usuario?.apellidoPaterno].filter(Boolean).join(" ") || "Un usuario";
  const titulo = "Solicitud de QR de pago";
  const mensaje = `${nombre}${usuario?.ci ? ` (CI ${usuario.ci})` : ""} necesita el QR ${tipoQr.toLowerCase()} para su cuota de Bs ${cuota.montoTotal.toFixed(2)}.`;
  await Notificacion.insertMany(destinatarios.map((destinatario) => ({ usuarioId: destinatario._id, titulo, mensaje, tipo: "ADVERTENCIA", enlace: "/tokens-registro" })), { ordered: false });
  await registrarAuditoria(req, { accion: "SOLICITAR_QR", modulo: "CUOTAS", entidad: "Cuota", entidadId: cuota._id, descripcion: mensaje });
  return res.json({ message: destinatarios.length ? "Administración recibió tu solicitud de QR" : "La solicitud quedó registrada; no hay administradores activos para notificar" });
};
export const detalleCuota = async (req: Request, res: Response) => { const cuota = await Cuota.findOne({ _id: req.params.id, fechaEliminado: null }).populate(poblar); if (!cuota) return res.status(404).json({ error: "Cuota no encontrada" }); if (!esAdministrador(req) && !(await cuotaPerteneceAlUsuario(String(cuota._id), req.usuario?._id))) return res.status(403).json({ error: "No puedes consultar una cuota que no te pertenece" }); const pagos = await DetalleCuota.find({ cuotaId: cuota._id, fechaEliminado: null }).populate("usuarioRevisor", "nombres apellidoPaterno").sort({ fechaPago: -1 }); return res.json({ cuota, pagos }); };
export const registrarPago = async (req: Request, res: Response) => {
  try {
    const metodoPago = String(req.body.metodoPago ?? "").toUpperCase();
    if (metodoPago !== "QR") return res.status(400).json({ error: "Los pagos de cuotas solo se registran mediante QR o depósito" });
    if (!req.file) return res.status(400).json({ error: "Debe adjuntar la imagen del comprobante QR o depósito" });
    const cuota = await Cuota.findOne({ _id: req.params.id, fechaEliminado: null, estado: { $ne: "CANCELADA" } });
    if (!cuota) { if (req.file) await fs.unlink(req.file.path).catch(() => undefined); return res.status(404).json({ error: "Cuota no encontrada" }); }
    if (!esAdministrador(req) && !(await cuotaPerteneceAlUsuario(String(cuota._id), req.usuario?._id))) { if (req.file) await fs.unlink(req.file.path).catch(() => undefined); return res.status(403).json({ error: "No puedes registrar pagos en una cuota ajena" }); }

    if (!esAdministrador(req)) {
      const preregistro = await Preregistro.findById(cuota.preregistroId).select("gestionId");
      const configuracion = preregistro ? await ConfiguracionPago.findOne({ gestionId: preregistro.gestionId, activo: true }) : null;
      const aceptacion = configuracion ? await AceptacionTerminosPago.exists({ usuarioId: req.usuario?._id, gestionId: preregistro!.gestionId, versionTerminos: configuracion.versionTerminos }) : null;
      if (!aceptacion) { if (req.file) await fs.unlink(req.file.path).catch(() => undefined); return res.status(409).json({ error: "Debes aceptar los términos y condiciones antes de registrar el pago" }); }
    }

    if (cuota.montoPagado <= 0 && cuota.fechaVencimiento && cuota.fechaVencimiento < new Date()) { await Preregistro.updateOne({ _id: cuota.preregistroId }, { $set: { estado: "LISTA_ESPERA", aprobado: false, observacion: "Plazo vencido sin pago verificado" } }); if (req.file) await fs.unlink(req.file.path).catch(() => undefined); return res.status(409).json({ error: "Tu plazo venció y pasaste a lista de espera" }); }
    const montoSolicitado = Number(req.body.monto);
    const pagoPendiente = await DetalleCuota.exists({ cuotaId: cuota._id, estadoRevision: "PENDIENTE", fechaEliminado: null });
    if (pagoPendiente) return res.status(409).json({ error: "Ya existe un pago pendiente de revisión" });
    if (!cuota.numeroCuotasElegidas) return res.status(409).json({ error: "Primero debes elegir si pagarás en 1, 2 o 3 cuotas" });
    const pagosVerificados = await DetalleCuota.countDocuments({ cuotaId: cuota._id, estadoRevision: "VERIFICADO", fechaEliminado: null });
    const montoEsperado = montoCuotaActual(cuota.montoTotal, cuota.saldo, cuota.numeroCuotasElegidas, pagosVerificados);
    if (Math.abs(montoEsperado - montoSolicitado) >= 0.01) return res.status(400).json({ error: `El monto de la cuota actual debe ser Bs ${montoEsperado.toFixed(2)}` });
    const numeroPago = await DetalleCuota.countDocuments({ cuotaId: cuota._id });
    const pago = await DetalleCuota.create({ cuotaId: cuota._id, numeroPago: numeroPago + 1, monto: montoSolicitado, metodoPago: "QR", montoEfectivo: 0, montoQr: montoSolicitado, baucherImagen: rutaComprobante(req.file), nombrePagador: req.body.nombrePagador, fechaPago: req.body.fechaPago, usuarioCreador: req.usuario?._id });
    await registrarAuditoria(req, { accion: "REGISTRAR_PAGO", modulo: "CUOTAS", entidad: "DetalleCuota", entidadId: pago._id, descripcion: `Se registró un pago ${metodoPago} pendiente de Bs ${pago.monto}`, datosDespues: pago.toObject() });
    return res.status(201).json({ message: "Pago registrado para revisión", pago });
  } catch (e) {
    if (req.file) await fs.unlink(req.file.path).catch(() => undefined);
    const mensaje = e instanceof Error ? e.message : "No se pudo registrar el pago";
    return res.status(400).json({ error: mensaje });
  }
};
export const revisarPago = async (req: Request, res: Response) => {
  if (["OBSERVADO", "RECHAZADO"].includes(req.body.estadoRevision) && !String(req.body.observacionRevision ?? "").trim()) {
    return res.status(400).json({ error: "Debe escribir el motivo de la observación o rechazo" });
  }
  const antes = await DetalleCuota.findOne({ _id: req.params.pagoId, cuotaId: req.params.id, fechaEliminado: null }).lean();
  if (!antes) {
    if (req.file) await fs.unlink(req.file.path).catch(() => undefined);
    return res.status(404).json({ error: "Pago no encontrado" });
  }
  const respaldo = rutaComprobante(req.file) || antes.respaldoAdminImagen;
  if (req.body.estadoRevision === "VERIFICADO" && antes.montoEfectivo > 0 && !respaldo && !String(req.body.observacionRevision ?? "").trim()) {
    return res.status(400).json({ error: "Para verificar efectivo debe adjuntar una foto de respaldo o escribir una observación" });
  }
  if (req.body.estadoRevision === "VERIFICADO" && antes.estadoRevision !== "VERIFICADO") {
    const cuota = await Cuota.findById(req.params.id);
    const otros = await DetalleCuota.aggregate([{ $match: { cuotaId: cuota?._id, _id: { $ne: antes._id }, estadoRevision: "VERIFICADO", fechaEliminado: null } }, { $group: { _id: null, total: { $sum: "$monto" } } }]);
    if (cuota && (otros[0]?.total ?? 0) + antes.monto > cuota.montoTotal) {
      return res.status(409).json({ error: `El pago supera el saldo disponible de Bs ${Math.max(0, cuota.montoTotal - (otros[0]?.total ?? 0)).toFixed(2)}` });
    }
  }
  const pago = await DetalleCuota.findByIdAndUpdate(antes._id, { $set: { estadoRevision: req.body.estadoRevision, observacionRevision: req.body.observacionRevision, respaldoAdminImagen: respaldo, fechaRevision: new Date(), usuarioRevisor: req.usuario?._id } }, { new: true, runValidators: true });
  await recalcular(String(req.params.id));
  if (pago) await registrarAuditoria(req, { accion: "REVISAR_PAGO", modulo: "CUOTAS", entidad: "DetalleCuota", entidadId: pago._id, descripcion: `Pago marcado como ${pago.estadoRevision}`, datosAntes: antes, datosDespues: pago.toObject() });
  return res.json({ message: "Pago revisado", pago });
};
export const eliminarPago = async (req: Request, res: Response) => { const pago = await DetalleCuota.findOneAndUpdate({ _id: req.params.pagoId, cuotaId: req.params.id, fechaEliminado: null }, { fechaEliminado: new Date(), usuarioEliminador: req.usuario?._id }, { new: true }); if (!pago) return res.status(404).json({ error: "Pago no encontrado" }); await recalcular(String(req.params.id)); await registrarAuditoria(req, { accion: "ELIMINAR", modulo: "CUOTAS", entidad: "DetalleCuota", entidadId: pago._id, descripcion: "Se eliminó un detalle de cuota" }); return res.json({ message: "Pago eliminado" }); };
