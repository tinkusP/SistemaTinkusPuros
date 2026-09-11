import Bloque from "../models/Bloque";
import DetalleBloque from "../models/DetalleBloque";
import Fraterno from "../models/Fraterno";
import Gestion from "../models/Gestion";
import TallaFraterno from "../models/TallaFraterno";
import Cuota from "../models/Cuota";
import DetalleCuota from "../models/DetalleCuota";
import { FILTRO_ASIGNACION_ACTIVA } from "./AsignacionBloqueService";
import { idsGuiasDelBloque } from "./GuiaBloqueService";

const comparadorNatural = new Intl.Collator("es", { numeric: true, sensitivity: "base" });
export const normalizarMatriculaReporte = (valor: unknown) => String(valor ?? "").trim();
export const compararMatriculaNatural = (a: unknown, b: unknown) => comparadorNatural.compare(normalizarMatriculaReporte(a), normalizarMatriculaReporte(b));
const nombrePersona = (u: any) => [u?.apellidoPaterno, u?.apellidoMaterno, u?.nombres].filter(Boolean).join(" ").trim();

export type ClasificacionPagoReporte = "PAGO_COMPLETO" | "SOLO_PRIMER_PAGO" | "HASTA_SEGUNDO_PAGO" | "TRES_PAGOS_VERIFICADOS" | "SIN_PAGO" | "REVISAR";

export function clasificarPagoReporte(cuota: { estado?: string; saldo?: number } | null | undefined, pagos: Array<{ numeroPago?: number; estadoRevision?: string }>): ClasificacionPagoReporte {
  const verificados = new Set(pagos.filter((p) => p.estadoRevision === "VERIFICADO").map((p) => Number(p.numeroPago)));
  if (cuota?.estado === "PAGADA" && Number(cuota.saldo ?? 0) <= 0) return "PAGO_COMPLETO";
  if (verificados.has(1) && verificados.has(2) && verificados.has(3)) return "TRES_PAGOS_VERIFICADOS";
  if (verificados.has(1) && verificados.has(2)) return "HASTA_SEGUNDO_PAGO";
  if (verificados.has(1) && !verificados.has(2)) return "SOLO_PRIMER_PAGO";
  return verificados.size === 0 ? "SIN_PAGO" : "REVISAR";
}

const detallePagoReporte = (pago: any) => pago ? { estado: pago.estadoRevision, monto: Number(pago.monto ?? 0), fechaPago: pago.fechaPago ?? null, fechaVerificacion: pago.fechaRevision ?? null, metodo: pago.metodoPago ?? "" } : { estado: "SIN REGISTRO", monto: 0, fechaPago: null, fechaVerificacion: null, metodo: "" };

export function ordenarIntegrantesPorMatricula<T extends { matricula?: string; nombreCompleto: string }>(filas: T[]) {
  return [...filas].sort((a, b) => {
    const ma = normalizarMatriculaReporte(a.matricula), mb = normalizarMatriculaReporte(b.matricula);
    if (ma && mb) return compararMatriculaNatural(ma, mb) || comparadorNatural.compare(a.nombreCompleto, b.nombreCompleto);
    if (ma) return -1;
    if (mb) return 1;
    return comparadorNatural.compare(a.nombreCompleto, b.nombreCompleto);
  });
}

