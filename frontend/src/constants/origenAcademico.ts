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
