import Gestion from "../models/Gestion";
import PerfilUsuario from "../models/PerfilUsuario";
import Fraterno from "../models/Fraterno";
import TallaFraterno from "../models/TallaFraterno";
import Cuota from "../models/Cuota";
import DetalleCuota from "../models/DetalleCuota";
import DetalleBloque from "../models/DetalleBloque";
import Preregistro from "../models/Preregistro";
import ConfiguracionPago from "../models/ConfiguracionPago";
import Guia from "../models/Guia";
import Bloque from "../models/Bloque";
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

export function estadoTallaPago(tallaPolera?: string, tallaChamarra?: string, primeraCuotaPagada = false, aplica = true) {
  if (!aplica) return { tienePolera: false, tieneChamarra: false, conTalla: false, pendienteTalla: null, estadoTallaPolera: "NO APLICA", estadoTallaChamarra: "NO APLICA", estadoGeneral: "USUARIO SIN PERFIL FRATERNO" };
  const tienePolera = tieneValor(tallaPolera), tieneChamarra = tieneValor(tallaChamarra), conTalla = tienePolera && tieneChamarra;
  const pendienteTalla = conTalla ? null : !tienePolera && !tieneChamarra ? "AMBAS" : !tienePolera ? "POLERA" : "CHAMARRA";
  const estadoGeneral = !conTalla && !primeraCuotaPagada ? "SIN TALLA + SIN PRIMERA CUOTA" : !conTalla ? "SIN TALLA" : !primeraCuotaPagada ? "SIN PRIMERA CUOTA" : "COMPLETO";
  return { tienePolera, tieneChamarra, conTalla, pendienteTalla, estadoTallaPolera: tienePolera ? "REGISTRADA" : "SIN REGISTRAR", estadoTallaChamarra: tieneChamarra ? "REGISTRADA" : "SIN REGISTRAR", estadoGeneral };
}

export function estadoPrimeraCuota(aplica: boolean, montoEsperado: number, pago?: { monto?: number; estadoRevision?: string } | null) {
  const montoRegistrado = aplica ? redondearMonto(pago?.monto ?? 0) : 0;
  const verificacion = !aplica ? "NO APLICA" : pago?.estadoRevision ?? "SIN REGISTRO";
  const pagada = aplica && verificacion === "VERIFICADO";
  const montoVerificado = pagada ? montoRegistrado : 0;
  return { primeraCuota: !aplica ? "SIN REGISTRO / NO APLICA" : pagada ? "PAGADA" : "PENDIENTE", estadoPago: !aplica ? "NO APLICA" : pagada ? "PAGO VERIFICADO" : pago ? "PAGO REGISTRADO" : "SIN PAGO", verificacionPrimeraCuota: verificacion, montoRegistradoPrimeraCuota: montoRegistrado, montoVerificadoPrimeraCuota: montoVerificado, saldoPrimeraCuota: aplica ? redondearMonto(Math.max(0, montoEsperado - montoVerificado)) : 0, pagada };
}

const normalizarRol = (rol: any) => String(rol?.codigo ?? rol?.nombre ?? "").trim().toLocaleUpperCase("es");
const esRol = (roles: string[], codigo: string) => roles.some((rol) => rol === codigo || rol.includes(codigo));
const tipoRegistro = (roles: string[], perfilFraterno: boolean) => {
  const tipos = roles.filter((rol) => rol && (perfilFraterno || rol !== "FRATERNO"));
  if (perfilFraterno && !tipos.includes("FRATERNO")) tipos.push("FRATERNO");
  return tipos.length ? tipos.join(" / ") : "USUARIO REGISTRADO";
};

