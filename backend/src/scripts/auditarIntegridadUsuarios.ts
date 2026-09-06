import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../config/db";
import PerfilUsuario from "../models/PerfilUsuario";
import Preregistro from "../models/Preregistro";
import Fraterno from "../models/Fraterno";
import Cuota from "../models/Cuota";
import DetalleCuota from "../models/DetalleCuota";
import DetalleBloque from "../models/DetalleBloque";
import Bloque from "../models/Bloque";
import "../models/Rol";

const agruparDuplicados = async (modelo: any, campo: string, filtro: Record<string, unknown> = {}) => modelo.aggregate([
  { $match: filtro },
  { $group: { _id: `$${campo}`, cantidad: { $sum: 1 }, documentos: { $push: "$_id" } } },
  { $match: { _id: { $ne: null }, cantidad: { $gt: 1 } } },
]);

async function ejecutar() {
  await connectDB();
  const [usuarios, preregistros, fraternos, cuotas, pagos, asignaciones, bloques] = await Promise.all([
    PerfilUsuario.find({ fechaEliminado: null }).populate("roles", "codigo nombre").lean(),
    Preregistro.find({ fechaEliminado: null }).lean(),
    Fraterno.find({ fechaEliminado: null }).lean(),
    Cuota.find({ fechaEliminado: null }).lean(),
    DetalleCuota.find({ fechaEliminado: null }).lean(),
    DetalleBloque.find({ fechaEliminado: null }).lean(),
    Bloque.find().select("nombre estado").lean(),
  ]);
  const idsUsuarios = new Set(usuarios.map((item) => String(item._id))), idsPreregistros = new Set(preregistros.map((item) => String(item._id))), idsFraternos = new Set(fraternos.map((item) => String(item._id))), idsCuotas = new Set(cuotas.map((item) => String(item._id))), idsBloques = new Set(bloques.map((item) => String(item._id)));
  const prePorUsuario = new Map<string, any[]>(), fraPorUsuario = new Map<string, any[]>(), cuotaPorPre = new Map<string, any[]>(), pagosPorCuota = new Map<string, any[]>();
  preregistros.forEach((item: any) => prePorUsuario.set(String(item.usuarioId), [...(prePorUsuario.get(String(item.usuarioId)) ?? []), item]));
  fraternos.forEach((item: any) => fraPorUsuario.set(String(item.usuarioId), [...(fraPorUsuario.get(String(item.usuarioId)) ?? []), item]));
  cuotas.forEach((item: any) => cuotaPorPre.set(String(item.preregistroId), [...(cuotaPorPre.get(String(item.preregistroId)) ?? []), item]));
  pagos.forEach((item: any) => pagosPorCuota.set(String(item.cuotaId), [...(pagosPorCuota.get(String(item.cuotaId)) ?? []), item]));
  const usuarioObjetivo: any = usuarios.find((item: any) => String(item.ci) === "6948298");
  const preregistrosObjetivo = usuarioObjetivo ? prePorUsuario.get(String(usuarioObjetivo._id)) ?? [] : [];
  const fraternosHistoricosObjetivo = usuarioObjetivo ? await Fraterno.find({ usuarioId: usuarioObjetivo._id }).lean() : [];
  const todosFraternos = await Fraterno.find().select("usuarioId gestionId numeroFraterno fechaEliminado").lean();
  const gestionObjetivo = preregistrosObjetivo[0]?.gestionId;
  const cantidadGestionObjetivo = gestionObjetivo ? todosFraternos.filter((item: any) => String(item.gestionId) === String(gestionObjetivo)).length : 0;
  const candidatoActual = `FRA-${new Date().getFullYear()}-${String(cantidadGestionObjetivo + 1).padStart(4, "0")}`;
  const fraternosObjetivo = usuarioObjetivo ? fraPorUsuario.get(String(usuarioObjetivo._id)) ?? [] : [];
  const cuotasObjetivo = preregistrosObjetivo.flatMap((item: any) => cuotaPorPre.get(String(item._id)) ?? []);
  const pagosObjetivo = cuotasObjetivo.flatMap((item: any) => pagosPorCuota.get(String(item._id)) ?? []);
  const asignacionesObjetivo = asignaciones.filter((item: any) => fraternosObjetivo.some((fraterno: any) => String(fraterno._id) === String(item.fraternoId)));
  const usuariosSinFraternoConPago = usuarios.filter((usuario: any) => !(fraPorUsuario.get(String(usuario._id)) ?? []).length && (prePorUsuario.get(String(usuario._id)) ?? []).some((pre: any) => (cuotaPorPre.get(String(pre._id)) ?? []).some((cuota: any) => (pagosPorCuota.get(String(cuota._id)) ?? []).length)));
  const codigosDuplicados = await agruparDuplicados(Fraterno, "numeroFraterno");
  const usuariosFraternoDuplicados = await agruparDuplicados(Fraterno, "usuarioId", { fechaEliminado: null });
  const preregistrosDuplicados = await agruparDuplicados(Preregistro, "usuarioId", { fechaEliminado: null });
  const asignacionesActivasDuplicadas = await agruparDuplicados(DetalleBloque, "fraternoId", { estado: "ACTIVO", fechaEliminado: null });
  const resultado = {
    modo: "SOLO_LECTURA",
    usuarioReferencia: usuarioObjetivo ? {
      usuario: { _id: usuarioObjetivo._id, ci: usuarioObjetivo.ci, email: usuarioObjetivo.email, estado: usuarioObjetivo.estado, roles: (usuarioObjetivo.roles ?? []).map((rol: any) => rol.codigo ?? rol.nombre) },
      preregistros: preregistrosObjetivo.map((item: any) => ({ _id: item._id, gestionId: item.gestionId, codigo: item.numeroPreRegistro, estado: item.estado })),
      fraternos: fraternosObjetivo.map((item: any) => ({ _id: item._id, preregistroId: item.preregistroId, codigo: item.numeroFraterno, estado: item.estado })),
      fraternosHistoricos: fraternosHistoricosObjetivo.map((item: any) => ({ _id: item._id, preregistroId: item.preregistroId, codigo: item.numeroFraterno, estado: item.estado, fechaEliminado: item.fechaEliminado ?? null })),
      cuotas: cuotasObjetivo.map((item: any) => ({ _id: item._id, preregistroId: item.preregistroId, montoTotal: item.montoTotal, montoPagado: item.montoPagado, saldo: item.saldo, estado: item.estado })),
      pagos: pagosObjetivo.map((item: any) => ({ _id: item._id, cuotaId: item.cuotaId, numeroPago: item.numeroPago, monto: item.monto, estadoRevision: item.estadoRevision })),
      asignaciones: asignacionesObjetivo.map((item: any) => ({ _id: item._id, bloqueId: item.bloqueId, fraternoId: item.fraternoId, estado: item.estado })),
      diagnosticoCodigo: { cantidadGestionObjetivo, candidatoActual, conflicto: todosFraternos.filter((item: any) => item.numeroFraterno === candidatoActual) },
    } : null,
    totales: { usuarios: usuarios.length, preregistros: preregistros.length, fraternos: fraternos.length, cuotas: cuotas.length, pagos: pagos.length, asignaciones: asignaciones.length },
    problemas: {
      usuariosSinFraternoConPago: usuariosSinFraternoConPago.map((item: any) => ({ _id: item._id, ci: item.ci })),
      fraternosSinCodigo: fraternos.filter((item: any) => !String(item.numeroFraterno ?? "").trim()).map((item: any) => item._id),
      codigosDuplicados,
      usuariosFraternoDuplicados,
      preregistrosDuplicados,
      pagosHuerfanos: pagos.filter((item: any) => !idsCuotas.has(String(item.cuotaId))).map((item: any) => item._id),
      cuotasHuerfanas: cuotas.filter((item: any) => !idsPreregistros.has(String(item.preregistroId))).map((item: any) => item._id),
      preregistrosHuerfanos: preregistros.filter((item: any) => !idsUsuarios.has(String(item.usuarioId))).map((item: any) => item._id),
      fraternosHuerfanos: fraternos.filter((item: any) => !idsUsuarios.has(String(item.usuarioId)) || !idsPreregistros.has(String(item.preregistroId))).map((item: any) => item._id),
      asignacionesHuerfanas: asignaciones.filter((item: any) => !idsFraternos.has(String(item.fraternoId)) || !idsBloques.has(String(item.bloqueId))).map((item: any) => item._id),
      asignacionesActivasDuplicadas,
      codigosTemporalesEnFraternos: fraternos.filter((item: any) => /^TOK-FRA-/i.test(String(item.numeroFraterno))).map((item: any) => ({ _id: item._id, usuarioId: item.usuarioId, codigo: item.numeroFraterno })),
    },
    indices: {
      usuarios: await PerfilUsuario.collection.indexes(), preregistros: await Preregistro.collection.indexes(), fraternos: await Fraterno.collection.indexes(), cuotas: await Cuota.collection.indexes(), pagos: await DetalleCuota.collection.indexes(), asignaciones: await DetalleBloque.collection.indexes(),
    },
  };
  console.log(JSON.stringify(resultado, null, 2));
}

ejecutar().then(() => mongoose.disconnect()).catch(async (error) => { console.error(error); await mongoose.disconnect(); process.exitCode = 1; });
