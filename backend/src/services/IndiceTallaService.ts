import TallaFraterno from "../models/TallaFraterno";

type IndiceMongo = { name?: string; key?: Record<string, number>; unique?: boolean; partialFilterExpression?: Record<string, unknown> };

export const indiceFraternoOpcionalEsSeguro = (indice?: IndiceMongo) => Boolean(
  indice?.unique === true
  && indice.key?.fraternoId === 1
  && (indice.partialFilterExpression?.fraternoId as { $type?: string } | undefined)?.$type === "objectId",
);

let migracionEnCurso: Promise<void> | null = null;

export async function asegurarIndiceTallasOpcionales() {
  if (migracionEnCurso) return migracionEnCurso;
  migracionEnCurso = (async () => {
    const coleccion = TallaFraterno.collection;
    const indices = await coleccion.indexes() as IndiceMongo[];
    const actual = indices.find((indice) => indice.name === "fraternoId_1");
    if (indiceFraternoOpcionalEsSeguro(actual)) return;
    const duplicados = await coleccion.aggregate([
      { $match: { fraternoId: { $type: "objectId" } } },
      { $group: { _id: "$fraternoId", cantidad: { $sum: 1 } } },
      { $match: { cantidad: { $gt: 1 } } },
      { $limit: 1 },
    ]).toArray();
    if (duplicados.length) throw new Error("No se puede corregir el índice de tallas: existen fraternoId duplicados");
    if (actual) await coleccion.dropIndex("fraternoId_1");
    await coleccion.createIndex(
      { fraternoId: 1 },
      { unique: true, name: "fraternoId_1", partialFilterExpression: { fraternoId: { $type: "objectId" } } },
    );
  })().catch((error) => { migracionEnCurso = null; throw error; });
  return migracionEnCurso;
}
