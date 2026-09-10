import Bloque from "../models/Bloque";
import Cuota from "../models/Cuota";
import DetalleBloque from "../models/DetalleBloque";
import DetalleCuota from "../models/DetalleCuota";
import Fraterno from "../models/Fraterno";
import Gestion from "../models/Gestion";
import TallaFraterno from "../models/TallaFraterno";
import { TALLAS_DISPONIBLES } from "../constants/tallas";
import { FILTRO_ASIGNACION_ACTIVA } from "./AsignacionBloqueService";
import { LIMITES_BLOQUE, normalizarGeneroBloque } from "./BloqueService";
import { obtenerHistorialParticipacion } from "./CondicionFraternoService";

export const tieneAlgunaTallaValida = (talla?: { tallaPolera?: unknown; tallaChamarra?: unknown } | null) =>
  [talla?.tallaPolera, talla?.tallaChamarra].some((valor) => TALLAS_DISPONIBLES.includes(String(valor ?? "").trim().toUpperCase() as typeof TALLAS_DISPONIBLES[number]));

export async function listarPendientesBloque() {
  const gestion = await Gestion.findOne({ estado: { $in: ["ACTIVA", "INSCRIPCIONES"] }, fechaEliminado: null }).sort({ anio: -1 }).lean();
  if (!gestion) return { gestion: null, personas: [], bloques: [] };
  const fraternos: any[] = await Fraterno.find({ gestionId: gestion._id, estado: "ACTIVO", fechaEliminado: null })
    .populate("usuarioId", "nombres apellidoPaterno apellidoMaterno ci sexo telefono facultad")
    .lean();
  const [asignaciones, cuotas, tallas, bloques] = await Promise.all([
    DetalleBloque.find({ fraternoId: { $in: fraternos.map((f) => f._id) }, ...FILTRO_ASIGNACION_ACTIVA }).lean(),
    Cuota.find({ preregistroId: { $in: fraternos.map((f) => f.preregistroId) }, fechaEliminado: null }).lean(),
    TallaFraterno.find({ $or: [{ fraternoId: { $in: fraternos.map((f) => f._id) } }, { usuarioId: { $in: fraternos.map((f) => f.usuarioId?._id) } }] }).lean(),
    Bloque.find({ gestionId: gestion._id, estado: "ACTIVO" }).select("nombre cantidadHombres cantidadMujeres inscripcionesAbiertas").sort({ nombre: 1 }).lean(),
  ]);
  const asignados = new Set(asignaciones.map((a) => String(a.fraternoId)));
  const cuotaPorPre = new Map(cuotas.map((c) => [String(c.preregistroId), c]));
  const pagosPrimera = await DetalleCuota.find({ cuotaId: { $in: cuotas.map((c) => c._id) }, numeroPago: 1, estadoRevision: "VERIFICADO", fechaEliminado: null }).sort({ fechaPago: 1 }).lean();
  const primeraPorCuota = new Map(pagosPrimera.map((p) => [String(p.cuotaId), p]));
  const tallaPorFraterno = new Map(tallas.filter((t) => t.fraternoId).map((t) => [String(t.fraternoId), t]));
  const tallaPorUsuario = new Map(tallas.filter((t) => t.usuarioId).map((t) => [String(t.usuarioId), t]));
  const personas = await Promise.all(fraternos.filter((f) => !asignados.has(String(f._id))).map(async (f) => {
    const usuario = f.usuarioId;
    const cuota = cuotaPorPre.get(String(f.preregistroId));
    const primera = cuota ? primeraPorCuota.get(String(cuota._id)) : null;
    const talla: any = tallaPorFraterno.get(String(f._id)) ?? tallaPorUsuario.get(String(usuario?._id));
    const tallaValida = tieneAlgunaTallaValida(talla);
    const primeraVerificada = Boolean(primera);
    const estado = primeraVerificada && tallaValida ? "LISTO_PARA_ASIGNAR" : !primeraVerificada && tallaValida ? "FALTA_PRIMERA_CUOTA" : primeraVerificada ? "FALTA_TALLA" : "FALTA_PAGO_Y_TALLA";
    const historial = await obtenerHistorialParticipacion(usuario?._id, gestion._id);
    return { fraternoId: f._id, usuarioId: usuario?._id, nombre: [usuario?.nombres, usuario?.apellidoPaterno, usuario?.apellidoMaterno].filter(Boolean).join(" "), ci: usuario?.ci, sexo: normalizarGeneroBloque(usuario?.sexo), telefono: usuario?.telefono, facultad: usuario?.facultad, condicion: historial.condicion, fechaPrimeraCuota: primera?.fechaPago ?? null, primeraCuota: primeraVerificada ? "VERIFICADA" : "SIN_VERIFICAR", tallaPolera: talla?.tallaPolera ?? null, tallaChamarra: talla?.tallaChamarra ?? null, estado, listo: estado === "LISTO_PARA_ASIGNAR" };
  }));
  return { gestion: { _id: gestion._id, nombre: gestion.nombre, anio: gestion.anio }, personas, bloques: bloques.map((b: any) => ({ ...b, capacidad: { HOMBRE: Math.max(0, LIMITES_BLOQUE.HOMBRE - Number(b.cantidadHombres ?? 0)), MUJER: Math.max(0, LIMITES_BLOQUE.MUJER - Number(b.cantidadMujeres ?? 0)) } })) };
}
