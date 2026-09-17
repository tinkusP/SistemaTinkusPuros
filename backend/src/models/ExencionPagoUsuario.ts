import mongoose, { Schema } from "mongoose";

export const CATEGORIAS_EXENCION_USUARIO = ["DIRECTIVA", "ADMINISTRACION", "GUIA", "INVITADO", "OTRO"] as const;

const schema = new Schema({
  usuarioId: { type: Schema.Types.ObjectId, ref: "PerfilUsuario", required: true },
  gestionId: { type: Schema.Types.ObjectId, ref: "Gestion", required: true },
  activa: { type: Boolean, default: true, index: true },
  categoria: { type: String, enum: CATEGORIAS_EXENCION_USUARIO, required: true },
  descripcion: { type: String, trim: true, maxlength: 1000 },
  fechaRegistro: { type: Date, default: Date.now },
  usuarioAdministrador: { type: Schema.Types.ObjectId, ref: "PerfilUsuario", required: true },
  fechaEditado: Date,
  usuarioEditor: { type: Schema.Types.ObjectId, ref: "PerfilUsuario" },
}, { versionKey: false, collection: "exenciones_pago_usuario" });

schema.index({ usuarioId: 1, gestionId: 1 }, { unique: true, name: "usuario_gestion_exencion_1" });

export default mongoose.model("ExencionPagoUsuario", schema);
