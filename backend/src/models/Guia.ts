import mongoose, { Schema } from "mongoose";
const schema = new Schema({
  postulanteGuiaId: { type: Schema.Types.ObjectId, ref: "PostulanteGuia", required: true, unique: true },
  preregistroId: { type: Schema.Types.ObjectId, ref: "Preregistro", required: true, unique: true },
  usuarioId: { type: Schema.Types.ObjectId, ref: "PerfilUsuario", required: true },
  gestionId: { type: Schema.Types.ObjectId, ref: "Gestion", required: true },
  estado: { type: String, enum: ["ACTIVO", "INACTIVO", "RETIRADO"], default: "ACTIVO" },
  fechaDesignacion: { type: Date, default: Date.now },
  usuarioCreador: { type: Schema.Types.ObjectId, ref: "PerfilUsuario" },
}, { versionKey: false, collection: "guias" });
export default mongoose.model("Guia", schema);
