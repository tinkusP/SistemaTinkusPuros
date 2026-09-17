import Bloque from "../models/Bloque";
import ConfiguracionPago from "../models/ConfiguracionPago";
import Cuota from "../models/Cuota";
import DetalleBloque from "../models/DetalleBloque";
import DetalleCuota from "../models/DetalleCuota";
import Fraterno from "../models/Fraterno";
import Gestion from "../models/Gestion";
import Guia from "../models/Guia";
import PerfilUsuario from "../models/PerfilUsuario";
import PostulanteGuia from "../models/PostulanteGuia";
import Preregistro from "../models/Preregistro";
import Rol from "../models/Rol";
import TallaFraterno from "../models/TallaFraterno";

type TipoBeneficio = "FREE" | "EXENTO" | "DESCUENTO" | "REVISAR";

const REFERENCIAS_BENEFICIO: Array<{
  etiqueta: string;
  palabras: string[];
  tipo: TipoBeneficio;
  porcentaje?: number;
  detalle: string;
}> = [
  { etiqueta: "DIEGO", palabras: ["DIEGO"], tipo: "FREE", detalle: "Referencia administrativa declarada" },
  { etiqueta: "YO", palabras: [], tipo: "FREE", detalle: "No identificable sin nombre o CI" },
  { etiqueta: "MARTIN", palabras: ["MARTIN"], tipo: "FREE", detalle: "Referencia administrativa declarada" },
  { etiqueta: "LAURA", palabras: ["LAURA"], tipo: "FREE", detalle: "Referencia administrativa declarada" },
  { etiqueta: "KAMIL", palabras: ["KAMIL"], tipo: "FREE", detalle: "Referencia administrativa declarada" },
  { etiqueta: "VIDAL", palabras: ["VIDAL"], tipo: "FREE", detalle: "Referencia administrativa declarada" },
  { etiqueta: "LOBO", palabras: ["LOBO"], tipo: "FREE", detalle: "Referencia administrativa declarada" },
  { etiqueta: "JONNY HERRERA CONDORI", palabras: ["JONNY", "HERRERA", "CONDORI"], tipo: "EXENTO", detalle: "Caso conocido solicitado para revisión" },
  { etiqueta: "KENJI GROVER SADAKATA", palabras: ["KENJI", "GROVER", "SADAKATA"], tipo: "EXENTO", detalle: "Caso conocido solicitado para revisión" },
  { etiqueta: "GAUSS", palabras: ["GAUSS"], tipo: "REVISAR", detalle: "Beneficio pendiente de confirmación" },
  { etiqueta: "BRAYAN", palabras: ["BRAYAN"], tipo: "REVISAR", detalle: "Beneficio pendiente de confirmación" },
  { etiqueta: "CARLOS", palabras: ["CARLOS"], tipo: "REVISAR", detalle: "Beneficio pendiente de confirmación" },
  { etiqueta: "OLO", palabras: ["OLO"], tipo: "DESCUENTO", detalle: "Descuento declarado pendiente de formalización" },
  { etiqueta: "ABI", palabras: ["ABI"], tipo: "DESCUENTO", detalle: "Descuento declarado pendiente de formalización" },
  { etiqueta: "DYLAN", palabras: ["DYLAN"], tipo: "DESCUENTO", porcentaje: 50, detalle: "Descuento declarado del 50 %, pendiente de formalización" },
];

