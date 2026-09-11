export type EstadoAsistenciaEvento = "SIN_REGISTRO" | "DENTRO_DEL_EVENTO" | "ASISTENCIA_COMPLETA";
export type SiguienteAccionEvento = "ENTRADA" | "SALIDA" | "COMPLETA";

export function estadoAsistenciaEvento(asistencia?: { horaIngreso?: unknown; horaSalida?: unknown } | null): EstadoAsistenciaEvento {
  if (!asistencia?.horaIngreso) return "SIN_REGISTRO";
  return asistencia.horaSalida ? "ASISTENCIA_COMPLETA" : "DENTRO_DEL_EVENTO";
}

export function siguienteAccionEvento(asistencia?: { horaIngreso?: unknown; horaSalida?: unknown } | null): SiguienteAccionEvento {
  const estado = estadoAsistenciaEvento(asistencia);
  if (estado === "SIN_REGISTRO") return "ENTRADA";
  return estado === "DENTRO_DEL_EVENTO" ? "SALIDA" : "COMPLETA";
}

export function duracionMinutosEvento(entrada?: Date | string | null, salida?: Date | string | null) {
  if (!entrada || !salida) return null;
  const minutos = Math.floor((new Date(salida).getTime() - new Date(entrada).getTime()) / 60000);
  return Number.isFinite(minutos) && minutos >= 0 ? minutos : null;
}

export function formatearDuracionEvento(minutos: number | null) {
  if (minutos === null) return "—";
  return `${Math.floor(minutos / 60)} h ${minutos % 60} min`;
}
