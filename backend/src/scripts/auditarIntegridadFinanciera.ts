import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import mongoose from "mongoose";
import { obtenerControlFinancieroBloques } from "../services/ControlFinancieroBloquesService";

const bs = (valor: number) => `Bs ${Number(valor || 0).toFixed(2)}`;
const texto = (valor: unknown) => String(valor ?? "").replace(/[\r\n\t]+/g, " ").trim();

function tablaPersonas(personas: any[]) {
  if (!personas.length) return "SIN REGISTROS\n";
  const encabezado = "N.º | Nombre | CI | Roles | Bloque actual | Estado bloque | Bloque anterior | Estado usuario | Estado fraterno | Participación | Motivo exclusión | Tipo | Plan | Esperado normal | Exento | Motivo exención | Fecha exención | Registrado | Verificado | Por verificar | Saldo | Registros verificados | Registros pendientes | Fechas verificadas | Inconsistencias";
  return encabezado + "\n" + personas.map((persona, indice) => [
    indice + 1,
    texto(persona.nombre),
    texto(persona.ci),
    texto(persona.roles?.join(" / ")),
    texto(persona.bloque),
    texto(persona.estadoBloqueActual),
    texto(persona.bloqueAnterior),
    texto(persona.estadoUsuario),
    texto(persona.estadoFraterno),
    texto(persona.participacion),
    texto(persona.motivoFuera),
    texto(persona.tipo),
    bs(persona.montoPlan),
    bs(persona.montoTotal),
    persona.exento ? "SI" : "NO",
    texto(persona.motivoExencion),
    persona.fechaExencion ? new Date(persona.fechaExencion).toISOString() : "",
    bs(persona.montoRegistrado),
    bs(persona.montoVerificado),
    bs(persona.montoPendienteRevision),
    bs(persona.saldo),
    persona.cuotasVerificadas,
    persona.pagosPendientes,
    persona.pagosVerificadosDetalle?.map((pago: any) => new Date(pago.fechaPago).toISOString()).join(", ") ?? "",
    texto(persona.problemas?.join("; ")),
  ].join(" | ")).join("\n") + "\n";
}

