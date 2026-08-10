import api from "@/lib/axios";
import type { Asistencia, Fraterno, Traspaso } from "@/types/FraternoType";
import { obtenerMensajeError } from "./apiError";

const ejecutar = async <T>(peticion: Promise<{ data: T }>) => { try { return (await peticion).data; } catch (error) { throw new Error(obtenerMensajeError(error)); } };
export const listarFraternos = () => ejecutar<{ fraternos: Fraterno[] }>(api.get("/fraternos"));
export const enviarFraternoAListaEspera = (id:string,motivo:string) => ejecutar<{message:string;fraterno:Fraterno}>(api.patch(`/fraternos/${id}/lista-espera`,{motivo}));
export const listarTraspasos = () => ejecutar<{ traspasos: Traspaso[] }>(api.get("/traspasos"));
export const crearTraspaso = (datos: { preregistroId: string; usuarioDestinoId: string; motivo: string; observacion?: string }) => ejecutar<{ message: string; traspaso: Traspaso }>(api.post("/traspasos", datos));
export const listarAsistencias = (params?: { fecha?: string; estado?: string }) => ejecutar<{ asistencias: Asistencia[] }>(api.get("/asistencias", { params }));
export const misAsistencias = () => ejecutar<{ habilitado: boolean; motivoNoHabilitado: string | null; fraterno: Fraterno | null; asistencias: Asistencia[]; hoy: Asistencia | null }>(api.get("/asistencias/mias"));
export const marcarEntrada = () => ejecutar<{ message: string; asistencia: Asistencia }>(api.post("/asistencias/entrada"));
export const marcarSalida = () => ejecutar<{ message: string; asistencia: Asistencia }>(api.patch("/asistencias/salida"));
