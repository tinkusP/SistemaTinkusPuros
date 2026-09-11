import Bloque from "../models/Bloque";
import DetalleBloque from "../models/DetalleBloque";
import Fraterno from "../models/Fraterno";
import Gestion from "../models/Gestion";
import TallaFraterno from "../models/TallaFraterno";
import { FILTRO_ASIGNACION_ACTIVA } from "./AsignacionBloqueService";
import { idsGuiasDelBloque } from "./GuiaBloqueService";

const comparadorNatural = new Intl.Collator("es", { numeric: true, sensitivity: "base" });
export const normalizarMatriculaReporte = (valor: unknown) => String(valor ?? "").trim();
export const compararMatriculaNatural = (a: unknown, b: unknown) => comparadorNatural.compare(normalizarMatriculaReporte(a), normalizarMatriculaReporte(b));
const nombrePersona = (u: any) => [u?.apellidoPaterno, u?.apellidoMaterno, u?.nombres].filter(Boolean).join(" ").trim();

export function ordenarIntegrantesPorMatricula<T extends { matricula?: string; nombreCompleto: string }>(filas: T[]) {
  return [...filas].sort((a, b) => {
    const ma = normalizarMatriculaReporte(a.matricula), mb = normalizarMatriculaReporte(b.matricula);
    if (ma && mb) return compararMatriculaNatural(ma, mb) || comparadorNatural.compare(a.nombreCompleto, b.nombreCompleto);
    if (ma) return -1;
    if (mb) return 1;
    return comparadorNatural.compare(a.nombreCompleto, b.nombreCompleto);
  });
}

export async function obtenerReporteIntegrantesBloque(gestionId?: string) {
  const gestion: any = gestionId
    ? await Gestion.findOne({ _id: gestionId, fechaEliminado: null }).select("nombre anio").lean()
    : await Gestion.findOne({ estado: { $in: ["ACTIVA", "INSCRIPCIONES"] }, fechaEliminado: null }).sort({ anio: -1 }).select("nombre anio").lean();
  if (!gestion) return { gestion: null, generadoEn: new Date(), personas: [], resumen: { total: 0, conMatricula: 0, sinMatricula: 0, hombres: 0, mujeres: 0, bloques: 0, detalleBloques: [], inconsistencias: 0 } };
  const bloques: any[] = await Bloque.find({ gestionId: gestion._id, estado: "ACTIVO" })
    .populate({ path: "guiaId", populate: { path: "usuarioId", select: "nombres apellidoPaterno apellidoMaterno sexo" } })
    .populate({ path: "guiasIds", populate: { path: "usuarioId", select: "nombres apellidoPaterno apellidoMaterno sexo" } })
    .populate("gestionId", "nombre anio").sort({ nombre: 1 }).lean();
  const bloqueIds = bloques.map((b) => b._id);
  const detalles: any[] = await DetalleBloque.find({ bloqueId: { $in: bloqueIds }, ...FILTRO_ASIGNACION_ACTIVA }).sort({ fechaAsignacion: -1, _id: -1 }).lean();
  const fraternoIds = [...new Set(detalles.map((d) => String(d.fraternoId)))];
  const fraternos: any[] = await Fraterno.find({ _id: { $in: fraternoIds }, estado: "ACTIVO", fechaEliminado: null })
    .populate("usuarioId", "nombres apellidoPaterno apellidoMaterno ci sexo telefono facultad carrera registroUniversitario tipoFraterno estado")
    .select("usuarioId numeroFraterno gestionId estado").lean();
  const fraternoPorId = new Map(fraternos.map((f) => [String(f._id), f]));
  const usuarioIds = fraternos.map((f) => f.usuarioId?._id).filter(Boolean);
  const tallas: any[] = await TallaFraterno.find({ $or: [{ fraternoId: { $in: fraternos.map((f) => f._id) } }, { usuarioId: { $in: usuarioIds } }] }).lean();
  const tallaPorFraterno = new Map(tallas.filter((t) => t.fraternoId).map((t) => [String(t.fraternoId), t]));
  const tallaPorUsuario = new Map(tallas.filter((t) => t.usuarioId).map((t) => [String(t.usuarioId), t]));
  const bloquePorId = new Map(bloques.map((b) => [String(b._id), b]));
  const apariciones = new Map<string, number>();
  detalles.forEach((d) => apariciones.set(String(d.fraternoId), (apariciones.get(String(d.fraternoId)) ?? 0) + 1));
  const filas = detalles.flatMap((detalle) => {
    const fraterno = fraternoPorId.get(String(detalle.fraternoId));
    const bloque = bloquePorId.get(String(detalle.bloqueId));
    const usuario: any = fraterno?.usuarioId;
    if (!fraterno || !bloque || !usuario || usuario.estado !== "ACTIVO") return [];
    const guiasUnicos = idsGuiasDelBloque(bloque).map((id) => [...(bloque.guiasIds ?? []), bloque.guiaId].find((g: any) => String(g?._id ?? g) === String(id))).filter(Boolean);
    const nombresGuias = (sexo: string) => guiasUnicos.filter((g: any) => String(g.usuarioId?.sexo).toUpperCase() === sexo).map((g: any) => nombrePersona(g.usuarioId)).join(", ");
    const talla = tallaPorFraterno.get(String(fraterno._id)) ?? tallaPorUsuario.get(String(usuario._id));
    return [{
      usuarioId: String(usuario._id), fraternoId: String(fraterno._id), detalleBloqueId: String(detalle._id),
      matricula: normalizarMatriculaReporte(usuario.registroUniversitario), nombreCompleto: nombrePersona(usuario), ci: usuario.ci ?? "", sexo: usuario.sexo ?? "",
      telefono: usuario.telefono ?? "", facultad: usuario.facultad ?? "", carrera: usuario.carrera ?? "", numeroFraterno: fraterno.numeroFraterno ?? "",
      bloqueId: String(bloque._id), bloque: bloque.nombre, guiasHombres: nombresGuias("HOMBRE"), guiasMujeres: nombresGuias("MUJER"),
      tallaPolera: talla?.tallaPolera ?? "", tallaChamarra: talla?.tallaChamarra ?? "", condicion: usuario.tipoFraterno ?? "SIN REGISTRO",
      estado: fraterno.estado, observaciones: (apariciones.get(String(fraterno._id)) ?? 0) > 1 ? "INCONSISTENCIA: DOS BLOQUES ACTIVOS" : "",
    }];
  });
  const unicos = new Map<string, any>();
  for (const fila of ordenarIntegrantesPorMatricula(filas)) if (!unicos.has(fila.usuarioId)) unicos.set(fila.usuarioId, fila);
  const personas = [...unicos.values()];
  const resumenBloques = bloques.map((b) => ({ _id: String(b._id), nombre: b.nombre, total: personas.filter((p) => p.bloqueId === String(b._id)).length }));
  return {
    gestion, generadoEn: new Date(), personas,
    resumen: { total: personas.length, conMatricula: personas.filter((p) => p.matricula).length, sinMatricula: personas.filter((p) => !p.matricula).length, hombres: personas.filter((p) => p.sexo === "HOMBRE").length, mujeres: personas.filter((p) => p.sexo === "MUJER").length, bloques: resumenBloques.length, detalleBloques: resumenBloques, inconsistencias: personas.filter((p) => p.observaciones).length },
  };
}
