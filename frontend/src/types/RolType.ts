// import { z } from "zod";

// /* =========================================
//    OBJECT ID
// ========================================= */

// export const ObjectIdSchema = z
//   .string()
//   .regex(
//     /^[a-fA-F0-9]{24}$/,
//     "ObjectId no válido",
//   );
// export interface RolOption {
//   _id: string;
//   nombre: string;
//   codigo?: string;
//   descripcion?: string;
// }
// /* =========================================
//    PERMISO POPULADO
// ========================================= */

// export const PermisoPopulateSchema = z
//   .object({
//     _id: ObjectIdSchema.optional(),

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

//     modulo: z
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

// /*
//  * Un permiso puede llegar como:
//  *
//  * 1. ObjectId:
//  *    "6a57fb30d96747f03f9225ad"
//  *
//  * 2. Código:
//  *    "USUARIO_CREAR"
//  *
//  * 3. Objeto poblado:
//  *    {
//  *      _id: "...",
//  *      codigo: "USUARIO_CREAR"
//  *    }
//  */
// export const PermisoFlexibleSchema = z.union([
//   PermisoPopulateSchema,

//   z
//     .string()
//     .min(
//       1,
//       "El permiso no puede estar vacío",
//     ),
// ]);

// /* =========================================
//    ROL
// ========================================= */

// export const RolSchema = z
//   .object({
//     _id: ObjectIdSchema,

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
//       .array(
//         PermisoFlexibleSchema,
//       )
//       .default([]),

//     estado: z
//       .boolean()
//       .optional()
//       .default(true),

//     esRolSistema: z
//       .boolean()
//       .optional()
//       .default(false),

//     usuarioCreador: z
//       .string()
//       .nullable()
//       .optional(),

//     fechaCreado: z
//       .string()
//       .nullable()
//       .optional(),

//     usuarioEdit: z
//       .string()
//       .nullable()
//       .optional(),

//     fechaEdit: z
//       .string()
//       .nullable()
//       .optional(),

//     usuarioEliminador: z
//       .string()
//       .nullable()
//       .optional(),

//     fechaEliminado: z
//       .string()
//       .nullable()
//       .optional(),
//   })
//   .passthrough();

// /* =========================================
//    ARRAY DE ROLES
// ========================================= */

// export const RolArraySchema =
//   z.array(RolSchema);

// /* =========================================
//    RESPUESTAS DEL BACKEND
// ========================================= */

// export const RolResponseSchema = z
//   .object({
//     message: z
//       .string()
//       .optional(),

//     rol: RolSchema,
//   })
//   .passthrough();

// export const RolesResponseSchema = z
//   .object({
//     message: z
//       .string()
//       .optional(),

//     roles: RolArraySchema,
//   })
//   .passthrough();

// /* =========================================
//    FORMULARIO CREAR ROL
// ========================================= */

// export const CrearRolSchema = z.object({
//   nombre: z
//     .string()
//     .trim()
//     .min(
//       1,
//       "El nombre del rol es obligatorio",
//     ),

//   codigo: z
//     .string()
//     .trim()
//     .min(
//       1,
//       "El código del rol es obligatorio",
//     )
//     .transform(
//       (value) =>
//         value.toUpperCase(),
//     ),

//   descripcion: z
//     .string()
//     .trim()
//     .optional()
//     .or(
//       z.literal(""),
//     ),

//   /*
//    * Al crear o editar un rol normalmente
//    * se envían IDs o códigos de permisos.
//    */
//   permisos: z
//     .array(
//       z.string().min(1),
//     )
//     .default([]),

//   estado: z
//     .boolean()
//     .default(true),

//   esRolSistema: z
//     .boolean()
//     .default(false),
// });

// /* =========================================
//    FORMULARIO EDITAR ROL
// ========================================= */

// export const EditarRolSchema =
//   CrearRolSchema.partial();

// /* =========================================
//    TYPES
// ========================================= */

// export type PermisoPopulateType =
//   z.infer<
//     typeof PermisoPopulateSchema
//   >;

// export type PermisoFlexibleType =
//   z.infer<
//     typeof PermisoFlexibleSchema
//   >;

// export type RolType =
//   z.infer<
//     typeof RolSchema
//   >;

// export type RolResponse =
//   z.infer<
//     typeof RolResponseSchema
//   >;

// export type RolesResponse =
//   z.infer<
//     typeof RolesResponseSchema
//   >;

// export type CrearRolForm =
//   z.input<
//     typeof CrearRolSchema
//   >;

