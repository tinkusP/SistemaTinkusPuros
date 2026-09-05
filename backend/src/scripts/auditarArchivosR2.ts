import "dotenv/config";
import mongoose from "mongoose";
import PerfilUsuario from "../models/PerfilUsuario";
import DocumentoUsuario from "../models/DocumentoUsuario";
import DetalleCuota from "../models/DetalleCuota";
import { listarArchivosAlmacenados } from "../services/AlmacenamientoService";

type Categoria = "fotos" | "carnets" | "matriculas" | "comprobantes";
type Referencia = { categoria: Categoria; ruta: string };

function clave(ruta: string): string | null {
  try {
    const pathname = /^https?:\/\//i.test(ruta) ? new URL(ruta).pathname : ruta;
    const limpia = decodeURIComponent(pathname.split("?")[0]).replace(/^\/+/, "");
    return limpia.startsWith("uploads/") && !limpia.includes("..") ? limpia : null;
  } catch {
    return null;
  }
}

async function ejecutar() {
  const uri = process.env.DATABASE_URL || process.env.MONGO_URI;
  if (!uri) throw new Error("Debe configurar DATABASE_URL o MONGO_URI");
  await mongoose.connect(uri);

  const [perfiles, documentos, pagos, objetos] = await Promise.all([
    PerfilUsuario.find({ fotoPerfil: { $exists: true, $nin: [null, ""] }, fechaEliminado: null }).select("fotoPerfil").lean(),
    DocumentoUsuario.find({ fechaEliminado: null }).select("tipoDocumento ruta").lean(),
    DetalleCuota.find({ fechaEliminado: null, $or: [{ baucherImagen: { $exists: true, $nin: [null, ""] } }, { respaldoAdminImagen: { $exists: true, $nin: [null, ""] } }] }).select("baucherImagen respaldoAdminImagen").lean(),
    listarArchivosAlmacenados(),
  ]);

  const referencias: Referencia[] = [
    ...perfiles.map((item) => ({ categoria: "fotos" as const, ruta: String(item.fotoPerfil) })),
    ...documentos.map((item) => ({ categoria: item.tipoDocumento === "REGISTRO_UNIVERSITARIO" ? "matriculas" as const : "carnets" as const, ruta: String(item.ruta) })),
    ...pagos.flatMap((item) => [item.baucherImagen, item.respaldoAdminImagen].filter(Boolean).map((ruta) => ({ categoria: "comprobantes" as const, ruta: String(ruta) }))),
  ];
  const existentes = new Set(objetos.map((item) => item.key));
  const resumen = Object.fromEntries((["fotos", "carnets", "matriculas", "comprobantes"] as Categoria[]).map((categoria) => {
    const items = referencias.filter((item) => item.categoria === categoria);
    const claves = items.map((item) => clave(item.ruta));
    return [categoria, {
      referencias: items.length,
      rutasValidas: claves.filter(Boolean).length,
      presentesR2: claves.filter((item) => item && existentes.has(item)).length,
      faltantesR2: claves.filter((item) => item && !existentes.has(item)).length,
      rutasInvalidas: claves.filter((item) => !item).length,
    }];
  }));
  console.log(JSON.stringify({ objetosR2: objetos.length, ...resumen }, null, 2));
}

ejecutar().catch((error) => { console.error("Error auditando referencias R2", error); process.exitCode = 1; }).finally(() => mongoose.disconnect());
