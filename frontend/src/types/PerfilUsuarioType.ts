// import { z } from "zod";
// import { RolSchema } from "./RolType";

// /* =========================================
//    OBJECT ID
// ========================================= */

// export const ObjectIdStringSchema = z.preprocess(
//   (value) => {
//     if (
//       typeof value === "object" &&
//       value !== null &&
//       "_id" in value
//     ) {
//       return (
//         value as {
//           _id: unknown;
//         }
//       )._id;
//     }

//     return value;
//   },
//   z
//     .string()
//     .regex(
//       /^[a-fA-F0-9]{24}$/,
//       "ObjectId no válido",
//     ),
// );

// /* =========================================
//    ESTADOS
// ========================================= */

// export const EstadoUsuarioSchema = z.enum([
//   "PENDIENTE",
//   "ACTIVO",
//   "BLOQUEADO",
//   "INACTIVO",
//   "ELIMINADO",
// ]);

// export const TipoOrigenSchema = z.enum([
//   "INTERNO",
//   "EXTERNO",
// ]);

// export const TipoFraternoSchema = z.enum([
//   "NUEVO",
//   "ANTIGUO",
// ]);

// /* =========================================
//    PERMISO POPULADO
// ========================================= */

// export const PermisoPopulateSchema = z
//   .object({
//     _id: ObjectIdStringSchema,

//     nombre: z
//       .string()
//       .nullable()
//       .optional(),

//     codigo: z
//       .string()
//       .min(
//         1,
//         "El código del permiso es obligatorio",
//       ),

//     descripcion: z
//       .string()
//       .nullable()
//       .optional(),

//     estado: z
//       .boolean()
//       .optional(),
//   })
//   .passthrough();

// /* =========================================
//    PERMISO FLEXIBLE
// ========================================= */

// export const PermisoFlexibleSchema = z.union([
//   /*
//    * El objeto poblado debe colocarse primero.
//    * De lo contrario se convertiría únicamente
//    * en su propiedad _id.
//    */
//   PermisoPopulateSchema,

//   ObjectIdStringSchema,
// ]);

// /* =========================================
//    ROL POPULADO
// ========================================= */

// export const RolPopulateSchema = z
//   .object({
//     _id: ObjectIdStringSchema,

//     nombre: z
//       .string()
//       .min(
//         1,
//         "El nombre del rol es obligatorio",
//       ),

//     codigo: z
//       .string()
//       .min(
//         1,
//         "El código del rol es obligatorio",
//       ),

//     descripcion: z
//       .string()
//       .nullable()
//       .optional(),

//     permisos: z
//       .array(PermisoFlexibleSchema)
//       .default([]),

//     estado: z
//       .boolean()
//       .optional(),

//     esRolSistema: z
//       .boolean()
//       .optional(),
//   })
//   .passthrough();

// /* =========================================
//    ROL FLEXIBLE
// ========================================= */

// export const RolFlexibleSchema = z.union([
//   /*
//    * IMPORTANTE:
//    * RolPopulateSchema debe ir primero.
//    *
//    * Si ObjectIdStringSchema estuviera primero,
//    * recibiría el objeto del rol y lo convertiría
//    * solamente en su _id.
//    */
//   RolPopulateSchema,

//   ObjectIdStringSchema,
// ]);

// /* =========================================
//    PERFIL USUARIO
// ========================================= */

// export const PerfilUsuarioSchema = z
//   .object({
//     _id: ObjectIdStringSchema.optional(),

//     roles: z
//       .array(RolSchema)
//       .default([]),

//     nombres: z
//       .string()
//       .min(
//         1,
//         "Los nombres son obligatorios",
//       ),

//     apellidoPaterno: z
//       .string()
//       .min(
//         1,
//         "El apellido paterno es obligatorio",
//       ),

//     apellidoMaterno: z
//       .string()
//       .nullable()
//       .optional(),

//     ci: z
//       .string()
//       .min(
//         1,
//         "El CI es obligatorio",
//       ),

//     complementoCi: z
//       .string()
//       .nullable()
//       .optional(),

//     expedidoCi: z
//       .string()
//       .nullable()
//       .optional(),

//     fechaNacimiento: z
//       .string()
//       .nullable()
//       .optional(),

//     sexo: z
//       .string()
//       .nullable()
//       .optional(),

