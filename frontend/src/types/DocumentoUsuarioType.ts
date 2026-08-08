// import { z } from "zod";

// import {
//   FechaApiSchema,
//   ObjectIdSchema,
//   UsuarioAuditoriaSchema,
// } from "./CommonType";

// export const TIPOS_DOCUMENTO_USUARIO = [
//   "CARNET_IDENTIDAD",
//   "REGISTRO_UNIVERSITARIO",
// ] as const;

// export const ESTADOS_DOCUMENTO_USUARIO = [
//   "PENDIENTE",
//   "APROBADO",
//   "OBSERVADO",
//   "RECHAZADO",
//   "ELIMINADO",
// ] as const;

// export const TipoDocumentoUsuarioSchema = z.enum(
//   TIPOS_DOCUMENTO_USUARIO,
// );

// export const EstadoDocumentoUsuarioSchema = z.enum(
//   ESTADOS_DOCUMENTO_USUARIO,
// );

// export const DocumentoUsuarioSchema = z
//   .object({
//     _id: ObjectIdSchema,
//     perfilUsuario: ObjectIdSchema,
//     tipoDocumento: TipoDocumentoUsuarioSchema,
//     ruta: z
//       .string()
//       .min(1, "La ruta del documento es obligatoria")
//       .max(500, "La ruta no puede superar 500 caracteres"),
//     estado: EstadoDocumentoUsuarioSchema,
//     observacion: z.string().nullable().optional(),
//     fechaCreado: FechaApiSchema.nullable().optional(),
//     usuarioCreador: UsuarioAuditoriaSchema.nullable().optional(),
//     fechaEdit: FechaApiSchema.nullable().optional(),
//     usuarioEdit: UsuarioAuditoriaSchema.nullable().optional(),
//     fechaEliminado: FechaApiSchema.nullable().optional(),
//     usuarioEliminador: UsuarioAuditoriaSchema.nullable().optional(),
//   })
//   .passthrough();

// export const DocumentoUsuarioArraySchema = z.array(
//   DocumentoUsuarioSchema,
// );

// export const DocumentoUsuarioResponseSchema = z.object({
//   message: z.string().optional(),
//   documento: DocumentoUsuarioSchema,
// });

// export const DocumentosUsuarioResponseSchema = z.object({
//   message: z.string().optional(),
//   documentos: DocumentoUsuarioArraySchema,
// });

// export type TipoDocumentoUsuario = z.infer<
//   typeof TipoDocumentoUsuarioSchema
// >;

// export type EstadoDocumentoUsuario = z.infer<
//   typeof EstadoDocumentoUsuarioSchema
// >;

// export type DocumentoUsuarioType = z.infer<
//   typeof DocumentoUsuarioSchema
// >;

// export type DocumentoUsuarioResponse = z.infer<
//   typeof DocumentoUsuarioResponseSchema
// >;

// export type DocumentosUsuarioResponse = z.infer<
//   typeof DocumentosUsuarioResponseSchema
// >;

// export interface ArchivosRegistroCuenta {
//   fotoPerfil?: File | null;
//   carnetIdentidadPdf: File;
//   registroUniversitarioPdf: File;
// }
import { z } from "zod";

import {
  FechaApiSchema,
  ObjectIdSchema,
  UsuarioAuditoriaSchema,
} from "./CommonType";

export const TIPOS_DOCUMENTO_USUARIO = [
  "CARNET_IDENTIDAD",
  "CARNET_IDENTIDAD_REVERSO",
  "REGISTRO_UNIVERSITARIO",
] as const;

export const ESTADOS_DOCUMENTO_USUARIO = [
  "PENDIENTE",
  "APROBADO",
  "OBSERVADO",
  "RECHAZADO",
  "ELIMINADO",
] as const;

export const TipoDocumentoUsuarioSchema = z.enum(
  TIPOS_DOCUMENTO_USUARIO,
);

export const EstadoDocumentoUsuarioSchema = z.enum(
  ESTADOS_DOCUMENTO_USUARIO,
);

export const DocumentoUsuarioSchema = z
  .object({
    _id:
      ObjectIdSchema,

    /*
     * En algunas respuestas del backend, como el detalle
     * completo de un perfil, este campo no se incluye
     * porque el usuario padre ya está identificado.
     */
    perfilUsuario:
      ObjectIdSchema
        .optional(),

    tipoDocumento:
      TipoDocumentoUsuarioSchema,

    ruta: z
      .string()
      .min(
        1,
        "La ruta del documento es obligatoria",
      )
      .max(
        500,
        "La ruta no puede superar 500 caracteres",
      ),

    estado:
      EstadoDocumentoUsuarioSchema,

    observacion: z
      .string()
      .nullable()
      .optional(),

    fechaCreado:
      FechaApiSchema
        .nullable()
        .optional(),

    usuarioCreador:
      UsuarioAuditoriaSchema
        .nullable()
        .optional(),

    fechaEdit:
      FechaApiSchema
        .nullable()
        .optional(),

    usuarioEdit:
      UsuarioAuditoriaSchema
        .nullable()
        .optional(),

    fechaEliminado:
      FechaApiSchema
        .nullable()
        .optional(),

    usuarioEliminador:
      UsuarioAuditoriaSchema
        .nullable()
        .optional(),
  })
  .passthrough();

export const DocumentoUsuarioArraySchema =
  z.array(
    DocumentoUsuarioSchema,
  );

export const DocumentoUsuarioResponseSchema =
  z.object({
    message:
      z.string()
        .optional(),

    documento:
      DocumentoUsuarioSchema,
  });

export const DocumentosUsuarioResponseSchema =
  z.object({
    message:
      z.string()
        .optional(),

    documentos:
      DocumentoUsuarioArraySchema,
  });

export type TipoDocumentoUsuario =
  z.infer<
    typeof TipoDocumentoUsuarioSchema
  >;

export type EstadoDocumentoUsuario =
  z.infer<
    typeof EstadoDocumentoUsuarioSchema
  >;

export type DocumentoUsuarioType =
  z.infer<
    typeof DocumentoUsuarioSchema
  >;

export type DocumentoUsuarioResponse =
  z.infer<
    typeof DocumentoUsuarioResponseSchema
  >;

export type DocumentosUsuarioResponse =
  z.infer<
    typeof DocumentosUsuarioResponseSchema
  >;

export interface ArchivosRegistroCuenta {
  fotoPerfil?:
    File | null;

  carnetIdentidadPdf?:
    File | null;

  registroUniversitarioPdf?:
    File | null;
}
