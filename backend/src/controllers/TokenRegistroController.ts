import crypto from "node:crypto";
import type { Request, Response } from "express";
import type { ClientSession } from "mongoose";
import TokenRegistro from "../models/TokenRegistro";
import Gestion from "../models/Gestion";
import Preregistro from "../models/Preregistro";
import Cuota from "../models/Cuota";
import Fraterno from "../models/Fraterno";
import ConfiguracionPago from "../models/ConfiguracionPago";

const normalizar = (v: unknown) => String(v ?? "").trim().toUpperCase().replace(/\s+/g, "");
const codigoNuevo = () => `FRA-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

async function ocupacion(gestion: any) {
  const [tokensDisponibles, fraternos, tokensUtilizados] = await Promise.all([
    TokenRegistro.countDocuments({ gestionId: gestion._id, estado: "DISPONIBLE", fechaExpiracion: { $gt: new Date() } }),
    Fraterno.find({ gestionId: gestion._id, estado: "ACTIVO", fechaEliminado: null }).populate("usuarioId", "sexo").lean(),
    TokenRegistro.find({ gestionId: gestion._id, estado: "UTILIZADO", cuotaId: { $exists: true } }).select("cuotaId sexoCupo").lean(),
  ]);
  const cuotasReservadas = await Cuota.find({ _id: { $in: tokensUtilizados.map((t) => t.cuotaId) }, montoPagado: 0, cupoLiberado: { $ne: true }, $or: [{ fechaVencimiento: { $gt: new Date() } }, { fechaVencimiento: null }], fechaEliminado: null }).select("_id").lean();
  const idsReservados = new Set(cuotasReservadas.map((c) => String(c._id)));
  const reservasGenero = (sexo: string) => tokensUtilizados.filter((t) => t.sexoCupo === sexo && idsReservados.has(String(t.cuotaId))).length;
  const usados = (sexo: string) => fraternos.filter((f: any) => String(f.usuarioId?.sexo).toUpperCase() === sexo).length;
  const dato = (sexo: "HOMBRE" | "MUJER", maximo: number) => ({ usados: usados(sexo), reservados: reservasGenero(sexo), disponibles: Math.max(0, maximo - usados(sexo) - reservasGenero(sexo)), maximo });
  const usadosTotal = fraternos.length, reservadosTotal = tokensDisponibles + cuotasReservadas.length, maximoTotal = gestion.cupoMaximo;
  return { HOMBRE: dato("HOMBRE", gestion.cupoMaximoHombres), MUJER: dato("MUJER", gestion.cupoMaximoMujeres), TOTAL: { usados: usadosTotal, reservados: reservadosTotal, disponibles: Math.max(0, maximoTotal - usadosTotal - reservadosTotal), maximo: maximoTotal } };
}

export async function validarTokenPublico(req: Request, res: Response) {
  const token = await TokenRegistro.findOne({ codigo: normalizar(req.body.codigo) }).populate("gestionId", "nombre anio estado");
  if (!token || token.estado !== "DISPONIBLE") return res.status(404).json({ error: "El token no existe o ya fue utilizado" });
  if (token.fechaExpiracion <= new Date()) { token.estado = "VENCIDO"; await token.save(); return res.status(410).json({ error: "El token ha vencido y su cupo fue liberado" }); }
  return res.json({ valido: true, token: { codigo: token.codigo, gestion: token.gestionId, sexoCupo: token.sexoCupo, tipoTarifa: token.tipoTarifa, montoCuota: token.montoCuota, primeraCuota: token.primeraCuota, plazoPagoHoras: token.plazoPagoHoras } });
}

export async function generarToken(req: Request, res: Response) {
  try {
    const gestion = await Gestion.findOne({ _id: req.body.gestionId, estado: { $in: ["INSCRIPCIONES", "ACTIVA"] }, fechaEliminado: null });
    if (!gestion) return res.status(404).json({ error: "La gestión no está disponible" });
    const config = await ConfiguracionPago.findOne({ gestionId: gestion._id });
    if (!config) return res.status(409).json({ error: "Primero configura cupos, tarifas y plazos" });
    const cupos = await ocupacion(gestion);
    if (cupos.TOTAL.disponibles <= 0) return res.status(409).json({ error: "No quedan cupos disponibles en la gestión" });
    let codigo = codigoNuevo(); while (await TokenRegistro.exists({ codigo })) codigo = codigoNuevo();
    const vigenciaHoras = Math.min(Math.max(Number(req.body.vigenciaHoras) || config.vigenciaTokenHoras || 24, 1), 8760);
    const plazoPagoHoras = Math.min(Math.max(Number(req.body.plazoPagoHoras) || config.plazoPrimeraCuotaHoras || 72, 1), 8760);
    const token = await TokenRegistro.create({ codigo, gestionId: gestion._id, plazoPagoHoras, fechaExpiracion: new Date(Date.now() + vigenciaHoras * 3600000), generadoPor: req.usuario!._id, observacion: req.body.observacion });
    await token.populate([{ path: "gestionId", select: "nombre anio" }, { path: "generadoPor", select: "nombres apellidoPaterno apellidoMaterno" }]);
    return res.status(201).json({ message: "Token generado y cupo reservado", token, cupos: await ocupacion(gestion) });
  } catch (e) { console.error(e); return res.status(500).json({ error: "No se pudo generar el token" }); }
}

export async function listarTokens(req: Request, res: Response) {
  await TokenRegistro.updateMany({ estado: "DISPONIBLE", fechaExpiracion: { $lte: new Date() } }, { estado: "VENCIDO" });
  const filtro: any = {}; if (req.query.gestionId) filtro.gestionId = req.query.gestionId; if (req.query.estado) filtro.estado = req.query.estado;
  const tokens = await TokenRegistro.find(filtro).populate("gestionId", "nombre anio").populate("generadoPor utilizadoPor", "nombres apellidoPaterno apellidoMaterno ci email").populate("cuotaId").sort({ fechaCreado: -1 });
  return res.json({ tokens });
}

export async function anularToken(req: Request, res: Response) {
  const token = await TokenRegistro.findOneAndUpdate({ _id: req.params.id, estado: "DISPONIBLE" }, { estado: "ANULADO" }, { new: true });
  if (!token) return res.status(404).json({ error: "El token no está disponible" });
  return res.json({ message: "Token anulado y cupo liberado", token });
}

export async function obtenerConfiguracionTokens(_req: Request, res: Response) {
  const gestion = await Gestion.findOne({ estado: { $in: ["ACTIVA", "INSCRIPCIONES"] }, fechaEliminado: null }).sort({ anio: -1 });
  if (!gestion) return res.status(404).json({ error: "No existe gestión activa" });
  return res.json({ gestion, configuracion: await ConfiguracionPago.findOne({ gestionId: gestion._id }), cupos: await ocupacion(gestion) });
}

export async function obtenerConfiguracionPublica(_req: Request, res: Response) {
  const gestion = await Gestion.findOne({ estado: { $in: ["ACTIVA", "INSCRIPCIONES"] }, fechaEliminado: null }).sort({ anio: -1 });
  if (!gestion) return res.status(404).json({ error: "No existe gestión activa" });
  const configuracion = await ConfiguracionPago.findOne({ gestionId: gestion._id, activo: true }).select("requerirTokenRegistro");
  return res.json({ gestionId: gestion._id, requerirTokenRegistro: configuracion?.requerirTokenRegistro !== false });
}

export async function guardarConfiguracionTokens(req: Request, res: Response) {
  const gestion = await Gestion.findById(req.body.gestionId); if (!gestion) return res.status(404).json({ error: "Gestión no encontrada" });
  gestion.cupoMaximoHombres = Number(req.body.cupoMaximoHombres); gestion.cupoMaximoMujeres = Number(req.body.cupoMaximoMujeres); await gestion.save();
  const configuracion = await ConfiguracionPago.findOneAndUpdate({ gestionId: gestion._id }, { $set: { requerirTokenRegistro: req.body.requerirTokenRegistro !== false, tarifaInterno: Number(req.body.tarifaInterno), tarifaExterno: Number(req.body.tarifaExterno), primeraCuota: Number(req.body.primeraCuota), vigenciaTokenHoras: Number(req.body.vigenciaTokenHoras), plazoPrimeraCuotaHoras: Number(req.body.plazoPrimeraCuotaHoras), cantidadBloques: Number(req.body.cantidadBloques), fechaEditado: new Date(), usuarioEditor: req.usuario?._id, activo: true }, $setOnInsert: { terminos: "Al enviar un pago declaro que los datos y el comprobante son verdaderos.", versionTerminos: 1 } }, { upsert: true, new: true, setDefaultsOnInsert: true });
  return res.json({ message: "Cupos, tarifas y plazos actualizados", gestion, configuracion, cupos: await ocupacion(gestion) });
}

export async function consumirTokenRegistro(entrada: unknown, perfil: any, session: ClientSession) {
  const codigo = normalizar(entrada); if (!codigo) throw new Error("Debe ingresar el token de registro");
  const token = await TokenRegistro.findOne({ codigo, estado: "DISPONIBLE", fechaExpiracion: { $gt: new Date() } }).session(session);
  if (!token) throw new Error("El token no existe, venció o ya fue utilizado");
  const sexoSeleccionado = String(perfil.sexo).toUpperCase() as "HOMBRE" | "MUJER";
  const gestion = await Gestion.findById(token.gestionId).session(session);
  if (!gestion) throw new Error("La gestión del token ya no existe");
  const cuposActuales = await ocupacion(gestion);
  if (cuposActuales[sexoSeleccionado].disponibles <= 0) throw new Error(`Ya no quedan cupos para ${sexoSeleccionado.toLowerCase()}s`);
  token.sexoCupo = sexoSeleccionado;
  const esInterno = ["INTERNO", "INTERNO_UMSA"].includes(String(perfil.tipoOrigen));
  const configuracion = await ConfiguracionPago.findOne({ gestionId: token.gestionId }).session(session);
  if (!configuracion) throw new Error("Administración todavía no configuró las tarifas de esta gestión");
  if (!perfil.gestion.some((id: any) => String(id) === String(token.gestionId))) throw new Error("El token no corresponde a la gestión seleccionada");
  const preregistro = (await Preregistro.create([{ usuarioId: perfil._id, gestionId: token.gestionId, numeroPreRegistro: `TOK-${token.codigo}`, estado: "APROBADO", aceptoReglamento: true, aprobado: true, fechaAprobacion: new Date(), usuarioAprobador: token.generadoPor, usuarioCreador: token.generadoPor }], { session }))[0];
  const plazoPagoHoras = token.plazoPagoHoras || configuracion.plazoPrimeraCuotaHoras || 72; const primeraCuota = configuracion.primeraCuota || 300;
  const montoTotal = esInterno ? (configuracion.tarifaInterno || 770) : (configuracion.tarifaExterno || 850);
  const cuota = (await Cuota.create([{ preregistroId: preregistro._id, tipoOrigenTarifa: esInterno ? "INTERNO" : "EXTERNO", tarifaAplicada: montoTotal, montoTotal, primeraCuotaMonto: primeraCuota, montoPagado: 0, saldo: montoTotal, cupoLiberado: false, observacion: `Al dar de alta la cuenta comenzará el plazo de ${plazoPagoHoras} horas para pagar la primera cuota`, usuarioCreador: token.generadoPor }], { session }))[0];
  token.estado = "UTILIZADO"; token.utilizadoPor = perfil._id; token.fechaUtilizado = new Date(); token.preregistroId = preregistro._id; token.cuotaId = cuota._id; token.fraternoId = undefined; await token.save({ session });
  return { fechaVencimiento: undefined };
}