//     telefono: z
//       .string()
//       .min(
//         1,
//         "El teléfono es obligatorio",
//       ),

//     email: z
//       .string()
//       .email(
//         "Correo electrónico no válido",
//       ),

//     fotoPerfil: z
//       .string()
//       .nullable()
//       .optional(),

//     tipoOrigen:
//       TipoOrigenSchema,

//     tipoFraterno:
//       TipoFraternoSchema,

//     registroUniversitario: z
//       .string()
//       .nullable()
//       .optional(),

//     facultad: z
//       .string()
//       .nullable()
//       .optional(),

//     carrera: z
//       .string()
//       .nullable()
//       .optional(),

//     password: z
//       .string()
//       .optional(),

//     estado:
//       EstadoUsuarioSchema,

//     emailVerificado: z
//       .boolean()
//       .default(false),

//     intentosFallidos: z.coerce
//       .number()
//       .default(0),

//     bloqueadoHasta: z
//       .string()
//       .nullable()
//       .optional(),

//     ultimoLogin: z
//       .string()
//       .nullable()
//       .optional(),

//     ultimoCambioPassword: z
//       .string()
//       .nullable()
//       .optional(),

//     requiereCambioPassword: z
//       .boolean()
//       .default(false),

//     usuarioCreador:
//       ObjectIdStringSchema
//         .nullable()
//         .optional(),

//     fechaCreado: z
//       .string()
//       .nullable()
//       .optional(),

//     usuarioEdit:
//       ObjectIdStringSchema
//         .nullable()
//         .optional(),

//     fechaEdit: z
//       .string()
//       .nullable()
//       .optional(),

//     usuarioEliminador:
//       ObjectIdStringSchema
//         .nullable()
//         .optional(),

//     fechaEliminado: z
//       .string()
//       .nullable()
//       .optional(),
//   })
//   .passthrough();

// /* =========================================
//    PERFIL SEGURO
// ========================================= */

// export const PerfilUsuarioSafeSchema =
//   PerfilUsuarioSchema.omit({
//     password: true,
//   });

// /* =========================================
//    ARRAY DE PERFILES
// ========================================= */

// export const PerfilUsuarioArraySchema =
//   z.array(
//     PerfilUsuarioSafeSchema,
//   );

// /* =========================================
//    LOGIN
// ========================================= */

// export const LoginSchema = z.object({
//   email: z
//     .string()
//     .min(
//       1,
//       "El correo es obligatorio",
//     )
//     .email(
//       "Correo electrónico no válido",
//     ),

//   password: z
//     .string()
//     .min(
//       1,
//       "La contraseña es obligatoria",
//     ),
// });

// /* =========================================
//    RESPUESTA LOGIN
// ========================================= */

// export const LoginResponseSchema = z
//   .object({
//     message: z.string(),

//     tokenjwt: z.string(),

//     usuario:
//       PerfilUsuarioSafeSchema,
//   })
//   .passthrough();

// /* =========================================
//    TYPES DE PERMISOS
// ========================================= */

// export type PermisoPopulateType =
//   z.infer<
//     typeof PermisoPopulateSchema
//   >;

// export type PermisoFlexibleType =
//   z.infer<
//     typeof PermisoFlexibleSchema
//   >;

// /* =========================================
//    TYPES DE ROLES
// ========================================= */

// export type RolPopulateType =
//   z.infer<
//     typeof RolPopulateSchema
//   >;

// export type RolFlexibleType =
//   z.infer<
//     typeof RolFlexibleSchema
//   >;

// /* =========================================
//    TYPES DE USUARIO
// ========================================= */

// export type PerfilUsuarioType =
//   z.infer<
//     typeof PerfilUsuarioSchema
//   >;

// export type PerfilUsuarioSafeType =
//   z.infer<
//     typeof PerfilUsuarioSafeSchema
//   >;

// export type LoginForm =
//   z.infer<
//     typeof LoginSchema
//   >;

// export type LoginResponse =
//   z.infer<
//     typeof LoginResponseSchema
//   >;

// export type Auth =
//   PerfilUsuarioSafeType;

// export type UsuarioLoginForm =
//   Pick<
//     LoginForm,
//     "email" | "password"
//   >;

