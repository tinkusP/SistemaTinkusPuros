import Fraterno from "../models/Fraterno";
import Gestion from "../models/Gestion";
import Secuencia from "../models/Secuencia";

export const numeroDelCodigo = (codigo: unknown, anio: number) => {
  const coincidencia = String(codigo ?? "").match(new RegExp(`^FRA-${anio}-(\\d+)$`, "i"));
  return coincidencia ? Number(coincidencia[1]) : 0;
};

export async function siguienteCodigoFraterno(gestionId: unknown) {
  const gestion = await Gestion.findById(gestionId).select("anio").lean();
  if (!gestion) throw new Error("No existe la gestión asociada al registro");
  const anio = Number(gestion.anio);
  const existentes = await Fraterno.find({ numeroFraterno: new RegExp(`^FRA-${anio}-\\d+$`, "i") }).select("numeroFraterno").lean();
  const maximoExistente = existentes.reduce((maximo, item) => Math.max(maximo, numeroDelCodigo(item.numeroFraterno, anio)), 0);
  const clave = `FRATERNO:${anio}`;
  await Secuencia.findOneAndUpdate({ _id: clave }, { $max: { valor: maximoExistente }, $set: { fechaActualizado: new Date() } }, { upsert: true });
  const secuencia = await Secuencia.findOneAndUpdate({ _id: clave }, { $inc: { valor: 1 }, $set: { fechaActualizado: new Date() } }, { new: true });
  if (!secuencia) throw new Error("No se pudo reservar la secuencia del código de fraterno");
  const codigo = `FRA-${anio}-${String(secuencia.valor).padStart(4, "0")}`;
  console.info(JSON.stringify({ accion: "GENERATE_FRATERNO_CODE", gestionId: String(gestionId), codigo, resultado: "OK" }));
  return codigo;
}

export async function obtenerOCrearFraterno(datos: { preregistroId: unknown; usuarioId: unknown; gestionId: unknown; usuarioCreador?: unknown }) {
  const filtroIdentidad = { $or: [{ preregistroId: datos.preregistroId }, { usuarioId: datos.usuarioId, gestionId: datos.gestionId }] };
  let fraterno: any = await Fraterno.findOne(filtroIdentidad);
  if (fraterno) {
    if (fraterno.fechaEliminado || fraterno.estado !== "ACTIVO") {
      fraterno.fechaEliminado = undefined;
      fraterno.usuarioEliminador = undefined;
      fraterno.estado = "ACTIVO";
      fraterno.fechaEditado = new Date();
      await fraterno.save();
    }
    return fraterno;
  }
  for (let intento = 0; intento < 3; intento += 1) {
    const numeroFraterno = await siguienteCodigoFraterno(datos.gestionId);
    try {
      return await Fraterno.create({ ...datos, numeroFraterno });
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
      fraterno = await Fraterno.findOne(filtroIdentidad);
      if (fraterno) return fraterno;
    }
  }
  throw Object.assign(new Error("No se pudo reservar un código de fraterno. Actualiza e inténtalo nuevamente."), { statusCode: 409 });
}
