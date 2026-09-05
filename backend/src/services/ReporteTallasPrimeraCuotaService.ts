import Gestion from "../models/Gestion";
import Fraterno from "../models/Fraterno";
import TallaFraterno from "../models/TallaFraterno";
import Cuota from "../models/Cuota";
import DetalleCuota from "../models/DetalleCuota";
import DetalleBloque from "../models/DetalleBloque";
import "../models/PerfilUsuario";
import "../models/Rol";
import "../models/Preregistro";
import "../models/Bloque";
import { FILTRO_ASIGNACION_ACTIVA } from "./AsignacionBloqueService";
import { distribuirPlanPagos, redondearMonto } from "./PlanPagosService";

const tieneValor = (valor?: unknown) => Boolean(String(valor ?? "").trim());
const nombreCompleto = (usuario: any) => [usuario?.nombres, usuario?.apellidoPaterno, usuario?.apellidoMaterno].filter(Boolean).join(" ");
const whatsapp = (telefono?: string) => {
  const digitos = String(telefono ?? "").trim().replace(/\D/g, "");
  if (/^[67]\d{7}$/.test(digitos)) return `+591${digitos}`;
  if (/^591[67]\d{7}$/.test(digitos)) return `+${digitos}`;
  return null;
};

export function estadoTallaPago(tallaPolera?: string, tallaChamarra?: string, primeraCuotaPagada = false) {
  const tienePolera = tieneValor(tallaPolera), tieneChamarra = tieneValor(tallaChamarra), conTalla = tienePolera && tieneChamarra;
  const pendienteTalla = conTalla ? null : !tienePolera && !tieneChamarra ? "AMBAS" : !tienePolera ? "POLERA" : "CHAMARRA";
  const estadoGeneral = !conTalla && !primeraCuotaPagada ? "SIN TALLA + SIN PRIMERA CUOTA" : !conTalla ? "SIN TALLA" : !primeraCuotaPagada ? "SIN PRIMERA CUOTA" : "COMPLETO";
  return { tienePolera, tieneChamarra, conTalla, pendienteTalla, estadoGeneral };
}

