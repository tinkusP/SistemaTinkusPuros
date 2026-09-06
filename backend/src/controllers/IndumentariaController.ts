import type { Request, Response } from "express";
import TallaFraterno from "../models/TallaFraterno";
import PrendaIndumentaria from "../models/PrendaIndumentaria";
import EntregaIndumentaria from "../models/EntregaIndumentaria";
import Fraterno from "../models/Fraterno";
import Cuota from "../models/Cuota";
import Gestion from "../models/Gestion";
import ConfiguracionPago from "../models/ConfiguracionPago";
import Preregistro from "../models/Preregistro";
import DetalleCuota from "../models/DetalleCuota";
import { normalizarGeneroBloque } from "../services/BloqueService";
import { listarUsuariosIndumentaria } from "../services/IndumentariaUsuariosService";
import PerfilUsuario from "../models/PerfilUsuario";
import { registrarAuditoria } from "../services/AuditoriaService";
import { normalizarTallaAdministrativa, TALLA_SIN_REGISTRAR } from "../constants/tallas";

const poblarEntrega = [{ path: "fraternoId", populate: { path: "usuarioId", select: "nombres apellidoPaterno apellidoMaterno ci" } }, { path: "prendaId" }];
const asegurarPrendasPrincipales = async (usuarioCreador?: unknown) => {
  await Promise.all(["POLERA", "CHAMARRA"].map((nombre) =>
    PrendaIndumentaria.findOneAndUpdate(
      { nombre },
      { $setOnInsert: { nombre, requiereTalla: true, activo: true, usuarioCreador } },
      { upsert: true, new: true },
    ),
  ));
};

export const resumenIndumentaria = async (req: Request, res: Response) => {
  await asegurarPrendasPrincipales(req.usuario?._id);
  const gestion = await Gestion.findOne({ estado: { $in: ["ACTIVA", "INSCRIPCIONES"] }, fechaEliminado: null }).sort({ anio: -1 });
  const [tallas, prendas, entregas, cuotas, configuracionTallas, usuarios] = await Promise.all([
    TallaFraterno.find().populate("usuarioId", "nombres apellidoPaterno apellidoMaterno ci sexo").populate({ path: "fraternoId", populate: { path: "usuarioId", select: "nombres apellidoPaterno apellidoMaterno ci sexo" } }),
    PrendaIndumentaria.find().sort({ nombre: 1 }),
    EntregaIndumentaria.find().populate(poblarEntrega).sort({ fechaEntrega: -1 }),
    Cuota.find({ fechaEliminado: null }).select("preregistroId montoTotal montoPagado saldo estado"),
    gestion ? ConfiguracionPago.findOne({ gestionId: gestion._id }).select("registroTallasHabilitado fechaLimiteRegistroTallas") : null,
    listarUsuariosIndumentaria(),
  ]);
  const acumulado: Record<"POLERA" | "CHAMARRA", Record<"HOMBRE" | "MUJER", Map<string, number>>> = { POLERA: { HOMBRE: new Map(), MUJER: new Map() }, CHAMARRA: { HOMBRE: new Map(), MUJER: new Map() } };
  for (const registro of tallas as any[]) {
    const usuario = registro.fraternoId?.usuarioId ?? registro.usuarioId;
    const genero = normalizarGeneroBloque(usuario?.sexo);
    if (!genero) continue;
    for (const [prenda, talla] of [["POLERA", registro.tallaPolera], ["CHAMARRA", registro.tallaChamarra]] as const) {
      const valor = String(talla ?? "").trim().toUpperCase();
      if (!valor || valor === "SIN DEFINIR") continue;
      acumulado[prenda][genero].set(valor, (acumulado[prenda][genero].get(valor) ?? 0) + 1);
    }
  }
  const resumenTallas = Object.fromEntries((["POLERA", "CHAMARRA"] as const).map((prenda) => [prenda, Object.fromEntries((["HOMBRE", "MUJER"] as const).map((genero) => { const tallasOrdenadas = Array.from(acumulado[prenda][genero]).sort(([a], [b]) => a.localeCompare(b, "es", { numeric: true })); return [genero, { tallas: tallasOrdenadas.map(([talla, cantidad]) => ({ talla, cantidad })), total: tallasOrdenadas.reduce((suma, [, cantidad]) => suma + cantidad, 0) }]; }))]));
  const totalGeneral = (["POLERA", "CHAMARRA"] as const).reduce((total, prenda) => total + (["HOMBRE", "MUJER"] as const).reduce((subtotal, genero) => subtotal + Array.from(acumulado[prenda][genero].values()).reduce((suma, cantidad) => suma + cantidad, 0), 0), 0);
  res.json({ usuarios, tallas, prendas, entregas, cuotas, resumenTallas: { ...resumenTallas, totalGeneral }, configuracionTallas: { habilitado: configuracionTallas?.registroTallasHabilitado === true, fechaLimite: configuracionTallas?.fechaLimiteRegistroTallas ?? null } });
};

