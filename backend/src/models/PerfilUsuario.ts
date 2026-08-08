import mongoose, { Schema, Document } from "mongoose";

export interface PerfilUsuarioType extends Document {

  roles: mongoose.Types.ObjectId[];
  gestion: mongoose.Types.ObjectId[];

  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno?: string;

  ci: string;
  complementoCi?: string;
  expedidoCi?: string;

  fechaNacimiento?: Date;
  sexo?: string;

  telefono: string;
  email: string;
  fotoPerfil?: string;

  tipoOrigen: "INTERNO" | "EXTERNO" | "INTERNO_UMSA" | "EXTERNO_UMSA" | "EXTERNO_NO_UMSA";
  tipoFraterno: "NUEVO" | "ANTIGUO";

  registroUniversitario?: string;
  facultad?: string;
  carrera?: string;

  password: string;

  estado:
    | "PENDIENTE"
    | "ACTIVO"
    | "BLOQUEADO"
    | "INACTIVO"
    | "ELIMINADO";

  emailVerificado: boolean;
  intentosFallidos: number;
  bloqueadoHasta?: Date;
  ultimoLogin?: Date;
  ultimoCambioPassword?: Date;
  requiereCambioPassword: boolean;
  credencialQrVersion: number;

  fechaCreado?: Date;
  usuarioCreador?: mongoose.Types.ObjectId;

  fechaEdit?: Date;
  usuarioEdit?: mongoose.Types.ObjectId;

  fechaEliminado?: Date;
  usuarioEliminador?: mongoose.Types.ObjectId;
}

const PerfilUsuarioSchema: Schema = new Schema(
  {

    roles: [
      {
        type: Schema.Types.ObjectId,
        ref: "Rol",
        required: true,
      },
    ],
     gestion: [
      {
        type: Schema.Types.ObjectId,
        ref: "Gestion",
        required: true,
      },
    ],

    nombres: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    apellidoPaterno: {
      type: String,
      default: "",
      trim: true,
      maxlength: 100,
    },

    apellidoMaterno: {
      type: String,
      trim: true,
      maxlength: 100,
    },

    ci: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 20,
    },

    complementoCi: {
      type: String,
      trim: true,
      maxlength: 10,
    },

    expedidoCi: {
      type: String,
      trim: true,
      maxlength: 10,
    },

    fechaNacimiento: {
      type: Date,
    },

    sexo: {
      type: String,
      enum: ["HOMBRE", "MUJER"],
      trim: true,
      maxlength: 20,
    },

    telefono: {
      type: String,
      required: true,
      trim: true,
      maxlength: 20,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 100,
    },

    fotoPerfil: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    tipoOrigen: {
      type: String,
      enum: [
        "INTERNO",
        "EXTERNO",
        "INTERNO_UMSA",
        "EXTERNO_UMSA",
        "EXTERNO_NO_UMSA",
      ],
      required: true,
    },

    tipoFraterno: {
      type: String,
      enum: [
        "NUEVO",
        "ANTIGUO",
      ],
      required: true,
    },

    registroUniversitario: {
      type: String,
      trim: true,
      maxlength: 30,
    },

    facultad: {
      type: String,
      trim: true,
      maxlength: 150,
    },

    carrera: {
      type: String,
      trim: true,
      maxlength: 150,
    },

    password: {
      type: String,
      required: true,
      select: false,
    },

    estado: {
      type: String,
      enum: [
        "PENDIENTE",
        "ACTIVO",
        "BLOQUEADO",
        "INACTIVO",
        "ELIMINADO",
      ],
      default: "PENDIENTE",
    },

    emailVerificado: {
      type: Boolean,
      default: false,
    },

    intentosFallidos: {
      type: Number,
      default: 0,
    },

    bloqueadoHasta: {
      type: Date,
      default: null,
    },

    ultimoLogin: {
      type: Date,
      default: null,
    },

    ultimoCambioPassword: {
      type: Date,
      default: null,
    },

    requiereCambioPassword: {
      type: Boolean,
      default: false,
    },

    credencialQrVersion: {
      type: Number,
      default: 0,
      min: 0,
    },

    fechaCreado: {
      type: Date,
      default: Date.now,
    },

    usuarioCreador: {
      type: Schema.Types.ObjectId,
      ref: "PerfilUsuario",
      default: null,
    },

    fechaEdit: {
      type: Date,
      default: null,
    },

    usuarioEdit: {
      type: Schema.Types.ObjectId,
      ref: "PerfilUsuario",
      default: null,
    },

    fechaEliminado: {
      type: Date,
      default: null,
    },

    usuarioEliminador: {
      type: Schema.Types.ObjectId,
      ref: "PerfilUsuario",
      default: null,
    },

  },
  {
    versionKey: false,
    collection: "perfil_usuarios",
  }
);

/*
 * Compatibilidad con perfiles creados antes de usar HOMBRE/MUJER.
 * Al guardar nuevamente el documento (por ejemplo durante el login),
 * el valor antiguo queda migrado de forma permanente.
 */
PerfilUsuarioSchema.pre("validate", function () {
  const sexoNormalizado = String(this.sexo ?? "").trim().toUpperCase();

  if (["MASCULINO", "HOMBRE", "M"].includes(sexoNormalizado)) {
    this.sexo = "HOMBRE";
  } else if (["FEMENINO", "MUJER", "F"].includes(sexoNormalizado)) {
    this.sexo = "MUJER";
  }
});

const PerfilUsuario = mongoose.model<PerfilUsuarioType>(
  "PerfilUsuario",
  PerfilUsuarioSchema
);

export default PerfilUsuario;
