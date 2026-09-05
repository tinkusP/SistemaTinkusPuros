import api from "@/lib/axios";
import { obtenerMensajeError } from "./apiError";

export type PersonaReporte = {
  usuarioId: string;
  nombres?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  nombre: string;
  ci: string;
  telefono?: string;
  email: string;
  genero: string;
  facultad: string;
  carrera: string;
  origen: string;
  estadoUsuario: string;
  estadoPreregistro: string;
  cuota: { clasificacion: string; montoTotal: number; montoPagado: number; saldo: number; cantidadPagos: number };
};
export type Reporte = { generadoEn: string; gestion: { _id: string; nombre: string; anio: number }; resumen: Record<string, number>; finanzas: Record<string, number>; distribuciones: Record<string, { nombre: string; total: number }[]>; personas: PersonaReporte[] };
export type EstadoAlmacenamiento = { archivos: { total: number; bytes: number }; comprobantes: { total: number; bytes: number; promedioBytes: number }; disco: { disponibleBytes: number }; alerta: string };
export type RegistroTallaReporte = { fraternoId: string; nombres?: string; apellidoPaterno?: string; apellidoMaterno?: string; nombre: string; ci: string; telefono?: string; genero?: string; bloque: string; tallaPolera?: string; tallaChamarra?: string };
export type RegistroFormacionReporte = { id: string; nombres?: string; apellidoPaterno?: string; apellidoMaterno?: string; nombre: string; ci: string; telefono?: string; email?: string; bloque?: string; estado: string; puntajeTotal?: number };
export type ResumenTallaCuota = { total: number; conTalla: number; sinTalla: number; conPolera: number; sinPolera: number; conChamarra: number; sinChamarra: number; sinNingunaTalla: number; primeraCuotaPagada: number; primeraCuotaPendiente: number; sinTallaYSinPrimeraCuota: number };
export type PersonaTallaCuota = { usuarioId: string; fraternoId: string; nombre: string; ci: string; codigoFraterno: string; sexo: string; telefono: string; whatsapp: string | null; correo: string; roles: string[]; bloque: string; tallaPolera: string | null; tallaChamarra: string | null; tienePolera: boolean; tieneChamarra: boolean; conTalla: boolean; pendienteTalla: "POLERA" | "CHAMARRA" | "AMBAS" | null; primeraCuota: "PAGADA" | "PENDIENTE"; montoPrimeraCuota: number; montoPagadoPrimeraCuota: number; estadoGeneral: string };
export type ReporteTallasPrimeraCuota = { generadoEn: string; gestion: { _id: string; nombre: string; anio: number }; resumen: ResumenTallaCuota & { hombres: ResumenTallaCuota; mujeres: ResumenTallaCuota }; bloques: string[]; personas: PersonaTallaCuota[] };
export async function obtenerReporteEjecutivo() { try { return (await api.get<Reporte>("/reportes/ejecutivo")).data; } catch (e) { throw new Error(obtenerMensajeError(e, "No se pudo generar el reporte")); } }
export async function obtenerAlmacenamiento() { try { return (await api.get<EstadoAlmacenamiento>("/reportes/almacenamiento")).data; } catch (e) { throw new Error(obtenerMensajeError(e, "No se pudo medir el almacenamiento")); } }
export async function obtenerReporteTallas() { try { return (await api.get<{ registros: RegistroTallaReporte[] }>("/reportes/tallas")).data; } catch (e) { throw new Error(obtenerMensajeError(e, "No se pudo generar el reporte de tallas")); } }
export async function obtenerReporteFormacion() { try { return (await api.get<{ guias: RegistroFormacionReporte[]; postulantes: RegistroFormacionReporte[] }>("/reportes/formacion")).data; } catch (e) { throw new Error(obtenerMensajeError(e, "No se pudo generar el reporte de guías")); } }
export async function obtenerReporteTallasPrimeraCuota() { try { return (await api.get<ReporteTallasPrimeraCuota>("/reportes/tallas-primera-cuota")).data; } catch (e) { throw new Error(obtenerMensajeError(e, "No se pudo generar el reporte general de tallas y primera cuota")); } }
