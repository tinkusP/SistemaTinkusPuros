import api from "@/lib/axios";
import { obtenerMensajeError } from "./apiError";

export type ResultadoRestauracion = {
  message: string;
  colecciones: number;
  documentos: number;
  archivos: number;
};

export async function descargarRespaldoCompleto(): Promise<void> {
  try {
    const respuesta = await api.get<ArrayBuffer>("/respaldo/exportar", {
      responseType: "arraybuffer",
      timeout: 10 * 60 * 1000,
    });
    const disposicion = String(respuesta.headers["content-disposition"] ?? "");
    const nombre = disposicion.match(/filename="?([^";]+)"?/i)?.[1]
      ?? `tinkus-respaldo-${new Date().toISOString().slice(0, 10)}.tinkus.gz`;
    const url = URL.createObjectURL(new Blob([respuesta.data], { type: "application/gzip" }));
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = nombre;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    throw new Error(obtenerMensajeError(error, "No se pudo descargar el respaldo"));
  }
}

export async function descargarRespaldoOrganizado(): Promise<void> {
  try {
    const respuesta = await api.get<ArrayBuffer>("/respaldo/exportar-organizado", {
      responseType: "arraybuffer",
      timeout: 15 * 60 * 1000,
    });
    const disposicion = String(respuesta.headers["content-disposition"] ?? "");
    const nombre = disposicion.match(/filename="?([^";]+)"?/i)?.[1]
      ?? `tinkus-completo-${new Date().toISOString().slice(0, 10)}.zip`;
    const url = URL.createObjectURL(new Blob([respuesta.data], { type: "application/zip" }));
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = nombre;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    throw new Error(obtenerMensajeError(error, "No se pudo descargar el ZIP organizado"));
  }
}

export async function importarRespaldoCompleto(
  archivo: File,
  progreso?: (porcentaje: number) => void,
): Promise<ResultadoRestauracion> {
  const formulario = new FormData();
  formulario.append("respaldo", archivo);
  try {
    const { data } = await api.post<ResultadoRestauracion>("/respaldo/importar", formulario, {
      timeout: 15 * 60 * 1000,
      onUploadProgress: (evento) => {
        if (evento.total) progreso?.(Math.round((evento.loaded / evento.total) * 100));
      },
    });
    return data;
  } catch (error) {
    throw new Error(obtenerMensajeError(error, "No se pudo restaurar el respaldo"));
  }
}
