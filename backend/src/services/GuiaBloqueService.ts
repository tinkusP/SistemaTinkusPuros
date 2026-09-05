import mongoose from "mongoose";
import Bloque from "../models/Bloque";
import Guia from "../models/Guia";
import { normalizarGeneroBloque } from "./BloqueService";

type Session = mongoose.ClientSession;

function idsGuiasDelBloque(bloque: any): mongoose.Types.ObjectId[] {
  const ids = [bloque.guiaId, ...(bloque.guiasIds ?? [])].filter(Boolean);
  return [...new Map(ids.map((id: any) => [String(id._id ?? id), id._id ?? id])).values()];
}

async function estadoGuias(ids: mongoose.Types.ObjectId[], session?: Session) {
  const guias: any[] = await Guia.find({ _id: { $in: ids }, estado: "ACTIVO" })
    .populate("usuarioId", "sexo")
    .session(session ?? null);
  const activos = new Set(guias.map((guia) => String(guia._id)));
  const guiasIds = ids.filter((id) => activos.has(String(id)));
  return {
    guiasIds,
    guiaId: guiasIds[0] ?? null,
    cantidadGuiasHombres: guias.filter((guia) => normalizarGeneroBloque(guia.usuarioId?.sexo) === "HOMBRE").length,
    cantidadGuiasMujeres: guias.filter((guia) => normalizarGeneroBloque(guia.usuarioId?.sexo) === "MUJER").length,
  };
}

/** Limpia tanto guiaId (legado) como guiasIds y reconstruye contadores reales. */
export async function retirarGuiaDeBloques(
  guiaId: mongoose.Types.ObjectId,
  session?: Session,
  exceptoBloqueId?: mongoose.Types.ObjectId,
) {
  const filtro: Record<string, unknown> = { $or: [{ guiaId }, { guiasIds: guiaId }] };
  if (exceptoBloqueId) filtro._id = { $ne: exceptoBloqueId };
  const bloques: any[] = await Bloque.find(filtro).session(session ?? null);
  for (const bloque of bloques) {
    const restantes = idsGuiasDelBloque(bloque).filter((id) => String(id) !== String(guiaId));
    const estado = await estadoGuias(restantes, session);
    const actualizacion: any = {
      $set: {
        guiasIds: estado.guiasIds,
        cantidadGuiasHombres: estado.cantidadGuiasHombres,
        cantidadGuiasMujeres: estado.cantidadGuiasMujeres,
      },
    };
    if (estado.guiaId) actualizacion.$set.guiaId = estado.guiaId;
    else actualizacion.$unset = { guiaId: "" };
    await Bloque.updateOne({ _id: bloque._id }, actualizacion, { session });
  }
  return bloques;
}

export async function sincronizarContadoresGuias(bloque: any, session?: Session) {
  const estado = await estadoGuias(idsGuiasDelBloque(bloque), session);
  const actualizacion: any = {
    $set: {
      guiasIds: estado.guiasIds,
      cantidadGuiasHombres: estado.cantidadGuiasHombres,
      cantidadGuiasMujeres: estado.cantidadGuiasMujeres,
    },
  };
  if (estado.guiaId) actualizacion.$set.guiaId = estado.guiaId;
  else actualizacion.$unset = { guiaId: "" };
  return Bloque.findByIdAndUpdate(bloque._id, actualizacion, { new: true, session });
}

export { idsGuiasDelBloque };
