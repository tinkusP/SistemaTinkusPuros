export const TALLAS_DISPONIBLES = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"] as const;
export const TALLA_SIN_REGISTRAR = "SIN DEFINIR";

export const normalizarTallaAdministrativa = (valor: unknown) => {
  const talla = String(valor ?? "").trim().toUpperCase();
  return talla === TALLA_SIN_REGISTRAR || TALLAS_DISPONIBLES.includes(talla as typeof TALLAS_DISPONIBLES[number]) ? talla : null;
};
