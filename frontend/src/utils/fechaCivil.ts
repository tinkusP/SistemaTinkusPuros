/** Formatea una fecha civil sin desplazarla por la zona horaria del navegador. */
export function formatearFechaCivil(fecha?: string | Date | null): string {
  if (!fecha) return "No registrada";
  const texto = fecha instanceof Date ? fecha.toISOString() : String(fecha);
  const partes = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!partes) return "Fecha no válida";
  const valor = new Date(Date.UTC(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3])));
  return new Intl.DateTimeFormat("es-BO", {
    year: "numeric",
    month: "long",
    day: "2-digit",
    timeZone: "UTC",
  }).format(valor);
}

export function fechaCivilParaInput(fecha?: string | null): string {
  if (!fecha) return "";
  return String(fecha).match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? "";
}

/** Formato corto para fechas sin hora (por ejemplo, fechas elegidas en un input date). */
export function formatearFechaCivilCorta(fecha?: string | Date | null): string {
  if (!fecha) return "No registrada";
  const texto = fecha instanceof Date ? fecha.toISOString() : String(fecha);
  const partes = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!partes) return "Fecha no válida";
  return `${Number(partes[3])}/${Number(partes[2])}/${partes[1]}`;
}

/** Día actual de Bolivia en formato compatible con input[type=date]. */
export function fechaActualBoliviaParaInput(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/La_Paz",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
