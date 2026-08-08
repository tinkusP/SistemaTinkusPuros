import mongoose, { Document, Schema } from "mongoose";
export interface AuditoriaType extends Document {
  usuarioId?: mongoose.Types.ObjectId; accion: string; modulo: string; entidad?: string; entidadId?: mongoose.Types.ObjectId;
  descripcion: string; datosAntes?: unknown; datosDespues?: unknown; metodo?: string; ruta?: string; ip?: string; userAgent?: string; fecha: Date;
}
const schema = new Schema<AuditoriaType>({
  usuarioId: { type: Schema.Types.ObjectId, ref: "PerfilUsuario" }, accion: { type: String, required: true, index: true },
  modulo: { type: String, required: true, index: true }, entidad: String, entidadId: Schema.Types.ObjectId,
  descripcion: { type: String, required: true }, datosAntes: Schema.Types.Mixed, datosDespues: Schema.Types.Mixed,
  metodo: String, ruta: String, ip: String, userAgent: String, fecha: { type: Date, default: Date.now, immutable: true, index: true },
}, { versionKey: false, collection: "auditoria" });
schema.index({ usuarioId: 1, fecha: -1 });
export default mongoose.model<AuditoriaType>("Auditoria", schema);
