import axios from "axios";
import api from "@/lib/axios";
import { obtenerMensajeError } from "./apiError";

export type FilaNominaSeparada = { usuarioId: string; nombres: string; apellidoPaterno: string; apellidoMaterno: string; nombreCompletoOriginal: string; ci: string; ru: string; telefono: string; whatsapp: string; sexo: string; roles: string; estado: string; observaciones: string[] };
export type RevisionNominaSeparada = {
  resumen: { solicitudes: number; encontrados: number; noEncontrados: number; ambiguos: number; repetidos: number; incompletos: number; requierenRevision: number };
  resultados: Array<{ entrada: string; estado: string; metodo: string; usuarioId: string; candidatos: Array<{ usuarioId: string; nombre: string; ci: string }> }>;
  filas: FilaNominaSeparada[]; huella: string; generadoEn: string; administrador: { id: string; nombre: string };
};
export async function revisarNominaSeparada(lista: string[]) {
  const { data } = await api.post<RevisionNominaSeparada>("/reportes/nomina-separada/revisar", { lista });
  return data;
}
export async function descargarNominaSeparada(lista: string[], huella: string, aceptarObservaciones: boolean) {
  try {
    const { data } = await api.post<Blob>("/reportes/nomina-separada/exportar", { lista, huella, aceptarObservaciones }, { responseType: "blob" });
    const url = URL.createObjectURL(data);
    const enlace = document.createElement("a"); enlace.href = url; enlace.download = "nomina_usuarios_separada.xlsx"; enlace.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data instanceof Blob) {
      const contenido = await error.response.data.text();
      let mensaje = "No se pudo descargar la nómina";
      try { mensaje = JSON.parse(contenido).error || mensaje; } catch { /* Respuesta no JSON del proxy. */ }
      throw new Error(mensaje);
    }
    throw new Error(obtenerMensajeError(error));
  }
}
