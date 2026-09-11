import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import PerfilUsuario from "../models/PerfilUsuario";
import Fraterno from "../models/Fraterno";
import TallaFraterno from "../models/TallaFraterno";
import Preregistro from "../models/Preregistro";
import Cuota from "../models/Cuota";
import DetalleCuota from "../models/DetalleCuota";
import { registrarAuditoria } from "../services/AuditoriaService";
import { distribuirPlanPagos } from "../services/PlanPagosService";
import { tipoCredencialQr } from "../services/CapacitacionService";
import DetalleBloque from "../models/DetalleBloque";
import Bloque from "../models/Bloque";
import Guia from "../models/Guia";
import { FILTRO_ASIGNACION_ACTIVA } from "../services/AsignacionBloqueService";

const secreto = () => process.env.JWT_SECRET || "";

export async function miCredencialQr(req: Request, res: Response) {
  if (req.usuario?.estado !== "ACTIVO") return res.status(403).json({ error: "La cuenta debe estar activa para generar su credencial" });
  const versionQr = Number(req.usuario.credencialQrVersion ?? 0);
  const token = jwt.sign(
    { sub: String(req.usuario._id), tipo: tipoCredencialQr(Boolean(req.modoCapacitacion)), versionQr },
    secreto(),
    { noTimestamp: true, issuer: "tinkus-local" },
  );
  return res.json({ token, nombre: [req.usuario.nombres, req.usuario.apellidoPaterno, req.usuario.apellidoMaterno].filter(Boolean).join(" "), ci: req.usuario.ci, fotoPerfil: req.usuario.fotoPerfil, versionQr });
}

async function construirIdentidad(req: Request, usuario: any, metodo: "QR" | "BUSQUEDA_MANUAL") {
    const fraterno = await Fraterno.findOne({ usuarioId: usuario._id, fechaEliminado: null }).sort({ fechaIngreso: -1 }).select("_id numeroFraterno estado");
    const talla = await TallaFraterno.findOne({ $or: [{ usuarioId: usuario._id }, ...(fraterno ? [{ fraternoId: fraterno._id }] : [])] }).select("tallaPolera tallaChamarra fechaActualizado");
    const preregistro = await Preregistro.findOne({ usuarioId: usuario._id, fechaEliminado: null }).sort({ fechaCreado: -1 }).select("_id numeroPreRegistro estado");
    const cuota = preregistro ? await Cuota.findOne({ preregistroId: preregistro._id, fechaEliminado: null }).select("_id primeraCuotaMonto numeroCuotasElegidas montoTotal montoPagado saldo estado") : null;
    const pagos = cuota ? await DetalleCuota.find({ cuotaId: cuota._id, fechaEliminado: null }).select("numeroPago monto estadoRevision baucherImagen fechaPago").sort({ numeroPago: 1, fechaPago: 1 }).lean() : [];
    const primerPago = pagos.find((pago) => pago.numeroPago === 1) ?? pagos[0];
    const numeroCuotas = cuota ? Math.max(1, cuota.numeroCuotasElegidas ?? 1) : 0;
    const montosPlan = numeroCuotas ? distribuirPlanPagos(cuota!.montoTotal, numeroCuotas) : [];
    const detalleCuotas = montosPlan.map((montoProgramado, indice) => {
      const numero = indice + 1;
      const detalle = pagos.find((item) => item.numeroPago === numero);
      const estado = !detalle ? "PENDIENTE" : detalle.estadoRevision === "VERIFICADO" ? "PAGADO" : detalle.estadoRevision === "PENDIENTE" ? "EN_REVISION" : detalle.estadoRevision;
      return { numero, montoProgramado, montoRegistrado: detalle?.monto ?? 0, estado, fechaPago: detalle?.fechaPago ?? null };
    });
    const cuotasPagadas = detalleCuotas.filter((detalle) => detalle.estado === "PAGADO").length;
    const estadoGeneral = !cuota || cuota.montoPagado <= 0 ? "SIN_PAGOS" : cuota.saldo <= 0 || cuota.estado === "PAGADA" ? "PAGO_COMPLETO" : "PAGO_PARCIAL";
    const pago = {
      tieneCuota: Boolean(cuota),
      envioBaucher: pagos.some((detalle) => Boolean(detalle.baucherImagen)),
      primeraCuotaVerificada: primerPago?.estadoRevision === "VERIFICADO",
      estadoPrimeraCuota: primerPago?.estadoRevision ?? "NO_ENVIADA",
      primeraCuotaMonto: cuota?.primeraCuotaMonto ?? null,
      montoPagado: cuota?.montoPagado ?? 0,
      saldo: cuota?.saldo ?? null,
      estadoCuota: cuota?.estado ?? null,
      numeroPreRegistro: preregistro?.numeroPreRegistro ?? null,
      numeroCuotas,
      cuotasPagadas,
      estadoGeneral,
      detalleCuotas,
    };
    const asignacion = fraterno ? await DetalleBloque.findOne({ fraternoId: fraterno._id, ...FILTRO_ASIGNACION_ACTIVA }).populate({ path: "bloqueId", match: { estado: "ACTIVO" }, select: "nombre" }).lean() : null;
    const guia = await Guia.findOne({ usuarioId: usuario._id, estado: "ACTIVO" }).select("_id").lean();
    const bloqueGuia = guia ? await Bloque.findOne({ estado: "ACTIVO", $or: [{ guiaId: guia._id }, { guiasIds: guia._id }] }).select("nombre").lean() : null;
    const bloque = (asignacion?.bloqueId as any)?.nombre ?? bloqueGuia?.nombre ?? "SIN BLOQUE";
    await registrarAuditoria(req, { accion: metodo === "QR" ? "ESCANEAR_QR" : "IDENTIFICAR_MANUALMENTE", modulo: "CREDENCIALES", entidad: "PerfilUsuario", entidadId: usuario._id, descripcion: `Se verificó la identidad de ${usuario.ci} mediante ${metodo}` });
    return { valida: usuario.estado === "ACTIVO", metodoIdentificacion: metodo, usuario: { _id: usuario._id, nombres: usuario.nombres, apellidoPaterno: usuario.apellidoPaterno, apellidoMaterno: usuario.apellidoMaterno, ci: usuario.ci, registroUniversitario: usuario.registroUniversitario, fotoPerfil: usuario.fotoPerfil, email: usuario.email, estado: usuario.estado, roles: usuario.roles }, fraterno, bloque, talla, pago };
}

