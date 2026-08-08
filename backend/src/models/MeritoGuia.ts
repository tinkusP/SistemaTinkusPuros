import mongoose, { Document, Schema } from "mongoose";

export interface MeritoGuiaType extends Document {
  postulanteGuiaId: mongoose.Types.ObjectId;
  titulo: string;
  descripcion?: string;
  tipo: "INICIATIVA" | "ORGANIZACION" | "LIDERAZGO" | "PARTICIPACION" | "OTRO";
  puntos: number;
  fechaMerito?: Date;
  verificado: boolean;
  usuarioVerificador?: mongoose.Types.ObjectId;
  fechaCreado: Date;
  usuarioCreador?: mongoose.Types.ObjectId;
  fechaEliminado?: Date;
  usuarioEliminador?: mongoose.Types.ObjectId;
}
const schema = new Schema<MeritoGuiaType>({
  postulanteGuiaId: { type: Schema.Types.ObjectId, ref: "PostulanteGuia", required: true },
  titulo: { type: String, required: true, trim: true, maxlength: 200 },
  descripcion: { type: String, trim: true, maxlength: 1200 },
  tipo: { type: String, enum: ["INICIATIVA", "ORGANIZACION", "LIDERAZGO", "PARTICIPACION", "OTRO"], required: true },
  puntos: { type: Number, min: 0, max: 100, required: true },
  fechaMerito: Date,
  verificado: { type: Boolean, default: true },
  usuarioVerificador: { type: Schema.Types.ObjectId, ref: "PerfilUsuario" },
  fechaCreado: { type: Date, default: Date.now, immutable: true },
  usuarioCreador: { type: Schema.Types.ObjectId, ref: "PerfilUsuario" },
  fechaEliminado: Date,
  usuarioEliminador: { type: Schema.Types.ObjectId, ref: "PerfilUsuario" },
}, { versionKey: false, collection: "meritos_guia" });
schema.index({ postulanteGuiaId: 1, fechaEliminado: 1 });
export default mongoose.model<MeritoGuiaType>("MeritoGuia", schema);