export async function generarReporteTallasPrimeraCuota(gestionId?: string) {
  const gestion = gestionId ? await Gestion.findById(gestionId) : await Gestion.findOne({ estado: { $in: ["ACTIVA", "INSCRIPCIONES"] }, fechaEliminado: null }).sort({ anio: -1 });
  if (!gestion) return null;
  const fraternos: any[] = await Fraterno.find({ gestionId: gestion._id, estado: "ACTIVO", fechaEliminado: null })
    .populate({ path: "usuarioId", select: "nombres apellidoPaterno apellidoMaterno ci sexo telefono email roles", populate: { path: "roles", select: "codigo nombre estado fechaEliminado" } })
    .populate("preregistroId", "numeroPreRegistro").lean();
  const [tallas, cuotas, asignaciones] = await Promise.all([
    TallaFraterno.find({ $or: [{ fraternoId: { $in: fraternos.map((f) => f._id) } }, { usuarioId: { $in: fraternos.map((f) => f.usuarioId?._id).filter(Boolean) } }] }).lean(),
    Cuota.find({ preregistroId: { $in: fraternos.map((f) => f.preregistroId?._id ?? f.preregistroId) }, fechaEliminado: null }).lean(),
    DetalleBloque.find({ fraternoId: { $in: fraternos.map((f) => f._id) }, ...FILTRO_ASIGNACION_ACTIVA }).populate({ path: "bloqueId", match: { estado: "ACTIVO" }, select: "nombre" }).lean(),
  ]);
  const primerosPagos = await DetalleCuota.find({ cuotaId: { $in: cuotas.map((c) => c._id) }, numeroPago: 1, estadoRevision: "VERIFICADO", fechaEliminado: null }).lean();
  const tallaPorFraterno = new Map(tallas.filter((t: any) => t.fraternoId).map((t: any) => [String(t.fraternoId), t]));
  const tallaPorUsuario = new Map(tallas.filter((t: any) => t.usuarioId).map((t: any) => [String(t.usuarioId), t]));
  const cuotaPorPreregistro = new Map(cuotas.map((c) => [String(c.preregistroId), c]));
  const pagoPorCuota = new Map(primerosPagos.map((p) => [String(p.cuotaId), p]));
  const bloquePorFraterno = new Map(asignaciones.filter((a: any) => a.bloqueId).map((a: any) => [String(a.fraternoId), a.bloqueId]));
  const personas = fraternos.map((fraterno: any) => {
    const usuario = fraterno.usuarioId;
    const talla: any = tallaPorFraterno.get(String(fraterno._id)) ?? tallaPorUsuario.get(String(usuario?._id));
    const cuota: any = cuotaPorPreregistro.get(String(fraterno.preregistroId?._id ?? fraterno.preregistroId));
    const primerPago: any = cuota ? pagoPorCuota.get(String(cuota._id)) : null;
    const montoPrimeraCuota = cuota ? redondearMonto(cuota.primeraCuotaMonto ?? distribuirPlanPagos(cuota.montoTotal, cuota.numeroCuotasElegidas ?? 1)[0]) : 0;
    const primeraCuotaPagada = Boolean(primerPago);
    const tallaEstado = estadoTallaPago(talla?.tallaPolera, talla?.tallaChamarra, primeraCuotaPagada);
    return { usuarioId: String(usuario?._id ?? ""), fraternoId: String(fraterno._id), nombre: nombreCompleto(usuario), ci: String(usuario?.ci ?? ""), codigoFraterno: fraterno.numeroFraterno, sexo: usuario?.sexo ?? "SIN REGISTRO", telefono: String(usuario?.telefono ?? ""), whatsapp: whatsapp(usuario?.telefono), correo: usuario?.email ?? "", roles: (usuario?.roles ?? []).filter((rol: any) => rol?.estado !== false && !rol?.fechaEliminado).map((rol: any) => rol.codigo ?? rol.nombre), bloque: (bloquePorFraterno.get(String(fraterno._id)) as any)?.nombre ?? "SIN BLOQUE", tallaPolera: talla?.tallaPolera ?? null, tallaChamarra: talla?.tallaChamarra ?? null, ...tallaEstado, primeraCuota: primeraCuotaPagada ? "PAGADA" : "PENDIENTE", montoPrimeraCuota, montoPagadoPrimeraCuota: redondearMonto(primerPago?.monto ?? 0) };
  }).sort((a, b) => `${a.nombre}`.localeCompare(`${b.nombre}`, "es", { sensitivity: "base" }));
  const resumir = (items: typeof personas) => ({ total: items.length, conTalla: items.filter((p) => p.conTalla).length, sinTalla: items.filter((p) => !p.conTalla).length, conPolera: items.filter((p) => p.tienePolera).length, sinPolera: items.filter((p) => !p.tienePolera).length, conChamarra: items.filter((p) => p.tieneChamarra).length, sinChamarra: items.filter((p) => !p.tieneChamarra).length, sinNingunaTalla: items.filter((p) => p.pendienteTalla === "AMBAS").length, primeraCuotaPagada: items.filter((p) => p.primeraCuota === "PAGADA").length, primeraCuotaPendiente: items.filter((p) => p.primeraCuota === "PENDIENTE").length, sinTallaYSinPrimeraCuota: items.filter((p) => !p.conTalla && p.primeraCuota === "PENDIENTE").length });
  const hombres = personas.filter((p) => p.sexo === "HOMBRE"), mujeres = personas.filter((p) => p.sexo === "MUJER");
  return { generadoEn: new Date(), gestion: { _id: gestion._id, nombre: gestion.nombre, anio: gestion.anio }, resumen: { ...resumir(personas), hombres: resumir(hombres), mujeres: resumir(mujeres) }, bloques: [...new Set(personas.map((p) => p.bloque))].sort(), personas };
}
