import mongoose, { Schema } from "mongoose";
const schema = new Schema({
  fraternoId: { type: Schema.Types.ObjectId, ref: "Fraterno", unique: true, sparse: true },
  usuarioId: { type: Schema.Types.ObjectId, ref: "PerfilUsuario", unique: true, sparse: true },
  tallaPolera: { type: String, trim: true, uppercase: true, required: true },
  tallaChamarra: { type: String, trim: true, uppercase: true, required: true },
  observacion: { type: String, trim: true, maxlength: 500 },
  edicionBloqueada: { type: Boolean, default: false },
  fechaBloqueo: Date,
  usuarioBloqueo: { type: Schema.Types.ObjectId, ref: "PerfilUsuario" },
  fechaActualizado: { type: Date, default: Date.now },
  usuarioEditor: { type: Schema.Types.ObjectId, ref: "PerfilUsuario" },
}, { versionKey: false, collection: "tallas_fraterno" });
schema.pre("validate", function validarReferencia(next) { if (!this.fraternoId && !this.usuarioId) return next(new Error("La talla debe pertenecer a un usuario o fraterno")); next(); });
export default mongoose.model("TallaFraterno", schema);
