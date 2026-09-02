import "dotenv/config";
import mongoose from "mongoose";
import Bloque from "../models/Bloque";
import Rol from "../models/Rol";
import DetalleBloque from "../models/DetalleBloque";
import { normalizarGeneroBloque } from "../services/BloqueService";

const PERMISOS_GUIA = [
  "VISTA_COMUNICADOS",
  "VISTA_PASOS",
  "VISTA_CANCIONERO",
  "VISTA_MI_BLOQUE_GUIA",
  "BLOQUES_PROPIOS_CREAR",
  "BLOQUES_PROPIOS_GESTIONAR",
  "BLOQUES_PROPIOS_EXPORTAR",
];

async function ejecutar() {
  const uri = process.env.DATABASE_URL;
  if (!uri) throw new Error("DATABASE_URL no está configurado");
  await mongoose.connect(uri);

  await Rol.updateOne(
    { codigo: "GUIA" },
    {
      $set: { nombre: "Guía", descripcion: "Organiza y administra únicamente su bloque", estado: true, fechaEliminado: null },
      $addToSet: { permisos: { $each: PERMISOS_GUIA } },
      $setOnInsert: { codigo: "GUIA", esRolSistema: true },
    },
    { upsert: true },
  );

  const bloques = await Bloque.find().populate({ path: "guiasIds", populate: { path: "usuarioId", select: "sexo" } }).populate({ path: "guiaId", populate: { path: "usuarioId", select: "sexo" } });
  for (const bloque of bloques as any[]) {
    const guias = bloque.guiasIds?.length ? bloque.guiasIds : [bloque.guiaId].filter(Boolean);
    const idsUnicos = Array.from(new Map(guias.map((guia: any) => [String(guia._id), guia])).values()) as any[];
    const cantidadGuiasHombres = idsUnicos.filter((guia) => normalizarGeneroBloque(guia.usuarioId?.sexo) === "HOMBRE").length;
    const cantidadGuiasMujeres = idsUnicos.filter((guia) => normalizarGeneroBloque(guia.usuarioId?.sexo) === "MUJER").length;
    const [cantidadHombres, cantidadMujeres] = await Promise.all([DetalleBloque.countDocuments({ bloqueId: bloque._id, genero: "HOMBRE" }), DetalleBloque.countDocuments({ bloqueId: bloque._id, genero: "MUJER" })]);
    await Bloque.updateOne({ _id: bloque._id }, { $set: { guiasIds: idsUnicos.map((guia) => guia._id), cantidadGuiasHombres, cantidadGuiasMujeres, cantidadHombres, cantidadMujeres } });
  }

  console.log(`Migración de Guías completada: ${bloques.length} bloque(s) revisado(s).`);
  await mongoose.disconnect();
}

ejecutar().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
