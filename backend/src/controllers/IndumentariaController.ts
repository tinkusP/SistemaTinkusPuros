import type { Request, Response } from "express";
import TallaFraterno from "../models/TallaFraterno";
import PrendaIndumentaria from "../models/PrendaIndumentaria";
import EntregaIndumentaria from "../models/EntregaIndumentaria";
import Fraterno from "../models/Fraterno";
import Cuota from "../models/Cuota";

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
  const [tallas, prendas, entregas] = await Promise.all([
    TallaFraterno.find().populate({ path: "fraternoId", populate: { path: "usuarioId", select: "nombres apellidoPaterno apellidoMaterno ci" } }),
    PrendaIndumentaria.find().sort({ nombre: 1 }),
    EntregaIndumentaria.find().populate(poblarEntrega).sort({ fechaEntrega: -1 }),
  ]);
  res.json({ tallas, prendas, entregas });
};

export const miIndumentaria = async (req: Request, res: Response) => {
  const fraterno = await Fraterno.findOne({
    usuarioId: req.usuario?._id,
    fechaEliminado: null,
  }).sort({ fechaIngreso: -1 });

  if (!fraterno) {
    return res.json({ fraterno: null, talla: null, entregas: [] });
  }

  const [talla, entregas] = await Promise.all([
    TallaFraterno.findOne({ fraternoId: fraterno._id }),
    EntregaIndumentaria.find({ fraternoId: fraterno._id })
      .populate("prendaId")
      .sort({ fechaEntrega: -1 }),
  ]);

  return res.json({ fraterno, talla, entregas });
};
export const guardarTalla = async (req: Request, res: Response) => { const talla = await TallaFraterno.findOneAndUpdate({ fraternoId: req.body.fraternoId }, { ...req.body, fechaActualizado: new Date(), usuarioEditor: req.usuario?._id }, { upsert: true, new: true, runValidators: true }); res.json({ message: "Tallas guardadas", talla }); };
export const guardarMiTalla = async (req: Request, res: Response) => {
  const fraterno = await Fraterno.findOne({ usuarioId: req.usuario?._id, estado: "ACTIVO", fechaEliminado: null }).sort({ fechaIngreso: -1 });
  if (!fraterno) return res.status(404).json({ error: "No existe un registro activo de fraterno" });
  const cuota = await Cuota.findOne({ preregistroId: fraterno.preregistroId, fechaEliminado: null });
  if (cuota?.fechaVencimiento && cuota.fechaVencimiento < new Date()) return res.status(409).json({ error: "La fecha límite para modificar tallas ya terminó. Contacta a administración." });
  const talla = await TallaFraterno.findOneAndUpdate({ fraternoId: fraterno._id }, { tallaPolera: req.body.tallaPolera, tallaChamarra: req.body.tallaChamarra, fechaActualizado: new Date(), usuarioEditor: req.usuario?._id }, { upsert: true, new: true, runValidators: true });
  return res.json({ message: "Tus tallas fueron guardadas", talla, fechaLimite: cuota?.fechaVencimiento });
};
export const crearPrenda = async (req: Request, res: Response) => { try { const prenda = await PrendaIndumentaria.create({ ...req.body, usuarioCreador: req.usuario?._id }); res.status(201).json({ message: "Prenda creada", prenda }); } catch { res.status(409).json({ error: "La prenda ya existe" }); } };
export const entregar = async (req: Request, res: Response) => { try { const entrega = await EntregaIndumentaria.create({ ...req.body, responsableEntrega: req.usuario?._id }); await entrega.populate(poblarEntrega); res.status(201).json({ message: "Indumentaria entregada", entrega }); } catch (e) { if ((e as { code?: number }).code === 11000) return res.status(409).json({ error: "Esta prenda ya está entregada al fraterno" }); res.status(400).json({ error: "No se pudo registrar la entrega" }); } };
export const cambiarEstadoEntrega = async (req: Request, res: Response) => { const estado = req.body.estado; const entrega = await EntregaIndumentaria.findByIdAndUpdate(req.params.id, { estado, observacion: req.body.observacion, ...(estado === "DEVUELTO" ? { fechaDevolucion: new Date(), responsableRecepcion: req.usuario?._id } : {}) }, { new: true, runValidators: true }).populate(poblarEntrega); if (!entrega) return res.status(404).json({ error: "Entrega no encontrada" }); res.json({ message: "Estado actualizado", entrega }); };
