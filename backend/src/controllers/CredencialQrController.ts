import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import PerfilUsuario from "../models/PerfilUsuario";
import Fraterno from "../models/Fraterno";
import TallaFraterno from "../models/TallaFraterno";
import Preregistro from "../models/Preregistro";
import Cuota from "../models/Cuota";
import DetalleCuota from "../models/DetalleCuota";
import { registrarAuditoria } from "../services/AuditoriaService";

const secreto = () => process.env.JWT_SECRET || "";

export async function miCredencialQr(req: Request, res: Response) {
  if (req.usuario?.estado !== "ACTIVO") return res.status(403).json({ error: "La cuenta debe estar activa para generar su credencial" });
  const versionQr = Number(req.usuario.credencialQrVersion ?? 0);
  const token = jwt.sign(
    { sub: String(req.usuario._id), tipo: "CREDENCIAL_QR", versionQr },
    secreto(),
    { noTimestamp: true, issuer: "tinkus-local" },
  );
  return res.json({ token, nombre: [req.usuario.nombres, req.usuario.apellidoPaterno, req.usuario.apellidoMaterno].filter(Boolean).join(" "), ci: req.usuario.ci, fotoPerfil: req.usuario.fotoPerfil, versionQr });
}

export async function verificarCredencialQr(req: Request, res: Response) {
  try {
    const payload = jwt.verify(String(req.body.token || ""), secreto(), { issuer: "tinkus-local" }) as jwt.JwtPayload;
    if (payload.tipo !== "CREDENCIAL_QR" || !payload.sub || !Number.isInteger(payload.versionQr)) return res.status(400).json({ error: "El QR no corresponde a una credencial válida" });
    const usuario = await PerfilUsuario.findOne({ _id: payload.sub, fechaEliminado: null }).select("nombres apellidoPaterno apellidoMaterno ci fotoPerfil email estado roles credencialQrVersion").populate("roles", "nombre codigo");
    if (!usuario) return res.status(404).json({ error: "El usuario del QR ya no existe" });
    if (Number(payload.versionQr) !== Number(usuario.credencialQrVersion ?? 0)) return res.status(409).json({ error: "Esta credencial QR fue revocada" });
    const fraterno = await Fraterno.findOne({ usuarioId: usuario._id, fechaEliminado: null }).sort({ fechaIngreso: -1 }).select("_id numeroFraterno estado");
    const talla = await TallaFraterno.findOne({ $or: [{ usuarioId: usuario._id }, ...(fraterno ? [{ fraternoId: fraterno._id }] : [])] }).select("tallaPolera tallaChamarra fechaActualizado");
    const preregistro = await Preregistro.findOne({ usuarioId: usuario._id, fechaEliminado: null }).sort({ fechaCreado: -1 }).select("_id numeroPreRegistro estado");
    const cuota = preregistro ? await Cuota.findOne({ preregistroId: preregistro._id, fechaEliminado: null }).select("_id primeraCuotaMonto montoTotal montoPagado saldo estado") : null;
    const pagos = cuota ? await DetalleCuota.find({ cuotaId: cuota._id, fechaEliminado: null }).select("numeroPago monto estadoRevision baucherImagen fechaPago").sort({ numeroPago: 1, fechaPago: 1 }).lean() : [];
    const primerPago = pagos.find((pago) => pago.estadoRevision === "VERIFICADO") ?? pagos[0];
    const pago = {
      tieneCuota: Boolean(cuota),
      envioBaucher: pagos.some((detalle) => Boolean(detalle.baucherImagen)),
      primeraCuotaVerificada: pagos.some((detalle) => detalle.estadoRevision === "VERIFICADO"),
      estadoPrimeraCuota: primerPago?.estadoRevision ?? "NO_ENVIADA",
      primeraCuotaMonto: cuota?.primeraCuotaMonto ?? null,
      montoPagado: cuota?.montoPagado ?? 0,
      saldo: cuota?.saldo ?? null,
      estadoCuota: cuota?.estado ?? null,
      numeroPreRegistro: preregistro?.numeroPreRegistro ?? null,
    };
    await registrarAuditoria(req, { accion: "ESCANEAR_QR", modulo: "CREDENCIALES", entidad: "PerfilUsuario", entidadId: usuario._id, descripcion: `Se verificó la identidad de ${usuario.ci}` });
    return res.json({ valida: usuario.estado === "ACTIVO", usuario: { _id: usuario._id, nombres: usuario.nombres, apellidoPaterno: usuario.apellidoPaterno, apellidoMaterno: usuario.apellidoMaterno, ci: usuario.ci, fotoPerfil: usuario.fotoPerfil, email: usuario.email, estado: usuario.estado, roles: usuario.roles }, fraterno, talla, pago });
  } catch {
    return res.status(400).json({ error: "QR inválido, alterado o vencido" });
  }
}
