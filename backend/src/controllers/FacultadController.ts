import type { Request, Response } from "express";
import PerfilUsuario from "../models/PerfilUsuario";

const sinAcentos = (texto: string) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
function facultadNormalizada(tipoOrigen: string, facultad?: string) {
  if (tipoOrigen === "EXTERNO_NO_UMSA") return "NO PERTENECE A LA UMSA";
  const valor = sinAcentos(facultad || "");
  if (tipoOrigen === "INTERNO_UMSA" || /FCPN|CIENCIA(S)? PURA(S)?/.test(valor)) return "FACULTAD DE CIENCIAS PURAS Y NATURALES (FCPN)";
  if (!valor) return tipoOrigen === "EXTERNO" ? "NO ESPECIFICADA / EXTERNO" : "FACULTAD NO ESPECIFICADA";
  return valor;
}

export async function reporteFacultades(_req: Request, res: Response) {
  const perfiles = await PerfilUsuario.find({ fechaEliminado: null })
    .select("nombres apellidoPaterno apellidoMaterno ci email telefono estado tipoOrigen tipoFraterno registroUniversitario facultad carrera fotoPerfil")
    .sort({ apellidoPaterno: 1, nombres: 1 })
    .lean();
  const integrantes = perfiles.map((perfil) => ({ ...perfil, facultadOriginal: perfil.facultad || null, facultadNormalizada: facultadNormalizada(String(perfil.tipoOrigen), perfil.facultad) }));
  const mapa = new Map<string, number>();
  integrantes.forEach((perfil) => mapa.set(perfil.facultadNormalizada, (mapa.get(perfil.facultadNormalizada) || 0) + 1));
  const facultades = [...mapa.entries()].map(([facultad, total]) => ({ facultad, total })).sort((a, b) => b.total - a.total || a.facultad.localeCompare(b.facultad));
  return res.json({ total: integrantes.length, facultades, integrantes });
}
