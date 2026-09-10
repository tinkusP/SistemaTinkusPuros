import Bloque from "../models/Bloque";
import Cuota from "../models/Cuota";
import DetalleBloque from "../models/DetalleBloque";
import DetalleCuota from "../models/DetalleCuota";
import Fraterno from "../models/Fraterno";
import Gestion from "../models/Gestion";
import { FILTRO_ASIGNACION_ACTIVA } from "./AsignacionBloqueService";

export async function reportePagosCronologico() {
  const gestion = await Gestion.findOne({ estado: { $in: ["ACTIVA", "INSCRIPCIONES"] }, fechaEliminado: null }).sort({ anio: -1 }).lean();
  if (!gestion) return { gestion: null, personas: [], rankings: { primera: [], segunda: [], tercera: [], completos: [] } };
  const fraternos: any[] = await Fraterno.find({ gestionId: gestion._id, fechaEliminado: null }).populate("usuarioId", "nombres apellidoPaterno apellidoMaterno ci").lean();
  const cuotas = await Cuota.find({ preregistroId: { $in: fraternos.map((f) => f.preregistroId) }, fechaEliminado: null }).lean();
  const pagos = await DetalleCuota.find({ cuotaId: { $in: cuotas.map((c) => c._id) }, fechaEliminado: null }).sort({ fechaPago: 1 }).lean();
  const asignaciones: any[] = await DetalleBloque.find({ fraternoId: { $in: fraternos.map((f) => f._id) }, ...FILTRO_ASIGNACION_ACTIVA }).populate("bloqueId", "nombre").lean();
  const bloquePorFraterno = new Map(asignaciones.map((a) => [String(a.fraternoId), a.bloqueId?.nombre ?? "SIN BLOQUE"]));
  const fraternoPorPre = new Map(fraternos.map((f) => [String(f.preregistroId), f]));
  const pagosPorCuota = new Map<string, any[]>();
  for (const pago of pagos) pagosPorCuota.set(String(pago.cuotaId), [...(pagosPorCuota.get(String(pago.cuotaId)) ?? []), pago]);
  const personas = cuotas.map((cuota) => {
    const fraterno = fraternoPorPre.get(String(cuota.preregistroId)); const usuario = fraterno?.usuarioId;
    const movimientos = pagosPorCuota.get(String(cuota._id)) ?? []; const verificados = movimientos.filter((p) => p.estadoRevision === "VERIFICADO");
    const porNumero = new Map(verificados.map((p) => [p.numeroPago, p]));
    const montoVerificado = verificados.reduce((s, p) => s + Number(p.monto), 0);
    const completos = montoVerificado + 0.009 >= Number(cuota.montoTotal);
    const fechaCompleto = completos ? verificados.reduce((ultima, p) => !ultima || new Date(p.fechaRevision ?? p.fechaPago) > new Date(ultima) ? p.fechaRevision ?? p.fechaPago : ultima, null as Date | null) : null;
    return { cuotaId: cuota._id, fraternoId: fraterno?._id, nombre: [usuario?.nombres, usuario?.apellidoPaterno, usuario?.apellidoMaterno].filter(Boolean).join(" "), ci: usuario?.ci, bloque: bloquePorFraterno.get(String(fraterno?._id)) ?? "SIN BLOQUE", planElegido: cuota.numeroCuotasElegidas ?? null, pagosVerificados: verificados.length, montoTotal: cuota.montoTotal, montoVerificado, saldoVerificado: Math.max(0, Number(cuota.montoTotal) - montoVerificado), primera: porNumero.get(1) ?? null, segunda: porNumero.get(2) ?? null, tercera: porNumero.get(3) ?? null, fechaCompleto, estado: completos ? "PAGO_COMPLETO" : verificados.length ? "PAGO_PARCIAL" : "SIN_PAGO", revisiones: { pendientes: movimientos.filter((p) => p.estadoRevision === "PENDIENTE").length, observados: movimientos.filter((p) => p.estadoRevision === "OBSERVADO").length, rechazados: movimientos.filter((p) => p.estadoRevision === "RECHAZADO").length } };
  });
  const ordenar = (items: any[], campo: string) => items.filter((p) => p[campo]).sort((a, b) => new Date(campo === "fechaCompleto" ? a[campo] : a[campo].fechaPago).getTime() - new Date(campo === "fechaCompleto" ? b[campo] : b[campo].fechaPago).getTime());
  return { gestion: { _id: gestion._id, nombre: gestion.nombre, anio: gestion.anio }, personas, rankings: { primera: ordenar(personas, "primera"), segunda: ordenar(personas, "segunda"), tercera: ordenar(personas, "tercera"), completos: ordenar(personas, "fechaCompleto") } };
}
