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
export type RegistroTallaReporte = { fraternoId: string; nombres?: string; apellidoPaterno?: string; apellidoMaterno?: string; nombre: string; ci: string; telefono?: string; bloque: string; tallaPolera?: string; tallaChamarra?: string };
export type RegistroFormacionReporte = { id: string; nombres?: string; apellidoPaterno?: string; apellidoMaterno?: string; nombre: string; ci: string; telefono?: string; email?: string; bloque?: string; estado: string; puntajeTotal?: number };
export async function obtenerReporteEjecutivo() { try { return (await api.get<Reporte>("/reportes/ejecutivo")).data; } catch (e) { throw new Error(obtenerMensajeError(e, "No se pudo generar el reporte")); } }
export async function obtenerAlmacenamiento() { try { return (await api.get<EstadoAlmacenamiento>("/reportes/almacenamiento")).data; } catch (e) { throw new Error(obtenerMensajeError(e, "No se pudo medir el almacenamiento")); } }
export async function obtenerReporteTallas() { try { return (await api.get<{ registros: RegistroTallaReporte[] }>("/reportes/tallas")).data; } catch (e) { throw new Error(obtenerMensajeError(e, "No se pudo generar el reporte de tallas")); } }
export async function obtenerReporteFormacion() { try { return (await api.get<{ guias: RegistroFormacionReporte[]; postulantes: RegistroFormacionReporte[] }>("/reportes/formacion")).data; } catch (e) { throw new Error(obtenerMensajeError(e, "No se pudo generar el reporte de guías")); } }
