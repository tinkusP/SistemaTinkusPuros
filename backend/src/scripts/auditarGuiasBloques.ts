import "dotenv/config";
import mongoose from "mongoose";
import Bloque from "../models/Bloque";
import Guia from "../models/Guia";
import "../models/PerfilUsuario";
import { idsGuiasDelBloque, sincronizarContadoresGuias } from "../services/GuiaBloqueService";
import { normalizarGeneroBloque } from "../services/BloqueService";

async function ejecutar() {
  const uri = process.env.DATABASE_URL || process.env.MONGO_URI;
  if (!uri) throw new Error("Debe configurar DATABASE_URL o MONGO_URI");
  const reparar = process.argv.includes("--repair");
  await mongoose.connect(uri);
  const bloques: any[] = await Bloque.find({ estado: "ACTIVO" });
  const referencias = bloques.flatMap((bloque) => idsGuiasDelBloque(bloque).map((guiaId) => ({ bloqueId: bloque._id, guiaId })));
  const ids = [...new Set(referencias.map((item) => String(item.guiaId)))];
  const guias: any[] = await Guia.find({ _id: { $in: ids } }).populate("usuarioId", "sexo").lean();
  const guiaPorId = new Map(guias.map((guia) => [String(guia._id), guia]));
  const bloquesPorGuia = new Map<string, string[]>();
  for (const item of referencias) bloquesPorGuia.set(String(item.guiaId), [...(bloquesPorGuia.get(String(item.guiaId)) ?? []), String(item.bloqueId)]);
  const referenciasInvalidas = referencias.filter((item) => guiaPorId.get(String(item.guiaId))?.estado !== "ACTIVO");
  const duplicados = [...bloquesPorGuia.entries()].filter(([, bloquesIds]) => new Set(bloquesIds).size > 1);
  const contadoresIncorrectos = bloques.filter((bloque) => {
    const guiasBloque = idsGuiasDelBloque(bloque).map((id) => guiaPorId.get(String(id))).filter((guia) => guia?.estado === "ACTIVO");
    const hombres = guiasBloque.filter((guia) => normalizarGeneroBloque(guia.usuarioId?.sexo) === "HOMBRE").length;
    const mujeres = guiasBloque.filter((guia) => normalizarGeneroBloque(guia.usuarioId?.sexo) === "MUJER").length;
    return hombres !== bloque.cantidadGuiasHombres || mujeres !== bloque.cantidadGuiasMujeres;
  });
  console.log(JSON.stringify({ modo: reparar ? "REPARACION" : "SOLO_LECTURA", bloquesActivos: bloques.length, referenciasInvalidas: referenciasInvalidas.length, guiasEnVariosBloques: duplicados.length, contadoresIncorrectos: contadoresIncorrectos.length }, null, 2));
  if (reparar) {
    for (const bloque of bloques) await sincronizarContadoresGuias(bloque);
    console.log(`Reparación finalizada: ${bloques.length} bloque(s) sincronizado(s).`);
  }
}

ejecutar().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => mongoose.disconnect());
