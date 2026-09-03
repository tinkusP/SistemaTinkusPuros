export const METODOS_LECTURA_CAPACITACION = new Set(["GET", "HEAD", "OPTIONS"]);

export function esMetodoPermitidoEnCapacitacion(metodo: unknown) {
  return METODOS_LECTURA_CAPACITACION.has(String(metodo ?? "").toUpperCase());
}

export function tipoCredencialQr(modoCapacitacion: boolean) {
  return modoCapacitacion ? "CREDENCIAL_QR_CAPACITACION" : "CREDENCIAL_QR";
}
