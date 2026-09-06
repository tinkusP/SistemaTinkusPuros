import mongoose, { Types } from "mongoose";
import { connectDB } from "../config/db";

const CIS = ["1234567890"];
const LOTE = new Types.ObjectId("6a9caf459123776bc45e65ec");

async function ejecutar() {
  await connectDB();
  const db = mongoose.connection.db!;
  const respaldos = await db.collection("respaldos_eliminacion_usuarios").find({ loteId: LOTE }).toArray();
  const identificadores = new Set<string>();
  for (const respaldo of respaldos) {
    for (const documentos of Object.values(respaldo.colecciones ?? {}) as any[][]) {
      for (const documento of documentos ?? []) if (documento?._id) identificadores.add(String(documento._id));
    }
  }
  const objectIds = [...identificadores].filter(Types.ObjectId.isValid).map((id) => new Types.ObjectId(id));
  const camposId = ["_id", "usuarioId", "perfilUsuario", "perfilUsuarioId", "fraternoId", "preregistroId", "postulanteGuiaId", "guiaId", "guiasIds", "cuotaId", "utilizadoPor", "usuarioOrigenId", "usuarioDestinoId", "entidadId"];
  const restantes: Record<string, number> = {};
  const nombres = (await db.listCollections({}, { nameOnly: true }).toArray()).map(({ name }) => name).filter((name) => name !== "respaldos_eliminacion_usuarios");
  for (const name of nombres) {
    const total = await db.collection(name).countDocuments({ $or: [{ ci: { $in: CIS } }, ...camposId.map((campo) => ({ [campo]: { $in: objectIds } }))] });
    if (total) restantes[name] = total;
  }
  console.log(JSON.stringify({ lote: String(LOTE), respaldos: respaldos.length, idsAuditados: objectIds.length, registrosPropiosRestantes: restantes, correcto: Object.keys(restantes).length === 0 }));
}

ejecutar().then(() => mongoose.disconnect()).catch(async (error) => { console.error(error); await mongoose.disconnect(); process.exit(1); });
