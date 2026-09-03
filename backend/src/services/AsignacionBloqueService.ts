import mongoose from "mongoose";

// `$ne` mantiene visibles las relaciones heredadas que aún no poseen el campo
// `estado`; la migración las normaliza a ACTIVO antes de reconstruir el índice.
export const FILTRO_ASIGNACION_ACTIVA = { estado: { $ne: "INACTIVO" }, fechaEliminado: null } as const;

export const esIndiceFraternoBloque = (indice: { key?: Record<string, number> }) =>
  indice.key?.fraternoId === 1 && Object.keys(indice.key).length === 1;

export async function asegurarIndiceAsignacionActiva() {
  const coleccion = mongoose.connection.collection("detalle_bloques");
  await coleccion.updateMany({ estado: { $exists: false } }, { $set: { estado: "ACTIVO" } });
  const indices = await coleccion.indexes();
  for (const indice of indices) {
    if (esIndiceFraternoBloque(indice as { key?: Record<string, number> }) && indice.name !== "fraternoId_activo_1") await coleccion.dropIndex(indice.name!);
  }
  if (!(await coleccion.indexExists("fraternoId_activo_1"))) {
    await coleccion.createIndex(
      { fraternoId: 1 },
      { unique: true, name: "fraternoId_activo_1", partialFilterExpression: { estado: "ACTIVO", fechaEliminado: null } },
    );
  }
}
