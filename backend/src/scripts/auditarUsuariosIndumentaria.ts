import "dotenv/config";
import mongoose from "mongoose";
import { listarUsuariosIndumentaria } from "../services/IndumentariaUsuariosService";
import PerfilUsuario from "../models/PerfilUsuario";
import Fraterno from "../models/Fraterno";
import TallaFraterno from "../models/TallaFraterno";

const casos = ["12864017", "6853524", "13849489", "9939046", "4800543", "8349042", "9134991", "6842978", "11106645", "11102547"];

async function ejecutar() {
  await mongoose.connect(process.env.DATABASE_URL);
  const usuarios = await listarUsuariosIndumentaria();
  const [fraternos, tallas, duplicadosCi, duplicadosEmail] = await Promise.all([
    Fraterno.find({ fechaEliminado: null }).select("usuarioId").lean(),
    TallaFraterno.find().select("usuarioId fraternoId").lean(),
    PerfilUsuario.aggregate([{ $match: { fechaEliminado: null, estado: { $ne: "ELIMINADO" } } }, { $group: { _id: "$ci", cantidad: { $sum: 1 } } }, { $match: { cantidad: { $gt: 1 } } }]),
    PerfilUsuario.aggregate([{ $match: { fechaEliminado: null, estado: { $ne: "ELIMINADO" } } }, { $group: { _id: "$email", cantidad: { $sum: 1 } } }, { $match: { cantidad: { $gt: 1 } } }]),
  ]);
  const usuariosIds = new Set(usuarios.map((usuario) => String(usuario._id)));
  const fraternosIds = new Set(fraternos.map((fraterno) => String(fraterno._id)));
  const usuariosLegacy = new Set(fraternos.map((fraterno) => String(fraterno.usuarioId)));
  const tallasHuerfanas = tallas.filter((talla) => (!talla.usuarioId || !usuariosIds.has(String(talla.usuarioId))) && (!talla.fraternoId || !fraternosIds.has(String(talla.fraternoId))));
  const noHabilitados = usuarios.filter((usuario) => !usuario.habilitado);
  const rolesNoHabilitados = new Map<string, number>();
  noHabilitados.forEach((usuario) => (usuario.roles.length ? usuario.roles : ["OTROS"]).forEach((rol: string) => rolesNoHabilitados.set(rol, (rolesNoHabilitados.get(rol) ?? 0) + 1)));
  console.log(JSON.stringify({
    modo: "READ_ONLY",
    totalUsuariosGestionIntegral: usuarios.length,
    visiblesAntesDesdeFraternos: usuariosLegacy.size,
    usuariosAdicionalesRecuperados: usuarios.filter((usuario) => !usuariosLegacy.has(String(usuario._id))).length,
    visiblesEnTallas: usuarios.length,
    noVisiblesEnTallas: 0,
    habilitadosParaGuardar: usuarios.length - noHabilitados.length,
    visiblesNoHabilitados: noHabilitados.length,
    rolesNoHabilitados: Object.fromEntries(rolesNoHabilitados),
    integridad: { ciDuplicados: duplicadosCi.length, emailDuplicados: duplicadosEmail.length, tallasHuerfanas: tallasHuerfanas.length },
    casos: casos.map((ci) => usuarios.find((usuario) => usuario.ci === ci) ?? { ci, encontrado: false }),
  }, null, 2));
}

ejecutar().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => mongoose.disconnect());
