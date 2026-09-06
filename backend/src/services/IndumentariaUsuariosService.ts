import PerfilUsuario from "../models/PerfilUsuario";
import "../models/Rol";
import Preregistro from "../models/Preregistro";
import Fraterno from "../models/Fraterno";
import Guia from "../models/Guia";
import Bloque from "../models/Bloque";
import DetalleBloque from "../models/DetalleBloque";
import Cuota from "../models/Cuota";
import DetalleCuota from "../models/DetalleCuota";
import TallaFraterno from "../models/TallaFraterno";
import { FILTRO_ASIGNACION_ACTIVA } from "./AsignacionBloqueService";

const id = (valor: unknown) => String(valor ?? "");
const ultimoPorUsuario = (registros: any[]) => {
  const mapa = new Map<string, any>();
  for (const registro of registros) if (!mapa.has(id(registro.usuarioId))) mapa.set(id(registro.usuarioId), registro);
  return mapa;
};

export const estadoHabilitacionTalla = (datos: { usuarioActivo: boolean; tieneCuota: boolean; primeraCuotaVerificada: boolean }) => {
  if (!datos.usuarioActivo) return { habilitado: false, estadoHabilitacion: "NO_HABILITADO", motivo: "La cuenta no está activa" };
  if (!datos.tieneCuota) return { habilitado: false, estadoHabilitacion: "PAGO_PENDIENTE", motivo: "No tiene una cuota vinculada" };
  if (!datos.primeraCuotaVerificada) return { habilitado: false, estadoHabilitacion: "PAGO_PENDIENTE", motivo: "La primera cuota todavía no fue verificada" };
  return { habilitado: true, estadoHabilitacion: "HABILITADO", motivo: "Primera cuota verificada" };
};

/** Fuente única para Administración: parte de usuarios y conserva relaciones opcionales. */
export async function listarUsuariosIndumentaria() {
  const usuarios: any[] = await PerfilUsuario.find({ fechaEliminado: null, estado: { $ne: "ELIMINADO" } })
    .select("nombres apellidoPaterno apellidoMaterno ci sexo telefono email estado roles")
    .populate("roles", "codigo nombre")
    .sort({ apellidoPaterno: 1, apellidoMaterno: 1, nombres: 1 })
    .lean();
  const usuarioIds = usuarios.map((usuario) => usuario._id);
  const [preregistros, fraternos, guias, tallas] = await Promise.all([
    Preregistro.find({ usuarioId: { $in: usuarioIds }, fechaEliminado: null }).sort({ fechaRegistro: -1, _id: -1 }).lean(),
    Fraterno.find({ usuarioId: { $in: usuarioIds }, fechaEliminado: null }).sort({ fechaIngreso: -1, _id: -1 }).lean(),
    Guia.find({ usuarioId: { $in: usuarioIds }, estado: "ACTIVO" }).lean(),
    TallaFraterno.find({ $or: [{ usuarioId: { $in: usuarioIds } }] }).lean(),
  ]);
  const preregistroPorUsuario = ultimoPorUsuario(preregistros);
  const fraternoPorUsuario = ultimoPorUsuario(fraternos);
  const guiaPorUsuario = ultimoPorUsuario(guias);
  const fraternoIds = fraternos.map((fraterno) => fraterno._id);
  const guiaIds = guias.map((guia) => guia._id);
  const preregistroIds = preregistros.map((preregistro) => preregistro._id);
  const [cuotas, detallesBloque, bloquesGuia, tallasFraterno] = await Promise.all([
    Cuota.find({ preregistroId: { $in: preregistroIds }, fechaEliminado: null }).lean(),
    DetalleBloque.find({ fraternoId: { $in: fraternoIds }, ...FILTRO_ASIGNACION_ACTIVA }).populate("bloqueId", "nombre estado").lean(),
    Bloque.find({ estado: "ACTIVO", $or: [{ guiaId: { $in: guiaIds } }, { guiasIds: { $in: guiaIds } }] }).select("nombre guiaId guiasIds").lean(),
    TallaFraterno.find({ fraternoId: { $in: fraternoIds } }).lean(),
  ]);
  const cuotaPorPreregistro = new Map(cuotas.map((cuota) => [id(cuota.preregistroId), cuota]));
  const cuotaIds = cuotas.map((cuota) => cuota._id);
  const pagosVerificados = await DetalleCuota.find({ cuotaId: { $in: cuotaIds }, estadoRevision: "VERIFICADO", fechaEliminado: null }).select("cuotaId").lean();
  const cuotasVerificadas = new Set(pagosVerificados.map((pago) => id(pago.cuotaId)));
  const tallaPorUsuario = new Map(tallas.map((talla) => [id(talla.usuarioId), talla]));
  for (const talla of tallasFraterno) {
    const fraterno = fraternos.find((item) => id(item._id) === id(talla.fraternoId));
    if (fraterno && !tallaPorUsuario.has(id(fraterno.usuarioId))) tallaPorUsuario.set(id(fraterno.usuarioId), talla);
  }
  const bloquePorFraterno = new Map(detallesBloque.filter((d: any) => d.bloqueId?.estado === "ACTIVO").map((d: any) => [id(d.fraternoId), d.bloqueId?.nombre]));
  const bloquePorGuia = new Map<string, string>();
  for (const bloque of bloquesGuia as any[]) for (const guiaId of [bloque.guiaId, ...(bloque.guiasIds ?? [])].filter(Boolean)) bloquePorGuia.set(id(guiaId), bloque.nombre);

  return usuarios.map((usuario) => {
    const preregistro = preregistroPorUsuario.get(id(usuario._id));
    const fraterno = fraternoPorUsuario.get(id(usuario._id));
    const guia = guiaPorUsuario.get(id(usuario._id));
    const cuota = preregistro ? cuotaPorPreregistro.get(id(preregistro._id)) : undefined;
    const talla = tallaPorUsuario.get(id(usuario._id));
    const habilitacion = estadoHabilitacionTalla({ usuarioActivo: usuario.estado === "ACTIVO", tieneCuota: Boolean(cuota), primeraCuotaVerificada: Boolean(cuota && cuotasVerificadas.has(id(cuota._id))) });
    return {
      ...usuario,
      roles: (usuario.roles ?? []).map((rol: any) => rol.codigo ?? rol.nombre),
      preregistro: preregistro ? { _id: preregistro._id, numero: preregistro.numeroPreRegistro, estado: preregistro.estado } : null,
      fraterno: fraterno ? { _id: fraterno._id, numero: fraterno.numeroFraterno, estado: fraterno.estado } : null,
      guia: guia ? { _id: guia._id, bloque: bloquePorGuia.get(id(guia._id)) ?? null } : null,
      bloque: (fraterno && bloquePorFraterno.get(id(fraterno._id))) || (guia && bloquePorGuia.get(id(guia._id))) || null,
      cuota: cuota ? { _id: cuota._id, estado: cuota.estado, saldo: cuota.saldo, primeraCuotaVerificada: cuotasVerificadas.has(id(cuota._id)) } : null,
      talla: talla ?? null,
      ...habilitacion,
    };
  });
}