const seleccionarUsuario = (filtro: Record<string, unknown>) => PerfilUsuario.findOne({
  ...filtro,
  fechaEliminado: null,
  estado: { $ne: "ELIMINADO" },
}).select("nombres apellidoPaterno apellidoMaterno ci registroUniversitario fotoPerfil email estado roles credencialQrVersion").populate("roles", "nombre codigo");

const escaparRegex = (valor: string) => valor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function construirFiltroBusquedaIdentidad(termino: string, usuarioIdsFraternos: unknown[] = []) {
  const partes = termino.split(/\s+/).filter(Boolean).slice(0, 6);
  const porNombreCompleto = partes.map((parte) => {
    const regex = new RegExp(escaparRegex(parte), "i");
    return { $or: [{ nombres: regex }, { apellidoPaterno: regex }, { apellidoMaterno: regex }] };
  });
  return {
    fechaEliminado: null,
    estado: { $ne: "ELIMINADO" },
    $or: [
      { ci: termino },
      { registroUniversitario: new RegExp(`^${escaparRegex(termino)}$`, "i") },
      ...(porNombreCompleto.length ? [{ $and: porNombreCompleto }] : []),
      ...(usuarioIdsFraternos.length ? [{ _id: { $in: usuarioIdsFraternos } }] : []),
    ],
  };
}

export async function verificarCredencialQr(req: Request, res: Response) {
  try {
    const payload = jwt.verify(String(req.body.token || ""), secreto(), { issuer: "tinkus-local" }) as jwt.JwtPayload;
    if (payload.tipo !== "CREDENCIAL_QR" || !payload.sub || !Number.isInteger(payload.versionQr)) return res.status(400).json({ error: "El QR no corresponde a una credencial válida" });
    const usuario = await seleccionarUsuario({ _id: payload.sub });
    if (!usuario) return res.status(404).json({ error: "El usuario del QR ya no existe" });
    if (Number(payload.versionQr) !== Number(usuario.credencialQrVersion ?? 0)) return res.status(409).json({ error: "Esta credencial QR fue revocada" });
    return res.json(await construirIdentidad(req, usuario, "QR"));
  } catch {
    return res.status(400).json({ error: "QR inválido, alterado o vencido" });
  }
}

export async function buscarIdentidades(req: Request, res: Response) {
  const termino = String(req.query.q ?? "").trim();
  if (termino.length < 2) return res.status(400).json({ error: "Escribe al menos 2 caracteres" });
  const seguro = escaparRegex(termino);
  const regex = new RegExp(seguro, "i");
  const fraternos = await Fraterno.find({ numeroFraterno: regex, fechaEliminado: null }).select("usuarioId").limit(20).lean();
  const usuarios = await PerfilUsuario.find(construirFiltroBusquedaIdentidad(termino, fraternos.map((fraterno) => fraterno.usuarioId))).select("nombres apellidoPaterno apellidoMaterno ci registroUniversitario fotoPerfil roles").populate("roles", "nombre codigo").limit(20).lean();
  usuarios.sort((a, b) => Number(String(b.ci) === termino || String(b.registroUniversitario).toLocaleLowerCase() === termino.toLocaleLowerCase()) - Number(String(a.ci) === termino || String(a.registroUniversitario).toLocaleLowerCase() === termino.toLocaleLowerCase()) || [a.nombres, a.apellidoPaterno].join(" ").localeCompare([b.nombres, b.apellidoPaterno].join(" "), "es"));
  return res.json({ resultados: usuarios });
}

export async function identificarManualmente(req: Request, res: Response) {
  const usuario = await seleccionarUsuario({ _id: req.params.id });
  if (!usuario) return res.status(404).json({ error: "Usuario no encontrado" });
  const token = jwt.sign({ sub: String(usuario._id), tipo: tipoCredencialQr(Boolean(req.modoCapacitacion)), versionQr: Number(usuario.credencialQrVersion ?? 0) }, secreto(), { noTimestamp: true, issuer: "tinkus-local" });
  return res.json({ ...(await construirIdentidad(req, usuario, "BUSQUEDA_MANUAL")), token });
}
