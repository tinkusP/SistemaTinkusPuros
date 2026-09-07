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
import { TALLAS_DISPONIBLES } from "../constants/tallas";

const tieneValor = (valor?: unknown) => Boolean(String(valor ?? "").trim());
export type EstadoCampoTalla = "VALIDA" | "SIN TALLA" | "SIN DEFINIR";
export function analizarCampoTalla(valor?: unknown): { estado: EstadoCampoTalla; valorReal: string | null } {
  if (!tieneValor(valor)) return { estado: "SIN TALLA", valorReal: valor == null ? null : String(valor) };
  const valorReal = String(valor);
  return { estado: TALLAS_DISPONIBLES.includes(valorReal as typeof TALLAS_DISPONIBLES[number]) ? "VALIDA" : "SIN DEFINIR", valorReal };
}
const nombreCompleto = (usuario: any) => [usuario?.nombres, usuario?.apellidoPaterno, usuario?.apellidoMaterno].filter(Boolean).join(" ");
const whatsapp = (telefono?: string) => {
  const digitos = String(telefono ?? "").trim().replace(/\D/g, "");
  if (/^[67]\d{7}$/.test(digitos)) return `+591${digitos}`;
  if (/^591[67]\d{7}$/.test(digitos)) return `+${digitos}`;
  return null;
};

export function estadoTallaPago(tallaPolera?: string, tallaChamarra?: string, primeraCuotaPagada = false, aplica = true) {
  if (!aplica) return { tienePolera: false, tieneChamarra: false, conTalla: false, pendienteTalla: null, estadoCampoPolera: "SIN TALLA" as EstadoCampoTalla, estadoCampoChamarra: "SIN TALLA" as EstadoCampoTalla, estadoTallaPolera: "NO APLICA", estadoTallaChamarra: "NO APLICA", estadoGeneral: "USUARIO SIN PERFIL FRATERNO" };
  const analisisPolera = analizarCampoTalla(tallaPolera), analisisChamarra = analizarCampoTalla(tallaChamarra);
  const tienePolera = analisisPolera.estado === "VALIDA", tieneChamarra = analisisChamarra.estado === "VALIDA", conTalla = tienePolera && tieneChamarra;
  const pendienteTalla = conTalla ? null : !tienePolera && !tieneChamarra ? "AMBAS" : !tienePolera ? "POLERA" : "CHAMARRA";
  const estadoGeneral = !conTalla && !primeraCuotaPagada ? "SIN TALLA + SIN PRIMERA CUOTA" : !conTalla ? "SIN TALLA" : !primeraCuotaPagada ? "SIN PRIMERA CUOTA" : "COMPLETO";
  return { tienePolera, tieneChamarra, conTalla, pendienteTalla, estadoCampoPolera: analisisPolera.estado, estadoCampoChamarra: analisisChamarra.estado, estadoTallaPolera: tienePolera ? "REGISTRADA" : analisisPolera.estado === "SIN DEFINIR" ? "SIN DEFINIR" : "SIN REGISTRAR", estadoTallaChamarra: tieneChamarra ? "REGISTRADA" : analisisChamarra.estado === "SIN DEFINIR" ? "SIN DEFINIR" : "SIN REGISTRAR", estadoGeneral };
}

export function clasificarEstadoTalla(tallaPolera?: string, tallaChamarra?: string) {
  const estadoPolera = analizarCampoTalla(tallaPolera).estado, estadoChamarra = analizarCampoTalla(tallaChamarra).estado;
  if (estadoPolera === "SIN DEFINIR" || estadoChamarra === "SIN DEFINIR") return "SIN DEFINIR";
  const polera = estadoPolera === "VALIDA", chamarra = estadoChamarra === "VALIDA";
  return polera && chamarra ? "TALLAS COMPLETAS" : polera ? "SOLO POLERA" : chamarra ? "SOLO CHAMARRA" : "SIN TALLA";
}

