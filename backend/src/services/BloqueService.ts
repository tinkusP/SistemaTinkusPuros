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

export function capacidadSector(genero: GeneroBloque, filas: number, columnas: number) {
  return Math.min(filas * columnas, LIMITES_BLOQUE[genero]);
}

export function validarDimensionesBloque(datos: {
  filasHombres: number;
  columnasHombres: number;
  filasMujeres: number;
  columnasMujeres: number;
}) {
  const capacidadHombres = datos.filasHombres * datos.columnasHombres;
  const capacidadMujeres = datos.filasMujeres * datos.columnasMujeres;
  if (capacidadHombres > LIMITES_BLOQUE.HOMBRE) return "La capacidad de hombres no puede superar 40";
  if (capacidadMujeres > LIMITES_BLOQUE.MUJER) return "La capacidad de mujeres no puede superar 80";
  return null;
}

export function mensajeCupoCompleto(genero: GeneroBloque) {
  const limite = LIMITES_BLOQUE[genero];
  return `Cupo de ${genero === "HOMBRE" ? "hombres" : "mujeres"} completo: ${limite}/${limite}.`;
}
