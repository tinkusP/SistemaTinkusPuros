import mongoose, { Schema } from "mongoose";
const schema = new Schema({
  fraternoId: { type: Schema.Types.ObjectId, ref: "Fraterno", required: true, unique: true },
  tallaPolera: { type: String, trim: true, uppercase: true, required: true },
  tallaChamarra: { type: String, trim: true, uppercase: true, required: true },
  observacion: { type: String, trim: true, maxlength: 500 },
  edicionBloqueada: { type: Boolean, default: false },
  fechaBloqueo: Date,
  usuarioBloqueo: { type: Schema.Types.ObjectId, ref: "PerfilUsuario" },
  fechaActualizado: { type: Date, default: Date.now },
  usuarioEditor: { type: Schema.Types.ObjectId, ref: "PerfilUsuario" },
}, { versionKey: false, collection: "tallas_fraterno" });
export default mongoose.model("TallaFraterno", schema);
