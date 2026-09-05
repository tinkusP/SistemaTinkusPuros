export type GeneroBloque = "HOMBRE" | "MUJER";

export interface UsuarioBloque {
  _id: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno?: string;
  ci: string;
  sexo?: GeneroBloque;
  email?: string;
  telefono?: string;
  fotoPerfil?: string;
}

export interface GuiaBloque {
  _id: string;
  usuarioId: UsuarioBloque;
  estado: "ACTIVO" | "INACTIVO" | "RETIRADO";
}

export interface BloqueAdministrativo {
  _id: string;
  nombre: string;
  estado: "ACTIVO" | "CERRADO";
  guiaId?: GuiaBloque;
  guiasIds: GuiaBloque[];
  cantidadGuiasHombres: number;
  cantidadGuiasMujeres: number;
  cantidadHombres: number;
  cantidadMujeres: number;
}
