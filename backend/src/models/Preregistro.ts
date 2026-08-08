import mongoose, { Document, Schema } from "mongoose";

export const ESTADOS_PREREGISTRO = [
  "PENDIENTE",
  "OBSERVADO",
  "APROBADO",
  "RECHAZADO",
  "LISTA_ESPERA",
  "CANCELADO",
] as const;

export type EstadoPreregistro =
  (typeof ESTADOS_PREREGISTRO)[number];

export interface PreregistroType extends Document {
  usuarioId: mongoose.Types.ObjectId;
  gestionId: mongoose.Types.ObjectId;
  numeroPreRegistro: string;
  fechaRegistro: Date;
  estado: EstadoPreregistro;
  aceptoReglamento: boolean;
  examen1?: number;
  examen2?: number;
  examen3?: number;
  examen4?: number;
  examen5?: number;
  examen6?: number;
  promedioExamen?: number;
  puntajeTotal?: number;
  observacion?: string;
  aprobado: boolean;
  fechaAprobacion?: Date;
  usuarioAprobador?: mongoose.Types.ObjectId;
  fechaRevision?: Date;
  usuarioRevisor?: mongoose.Types.ObjectId;
  fechaCreado: Date;
  usuarioCreador?: mongoose.Types.ObjectId;
  fechaEditado?: Date;
  usuarioEditor?: mongoose.Types.ObjectId;
  fechaEliminado?: Date;
  usuarioEliminador?: mongoose.Types.ObjectId;
}

const PreregistroSchema = new Schema<PreregistroType>(
  {
    usuarioId: { type: Schema.Types.ObjectId, ref: "PerfilUsuario", required: true },
    gestionId: { type: Schema.Types.ObjectId, ref: "Gestion", required: true },
    numeroPreRegistro: { type: String, required: true, trim: true, unique: true },
    fechaRegistro: { type: Date, default: Date.now },
    estado: { type: String, enum: ESTADOS_PREREGISTRO, default: "PENDIENTE" },
    aceptoReglamento: { type: Boolean, default: false },
    examen1: { type: Number, min: 0, max: 100 },
    examen2: { type: Number, min: 0, max: 100 },
    examen3: { type: Number, min: 0, max: 100 },
    examen4: { type: Number, min: 0, max: 100 },
    examen5: { type: Number, min: 0, max: 100 },
    examen6: { type: Number, min: 0, max: 100 },
    promedioExamen: { type: Number, min: 0, max: 100 },
    puntajeTotal: { type: Number, min: 0 },
    observacion: { type: String, trim: true, maxlength: 1000 },
    aprobado: { type: Boolean, default: false },
    fechaAprobacion: Date,
    usuarioAprobador: { type: Schema.Types.ObjectId, ref: "PerfilUsuario" },
    fechaRevision: Date,
    usuarioRevisor: { type: Schema.Types.ObjectId, ref: "PerfilUsuario" },
    fechaCreado: { type: Date, default: Date.now, immutable: true },
    usuarioCreador: { type: Schema.Types.ObjectId, ref: "PerfilUsuario" },
    fechaEditado: Date,
    usuarioEditor: { type: Schema.Types.ObjectId, ref: "PerfilUsuario" },
    fechaEliminado: Date,
    usuarioEliminador: { type: Schema.Types.ObjectId, ref: "PerfilUsuario" },
  },
  { versionKey: false, collection: "preregistros", timestamps: false },
);

PreregistroSchema.index(
  { usuarioId: 1, gestionId: 1 },
  { unique: true },
);
PreregistroSchema.index({ gestionId: 1, estado: 1 });

PreregistroSchema.pre("validate", function () {
  const notas = [this.examen1, this.examen2, this.examen3, this.examen4, this.examen5, this.examen6]
    .filter((nota): nota is number => typeof nota === "number");
  this.promedioExamen = notas.length
    ? Number((notas.reduce((total, nota) => total + nota, 0) / notas.length).toFixed(2))
    : undefined;
  this.aprobado = this.estado === "APROBADO";
});

export default mongoose.model<PreregistroType>("Preregistro", PreregistroSchema);
