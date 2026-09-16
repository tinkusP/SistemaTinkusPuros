import Cuota from "../models/Cuota";
import DetalleCuota from "../models/DetalleCuota";
import PerfilUsuario from "../models/PerfilUsuario";
import { obtenerControlFinancieroBloques } from "./ControlFinancieroBloquesService";

type TipoReferencia = "FREE" | "DESCUENTO" | "REVISAR";
type TipoPagoAuditoria = "FREE" | "DESCUENTO" | "NORMAL" | "EXENTO" | "REVISAR";

const REFERENCIAS: Array<{ alias: string; tipo: TipoReferencia; detalle: string }> = [
  { alias: "DIEGO", tipo: "FREE", detalle: "Referencia administrativa declarada" },
  { alias: "YO", tipo: "FREE", detalle: "No identificable sin nombre o CI" },
  { alias: "MARTIN", tipo: "FREE", detalle: "Referencia administrativa declarada" },
  { alias: "LAURA", tipo: "FREE", detalle: "Referencia administrativa declarada" },
  { alias: "KAMIL", tipo: "FREE", detalle: "Referencia administrativa declarada" },
  { alias: "VIDAL", tipo: "FREE", detalle: "Referencia administrativa declarada" },
  { alias: "LOBO", tipo: "FREE", detalle: "Referencia administrativa declarada" },
  { alias: "GAUSS", tipo: "REVISAR", detalle: "Beneficio pendiente de confirmación" },
  { alias: "BRAYAN", tipo: "REVISAR", detalle: "Beneficio pendiente de confirmación" },
  { alias: "CARLOS", tipo: "REVISAR", detalle: "Beneficio pendiente de confirmación" },
  { alias: "OLO", tipo: "DESCUENTO", detalle: "Descuento declarado pendiente de formalización" },
  { alias: "ABI", tipo: "DESCUENTO", detalle: "Descuento declarado pendiente de formalización" },
  { alias: "DYLAN", tipo: "DESCUENTO", detalle: "Descuento declarado del 50 %, pendiente de formalización" },
];

