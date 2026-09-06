import "dotenv/config";
import mongoose from "mongoose";
import { listarUsuariosIndumentaria } from "../services/IndumentariaUsuariosService";
import PerfilUsuario from "../models/PerfilUsuario";
import Fraterno from "../models/Fraterno";
import TallaFraterno from "../models/TallaFraterno";
import { indiceFraternoOpcionalEsSeguro } from "../services/IndiceTallaService";

const casos = ["12864017", "6853524", "13849489", "9939046", "4800543", "8349042", "9134991", "6842978", "11106645", "11102547"];

async function ejecutar() {
  await mongoose.connect(process.env.DATABASE_URL);
  const usuarios = await listarUsuariosIndumentaria();
  const [fraternos, tallas, duplicadosCi, duplicadosEmail, indices] = await Promise.all([
    Fraterno.find({ fechaEliminado: null }).select("usuarioId").lean(),
    TallaFraterno.find().select("usuarioId fraternoId").lean(),
    PerfilUsuario.aggregate([{ $match: { fechaEliminado: null, estado: { $ne: "ELIMINADO" } } }, { $group: { _id: "$ci", cantidad: { $sum: 1 } } }, { $match: { cantidad: { $gt: 1 } } }]),
    PerfilUsuario.aggregate([{ $match: { fechaEliminado: null, estado: { $ne: "ELIMINADO" } } }, { $group: { _id: "$email", cantidad: { $sum: 1 } } }, { $match: { cantidad: { $gt: 1 } } }]),
    TallaFraterno.collection.indexes(),
  ]);
  const usuariosIds = new Set(usuarios.map((usuario) => String(usuario._id)));
  const fraternosIds = new Set(fraternos.map((fraterno) => String(fraterno._id)));
  const usuariosLegacy = new Set(fraternos.map((fraterno) => String(fraterno.usuarioId)));
  const usuarioPorFraterno = new Map(fraternos.map((fraterno) => [String(fraterno._id), String(fraterno.usuarioId)]));
  const tallasHuerfanas = tallas.filter((talla) => (!talla.usuarioId || !usuariosIds.has(String(talla.usuarioId))) && (!talla.fraternoId || !fraternosIds.has(String(talla.fraternoId))));
  const tallasIncompatibles = tallas.filter((talla) => talla.usuarioId && talla.fraternoId && usuarioPorFraterno.get(String(talla.fraternoId)) !== String(talla.usuarioId));
  const cantidadTallasPorUsuario = new Map<string, number>();
  tallas.forEach((talla) => { const usuarioId = talla.usuarioId ? String(talla.usuarioId) : usuarioPorFraterno.get(String(talla.fraternoId)); if (usuarioId) cantidadTallasPorUsuario.set(usuarioId, (cantidadTallasPorUsuario.get(usuarioId) ?? 0) + 1); });
  const tallasDuplicadas = Array.from(cantidadTallasPorUsuario).filter(([, cantidad]) => cantidad > 1).map(([usuarioId, cantidad]) => ({ usuarioId, cantidad }));
  const tallaRegistrada = (valor: unknown) => Boolean(String(valor ?? "").trim() && String(valor).trim().toUpperCase() !== "SIN DEFINIR");
  const conPolera = usuarios.filter((usuario) => tallaRegistrada(usuario.talla?.tallaPolera));
  const conChamarra = usuarios.filter((usuario) => tallaRegistrada(usuario.talla?.tallaChamarra));
  const sinNingunaTalla = usuarios.filter((usuario) => !tallaRegistrada(usuario.talla?.tallaPolera) && !tallaRegistrada(usuario.talla?.tallaChamarra));
  const contarGenero = (lista: typeof usuarios, genero: string) => lista.filter((usuario) => usuario.sexo === genero).length;
  const noHabilitados = usuarios.filter((usuario) => !usuario.habilitado);
  const sinPerfilFraterno = usuarios.filter((usuario) => !usuario.fraterno);
  const codigosTok = usuarios.filter((usuario) => usuario.preregistro?.numero?.startsWith("TOK-FRA-"));
  const sinPerfilSinTalla = sinPerfilFraterno.filter((usuario) => !usuario.talla);
  const rolesSinPerfil = new Map<string, number>();
  sinPerfilFraterno.forEach((usuario) => (usuario.roles.length ? usuario.roles : ["OTROS"]).forEach((rol: string) => rolesSinPerfil.set(rol, (rolesSinPerfil.get(rol) ?? 0) + 1)));
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
    perfilesOpcionales: {
      sinPerfilFraterno: sinPerfilFraterno.length,
      rolesSinPerfil: Object.fromEntries(rolesSinPerfil),
      codigosTokFra: codigosTok.length,
      tokFraConTalla: codigosTok.filter((usuario) => usuario.talla).length,
      tokFraSinTalla: codigosTok.filter((usuario) => !usuario.talla).length,
      habrianFalladoConIndiceLegado: sinPerfilSinTalla.length,
    },
    integridad: {
      ciDuplicados: duplicadosCi.length,
      emailDuplicados: duplicadosEmail.length,
      tallasHuerfanas: tallasHuerfanas.length,
      tallasConReferenciasIncompatibles: tallasIncompatibles.length,
      personasConTallasDuplicadas: tallasDuplicadas.length,
      detalleDuplicados: tallasDuplicadas,
      indiceFraternoOpcionalSeguro: indiceFraternoOpcionalEsSeguro(indices.find((indice) => indice.name === "fraternoId_1") as any),
    },
    tallas: {
      conPolera: conPolera.length,
      sinPolera: usuarios.length - conPolera.length,
      conChamarra: conChamarra.length,
      sinChamarra: usuarios.length - conChamarra.length,
      sinNingunaTalla: sinNingunaTalla.length,
      usuariosHombres: contarGenero(usuarios, "HOMBRE"),
      usuariosMujeres: contarGenero(usuarios, "MUJER"),
      polerasHombres: contarGenero(conPolera, "HOMBRE"),
      polerasMujeres: contarGenero(conPolera, "MUJER"),
      chamarrasHombres: contarGenero(conChamarra, "HOMBRE"),
      chamarrasMujeres: contarGenero(conChamarra, "MUJER"),
    },
    casos: casos.map((ci) => usuarios.find((usuario) => usuario.ci === ci) ?? { ci, encontrado: false }),
  }, null, 2));
}

ejecutar().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => mongoose.disconnect());
