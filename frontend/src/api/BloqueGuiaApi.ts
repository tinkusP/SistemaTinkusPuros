import api from "@/lib/axios";

export const obtenerSupervisionBloques = async () => (await api.get("/guias")).data;
export const buscarCandidatoGuia = async (ci: string) => (await api.get("/guias/candidato", { params: { ci } })).data;
export const convertirUsuarioEnGuia = (ci: string) => api.post("/guias/convertir-fraterno", { ci });
export const crearBloque = (nombre: string) => api.post("/guias/bloques", { nombre });
export const moverGuia = (guiaId: string, bloqueId: string | null) => api.patch(`/guias/bloques/guias/${guiaId}`, { bloqueId });
export const quitarRolGuia = (guiaId: string) => api.delete(`/guias/${guiaId}/rol`);
export const renombrarBloque = (bloqueId: string, nombre: string) => api.patch(`/guias/bloques/${bloqueId}/nombre`, { nombre });
export const cambiarInscripcionesBloque = (bloqueId: string, inscripcionesAbiertas: boolean) => api.patch(`/guias/bloques/${bloqueId}/inscripciones`, { inscripcionesAbiertas });
export const eliminarBloque = (bloqueId: string) => api.delete(`/guias/bloques/${bloqueId}`);
export const buscarUsuariosBloque = async (bloqueId: string, buscar: string) => (await api.get("/guias/bloques/buscar-usuarios", { params: { bloqueId, buscar } })).data;
export const agregarFraternoExistente = (bloqueId: string, fraternoId: string) => api.post("/guias/bloques/integrantes", { bloqueId, fraternoId });
export const registrarYAgregarFraterno = (bloqueId: string, usuarioId: string) => api.post("/guias/bloques/registrar-fraterno", { bloqueId, usuarioId });
export const retirarIntegrante = (detalleId: string) => api.delete(`/guias/bloques/integrantes/${detalleId}`);
export type PendienteBloque = { fraternoId:string; usuarioId:string; nombre:string; ci:string; sexo:"HOMBRE"|"MUJER"|null; telefono?:string; facultad?:string; roles:string[]; condiciones:string[]; esFraterno:boolean; esGuia:boolean; estadoGuia:string; esPostulante:boolean; estadoPostulante:string; condicion:string; fechaPrimeraCuota:string|null; primeraCuota:string; tallaPolera:string|null; tallaChamarra:string|null; estado:string; listo:boolean };
export type BloqueDisponible = { _id:string; nombre:string; inscripcionesAbiertas?:boolean; capacidad:{HOMBRE:number;MUJER:number} };
export const obtenerPendientesBloque = async () => (await api.get("/guias/bloques/pendientes")).data as { gestion:any; personas:PendienteBloque[]; bloques:BloqueDisponible[] };
