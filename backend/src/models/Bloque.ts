import mongoose, { Schema } from "mongoose";
import { LIMITES_BLOQUE } from "../services/BloqueService";
const schema = new Schema({
  nombre: { type: String, required: true, trim: true, uppercase: true },
  guiaId: { type: Schema.Types.ObjectId, ref: "Guia", required: true, unique: true },
  guiasIds: [{ type: Schema.Types.ObjectId, ref: "Guia", required: true }],
  cantidadGuiasHombres: { type: Number, min: 0, default: 0 },
  cantidadGuiasMujeres: { type: Number, min: 0, default: 0 },
  cantidadHombres: { type: Number, min: 0, default: 0 },
  cantidadMujeres: { type: Number, min: 0, default: 0 },
  gestionId: { type: Schema.Types.ObjectId, ref: "Gestion", required: true },
  filasHombres: { type: Number, min: 1, max: 50, default: 20 },
  columnasHombres: { type: Number, min: 1, max: 10, default: 2 },
  filasMujeres: { type: Number, min: 1, max: 50, default: 20 },
  columnasMujeres: { type: Number, min: 1, max: 10, default: 4 },
  estado: { type: String, enum: ["ACTIVO", "CERRADO"], default: "ACTIVO" },
  usuarioCreador: { type: Schema.Types.ObjectId, ref: "PerfilUsuario" },
}, { versionKey: false, collection: "bloques" });
schema.index({ nombre: 1, gestionId: 1 }, { unique: true });
schema.index({ guiasIds: 1 }, { unique: true, sparse: true });
schema.pre("validate", function () {
  if (!this.guiasIds?.length && this.guiaId) this.guiasIds = [this.guiaId];
  if (this.guiaId && !this.guiasIds.some((id: mongoose.Types.ObjectId) => id.equals(this.guiaId))) this.guiasIds.unshift(this.guiaId);
  if (this.guiasIds.length > 4) this.invalidate("guiasIds", "Un bloque admite como máximo 4 guías");
});
export default mongoose.model("Bloque", schema);