export async function generarReporteTallasPrimeraCuota(gestionId?: string) {
  const gestion = gestionId ? await Gestion.findById(gestionId) : await Gestion.findOne({ estado: { $in: ["ACTIVA", "INSCRIPCIONES"] }, fechaEliminado: null }).sort({ anio: -1 });
  if (!gestion) return null;

  const usuarios: any[] = await PerfilUsuario.find({ fechaEliminado: null, estado: { $ne: "ELIMINADO" } })
    .select("nombres apellidoPaterno apellidoMaterno ci sexo telefono email roles estado")
    .populate({ path: "roles", select: "codigo nombre estado fechaEliminado" }).lean();
  const usuarioIds = usuarios.map((usuario) => usuario._id);
  const [fraternos, preregistros, configuracion, guias]: any[] = await Promise.all([
    Fraterno.find({ usuarioId: { $in: usuarioIds }, gestionId: gestion._id, estado: "ACTIVO", fechaEliminado: null }).lean(),
    Preregistro.find({ usuarioId: { $in: usuarioIds }, gestionId: gestion._id, fechaEliminado: null }).lean(),
    ConfiguracionPago.findOne({ gestionId: gestion._id, activo: true }).lean(),
    Guia.find({ usuarioId: { $in: usuarioIds }, gestionId: gestion._id, estado: "ACTIVO" }).lean(),
  ]);
  const fraternoIds = fraternos.map((fraterno) => fraterno._id);
  const preregistroIds = preregistros.map((preregistro: any) => preregistro._id);
  const guiaIds = guias.map((guia: any) => guia._id);
  const [tallas, cuotas, asignaciones, bloquesGuia] = await Promise.all([
    TallaFraterno.find({ $or: [{ fraternoId: { $in: fraternoIds } }, { usuarioId: { $in: usuarioIds } }] }).lean(),
    Cuota.find({ preregistroId: { $in: preregistroIds }, fechaEliminado: null }).lean(),
    DetalleBloque.find({ fraternoId: { $in: fraternoIds }, ...FILTRO_ASIGNACION_ACTIVA }).populate({ path: "bloqueId", match: { estado: "ACTIVO" }, select: "nombre" }).lean(),
    Bloque.find({ estado: "ACTIVO", gestionId: gestion._id, $or: [{ guiaId: { $in: guiaIds } }, { guiasIds: { $in: guiaIds } }] }).select("nombre guiaId guiasIds").lean(),
  ]);
  const primerosPagos = await DetalleCuota.find({ cuotaId: { $in: cuotas.map((cuota) => cuota._id) }, numeroPago: 1, fechaEliminado: null }).lean();

  const fraternoPorUsuario = new Map(fraternos.map((fraterno) => [String(fraterno.usuarioId), fraterno]));
  const preregistroPorUsuario = new Map(preregistros.map((preregistro: any) => [String(preregistro.usuarioId), preregistro]));
  const guiaPorUsuario = new Map(guias.map((guia: any) => [String(guia.usuarioId), guia]));
  const tallaPorFraterno = new Map(tallas.filter((talla: any) => talla.fraternoId).map((talla: any) => [String(talla.fraternoId), talla]));
  const tallaPorUsuario = new Map(tallas.filter((talla: any) => talla.usuarioId).map((talla: any) => [String(talla.usuarioId), talla]));
  const cuotaPorPreregistro = new Map(cuotas.map((cuota) => [String(cuota.preregistroId), cuota]));
  const pagoPorCuota = new Map(primerosPagos.map((pago) => [String(pago.cuotaId), pago]));
  const bloquePorFraterno = new Map(asignaciones.filter((asignacion: any) => asignacion.bloqueId).map((asignacion: any) => [String(asignacion.fraternoId), asignacion.bloqueId]));
  const bloquePorGuia = new Map<string, any>();
  bloquesGuia.forEach((bloque: any) => [...(bloque.guiasIds ?? []), bloque.guiaId].filter(Boolean).forEach((id: any) => bloquePorGuia.set(String(id), bloque)));

  const personas = usuarios.map((usuario: any) => {
    const fraterno: any = fraternoPorUsuario.get(String(usuario._id));
    const preregistro: any = preregistroPorUsuario.get(String(usuario._id));
    const guia: any = guiaPorUsuario.get(String(usuario._id));
    const perfilFraterno = Boolean(fraterno);
    const participante = Boolean(preregistro);
    const talla: any = participante ? tallaPorFraterno.get(String(fraterno?._id)) ?? tallaPorUsuario.get(String(usuario._id)) : null;
    const cuota: any = participante ? cuotaPorPreregistro.get(String(preregistro._id)) : null;
    const primerPago: any = cuota ? pagoPorCuota.get(String(cuota._id)) : null;
    const montoPrimeraCuota = participante ? redondearMonto(cuota?.primeraCuotaMonto ?? (cuota ? distribuirPlanPagos(cuota.montoTotal, cuota.numeroCuotasElegidas ?? 1)[0] : configuracion?.primeraCuota ?? 0)) : 0;
    const pagoEstado = estadoPrimeraCuota(participante, montoPrimeraCuota, primerPago);
    const primeraCuotaPagada = pagoEstado.pagada;
    const roles = (usuario.roles ?? []).filter((rol: any) => rol && rol.estado !== false && !rol.fechaEliminado).map(normalizarRol).filter(Boolean);
    const tallaEstado = estadoTallaPago(talla?.tallaPolera, talla?.tallaChamarra, primeraCuotaPagada, participante);
    const bloqueIntegrante: any = fraterno ? bloquePorFraterno.get(String(fraterno._id)) : null;
    const bloqueGuia: any = guia ? bloquePorGuia.get(String(guia._id)) : null;
    const bloque = bloqueGuia?.nombre ?? bloqueIntegrante?.nombre ?? "SIN BLOQUE";
    const asignacion = bloqueGuia ? `GUÍA DEL ${bloque}` : bloqueIntegrante ? `${esRol(roles, "ADMINISTRADOR") ? "ADMINISTRADOR / " : ""}FRATERNO DEL ${bloque}` : esRol(roles, "POSTULANTE") ? "POSTULANTE - SIN BLOQUE" : "SIN BLOQUE";
    return {
      usuarioId: String(usuario._id), fraternoId: String(fraterno?._id ?? ""), nombre: nombreCompleto(usuario), ci: String(usuario.ci ?? ""), codigoFraterno: String(fraterno?.numeroFraterno ?? preregistro?.numeroPreRegistro ?? ""), sexo: usuario.sexo ?? "SIN REGISTRO", telefono: String(usuario.telefono ?? ""), whatsapp: whatsapp(usuario.telefono), correo: usuario.email ?? "", roles, tipoRegistro: tipoRegistro(roles, perfilFraterno), perfilFraterno, participante, estadoInscripcion: preregistro?.estado ?? "SIN INSCRIPCIÓN", estadoUsuario: usuario.estado ?? "SIN REGISTRO", bloque, asignacion, tallaPolera: participante ? talla?.tallaPolera ?? null : null, tallaChamarra: participante ? talla?.tallaChamarra ?? null : null, ...tallaEstado, ...pagoEstado, montoPrimeraCuota, montoPagadoPrimeraCuota: pagoEstado.montoVerificadoPrimeraCuota,
    };
  }).sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));

  const fraternosReporte = personas.filter((persona) => persona.perfilFraterno);
  const resumir = (items: typeof personas) => ({ total: items.length, conTalla: items.filter((p) => p.conTalla).length, sinTalla: items.filter((p) => !p.conTalla).length, conPolera: items.filter((p) => p.tienePolera).length, sinPolera: items.filter((p) => !p.tienePolera).length, conChamarra: items.filter((p) => p.tieneChamarra).length, sinChamarra: items.filter((p) => !p.tieneChamarra).length, sinNingunaTalla: items.filter((p) => p.pendienteTalla === "AMBAS").length, primeraCuotaPagada: items.filter((p) => p.primeraCuota === "PAGADA").length, primeraCuotaPendiente: items.filter((p) => p.primeraCuota === "PENDIENTE").length, sinTallaYSinPrimeraCuota: items.filter((p) => !p.conTalla && p.primeraCuota === "PENDIENTE").length });
  const hombresFraternos = fraternosReporte.filter((persona) => persona.sexo === "HOMBRE"), mujeresFraternos = fraternosReporte.filter((persona) => persona.sexo === "MUJER");
  const resumenFraternos = resumir(fraternosReporte);
  return {
    generadoEn: new Date(), gestion: { _id: gestion._id, nombre: gestion.nombre, anio: gestion.anio },
    resumen: { ...resumenFraternos, totalUsuarios: personas.length, conPerfilFraterno: fraternosReporte.length, sinPerfilFraterno: personas.length - fraternosReporte.length, administradores: personas.filter((p) => esRol(p.roles, "ADMINISTRADOR")).length, guias: personas.filter((p) => esRol(p.roles, "GUIA") || esRol(p.roles, "GUÍA")).length, totalHombres: personas.filter((p) => p.sexo === "HOMBRE").length, totalMujeres: personas.filter((p) => p.sexo === "MUJER").length, sinBloque: personas.filter((p) => p.bloque === "SIN BLOQUE").length, hombres: resumir(hombresFraternos), mujeres: resumir(mujeresFraternos) },
    bloques: [...new Set(personas.map((persona) => persona.bloque))].sort(), personas,
  };
}
