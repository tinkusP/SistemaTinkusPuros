import mongoose, { Types } from "mongoose";
import { connectDB } from "../config/db";

const LOTE = new Types.ObjectId("6a9caa15268a1c5bc94e8e80");
const CIS = ["81818181", "8444174123", "0987654321", "8963742"];
const CAMPOS = ["_id", "usuarioId", "perfilUsuario", "perfilUsuarioId", "fraternoId", "preregistroId", "postulanteGuiaId", "guiaId", "guiasIds", "cuotaId", "utilizadoPor", "usuarioOrigenId", "usuarioDestinoId", "entidadId"];

async function ejecutar() {
  await connectDB();
  const db = mongoose.connection.db!;
  const respaldos = await db.collection("respaldos_eliminacion_usuarios").find({ loteId: LOTE }).toArray();
  const valores = new Set<string>();
  for (const respaldo of respaldos) for (const documentos of Object.values(respaldo.colecciones ?? {}) as any[][]) for (const documento of documentos ?? []) if (documento?._id) valores.add(String(documento._id));
  const objectIds = [...valores].filter(Types.ObjectId.isValid).map((id) => new Types.ObjectId(id));
  const filtro = { $or: [{ ci: { $in: CIS } }, ...CAMPOS.map((campo) => ({ [campo]: { $in: objectIds } }))] };
  const conteos = Object.fromEntries(await Promise.all(["usuarios_sin_talla", "auditoria"].map(async (nombre) => [nombre, await db.collection(nombre).countDocuments(filtro)])));
  console.log(JSON.stringify({ modo: process.argv.includes("--execute") ? "EJECUCION" : "DRY_RUN", conteos }));
  if (!process.argv.includes("--execute")) return;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await db.collection("respaldos_eliminacion_usuarios").insertOne({ loteId: LOTE, creadoEn: new Date(), motivo: "Residuos exactos detectados en verificación posterior", residuos: conteos }, { session });
      for (const nombre of ["usuarios_sin_talla", "auditoria"]) await db.collection(nombre).deleteMany(filtro, { session });
    });
  } finally { await session.endSession(); }
}

ejecutar().then(() => mongoose.disconnect()).catch(async (error) => { console.error(error); await mongoose.disconnect(); process.exit(1); });