const id = (valor: any) => String(valor?._id ?? valor ?? "");
const dinero = (valor: unknown) => Number((Number(valor) || 0).toFixed(2));
const sumar = (filas: any[], campo: string) => dinero(filas.reduce((total, fila) => total + Number(fila[campo] || 0), 0));
const normalizar = (valor: unknown) => String(valor ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
const contienePalabra = (texto: string, palabra: string) => (` ${texto} `).includes(` ${palabra} `);
const fechaDia = (valor: unknown) => valor ? new Date(String(valor)).toISOString().slice(0, 10) : "SIN_FECHA";

export function clasificarTipoPagoAuditoria(datos: {
  exento: boolean;
  montoPlan: number;
  tarifaNormal: number;
  referencia?: TipoReferencia;
  referenciaAmbigua?: boolean;
}) {
  if (datos.exento) return { tipoPago: datos.referencia === "FREE" && !datos.referenciaAmbigua ? "FREE" as TipoPagoAuditoria : "EXENTO" as TipoPagoAuditoria, estadoBeneficio: "APLICADO EN CUOTA" };
  if (datos.referenciaAmbigua || datos.referencia === "REVISAR") return { tipoPago: "REVISAR" as TipoPagoAuditoria, estadoBeneficio: "REVISIÓN ADMINISTRATIVA" };
  if (datos.montoPlan > 0 && datos.tarifaNormal > 0 && datos.montoPlan < datos.tarifaNormal) return { tipoPago: "DESCUENTO" as TipoPagoAuditoria, estadoBeneficio: "APLICADO EN MONTO DE CUOTA" };
  if (datos.referencia === "FREE") return { tipoPago: "FREE" as TipoPagoAuditoria, estadoBeneficio: "POR FORMALIZAR; NO ALTERA EL CÁLCULO" };
  if (datos.referencia === "DESCUENTO") return { tipoPago: "DESCUENTO" as TipoPagoAuditoria, estadoBeneficio: "POR FORMALIZAR; NO ALTERA EL CÁLCULO" };
  return { tipoPago: "NORMAL" as TipoPagoAuditoria, estadoBeneficio: "TARIFA VIGENTE" };
}

export async function obtenerAuditoriaFinancieraGeneral() {
  const base: any = await obtenerControlFinancieroBloques();
  if (!base.gestion) return { generadoEn: new Date(), gestion: null, personas: [], pagos: [], inconsistencias: [], referencias: [], universoGeneral: {}, universoBloques: {}, diferencias: {} };

  const filasBase: any[] = [...(base.personas ?? []), ...(base.fueraBloques ?? [])];
  const cuotaIds = [...new Set(filasBase.map((persona) => persona.cuotaId).filter(Boolean))];
  const usuarioIds = [...new Set(filasBase.map((persona) => persona.usuarioId).filter(Boolean))];
  const [cuotas, movimientos, perfiles]: any[][] = await Promise.all([
    Cuota.find({ _id: { $in: cuotaIds }, fechaEliminado: null }).lean(),
    DetalleCuota.find({ cuotaId: { $in: cuotaIds }, fechaEliminado: null }).sort({ fechaPago: 1, fechaCreado: 1 }).lean(),
    PerfilUsuario.find({ _id: { $in: usuarioIds }, fechaEliminado: null }).select("nombres estado").lean(),
  ]);
  const cuotaMap = new Map(cuotas.map((cuota) => [id(cuota), cuota]));
  const perfilMap = new Map(perfiles.map((perfil) => [id(perfil), perfil]));
  const movimientosPorCuota = new Map<string, any[]>();
  for (const movimiento of movimientos) movimientosPorCuota.set(id(movimiento.cuotaId), [...(movimientosPorCuota.get(id(movimiento.cuotaId)) ?? []), movimiento]);

  const candidatosPorAlias = new Map<string, string[]>();
  for (const referencia of REFERENCIAS) {
    if (referencia.alias === "YO") { candidatosPorAlias.set(referencia.alias, []); continue; }
    const candidatos = filasBase.filter((persona) => contienePalabra(normalizar(perfilMap.get(persona.usuarioId)?.nombres), referencia.alias)).map((persona) => persona.usuarioId);
    candidatosPorAlias.set(referencia.alias, [...new Set(candidatos)]);
  }
  const referenciasPorUsuario = new Map<string, Array<{ alias: string; tipo: TipoReferencia; detalle: string; ambigua: boolean }>>();
  for (const referencia of REFERENCIAS) {
    const candidatos = candidatosPorAlias.get(referencia.alias) ?? [];
    for (const usuarioId of candidatos) referenciasPorUsuario.set(usuarioId, [...(referenciasPorUsuario.get(usuarioId) ?? []), { ...referencia, ambigua: candidatos.length !== 1 }]);
  }

  const voucherUsos = new Map<string, number>();
  for (const movimiento of movimientos) {
    const archivo = String(movimiento.baucherImagen || movimiento.respaldoAdminImagen || "").trim();
    if (archivo) voucherUsos.set(archivo, (voucherUsos.get(archivo) ?? 0) + 1);
  }

  const personas = filasBase.map((persona) => {
    const cuota: any = cuotaMap.get(persona.cuotaId);
    const pagos = movimientosPorCuota.get(persona.cuotaId) ?? [];
    const verificados = pagos.filter((pago) => pago.estadoRevision === "VERIFICADO");
    const pendientes = pagos.filter((pago) => pago.estadoRevision === "PENDIENTE");
    const observados = pagos.filter((pago) => pago.estadoRevision === "OBSERVADO");
    const rechazados = pagos.filter((pago) => pago.estadoRevision === "RECHAZADO");
    const montoRegistrado = dinero(pagos.reduce((total, pago) => total + Number(pago.monto || 0), 0));
    const montoVerificado = dinero(verificados.reduce((total, pago) => total + Number(pago.monto || 0), 0));
    const montoPorVerificar = dinero(pendientes.reduce((total, pago) => total + Number(pago.monto || 0), 0));
    const montoObservado = dinero(observados.reduce((total, pago) => total + Number(pago.monto || 0), 0));
    const montoRechazado = dinero(rechazados.reduce((total, pago) => total + Number(pago.monto || 0), 0));
    const montoEsperadoRegistrado = dinero(cuota?.montoTotal);
    const saldoCalculado = persona.exento ? 0 : dinero(Math.max(0, montoEsperadoRegistrado - montoVerificado));
    const referencias = referenciasPorUsuario.get(persona.usuarioId) ?? [];
    const referencia = referencias[0];
    const clasificacion = clasificarTipoPagoAuditoria({ exento: Boolean(persona.exento), montoPlan: montoEsperadoRegistrado, tarifaNormal: Number(persona.montoTotal || 0), referencia: referencia?.tipo, referenciaAmbigua: referencia?.ambigua });
    const huellas = new Set<string>();
    const problemas = [...(persona.problemas ?? [])];
    for (const pago of pagos) {
      const huella = `${pago.numeroPago}|${dinero(pago.monto)}|${fechaDia(pago.fechaPago)}|${pago.metodoPago}`;
      if (huellas.has(huella)) problemas.push(`PAGO POSIBLEMENTE REPETIDO: ${huella}`);
      huellas.add(huella);
      const archivo = String(pago.baucherImagen || pago.respaldoAdminImagen || "").trim();
      if (archivo && (voucherUsos.get(archivo) ?? 0) > 1) problemas.push(`COMPROBANTE REUTILIZADO EN ${voucherUsos.get(archivo)} REGISTROS`);
      if (dinero(Number(pago.montoEfectivo || 0) + Number(pago.montoQr || 0)) !== dinero(pago.monto)) problemas.push(`DESGLOSE DEL PAGO ${pago.numeroPago} NO CUADRA`);
    }
    if (dinero(cuota?.montoPagado) !== montoVerificado) problemas.push(`CUOTA.montoPagado ${dinero(cuota?.montoPagado)} DIFIERE DE VERIFICADOS ${montoVerificado}`);
    if (dinero(cuota?.saldo) !== dinero(Math.max(0, montoEsperadoRegistrado - montoVerificado))) problemas.push(`CUOTA.saldo ${dinero(cuota?.saldo)} DIFIERE DEL SALDO AUDITADO ${dinero(Math.max(0, montoEsperadoRegistrado - montoVerificado))}`);
    if (cuota?.estado === "PAGADA" && montoVerificado < montoEsperadoRegistrado) problemas.push("CUOTA PAGADA SIN MONTO VERIFICADO COMPLETO");
    if (cuota?.estado !== "PAGADA" && montoEsperadoRegistrado > 0 && montoVerificado >= montoEsperadoRegistrado) problemas.push("PAGO COMPLETO CON CUOTA NO MARCADA PAGADA");
    if (referencia && clasificacion.estadoBeneficio.includes("POR FORMALIZAR")) problemas.push(`${referencia.tipo} REFERENCIADO PARA ${referencia.alias}, PERO NO FORMALIZADO EN LA CUOTA`);
    if (referencia?.ambigua) problemas.push(`ALIAS ${referencia.alias} COINCIDE CON MÁS DE UNA PERSONA; REQUIERE CI`);
    const pagosDetalle = pagos.map((pago) => ({ pagoId: id(pago), numeroPago: pago.numeroPago, monto: dinero(pago.monto), fechaPago: pago.fechaPago, fechaRevision: pago.fechaRevision ?? null, estado: pago.estadoRevision, metodo: pago.metodoPago, tieneComprobante: Boolean(pago.baucherImagen || pago.respaldoAdminImagen) }));
    return { ...persona, usuarioActivo: perfilMap.get(persona.usuarioId)?.estado === "ACTIVO", montoEsperadoRegistrado, montoRegistrado, montoVerificado, montoPorVerificar, montoObservado, montoRechazado, saldoCalculado, saldoGuardado: dinero(cuota?.saldo), estadoCuota: cuota?.estado ?? "SIN CUOTA", tipoPagoAuditoria: clasificacion.tipoPago, estadoBeneficio: clasificacion.estadoBeneficio, referenciaBeneficio: referencia ? `${referencia.tipo}: ${referencia.alias} — ${referencia.detalle}` : "", pagosDetalle, problemas: [...new Set(problemas)], ultimaActividad: pagos.length ? pagos[pagos.length - 1].fechaPago : null };
  }).filter((persona) => persona.usuarioActivo);

  const usuariosRepetidos = new Map<string, number>();
  for (const persona of personas) usuariosRepetidos.set(persona.usuarioId, (usuariosRepetidos.get(persona.usuarioId) ?? 0) + 1);
  for (const persona of personas) if ((usuariosRepetidos.get(persona.usuarioId) ?? 0) > 1) persona.problemas = [...new Set([...persona.problemas, "PERSONA REPETIDA EN EL UNIVERSO; REVISAR PRERREGISTROS/CUOTAS"] )];
  const personasUnicas = [...new Map(personas.map((persona) => [persona.usuarioId, persona])).values()];
  const conBloque = personasUnicas.filter((persona) => persona.asignacionActiva && persona.estadoBloqueActual === "ACTIVO");
  const sinBloque = personasUnicas.filter((persona) => !persona.asignacionActiva || persona.estadoBloqueActual !== "ACTIVO");
  const pagos = personasUnicas.flatMap((persona) => persona.pagosDetalle.map((pago: any) => ({ ...pago, usuarioId: persona.usuarioId, cuotaId: persona.cuotaId, nombre: persona.nombre, ci: persona.ci, roles: persona.roles, bloque: persona.bloque, participacion: persona.participacion, tipo: persona.tipo, tipoPagoAuditoria: persona.tipoPagoAuditoria })));
  const universoGeneral = { cantidad: personasUnicas.length, montoEsperado: sumar(personasUnicas, "montoEsperadoRegistrado"), montoPagado: sumar(personasUnicas, "montoRegistrado"), montoVerificado: sumar(personasUnicas, "montoVerificado"), montoPendiente: sumar(personasUnicas, "saldoGuardado"), montoPorVerificar: sumar(personasUnicas, "montoPorVerificar"), montoObservado: sumar(personasUnicas, "montoObservado"), montoRechazado: sumar(personasUnicas, "montoRechazado"), registros: pagos.length, registrosVerificados: pagos.filter((pago) => pago.estado === "VERIFICADO").length, registrosPorVerificar: pagos.filter((pago) => pago.estado === "PENDIENTE").length };
  const obligadosConBloque = conBloque.filter((persona) => !persona.exento);
  const universoBloques = { cantidad: conBloque.length, internos: conBloque.filter((persona) => persona.tipo === "INTERNO").length, externos: conBloque.filter((persona) => persona.tipo === "EXTERNO").length, sinClasificar: conBloque.filter((persona) => persona.tipo === "SIN CLASIFICAR").length, exentos: conBloque.filter((persona) => persona.exento).length, montoTeorico: sumar(conBloque, "montoTotal"), montoExento: sumar(conBloque.filter((persona) => persona.exento), "montoTotal"), montoEsperado: sumar(obligadosConBloque, "montoTotal"), montoVerificado: sumar(conBloque, "montoVerificado"), montoPendiente: sumar(obligadosConBloque, "saldo"), montoPorVerificar: sumar(conBloque, "montoPorVerificar") };
  const pagosSinBloque = sinBloque.filter((persona) => persona.montoRegistrado > 0);
  const pagosSinParticipacion = personasUnicas.filter((persona) => persona.montoRegistrado > 0 && persona.participacion !== "ACTIVO");
  const personasSinPago = personasUnicas.filter((persona) => !persona.exento && persona.montoRegistrado === 0);
  const inconsistencias = personasUnicas.filter((persona) => persona.problemas.length > 0);
  const esperadoFuera = sumar(sinBloque, "montoEsperadoRegistrado");
  const verificadoFuera = sumar(sinBloque, "montoVerificado");
  const diferencias = {
    esperado: { general: universoGeneral.montoEsperado, bloques: universoBloques.montoEsperado, diferencia: dinero(universoGeneral.montoEsperado - universoBloques.montoEsperado), fueraDeBloque: esperadoFuera, exencionesEnBloque: universoBloques.montoExento, noExplicada: dinero(universoGeneral.montoEsperado - universoBloques.montoEsperado - esperadoFuera - universoBloques.montoExento) },
    verificado: { general: universoGeneral.montoVerificado, bloques: universoBloques.montoVerificado, diferencia: dinero(universoGeneral.montoVerificado - universoBloques.montoVerificado), fueraDeBloque: verificadoFuera, noExplicada: dinero(universoGeneral.montoVerificado - universoBloques.montoVerificado - verificadoFuera) },
  };
  const referencias = REFERENCIAS.map((referencia) => { const candidatos = candidatosPorAlias.get(referencia.alias) ?? []; return { ...referencia, candidatos: candidatos.map((usuarioId) => { const persona = personasUnicas.find((fila) => fila.usuarioId === usuarioId); return persona ? { usuarioId, nombre: persona.nombre, ci: persona.ci, tipoPagoAuditoria: persona.tipoPagoAuditoria, estadoBeneficio: persona.estadoBeneficio } : null; }).filter(Boolean), estado: referencia.alias === "YO" ? "REQUIERE NOMBRE O CI" : candidatos.length === 0 ? "SIN COINCIDENCIA" : candidatos.length === 1 ? "IDENTIFICADO" : "AMBIGUO; REQUIERE CI" }; });
  const clasificaciones = (["FREE", "DESCUENTO", "NORMAL", "EXENTO", "REVISAR"] as TipoPagoAuditoria[]).map((tipo) => ({ tipo, personas: personasUnicas.filter((persona) => persona.tipoPagoAuditoria === tipo).length }));

  return { generadoEn: new Date(), gestion: base.gestion, definiciones: { general: "Usuarios activos con una cuota vigente no eliminada en la gestión.", bloques: "Usuarios activos con DetalleBloque ACTIVO, no eliminado, dentro de un Bloque ACTIVO.", montoPagado: "Suma de todos los registros de pago no eliminados; incluye estados pendientes, observados o rechazados.", montoVerificado: "Solo DetalleCuota con estadoRevision VERIFICADO.", beneficios: "Las referencias nominales no alteran importes mientras no estén formalizadas en la cuota." }, universoGeneral, universoBloques, diferencias, personas: personasUnicas, pagos, conBloque, sinBloque, pagosSinBloque, pagosSinParticipacion, personasSinPago, inconsistencias, referencias, clasificaciones, validaciones: { personaUnica: personas.length === personasUnicas.length, esperadoExplicado: diferencias.esperado.noExplicada === 0, verificadoExplicado: diferencias.verificado.noExplicada === 0, verificadosCoinciden: universoGeneral.montoVerificado === dinero(pagos.filter((pago) => pago.estado === "VERIFICADO").reduce((total, pago) => total + pago.monto, 0)) } };
}
