import type { Request, Response } from "express";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
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
import Fraterno from "../models/Fraterno";
import Gestion from "../models/Gestion";
import { usuarioEsAdministrador } from "../middleware/soloAdministracion";
import { reactivarCuotaPreregistroAprobado, sincronizarCuotaPreregistro } from "../services/SincronizacionCuotaService";
import { subirArchivoProcesado } from "../services/AlmacenamientoService";
import { montoCuotaActual, redondearMonto as redondear } from "../services/PlanPagosService";

const poblar = { path: "preregistroId", select: "numeroPreRegistro estado usuarioId gestionId", populate: [{ path: "usuarioId", select: "nombres apellidoPaterno apellidoMaterno ci email telefono fotoPerfil tipoOrigen" }, { path: "gestionId", select: "nombre anio" }] };
const esAdministrador = usuarioEsAdministrador;
const tienePermiso = (req: Request, ...permisos: string[]) => {
  const roles = req.usuario?.roles as unknown as { permisos?: string[] }[] | undefined;
  const asignados = new Set((roles ?? []).flatMap((rol) => rol.permisos ?? []).map((permiso) => permiso.toUpperCase()));
  return permisos.some((permiso) => asignados.has(permiso));
};
const rutaComprobante = (archivo?: Express.Multer.File) => (archivo as (Express.Multer.File & { rutaPublica?: string }) | undefined)?.rutaPublica;
async function obtenerGestionActualId() {
  const gestion = await Gestion.findOne({ estado: { $in: ["ACTIVA", "INSCRIPCIONES"] }, fechaEliminado: null }).sort({ anio: -1 }).select("_id").lean();
  return gestion?._id;
}
async function recalcular(cuotaId: string) { const cuota = await Cuota.findById(cuotaId); if (!cuota) return; const pagos = await DetalleCuota.aggregate([{ $match: { cuotaId: cuota._id, estadoRevision: "VERIFICADO", fechaEliminado: null } }, { $group: { _id: null, total: { $sum: "$monto" } } }]); cuota.montoPagado = pagos[0]?.total ?? 0; await cuota.save(); await promoverAFraternoSiCorresponde(cuotaId); }
async function programarSiguientePago(cuotaId: string) {
  const cuota = await Cuota.findById(cuotaId);
  if (!cuota || cuota.saldo <= 0 || !cuota.numeroCuotasElegidas || cuota.numeroCuotasElegidas === 1) return;
  const pagosVerificados = await DetalleCuota.countDocuments({ cuotaId: cuota._id, estadoRevision: "VERIFICADO", fechaEliminado: null });
  if (pagosVerificados >= cuota.numeroCuotasElegidas) return;
  const dias = 7;
  cuota.fechaVencimiento = new Date(Date.now() + dias * 24 * 60 * 60 * 1000);
  await cuota.save();
  const preregistro = await Preregistro.findById(cuota.preregistroId).select("usuarioId");
  if (preregistro?.usuarioId) await Notificacion.create({
    usuarioId: preregistro.usuarioId,
    titulo: `Cuota ${pagosVerificados + 1} habilitada`,
    mensaje: `Tu pago fue aprobado. Tienes ${dias} días para pagar la cuota ${pagosVerificados + 1}. Debes completar la totalidad para recibir la polera de preentrada y la chamarra.`,
    tipo: "ADVERTENCIA",
    enlace: "/mis-pagos",
  });
}
async function cuotaPerteneceAlUsuario(cuotaId: string, usuarioId: unknown) { const cuota = await Cuota.findOne({ _id: cuotaId, fechaEliminado: null }).populate<{ preregistroId: { usuarioId: { toString(): string } } }>("preregistroId", "usuarioId"); return cuota && String(cuota.preregistroId.usuarioId) === String(usuarioId); }
const MENSAJE_PREREGISTRO_OBSERVADO = "Tienes una observación pendiente en tu preregistro. Regularízala con Administración y espera su aprobación para acceder a la opción de pagos.";

async function validarPreregistroAprobado(cuota: { preregistroId: unknown }) {
  const referencia = cuota.preregistroId as { _id?: unknown } | null;
  const preregistroId = referencia && typeof referencia === "object" && "_id" in referencia ? referencia._id : cuota.preregistroId;
  const preregistro = await Preregistro.findOne({ _id: preregistroId, fechaEliminado: null }).select("estado aprobado observacion");
  if (!preregistro) return { permitido: false, estado: "NO_ENCONTRADO", mensaje: "No se encontró el preregistro asociado a esta cuota." };
  if (preregistro.estado === "APROBADO" && preregistro.aprobado) return { permitido: true, preregistro };
  const mensaje = preregistro.estado === "OBSERVADO"
    ? MENSAJE_PREREGISTRO_OBSERVADO
    : "Tu preregistro todavía no está aprobado. La opción de pagos se habilitará cuando Administración complete la aprobación.";
  return { permitido: false, estado: preregistro.estado, observacion: preregistro.observacion, mensaje };
}

