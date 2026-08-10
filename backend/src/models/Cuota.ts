import mongoose, { Document, Schema } from "mongoose";
export type EstadoCuota = "PENDIENTE" | "PAGO_PARCIAL" | "PAGADA" | "VENCIDA" | "CANCELADA";
export interface CuotaType extends Document {
  preregistroId: mongoose.Types.ObjectId;
  tipoOrigenTarifa?: "INTERNO" | "EXTERNO";
  tarifaAplicada?: number;
  montoTotal: number;
  primeraCuotaMonto?: number;
  numeroCuotasElegidas?: 1 | 2 | 3;
  montoPagado: number;
  saldo: number;
  estado: EstadoCuota;
  fechaVencimiento?: Date;
  fechaInicioPlazo?: Date;
  cupoLiberado: boolean;
  fechaLiberacionCupo?: Date;
  fechaProrroga?: Date;
  fechaSolicitudProrroga?: Date;
  horasProrrogaAcumuladas: number;
  motivoProrroga?: string;
  usuarioProrroga?: mongoose.Types.ObjectId;
  observacion?: string;
  fechaCreado: Date;
  usuarioCreador?: mongoose.Types.ObjectId;
  fechaEditado?: Date;
  usuarioEditor?: mongoose.Types.ObjectId;
  fechaEliminado?: Date;
  usuarioEliminador?: mongoose.Types.ObjectId;
}
const schema = new Schema<CuotaType>({
  preregistroId: { type: Schema.Types.ObjectId, ref: "Preregistro", required: true, unique: true },
  tipoOrigenTarifa: { type: String, enum: ["INTERNO", "EXTERNO"] },
  tarifaAplicada: { type: Number, min: 0.01 },
  montoTotal: { type: Number, required: true, min: 0.01 },
  primeraCuotaMonto: { type: Number, min: 0.01 },
  numeroCuotasElegidas: { type: Number, enum: [1, 2, 3] },
  montoPagado: { type: Number, min: 0, default: 0 },
  saldo: { type: Number, min: 0, required: true },
  estado: { type: String, enum: ["PENDIENTE", "PAGO_PARCIAL", "PAGADA", "VENCIDA", "CANCELADA"], default: "PENDIENTE" },
  fechaVencimiento: Date,
  fechaInicioPlazo: Date,
  cupoLiberado: { type: Boolean, default: false },
  fechaLiberacionCupo: Date,
  fechaProrroga: Date,
  fechaSolicitudProrroga: Date,
  horasProrrogaAcumuladas: { type: Number, min: 0, default: 0 },
  motivoProrroga: { type: String, trim: true, maxlength: 500 },
  usuarioProrroga: { type: Schema.Types.ObjectId, ref: "PerfilUsuario" },
  observacion: { type: String, trim: true, maxlength: 1000 },
  fechaCreado: { type: Date, default: Date.now },
  usuarioCreador: { type: Schema.Types.ObjectId, ref: "PerfilUsuario" },
  fechaEditado: Date,
  usuarioEditor: { type: Schema.Types.ObjectId, ref: "PerfilUsuario" },
  fechaEliminado: Date,
  usuarioEliminador: { type: Schema.Types.ObjectId, ref: "PerfilUsuario" },
}, { versionKey: false, collection: "cuotas" });
schema.pre("validate", function () { this.montoTotal = Number(this.montoTotal.toFixed(2)); this.montoPagado = Number(this.montoPagado.toFixed(2)); this.saldo = Number(Math.max(0, this.montoTotal - this.montoPagado).toFixed(2)); if (this.estado !== "CANCELADA") this.estado = this.saldo <= 0 ? "PAGADA" : this.montoPagado > 0 ? "PAGO_PARCIAL" : this.fechaVencimiento && this.fechaVencimiento < new Date() ? "VENCIDA" : "PENDIENTE"; });
export default mongoose.model<CuotaType>("Cuota", schema);
