import mongoose, { Schema } from "mongoose";

const schema = new Schema({
  eventoId: { type: Schema.Types.ObjectId, ref: "Evento", required: true },
  usuarioId: { type: Schema.Types.ObjectId, ref: "PerfilUsuario", required: true },
  fraternoId: { type: Schema.Types.ObjectId, ref: "Fraterno" },
  estado: { type: String, enum: ["PRESENTE", "ANULADA"], default: "PRESENTE" },
  horaIngreso: { type: Date, default: Date.now },
  horaSalida: Date,
  metodoRegistro: { type: String, enum: ["QR", "CI", "NOMBRE", "MANUAL"], required: true },
  metodoSalida: { type: String, enum: ["QR", "CI", "NOMBRE", "MANUAL"] },
  registradoPor: { type: Schema.Types.ObjectId, ref: "PerfilUsuario", required: true },
  registradoSalidaPor: { type: Schema.Types.ObjectId, ref: "PerfilUsuario" },
  observacion: { type: String, trim: true, maxlength: 700 },
  fechaAnulacion: Date,
  anuladoPor: { type: Schema.Types.ObjectId, ref: "PerfilUsuario" },
}, { versionKey: false, collection: "asistencias_eventos" });

schema.index({ eventoId: 1, usuarioId: 1 }, { unique: true, partialFilterExpression: { estado: "PRESENTE" } });
schema.index({ eventoId: 1, horaIngreso: 1 });
export default mongoose.model("AsistenciaEvento", schema);
