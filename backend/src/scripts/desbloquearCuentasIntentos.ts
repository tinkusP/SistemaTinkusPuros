import "dotenv/config";
import mongoose from "mongoose";
import PerfilUsuario from "../models/PerfilUsuario";

async function ejecutar() {
  const uri = process.env.DATABASE_URL || process.env.MONGO_URI;
  if (!uri) throw new Error("Debe configurar DATABASE_URL o MONGO_URI");
  await mongoose.connect(uri);
  const filtro = {
    estado: { $ne: "ELIMINADO" },
    $or: [
      { intentosFallidos: { $gt: 0 } },
      { bloqueadoHasta: { $ne: null } },
    ],
  };
  const afectadas = await PerfilUsuario.countDocuments(filtro);
  const resultado = await PerfilUsuario.updateMany(filtro, {
    $set: { intentosFallidos: 0, bloqueadoHasta: null, fechaEdit: new Date() },
  });
  console.log(JSON.stringify({ afectadas, modificadas: resultado.modifiedCount }));
  await mongoose.disconnect();
}

ejecutar().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
