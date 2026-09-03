import mongoose from "mongoose";

export function esIndiceGuiaPrincipal(indice: { key?: Record<string, unknown> }) {
  const campos = Object.keys(indice.key ?? {});
  return campos.length === 1 && campos[0] === "guiaId";
}

export async function asegurarIndiceGuiaBloqueDisperso() {
  const coleccion = mongoose.connection.collection("bloques");
  const indice = (await coleccion.indexes()).find(esIndiceGuiaPrincipal);
  if (indice && indice.unique === true && indice.sparse === true) return false;
  if (indice?.name) await coleccion.dropIndex(indice.name);
  await coleccion.createIndex({ guiaId: 1 }, { unique: true, sparse: true, name: "guiaId_1" });
  return true;
}

export function esIndicePostulanteGuia(indice: { key?: Record<string, unknown> }) {
  const campos = Object.keys(indice.key ?? {});
  return campos.length === 1 && campos[0] === "postulanteGuiaId";
}

export async function asegurarIndicePostulanteGuiaDisperso() {
  const coleccion = mongoose.connection.collection("guias");
  const indice = (await coleccion.indexes()).find(esIndicePostulanteGuia);
  if (indice && indice.unique === true && indice.sparse === true) return false;
  if (indice?.name) await coleccion.dropIndex(indice.name);
  await coleccion.createIndex({ postulanteGuiaId: 1 }, { unique: true, sparse: true, name: "postulanteGuiaId_1" });
  return true;
}

export function esIndiceGuiasBloque(indice: { key?: Record<string, unknown> }) {
  const campos = Object.keys(indice.key ?? {});
  return campos.length === 1 && campos[0] === "guiasIds";
}

export async function asegurarIndiceGuiasBloqueParcial() {
  const coleccion = mongoose.connection.collection("bloques");
  const indice = (await coleccion.indexes()).find(esIndiceGuiasBloque);
  const filtro = indice?.partialFilterExpression as Record<string, unknown> | undefined;
  if (indice?.unique === true && Boolean(filtro?.["guiasIds.0"])) return false;
  if (indice?.name) await coleccion.dropIndex(indice.name);
  await coleccion.createIndex(
    { guiasIds: 1 },
    { unique: true, name: "guiasIds_1", partialFilterExpression: { "guiasIds.0": { $exists: true } } },
  );
  return true;
}
