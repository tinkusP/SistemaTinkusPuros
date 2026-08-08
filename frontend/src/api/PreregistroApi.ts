import api from "@/lib/axios";
import { obtenerMensajeError } from "./apiError";
import type { EstadoPreregistro, Preregistro, PreregistroFormData, PreregistrosResponse } from "@/types/PreregistroType";

const URL = "/preregistros";

export async function obtenerPreregistros(filtros: { estado?: EstadoPreregistro | ""; gestionId?: string; usuarioId?: string; pagina?: number; limite?: number } = {}): Promise<PreregistrosResponse> {
  try {
    // Evita que la vista permanezca indefinidamente en "Cargando" cuando la
    // API o MongoDB local no responden.
    const params = Object.fromEntries(
      Object.entries(filtros).filter(([, valor]) => valor !== "" && valor !== undefined && valor !== null),
    );
    const { data } = await api.get(URL, { params, timeout: 15000 });
    return data as PreregistrosResponse;
  } catch (error) { throw new Error(obtenerMensajeError(error, "No se pudieron cargar los preregistros")); }
}

export async function obtenerMisPreregistros(): Promise<PreregistrosResponse> {
  try { const { data } = await api.get(`${URL}/mios`); return data as PreregistrosResponse; }
  catch (error) { throw new Error(obtenerMensajeError(error, "No se pudo cargar tu historial")); }
}

export async function obtenerPreregistroPorId(id: string): Promise<Preregistro> {
  try { const { data } = await api.get(`${URL}/${id}`); return data.preregistro as Preregistro; }
  catch (error) { throw new Error(obtenerMensajeError(error, "No se pudo cargar el preregistro")); }
}

export async function crearPreregistro(datos: PreregistroFormData): Promise<Preregistro> {
  try { const { data } = await api.post(URL, datos); return data.preregistro as Preregistro; }
  catch (error) { throw new Error(obtenerMensajeError(error, "No se pudo crear el preregistro")); }
}

export async function actualizarPreregistro({ id, datos }: { id: string; datos: PreregistroFormData }): Promise<Preregistro> {
  try { const { data } = await api.put(`${URL}/${id}`, datos); return data.preregistro as Preregistro; }
  catch (error) { throw new Error(obtenerMensajeError(error, "No se pudo actualizar el preregistro")); }
}

export async function eliminarPreregistro(id: string): Promise<{ message: string }> {
  try { const { data } = await api.delete(`${URL}/${id}`); return data; }
  catch (error) { throw new Error(obtenerMensajeError(error, "No se pudo eliminar el preregistro")); }
}
