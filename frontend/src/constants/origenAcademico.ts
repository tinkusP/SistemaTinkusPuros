import type { TipoOrigen } from "@/types/PerfilUsuarioType";

export const FACULTAD_FCPN = "FACULTAD DE CIENCIAS PURAS Y NATURALES (FCPN)";
export const CARRERAS_FCPN = ["BIOLOGÍA", "ESTADÍSTICA", "FÍSICA", "INFORMÁTICA", "MATEMÁTICA", "CIENCIAS QUÍMICAS"] as const;
export const OPCIONES_ORIGEN_ACADEMICO: Array<{ value: TipoOrigen; label: string }> = [
  { value: "INTERNO_UMSA", label: "Interno · Facultad de Ciencias Puras y Naturales (FCPN)" },
  { value: "EXTERNO_UMSA", label: "Externo · Otra facultad de la UMSA" },
  { value: "EXTERNO_NO_UMSA", label: "Externo · No pertenece a la UMSA" },
];

export const normalizarOrigenAcademico = (origen: TipoOrigen): TipoOrigen =>
  origen === "INTERNO" ? "INTERNO_UMSA" : origen === "EXTERNO" ? "EXTERNO_NO_UMSA" : origen;

const claveComparable = (valor: string) => valor
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLocaleUpperCase("es-BO")
  .replace(/\bFACULTAD\s+DE\b/g, "")
  .replace(/[^A-Z0-9]+/g, " ")
  .replace(/^(FAC|F C|C S|CS)\s+/, "")
  .replace(/\bCIENCIA\b/g, "CIENCIAS")
  .trim()
  .replace(/\s+/g, " ");

const FACULTADES_EQUIVALENTES: Array<[RegExp, string]> = [
  [/^(CIENCIAS )?PURAS( Y NATURALES)?( FCPN)?$/, FACULTAD_FCPN],
  [/^(CIENCIAS )?ECONOMICAS( Y FINANCIERAS)?$|^CIENCIAS FINANCIERAS Y ECONOMICAS$/, "FACULTAD DE CIENCIAS ECONÓMICAS Y FINANCIERAS"],
  [/^(CIENCIAS )?FARMACEUTICAS Y BIOQUIMICAS$/, "FACULTAD DE CIENCIAS FARMACÉUTICAS Y BIOQUÍMICAS"],
  [/^DERECHO( Y CIENCIAS POLITICAS)?$/, "FACULTAD DE DERECHO Y CIENCIAS POLÍTICAS"],
];

export const normalizarFacultadAcademica = (facultad?: string | null): string => {
  if (!facultad?.trim()) return "SIN FACULTAD";
  const clave = claveComparable(facultad);
  const equivalente = FACULTADES_EQUIVALENTES.find(([patron]) => patron.test(clave));
  return equivalente?.[1] ?? facultad.trim().toLocaleUpperCase("es-BO").replace(/\s+/g, " ");
};