// /* =========================================
//    FORMULARIO CREAR USUARIO
// ========================================= */

// export type PerfilUsuarioForm = {
//   roles: string[];

//   nombres: string;

//   apellidoPaterno: string;

//   apellidoMaterno?: string;

//   ci: string;

//   complementoCi?: string;

//   expedidoCi?: string;

//   fechaNacimiento?: string;

//   sexo?: string;

//   telefono: string;

//   email: string;

//   fotoPerfil?: string;

//   tipoOrigen:
//     | "INTERNO"
//     | "EXTERNO";

//   tipoFraterno:
//     | "NUEVO"
//     | "ANTIGUO";

//   registroUniversitario?: string;

//   facultad?: string;

//   carrera?: string;

//   password: string;

//   estado?:
//     | "PENDIENTE"
//     | "ACTIVO"
//     | "BLOQUEADO"
//     | "INACTIVO"
//     | "ELIMINADO";

//   emailVerificado?: boolean;

//   requiereCambioPassword?: boolean;
// };

// /* =========================================
//    FORMULARIO EDITAR PERFIL
// ========================================= */

// export type PerfilPersonalForm = {
//   nombres: string;

//   apellidoPaterno: string;

//   apellidoMaterno?: string;

//   ci: string;

//   complementoCi?: string;

//   expedidoCi?: string;

//   fechaNacimiento?: string;

//   sexo?: string;

//   telefono: string;

//   email: string;

//   fotoPerfil?: string;

//   tipoOrigen:
//     | "INTERNO"
//     | "EXTERNO";

//   tipoFraterno:
//     | "NUEVO"
//     | "ANTIGUO";

//   registroUniversitario?: string;

//   facultad?: string;

//   carrera?: string;
// };

// /* =========================================
//    VALIDAR ROL DEL USUARIO
// ========================================= */

// export function usuarioTieneRol(
//   usuario:
//     | PerfilUsuarioSafeType
//     | null
//     | undefined,

//   codigoBuscado: string,
// ): boolean {
//   if (!usuario) {
//     return false;
//   }

//   const codigoNormalizado =
//     codigoBuscado
//       .trim()
//       .toUpperCase();

//   return usuario.roles.some(
//     (rol) => {
//       if (
//         typeof rol ===
//         "string"
//       ) {
//         return false;
//       }

//       return (
//         rol.codigo
//           .trim()
//           .toUpperCase() ===
//         codigoNormalizado
//       );
//     },
//   );
// }

// /* =========================================
//    VALIDAR PERMISO DEL USUARIO
// ========================================= */

// export function usuarioTienePermiso(
//   usuario:
//     | PerfilUsuarioSafeType
//     | null
//     | undefined,

//   codigoBuscado: string,
// ): boolean {
//   if (!usuario) {
//     return false;
//   }

//   const codigoNormalizado =
//     codigoBuscado
//       .trim()
//       .toUpperCase();

//   return usuario.roles.some(
//     (rol) => {
//       if (
//         typeof rol ===
//         "string"
//       ) {
//         return false;
//       }

//       return rol.permisos.some(
//         (permiso) => {
//           if (
//             typeof permiso ===
//             "string"
//           ) {
//             return false;
//           }

//           return (
//             permiso.codigo
//               .trim()
//               .toUpperCase() ===
//             codigoNormalizado
//           );
//         },
//       );
//     },
//   );
// }
import { z } from "zod";

import {
  FechaApiSchema,
  ObjectIdSchema,
  UsuarioAuditoriaSchema,
} from "./CommonType";

import {
  RolSchema,
  type RolType,
} from "./RolType";

import {
  GestionSchema,
  type Gestion,
} from "./GestionType";

import {
  DocumentoUsuarioArraySchema,
  type DocumentoUsuarioType,
} from "./DocumentoUsuarioType";

export const ESTADOS_USUARIO = [
  "PENDIENTE",
  "ACTIVO",
  "BLOQUEADO",
  "INACTIVO",
  "ELIMINADO",
] as const;

export const TIPOS_ORIGEN = [
  "INTERNO",
  "EXTERNO",
  "INTERNO_UMSA",
  "EXTERNO_UMSA",
  "EXTERNO_NO_UMSA",
] as const;

export const TIPOS_FRATERNO = [
  "NUEVO",
  "ANTIGUO",
] as const;