export const miIndumentaria = async (req: Request, res: Response) => {
  const preregistro = await Preregistro.findOne({ usuarioId: req.usuario?._id, fechaEliminado: null }).sort({ fechaCreado: -1 }).select("_id");
  const cuota = preregistro ? await Cuota.findOne({ preregistroId: preregistro._id, fechaEliminado: null }).select("_id primeraCuotaMonto montoPagado saldo estado") : null;
  const primerPago = cuota ? await DetalleCuota.findOne({ cuotaId: cuota._id, fechaEliminado: null }).sort({ numeroPago: 1, fechaPago: 1 }).select("estadoRevision baucherImagen") : null;
  const pagoVerificado = cuota ? await DetalleCuota.findOne({ cuotaId: cuota._id, estadoRevision: "VERIFICADO", fechaEliminado: null }).sort({ numeroPago: 1, fechaPago: 1 }).select("estadoRevision baucherImagen") : null;
  const pago = { tieneCuota: Boolean(cuota), envioBaucher: Boolean(primerPago?.baucherImagen), primeraCuotaVerificada: Boolean(pagoVerificado), estadoPrimeraCuota: pagoVerificado?.estadoRevision ?? primerPago?.estadoRevision ?? "NO_ENVIADA" };
  const fraterno = await Fraterno.findOne({
    usuarioId: req.usuario?._id,
    fechaEliminado: null,
  }).sort({ fechaIngreso: -1 });

  if (!fraterno) {
    const talla = await TallaFraterno.findOne({ usuarioId: req.usuario?._id });
    return res.json({ fraterno: null, talla, entregas: [], edicionTallasBloqueada: true, pago });
  }

  const gestion = await Gestion.findById(fraterno.gestionId);
  const [talla, entregas, configuracionTallas] = await Promise.all([
    TallaFraterno.findOne({ $or: [{ usuarioId: req.usuario?._id }, { fraternoId: fraterno._id }] }),
    EntregaIndumentaria.find({ fraternoId: fraterno._id })
      .populate("prendaId")
      .sort({ fechaEntrega: -1 }),
    ConfiguracionPago.findOne({ gestionId: fraterno.gestionId }).select("registroTallasHabilitado fechaLimiteRegistroTallas"),
  ]);

  return res.json({ fraterno, talla, entregas, edicionTallasBloqueada: talla?.edicionBloqueada === true, pago, configuracionTallas: { habilitado: configuracionTallas?.registroTallasHabilitado === true, fechaLimite: configuracionTallas?.fechaLimiteRegistroTallas ?? null, gestion: gestion?.nombre } });
};
export const guardarTalla = async (req: Request, res: Response) => { const talla = await TallaFraterno.findOneAndUpdate({ fraternoId: req.body.fraternoId }, { ...req.body, fechaActualizado: new Date(), usuarioEditor: req.usuario?._id }, { upsert: true, new: true, runValidators: true }); res.json({ message: "Tallas guardadas", talla }); };
export const guardarTallaUsuario = async (req: Request, res: Response) => {
  const usuario = await PerfilUsuario.findOne({ _id: req.body.usuarioId, fechaEliminado: null, estado: { $ne: "ELIMINADO" } }).select("_id ci");
  if (!usuario) return res.status(404).json({ error: "El usuario no existe o fue eliminado" });
  const fraterno = await Fraterno.findOne({ usuarioId: req.body.usuarioId, fechaEliminado: null }).sort({ fechaIngreso: -1 }).select("_id");
  const existente = await TallaFraterno.findOne({ $or: [{ usuarioId: req.body.usuarioId }, ...(fraterno ? [{ fraternoId: fraterno._id }] : [])] });
  const cambioPolera = req.body.tallaPolera !== undefined;
  const cambioChamarra = req.body.tallaChamarra !== undefined;
  const nuevaPolera = cambioPolera ? normalizarTallaAdministrativa(req.body.tallaPolera) : existente?.tallaPolera ?? TALLA_SIN_REGISTRAR;
  const nuevaChamarra = cambioChamarra ? normalizarTallaAdministrativa(req.body.tallaChamarra) : existente?.tallaChamarra ?? TALLA_SIN_REGISTRAR;
  if ((cambioPolera && !nuevaPolera) || (cambioChamarra && !nuevaChamarra)) return res.status(400).json({ error: "La talla seleccionada no es válida" });
  const filtro = existente ? { _id: existente._id } : { usuarioId: req.body.usuarioId };
  const antes = { tallaPolera: existente?.tallaPolera ?? TALLA_SIN_REGISTRAR, tallaChamarra: existente?.tallaChamarra ?? TALLA_SIN_REGISTRAR };
  const talla = await TallaFraterno.findOneAndUpdate(
    filtro,
    { $set: { usuarioId: req.body.usuarioId, ...(fraterno ? { fraternoId: fraterno._id } : {}), tallaPolera: nuevaPolera, tallaChamarra: nuevaChamarra, fechaActualizado: new Date(), usuarioEditor: req.usuario?._id } },
    { upsert: true, new: true, runValidators: true },
  );
  const prenda = cambioPolera && cambioChamarra ? "POLERA_Y_CHAMARRA" : cambioPolera ? "POLERA" : "CHAMARRA";
  await registrarAuditoria(req, { accion: existente ? "ACTUALIZAR_TALLA_ADMIN" : "REGISTRAR_TALLA_ADMIN", modulo: "INDUMENTARIA", entidad: "TallaFraterno", entidadId: talla._id, descripcion: `Administración ${existente ? "actualizó" : "registró"} talla de ${prenda.toLowerCase()} del usuario CI ${usuario.ci}`, datosAntes: antes, datosDespues: { tallaPolera: talla.tallaPolera, tallaChamarra: talla.tallaChamarra, prenda } });
  const valor = prenda === "POLERA" ? talla.tallaPolera : prenda === "CHAMARRA" ? talla.tallaChamarra : null;
  const nombrePrenda = prenda === "POLERA_Y_CHAMARRA" ? "Tallas de polera y chamarra" : `Talla de ${prenda.toLowerCase()}`;
  return res.json({ message: valor === TALLA_SIN_REGISTRAR ? `${nombrePrenda} retirada correctamente` : `${nombrePrenda} ${existente ? "actualizada" : "registrada"} correctamente`, talla });
};
export const guardarMiTalla = async (_req: Request, res: Response) => res.status(403).json({ error: "Las tallas son registradas y corregidas únicamente por Administración. Puedes consultarlas desde tu perfil." });
export const configurarRegistroTallas = async (req: Request, res: Response) => {
  const gestion = await Gestion.findOne({ estado: { $in: ["ACTIVA", "INSCRIPCIONES"] }, fechaEliminado: null }).sort({ anio: -1 });
  if (!gestion) return res.status(404).json({ error: "No existe una gestión activa" });
  const habilitado = req.body.habilitado === true;
  const sinFechaLimite = req.body.sinFechaLimite === true;
  const fechaLimite = habilitado && !sinFechaLimite && req.body.fechaLimite ? new Date(req.body.fechaLimite) : null;
  if (fechaLimite && Number.isNaN(fechaLimite.getTime())) return res.status(400).json({ error: "La fecha límite no es válida" });
  if (fechaLimite && fechaLimite <= new Date()) return res.status(400).json({ error: "La fecha límite debe estar en el futuro" });
  const configuracion = await ConfiguracionPago.findOneAndUpdate(
    { gestionId: gestion._id },
    { $set: { registroTallasHabilitado: habilitado, fechaLimiteRegistroTallas: fechaLimite, fechaEditado: new Date(), usuarioEditor: req.usuario?._id } },
    { new: true },
  );
  if (!configuracion) return res.status(409).json({ error: "Primero configura los pagos de la gestión" });
  return res.json({ message: habilitado ? (sinFechaLimite ? "Registro de tallas habilitado sin fecha límite" : "Periodo de tallas habilitado") : "Registro de tallas cerrado", configuracionTallas: { habilitado, fechaLimite } });
};
export const cambiarBloqueoTalla = async (req: Request, res: Response) => {
  const fraterno = await Fraterno.findOne({ _id: req.params.fraternoId, fechaEliminado: null });
  if (!fraterno) return res.status(404).json({ error: "Fraterno no encontrado" });
  const talla = await TallaFraterno.findOneAndUpdate(
    { fraternoId: fraterno._id },
    {
      $set: {
        edicionBloqueada: req.body.bloqueada,
        fechaBloqueo: new Date(),
        usuarioBloqueo: req.usuario?._id,
        fechaActualizado: new Date(),
      },
      $setOnInsert: { tallaPolera: "SIN DEFINIR", tallaChamarra: "SIN DEFINIR" },
    },
    { upsert: true, new: true, runValidators: true },
  );
  return res.json({
    message: req.body.bloqueada ? "Edición de tallas bloqueada" : "Edición de tallas habilitada nuevamente",
    talla,
  });
};
export const crearPrenda = async (req: Request, res: Response) => { try { const prenda = await PrendaIndumentaria.create({ ...req.body, usuarioCreador: req.usuario?._id }); res.status(201).json({ message: "Prenda creada", prenda }); } catch { res.status(409).json({ error: "La prenda ya existe" }); } };
export const entregar = async (req: Request, res: Response) => { try { const fraterno = await Fraterno.findById(req.body.fraternoId).select("preregistroId"); if (!fraterno) return res.status(404).json({ error: "Fraterno no encontrado" }); const cuota = await Cuota.findOne({ preregistroId: fraterno.preregistroId, fechaEliminado: null }); if (!cuota || cuota.saldo > 0 || cuota.estado !== "PAGADA") return res.status(409).json({ error: `No se puede entregar la indumentaria hasta completar la cuota total${cuota ? `. Saldo pendiente: Bs ${cuota.saldo.toFixed(2)}` : ""}` }); const entrega = await EntregaIndumentaria.create({ ...req.body, responsableEntrega: req.usuario?._id }); await entrega.populate(poblarEntrega); res.status(201).json({ message: "Indumentaria entregada", entrega }); } catch (e) { if ((e as { code?: number }).code === 11000) return res.status(409).json({ error: "Esta prenda ya está entregada al fraterno" }); res.status(400).json({ error: e instanceof Error ? e.message : "No se pudo registrar la entrega" }); } };
export const cambiarEstadoEntrega = async (req: Request, res: Response) => { const estado = req.body.estado; const entrega = await EntregaIndumentaria.findByIdAndUpdate(req.params.id, { estado, observacion: req.body.observacion, ...(estado === "DEVUELTO" ? { fechaDevolucion: new Date(), responsableRecepcion: req.usuario?._id } : {}) }, { new: true, runValidators: true }).populate(poblarEntrega); if (!entrega) return res.status(404).json({ error: "Entrega no encontrada" }); res.json({ message: "Estado actualizado", entrega }); };