async function pasarAListaEspera(cuota: InstanceType<typeof Cuota>, observacion = "Plazo vencido sin pago de primera cuota verificado") {
  if (await Fraterno.exists({ preregistroId: cuota.preregistroId, fechaEliminado: null })) return false;
  if (!cuota.cupoLiberado) cuota.fechaLiberacionCupo = new Date();
  cuota.cupoLiberado = true;
  cuota.estado = "VENCIDA";
  await cuota.save();
  await Preregistro.updateOne({ _id: cuota.preregistroId }, { $set: { estado: "LISTA_ESPERA", aprobado: false, observacion } });
  return true;
}

async function asegurarCuotaPostulante(usuarioId: unknown) {
  const preregistro = await Preregistro.findOne({ usuarioId, estado: "APROBADO", aprobado: true, fechaEliminado: null })
    .sort({ fechaAprobacion: -1, fechaRegistro: -1 });
  if (!preregistro) return null;
  const resultado = await sincronizarCuotaPreregistro(preregistro._id, { crearSiFalta: true });
  return resultado?.cuota ?? null;
}

export const crearCuota = async (req: Request, res: Response) => { try { const resultado = await sincronizarCuotaPreregistro(req.body.preregistroId, { crearSiFalta: true, permitirNoAprobado: true, usuarioCreador: req.usuario?._id, fechaVencimiento: req.body.fechaVencimiento ? new Date(req.body.fechaVencimiento) : undefined }); if (!resultado) return res.status(409).json({ error: "La cuota requiere un usuario activo y una configuración de pagos vigente" }); const cuota = resultado.cuota; await cuota.populate(poblar); await registrarAuditoria(req, { accion: resultado.creada ? "CREAR" : "SINCRONIZAR_TARIFA", modulo: "CUOTAS", entidad: "Cuota", entidadId: cuota._id, descripcion: resultado.creada ? `Se vinculó una cuota ${cuota.tipoOrigenTarifa} de Bs ${cuota.montoTotal}` : `Se sincronizó la cuota con la tarifa ${cuota.tipoOrigenTarifa} de Bs ${cuota.montoTotal}`, datosAntes: resultado.creada ? undefined : { tipoOrigenTarifa: resultado.tipoAnterior, montoTotal: resultado.montoAnterior }, datosDespues: cuota.toObject() }); return res.status(resultado.creada ? 201 : 200).json({ message: resultado.creada ? "Cuota vinculada correctamente" : "Cuota y tarifa sincronizadas", cuota }); } catch (e) { console.error(e); return res.status(500).json({ error: "No se pudo vincular o sincronizar la cuota" }); } };
export const listarCuotas = async (_req: Request, res: Response) => {
  const gestionId = await obtenerGestionActualId();
  if (!gestionId) return res.json({ cuotas: [] });
  const preregistrosActivos = await Preregistro.find({ gestionId, fechaEliminado: null })
    .populate({ path: "usuarioId", match: { fechaEliminado: null }, select: "_id" })
    .select("_id usuarioId")
    .lean();
  const preregistrosVisibles = preregistrosActivos.filter((preregistro) => preregistro.usuarioId).map((preregistro) => preregistro._id);
  const cuotas = await Cuota.find({ fechaEliminado: null, preregistroId: { $in: preregistrosVisibles } }).populate(poblar).sort({ fechaCreado: -1 }).lean();
  const pagos = await DetalleCuota.find({ cuotaId: { $in: cuotas.map((cuota) => cuota._id) }, fechaEliminado: null }).select("cuotaId estadoRevision monto baucherImagen fechaPago").lean();
  const resumenPorCuota = new Map<string, { cantidad: number; pendientes: number; montoPendiente: number; verificados: number; conBaucher: number; ultimoEnvio?: Date }>();
  for (const pago of pagos) {
    const llave = String(pago.cuotaId);
    const resumen = resumenPorCuota.get(llave) ?? { cantidad: 0, pendientes: 0, montoPendiente: 0, verificados: 0, conBaucher: 0 };
    resumen.cantidad += 1;
    if (pago.estadoRevision === "PENDIENTE") { resumen.pendientes += 1; resumen.montoPendiente += pago.monto; }
    if (pago.estadoRevision === "VERIFICADO") resumen.verificados += 1;
    if (pago.baucherImagen) resumen.conBaucher += 1;
    if (!resumen.ultimoEnvio || pago.fechaPago > resumen.ultimoEnvio) resumen.ultimoEnvio = pago.fechaPago;
    resumenPorCuota.set(llave, resumen);
  }
  res.json({ cuotas: cuotas.map((cuota) => ({ ...cuota, resumenPagos: resumenPorCuota.get(String(cuota._id)) ?? { cantidad: 0, pendientes: 0, montoPendiente: 0, verificados: 0, conBaucher: 0 } })) });
};
export const listarPagosAdmin = async (_req: Request, res: Response) => {
  const gestionId = await obtenerGestionActualId();
  if (!gestionId) return res.json({ pagos: [] });
  const preregistros = await Preregistro.find({ gestionId, fechaEliminado: null }).select("_id").lean();
  const cuotas = await Cuota.find({ preregistroId: { $in: preregistros.map((preregistro) => preregistro._id) }, fechaEliminado: null }).select("_id").lean();
  const pagos = await DetalleCuota.find({ cuotaId: { $in: cuotas.map((cuota) => cuota._id) }, fechaEliminado: null })
    .populate({ path: "cuotaId", select: "preregistroId tipoOrigenTarifa montoTotal montoPagado saldo", populate: { path: "preregistroId", select: "numeroPreRegistro usuarioId", populate: { path: "usuarioId", select: "nombres apellidoPaterno apellidoMaterno ci telefono" } } })
    .sort({ fechaCreado: -1 })
    .lean();
  return res.json({ pagos });
};
export const asignarQrSaldo = async (req: Request, res: Response) => {
  const idsEntrada = typeof req.body.cuotaIds === "string" ? JSON.parse(req.body.cuotaIds) : req.body.cuotaIds;
  const cuotaIds = Array.isArray(idsEntrada) ? [...new Set(idsEntrada.map(String))] : [];
  if (!req.file || !cuotaIds.length) return res.status(400).json({ error: "Selecciona una cuota y una imagen QR" });
  const cuotas = await Cuota.find({ _id: { $in: cuotaIds }, saldo: { $gt: 0 }, fechaEliminado: null });
  if (!cuotas.length) { await fs.rm(req.file.path, { force: true }); return res.status(404).json({ error: "No existen cuotas seleccionadas con saldo pendiente" }); }
  // Compatibilidad con la interfaz anterior: cuando se selecciona una sola
  // persona y aún no llega el campo monto, el QR cubre su saldo exacto.
  const montoIngresado = Number(req.body.monto);
  const monto = redondear(montoIngresado > 0 ? montoIngresado : cuotas.length === 1 ? cuotas[0].saldo : 0);
  if (!(monto > 0)) { await fs.rm(req.file.path, { force: true }); return res.status(400).json({ error: "Registra un importe válido para el QR especial" }); }
  if (cuotas.some((cuota) => monto > cuota.saldo)) { await fs.rm(req.file.path, { force: true }); return res.status(409).json({ error: `El importe del QR no puede superar el saldo pendiente de Bs ${Math.min(...cuotas.map((cuota) => cuota.saldo)).toFixed(2)}` }); }
  const carpeta = path.resolve(process.cwd(), "public", "uploads", "qr-pagos", "saldos");
  await fs.mkdir(carpeta, { recursive: true });
  const nombre = `QR_SALDO_${Date.now()}.webp`;
  const salida = path.join(carpeta, nombre);
  await sharp(req.file.path).rotate().resize({ width: 1400, height: 1400, fit: "inside", withoutEnlargement: true }).webp({ quality: 90 }).toFile(salida);
  await fs.rm(req.file.path, { force: true });
  const ruta = `/uploads/qr-pagos/saldos/${nombre}`;
  await subirArchivoProcesado(ruta, salida, "image/webp");
  await Cuota.updateMany({ _id: { $in: cuotas.map((cuota) => cuota._id) } }, { $set: { qrSaldoPersonal: ruta, montoQrSaldoPersonal: monto, fechaEditado: new Date(), usuarioEditor: req.usuario?._id } });
  await registrarAuditoria(req, { accion: "ASIGNAR_QR_SALDO", modulo: "CUOTAS", entidad: "Cuota", descripcion: `Se asignó un QR especial de Bs ${monto.toFixed(2)} a ${cuotas.length} cuota(s)`, datosDespues: { cuotaIds: cuotas.map((cuota) => cuota._id), monto, ruta } });
  return res.json({ message: `QR de Bs ${monto.toFixed(2)} asignado correctamente`, actualizadas: cuotas.length, ruta });
};
export const obtenerMiCuota = async (req: Request, res: Response) => {
  const preregistroVigente = await Preregistro.findOne({ usuarioId: req.usuario?._id, fechaEliminado: null }).select("_id estado aprobado observacion").sort({ fechaRegistro: -1 });
  if (preregistroVigente && (preregistroVigente.estado !== "APROBADO" || !preregistroVigente.aprobado)) {
    return res.status(423).json({
      error: preregistroVigente.estado === "OBSERVADO" ? MENSAJE_PREREGISTRO_OBSERVADO : "Tu preregistro todavía no está aprobado. La opción de pagos se habilitará después de la aprobación de Administración.",
      codigo: "PREREGISTRO_NO_APROBADO",
      estadoPreregistro: preregistroVigente.estado,
      observacion: preregistroVigente.observacion,
    });
  }
  // El perfil académico es la fuente vigente de la tarifa. Se sincroniza en
  // cada ingreso para reparar también cambios de origen hechos antes de que
  // existiera la vinculación automática (incluidos sus saldo y QR).
  let cuota = null;
  if (req.modoCapacitacion && preregistroVigente) {
    cuota = await Cuota.findOne({ preregistroId: preregistroVigente._id, fechaEliminado: null }).populate(poblar);
  } else if (preregistroVigente?.estado === "APROBADO" && preregistroVigente.aprobado) {
    const sincronizada = await reactivarCuotaPreregistroAprobado(preregistroVigente._id, req.usuario?._id);
    if (sincronizada) cuota = await Cuota.findById(sincronizada.cuota._id).populate(poblar);
  }
  if (!cuota && !req.modoCapacitacion) {
    const creada = await asegurarCuotaPostulante(req.usuario?._id);
    if (creada) cuota = await Cuota.findById(creada._id).populate(poblar);
  }
  if (!cuota) return res.status(404).json({ error: "Todavía no tienes una cuota asignada" });
  const pagos = await DetalleCuota.find({ cuotaId: cuota._id, fechaEliminado: null }).sort({ fechaPago: -1 });
  const tienePrimerPagoValido = pagos.some((p) => p.estadoRevision === "VERIFICADO");
  const tienePagoEnRevision = pagos.some((p) => p.estadoRevision === "PENDIENTE");
  let listaEspera = cuota.cupoLiberado;
  if (!req.modoCapacitacion && !tienePrimerPagoValido && !tienePagoEnRevision && cuota.fechaVencimiento && cuota.fechaVencimiento < new Date()) {
    await pasarAListaEspera(cuota);
    listaEspera = true;
  }
  const prorrogaActiva = listaEspera && Boolean(cuota.fechaVencimiento && cuota.fechaVencimiento > new Date());
  const plazoVencido = Boolean(cuota.fechaVencimiento && cuota.fechaVencimiento < new Date());
  const pagoSiguienteVencido = tienePrimerPagoValido && cuota.saldo > 0 && plazoVencido;
  const pagoHabilitado = cuota.saldo > 0 && Boolean(cuota.fechaInicioPlazo) && !plazoVencido && !tienePagoEnRevision;
  return res.json({ cuota, pagos, listaEspera, prorrogaActiva, pagoSiguienteVencido, plazoVencido, pagoHabilitado, numeroPagoActual: pagos.filter((p) => p.estadoRevision === "VERIFICADO").length + 1 });
};
export const elegirPlanCuotas = async (req: Request, res: Response) => {
  const numeroCuotas = Number(req.body.numeroCuotas);
  if (![1, 2, 3].includes(numeroCuotas)) return res.status(400).json({ error: "El plan debe ser de 1, 2 o 3 cuotas" });
  const cuota = await Cuota.findOne({ _id: req.params.id, fechaEliminado: null, estado: { $nin: ["PAGADA", "CANCELADA"] } });
  if (!cuota) return res.status(404).json({ error: "Cuota no encontrada" });
  if (!(await cuotaPerteneceAlUsuario(String(cuota._id), req.usuario?._id))) return res.status(403).json({ error: "No puedes modificar una cuota ajena" });
  const habilitacion = await validarPreregistroAprobado(cuota);
  if (!habilitacion.permitido) return res.status(423).json({ error: habilitacion.mensaje, codigo: "PREREGISTRO_NO_APROBADO", estadoPreregistro: habilitacion.estado, observacion: habilitacion.observacion });
  if (cuota.numeroCuotasElegidas) {
    if (cuota.numeroCuotasElegidas === numeroCuotas) return res.json({ message: `El plan de ${numeroCuotas} cuota(s) ya estaba confirmado`, cuota });
    return res.status(409).json({ error: "El plan de cuotas ya fue confirmado y no puede modificarse. Solicita el cambio a un administrador." });
  }
  cuota.numeroCuotasElegidas = numeroCuotas as 1 | 2 | 3;
  await cuota.save();
  await registrarAuditoria(req, { accion: "ELEGIR_PLAN", modulo: "CUOTAS", entidad: "Cuota", entidadId: cuota._id, descripcion: `El usuario eligió pagar en ${numeroCuotas} cuota(s)` });
  return res.json({ message: `Plan de ${numeroCuotas} cuota(s) guardado`, cuota });
};
export const editarPlanCuotasAdmin = async (req: Request, res: Response) => {
  const numeroCuotas = Number(req.body.numeroCuotas);
  if (![1, 2, 3].includes(numeroCuotas)) return res.status(400).json({ error: "El plan debe ser de 1, 2 o 3 cuotas" });
  const cuota = await Cuota.findOne({ _id: req.params.id, fechaEliminado: null, estado: { $nin: ["PAGADA", "CANCELADA"] } });
  if (!cuota) return res.status(404).json({ error: "Cuota editable no encontrada" });
  const pagosVerificados = await DetalleCuota.countDocuments({ cuotaId: cuota._id, estadoRevision: "VERIFICADO", fechaEliminado: null });
  if (numeroCuotas < pagosVerificados) return res.status(409).json({ error: `El plan no puede tener menos de ${pagosVerificados} pago(s) ya verificado(s)` });
  const anterior = cuota.numeroCuotasElegidas;
  cuota.numeroCuotasElegidas = numeroCuotas as 1 | 2 | 3;
  await cuota.save();
  await registrarAuditoria(req, { accion: "EDITAR_PLAN_ADMIN", modulo: "CUOTAS", entidad: "Cuota", entidadId: cuota._id, descripcion: `Administración cambió el plan de ${anterior ?? "sin definir"} a ${numeroCuotas} cuota(s)`, datosAntes: { numeroCuotasElegidas: anterior }, datosDespues: { numeroCuotasElegidas: numeroCuotas } });
  return res.json({ message: `Plan actualizado a ${numeroCuotas} cuota(s)`, cuota });
};
export const solicitarQrPago = async (req: Request, res: Response) => {
  const cuota = await Cuota.findOne({ _id: req.params.id, fechaEliminado: null }).populate<{ preregistroId: { numeroPreRegistro?: string; usuarioId?: { nombres?: string; apellidoPaterno?: string; ci?: string } } }>({ path: "preregistroId", select: "numeroPreRegistro usuarioId", populate: { path: "usuarioId", select: "nombres apellidoPaterno ci" } });
  if (!cuota) return res.status(404).json({ error: "Cuota no encontrada" });
  if (!(await cuotaPerteneceAlUsuario(String(cuota._id), req.usuario?._id))) return res.status(403).json({ error: "No puedes solicitar un QR para una cuota ajena" });
  const habilitacion = await validarPreregistroAprobado(cuota);
  if (!habilitacion.permitido) return res.status(423).json({ error: habilitacion.mensaje, codigo: "PREREGISTRO_NO_APROBADO", estadoPreregistro: habilitacion.estado, observacion: habilitacion.observacion });
  const numeroCuotas = Number(req.body.numeroCuotas || cuota.numeroCuotasElegidas);
  const numeroPago = Number(req.body.numeroPago);
  if (![1, 2, 3].includes(numeroCuotas) || numeroPago < 1 || numeroPago > numeroCuotas) return res.status(400).json({ error: "Plan o número de pago inválido" });
  const pagosVerificados = await DetalleCuota.countDocuments({ cuotaId: cuota._id, estadoRevision: "VERIFICADO", fechaEliminado: null });
  const montoSolicitado = montoCuotaActual(cuota.montoTotal, cuota.saldo, numeroCuotas, pagosVerificados);
  const roles = await Rol.find({ $or: [{ codigo: { $in: ["ADMINISTRADOR", "COORDINADOR", "CORDINADOR"] } }, { nombre: { $in: [/^administrador$/i, /^coordinador$/i, /^cordinador$/i] } }], estado: true, fechaEliminado: null }).select("_id");
  const destinatarios = await PerfilUsuario.find({ roles: { $in: roles.map((rol) => rol._id) }, estado: "ACTIVO", fechaEliminado: null }).select("_id");
  const usuario = cuota.preregistroId?.usuarioId;
  const nombre = [usuario?.nombres, usuario?.apellidoPaterno].filter(Boolean).join(" ") || "Un usuario";
  const titulo = "Solicitud de QR de pago";
  const mensaje = `${nombre}${usuario?.ci ? ` (CI ${usuario.ci})` : ""} necesita un QR por Bs ${montoSolicitado.toFixed(2)} para la cuota ${numeroPago} de su plan de ${numeroCuotas} pago(s), tarifa ${cuota.tipoOrigenTarifa ?? "sin clasificar"}.`;
  await Notificacion.insertMany(destinatarios.map((destinatario) => ({ usuarioId: destinatario._id, titulo, mensaje, tipo: "ADVERTENCIA", enlace: `/cuotas/${cuota._id}` })), { ordered: false });
  await registrarAuditoria(req, { accion: "SOLICITAR_QR", modulo: "CUOTAS", entidad: "Cuota", entidadId: cuota._id, descripcion: mensaje });
  return res.json({ message: destinatarios.length ? "Administración recibió tu solicitud de QR" : "La solicitud quedó registrada; no hay administradores activos para notificar" });
};
export const solicitarProrrogaPago = async (req: Request, res: Response) => {
  const cuota = await Cuota.findOne({ _id: req.params.id, fechaEliminado: null, saldo: { $gt: 0 } }).populate<{ preregistroId: { usuarioId?: { nombres?: string; apellidoPaterno?: string; ci?: string } } }>({ path: "preregistroId", select: "usuarioId", populate: { path: "usuarioId", select: "nombres apellidoPaterno ci" } });
  if (!cuota) return res.status(404).json({ error: "Cuota pendiente no encontrada" });
  if (!(await cuotaPerteneceAlUsuario(String(cuota._id), req.usuario?._id))) return res.status(403).json({ error: "No puedes solicitar plazo para una cuota ajena" });
  if (!cuota.fechaVencimiento || cuota.fechaVencimiento >= new Date()) return res.status(409).json({ error: "Tu plazo todavía está vigente" });
  cuota.fechaSolicitudProrroga = new Date(); await cuota.save();
  const roles = await Rol.find({ codigo: { $in: ["ADMINISTRADOR", "COORDINADOR", "CORDINADOR"] }, estado: true, fechaEliminado: null }).select("_id");
  const destinatarios = await PerfilUsuario.find({ roles: { $in: roles.map((r) => r._id) }, estado: "ACTIVO", fechaEliminado: null }).select("_id");
  const usuario = cuota.preregistroId.usuarioId; const nombre = [usuario?.nombres, usuario?.apellidoPaterno].filter(Boolean).join(" ") || "Un usuario";
  await Notificacion.insertMany(destinatarios.map((d) => ({ usuarioId: d._id, titulo: "Solicitud de nuevo plazo", mensaje: `${nombre}${usuario?.ci ? ` (CI ${usuario.ci})` : ""} solicita habilitación para continuar pagando su cuota.`, tipo: "ADVERTENCIA", enlace: `/cuotas/${cuota._id}` })), { ordered: false });
  return res.json({ message: "Administración recibió tu solicitud de un nuevo plazo" });
};
export const prorrogarPrimeraCuota = async (req: Request, res: Response) => {
  const cuota = await Cuota.findOne({ _id: req.params.id, fechaEliminado: null, estado: { $nin: ["PAGADA", "CANCELADA"] } });
  if (!cuota) return res.status(404).json({ error: "Cuota no encontrada" });
  const tienePrimerPago = Boolean(cuota.montoPagado > 0 || await DetalleCuota.exists({ cuotaId: cuota._id, estadoRevision: "VERIFICADO", fechaEliminado: null }));
  const horas = Number(req.body.horas);
  const motivo = String(req.body.motivo ?? "").trim();
  if (!tienePrimerPago) await pasarAListaEspera(cuota, `Cupo liberado. Prórroga administrativa de ${horas} horas: ${motivo}`);
  cuota.fechaVencimiento = new Date(Date.now() + horas * 3600000);
  cuota.fechaInicioPlazo = new Date();
  cuota.fechaProrroga = new Date();
  cuota.horasProrrogaAcumuladas = (cuota.horasProrrogaAcumuladas || 0) + horas;
  cuota.motivoProrroga = motivo;
  cuota.usuarioProrroga = req.usuario?._id;
  await cuota.save();
  const preregistro = await Preregistro.findById(cuota.preregistroId).select("usuarioId");
  if (preregistro?.usuarioId) await Notificacion.create({ usuarioId: preregistro.usuarioId, titulo: "Nuevo plazo para pagar", mensaje: tienePrimerPago ? `Administración habilitó ${horas} horas para que pagues tu siguiente cuota. Tu cupo como fraterno permanece protegido.` : `Administración habilitó ${horas} horas para tu primera cuota. Permaneces en lista de espera y este plazo no reserva un cupo.`, tipo: "ADVERTENCIA", enlace: "/mis-pagos" });
  await registrarAuditoria(req, { accion: "PRORROGAR_PRIMERA_CUOTA", modulo: "CUOTAS", entidad: "Cuota", entidadId: cuota._id, descripcion: `Se habilitó una prórroga de ${horas} horas sin restaurar el cupo. Motivo: ${motivo}` });
  return res.json({ message: tienePrimerPago ? `Siguiente cuota habilitada por ${horas} horas` : `Nuevo plazo de ${horas} horas habilitado; el usuario continúa en lista de espera`, cuota });
};
export const prorrogarCuotasVencidas = async (req: Request, res: Response) => {
  try {
    const horas = Number(req.body.horas); const motivo = String(req.body.motivo ?? "").trim(); const ahora = new Date();
    const vencimiento = new Date(ahora.getTime() + horas * 3600000);
    const cuotas = await Cuota.find({ saldo: { $gt: 0 }, fechaVencimiento: { $lt: ahora }, fechaEliminado: null, estado: { $nin: ["PAGADA", "CANCELADA"] } });
    let actualizadas = 0; const errores: string[] = [];
    for (const cuota of cuotas) {
      try {
        const tienePrimerPago = Boolean(await DetalleCuota.exists({ cuotaId: cuota._id, estadoRevision: "VERIFICADO", fechaEliminado: null }));
        const preregistro = await Preregistro.findById(cuota.preregistroId).select("usuarioId estado aprobado");
        const conservaAprobacion = preregistro?.estado === "APROBADO" && preregistro.aprobado;
        if (!tienePrimerPago && !conservaAprobacion) await pasarAListaEspera(cuota, `Cupo liberado. Habilitación general de ${horas} horas: ${motivo}`);
        await Cuota.updateOne({ _id: cuota._id }, { $set: { fechaInicioPlazo: ahora, fechaVencimiento: vencimiento, fechaProrroga: ahora, motivoProrroga: motivo, usuarioProrroga: req.usuario?._id, estado: cuota.montoPagado > 0 ? "PAGO_PARCIAL" : "PENDIENTE", fechaEditado: ahora, usuarioEditor: req.usuario?._id }, $inc: { horasProrrogaAcumuladas: horas } });
        actualizadas += 1;
        if (preregistro?.usuarioId) await Notificacion.create({ usuarioId: preregistro.usuarioId, titulo: "Plazo general de pago habilitado", mensaje: `Administración habilitó ${horas} horas para registrar tu próximo pago.`, tipo: "ADVERTENCIA", enlace: "/mis-pagos" }).catch((error) => console.error("No se pudo crear notificación de prórroga", error));
      } catch (error) {
        console.error(`No se pudo prorrogar la cuota ${cuota._id}`, error);
        errores.push(String(cuota._id));
      }
    }
    await registrarAuditoria(req, { accion: "PRORROGA_MASIVA", modulo: "CUOTAS", entidad: "Cuota", descripcion: `Se ampliaron ${actualizadas} de ${cuotas.length} cuotas vencidas por ${horas} horas. Motivo: ${motivo}`, datosDespues: { actualizadas, omitidas: errores.length } });
    const detalle = errores.length ? ` ${errores.length} registro(s) inconsistente(s) fueron omitidos sin detener el proceso.` : "";
    return res.json({ message: `${actualizadas} cuenta(s) vencida(s) fueron habilitadas.${detalle}`, actualizadas, omitidas: errores.length });
  } catch (error) {
    console.error("No se pudo ejecutar la prórroga masiva", error);
    return res.status(500).json({ error: "No se pudieron consultar las cuotas vencidas. Intente nuevamente." });
  }
};
export const detalleCuota = async (req: Request, res: Response) => { const cuota = await Cuota.findOne({ _id: req.params.id, fechaEliminado: null }).populate(poblar); if (!cuota) return res.status(404).json({ error: "Cuota no encontrada" }); const puedeConsultar = esAdministrador(req) || tienePermiso(req, "PAGOS_VER", "PAGOS_REVISAR", "VISTA_PAGOS"); const puedeVerEliminados = esAdministrador(req) || tienePermiso(req, "PAGOS_REVISAR"); if (!puedeConsultar && !(await cuotaPerteneceAlUsuario(String(cuota._id), req.usuario?._id))) return res.status(403).json({ error: "No puedes consultar una cuota que no te pertenece" }); const pagos = await DetalleCuota.find({ cuotaId: cuota._id, ...(puedeVerEliminados ? {} : { fechaEliminado: null }) }).populate("usuarioRevisor", "nombres apellidoPaterno").populate("usuarioEliminador", "nombres apellidoPaterno").sort({ fechaPago: -1 }); return res.json({ cuota, pagos }); };
export const validarPlazoAntesDeSubir = async (req: Request, res: Response, next: () => void) => {
  if (esAdministrador(req)) return next();
  const cuota = await Cuota.findOne({ _id: req.params.id, fechaEliminado: null });
  if (!cuota) return res.status(404).json({ error: "Cuota no encontrada" });
  if (!(await cuotaPerteneceAlUsuario(String(cuota._id), req.usuario?._id))) return res.status(403).json({ error: "No puedes registrar pagos en una cuota ajena" });
  const habilitacion = await validarPreregistroAprobado(cuota);
  if (!habilitacion.permitido) return res.status(423).json({ error: habilitacion.mensaje, codigo: "PREREGISTRO_NO_APROBADO", estadoPreregistro: habilitacion.estado, observacion: habilitacion.observacion });
  if (!cuota.fechaInicioPlazo || !cuota.fechaVencimiento) return res.status(409).json({ error: "Acepta los términos y condiciones para iniciar tu plazo de pago" });
  if (cuota.fechaVencimiento < new Date()) return res.status(409).json({ error: "El plazo venció. El QR y la carga de comprobantes están bloqueados hasta que administración te habilite nuevamente." });
  return next();
};
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

    if (!esAdministrador(req) && (!cuota.fechaInicioPlazo || !cuota.fechaVencimiento)) return res.status(409).json({ error: "Acepta los términos y condiciones para iniciar tu plazo de pago" });
    if (!esAdministrador(req) && cuota.fechaVencimiento! < new Date()) { if (cuota.montoPagado <= 0) await pasarAListaEspera(cuota, "Plazo vencido sin pago verificado"); return res.status(409).json({ error: cuota.montoPagado > 0 ? "El plazo de esta cuota venció. Solicita a administración una nueva habilitación antes de pagar." : "Tu plazo venció y pasaste a lista de espera. Solicita un nuevo plazo a administración." }); }
    const montoSolicitado = Number(req.body.monto);
    const pagoPendiente = await DetalleCuota.exists({ cuotaId: cuota._id, estadoRevision: "PENDIENTE", fechaEliminado: null });
    if (pagoPendiente) return res.status(409).json({ error: "Ya existe un pago pendiente de revisión" });
    if (!cuota.numeroCuotasElegidas) return res.status(409).json({ error: "Primero debes elegir si pagarás en 1, 2 o 3 cuotas" });
    const pagosVerificados = await DetalleCuota.countDocuments({ cuotaId: cuota._id, estadoRevision: "VERIFICADO", fechaEliminado: null });
    const montoEsperado = cuota.qrSaldoPersonal
      ? Math.min(cuota.montoQrSaldoPersonal ?? cuota.saldo, cuota.saldo)
      : montoCuotaActual(cuota.montoTotal, cuota.saldo, cuota.numeroCuotasElegidas, pagosVerificados);
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
  if (req.body.estadoRevision === "VERIFICADO" && antes.estadoRevision !== "VERIFICADO") {
    const cuotaActualizada = await Cuota.findById(req.params.id);
    if (cuotaActualizada?.qrSaldoPersonal && cuotaActualizada.montoQrSaldoPersonal && Math.abs(cuotaActualizada.montoQrSaldoPersonal - antes.monto) < 0.01) {
      cuotaActualizada.qrSaldoPersonal = undefined;
      cuotaActualizada.montoQrSaldoPersonal = undefined;
      await cuotaActualizada.save();
    }
  }
  if (req.body.estadoRevision === "VERIFICADO" && antes.estadoRevision !== "VERIFICADO") await programarSiguientePago(String(req.params.id));
  if (pago) await registrarAuditoria(req, { accion: "REVISAR_PAGO", modulo: "CUOTAS", entidad: "DetalleCuota", entidadId: pago._id, descripcion: `Pago marcado como ${pago.estadoRevision}`, datosAntes: antes, datosDespues: pago.toObject() });
  return res.json({ message: "Pago revisado", pago });
};
export const eliminarPago = async (req: Request, res: Response) => { const pago = await DetalleCuota.findOneAndUpdate({ _id: req.params.pagoId, cuotaId: req.params.id, fechaEliminado: null }, { fechaEliminado: new Date(), usuarioEliminador: req.usuario?._id }, { new: true }); if (!pago) return res.status(404).json({ error: "Pago no encontrado" }); await recalcular(String(req.params.id)); await registrarAuditoria(req, { accion: "ELIMINAR", modulo: "CUOTAS", entidad: "DetalleCuota", entidadId: pago._id, descripcion: "Se eliminó un detalle de cuota" }); return res.json({ message: "Pago eliminado" }); };
