import mongoose, { Schema, Document } from "mongoose";

export interface RolType extends Document {
  nombre: string;
  codigo: string;
  descripcion?: string;
  estado: boolean;
  permisos: string[];
  esRolSistema: boolean;
  fechaCreado?: Date;
  usuarioCreador?: mongoose.Types.ObjectId;
  fechaEdit?: Date;
  usuarioEdit?: mongoose.Types.ObjectId;
  fechaEliminado?: Date;
  usuarioEliminador?: mongoose.Types.ObjectId;
}

const RolSchema: Schema = new Schema(
  {
    nombre: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },

    codigo: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: 50,
    },

    descripcion: {
      type: String,
      trim: true,
      maxlength: 250,
    },

    estado: {
      type: Boolean,
      default: true,
    },

    permisos: {
      type: [String],
      default: [],
    },

    esRolSistema: {
      type: Boolean,
      default: false,
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
    collection: "roles",
  }
);

const Rol = mongoose.model<RolType>("Rol", RolSchema);

export default Rol;