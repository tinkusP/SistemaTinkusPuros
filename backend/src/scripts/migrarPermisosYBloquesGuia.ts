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
      $set: { nombre: "Guía", descripcion: "Organiza únicamente el bloque asignado por Administración", estado: true, fechaEliminado: null, permisos: PERMISOS_GUIA },
      $setOnInsert: { codigo: "GUIA", esRolSistema: true },
    },
    { upsert: true },
  );

  const detalleCollection = mongoose.connection.collection("detalle_bloques");
  await detalleCollection.updateMany({}, { $unset: { fila: "", columna: "" } });
  const indices = await detalleCollection.indexes();
  for (const indice of indices) {
    if (indice.key?.fila || indice.key?.columna) await detalleCollection.dropIndex(indice.name!);
  }
  const bloqueCollection=mongoose.connection.collection("bloques");
  await bloqueCollection.updateMany({},{$unset:{filasHombres:"",columnasHombres:"",filasMujeres:"",columnasMujeres:""}});
  const indiceGuia=(await bloqueCollection.indexes()).find(indice=>indice.name==="guiaId_1");
  if(indiceGuia&&!indiceGuia.sparse){await bloqueCollection.dropIndex("guiaId_1");await bloqueCollection.createIndex({guiaId:1},{unique:true,sparse:true,name:"guiaId_1"});}
  const guiaCollection=mongoose.connection.collection("guias");
  const indicePostulante=(await guiaCollection.indexes()).find(indice=>indice.name==="postulanteGuiaId_1");
  if(indicePostulante&&!indicePostulante.sparse){await guiaCollection.dropIndex("postulanteGuiaId_1");await guiaCollection.createIndex({postulanteGuiaId:1},{unique:true,sparse:true,name:"postulanteGuiaId_1"});}
  if(!(await guiaCollection.indexExists("usuarioId_1")))await guiaCollection.createIndex({usuarioId:1},{unique:true,name:"usuarioId_1"});

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
