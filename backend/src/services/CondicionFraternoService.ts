import Fraterno from "../models/Fraterno";
import Gestion from "../models/Gestion";

export type CondicionParticipacion = "NUEVO" | "ANTIGUO" | "REINCORPORADO" | "SIN_HISTORIAL";

export async function obtenerHistorialParticipacion(usuarioId: unknown, gestionActualId?: unknown) {
  const participaciones: any[] = await Fraterno.find({ usuarioId, fechaEliminado: null })
    .select("gestionId fechaIngreso estado")
    .populate("gestionId", "anio nombre fechaInicio")
    .lean();
  const ordenadas = participaciones
    .filter((item) => item.gestionId)
    .sort((a, b) => Number(a.gestionId.anio ?? 0) - Number(b.gestionId.anio ?? 0));
  if (!ordenadas.length) return { condicion: "SIN_HISTORIAL" as CondicionParticipacion, primeraGestion: null, gestiones: [], totalGestiones: 0 };
  const anios = [...new Set(ordenadas.map((item) => Number(item.gestionId.anio)).filter(Boolean))].sort((a, b) => a - b);
  const gestionActual = gestionActualId ? await Gestion.findById(gestionActualId).select("anio").lean() : null;
  const anioActual = Number(gestionActual?.anio ?? anios.at(-1));
  const anteriores = anios.filter((anio) => anio < anioActual);
  const reincorporado = anteriores.length > 0 && anios.some((anio, indice) => indice > 0 && anio - anios[indice - 1] > 1);
  const condicion: CondicionParticipacion = anteriores.length === 0 ? "NUEVO" : reincorporado ? "REINCORPORADO" : "ANTIGUO";
  return { condicion, primeraGestion: anios[0] ?? null, gestiones: anios, totalGestiones: anios.length };
}

export function clasificarPorAnios(aniosEntrada: number[], anioActual: number): CondicionParticipacion {
  const anios = [...new Set(aniosEntrada)].sort((a, b) => a - b);
  if (!anios.length) return "SIN_HISTORIAL";
  const anteriores = anios.filter((anio) => anio < anioActual);
  if (!anteriores.length) return "NUEVO";
  return anios.some((anio, indice) => indice > 0 && anio - anios[indice - 1] > 1) ? "REINCORPORADO" : "ANTIGUO";
}
