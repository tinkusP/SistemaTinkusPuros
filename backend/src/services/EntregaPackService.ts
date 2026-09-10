import ConfiguracionPago from "../models/ConfiguracionPago";
import Cuota from "../models/Cuota";
import DetalleCuota from "../models/DetalleCuota";
import EntregaIndumentaria from "../models/EntregaIndumentaria";
import Fraterno from "../models/Fraterno";
import Gestion from "../models/Gestion";
import PrendaIndumentaria from "../models/PrendaIndumentaria";

export const ARTICULOS_PACK = ["POLERA", "CHAMARRA", "CHALINA", "ETIQUETA PUROS"] as const;
export type ArticuloPack = typeof ARTICULOS_PACK[number];
export const REQUISITOS_ENTREGA_DEFAULT: Record<ArticuloPack, number> = { POLERA: 2, CHAMARRA: 2, CHALINA: 3, "ETIQUETA PUROS": 3 };

export function estadoPack(entregados: Iterable<string>) {
  const conjunto = new Set(Array.from(entregados, (item) => String(item).trim().toUpperCase()));
  const cantidad = ARTICULOS_PACK.filter((item) => conjunto.has(item)).length;
  return cantidad === 0 ? "PENDIENTE" : cantidad === ARTICULOS_PACK.length ? "PACK_COMPLETO" : "ENTREGA_PARCIAL";
}

export async function asegurarArticulosPack(usuarioCreador?: unknown) {
  return Promise.all(ARTICULOS_PACK.map((nombre) => PrendaIndumentaria.findOneAndUpdate(
    { nombre },
    { $setOnInsert: { nombre, requiereTalla: ["POLERA", "CHAMARRA"].includes(nombre), activo: true, usuarioCreador } },
    { upsert: true, new: true },
  )));
}

export async function requisitosGestion(gestionId: unknown) {
  const config: any = await ConfiguracionPago.findOne({ gestionId }).select("requisitosEntregaIndumentaria").lean();
  const valores = config?.requisitosEntregaIndumentaria;
  const leer = (articulo: ArticuloPack) => valores instanceof Map ? valores.get(articulo) : valores?.[articulo];
  return Object.fromEntries(ARTICULOS_PACK.map((articulo) => [articulo, Number(leer(articulo) ?? REQUISITOS_ENTREGA_DEFAULT[articulo])])) as Record<ArticuloPack, number>;
}

export async function validarEntrega(fraternoId: unknown, prendaId: unknown) {
  const fraterno = await Fraterno.findOne({ _id: fraternoId, fechaEliminado: null }).lean();
  if (!fraterno) throw new Error("Fraterno no encontrado");
  const prenda = await PrendaIndumentaria.findOne({ _id: prendaId, activo: true }).lean();
  if (!prenda) throw new Error("Artículo activo no encontrado");
  const articulo = String(prenda.nombre).trim().toUpperCase() as ArticuloPack;
  const requisitos = await requisitosGestion(fraterno.gestionId);
  const minimo = requisitos[articulo] ?? 0;
  const cuota = await Cuota.findOne({ preregistroId: fraterno.preregistroId, fechaEliminado: null }).lean();
  const verificadas = cuota ? await DetalleCuota.countDocuments({ cuotaId: cuota._id, estadoRevision: "VERIFICADO", fechaEliminado: null }) : 0;
  if (verificadas < minimo) throw new Error(`${prenda.nombre} requiere ${minimo} cuota(s) verificada(s). Actualmente tiene ${verificadas}.`);
  return { fraterno, prenda, verificadas, minimo };
}

export async function resumenPackFraterno(fraternoId: unknown) {
  const entregas: any[] = await EntregaIndumentaria.find({ fraternoId, estado: "ENTREGADO" }).populate("prendaId", "nombre").lean();
  const entregados = entregas.map((e) => e.prendaId?.nombre).filter(Boolean);
  return { estado: estadoPack(entregados), articulos: Object.fromEntries(ARTICULOS_PACK.map((a) => [a, entregados.includes(a)])), entregas };
}

export async function gestionActivaId() {
  return (await Gestion.findOne({ estado: { $in: ["ACTIVA", "INSCRIPCIONES"] }, fechaEliminado: null }).sort({ anio: -1 }).select("_id"))?._id;
}