// export type CrearRolPayload =
//   z.output<
//     typeof CrearRolSchema
//   >;

// export type EditarRolForm =
//   z.input<
//     typeof EditarRolSchema
//   >;

// export type EditarRolPayload =
//   z.output<
//     typeof EditarRolSchema
//   >;

// /* =========================================
//    HELPERS
// ========================================= */

// export function obtenerCodigoPermiso(
//   permiso: PermisoFlexibleType,
// ): string {
//   if (
//     typeof permiso ===
//     "string"
//   ) {
//     return permiso
//       .trim()
//       .toUpperCase();
//   }

//   return permiso.codigo
//     .trim()
//     .toUpperCase();
// }

// export function rolTienePermiso(
//   rol:
//     | RolType
//     | null
//     | undefined,

//   codigoBuscado: string,
// ): boolean {
//   if (!rol) {
//     return false;
//   }

//   const codigoNormalizado =
//     codigoBuscado
//       .trim()
//       .toUpperCase();

//   return rol.permisos.some(
//     (permiso) =>
//       obtenerCodigoPermiso(
//         permiso,
//       ) ===
//       codigoNormalizado,
//   );
// }

import { z } from "zod";

import {
  FechaApiSchema,
  ObjectIdSchema,
  UsuarioAuditoriaSchema,
} from "./CommonType";

export const RolSchema = z
  .object({
    _id: ObjectIdSchema,
    nombre: z.string().min(1, "El nombre del rol es obligatorio"),
    codigo: z.string().min(1, "El código del rol es obligatorio"),
    descripcion: z.string().nullable().optional(),

    // El backend almacena directamente códigos string[].
    permisos: z.array(z.string().min(1)).default([]),

    estado: z.boolean().default(true),
    esRolSistema: z.boolean().default(false),

    fechaCreado: FechaApiSchema.nullable().optional(),
    usuarioCreador: UsuarioAuditoriaSchema.nullable().optional(),
    fechaEdit: FechaApiSchema.nullable().optional(),
    usuarioEdit: UsuarioAuditoriaSchema.nullable().optional(),
    fechaEliminado: FechaApiSchema.nullable().optional(),
    usuarioEliminador: UsuarioAuditoriaSchema.nullable().optional(),
  })
  .passthrough();

export const RolArraySchema = z.array(RolSchema);

export interface RolOption {
  _id: string;
  nombre: string;
  codigo: string;
  descripcion?: string | null;
}

export const CrearRolSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, "El nombre del rol es obligatorio")
    .max(50, "El nombre no puede superar 50 caracteres"),

  codigo: z
    .string()
    .trim()
    .min(1, "El código del rol es obligatorio")
    .max(50, "El código no puede superar 50 caracteres")
    .regex(
      /^[A-Za-z0-9_]+$/,
      "El código solo puede contener letras, números y guiones bajos",
    )
    .transform((value) => value.toUpperCase()),

  descripcion: z
    .string()
    .trim()
    .max(250, "La descripción no puede superar 250 caracteres")
    .optional()
    .or(z.literal("")),

  permisos: z.array(z.string().trim().min(1)).default([]),
  estado: z.boolean().default(true),
  esRolSistema: z.boolean().default(false),
});

export const EditarRolSchema = CrearRolSchema.partial();

export const RolResponseSchema = z.union([
  RolSchema,
  z
    .object({
      message: z.string().optional(),
      rol: RolSchema,
    })
    .passthrough(),
]);

export const RolesResponseSchema = z.union([
  RolArraySchema,
  z
    .object({
      message: z.string().optional(),
      roles: RolArraySchema,
    })
    .passthrough(),
]);

export type RolType = z.infer<typeof RolSchema>;
export type RolResponse = z.infer<typeof RolResponseSchema>;
export type RolesResponse = z.infer<typeof RolesResponseSchema>;
export type CrearRolForm = z.input<typeof CrearRolSchema>;
export type CrearRolPayload = z.output<typeof CrearRolSchema>;
export type EditarRolForm = z.input<typeof EditarRolSchema>;
export type EditarRolPayload = z.output<typeof EditarRolSchema>;

export function rolTienePermiso(
  rol: RolType | null | undefined,
  codigoBuscado: string,
): boolean {
  if (!rol) return false;

  const codigoNormalizado = codigoBuscado.trim().toUpperCase();

  return rol.permisos.some(
    (permiso) => permiso.trim().toUpperCase() === codigoNormalizado,
  );
}