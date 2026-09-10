import api from "@/lib/axios";
import type { Asistencia, Fraterno, Traspaso } from "@/types/FraternoType";
import { obtenerMensajeError } from "./apiError";

const ejecutar = async <T>(peticion: Promise<{ data: T }>) => { try { return (await peticion).data; } catch (error) { throw new Error(obtenerMensajeError(error)); } };
export const listarFraternos = () => ejecutar<{ fraternos: Fraterno[] }>(api.get("/fraternos"));
export type FichaIntegralFraterno = { historial: { condicion: string; primeraGestion: number | null; gestiones: number[]; totalGestiones: number }; bloque: { nombre?: string } | null; fechaAsignacion: string | null; talla: { tallaPolera?: string; tallaChamarra?: string } | null; pack: { estado: string; articulos: Record<string, boolean> }; lineaTiempo: Array<{ fecha: string; tipo: string; detalle: string }> };
export const obtenerFichaIntegralFraterno = (id:string) => ejecutar<FichaIntegralFraterno>(api.get(`/fraternos/${id}/ficha-integral`));
export const enviarFraternoAListaEspera = (id:string,motivo:string) => ejecutar<{message:string;fraterno:Fraterno}>(api.patch(`/fraternos/${id}/lista-espera`,{motivo}));
export const listarTraspasos = () => ejecutar<{ traspasos: Traspaso[] }>(api.get("/traspasos"));
export const crearTraspaso = (datos: { preregistroId: string; usuarioDestinoId: string; motivo: string; observacion?: string }) => ejecutar<{ message: string; traspaso: Traspaso }>(api.post("/traspasos", datos));
export const listarAsistencias = (params?: { fecha?: string; estado?: string }) => ejecutar<{ asistencias: Asistencia[] }>(api.get("/asistencias", { params }));
export const misAsistencias = () => ejecutar<{ habilitado: boolean; motivoNoHabilitado: string | null; fraterno: Fraterno | null; asistencias: Asistencia[]; hoy: Asistencia | null }>(api.get("/asistencias/mias"));
export const marcarEntrada = () => ejecutar<{ message: string; asistencia: Asistencia }>(api.post("/asistencias/entrada"));
export const marcarSalida = () => ejecutar<{ message: string; asistencia: Asistencia }>(api.patch("/asistencias/salida"));
