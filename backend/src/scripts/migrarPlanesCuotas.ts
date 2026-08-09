import "dotenv/config";
import mongoose from "mongoose";
import Cuota from "../models/Cuota";
import Preregistro from "../models/Preregistro";
import PerfilUsuario from "../models/PerfilUsuario";

async function ejecutar() {
  const uri = process.env.DATABASE_URL || process.env.MONGO_URI;
  if (!uri) throw new Error("Debe configurar DATABASE_URL o MONGO_URI");
  await mongoose.connect(uri);
  const cuotas = await Cuota.find({ fechaEliminado: null, $or: [{ tipoOrigenTarifa: { $exists: false } }, { cupoLiberado: { $exists: false } }, { horasProrrogaAcumuladas: { $exists: false } }] });
  let actualizadas = 0;
  for (const cuota of cuotas) {
    if (!cuota.tipoOrigenTarifa) {
      const preregistro = await Preregistro.findById(cuota.preregistroId).select("usuarioId");
      const perfil = preregistro ? await PerfilUsuario.findById(preregistro.usuarioId).select("tipoOrigen") : null;
      const externo = ["EXTERNO", "EXTERNO_UMSA", "EXTERNO_NO_UMSA"].includes(String(perfil?.tipoOrigen));
      cuota.tipoOrigenTarifa = externo || cuota.montoTotal === 850 ? "EXTERNO" : "INTERNO";
      cuota.tarifaAplicada = cuota.montoTotal;
    }
    if (cuota.cupoLiberado === undefined) cuota.cupoLiberado = false;
    if (cuota.horasProrrogaAcumuladas === undefined) cuota.horasProrrogaAcumuladas = 0;
    await cuota.save();
    actualizadas += 1;
  }
  console.log(JSON.stringify({ revisadas: cuotas.length, actualizadas }));
}

ejecutar()
  .catch((error) => { console.error("Error en migración de planes de cuotas", error); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
