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
