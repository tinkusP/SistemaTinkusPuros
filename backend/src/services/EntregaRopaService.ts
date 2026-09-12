import Fraterno from "../models/Fraterno";
import Gestion from "../models/Gestion";
import EntregaIndumentaria from "../models/EntregaIndumentaria";
import TallaFraterno from "../models/TallaFraterno";
import Cuota from "../models/Cuota";
import DetalleCuota from "../models/DetalleCuota";
import DetalleBloque from "../models/DetalleBloque";
import { FILTRO_ASIGNACION_ACTIVA } from "./AsignacionBloqueService";
import { puedeEntregarRopa, requisitosGestion } from "./EntregaPackService";
import { normalizarGeneroBloque } from "./BloqueService";

export const ARTICULOS_ROPA = ["POLERA", "CHAMARRA"] as const;
export function estadoEntregaRopa(polera: boolean, chamarra: boolean) {
  return polera && chamarra ? "ENTREGA_COMPLETA" : polera || chamarra ? "ENTREGA_PARCIAL" : "PENDIENTE";
}
export function resumirEntregaRopa(entregas: any[], privada = false) {
  const articulo = (nombre: string) => {
    const e = entregas.find((e) => e.estado === "ENTREGADO" && e.prendaId?.nombre === nombre);
    return { estado: e ? "ENTREGADA" : "PENDIENTE", fecha: e?.fechaEntrega ?? null,
      ...(privada ? { entregaId: e?._id ?? null, responsable: e?.responsableEntrega ? [e.responsableEntrega.nombres, e.responsableEntrega.apellidoPaterno, e.responsableEntrega.apellidoMaterno].filter(Boolean).join(" ") : "" } : {}) };
  };
  const polera = articulo("POLERA"), chamarra = articulo("CHAMARRA");
  return { polera, chamarra, estadoGeneral: estadoEntregaRopa(polera.estado === "ENTREGADA", chamarra.estado === "ENTREGADA") };
}

/** Lectura masiva: ningún catálogo, pago, talla o perfil se modifica. */
export async function reporteEntregaRopa(usuarioId?: string) {
  const gestion = await Gestion.findOne({ estado: { $in: ["ACTIVA", "INSCRIPCIONES"] }, fechaEliminado: null }).sort({ anio: -1 }).select("nombre anio").lean();
  if (!gestion) return { gestion: null, personas: [] };
  const fraternos: any[] = await Fraterno.find({ gestionId: gestion._id, estado: "ACTIVO", fechaEliminado: null, ...(usuarioId ? { usuarioId } : {}) })
    .populate({ path: "usuarioId", match: { fechaEliminado: null, estado: { $ne: "ELIMINADO" } }, select: "nombres apellidoPaterno apellidoMaterno ci sexo telefono registroUniversitario estado" }).lean();
  const ids = fraternos.map(f => f._id), usuarios = fraternos.map(f => f.usuarioId?._id).filter(Boolean);
  const [entregas, tallas, cuotas, bloques, requisitos] = await Promise.all([
    EntregaIndumentaria.find({ fraternoId: { $in: ids }, estado: "ENTREGADO" }).populate("prendaId", "nombre").populate("responsableEntrega", "nombres apellidoPaterno apellidoMaterno").lean(),
    TallaFraterno.find({ $or: [{ fraternoId: { $in: ids } }, { usuarioId: { $in: usuarios } }] }).lean(),
    Cuota.find({ preregistroId: { $in: fraternos.map(f => f.preregistroId) }, fechaEliminado: null }).lean(),
    DetalleBloque.find({ fraternoId: { $in: ids }, ...FILTRO_ASIGNACION_ACTIVA }).populate({ path: "bloqueId", match: { estado: "ACTIVO" }, select: "nombre" }).lean(),
    requisitosGestion(gestion._id),
  ]);
  const pagos = await DetalleCuota.find({ cuotaId: { $in: cuotas.map(c => c._id) }, estadoRevision: "VERIFICADO", fechaEliminado: null }).select("cuotaId monto").lean();
  const cuotaPorPre = new Map(cuotas.map(c => [String(c.preregistroId), c]));
  const bloquePorFraterno = new Map(bloques.map((b:any) => [String(b.fraternoId), b.bloqueId?.nombre]));
  const entregaPorFraterno = new Map<string, any[]>(), pagosPorCuota = new Map<string, any[]>();
  for (const e of entregas) { const k=String(e.fraternoId);entregaPorFraterno.set(k,[...(entregaPorFraterno.get(k)??[]),e]); }
  for (const p of pagos) { const k=String(p.cuotaId);pagosPorCuota.set(k,[...(pagosPorCuota.get(k)??[]),p]); }
  const tallaPorFraterno = new Map(tallas.map(t=>[String(t.fraternoId),t])), tallaPorUsuario = new Map(tallas.map(t=>[String(t.usuarioId),t]));
  const personas = fraternos.filter(f=>f.usuarioId).map(f=>{
    const u=f.usuarioId,c=cuotaPorPre.get(String(f.preregistroId)),ps=c?pagosPorCuota.get(String(c._id))??[]:[],t=tallaPorFraterno.get(String(f._id))??tallaPorUsuario.get(String(u._id));
    const ropa=resumirEntregaRopa(entregaPorFraterno.get(String(f._id))??[],true);
    return { usuarioId:String(u._id),fraternoId:String(f._id),nombre:[u.apellidoPaterno,u.apellidoMaterno,u.nombres].filter(Boolean).join(" "),ci:u.ci,sexo:normalizarGeneroBloque(u.sexo)??"SIN REGISTRO",telefono:u.telefono??"",matricula:u.registroUniversitario??"",bloque:bloquePorFraterno.get(String(f._id))??"SIN BLOQUE",tallaPolera:t?.tallaPolera??"",tallaChamarra:t?.tallaChamarra??"",...ropa,plan:c?.numeroCuotasElegidas??null,pagosVerificados:ps.length,estadoCuota:c?.estado??"SIN CUOTA",montoPagado:c?.montoPagado??0,saldo:c?.saldo??null,estadoFinanciero:c?.estado==="PAGADA"&&c.saldo===0?"PAGO COMPLETO":ps.length?"PAGO PARCIAL":"SIN PAGOS",habilitadoPolera:u.estado==="ACTIVO"&&puedeEntregarRopa(c??null,ps.length,requisitos.POLERA),habilitadoChamarra:u.estado==="ACTIVO"&&puedeEntregarRopa(c??null,ps.length,requisitos.CHAMARRA),observaciones:"" };
  }).sort((a,b)=>a.nombre.localeCompare(b.nombre,"es"));
  return { gestion, personas };
}
