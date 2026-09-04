import mongoose from "mongoose";
import DetalleBloque from "../models/DetalleBloque";

// `$ne` mantiene visibles las relaciones heredadas que aún no poseen el campo
// `estado`; la migración las normaliza a ACTIVO antes de reconstruir el índice.
export const FILTRO_ASIGNACION_ACTIVA = { estado: { $ne: "INACTIVO" }, fechaEliminado: null } as const;

export const esIndiceFraternoBloque = (indice: { key?: Record<string, number> }) =>
  indice.key?.fraternoId === 1 && Object.keys(indice.key).length === 1;

export const esIndicePosicionFisica = (indice: { key?: Record<string, number> }) =>
  Boolean(indice.key && (Object.hasOwn(indice.key, "fila") || Object.hasOwn(indice.key, "columna")));

export const esIndiceAsignacionActivaCorrecto = (indice: { key?: Record<string, number>; unique?: boolean; partialFilterExpression?: Record<string, unknown> }) =>
  esIndiceFraternoBloque(indice) && indice.unique === true && indice.partialFilterExpression?.estado === "ACTIVO" && indice.partialFilterExpression?.fechaEliminado === null;

export async function asegurarIndiceAsignacionActiva() {
  const coleccion = mongoose.connection.collection("detalle_bloques");
  await coleccion.updateMany({ estado: { $exists: false } }, { $set: { estado: "ACTIVO" } });
  const indices = await coleccion.indexes();
  for (const indice of indices) {
    if (esIndicePosicionFisica(indice as { key?: Record<string, number> })) {
      await coleccion.dropIndex(indice.name!);
      continue;
    }
    if (esIndiceFraternoBloque(indice as { key?: Record<string, number> }) && !esIndiceAsignacionActivaCorrecto(indice as any)) await coleccion.dropIndex(indice.name!);
  }
  await coleccion.updateMany({}, { $unset: { fila: "", columna: "" } });
  const finales = await coleccion.indexes();
  if (!finales.some((indice) => esIndiceAsignacionActivaCorrecto(indice as any))) {
    await coleccion.createIndex(
      { fraternoId: 1 },
      { unique: true, name: "fraternoId_activo_1", partialFilterExpression: { estado: "ACTIVO", fechaEliminado: null } },
    );
  }
}

const poblacionGuias = {
  path: "guiasIds",
  populate: { path: "usuarioId", select: "nombres apellidoPaterno apellidoMaterno telefono sexo fotoPerfil" },
};

export async function obtenerAsignacionActivaValida(fraternoId: unknown) {
  const asignaciones: any[] = await DetalleBloque.find({ fraternoId, ...FILTRO_ASIGNACION_ACTIVA }).sort({ fechaAsignacion: -1, _id: -1 }).populate({
    path: "bloqueId",
    match: { estado: "ACTIVO" },
    select: "nombre estado guiaId guiasIds",
    populate: [poblacionGuias, { path: "guiaId", populate: { path: "usuarioId", select: "nombres apellidoPaterno apellidoMaterno telefono sexo fotoPerfil" } }],
  });
  const valida = asignaciones.find((asignacion) => asignacion.bloqueId);
  const invalidas = asignaciones.filter((asignacion) => !asignacion.bloqueId);
  if (invalidas.length) await DetalleBloque.updateMany({ _id: { $in: invalidas.map((item) => item._id) } }, { $set: { estado: "INACTIVO", fechaRetiro: new Date() } });
  return valida ?? null;
}

export function resumirAsignacion(asignacion: any) {
  if (!asignacion?.bloqueId) return null;
  const bloque = asignacion.bloqueId;
  const guias = [...(bloque.guiasIds ?? [])];
  if (bloque.guiaId && !guias.some((guia: any) => String(guia._id) === String(bloque.guiaId._id))) guias.unshift(bloque.guiaId);
  return {
    bloqueId: bloque._id,
    bloqueNombre: bloque.nombre,
    estado: asignacion.estado ?? "ACTIVO",
    fechaAsignacion: asignacion.fechaAsignacion ?? null,
    guias: guias.map((guia: any) => ({ _id: guia._id, usuarioId: guia.usuarioId })),
  };
}
