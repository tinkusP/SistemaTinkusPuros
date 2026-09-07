import mongoose from "mongoose";
import { connectDB } from "../config/db";
import { generarReporteTallasPrimeraCuota } from "../services/ReporteTallasPrimeraCuotaService";

async function ejecutar() {
  await connectDB();
  const reporte = await generarReporteTallasPrimeraCuota();
  if (!reporte) throw new Error("No existe una gestión activa para generar el reporte");
  const conTalla = reporte.personas.filter((persona) => persona.conTalla);
  const estados = ["SIN PAGO", "PENDIENTE DE VERIFICACIÓN", "PAGO REGISTRADO", "PAGO PARCIAL", "PAGO COMPLETO"];
  const conteos = Object.fromEntries(estados.map((estado) => [estado, conTalla.filter((persona) => persona.estadoPagoReporte === estado).length]));
  const diferenciasHistoricas = reporte.personas.filter((persona) => persona.montoVerificadoTotal !== persona.totalPagado);
  const inconsistencias = reporte.personas.filter((persona) => persona.cuotasPagadas > persona.numeroCuotas || persona.saldoTotal < 0);
  const ids = reporte.personas.map((persona) => persona.usuarioId), duplicados = ids.length - new Set(ids).size;
  const sumaEstadosTalla = reporte.resumenGeneralTallas.tallasCompletas + reporte.resumenGeneralTallas.soloPolera + reporte.resumenGeneralTallas.soloChamarra + reporte.resumenGeneralTallas.sinTalla + reporte.resumenGeneralTallas.sinDefinir;
  console.log(JSON.stringify({ gestion: reporte.gestion.nombre, usuarios: reporte.personas.length, resumenTallas: reporte.resumenGeneralTallas, tallasDinamicas: reporte.tallasDisponibles, filasDistribucion: reporte.distribucionTallas.length, conTalla: conTalla.length, hombresConTalla: conTalla.filter((persona) => persona.sexo === "HOMBRE").length, mujeresConTalla: conTalla.filter((persona) => persona.sexo === "MUJER").length, estados, conteos, duplicados, estadosTallaCubrenTodos: sumaEstadosTalla === reporte.personas.length, usuarioEliminadoPresente: reporte.personas.some((persona) => persona.ci === "1234567890"), diferenciasHistoricasCuotaDetalle: diferenciasHistoricas.length, inconsistencias: inconsistencias.length, correcto: inconsistencias.length === 0 && duplicados === 0 && sumaEstadosTalla === reporte.personas.length && !reporte.personas.some((persona) => persona.ci === "1234567890") }));
}

ejecutar().then(() => mongoose.disconnect()).catch(async (error) => { console.error(error); await mongoose.disconnect(); process.exit(1); });
