import mongoose, { Schema } from "mongoose";
const schema = new Schema({
  nombre: { type: String, required: true, unique: true, trim: true, uppercase: true },
  requiereTalla: { type: Boolean, default: false },
  activo: { type: Boolean, default: true },
  fechaCreado: { type: Date, default: Date.now },
  usuarioCreador: { type: Schema.Types.ObjectId, ref: "PerfilUsuario" },
}, { versionKey: false, collection: "prendas_indumentaria" });
export default mongoose.model("PrendaIndumentaria", schema);