async function main() {
  if (!process.env.DATABASE_URL && !process.env.MONGO_URI) {
    throw new Error("DATABASE_URL o MONGO_URI no está configurada");
  }
  await mongoose.connect(process.env.DATABASE_URL || process.env.MONGO_URI!, { serverSelectionTimeoutMS: 15000 });
  try {
    const reporte: any = await obtenerControlFinancieroBloques();
    const validacionesFallidas = Object.entries(reporte.validaciones ?? {}).filter(([, valor]) => !valor).map(([nombre]) => nombre);
    const exentos = reporte.personas.filter((persona: any) => persona.exento);
    const verificadosFuera = reporte.fueraBloques.filter((persona: any) => persona.montoVerificado > 0);
    const lineas = [
      "AUDITORÍA FINANCIERA COMPLETA — SOLO LECTURA",
      `Generado: ${new Date(reporte.generadoEn).toISOString()}`,
      `Gestión: ${texto(reporte.gestion?.nombre)} (${texto(reporte.gestion?.anio)})`,
      "",
      "DEFINICIONES",
      "Universo A: todas las cuotas vigentes de la gestión activa cuyos usuarios no están eliminados.",
      "Universo B: personas con DetalleBloque ACTIVO, no eliminado, dentro de un Bloque ACTIVO de la misma gestión.",
      "Registro de pago: documento DetalleCuota. Una persona puede tener varios registros.",
      "Monto verificado: suma de DetalleCuota con estadoRevision VERIFICADO.",
      "La auditoría no compara extractos bancarios y no modifica ningún documento.",
      "",
      "UNIVERSO A — RESUMEN GENERAL",
      `Personas/cuotas: ${reporte.resumenGeneral.personas}`,
      `Total esperado: ${bs(reporte.resumenGeneral.montoEsperado)}`,
      `Total verificado: ${bs(reporte.resumenGeneral.montoVerificado)}`,
      `Saldo aritmético: ${bs(reporte.resumenGeneral.saldo)}`,
      `Importe por verificar: ${bs(reporte.resumenGeneral.montoPendienteRevision)}`,
      `Personas con pagos pendientes: ${reporte.resumenGeneral.personasPendientes}`,
      `Registros pendientes: ${reporte.resumenGeneral.registrosPendientes}`,
      `Registros verificados: ${reporte.resumenGeneral.registrosVerificados}`,
      "",
      "UNIVERSO B — BLOQUES ACTIVOS",
      `Personas: ${reporte.resumen.personas}`,
      `Internos: ${reporte.resumen.internos}`,
      `Externos: ${reporte.resumen.externos}`,
      `Sin clasificar: ${reporte.resumen.sinClasificar}`,
      `Monto teórico: ${bs(reporte.resumen.montoTeorico)}`,
      `Exentos: ${reporte.resumen.exentos} por ${bs(reporte.resumen.montoExento)}`,
      `Monto real esperado: ${bs(reporte.resumen.montoRealEsperado)}`,
      `Monto verificado total: ${bs(reporte.resumen.montoVerificado)}`,
      `Monto verificado de obligados: ${bs(reporte.resumen.montoVerificadoObligados)}`,
      `Monto verificado histórico de exentos: ${bs(reporte.resumen.montoVerificadoExentos)}`,
      `Personas con pagos pendientes: ${reporte.resumen.personasPendientes}`,
      `Registros pendientes: ${reporte.resumen.pagosPendientes}`,
      `Saldo real por cobrar: ${bs(reporte.resumen.saldoPorCobrar)}`,
      "",
      "ESTADO DE PAGO — UNIVERSO DE BLOQUES",
      `Sin ningún pago: ${reporte.resumen.sinPago} personas; ${bs(reporte.resumen.montoSinPago)}`,
      `Pago parcial: ${reporte.resumen.pagoParcial} personas; verificado ${bs(reporte.resumen.montoVerificadoParcial)}; saldo ${bs(reporte.resumen.saldoParcial)}`,
      `Pago completo: ${reporte.resumen.pagoCompleto} personas; verificado ${bs(reporte.resumen.montoVerificadoCompleto)}`,
      `Pendiente de verificación: ${reporte.resumen.personasPendientes} personas; ${reporte.resumen.pagosPendientes} registros; ${bs(reporte.resumen.montoPendienteRevision)}`,
      `Exentos: ${reporte.resumen.exentos}; internos ${reporte.resumen.exentosInternos} (${bs(reporte.resumen.montoExentoInterno)}); externos ${reporte.resumen.exentosExternos} (${bs(reporte.resumen.montoExentoExterno)}); con pago histórico ${reporte.resumen.exentosConPago}`,
      "",
      "¿POR QUÉ FALTA DINERO? — DESGLOSE MUTUAMENTE EXCLUYENTE",
      `Sin ningún pago: ${reporte.desgloseFaltante.sinPago.personas} personas; ${bs(reporte.desgloseFaltante.sinPago.monto)}`,
      `Pago parcial: ${reporte.desgloseFaltante.pagoParcial.personas} personas; ${bs(reporte.desgloseFaltante.pagoParcial.monto)}`,
      `Pago pendiente de verificación: ${reporte.desgloseFaltante.pagoPendiente.personas} personas; ${bs(reporte.desgloseFaltante.pagoPendiente.monto)}`,
      `Participación por revisar: ${reporte.desgloseFaltante.participacionRevisar.personas} personas; ${bs(reporte.desgloseFaltante.participacionRevisar.monto)}`,
      `Inconsistencias: ${reporte.desgloseFaltante.inconsistencias.personas} personas; ${bs(reporte.desgloseFaltante.inconsistencias.monto)}`,
      `Otros: ${reporte.desgloseFaltante.otros.personas} personas; ${bs(reporte.desgloseFaltante.otros.monto)}`,
      `Total: ${bs(reporte.desgloseFaltante.total)}; no explicado: ${bs(reporte.desgloseFaltante.noExplicado)}`,
      "",
      "RECONCILIACIÓN",
      `Esperado: ${bs(reporte.reconciliacion.esperado.general)} - ${bs(reporte.reconciliacion.esperado.bloques)} = ${bs(reporte.reconciliacion.esperado.diferencia)}`,
      `Esperado fuera de bloques explicado: ${bs(reporte.reconciliacion.esperado.detalleExplicado)}`,
      `Esperado no explicado: ${bs(reporte.reconciliacion.esperado.noExplicada)}`,
      `Verificado: ${bs(reporte.reconciliacion.verificado.general)} - ${bs(reporte.reconciliacion.verificado.bloques)} = ${bs(reporte.reconciliacion.verificado.diferencia)}`,
      `Verificado fuera de bloques explicado: ${bs(reporte.reconciliacion.verificado.detalleExplicado)}`,
      `Verificado no explicado: ${bs(reporte.reconciliacion.verificado.noExplicada)}`,
      `Desglose verificado: obligados con bloque ${bs(reporte.reconciliacion.verificado.desglose.obligadosConBloque)}; exentos con bloque ${bs(reporte.reconciliacion.verificado.desglose.exentosConBloque)}; sin bloque activo ${bs(reporte.reconciliacion.verificado.desglose.sinBloqueActivo)}; retirados ${bs(reporte.reconciliacion.verificado.desglose.retirados)}; otros ${bs(reporte.reconciliacion.verificado.desglose.otros)}`,
      "",
      `VALIDACIONES: ${validacionesFallidas.length ? `FALLARON: ${validacionesFallidas.join(", ")}` : "TODAS CORRECTAS"}`,
      `INCONSISTENCIAS DETECTADAS: ${reporte.inconsistencias.length}`,
      `FUERA DE BLOQUES: ${reporte.resumenFuera.personas} personas; retirados ${reporte.resumenFuera.retirados}; sin bloque activo ${reporte.resumenFuera.sinBloqueActivo}; otros/sin perfil fraterno ${reporte.resumenFuera.otros}`,
      "",
      `EXENTOS (${exentos.length})`,
      tablaPersonas(exentos),
      `VERIFICADOS FUERA DE BLOQUES (${verificadosFuera.length} personas; ${reporte.resumenFuera.registrosVerificados} registros; ${bs(reporte.resumenFuera.montoVerificado)})`,
      tablaPersonas(verificadosFuera),
      `ESPERADO FUERA DE BLOQUES (${reporte.fueraBloques.length} personas; ${bs(reporte.resumenFuera.montoEsperado)})`,
      tablaPersonas(reporte.fueraBloques),
      "POR BLOQUE",
      reporte.porBloque.map((bloque: any) => `${texto(bloque.nombre)} | ${bloque.personas} personas | esperado ${bs(bloque.montoRealEsperado)} | verificado ${bs(bloque.montoVerificado)} | saldo ${bs(bloque.saldoPorCobrar)}`).join("\n"),
      "",
      "RESULTADO",
      validacionesFallidas.length ? "AUDITORÍA NO CUADRA. Revisar antes de usar cifras." : "AUDITORÍA CUADRA MATEMÁTICAMENTE ENTRE AMBOS UNIVERSOS.",
    ];
    const salida = path.resolve(__dirname, "../../../AUDITORIA_FINANCIERA_COMPLETA.txt");
    await fs.writeFile(salida, lineas.join("\n"), "utf8");
    console.log(JSON.stringify({ salida, gestion: reporte.gestion, resumenGeneral: reporte.resumenGeneral, resumenBloques: reporte.resumen, resumenFuera: reporte.resumenFuera, reconciliacion: reporte.reconciliacion, validacionesFallidas }, null, 2));
    if (validacionesFallidas.length) process.exitCode = 2;
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
