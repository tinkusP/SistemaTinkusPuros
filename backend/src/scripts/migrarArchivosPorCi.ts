import "dotenv/config";
import mongoose from "mongoose";
import path from "node:path";
import DetalleCuota from "../models/DetalleCuota";
import Cuota from "../models/Cuota";
import Preregistro from "../models/Preregistro";
import PerfilUsuario from "../models/PerfilUsuario";
import { moverArchivoAlmacenado } from "../services/AlmacenamientoService";

const seguro = (valor: unknown) => String(valor || "SIN_CI").replace(/[^a-zA-Z0-9_-]/g, "_");
const extension = (ruta: string) => path.extname(ruta.split("?")[0]).toLowerCase() || ".webp";
const tipo = (ruta: string) => extension(ruta) === ".pdf" ? "application/pdf" : "image/webp";

async function ejecutar() {
  const uri = process.env.DATABASE_URL || process.env.MONGO_URI;
  if (!uri) throw new Error("Debe configurar DATABASE_URL o MONGO_URI");
  await mongoose.connect(uri);
  const detalles = await DetalleCuota.find({ $or: [{ baucherImagen: /^\/uploads\/bauchers\// }, { respaldoAdminImagen: /^\/uploads\/bauchers\// }] });
  let migrados = 0;
  let faltantes = 0;
  for (const detalle of detalles) {
    const cuota = await Cuota.findById(detalle.cuotaId).select("preregistroId");
    const preregistro = cuota ? await Preregistro.findById(cuota.preregistroId).select("usuarioId") : null;
    const perfil = preregistro ? await PerfilUsuario.findById(preregistro.usuarioId).select("ci") : null;
    if (!perfil?.ci) { faltantes += 1; continue; }
    const ci = seguro(perfil.ci);
    for (const campo of ["baucherImagen", "respaldoAdminImagen"] as const) {
      const anterior = detalle[campo];
      if (!anterior?.startsWith("/uploads/bauchers/")) continue;
      const prefijo = campo === "baucherImagen" ? "COMPROBANTE" : "RESPALDO";
      const nueva = `/uploads/cuentas-perfil/${ci}/comprobantes/${prefijo}_${ci}_${detalle._id}${extension(anterior)}`;
      if (await moverArchivoAlmacenado(anterior, nueva, tipo(anterior))) {
        detalle[campo] = nueva;
        migrados += 1;
      } else {
        faltantes += 1;
      }
    }
    await detalle.save();
  }
  console.log(JSON.stringify({ revisados: detalles.length, migrados, faltantes }));
}

ejecutar().catch((error) => { console.error("Error en migración de archivos por CI", error); process.exitCode = 1; }).finally(() => mongoose.disconnect());
