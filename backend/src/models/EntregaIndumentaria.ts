import mongoose, { Schema } from "mongoose";
export const ESTADOS_ENTREGA = ["ENTREGADO", "DEVUELTO", "PERDIDO", "DANADO"] as const;
const schema = new Schema({
  fraternoId: { type: Schema.Types.ObjectId, ref: "Fraterno", required: true },
  prendaId: { type: Schema.Types.ObjectId, ref: "PrendaIndumentaria", required: true },
  cantidad: { type: Number, min: 1, default: 1 },
  evento: { type: String, enum: ["ENTRADA_UNIVERSITARIA"], default: "ENTRADA_UNIVERSITARIA", immutable: true },
  talla: { type: String, trim: true, uppercase: true },
  estadoEntrega: { type: String, enum: ["NUEVO", "BUENO", "REGULAR"], default: "BUENO" },
  estado: { type: String, enum: ESTADOS_ENTREGA, default: "ENTREGADO" },
  fechaEntrega: { type: Date, default: Date.now },
  fechaDevolucion: Date,
  responsableEntrega: { type: Schema.Types.ObjectId, ref: "PerfilUsuario", required: true },
  responsableRecepcion: { type: Schema.Types.ObjectId, ref: "PerfilUsuario" },
  observacion: { type: String, trim: true, maxlength: 700 },
}, { versionKey: false, collection: "entregas_indumentaria" });
schema.index({ fraternoId: 1, prendaId: 1 }, { unique: true, partialFilterExpression: { estado: "ENTREGADO" } });
export default mongoose.model("EntregaIndumentaria", schema);
