import type { Types } from "mongoose";
import ConfiguracionPago from "../models/ConfiguracionPago";
import Cuota from "../models/Cuota";
import DetalleCuota from "../models/DetalleCuota";
import PerfilUsuario from "../models/PerfilUsuario";
import Preregistro from "../models/Preregistro";

const ORIGENES_EXTERNOS = new Set(["EXTERNO", "EXTERNO_UMSA", "EXTERNO_NO_UMSA"]);
const redondear = (valor: number) => Number(valor.toFixed(2));

export type ResultadoSincronizacionCuota = {
  cuota: InstanceType<typeof Cuota>;
  creada: boolean;
  actualizada: boolean;
  tipoAnterior?: string;
  montoAnterior?: number;
};

export async function sincronizarCuotaPreregistro(
  preregistroId: string | Types.ObjectId,
  opciones: { crearSiFalta?: boolean; usuarioCreador?: unknown; fechaVencimiento?: Date; tarifaInterno?: number; tarifaExterno?: number } = {},
): Promise<ResultadoSincronizacionCuota | null> {
  const preregistro = await Preregistro.findOne({ _id: preregistroId, fechaEliminado: null, estado: "APROBADO", aprobado: true }).select("usuarioId gestionId");
  if (!preregistro) return null;
  const [usuario, configuracion] = await Promise.all([
    PerfilUsuario.findOne({ _id: preregistro.usuarioId, estado: "ACTIVO", fechaEliminado: null }).select("tipoOrigen"),
    ConfiguracionPago.findOne({ gestionId: preregistro.gestionId, activo: true }),
  ]);
  if (!usuario || !configuracion) return null;

  const tipoOrigenTarifa = ORIGENES_EXTERNOS.has(String(usuario.tipoOrigen)) ? "EXTERNO" : "INTERNO";
  const tarifaInterno = Number(opciones.tarifaInterno ?? configuracion.tarifaInterno);
  const tarifaExterno = Number(opciones.tarifaExterno ?? configuracion.tarifaExterno);
  const tarifaAplicada = redondear(tipoOrigenTarifa === "EXTERNO" ? tarifaExterno : tarifaInterno);
  if (!(tarifaAplicada > 0)) return null;

  let cuota = await Cuota.findOne({ preregistroId: preregistro._id, fechaEliminado: null });
  if (!cuota) {
    if (!opciones.crearSiFalta) return null;
    cuota = await Cuota.create({
      preregistroId: preregistro._id,
      tipoOrigenTarifa,
      tarifaAplicada,
      montoTotal: tarifaAplicada,
      primeraCuotaMonto: Math.min(configuracion.primeraCuota || 300, tarifaAplicada),
      montoPagado: 0,
      saldo: tarifaAplicada,
      fechaVencimiento: opciones.fechaVencimiento,
      observacion: "Cuota vinculada al preregistro aprobado según el origen académico vigente.",
      usuarioCreador: opciones.usuarioCreador,
    });
    return { cuota, creada: true, actualizada: false };
  }

  const tipoAnterior = cuota.tipoOrigenTarifa;
  const montoAnterior = cuota.montoTotal;
  const pagosVerificados = await DetalleCuota.aggregate([
    { $match: { cuotaId: cuota._id, fechaEliminado: null } },
    { $group: { _id: null, totalVerificado: { $sum: { $cond: [{ $eq: ["$estadoRevision", "VERIFICADO"] }, "$monto", 0] } }, cantidadDetalles: { $sum: 1 } } },
  ]);
  cuota.tipoOrigenTarifa = tipoOrigenTarifa;
  cuota.tarifaAplicada = tarifaAplicada;
  cuota.montoTotal = tarifaAplicada;
  cuota.primeraCuotaMonto = Math.min(configuracion.primeraCuota || 300, tarifaAplicada);
  // Los registros anteriores a DetalleCuota pueden tener un montoPagado
  // válido sin detalles asociados. En ese caso se conserva el saldo histórico.
  cuota.montoPagado = redondear(pagosVerificados[0]?.cantidadDetalles ? pagosVerificados[0].totalVerificado : cuota.montoPagado);
  cuota.fechaEditado = new Date();
  cuota.usuarioEditor = opciones.usuarioCreador as Types.ObjectId | undefined;
  const actualizada = tipoAnterior !== tipoOrigenTarifa || montoAnterior !== tarifaAplicada || cuota.isModified("montoPagado");
  await cuota.save();
  return { cuota, creada: false, actualizada, tipoAnterior, montoAnterior };
}

export async function sincronizarCuotasUsuario(usuarioId: string | Types.ObjectId, usuarioEditor?: unknown) {
  const preregistros = await Preregistro.find({ usuarioId, fechaEliminado: null, estado: "APROBADO", aprobado: true }).select("_id");
  const resultados = await Promise.all(preregistros.map((preregistro) => sincronizarCuotaPreregistro(preregistro._id, { crearSiFalta: true, usuarioCreador: usuarioEditor })));
  return resultados.filter((resultado): resultado is ResultadoSincronizacionCuota => Boolean(resultado));
}
