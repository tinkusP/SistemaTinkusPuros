import api from "@/lib/axios";
export type Evento = { _id: string; nombre: string; descripcion?: string; tipo: string; fecha: string; horaInicio?: string; horaFin?: string; estado: "PROGRAMADO"|"ACTIVO"|"CERRADO"|"CANCELADO"; presentes: number };
export const listarEventos = async () => (await api.get("/eventos")).data as { eventos: Evento[] };
export const crearEvento = async (datos: { nombre:string; tipo:string; fecha:string; horaInicio?:string; horaFin?:string; descripcion?:string }) => (await api.post("/eventos", datos)).data;
export const cambiarEstadoEvento = async (id:string, estado:Evento["estado"]) => (await api.patch(`/eventos/${id}/estado`,{estado})).data;
export const obtenerEvento = async (id:string) => (await api.get(`/eventos/${id}`)).data;
export const registrarAsistenciaEvento = async (id:string, usuarioId:string, metodoRegistro:"QR"|"CI"|"NOMBRE"|"MANUAL"="MANUAL") => (await api.post(`/eventos/${id}/asistencias`,{usuarioId,metodoRegistro})).data;