const sid = (valor: any) => String(valor?._id ?? valor ?? "");
const dinero = (valor: unknown) => Number((Number(valor) || 0).toFixed(2));
const sumar = (filas: any[], campo: string) => dinero(filas.reduce((total, fila) => total + Number(fila[campo] || 0), 0));
const nombreCompleto = (usuario: any) => [usuario?.nombres, usuario?.apellidoPaterno, usuario?.apellidoMaterno].filter(Boolean).join(" ").trim();
const normalizar = (valor: unknown) => String(valor ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
const tienePalabras = (texto: string, palabras: string[]) => palabras.length > 0 && palabras.every((palabra) => (` ${texto} `).includes(` ${palabra} `));
const tieneTalla = (valor: unknown) => !["", "SIN DEFINIR", "SIN REGISTRO", "NULL", "UNDEFINED", "-", "—"].includes(normalizar(valor));
const tipoOrigen = (valor: unknown) => ["INTERNO", "INTERNO_UMSA"].includes(String(valor ?? "").toUpperCase()) ? "INTERNO" : ["EXTERNO", "EXTERNO_UMSA", "EXTERNO_NO_UMSA"].includes(String(valor ?? "").toUpperCase()) ? "EXTERNO" : "SIN CLASIFICAR";

export function estadoMovimientoAuditoria(movimiento?: { estadoRevision?: string; monto?: number; fechaPago?: unknown }) {
  if (!movimiento) return { estado: "SIN REGISTRO", monto: 0, fecha: null };
  return { estado: String(movimiento.estadoRevision ?? "PENDIENTE"), monto: dinero(movimiento.monto), fecha: movimiento.fechaPago ?? null };
}

export function clasificarParticipanteAuditoria(datos: {
  origen: string;
  exento: boolean;
  montoCuota: number;
  tarifaNormal: number;
  referencia?: TipoBeneficio;
  referenciaUnica?: boolean;
}) {
  if (datos.exento) return datos.referencia === "FREE" && datos.referenciaUnica ? "FREE" : "EXENTO";
  if (datos.montoCuota > 0 && datos.tarifaNormal > 0 && datos.montoCuota < datos.tarifaNormal) return "DESCUENTO";
  return datos.origen === "INTERNO" ? "INTERNO" : datos.origen === "EXTERNO" ? "EXTERNO" : "SIN CLASIFICAR";
}

export function pagosDuplicadosAuditoria(pagos: any[]) {
  const huellas = new Map<string, number>();
  const comprobantes = new Map<string, number>();
  for (const pago of pagos) {
    const fecha = pago.fechaPago ? new Date(pago.fechaPago).toISOString().slice(0, 10) : "SIN_FECHA";
    const huella = `${pago.numeroPago ?? "SIN_NUMERO"}|${dinero(pago.monto)}|${fecha}|${pago.metodoPago ?? "SIN_METODO"}`;
    huellas.set(huella, (huellas.get(huella) ?? 0) + 1);
    const comprobante = String(pago.baucherImagen || pago.respaldoAdminImagen || "").trim();
    if (comprobante) comprobantes.set(comprobante, (comprobantes.get(comprobante) ?? 0) + 1);
  }
  return {
    huellas: [...huellas.entries()].filter(([, cantidad]) => cantidad > 1).map(([huella, cantidad]) => `${huella} (${cantidad})`),
    comprobantes: [...comprobantes.entries()].filter(([, cantidad]) => cantidad > 1).map(([archivo, cantidad]) => `${archivo} (${cantidad})`),
  };
}

export async function obtenerAuditoriaParticipacion() {
  const gestion: any = await Gestion.findOne({ estado: { $in: ["ACTIVA", "INSCRIPCIONES"] }, fechaEliminado: null }).sort({ anio: -1 }).lean();
  if (!gestion) return { generadoEn: new Date(), gestion: null, resumen: {}, personas: [], conBloque: [], sinBloqueConPago: [], sinBloqueConTalla: [], exentos: [], descuentos: [], sinPago: [], inconsistencias: [], controlExenciones: [], referenciasBeneficio: [] };

  const [preregistros, fraternos, bloques, tallas, guias, configuracion]: any[] = await Promise.all([
    Preregistro.find({ gestionId: gestion._id, fechaEliminado: null }).sort({ fechaRegistro: -1 }).lean(),
    Fraterno.find({ gestionId: gestion._id, fechaEliminado: null }).lean(),
    Bloque.find({ gestionId: gestion._id }).lean(),
    TallaFraterno.find({}).lean(),
    Guia.find({ gestionId: gestion._id, estado: "ACTIVO" }).lean(),
    ConfiguracionPago.findOne({ gestionId: gestion._id, activo: true }).lean(),
  ]);

  const preregistroIds = preregistros.map((registro: any) => registro._id);
  const cuotas: any[] = await Cuota.find({ preregistroId: { $in: preregistroIds }, fechaEliminado: null }).lean();
  const pagos: any[] = await DetalleCuota.find({ cuotaId: { $in: cuotas.map((cuota) => cuota._id) }, fechaEliminado: null }).sort({ fechaPago: 1, fechaCreado: 1 }).lean();
  const postulantes: any[] = await PostulanteGuia.find({ preregistroId: { $in: preregistroIds }, fechaEliminado: null, estado: { $nin: ["RETIRADO", "NO_ELEGIDO"] } }).lean();
  const asignaciones: any[] = await DetalleBloque.find({ fraternoId: { $in: fraternos.map((fraterno: any) => fraterno._id) }, fechaEliminado: null }).sort({ fechaAsignacion: -1 }).lean();

  const idsBase = [
    ...preregistros.map((registro: any) => registro.usuarioId),
    ...fraternos.map((fraterno: any) => fraterno.usuarioId),
    ...guias.map((guia: any) => guia.usuarioId),
    ...tallas.map((talla: any) => talla.usuarioId).filter(Boolean),
    ...cuotas.map((cuota: any) => cuota.usuarioExencion).filter(Boolean),
  ];
  const usuarios: any[] = await PerfilUsuario.find({
    _id: { $in: [...new Set(idsBase.map(sid))] },
    fechaEliminado: null,
    estado: { $nin: ["INACTIVO", "ELIMINADO"] },
  }).select("nombres apellidoPaterno apellidoMaterno ci registroUniversitario telefono email sexo roles gestion tipoOrigen tipoFraterno estado").lean();
  const roles: any[] = await Rol.find({ _id: { $in: usuarios.flatMap((usuario) => usuario.roles ?? []) }, fechaEliminado: null, estado: true }).select("codigo nombre").lean();

  const usuarioMap = new Map(usuarios.map((usuario) => [sid(usuario), usuario]));
  const rolMap = new Map(roles.map((rol) => [sid(rol), String(rol.codigo || rol.nombre).toUpperCase()]));
  const preregistrosUsuario = new Map<string, any[]>();
  for (const preregistro of preregistros) preregistrosUsuario.set(sid(preregistro.usuarioId), [...(preregistrosUsuario.get(sid(preregistro.usuarioId)) ?? []), preregistro]);
  const cuotaPorPreregistro = new Map<string, any>(cuotas.map((cuota) => [sid(cuota.preregistroId), cuota]));
  const pagosPorCuota = new Map<string, any[]>();
  for (const pago of pagos) pagosPorCuota.set(sid(pago.cuotaId), [...(pagosPorCuota.get(sid(pago.cuotaId)) ?? []), pago]);
  const usosComprobante = new Map<string, number>();
  for (const pago of pagos) {
    const archivo = String(pago.baucherImagen || pago.respaldoAdminImagen || "").trim();
    if (archivo) usosComprobante.set(archivo, (usosComprobante.get(archivo) ?? 0) + 1);
  }
  const fraternosUsuario = new Map<string, any[]>();
  for (const fraterno of fraternos) fraternosUsuario.set(sid(fraterno.usuarioId), [...(fraternosUsuario.get(sid(fraterno.usuarioId)) ?? []), fraterno]);
  const bloqueMap = new Map<string, any>(bloques.map((bloque: any) => [sid(bloque), bloque]));
  const asignacionesActivas = asignaciones.filter((asignacion) => asignacion.estado === "ACTIVO" && bloqueMap.get(sid(asignacion.bloqueId))?.estado === "ACTIVO");
  const asignacionesPorFraterno = new Map<string, any[]>();
  for (const asignacion of asignacionesActivas) asignacionesPorFraterno.set(sid(asignacion.fraternoId), [...(asignacionesPorFraterno.get(sid(asignacion.fraternoId)) ?? []), asignacion]);
  const tallaPorUsuario = new Map<string, any>(tallas.filter((talla) => talla.usuarioId).map((talla) => [sid(talla.usuarioId), talla]));
  const tallaPorFraterno = new Map<string, any>(tallas.filter((talla) => talla.fraternoId).map((talla) => [sid(talla.fraternoId), talla]));
  const guiaPorUsuario = new Map<string, any>(guias.map((guia) => [sid(guia.usuarioId), guia]));
  const postulantePorPreregistro = new Map<string, any>(postulantes.map((postulante) => [sid(postulante.preregistroId), postulante]));
  const nombreGuia = new Map<string, string>(guias.map((guia) => [sid(guia), nombreCompleto(usuarioMap.get(sid(guia.usuarioId))) || "GUÍA SIN PERFIL"]));
  const guiasBloque = new Map<string, string[]>();
  for (const bloque of bloques) {
    const idsGuias = [...new Set<string>([...(bloque.guiasIds ?? []).map(sid), sid(bloque.guiaId)].filter(Boolean))];
    guiasBloque.set(sid(bloque), idsGuias.map((guiaId) => nombreGuia.get(guiaId) ?? "GUÍA NO VIGENTE"));
  }

  const candidatos = usuarios.filter((usuario) => {
    const usuarioId = sid(usuario);
    const preregistrosPersona = preregistrosUsuario.get(usuarioId) ?? [];
    const fraternosPersona = fraternosUsuario.get(usuarioId) ?? [];
    const tieneCuota = preregistrosPersona.some((preregistro) => cuotaPorPreregistro.has(sid(preregistro)));
    const tieneBloqueActivo = fraternosPersona.some((fraterno) => (asignacionesPorFraterno.get(sid(fraterno)) ?? []).length > 0);
    const talla = tallaPorUsuario.get(usuarioId) ?? fraternosPersona.map((fraterno) => tallaPorFraterno.get(sid(fraterno))).find(Boolean);
    const perteneceGestion = preregistrosPersona.length > 0 || fraternosPersona.length > 0 || (usuario.gestion ?? []).some((idGestion: any) => sid(idGestion) === sid(gestion));
    return tieneCuota || tieneBloqueActivo || (perteneceGestion && Boolean(talla) && (tieneTalla(talla.tallaPolera) || tieneTalla(talla.tallaChamarra)));
  });

  const coincidenciasReferencia = new Map<string, string[]>();
  for (const referencia of REFERENCIAS_BENEFICIO) {
    coincidenciasReferencia.set(referencia.etiqueta, referencia.palabras.length ? candidatos.filter((usuario) => tienePalabras(normalizar(nombreCompleto(usuario)), referencia.palabras)).map(sid) : []);
  }
  const referenciaUsuario = new Map<string, typeof REFERENCIAS_BENEFICIO>();
  for (const referencia of REFERENCIAS_BENEFICIO) {
    for (const usuarioId of coincidenciasReferencia.get(referencia.etiqueta) ?? []) referenciaUsuario.set(usuarioId, [...(referenciaUsuario.get(usuarioId) ?? []), referencia]);
  }

  const tarifaInterno = dinero(configuracion?.tarifaInterno || 770);
  const tarifaExterno = dinero(configuracion?.tarifaExterno || 850);
  const personas = candidatos.map((usuario) => {
    const usuarioId = sid(usuario);
    const preregistrosPersona = preregistrosUsuario.get(usuarioId) ?? [];
    const preregistro = preregistrosPersona.find((item) => cuotaPorPreregistro.has(sid(item))) ?? preregistrosPersona[0];
    const cuota: any = preregistro ? cuotaPorPreregistro.get(sid(preregistro)) : null;
    const movimientos = cuota ? pagosPorCuota.get(sid(cuota)) ?? [] : [];
    const fraternosPersona = fraternosUsuario.get(usuarioId) ?? [];
    const fraterno = fraternosPersona.find((item) => item.estado === "ACTIVO") ?? fraternosPersona[0];
    const asignacionesPersona = fraternosPersona.flatMap((item) => asignacionesPorFraterno.get(sid(item)) ?? []);
    const asignacion = asignacionesPersona[0];
    const bloque: any = asignacion ? bloqueMap.get(sid(asignacion.bloqueId)) : null;
    const talla: any = tallaPorUsuario.get(usuarioId) ?? fraternosPersona.map((item) => tallaPorFraterno.get(sid(item))).find(Boolean);
    const polera = tieneTalla(talla?.tallaPolera);
    const chamarra = tieneTalla(talla?.tallaChamarra);
    const rolesActuales = [...new Set((usuario.roles ?? []).map((rolId: any) => rolMap.get(sid(rolId))).filter(Boolean))] as string[];
    if (guiaPorUsuario.has(usuarioId) && !rolesActuales.includes("GUIA")) rolesActuales.push("GUIA");
    if (fraterno?.estado === "ACTIVO" && !rolesActuales.includes("FRATERNO")) rolesActuales.push("FRATERNO");
    if (preregistro && postulantePorPreregistro.has(sid(preregistro)) && !rolesActuales.includes("POSTULANTE")) rolesActuales.push("POSTULANTE");
    const origen = cuota?.tipoOrigenTarifa ?? tipoOrigen(usuario.tipoOrigen);
    const tarifaNormal = origen === "INTERNO" ? tarifaInterno : origen === "EXTERNO" ? tarifaExterno : 0;
    const referencias = referenciaUsuario.get(usuarioId) ?? [];
    const referencia = referencias[0];
    const referenciaUnica = referencia ? (coincidenciasReferencia.get(referencia.etiqueta) ?? []).length === 1 : false;
    const tipoParticipante = clasificarParticipanteAuditoria({ origen, exento: Boolean(cuota?.exentoPago), montoCuota: dinero(cuota?.montoTotal), tarifaNormal, referencia: referencia?.tipo, referenciaUnica });
    const montoOriginal = tarifaNormal;
    const montoEsperadoRegistrado = dinero(cuota?.montoTotal);
    const montoEsperado = cuota?.exentoPago ? 0 : montoEsperadoRegistrado;
    const verificados = movimientos.filter((movimiento) => movimiento.estadoRevision === "VERIFICADO");
    const totalPagado = dinero(movimientos.reduce((total, movimiento) => total + Number(movimiento.monto || 0), 0));
    const totalVerificado = dinero(verificados.reduce((total, movimiento) => total + Number(movimiento.monto || 0), 0));
    const saldoPendiente = cuota?.exentoPago ? 0 : dinero(Math.max(0, montoEsperadoRegistrado - totalVerificado));
    const porNumero = new Map<number, any>();
    for (const movimiento of movimientos) if (!porNumero.has(Number(movimiento.numeroPago))) porNumero.set(Number(movimiento.numeroPago), movimiento);
    const duplicados = pagosDuplicadosAuditoria(movimientos);
    const problemas: string[] = [];
    if (asignacionesPersona.length > 1) problemas.push("MÁS DE UNA ASIGNACIÓN ACTIVA A BLOQUE");
    if (preregistrosPersona.length > 1) problemas.push("MÁS DE UN PRERREGISTRO EN LA GESTIÓN");
    if (fraternosPersona.length > 1) problemas.push("MÁS DE UN PERFIL FRATERNO EN LA GESTIÓN");
    if (bloque && !cuota) problemas.push("TIENE BLOQUE PERO NO APARECE EN CUOTAS");
    if (cuota && !bloque) problemas.push("TIENE CUOTA PERO NO TIENE BLOQUE ACTIVO");
    if ((polera || chamarra) && !bloque) problemas.push("TIENE TALLA PERO NO TIENE BLOQUE ACTIVO");
    if (cuota && rolesActuales.some((rol) => ["ADMIN", "ADMINISTRADOR", "SUPERADMIN", "SUPERADMINISTRADOR", "GUIA"].includes(normalizar(rol).replace(/ /g, ""))) && ["INTERNO", "EXTERNO"].includes(tipoParticipante)) problemas.push("ROL ADMINISTRATIVO/GUÍA CON COBRO NORMAL; REVISAR SI CORRESPONDE");
    if (cuota?.exentoPago && montoEsperadoRegistrado > 0) problemas.push("EXENTO SIGUE INCLUIDO EN EL TOTAL ESPERADO REGISTRADO");
    if (referencias.some((item) => item.tipo === "DESCUENTO") && tipoParticipante !== "DESCUENTO") problemas.push("DESCUENTO REFERENCIADO PERO MONTO COMPLETO; NO FORMALIZADO");
    if (referencias.some((item) => ["FREE", "EXENTO"].includes(item.tipo)) && !cuota?.exentoPago) problemas.push(`${referencias.find((item) => ["FREE", "EXENTO"].includes(item.tipo))?.tipo} REFERENCIADO PERO NO FORMALIZADO`);
    if (referencia && !referenciaUnica) problemas.push(`REFERENCIA ${referencia.etiqueta} AMBIGUA; REQUIERE CI`);
    if (duplicados.huellas.length) problemas.push(`PAGOS POSIBLEMENTE DUPLICADOS: ${duplicados.huellas.join(", ")}`);
    if (duplicados.comprobantes.length) problemas.push(`COMPROBANTES REPETIDOS: ${duplicados.comprobantes.join(", ")}`);
    for (const movimiento of movimientos) {
      const archivo = String(movimiento.baucherImagen || movimiento.respaldoAdminImagen || "").trim();
      if (archivo && (usosComprobante.get(archivo) ?? 0) > 1) problemas.push(`COMPROBANTE REUTILIZADO EN ${usosComprobante.get(archivo)} REGISTROS`);
    }
    if (cuota && dinero(cuota.montoPagado) !== totalVerificado) problemas.push(`MONTO PAGADO GUARDADO ${dinero(cuota.montoPagado)} DIFIERE DE VERIFICADO ${totalVerificado}`);
    if (cuota && dinero(cuota.saldo) !== dinero(Math.max(0, montoEsperadoRegistrado - totalVerificado))) problemas.push(`SALDO GUARDADO ${dinero(cuota.saldo)} DIFIERE DEL AUDITADO ${dinero(Math.max(0, montoEsperadoRegistrado - totalVerificado))}`);
    if (cuota?.exentoPago && !cuota.motivoExencion) problemas.push("EXENTO SIN MOTIVO");
    if (cuota?.exentoPago && !cuota.usuarioExencion) problemas.push("EXENTO SIN ADMINISTRADOR REGISTRADO");
    const evidencias = [bloque ? "BLOQUE" : "", polera || chamarra ? "TALLA" : "", cuota ? "CUOTA" : ""].filter(Boolean);
    const ultimaActividad = [asignacion?.fechaAsignacion, talla?.fechaActualizado, ...movimientos.map((movimiento) => movimiento.fechaPago)].filter(Boolean).sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null;
    const porcentajeDescuento = tipoParticipante === "DESCUENTO" && montoOriginal > 0 ? dinero((1 - montoEsperadoRegistrado / montoOriginal) * 100) : referencia?.porcentaje ?? 0;
    const administradorExencion: any = usuarioMap.get(sid(cuota?.usuarioExencion));
    return {
      usuarioId,
      preregistroId: sid(preregistro),
      fraternoId: sid(fraterno),
      cuotaId: sid(cuota),
      nombre: nombreCompleto(usuario),
      ci: usuario.ci ?? "",
      ru: usuario.registroUniversitario ?? "SIN REGISTRO",
      codigoFraterno: fraterno?.numeroFraterno ?? "SIN REGISTRO",
      celular: usuario.telefono ?? "",
      whatsapp: usuario.telefono ? `+591${String(usuario.telefono).replace(/\D/g, "").replace(/^591/, "")}` : "SIN REGISTRO",
      correo: usuario.email ?? "",
      sexo: usuario.sexo ?? "SIN REGISTRO",
      roles: rolesActuales.length ? rolesActuales : ["OTROS"],
      rolActual: rolesActuales.length ? rolesActuales.join(" / ") : "OTROS",
      bloque: bloque?.nombre ?? "SIN BLOQUE",
      guiasBloque: bloque ? guiasBloque.get(sid(bloque)) ?? [] : [],
      estadoParticipacion: bloque ? "CON BLOQUE ACTIVO" : cuota && (polera || chamarra) ? "FUERA DE BLOQUE CON CUOTA Y TALLA" : cuota ? "FUERA DE BLOQUE CON CUOTA" : "FUERA DE BLOQUE CON TALLA",
      evidencias,
      tienePolera: polera,
      tallaPolera: talla?.tallaPolera ?? "SIN REGISTRO",
      tieneChamarra: chamarra,
      tallaChamarra: talla?.tallaChamarra ?? "SIN REGISTRO",
      fechaMedicion: talla?.fechaActualizado ?? null,
      origen,
      tipoParticipante,
      montoOriginal,
      montoEsperadoRegistrado,
      montoEsperado,
      porcentajeDescuento,
      primeraCuota: estadoMovimientoAuditoria(porNumero.get(1)),
      segundaCuota: estadoMovimientoAuditoria(porNumero.get(2)),
      terceraCuota: estadoMovimientoAuditoria(porNumero.get(3)),
      totalPagado,
      totalVerificado,
      saldoPendiente,
      estadoCuota: cuota?.estado ?? "SIN CUOTA",
      exento: Boolean(cuota?.exentoPago),
      motivoExencion: cuota?.motivoExencion ?? "SIN REGISTRO",
      administradorExencion: nombreCompleto(administradorExencion) || (cuota?.usuarioExencion ? "ADMINISTRADOR NO DISPONIBLE" : "SIN REGISTRO"),
      fechaExencion: cuota?.fechaExencion ?? null,
      beneficioReferenciado: referencias.map((item) => `${item.tipo}: ${item.etiqueta}`).join(" / "),
      estadoBeneficio: cuota?.exentoPago ? "APLICADO" : tipoParticipante === "DESCUENTO" ? "APLICADO EN MONTO" : referencias.length ? "PENDIENTE DE FORMALIZAR" : "SIN BENEFICIO",
      ultimaActividad,
      problemas: [...new Set(problemas)],
    };
  }).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  const conBloque = personas.filter((persona) => persona.bloque !== "SIN BLOQUE");
  const sinBloqueConPago = personas.filter((persona) => persona.bloque === "SIN BLOQUE" && persona.totalPagado > 0);
  const sinBloqueConTalla = personas.filter((persona) => persona.bloque === "SIN BLOQUE" && (persona.tienePolera || persona.tieneChamarra));
  const exentos = personas.filter((persona) => ["EXENTO", "FREE"].includes(persona.tipoParticipante));
  const descuentosAplicados = personas.filter((persona) => persona.tipoParticipante === "DESCUENTO");
  const descuentos = personas.filter((persona) => persona.tipoParticipante === "DESCUENTO" || persona.beneficioReferenciado.includes("DESCUENTO"));
  const sinPago = personas.filter((persona) => persona.montoEsperado > 0 && persona.totalPagado === 0);
  const inconsistencias = personas.filter((persona) => persona.problemas.length > 0);
  const controlExenciones = personas.filter((persona) => ["EXENTO", "FREE"].includes(persona.tipoParticipante) || /(?:FREE|EXENTO):/.test(persona.beneficioReferenciado));
  const montoGeneral = sumar(personas, "montoEsperadoRegistrado");
  const montoInternos = sumar(personas.filter((persona) => persona.origen === "INTERNO"), "montoEsperadoRegistrado");
  const montoExternos = sumar(personas.filter((persona) => persona.origen === "EXTERNO"), "montoEsperadoRegistrado");
  const montoSinClasificar = sumar(personas.filter((persona) => persona.origen === "SIN CLASIFICAR"), "montoEsperadoRegistrado");
  const montoExplicado = dinero(montoInternos + montoExternos + montoSinClasificar);
  const resumen = {
    participantes: personas.length,
    personasQueFormanMonto: personas.filter((persona) => persona.cuotaId).length,
    conBloque: conBloque.length,
    conTalla: personas.filter((persona) => persona.tienePolera || persona.tieneChamarra).length,
    conCuota: personas.filter((persona) => persona.cuotaId).length,
    internos: personas.filter((persona) => persona.origen === "INTERNO").length,
    externos: personas.filter((persona) => persona.origen === "EXTERNO").length,
    exentos: exentos.length,
    descuentos: descuentosAplicados.length,
    descuentosReferenciados: descuentos.length,
    free: personas.filter((persona) => persona.tipoParticipante === "FREE").length,
    totalGeneralRegistrado: montoGeneral,
    montoInternos,
    montoExternos,
    montoSinClasificar,
    montoExentoRegistrado: sumar(exentos, "montoEsperadoRegistrado"),
    montoDescuentoOriginal: sumar(descuentosAplicados, "montoOriginal"),
    montoDescuentoFinal: sumar(descuentosAplicados, "montoEsperado"),
    montoRealEsperado: sumar(personas, "montoEsperado"),
    totalPagado: sumar(personas, "totalPagado"),
    totalVerificado: sumar(personas, "totalVerificado"),
    saldoPendiente: sumar(personas, "saldoPendiente"),
    montoExplicado,
    montoSinExplicacion: dinero(montoGeneral - montoExplicado),
    inconsistencias: inconsistencias.length,
  };

  const referenciasBeneficio = REFERENCIAS_BENEFICIO.map((referencia) => {
    const ids = coincidenciasReferencia.get(referencia.etiqueta) ?? [];
    const encontrados = ids.map((usuarioId) => personas.find((persona) => persona.usuarioId === usuarioId)).filter(Boolean);
    return {
      ...referencia,
      estado: referencia.etiqueta === "YO" ? "REQUIERE NOMBRE O CI" : ids.length === 0 ? "SIN COINCIDENCIA" : ids.length > 1 ? "AMBIGUO; REQUIERE CI" : encontrados[0]?.estadoBeneficio === "PENDIENTE DE FORMALIZAR" ? "IDENTIFICADO; PENDIENTE DE FORMALIZAR" : "IDENTIFICADO",
      candidatos: encontrados.map((persona: any) => ({ usuarioId: persona.usuarioId, nombre: persona.nombre, ci: persona.ci, tipoParticipante: persona.tipoParticipante, estadoBeneficio: persona.estadoBeneficio })),
    };
  });

  return {
    generadoEn: new Date(),
    gestion: { _id: gestion._id, nombre: gestion.nombre, anio: gestion.anio },
    definicionUniverso: "Personas únicas y no eliminadas que, en la gestión vigente, tienen al menos una de estas evidencias: bloque activo, talla registrada o cuota vigente.",
    tarifas: { interno: tarifaInterno, externo: tarifaExterno },
    resumen,
    personas,
    conBloque,
    sinBloqueConPago,
    sinBloqueConTalla,
    exentos,
    descuentos,
    sinPago,
    inconsistencias,
    controlExenciones,
    referenciasBeneficio,
    validaciones: {
      personasUnicas: new Set(personas.map((persona) => persona.usuarioId)).size === personas.length,
      universoCumpleCondicion: personas.every((persona) => persona.evidencias.length > 0),
      totalGeneralExplicado: resumen.montoSinExplicacion === 0,
      sumaEsperado: resumen.montoRealEsperado === sumar(personas, "montoEsperado"),
      sumaVerificado: resumen.totalVerificado === sumar(personas, "totalVerificado"),
    },
    consultas: ["gestiones", "perfil_usuarios", "roles", "preregistros", "fraternos", "guias", "postulantes_guia", "bloques", "detalle_bloques", "tallas_fraterno", "configuraciones_pago", "cuotas", "detalle_cuotas"],
  };
}
