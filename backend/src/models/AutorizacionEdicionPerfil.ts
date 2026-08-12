import mongoose, { Schema } from "mongoose";
const schema = new Schema({
  perfilUsuarioId: { type: Schema.Types.ObjectId, ref: "PerfilUsuario", required: true },
  administradorId: { type: Schema.Types.ObjectId, ref: "PerfilUsuario", required: true },
  campos: [{ type: String, enum: ["DATOS_PERSONALES", "ORIGEN_ACADEMICO", "FOTO_PERFIL", "CARNET_ANVERSO", "CARNET_REVERSO", "REGISTRO_UNIVERSITARIO"] }],
  motivo: { type: String, required: true, trim: true, maxlength: 500 },
  estado: { type: String, enum: ["ACTIVA", "USADA", "REVOCADA", "VENCIDA"], default: "ACTIVA" },
  fechaCreado: { type: Date, default: Date.now },
  fechaVencimiento: { type: Date, required: true },
  fechaUso: Date,
}, { versionKey: false, collection: "autorizaciones_edicion_perfil" });
schema.index({ perfilUsuarioId: 1, estado: 1, fechaVencimiento: 1 });
export default mongoose.model("AutorizacionEdicionPerfil", schema);