export const EstadoUsuarioSchema = z.enum(ESTADOS_USUARIO);
export const TipoOrigenSchema = z.enum(TIPOS_ORIGEN);
export const TipoFraternoSchema = z.enum(TIPOS_FRATERNO);

/*
 * El backend normalmente devuelve roles y gestiones poblados.
 * Estas uniones también permiten recibir solamente el ObjectId.
 */
export const RolRelacionSchema = z.union([
  RolSchema,
  ObjectIdSchema,
]);

export const GestionRelacionSchema = z.union([
  GestionSchema,
  ObjectIdSchema,
]);

export const PerfilUsuarioSchema = z
  .object({
    _id: ObjectIdSchema,

    roles: z.array(RolRelacionSchema).default([]),
    gestion: z.array(GestionRelacionSchema).default([]),

    nombres: z.string().min(1, "Los nombres son obligatorios"),
    apellidoPaterno: z.string().default(""),
    apellidoMaterno: z.string().nullable().optional(),

    ci: z.string().min(1, "El CI es obligatorio"),
    complementoCi: z.string().nullable().optional(),
    expedidoCi: z.string().nullable().optional(),

    fechaNacimiento: FechaApiSchema.nullable().optional(),
    sexo: z.string().nullable().optional(),

    telefono: z.string().min(1, "El teléfono es obligatorio"),
    email: z.string().email("Correo electrónico no válido"),
    fotoPerfil: z.string().nullable().optional(),

    tipoOrigen: TipoOrigenSchema,
    tipoFraterno: TipoFraternoSchema,

    registroUniversitario: z.string().nullable().optional(),
    facultad: z.string().nullable().optional(),
    carrera: z.string().nullable().optional(),

    estado: EstadoUsuarioSchema,
    emailVerificado: z.boolean().default(false),
    intentosFallidos: z.number().int().default(0),
    bloqueadoHasta: FechaApiSchema.nullable().optional(),
    ultimoLogin: FechaApiSchema.nullable().optional(),
    ultimoCambioPassword: FechaApiSchema.nullable().optional(),
    requiereCambioPassword: z.boolean().default(false),

    fechaCreado: FechaApiSchema.nullable().optional(),
    usuarioCreador: UsuarioAuditoriaSchema.nullable().optional(),
    fechaEdit: FechaApiSchema.nullable().optional(),
    usuarioEdit: UsuarioAuditoriaSchema.nullable().optional(),
    fechaEliminado: FechaApiSchema.nullable().optional(),
    usuarioEliminador: UsuarioAuditoriaSchema.nullable().optional(),

    // Solo aparece en la consulta completa por ID.
    documentos: DocumentoUsuarioArraySchema.optional(),
  })
  .passthrough();

export const PerfilUsuarioArraySchema = z.array(PerfilUsuarioSchema);

export const PerfilUsuarioDetalleSchema = PerfilUsuarioSchema.extend({
  documentos: DocumentoUsuarioArraySchema.default([]),
});

export const LoginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "El correo es obligatorio")
    .email("Correo electrónico no válido"),
  password: z.string().min(1, "La contraseña es obligatoria"),
});

export const LoginResponseSchema = z
  .object({
    message: z.string(),
    tokenjwt: z.string(),
    usuario: PerfilUsuarioSchema,
  })
  .passthrough();

export const RegistrarCuentaResponseSchema = z.object({
  message: z.string(),
  perfil: PerfilUsuarioSchema,
  documentos: DocumentoUsuarioArraySchema,
});

export const PerfilPorIdResponseSchema = z.object({
  message: z.string().optional(),
  perfil: PerfilUsuarioDetalleSchema,
});

export const PerfilesResponseSchema = z.object({
  total: z.number().int(),
  perfiles: PerfilUsuarioArraySchema,
});

export const ActualizarPerfilResponseSchema = z.object({
  message: z.string(),
  perfil: PerfilUsuarioSchema,
});

export type EstadoUsuario = z.infer<typeof EstadoUsuarioSchema>;
export type TipoOrigen = z.infer<typeof TipoOrigenSchema>;
export type TipoFraterno = z.infer<typeof TipoFraternoSchema>;
export type RolRelacionType = z.infer<typeof RolRelacionSchema>;
export type GestionRelacionType = z.infer<typeof GestionRelacionSchema>;
export type PerfilUsuarioType = z.infer<typeof PerfilUsuarioSchema>;
export type PerfilUsuarioSafeType = PerfilUsuarioType;
export type PerfilUsuarioDetalleType = z.infer<
  typeof PerfilUsuarioDetalleSchema
