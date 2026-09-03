import "dotenv/config";
import mongoose from "mongoose";
import Bloque from "../models/Bloque";
import DetalleBloque from "../models/DetalleBloque";
import Fraterno from "../models/Fraterno";
import { asegurarIndiceAsignacionActiva, FILTRO_ASIGNACION_ACTIVA } from "../services/AsignacionBloqueService";

async function ejecutar() {
  const uri = process.env.DATABASE_URL;
  if (!uri) throw new Error("DATABASE_URL no está configurado");
  const reparar = process.argv.includes("--repair");
  await mongoose.connect(uri);
  const asignaciones: any[] = await DetalleBloque.find(FILTRO_ASIGNACION_ACTIVA).sort({ fechaAsignacion: -1, _id: -1 }).lean();
  const bloquesValidos = new Set((await Bloque.find({ _id: { $in: asignaciones.map((item) => item.bloqueId) }, estado: "ACTIVO" }).distinct("_id")).map(String));
  const huerfanas = asignaciones.filter((item) => !bloquesValidos.has(String(item.bloqueId)));
  const porFraterno = new Map<string, any[]>();
  for (const asignacion of asignaciones.filter((item) => bloquesValidos.has(String(item.bloqueId)))) {
    const clave = String(asignacion.fraternoId);
    porFraterno.set(clave, [...(porFraterno.get(clave) ?? []), asignacion]);
  }
  const duplicadas = [...porFraterno.entries()].filter(([, items]) => items.length > 1);
  const fraternosDuplicados = await Fraterno.aggregate([{ $match: { fechaEliminado: null } }, { $group: { _id: { usuarioId: "$usuarioId", gestionId: "$gestionId" }, ids: { $push: "$_id" }, total: { $sum: 1 } } }, { $match: { total: { $gt: 1 } } }]);
  console.log(JSON.stringify({ modo: reparar ? "REPARACION_SEGURA" : "SOLO_LECTURA", asignacionesActivas: asignaciones.length, relacionesHuerfanas: huerfanas.map((item) => item._id), fraternosConVariasAsignaciones: duplicadas.map(([fraternoId, items]) => ({ fraternoId, asignaciones: items.map((item) => item._id) })), perfilesFraternoDuplicados: fraternosDuplicados }, null, 2));
  if (reparar) {
    const retirar = [...huerfanas.map((item) => item._id), ...duplicadas.flatMap(([, items]) => items.slice(1).map((item) => item._id))];
    if (retirar.length) await DetalleBloque.updateMany({ _id: { $in: retirar } }, { $set: { estado: "INACTIVO", fechaRetiro: new Date() } });
    await asegurarIndiceAsignacionActiva();
    console.log(`Reparación finalizada sin eliminar historial: ${retirar.length} relación(es) desactivada(s).`);
  }
  await mongoose.disconnect();
}

ejecutar().catch(async (error) => { console.error(error); await mongoose.disconnect(); process.exit(1); });
