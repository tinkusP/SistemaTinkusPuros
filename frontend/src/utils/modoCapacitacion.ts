export type VistaCapacitacion = { usuarioId: string; nombre: string; tipo: "GUIA" | "FRATERNO" };
const CLAVE = "MODO_CAPACITACION";
export const EVENTO_CAPACITACION = "modo-capacitacion-cambio";

export function obtenerVistaCapacitacion(): VistaCapacitacion | null {
  try {
    const valor = sessionStorage.getItem(CLAVE);
    return valor ? JSON.parse(valor) as VistaCapacitacion : null;
  } catch {
    return null;
  }
}

export function activarVistaCapacitacion(vista: VistaCapacitacion) {
  sessionStorage.setItem(CLAVE, JSON.stringify(vista));
  window.dispatchEvent(new Event(EVENTO_CAPACITACION));
}

export function salirVistaCapacitacion() {
  sessionStorage.removeItem(CLAVE);
  window.dispatchEvent(new Event(EVENTO_CAPACITACION));
}
