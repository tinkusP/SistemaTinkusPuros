import mongoose, { Schema } from "mongoose";

export const ACCIONES_AJUSTE_FINANCIERO = ["EXCLUIR_CALCULO", "RESTAURAR_CALCULO", "MARCAR_EXENTO", "MARCAR_DESCUENTO"] as const;
export const TIPOS_EXENCION_FINANCIERA = ["DIRECTIVA", "ADMINISTRADOR", "GUIA", "INVITADO", "OTRO"] as const;

const schema = new Schema({
  gestionId: { type: Schema.Types.ObjectId, ref: "Gestion", required: true, index: true },
  usuarioId: { type: Schema.Types.ObjectId, ref: "PerfilUsuario", required: true, index: true },
  cuotaId: { type: Schema.Types.ObjectId, ref: "Cuota", required: true, index: true },
  accion: { type: String, enum: ACCIONES_AJUSTE_FINANCIERO, required: true, index: true },
  motivo: { type: String, required: true, trim: true, maxlength: 1000 },
  tipoExencion: { type: String, enum: TIPOS_EXENCION_FINANCIERA },
  porcentajeDescuento: { type: Number, min: 0, max: 100 },
  montoEsperadoOriginal: { type: Number, required: true, min: 0 },
  montoEsperadoFinal: { type: Number, required: true, min: 0 },
  usuarioAdministrador: { type: Schema.Types.ObjectId, ref: "PerfilUsuario", required: true },
  fecha: { type: Date, default: Date.now, immutable: true, index: true },
}, { versionKey: false, collection: "ajustes_financieros" });

schema.index({ gestionId: 1, usuarioId: 1, fecha: -1 }, { name: "ajuste_financiero_usuario_fecha" });

export default mongoose.model("AjusteFinanciero", schema);
