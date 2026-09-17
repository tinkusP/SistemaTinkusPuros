import api from "@/lib/axios";

export type FilaIntegral = Record<string, string | number | boolean | null>;
export type PersonaIntegral = FilaIntegral & {
  usuarioId: string; nombre: string; ci: string; tieneBloque: boolean; tieneTalla: boolean;
};
export type AuditoriaIntegral = {
  generadoEn: string; gestion: { nombre: string; anio: number } | null; alcance: string;
  resumen: Record<string, number>; porTipo: FilaIntegral[]; porBloque: FilaIntegral[];
  personas: PersonaIntegral[]; pagosDetallados: FilaIntegral[];
  entregasDetalladas: FilaIntegral[]; diferencias: FilaIntegral[];
};
export async function obtenerAuditoriaIntegral() {
  const { data } = await api.get<AuditoriaIntegral>("/reportes/auditoria-integral");
  return data;
}