>;
export type Auth = PerfilUsuarioType;
export type LoginForm = z.infer<typeof LoginSchema>;
export type UsuarioLoginForm = Pick<LoginForm, "email" | "password">;
export type LoginResponse = z.infer<typeof LoginResponseSchema>;
export type RegistrarCuentaResponse = z.infer<
  typeof RegistrarCuentaResponseSchema
>;
export type PerfilPorIdResponse = z.infer<
  typeof PerfilPorIdResponseSchema
>;
export type PerfilesResponse = z.infer<typeof PerfilesResponseSchema>;
export type ActualizarPerfilResponse = z.infer<
  typeof ActualizarPerfilResponseSchema
>;

/* =========================================
   FORMULARIO DE REGISTRO
========================================= */

export interface PerfilUsuarioForm {
  tokenRegistro?: string;
  roles: string[];
  gestion: string[];

  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno?: string;

  ci: string;
  complementoCi?: string;
  expedidoCi?: string;

  fechaNacimiento?: string;
  sexo?: string;

  telefono: string;
  email: string;

  tipoOrigen: TipoOrigen;
  tipoFraterno: TipoFraterno;

  registroUniversitario?: string;
  facultad?: string;
  carrera?: string;

  password: string;

  fotoPerfil?: File | null;
  carnetIdentidadPdf?: File | null;
  carnetIdentidadReverso?: File | null;
  registroUniversitarioPdf?: File | null;
}

/* =========================================
   FORMULARIO DE ACTUALIZACIÓN
========================================= */

export interface ActualizarPerfilForm {
  roles?: string[];
  gestion?: string[];

  nombres?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;

  ci?: string;
  complementoCi?: string;
  expedidoCi?: string;

  fechaNacimiento?: string;
  sexo?: string;

  telefono?: string;
  email?: string;
  fotoPerfil?: File | null;

  tipoOrigen?: TipoOrigen;
  tipoFraterno?: TipoFraterno;

  registroUniversitario?: string;
  facultad?: string;
  carrera?: string;

  estado?: Exclude<EstadoUsuario, "ELIMINADO">;
  emailVerificado?: boolean;
  requiereCambioPassword?: boolean;
}

export type PerfilPersonalForm = Omit<
  ActualizarPerfilForm,
  | "roles"
  | "gestion"
  | "estado"
  | "emailVerificado"
  | "requiereCambioPassword"
>;

export interface CambiarPasswordForm {
  passwordActual: string;
  passwordNueva: string;
}

export function esRolPoblado(
  rol: RolRelacionType,
): rol is RolType {
  return typeof rol !== "string";
}

export function esGestionPoblada(
  gestion: GestionRelacionType,
): gestion is Gestion {
  return typeof gestion !== "string";
}

export function usuarioTieneRol(
  usuario: PerfilUsuarioType | null | undefined,
  codigoBuscado: string,
): boolean {
  if (!usuario) return false;

  const codigoNormalizado = codigoBuscado.trim().toUpperCase();

  return usuario.roles.some(
    (rol) =>
      esRolPoblado(rol) &&
      rol.codigo.trim().toUpperCase() === codigoNormalizado,
  );
}

export function usuarioTienePermiso(
  usuario: PerfilUsuarioType | null | undefined,
  codigoBuscado: string,
): boolean {
  if (!usuario) return false;

  const codigoNormalizado = codigoBuscado.trim().toUpperCase();

  return usuario.roles.some(
    (rol) =>
      esRolPoblado(rol) &&
      rol.permisos.some(
        (permiso) =>
          permiso.trim().toUpperCase() === codigoNormalizado,
      ),
  );
}

export function obtenerDocumentoPorTipo(
  usuario: PerfilUsuarioDetalleType | null | undefined,
  tipo: DocumentoUsuarioType["tipoDocumento"],
): DocumentoUsuarioType | undefined {
  return usuario?.documentos.find(
    (documento) => documento.tipoDocumento === tipo,
  );
}
