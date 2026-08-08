import api from "@/lib/axios";
import { obtenerMensajeError } from "./apiError";

export type PersonaAsistenciaGuia = { _id: string; nombres: string; apellidoPaterno: string; apellidoMaterno?: string; ci: string; email?: string };
export type AsistenciaGuia = { _id: string; postulanteGuiaId: string; usuarioId: string | PersonaAsistenciaGuia; fechaClave: string; horaEntrada: string; horaSalida?: string; estado: "PRESENTE" | "INCOMPLETA" | "ANULADA" };
export type PostulanteAsistencia = { _id: string; estado: string; puntajeTotal: number; preregistroId: { _id: string; numeroPreRegistro: string; usuarioId: PersonaAsistenciaGuia; gestionId: { _id: string; nombre: string; anio?: number } } };
const ejecutar = async <T>(peticion: Promise<{ data: T }>) => { try { return (await peticion).data; } catch (error) { throw new Error(obtenerMensajeError(error)); } };

export const listarAsistenciaPostulantesGuia = (fecha: string) => ejecutar<{ fechaClave: string; postulantes: PostulanteAsistencia[]; asistencias: AsistenciaGuia[] }>(api.get("/asistencias-postulantes-guia", { params: { fecha } }));
export const miAsistenciaPostulanteGuia = () => ejecutar<{ habilitado: boolean; motivoNoHabilitado: string | null; asistencias: AsistenciaGuia[]; hoy: AsistenciaGuia | null }>(api.get("/asistencias-postulantes-guia/mias"));
export const marcarMiEntradaGuia = () => ejecutar<{ message: string; asistencia: AsistenciaGuia }>(api.post("/asistencias-postulantes-guia/entrada"));
export const marcarMiSalidaGuia = () => ejecutar<{ message: string; asistencia: AsistenciaGuia }>(api.patch("/asistencias-postulantes-guia/salida"));
export const marcarEntradaGuiaAdmin = (id: string) => ejecutar<{ message: string }>(api.post(`/asistencias-postulantes-guia/${id}/entrada`));
export const marcarSalidaGuiaAdmin = (id: string) => ejecutar<{ message: string }>(api.patch(`/asistencias-postulantes-guia/${id}/salida`));
