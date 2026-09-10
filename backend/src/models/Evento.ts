import mongoose, { Schema } from "mongoose";

export const TIPOS_EVENTO_INICIALES = ["ELECCION_CHACHA_WARMI", "FIESTA_PREENTRADA", "PREENTRADA", "ENTRADA_UNIVERSITARIA", "REUNION", "OTRO"] as const;

const schema = new Schema({
  nombre: { type: String, required: true, trim: true, maxlength: 180 },
  descripcion: { type: String, trim: true, maxlength: 1500 },
  tipo: { type: String, required: true, trim: true, uppercase: true, maxlength: 80 },
  fecha: { type: Date, required: true, index: true },
  horaInicio: { type: String, trim: true, maxlength: 5 },
  horaFin: { type: String, trim: true, maxlength: 5 },
  gestionId: { type: Schema.Types.ObjectId, ref: "Gestion", required: true, index: true },
  estado: { type: String, enum: ["PROGRAMADO", "ACTIVO", "CERRADO", "CANCELADO"], default: "PROGRAMADO", index: true },
  creadoPor: { type: Schema.Types.ObjectId, ref: "PerfilUsuario", required: true },
  fechaCreacion: { type: Date, default: Date.now },
  fechaCierre: Date,
  fechaEliminado: Date,
}, { versionKey: false, collection: "eventos" });

schema.index({ gestionId: 1, fecha: -1, estado: 1 });
export default mongoose.model("Evento", schema);
