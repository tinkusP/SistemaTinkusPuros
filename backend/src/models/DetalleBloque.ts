import mongoose, { Schema } from "mongoose";
const schema = new Schema({
  bloqueId: { type: Schema.Types.ObjectId, ref: "Bloque", required: true },
  fraternoId: { type: Schema.Types.ObjectId, ref: "Fraterno", required: true },
  genero: { type: String, enum: ["HOMBRE", "MUJER"], required: true },
}, { versionKey: false, collection: "detalle_bloques" });
schema.index({ fraternoId: 1 }, { unique: true });
schema.index({ bloqueId: 1, genero: 1 });
export default mongoose.model("DetalleBloque", schema);
