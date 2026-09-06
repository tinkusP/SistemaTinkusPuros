import mongoose, { Schema } from "mongoose";

const schema = new Schema({
  _id: { type: String, required: true },
  valor: { type: Number, required: true, min: 0, default: 0 },
  fechaActualizado: { type: Date, default: Date.now },
}, { versionKey: false, collection: "secuencias" });

export default mongoose.model("Secuencia", schema);
