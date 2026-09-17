import api from "@/lib/axios";
import { obtenerMensajeError } from "./apiError";

export type ResultadoRestauracion = {
  message: string;
  colecciones: number;
  documentos: number;
  archivos: number;
};

export type ProgresoRespaldo = {
  etapa: "INICIALIZANDO" | "BASE_DATOS" | "EXCEL" | "ARCHIVOS" | "FINALIZANDO" | "COMPLETADO";
  tabla?: string;
  procesados?: number;
  total?: number;
  mensaje: string;
};

type EstadoRespaldo = {
  id: string;
  estado: "PREPARANDO" | "LISTO" | "ERROR";
  progreso: ProgresoRespaldo;
  error?: { etapa: string; tabla?: string; mensaje: string };
  archivo?: { nombre: string; bytes: number; colecciones: number; documentos: number; archivos: number };
};

const esperar = (milisegundos: number) => new Promise((resolve) => setTimeout(resolve, milisegundos));

async function descargarTrabajoRespaldo(
  progreso?: (estado: ProgresoRespaldo) => void,
): Promise<void> {
  const inicio = Date.now();
  const { data: creado } = await api.post<EstadoRespaldo>("/respaldo/exportar/preparar", {}, { timeout: 30_000 });
  let trabajo = creado;
  progreso?.(trabajo.progreso);
  while (trabajo.estado === "PREPARANDO") {
    if (Date.now() - inicio > 60 * 60 * 1000) throw new Error("El respaldo superó el tiempo máximo de preparación de 60 minutos");
    await esperar(2_000);
    const respuesta = await api.get<EstadoRespaldo>(`/respaldo/exportar/estado/${trabajo.id}`, { timeout: 30_000 });
    trabajo = respuesta.data;
    progreso?.(trabajo.progreso);
  }
  if (trabajo.estado === "ERROR") {
    const etapa = trabajo.error?.etapa ? ` en ${trabajo.error.etapa}` : "";
    const tabla = trabajo.error?.tabla ? ` (${trabajo.error.tabla})` : "";
    throw new Error(`El respaldo falló${etapa}${tabla}: ${trabajo.error?.mensaje ?? "error desconocido"}`);
  }
  const respuesta = await api.get<Blob>(`/respaldo/exportar/descargar/${trabajo.id}`, {
    responseType: "blob",
    timeout: 0,
  });
  const disposicion = String(respuesta.headers["content-disposition"] ?? "");
  const nombre = disposicion.match(/filename="?([^";]+)"?/i)?.[1]
    ?? trabajo.archivo?.nombre
    ?? `tinkus-completo-${new Date().toISOString().slice(0, 10)}.zip`;
  const url = URL.createObjectURL(respuesta.data);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export async function descargarRespaldoCompleto(progreso?: (estado: ProgresoRespaldo) => void): Promise<void> {
  try {
    await descargarTrabajoRespaldo(progreso);
  } catch (error) {
    throw new Error(obtenerMensajeError(error, "No se pudo descargar el respaldo"));
  }
}

export async function descargarRespaldoOrganizado(progreso?: (estado: ProgresoRespaldo) => void): Promise<void> {
  try {
    await descargarTrabajoRespaldo(progreso);
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
      timeout: 0,
      onUploadProgress: (evento) => {
        if (evento.total) progreso?.(Math.round((evento.loaded / evento.total) * 100));
      },
    });
    return data;
  } catch (error) {
    throw new Error(obtenerMensajeError(error, "No se pudo restaurar el respaldo"));
  }
}