export async function obtenerReporteIntegrantesBloque(gestionId?: string) {
  const gestion: any = gestionId
    ? await Gestion.findOne({ _id: gestionId, fechaEliminado: null }).select("nombre anio").lean()
    : await Gestion.findOne({ estado: { $in: ["ACTIVA", "INSCRIPCIONES"] }, fechaEliminado: null }).sort({ anio: -1 }).select("nombre anio").lean();
  if (!gestion) return { gestion: null, generadoEn: new Date(), personas: [], resumen: { total: 0, conMatricula: 0, sinMatricula: 0, hombres: 0, mujeres: 0, bloques: 0, detalleBloques: [], inconsistencias: 0 } };
  const bloques: any[] = await Bloque.find({ gestionId: gestion._id, estado: "ACTIVO" })
    .populate({ path: "guiaId", populate: { path: "usuarioId", select: "nombres apellidoPaterno apellidoMaterno sexo" } })
    .populate({ path: "guiasIds", populate: { path: "usuarioId", select: "nombres apellidoPaterno apellidoMaterno sexo" } })
    .populate("gestionId", "nombre anio").sort({ nombre: 1 }).lean();
  const bloqueIds = bloques.map((b) => b._id);
  const detalles: any[] = await DetalleBloque.find({ bloqueId: { $in: bloqueIds }, ...FILTRO_ASIGNACION_ACTIVA }).sort({ fechaAsignacion: -1, _id: -1 }).lean();
  const fraternoIds = [...new Set(detalles.map((d) => String(d.fraternoId)))];
  const fraternos: any[] = await Fraterno.find({ _id: { $in: fraternoIds }, estado: "ACTIVO", fechaEliminado: null })
    .populate("usuarioId", "nombres apellidoPaterno apellidoMaterno ci sexo telefono facultad carrera registroUniversitario tipoFraterno estado")
    .select("usuarioId preregistroId numeroFraterno gestionId estado").lean();
  const fraternoPorId = new Map(fraternos.map((f) => [String(f._id), f]));
  const usuarioIds = fraternos.map((f) => f.usuarioId?._id).filter(Boolean);
  const [tallas, cuotas]: [any[], any[]] = await Promise.all([
    TallaFraterno.find({ $or: [{ fraternoId: { $in: fraternos.map((f) => f._id) } }, { usuarioId: { $in: usuarioIds } }] }).lean(),
    Cuota.find({ preregistroId: { $in: fraternos.map((f) => f.preregistroId).filter(Boolean) }, fechaEliminado: null }).lean(),
  ]);
  const pagos: any[] = cuotas.length ? await DetalleCuota.find({ cuotaId: { $in: cuotas.map((c) => c._id) }, fechaEliminado: null }).sort({ numeroPago: 1, fechaPago: 1 }).lean() : [];
  const cuotaPorPreregistro = new Map(cuotas.map((c) => [String(c.preregistroId), c]));
  const pagosPorCuota = new Map<string, any[]>();
  pagos.forEach((p) => { const clave = String(p.cuotaId); const lista = pagosPorCuota.get(clave) ?? []; lista.push(p); pagosPorCuota.set(clave, lista); });
  const tallaPorFraterno = new Map(tallas.filter((t) => t.fraternoId).map((t) => [String(t.fraternoId), t]));
  const tallaPorUsuario = new Map(tallas.filter((t) => t.usuarioId).map((t) => [String(t.usuarioId), t]));
  const bloquePorId = new Map(bloques.map((b) => [String(b._id), b]));
  const apariciones = new Map<string, number>();
  detalles.forEach((d) => apariciones.set(String(d.fraternoId), (apariciones.get(String(d.fraternoId)) ?? 0) + 1));
  const filas = detalles.flatMap((detalle) => {
    const fraterno = fraternoPorId.get(String(detalle.fraternoId));
    const bloque = bloquePorId.get(String(detalle.bloqueId));
    const usuario: any = fraterno?.usuarioId;
    if (!fraterno || !bloque || !usuario || usuario.estado !== "ACTIVO") return [];
    const guiasUnicos = idsGuiasDelBloque(bloque).map((id) => [...(bloque.guiasIds ?? []), bloque.guiaId].find((g: any) => String(g?._id ?? g) === String(id))).filter(Boolean);
    const nombresGuias = (sexo: string) => guiasUnicos.filter((g: any) => String(g.usuarioId?.sexo).toUpperCase() === sexo).map((g: any) => nombrePersona(g.usuarioId)).join(", ");
    const talla = tallaPorFraterno.get(String(fraterno._id)) ?? tallaPorUsuario.get(String(usuario._id));
    const cuota: any = cuotaPorPreregistro.get(String(fraterno.preregistroId));
    const movimientos = cuota ? pagosPorCuota.get(String(cuota._id)) ?? [] : [];
    const verificados = movimientos.filter((p: any) => p.estadoRevision === "VERIFICADO");
    const porNumero = new Map(movimientos.map((p: any) => [Number(p.numeroPago), p]));
    const montoVerificado = Number(verificados.reduce((s: number, p: any) => s + Number(p.monto ?? 0), 0).toFixed(2));
    const clasificacionPago = clasificarPagoReporte(cuota, movimientos);
    const fechaPagoCompleto = clasificacionPago === "PAGO_COMPLETO" && verificados.length ? verificados.reduce((ultima: Date | null, p: any) => { const fecha = p.fechaRevision ?? p.fechaPago; return !ultima || new Date(fecha) > new Date(ultima) ? fecha : ultima; }, null) : null;
    const pendientes = movimientos.filter((p: any) => p.estadoRevision === "PENDIENTE").length;
    const observados = movimientos.filter((p: any) => p.estadoRevision === "OBSERVADO").length;
    const rechazados = movimientos.filter((p: any) => p.estadoRevision === "RECHAZADO").length;
    return [{
      usuarioId: String(usuario._id), fraternoId: String(fraterno._id), detalleBloqueId: String(detalle._id),
      matricula: normalizarMatriculaReporte(usuario.registroUniversitario), nombreCompleto: nombrePersona(usuario), ci: usuario.ci ?? "", sexo: usuario.sexo ?? "",
      telefono: usuario.telefono ?? "", facultad: usuario.facultad ?? "", carrera: usuario.carrera ?? "", numeroFraterno: fraterno.numeroFraterno ?? "",
      bloqueId: String(bloque._id), bloque: bloque.nombre, guiasHombres: nombresGuias("HOMBRE"), guiasMujeres: nombresGuias("MUJER"),
      tallaPolera: talla?.tallaPolera ?? "", tallaChamarra: talla?.tallaChamarra ?? "", condicion: usuario.tipoFraterno ?? "SIN REGISTRO",
      estado: fraterno.estado, planPagos: cuota?.numeroCuotasElegidas ?? null, estadoCuota: cuota?.estado ?? "SIN CUOTA", pagosVerificados: verificados.length,
      montoVerificado, saldo: cuota?.saldo ?? null, primerPago: detallePagoReporte(porNumero.get(1)), segundoPago: detallePagoReporte(porNumero.get(2)), tercerPago: detallePagoReporte(porNumero.get(3)),
      fechaPagoCompleto, clasificacionPago, pendientes, observados, rechazados,
      observaciones: [(apariciones.get(String(fraterno._id)) ?? 0) > 1 ? "INCONSISTENCIA: DOS BLOQUES ACTIVOS" : "", clasificacionPago === "TRES_PAGOS_VERIFICADOS" && Number(cuota?.saldo ?? 0) > 0 ? "REVISAR: 3 PAGOS + SALDO > 0" : ""].filter(Boolean).join("; "),
    }];
  });
  const unicos = new Map<string, any>();
  for (const fila of ordenarIntegrantesPorMatricula(filas)) if (!unicos.has(fila.usuarioId)) unicos.set(fila.usuarioId, fila);
  const personas = [...unicos.values()];
  const resumenBloques = bloques.map((b) => { const items = personas.filter((p) => p.bloqueId === String(b._id)); return { _id: String(b._id), nombre: b.nombre, total: items.length, pagoCompleto: items.filter((p) => p.clasificacionPago === "PAGO_COMPLETO").length, soloPrimerPago: items.filter((p) => p.clasificacionPago === "SOLO_PRIMER_PAGO").length, hastaSegundoPago: items.filter((p) => p.clasificacionPago === "HASTA_SEGUNDO_PAGO").length, tresPagos: items.filter((p) => p.pagosVerificados >= 3).length, sinPago: items.filter((p) => p.pagosVerificados === 0).length, pendientes: items.filter((p) => p.pendientes > 0).length }; });
  return {
    gestion, generadoEn: new Date(), personas,
    resumen: { total: personas.length, conMatricula: personas.filter((p) => p.matricula).length, sinMatricula: personas.filter((p) => !p.matricula).length, hombres: personas.filter((p) => p.sexo === "HOMBRE").length, mujeres: personas.filter((p) => p.sexo === "MUJER").length, bloques: resumenBloques.length, detalleBloques: resumenBloques, inconsistencias: personas.filter((p) => p.observaciones).length, pagoCompleto: personas.filter((p) => p.clasificacionPago === "PAGO_COMPLETO").length, soloPrimerPago: personas.filter((p) => p.clasificacionPago === "SOLO_PRIMER_PAGO").length, hastaSegundoPago: personas.filter((p) => p.clasificacionPago === "HASTA_SEGUNDO_PAGO").length, tresPagosVerificados: personas.filter((p) => p.pagosVerificados >= 3).length, sinPago: personas.filter((p) => p.pagosVerificados === 0).length, pendientes: personas.filter((p) => p.pendientes > 0).length, observados: personas.filter((p) => p.observados > 0).length, rechazados: personas.filter((p) => p.rechazados > 0).length },
  };
}
