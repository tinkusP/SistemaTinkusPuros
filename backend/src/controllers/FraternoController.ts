import type { Request, Response } from "express";
import Fraterno from "../models/Fraterno";
import DetalleBloque from "../models/DetalleBloque";

const poblar = [
  { path: "usuarioId", select: "nombres apellidoPaterno apellidoMaterno ci email fotoPerfil" },
  { path: "gestionId", select: "nombre anio" },
  { path: "preregistroId", select: "numeroPreRegistro estado" },
];

export async function listarFraternos(_req: Request, res: Response) {
  const fraternos = await Fraterno.find({ fechaEliminado: null }).populate(poblar).sort({ fechaIngreso: -1 });
  res.json({ fraternos });
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
