import mongoose, { Schema } from "mongoose";
const schema = new Schema({
  postulanteGuiaId: { type: Schema.Types.ObjectId, ref: "PostulanteGuia" },
  preregistroId: { type: Schema.Types.ObjectId, ref: "Preregistro", required: true, unique: true },
  usuarioId: { type: Schema.Types.ObjectId, ref: "PerfilUsuario", required: true },
  gestionId: { type: Schema.Types.ObjectId, ref: "Gestion", required: true },
  estado: { type: String, enum: ["ACTIVO", "INACTIVO", "RETIRADO"], default: "ACTIVO" },
  fechaDesignacion: { type: Date, default: Date.now },
  usuarioCreador: { type: Schema.Types.ObjectId, ref: "PerfilUsuario" },
}, { versionKey: false, collection: "guias" });
schema.index({ postulanteGuiaId: 1 }, { unique: true, sparse: true });
schema.index({ usuarioId: 1 }, { unique: true });
export default mongoose.model("Guia", schema);
