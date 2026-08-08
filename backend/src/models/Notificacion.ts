import mongoose, { Document, Schema } from "mongoose";
export interface NotificacionType extends Document { usuarioId: mongoose.Types.ObjectId; anuncioId?: mongoose.Types.ObjectId; titulo: string; mensaje: string; tipo: "INFO" | "EXITO" | "ADVERTENCIA" | "ERROR"; enlace?: string; leida: boolean; fechaLeida?: Date; fechaCreado: Date; }
const schema = new Schema<NotificacionType>({ usuarioId: { type: Schema.Types.ObjectId, ref: "PerfilUsuario", required: true, index: true }, anuncioId: { type: Schema.Types.ObjectId, ref: "Anuncio" }, titulo: { type: String, required: true, trim: true }, mensaje: { type: String, required: true, trim: true }, tipo: { type: String, enum: ["INFO", "EXITO", "ADVERTENCIA", "ERROR"], default: "INFO" }, enlace: String, leida: { type: Boolean, default: false }, fechaLeida: Date, fechaCreado: { type: Date, default: Date.now } }, { versionKey: false, collection: "notificaciones" });
schema.index({ usuarioId: 1, leida: 1, fechaCreado: -1 });
schema.index({ usuarioId: 1, anuncioId: 1 }, { unique: true, sparse: true });
export default mongoose.model<NotificacionType>("Notificacion", schema);
