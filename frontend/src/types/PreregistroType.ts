export const ESTADOS_PREREGISTRO = [
  "PENDIENTE", "OBSERVADO", "APROBADO", "RECHAZADO", "LISTA_ESPERA", "CANCELADO",
] as const;

export type EstadoPreregistro = (typeof ESTADOS_PREREGISTRO)[number];

export type UsuarioPreregistro = {
  _id: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno?: string | null;
  ci: string;
  email: string;
  sexo?: string | null;
  fotoPerfil?: string | null;
  fechaCreado?: string | null;
};

export type GestionPreregistro = {
  _id: string;
  anio: number;
  nombre: string;
  estado: string;
  cupoMaximo: number;
};

export interface Preregistro {
  _id: string;
  usuarioId: string | UsuarioPreregistro;
  gestionId: string | GestionPreregistro;
  numeroPreRegistro: string;
  fechaRegistro: string;
  estado: EstadoPreregistro;
  aceptoReglamento: boolean;
  examen1?: number;
  examen2?: number;
  examen3?: number;
  examen4?: number;
  examen5?: number;
  examen6?: number;
  promedioExamen?: number;
  puntajeTotal?: number;
  observacion?: string;
  aprobado: boolean;
  postulanteGuia?: { _id: string; estado: string; habilitado: boolean; puntajeTotal: number } | null;
  fraterno?: { _id: string; numeroFraterno: string; estado: string; fechaIngreso: string } | null;
  fechaAprobacion?: string;
  fechaRevision?: string;
  fechaCreado: string;
  fechaEditado?: string;
}

export type PreregistroFormData = {
  usuarioId?: string;
  gestionId?: string;
  estado?: EstadoPreregistro;
  aceptoReglamento?: boolean;
  examen1?: number;
  examen2?: number;
  examen3?: number;
  examen4?: number;
  examen5?: number;
  examen6?: number;
  puntajeTotal?: number;
  observacion?: string;
};

export type PreregistrosResponse = {
  preregistros: Preregistro[];
  paginacion: { pagina: number; limite: number; total: number; paginas: number };
  resumen?: Partial<Record<EstadoPreregistro, number>>;
  cupos?: { hombres: number; mujeres: number; maximoHombres: number; maximoMujeres: number; total: number; maximoTotal: number } | null;
};
