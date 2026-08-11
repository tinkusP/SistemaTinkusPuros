import type { Request, Response } from "express";
import TallaFraterno from "../models/TallaFraterno";
import PrendaIndumentaria from "../models/PrendaIndumentaria";
import EntregaIndumentaria from "../models/EntregaIndumentaria";
import Fraterno from "../models/Fraterno";
import Cuota from "../models/Cuota";
import Gestion from "../models/Gestion";
import ConfiguracionPago from "../models/ConfiguracionPago";

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
  const [tallas, prendas, entregas, cuotas, configuracionTallas] = await Promise.all([
    TallaFraterno.find().populate({ path: "fraternoId", populate: { path: "usuarioId", select: "nombres apellidoPaterno apellidoMaterno ci" } }),
    PrendaIndumentaria.find().sort({ nombre: 1 }),
    EntregaIndumentaria.find().populate(poblarEntrega).sort({ fechaEntrega: -1 }),
    Cuota.find({ fechaEliminado: null }).select("preregistroId montoTotal montoPagado saldo estado"),
    gestion ? ConfiguracionPago.findOne({ gestionId: gestion._id }).select("registroTallasHabilitado fechaLimiteRegistroTallas") : null,
  ]);
  res.json({ tallas, prendas, entregas, cuotas, configuracionTallas: { habilitado: configuracionTallas?.registroTallasHabilitado === true, fechaLimite: configuracionTallas?.fechaLimiteRegistroTallas ?? null } });
};

export const miIndumentaria = async (req: Request, res: Response) => {
  const fraterno = await Fraterno.findOne({
    usuarioId: req.usuario?._id,
    fechaEliminado: null,
  }).sort({ fechaIngreso: -1 });

  if (!fraterno) {
    return res.json({ fraterno: null, talla: null, entregas: [] });
  }

  const gestion = await Gestion.findById(fraterno.gestionId);
  const [talla, entregas, configuracionTallas] = await Promise.all([
    TallaFraterno.findOne({ fraternoId: fraterno._id }),
    EntregaIndumentaria.find({ fraternoId: fraterno._id })
      .populate("prendaId")
      .sort({ fechaEntrega: -1 }),
    ConfiguracionPago.findOne({ gestionId: fraterno.gestionId }).select("registroTallasHabilitado fechaLimiteRegistroTallas"),
  ]);

  return res.json({ fraterno, talla, entregas, edicionTallasBloqueada: talla?.edicionBloqueada === true, configuracionTallas: { habilitado: configuracionTallas?.registroTallasHabilitado === true, fechaLimite: configuracionTallas?.fechaLimiteRegistroTallas ?? null, gestion: gestion?.nombre } });
};
export const guardarTalla = async (req: Request, res: Response) => { const talla = await TallaFraterno.findOneAndUpdate({ fraternoId: req.body.fraternoId }, { ...req.body, fechaActualizado: new Date(), usuarioEditor: req.usuario?._id }, { upsert: true, new: true, runValidators: true }); res.json({ message: "Tallas guardadas", talla }); };
export const guardarMiTalla = async (req: Request, res: Response) => {
  const fraterno = await Fraterno.findOne({ usuarioId: req.usuario?._id, estado: "ACTIVO", fechaEliminado: null }).sort({ fechaIngreso: -1 });
  if (!fraterno) return res.status(404).json({ error: "No existe un registro activo de fraterno" });
  const tallaActual = await TallaFraterno.findOne({ fraternoId: fraterno._id }).select("edicionBloqueada");
  if (tallaActual?.edicionBloqueada) return res.status(409).json({ error: "Administración bloqueó la edición de tus tallas. Solicita una nueva habilitación si necesitas corregirlas." });
  const configuracion = await ConfiguracionPago.findOne({ gestionId: fraterno.gestionId }).select("registroTallasHabilitado fechaLimiteRegistroTallas");
  if (!configuracion?.registroTallasHabilitado) return res.status(409).json({ error: "Administración todavía no habilitó el registro de tallas." });
  if (configuracion.fechaLimiteRegistroTallas && configuracion.fechaLimiteRegistroTallas < new Date()) return res.status(409).json({ error: "La fecha límite para modificar tallas ya terminó. Contacta a administración." });
  const talla = await TallaFraterno.findOneAndUpdate({ fraternoId: fraterno._id }, { tallaPolera: req.body.tallaPolera, tallaChamarra: req.body.tallaChamarra, fechaActualizado: new Date(), usuarioEditor: req.usuario?._id }, { upsert: true, new: true, runValidators: true });
  return res.json({ message: "Tus tallas fueron guardadas", talla, fechaLimite: configuracion.fechaLimiteRegistroTallas ?? null });
};
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
