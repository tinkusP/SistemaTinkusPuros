import type { Request, Response } from "express";
import PerfilUsuario from "../models/PerfilUsuario";
import Fraterno from "../models/Fraterno";
import Guia from "../models/Guia";
import Bloque from "../models/Bloque";
import DetalleBloque from "../models/DetalleBloque";
import { FILTRO_ASIGNACION_ACTIVA } from "../services/AsignacionBloqueService";

const escaparRegex = (valor: string) => valor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export async function buscarUsuariosCapacitacion(req: Request, res: Response) {
  const tipo = String(req.query.tipo ?? "FRATERNO").toUpperCase();
  if (!["FRATERNO", "GUIA"].includes(tipo)) return res.status(400).json({ error: "Tipo de vista previa no válido" });
  const termino = String(req.query.buscar ?? "").trim();
  if (termino.length < 2) return res.json({ usuarios: [] });
  const regex = new RegExp(escaparRegex(termino), "i");
  const coincidenciasCodigo = tipo === "FRATERNO"
    ? await Fraterno.find({ numeroFraterno: regex, estado: "ACTIVO", fechaEliminado: null }).select("usuarioId").limit(30).lean()
    : [];
  const perfiles = await PerfilUsuario.find({
    fechaEliminado: null,
    estado: "ACTIVO",
    $or: [{ _id: { $in: coincidenciasCodigo.map((item) => item.usuarioId) } }, { ci: regex }, { nombres: regex }, { apellidoPaterno: regex }, { apellidoMaterno: regex }],
  }).select("nombres apellidoPaterno apellidoMaterno ci fotoPerfil telefono").limit(30).lean();
  const ids = perfiles.map((perfil) => perfil._id);
  const registros = tipo === "GUIA"
    ? await Guia.find({ usuarioId: { $in: ids }, estado: "ACTIVO" }).select("usuarioId").lean()
    : await Fraterno.find({ usuarioId: { $in: ids }, estado: "ACTIVO", fechaEliminado: null }).select("usuarioId numeroFraterno").lean();
  const permitidos = new Map(registros.map((registro) => [String(registro.usuarioId), registro] as const));
  const bloques = tipo === "GUIA"
    ? await Bloque.find({ $or: [{ guiaId: { $in: registros.map((r) => r._id) } }, { guiasIds: { $in: registros.map((r) => r._id) } }] }).select("nombre guiaId guiasIds").lean()
    : [];
  const asignaciones = tipo === "FRATERNO"
    ? await DetalleBloque.find({ fraternoId: { $in: registros.map((r) => r._id) }, ...FILTRO_ASIGNACION_ACTIVA }).select("fraternoId bloqueId").populate({ path: "bloqueId", match: { estado: "ACTIVO" }, select: "nombre" }).lean()
    : [];
  const usuarios = perfiles.filter((perfil) => permitidos.has(String(perfil._id))).map((perfil) => {
    const registro = permitidos.get(String(perfil._id)) as { _id: unknown; numeroFraterno?: string };
    const bloqueGuia = bloques.find((item) => String(item.guiaId) === String(registro._id) || item.guiasIds.some((id) => String(id) === String(registro._id)));
    const asignacion = asignaciones.find((item) => String(item.fraternoId) === String(registro._id));
    const bloqueFraterno = asignacion?.bloqueId as unknown as { nombre?: string } | undefined;
    return { ...perfil, tipo, codigo: registro.numeroFraterno ?? null, bloque: bloqueGuia?.nombre ?? bloqueFraterno?.nombre ?? null };
  });
  return res.json({ usuarios });
}
