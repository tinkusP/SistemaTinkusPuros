import mongoose, { Document, Schema } from "mongoose";

export const ESTADOS_POSTULANTE_GUIA = ["HABILITADO", "EN_EVALUACION", "ELEGIDO", "NO_ELEGIDO", "RETIRADO"] as const;
export type EstadoPostulanteGuia = (typeof ESTADOS_POSTULANTE_GUIA)[number];

export interface PostulanteGuiaType extends Document {
  preregistroId: mongoose.Types.ObjectId;
  habilitado: boolean;
  fechaHabilitacion: Date;
  usuarioHabilitador: mongoose.Types.ObjectId;
  estado: EstadoPostulanteGuia;
  iniciativaDescripcion?: string;
  puntajeIniciativa: number;
  organizaBloque: boolean;
  bloqueOrganizado?: string;
  organizacionDescripcion?: string;
  puntajeOrganizacion: number;
  puntajeMeritos: number;
  puntajeEleccion: number;
  puntajeTotal: number;
  observacion?: string;
  fechaEleccion?: Date;
  usuarioEvaluador?: mongoose.Types.ObjectId;
  fechaCreado: Date;
  usuarioCreador?: mongoose.Types.ObjectId;
  fechaEditado?: Date;
  usuarioEditor?: mongoose.Types.ObjectId;
  fechaEliminado?: Date;
  usuarioEliminador?: mongoose.Types.ObjectId;
}

const schema = new Schema<PostulanteGuiaType>({
  preregistroId: { type: Schema.Types.ObjectId, ref: "Preregistro", required: true, unique: true },
  habilitado: { type: Boolean, default: true },
  fechaHabilitacion: { type: Date, default: Date.now },
  usuarioHabilitador: { type: Schema.Types.ObjectId, ref: "PerfilUsuario", required: true },
  estado: { type: String, enum: ESTADOS_POSTULANTE_GUIA, default: "HABILITADO" },
  iniciativaDescripcion: { type: String, trim: true, maxlength: 1500 },
  puntajeIniciativa: { type: Number, min: 0, max: 100, default: 0 },
  organizaBloque: { type: Boolean, default: false },
  bloqueOrganizado: { type: String, trim: true, maxlength: 150 },
  organizacionDescripcion: { type: String, trim: true, maxlength: 1500 },
  puntajeOrganizacion: { type: Number, min: 0, max: 100, default: 0 },
  puntajeMeritos: { type: Number, min: 0, default: 0 },
  puntajeEleccion: { type: Number, min: 0, max: 100, default: 0 },
  puntajeTotal: { type: Number, min: 0, default: 0 },
  observacion: { type: String, trim: true, maxlength: 1500 },
  fechaEleccion: Date,
  usuarioEvaluador: { type: Schema.Types.ObjectId, ref: "PerfilUsuario" },
  fechaCreado: { type: Date, default: Date.now, immutable: true },
  usuarioCreador: { type: Schema.Types.ObjectId, ref: "PerfilUsuario" },
  fechaEditado: Date,
  usuarioEditor: { type: Schema.Types.ObjectId, ref: "PerfilUsuario" },
  fechaEliminado: Date,
  usuarioEliminador: { type: Schema.Types.ObjectId, ref: "PerfilUsuario" },
}, { versionKey: false, collection: "postulantes_guia" });

schema.pre("validate", function () {
  this.puntajeTotal = Number((this.puntajeIniciativa + this.puntajeOrganizacion + this.puntajeMeritos + this.puntajeEleccion).toFixed(2));
  if (!this.organizaBloque) { this.bloqueOrganizado = undefined; this.puntajeOrganizacion = 0; }
});
schema.index({ estado: 1, puntajeTotal: -1 });
export default mongoose.model<PostulanteGuiaType>("PostulanteGuia", schema);
