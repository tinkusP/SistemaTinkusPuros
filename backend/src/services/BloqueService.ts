export type GeneroBloque = "HOMBRE" | "MUJER";

export const LIMITES_BLOQUE = {
  HOMBRE: 40,
  MUJER: 80,
  TOTAL: 120,
  GUIAS_POR_GENERO: 2,
  GUIAS_TOTAL: 4,
} as const;

export function normalizarGeneroBloque(valor: unknown): GeneroBloque | null {
  const genero = String(valor ?? "").trim().toUpperCase();
  if (["HOMBRE", "MASCULINO", "VARON", "VARÓN", "M"].includes(genero)) return "HOMBRE";
  if (["MUJER", "FEMENINO", "F"].includes(genero)) return "MUJER";
  return null;
}

export function mensajeCupoCompleto(genero: GeneroBloque) {
  const limite = LIMITES_BLOQUE[genero];
  return `Cupo de ${genero === "HOMBRE" ? "hombres" : "mujeres"} completo: ${limite}/${limite}.`;
}

export function validarCupoIntegrante(genero: GeneroBloque, cantidadActual: number) {
  return cantidadActual < LIMITES_BLOQUE[genero] ? null : mensajeCupoCompleto(genero);
}

export function validarCupoGuia(genero: GeneroBloque, cantidadActual: number) {
  return cantidadActual < LIMITES_BLOQUE.GUIAS_POR_GENERO
    ? null
    : `El bloque ya tiene 2 guías ${genero === "HOMBRE" ? "hombres" : "mujeres"}.`;
}