export function estadoPrimeraCuota(aplica: boolean, montoEsperado: number, pago?: { monto?: number; estadoRevision?: string } | null) {
  const montoRegistrado = aplica ? redondearMonto(pago?.monto ?? 0) : 0;
  const verificacion = !aplica ? "NO APLICA" : pago?.estadoRevision ?? "SIN REGISTRO";
  const pagada = aplica && verificacion === "VERIFICADO";
  const montoVerificado = pagada ? montoRegistrado : 0;
  return { primeraCuota: !aplica ? "SIN REGISTRO / NO APLICA" : pagada ? "PAGADA" : "PENDIENTE", estadoPago: !aplica ? "NO APLICA" : pagada ? "PAGO VERIFICADO" : pago ? "PAGO REGISTRADO" : "SIN PAGO", verificacionPrimeraCuota: verificacion, montoRegistradoPrimeraCuota: montoRegistrado, montoVerificadoPrimeraCuota: montoVerificado, saldoPrimeraCuota: aplica ? redondearMonto(Math.max(0, montoEsperado - montoVerificado)) : 0, pagada };
}

export function resumirPagoReporte(aplica: boolean, cuota: any, pagos: any[]) {
  if (!aplica) return { estadoPagoReporte: "NO APLICA", estadoVerificacionPago: "NO APLICA" };
  const activos = pagos.filter((pago) => !pago.fechaEliminado);
  const pendientes = activos.filter((pago) => pago.estadoRevision === "PENDIENTE");
  const verificados = activos.filter((pago) => pago.estadoRevision === "VERIFICADO");
  const observados = activos.filter((pago) => pago.estadoRevision === "OBSERVADO");
  const rechazados = activos.filter((pago) => pago.estadoRevision === "RECHAZADO");
  const montoPagado = redondearMonto(cuota?.montoPagado ?? verificados.reduce((total, pago) => total + Number(pago.monto ?? 0), 0));
  const saldo = redondearMonto(cuota?.saldo ?? cuota?.montoTotal ?? 0);
  const estadoVerificacionPago = pendientes.length ? "PENDIENTE DE VERIFICACIÓN" : verificados.length ? "VERIFICADO" : observados.length ? "OBSERVADO" : rechazados.length ? "RECHAZADO" : "SIN REGISTRO";
  const estadoPagoReporte = pendientes.length ? "PENDIENTE DE VERIFICACIÓN" : montoPagado > 0 && (saldo <= 0 || cuota?.estado === "PAGADA") ? "PAGO COMPLETO" : montoPagado > 0 ? "PAGO PARCIAL" : activos.length ? "PAGO REGISTRADO" : "SIN PAGO";
  return { estadoPagoReporte, estadoVerificacionPago };
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
    .select("nombres apellidoPaterno apellidoMaterno ci sexo telefono email roles estado fechaCreado")
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
  const pagos = await DetalleCuota.find({ cuotaId: { $in: cuotas.map((cuota) => cuota._id) }, fechaEliminado: null }).sort({ numeroPago: 1, fechaPago: 1 }).lean();

  const fraternoPorUsuario = new Map(fraternos.map((fraterno) => [String(fraterno.usuarioId), fraterno]));
  const preregistroPorUsuario = new Map(preregistros.map((preregistro: any) => [String(preregistro.usuarioId), preregistro]));
  const guiaPorUsuario = new Map(guias.map((guia: any) => [String(guia.usuarioId), guia]));
  const tallaPorFraterno = new Map(tallas.filter((talla: any) => talla.fraternoId).map((talla: any) => [String(talla.fraternoId), talla]));
  const tallaPorUsuario = new Map(tallas.filter((talla: any) => talla.usuarioId).map((talla: any) => [String(talla.usuarioId), talla]));
  const cuotaPorPreregistro = new Map(cuotas.map((cuota) => [String(cuota.preregistroId), cuota]));
  const pagosPorCuota = new Map<string, any[]>();
  pagos.forEach((pago: any) => pagosPorCuota.set(String(pago.cuotaId), [...(pagosPorCuota.get(String(pago.cuotaId)) ?? []), pago]));
  const bloquePorFraterno = new Map(asignaciones.filter((asignacion: any) => asignacion.bloqueId).map((asignacion: any) => [String(asignacion.fraternoId), asignacion.bloqueId]));
  const bloquePorGuia = new Map<string, any>();
  bloquesGuia.forEach((bloque: any) => [...(bloque.guiasIds ?? []), bloque.guiaId].filter(Boolean).forEach((id: any) => bloquePorGuia.set(String(id), bloque)));

  const personas = usuarios.map((usuario: any) => {
    const fraterno: any = fraternoPorUsuario.get(String(usuario._id));
    const preregistro: any = preregistroPorUsuario.get(String(usuario._id));
    const guia: any = guiaPorUsuario.get(String(usuario._id));
    const perfilFraterno = Boolean(fraterno);
    const participante = Boolean(preregistro);
    const talla: any = tallaPorFraterno.get(String(fraterno?._id)) ?? tallaPorUsuario.get(String(usuario._id)) ?? null;
    const cuota: any = participante ? cuotaPorPreregistro.get(String(preregistro._id)) : null;
    const pagosCuota: any[] = cuota ? pagosPorCuota.get(String(cuota._id)) ?? [] : [];
    const primerPago: any = pagosCuota.find((pago) => pago.numeroPago === 1);
    const montoPrimeraCuota = participante ? redondearMonto(cuota?.primeraCuotaMonto ?? (cuota ? distribuirPlanPagos(cuota.montoTotal, cuota.numeroCuotasElegidas ?? 1)[0] : configuracion?.primeraCuota ?? 0)) : 0;
    const pagoEstado = estadoPrimeraCuota(participante, montoPrimeraCuota, primerPago);
    const primeraCuotaPagada = pagoEstado.pagada;
    const roles = (usuario.roles ?? []).filter((rol: any) => rol && rol.estado !== false && !rol.fechaEliminado).map(normalizarRol).filter(Boolean);
    const tallaEstado = estadoTallaPago(talla?.tallaPolera, talla?.tallaChamarra, primeraCuotaPagada, true);
    const estadoTalla = clasificarEstadoTalla(talla?.tallaPolera, talla?.tallaChamarra);
    const bloqueIntegrante: any = fraterno ? bloquePorFraterno.get(String(fraterno._id)) : null;
    const bloqueGuia: any = guia ? bloquePorGuia.get(String(guia._id)) : null;
    const bloque = bloqueGuia?.nombre ?? bloqueIntegrante?.nombre ?? "SIN BLOQUE";
    const asignacion = bloqueGuia ? `GUÍA DEL ${bloque}` : bloqueIntegrante ? `${esRol(roles, "ADMINISTRADOR") ? "ADMINISTRADOR / " : ""}FRATERNO DEL ${bloque}` : esRol(roles, "POSTULANTE") ? "POSTULANTE - SIN BLOQUE" : "SIN BLOQUE";
    const pagosVerificados = pagosCuota.filter((pago) => pago.estadoRevision === "VERIFICADO");
    const pagosPendientes = pagosCuota.filter((pago) => pago.estadoRevision === "PENDIENTE");
    const numeroPagoMayor = pagosCuota.reduce((mayor, pago) => Math.max(mayor, Number(pago.numeroPago ?? 0)), 0);
    const numeroCuotas = participante ? Math.max(Number(cuota?.numeroCuotasElegidas ?? 0), numeroPagoMayor) : 0;
    const montoRegistradoTotal = redondearMonto(pagosCuota.reduce((total, pago) => total + Number(pago.monto ?? 0), 0));
    const montoVerificadoTotal = redondearMonto(pagosVerificados.reduce((total, pago) => total + Number(pago.monto ?? 0), 0));
    const resumenPago = resumirPagoReporte(participante, cuota, pagosCuota);
    const estadoMedicion = estadoTalla;
    const sinPagoYSinTalla = participante && pagosCuota.length === 0 && !tallaEstado.conTalla;
    const pagoSinTalla = participante && pagosVerificados.length > 0 && !tallaEstado.conTalla;
    const prioridadSeguimiento = sinPagoYSinTalla ? "ALTA" : pagoSinTalla || pagosPendientes.length > 0 ? "MEDIA" : "BAJA";
    const problemasCalidad = [!usuario.telefono && "TELÉFONO VACÍO", !usuario.ci && "CI VACÍO", !usuario.email && "CORREO VACÍO", !usuario.sexo && "SEXO VACÍO", roles.length === 0 && "SIN ROLES", participante && bloque === "SIN BLOQUE" && "SIN BLOQUE", ["SOLO POLERA", "SOLO CHAMARRA"].includes(estadoTalla) && "TALLA PARCIAL", estadoTalla === "SIN DEFINIR" && "VALOR DE TALLA NO RECONOCIDO", pagoEstado.primeraCuota === "PENDIENTE" && pagoEstado.saldoPrimeraCuota === 0 && "PAGO INCONSISTENTE"].filter(Boolean);
    return {
      usuarioId: String(usuario._id), fraternoId: String(fraterno?._id ?? ""), nombre: nombreCompleto(usuario), ci: String(usuario.ci ?? ""), codigoFraterno: String(fraterno?.numeroFraterno ?? preregistro?.numeroPreRegistro ?? ""), sexo: usuario.sexo ?? "SIN REGISTRO", telefono: String(usuario.telefono ?? ""), whatsapp: whatsapp(usuario.telefono), correo: usuario.email ?? "", roles, tipoRegistro: tipoRegistro(roles, perfilFraterno), perfilFraterno, participante, estadoInscripcion: preregistro?.estado ?? "SIN INSCRIPCIÓN", estadoUsuario: usuario.estado ?? "SIN REGISTRO", bloque, asignacion, tallaPolera: talla?.tallaPolera ?? null, tallaChamarra: talla?.tallaChamarra ?? null, ...tallaEstado, estadoTalla, estadoMedicion, ...pagoEstado, ...resumenPago, montoPrimeraCuota, montoPagadoPrimeraCuota: pagoEstado.montoVerificadoPrimeraCuota, planPagos: numeroCuotas ? `${numeroCuotas} CUOTA${numeroCuotas === 1 ? "" : "S"}` : participante ? "SIN PLAN" : "NO APLICA", numeroCuotas, cuotasPagadas: pagosVerificados.length, cuotasPendientes: Math.max(0, numeroCuotas - pagosVerificados.length), cuotasPorVerificar: pagosPendientes.length, montoRegistradoTotal, montoVerificadoTotal, totalPagado: participante ? redondearMonto(cuota?.montoPagado ?? montoVerificadoTotal) : 0, saldoTotal: participante ? redondearMonto(cuota?.saldo ?? montoPrimeraCuota) : 0, estadoPagoGeneral: resumenPago.estadoPagoReporte, fechaUltimoPago: pagosCuota.at(-1)?.fechaPago ?? null, fechaRegistro: preregistro?.fechaRegistro ?? usuario.fechaCreado ?? null, prioridadSeguimiento, motivoSeguimiento: sinPagoYSinTalla ? "SIN PAGO + SIN TALLA" : pagoSinTalla ? "PAGO VERIFICADO + SIN TALLA" : pagosPendientes.length ? "PAGO PENDIENTE DE VERIFICACIÓN" : "", problemasCalidad,
    };
  }).sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));

  const fraternosReporte = personas.filter((persona) => persona.perfilFraterno);
  const resumir = (items: typeof personas) => ({ total: items.length, conTalla: items.filter((p) => p.conTalla).length, sinTalla: items.filter((p) => !p.conTalla).length, conPolera: items.filter((p) => p.tienePolera).length, sinPolera: items.filter((p) => !p.tienePolera).length, conChamarra: items.filter((p) => p.tieneChamarra).length, sinChamarra: items.filter((p) => !p.tieneChamarra).length, sinNingunaTalla: items.filter((p) => p.pendienteTalla === "AMBAS").length, primeraCuotaPagada: items.filter((p) => p.primeraCuota === "PAGADA").length, primeraCuotaPendiente: items.filter((p) => p.primeraCuota === "PENDIENTE").length, sinTallaYSinPrimeraCuota: items.filter((p) => !p.conTalla && p.primeraCuota === "PENDIENTE").length, conTallaSinPago: items.filter((p) => p.conTalla && p.estadoPagoReporte === "SIN PAGO").length, conTallaPagoPendiente: items.filter((p) => p.conTalla && p.estadoPagoReporte === "PENDIENTE DE VERIFICACIÓN").length, conTallaPagoVerificado: items.filter((p) => p.conTalla && p.montoVerificadoTotal > 0).length, conTallaPagoParcial: items.filter((p) => p.conTalla && p.estadoPagoReporte === "PAGO PARCIAL").length, conTallaPagoCompleto: items.filter((p) => p.conTalla && p.estadoPagoReporte === "PAGO COMPLETO").length });
  const hombresFraternos = fraternosReporte.filter((persona) => persona.sexo === "HOMBRE"), mujeresFraternos = fraternosReporte.filter((persona) => persona.sexo === "MUJER");
  const resumenFraternos = resumir(fraternosReporte);
  const tallasDisponibles = [...TALLAS_DISPONIBLES];
  const distribucionTallas: Array<{ talla: string; poleraHombres: number; poleraMujeres: number; chamarraHombres: number; chamarraMujeres: number }> = tallasDisponibles.map((talla) => ({ talla, poleraHombres: personas.filter((p) => p.sexo === "HOMBRE" && p.tallaPolera === talla).length, poleraMujeres: personas.filter((p) => p.sexo === "MUJER" && p.tallaPolera === talla).length, chamarraHombres: personas.filter((p) => p.sexo === "HOMBRE" && p.tallaChamarra === talla).length, chamarraMujeres: personas.filter((p) => p.sexo === "MUJER" && p.tallaChamarra === talla).length }));
  distribucionTallas.push({ talla: "SIN TALLA", poleraHombres: personas.filter((p) => p.sexo === "HOMBRE" && p.estadoCampoPolera === "SIN TALLA").length, poleraMujeres: personas.filter((p) => p.sexo === "MUJER" && p.estadoCampoPolera === "SIN TALLA").length, chamarraHombres: personas.filter((p) => p.sexo === "HOMBRE" && p.estadoCampoChamarra === "SIN TALLA").length, chamarraMujeres: personas.filter((p) => p.sexo === "MUJER" && p.estadoCampoChamarra === "SIN TALLA").length });
  distribucionTallas.push({ talla: "SIN DEFINIR", poleraHombres: personas.filter((p) => p.sexo === "HOMBRE" && p.estadoCampoPolera === "SIN DEFINIR").length, poleraMujeres: personas.filter((p) => p.sexo === "MUJER" && p.estadoCampoPolera === "SIN DEFINIR").length, chamarraHombres: personas.filter((p) => p.sexo === "HOMBRE" && p.estadoCampoChamarra === "SIN DEFINIR").length, chamarraMujeres: personas.filter((p) => p.sexo === "MUJER" && p.estadoCampoChamarra === "SIN DEFINIR").length });
  const personasSinDefinir = personas.filter((p) => p.estadoCampoPolera === "SIN DEFINIR" || p.estadoCampoChamarra === "SIN DEFINIR");
  const camposSinDefinir = personasSinDefinir.reduce((total, persona) => total + Number(persona.estadoCampoPolera === "SIN DEFINIR") + Number(persona.estadoCampoChamarra === "SIN DEFINIR"), 0);
  return {
    generadoEn: new Date(), gestion: { _id: gestion._id, nombre: gestion.nombre, anio: gestion.anio },
    resumen: { ...resumenFraternos, totalUsuarios: personas.length, conPerfilFraterno: fraternosReporte.length, sinPerfilFraterno: personas.length - fraternosReporte.length, administradores: personas.filter((p) => esRol(p.roles, "ADMINISTRADOR")).length, guias: personas.filter((p) => esRol(p.roles, "GUIA") || esRol(p.roles, "GUÍA")).length, totalHombres: personas.filter((p) => p.sexo === "HOMBRE").length, totalMujeres: personas.filter((p) => p.sexo === "MUJER").length, sinBloque: personas.filter((p) => p.bloque === "SIN BLOQUE").length, hombres: resumir(hombresFraternos), mujeres: resumir(mujeresFraternos) },
    resumenGeneralTallas: { totalUsuarios: personas.length, totalHombres: personas.filter((p) => p.sexo === "HOMBRE").length, totalMujeres: personas.filter((p) => p.sexo === "MUJER").length, tallasCompletas: personas.filter((p) => p.estadoTalla === "TALLAS COMPLETAS").length, soloPolera: personas.filter((p) => p.estadoTalla === "SOLO POLERA").length, soloChamarra: personas.filter((p) => p.estadoTalla === "SOLO CHAMARRA").length, sinTalla: personas.filter((p) => p.estadoTalla === "SIN TALLA").length, sinDefinir: personasSinDefinir.length },
    tallasDisponibles, distribucionTallas, resumenSinDefinir: { personasUnicas: personasSinDefinir.length, camposPrenda: camposSinDefinir }, personasSinDefinir, bloques: [...new Set(personas.map((persona) => persona.bloque))].sort(), personas,
  };
}
