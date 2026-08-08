import mongoose, {
  Schema,
  Document,
} from "mongoose";

export type TipoDocumentoUsuario =
  | "CARNET_IDENTIDAD"
  | "CARNET_IDENTIDAD_REVERSO"
  | "REGISTRO_UNIVERSITARIO";

export type EstadoDocumentoUsuario =
  | "PENDIENTE"
  | "APROBADO"
  | "OBSERVADO"
  | "RECHAZADO"
  | "ELIMINADO";

export interface DocumentoUsuarioType
  extends Document {
  perfilUsuario:
    mongoose.Types.ObjectId;

  tipoDocumento:
    TipoDocumentoUsuario;

  ruta: string;

  estado:
    EstadoDocumentoUsuario;

  observacion?: string | null;

  fechaCreado?: Date;

  usuarioCreador?:
    | mongoose.Types.ObjectId
    | null;

  fechaEdit?: Date | null;

  usuarioEdit?:
    | mongoose.Types.ObjectId
    | null;

  fechaEliminado?: Date | null;

  usuarioEliminador?:
    | mongoose.Types.ObjectId
    | null;
}

const DocumentoUsuarioSchema:
  Schema<DocumentoUsuarioType> =
    new Schema<DocumentoUsuarioType>(
      {
        /*
        |--------------------------------------------------------------------------
        | Relación con PerfilUsuario
        |--------------------------------------------------------------------------
        */

        perfilUsuario: {
          type:
            Schema.Types.ObjectId,

          ref:
            "PerfilUsuario",

          required: [
            true,
            "El perfil de usuario es obligatorio",
          ],
        },

        tipoDocumento: {
          type:
            String,

          enum: {
            values: [
              "CARNET_IDENTIDAD",
              "CARNET_IDENTIDAD_REVERSO",
              "REGISTRO_UNIVERSITARIO",
            ],

            message:
              "El tipo de documento no es válido",
          },

          required: [
            true,
            "El tipo de documento es obligatorio",
          ],
        },

        /*
         * En MongoDB solamente se guarda
         * la ruta relativa del archivo.
         */
        ruta: {
          type:
            String,

          required: [
            true,
            "La ruta del documento es obligatoria",
          ],

          trim:
            true,

          maxlength: [
            500,
            "La ruta no puede superar los 500 caracteres",
          ],
        },

        estado: {
          type:
            String,

          enum: {
            values: [
              "PENDIENTE",
              "APROBADO",
              "OBSERVADO",
              "RECHAZADO",
              "ELIMINADO",
            ],

            message:
              "El estado del documento no es válido",
          },

          default:
            "PENDIENTE",
        },

        observacion: {
          type:
            String,

          trim:
            true,

          maxlength: [
            500,
            "La observación no puede superar los 500 caracteres",
          ],

          default:
            null,
        },

        /*
        |--------------------------------------------------------------------------
        | Auditoría
        |--------------------------------------------------------------------------
        */

        fechaCreado: {
          type:
            Date,

          default:
            Date.now,

          immutable:
            true,
        },

        usuarioCreador: {
          type:
            Schema.Types.ObjectId,

          ref:
            "PerfilUsuario",

          default:
            null,
        },

        fechaEdit: {
          type:
            Date,

          default:
            null,
        },

        usuarioEdit: {
          type:
            Schema.Types.ObjectId,

          ref:
            "PerfilUsuario",

          default:
            null,
        },

        fechaEliminado: {
          type:
            Date,

          default:
            null,
        },

        usuarioEliminador: {
          type:
            Schema.Types.ObjectId,

          ref:
            "PerfilUsuario",

          default:
            null,
        },
      },
      {
        versionKey:
          false,

        collection:
          "documentos_usuarios",
      },
    );

/*
|--------------------------------------------------------------------------
| Índice único
|--------------------------------------------------------------------------
|
| Un usuario solamente puede tener un documento activo de cada tipo.
|
| Puede tener:
| - Un CARNET_IDENTIDAD activo.
| - Un REGISTRO_UNIVERSITARIO activo.
|
| Si se elimina lógicamente, puede subir otro.
|
*/

DocumentoUsuarioSchema.index(
  {
    perfilUsuario:
      1,

    tipoDocumento:
      1,
  },
  {
    unique:
      true,

    partialFilterExpression: {
      fechaEliminado:
        null,
    },
  },
);

/*
|--------------------------------------------------------------------------
| Índices de consulta
|--------------------------------------------------------------------------
*/

DocumentoUsuarioSchema.index({
  perfilUsuario:
    1,

  fechaEliminado:
    1,
});

DocumentoUsuarioSchema.index({
  estado:
    1,

  fechaEliminado:
    1,
});

/*
|--------------------------------------------------------------------------
| Modelo
|--------------------------------------------------------------------------
*/

const DocumentoUsuario =
  (
    mongoose.models
      .DocumentoUsuario as
      mongoose.Model<DocumentoUsuarioType>
  ) ||
  mongoose.model<DocumentoUsuarioType>(
    "DocumentoUsuario",
    DocumentoUsuarioSchema,
  );

export default DocumentoUsuario;
