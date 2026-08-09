import mongoose, { Document, Schema } from "mongoose";

export interface ConfiguracionPagoType extends Document {
  gestionId: mongoose.Types.ObjectId;
  requerirTokenRegistro: boolean;
  qrPagoTotal?: string;
  qrPrimeraCuota?: string;
  qrSegundaCuota?: string;
  qrPlanes?: {
    INTERNO?: Partial<Record<"1" | "2" | "3", string[]>>;
    EXTERNO?: Partial<Record<"1" | "2" | "3", string[]>>;
  };
  tarifaInterno: number;
  tarifaExterno: number;
  primeraCuota: number;
  vigenciaTokenHoras: number;
  plazoPrimeraCuotaHoras: number;
  cantidadBloques: number;
  terminos: string;
  versionTerminos: number;
  activo: boolean;
  fechaEditado: Date;
  usuarioEditor: mongoose.Types.ObjectId;
}

const schema = new Schema<ConfiguracionPagoType>({
  gestionId: { type: Schema.Types.ObjectId, ref: "Gestion", required: true, unique: true },
  requerirTokenRegistro: { type: Boolean, default: true },
  qrPagoTotal: String,
  qrPrimeraCuota: String,
  qrSegundaCuota: String,
  qrPlanes: { type: Schema.Types.Mixed, default: {} },
  tarifaInterno: { type: Number, min: .01, default: 770 },
  tarifaExterno: { type: Number, min: .01, default: 850 },
  primeraCuota: { type: Number, min: .01, default: 300 },
  vigenciaTokenHoras: { type: Number, min: 1, max: 8760, default: 24 },
  plazoPrimeraCuotaHoras: { type: Number, min: 1, max: 8760, default: 72 },
  cantidadBloques: { type: Number, min: 1, max: 100, default: 1 },
  terminos: { type: String, required: true, trim: true, maxlength: 5000 },
  versionTerminos: { type: Number, min: 1, default: 1 },
  activo: { type: Boolean, default: true },
  fechaEditado: { type: Date, default: Date.now },
  usuarioEditor: { type: Schema.Types.ObjectId, ref: "PerfilUsuario", required: true },
}, { versionKey: false, collection: "configuraciones_pago" });

export default mongoose.model<ConfiguracionPagoType>("ConfiguracionPago", schema);
