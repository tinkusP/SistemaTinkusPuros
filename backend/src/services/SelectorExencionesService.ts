import Bloque from "../models/Bloque";
import Cuota from "../models/Cuota";
import DetalleBloque from "../models/DetalleBloque";
import DetalleCuota from "../models/DetalleCuota";
import ExencionPagoUsuario from "../models/ExencionPagoUsuario";
import Fraterno from "../models/Fraterno";
import Gestion from "../models/Gestion";
import Guia from "../models/Guia";
import PerfilUsuario from "../models/PerfilUsuario";
import PostulanteGuia from "../models/PostulanteGuia";
import Preregistro from "../models/Preregistro";
import Rol from "../models/Rol";
import TallaFraterno from "../models/TallaFraterno";

const sid = (valor: any) => String(valor?._id ?? valor ?? "");
const dinero = (valor: unknown) => Number((Number(valor) || 0).toFixed(2));
const nombreCompleto = (usuario: any) => [usuario?.nombres, usuario?.apellidoPaterno, usuario?.apellidoMaterno].filter(Boolean).join(" ").trim();
const normalizar = (valor: unknown) => String(valor ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
const tipoOrigen = (valor: unknown) => ["INTERNO", "INTERNO_UMSA"].includes(String(valor ?? "").toUpperCase()) ? "INTERNO" : ["EXTERNO", "EXTERNO_UMSA", "EXTERNO_NO_UMSA"].includes(String(valor ?? "").toUpperCase()) ? "EXTERNO" : "SIN CLASIFICAR";

export function estadoPagoSelectorExenciones(datos: { tieneCuota: boolean; exento: boolean; montoTotal: number; montoVerificado: number; pagosPendientes: number }) {
  if (!datos.tieneCuota) return "SIN CUOTA";
  if (datos.exento) return "EXENTO";
  if (datos.montoTotal > 0 && datos.montoVerificado >= datos.montoTotal) return "PAGÓ";
  if (datos.montoVerificado > 0) return "PAGO PARCIAL";
  if (datos.pagosPendientes > 0) return "PENDIENTE DE VERIFICACIÓN";
  return "PENDIENTE";
}

export async function obtenerUsuariosSelectorExenciones() {
  const gestion: any = await Gestion.findOne({ estado: { $in: ["ACTIVA", "INSCRIPCIONES"] }, fechaEliminado: null }).sort({ anio: -1 }).lean();
  if (!gestion) return { generadoEn: new Date(), gestion: null, resumen: { totalUsuariosActivos: 0, disponiblesExencion: 0, visiblesControlFinanciero: 0, noVisiblesControlFinanciero: 0 }, usuarios: [], noVisiblesControlFinanciero: [], casosValidacion: [], validaciones: { universoCompleto: true } };

  // La fuente es PerfilUsuario. Ninguna relación opcional limita este universo.
  const usuarios: any[] = await PerfilUsuario.find({ estado: "ACTIVO", fechaEliminado: null })
    .select("nombres apellidoPaterno apellidoMaterno ci telefono email sexo tipoOrigen roles estado")
    .sort({ apellidoPaterno: 1, apellidoMaterno: 1, nombres: 1 })
    .lean();
  const usuarioIds = usuarios.map((usuario) => usuario._id);
  const [roles, preregistros, fraternos, guias, exenciones]: any[][] = await Promise.all([
    Rol.find({ _id: { $in: usuarios.flatMap((usuario) => usuario.roles ?? []) }, fechaEliminado: null, estado: true }).select("codigo nombre").lean(),
    Preregistro.find({ gestionId: gestion._id, usuarioId: { $in: usuarioIds }, fechaEliminado: null }).sort({ fechaRegistro: -1 }).lean(),
    Fraterno.find({ gestionId: gestion._id, usuarioId: { $in: usuarioIds }, fechaEliminado: null }).sort({ fechaRegistro: -1 }).lean(),
    Guia.find({ gestionId: gestion._id, usuarioId: { $in: usuarioIds }, estado: "ACTIVO" }).lean(),
    ExencionPagoUsuario.find({ gestionId: gestion._id, usuarioId: { $in: usuarioIds } }).lean(),
  ]);

  const preregistroIds = preregistros.map((preregistro) => preregistro._id);
  const fraternoIds = fraternos.map((fraterno) => fraterno._id);
  const [cuotas, postulantes, bloques, asignaciones, tallas]: any[][] = await Promise.all([
    Cuota.find({ preregistroId: { $in: preregistroIds }, fechaEliminado: null }).lean(),
    PostulanteGuia.find({ preregistroId: { $in: preregistroIds }, fechaEliminado: null, estado: { $nin: ["RETIRADO", "NO_ELEGIDO"] } }).lean(),
    Bloque.find({ gestionId: gestion._id, estado: "ACTIVO" }).select("nombre estado").lean(),
    DetalleBloque.find({ fraternoId: { $in: fraternoIds }, estado: "ACTIVO", fechaEliminado: null }).sort({ fechaAsignacion: -1 }).lean(),
    TallaFraterno.find({ $or: [{ usuarioId: { $in: usuarioIds } }, { fraternoId: { $in: fraternoIds } }] }).lean(),
  ]);
  const pagos: any[] = await DetalleCuota.find({ cuotaId: { $in: cuotas.map((cuota) => cuota._id) }, fechaEliminado: null }).sort({ fechaPago: 1 }).lean();

  const usuarioMap = new Map(usuarios.map((usuario) => [sid(usuario), usuario]));
  const rolMap = new Map(roles.map((rol) => [sid(rol), String(rol.codigo || rol.nombre).toUpperCase()]));
  const preregistrosUsuario = new Map<string, any[]>();
  for (const preregistro of preregistros) preregistrosUsuario.set(sid(preregistro.usuarioId), [...(preregistrosUsuario.get(sid(preregistro.usuarioId)) ?? []), preregistro]);
  const cuotaPorPreregistro = new Map(cuotas.map((cuota) => [sid(cuota.preregistroId), cuota]));
  const pagosPorCuota = new Map<string, any[]>();
  for (const pago of pagos) pagosPorCuota.set(sid(pago.cuotaId), [...(pagosPorCuota.get(sid(pago.cuotaId)) ?? []), pago]);
  const fraternosUsuario = new Map<string, any[]>();
  for (const fraterno of fraternos) fraternosUsuario.set(sid(fraterno.usuarioId), [...(fraternosUsuario.get(sid(fraterno.usuarioId)) ?? []), fraterno]);
  const bloqueMap = new Map(bloques.map((bloque) => [sid(bloque), bloque]));
  const asignacionPorFraterno = new Map<string, any>();
  for (const asignacion of asignaciones) if (bloqueMap.has(sid(asignacion.bloqueId)) && !asignacionPorFraterno.has(sid(asignacion.fraternoId))) asignacionPorFraterno.set(sid(asignacion.fraternoId), asignacion);
  const tallaPorUsuario = new Map(tallas.filter((talla) => talla.usuarioId).map((talla) => [sid(talla.usuarioId), talla]));
  const tallaPorFraterno = new Map(tallas.filter((talla) => talla.fraternoId).map((talla) => [sid(talla.fraternoId), talla]));
  const guiaUsuarios = new Set(guias.map((guia) => sid(guia.usuarioId)));
  const postulantePreregistros = new Set(postulantes.map((postulante) => sid(postulante.preregistroId)));
  const exencionUsuarioMap = new Map(exenciones.map((exencion) => [sid(exencion.usuarioId), exencion]));

  const filas = usuarios.map((usuario) => {
    const usuarioId = sid(usuario);
    const preregistrosPersona = preregistrosUsuario.get(usuarioId) ?? [];
    const preregistro = preregistrosPersona.find((item) => cuotaPorPreregistro.has(sid(item))) ?? preregistrosPersona[0];
    const cuota: any = preregistro ? cuotaPorPreregistro.get(sid(preregistro)) : null;
    const movimientos = cuota ? pagosPorCuota.get(sid(cuota)) ?? [] : [];
    const fraternosPersona = fraternosUsuario.get(usuarioId) ?? [];
    const fraterno = fraternosPersona.find((item) => item.estado === "ACTIVO") ?? fraternosPersona[0];
    const asignacion = fraterno ? asignacionPorFraterno.get(sid(fraterno)) : null;
    const bloque: any = asignacion ? bloqueMap.get(sid(asignacion.bloqueId)) : null;
    const talla: any = tallaPorUsuario.get(usuarioId) ?? fraternosPersona.map((item) => tallaPorFraterno.get(sid(item))).find(Boolean);
    const rolesUsuario = [...new Set((usuario.roles ?? []).map((rolId: any) => rolMap.get(sid(rolId))).filter(Boolean))] as string[];
    if (fraterno?.estado === "ACTIVO" && !rolesUsuario.includes("FRATERNO")) rolesUsuario.push("FRATERNO");
    if (guiaUsuarios.has(usuarioId) && !rolesUsuario.includes("GUIA")) rolesUsuario.push("GUIA");
    if (preregistro && postulantePreregistros.has(sid(preregistro)) && !rolesUsuario.includes("POSTULANTE")) rolesUsuario.push("POSTULANTE");
    const verificados = movimientos.filter((movimiento) => movimiento.estadoRevision === "VERIFICADO");
    const pendientes = movimientos.filter((movimiento) => movimiento.estadoRevision === "PENDIENTE");
    const montoVerificado = dinero(verificados.reduce((total, movimiento) => total + Number(movimiento.monto || 0), 0));
    const exencionUsuario: any = exencionUsuarioMap.get(usuarioId);
    const usaExencionCuota = Boolean(cuota);
    const exento = usaExencionCuota ? Boolean(cuota.exentoPago) : Boolean(exencionUsuario?.activa);
    const administradorId = usaExencionCuota ? cuota?.usuarioExencion : exencionUsuario?.usuarioAdministrador;
    const administrador = usuarioMap.get(sid(administradorId));
    const visibleControlFinanciero = Boolean(cuota && fraterno && asignacion && bloque);
    const motivosNoVisible = [!preregistro ? "SIN PRERREGISTRO EN LA GESTIÓN" : "", !cuota ? "SIN CUOTA" : "", !fraterno ? "SIN PERFIL FRATERNO" : "", !asignacion || !bloque ? "SIN BLOQUE ACTIVO" : ""].filter(Boolean);
    const tipo = cuota?.tipoOrigenTarifa ?? tipoOrigen(usuario.tipoOrigen);
    const estadoPago = estadoPagoSelectorExenciones({ tieneCuota: Boolean(cuota), exento, montoTotal: dinero(cuota?.montoTotal), montoVerificado, pagosPendientes: pendientes.length });
    return {
      usuarioId,
      preregistroId: sid(preregistro),
      fraternoId: sid(fraterno),
      cuotaId: sid(cuota),
      nombre: nombreCompleto(usuario),
      ci: String(usuario.ci ?? ""),
      telefono: String(usuario.telefono ?? ""),
      correo: String(usuario.email ?? ""),
      sexo: usuario.sexo ?? "SIN REGISTRO",
      estadoUsuario: usuario.estado,
      roles: rolesUsuario.length ? rolesUsuario : ["OTROS"],
      codigoFraterno: fraterno?.numeroFraterno ?? "SIN REGISTRO",
      bloque: bloque?.nombre ?? "SIN BLOQUE",
      tipo,
      estadoPago,
      montoCuota: dinero(cuota?.montoTotal),
      montoVerificado,
      tallaPolera: talla?.tallaPolera ?? "SIN REGISTRO",
      tallaChamarra: talla?.tallaChamarra ?? "SIN REGISTRO",
      exento,
      categoriaExencion: usaExencionCuota ? cuota?.motivoExencion ?? "" : exencionUsuario?.categoria ?? "",
      descripcionExencion: usaExencionCuota ? cuota?.observacionExencion ?? "" : exencionUsuario?.descripcion ?? "",
      administradorExencion: nombreCompleto(administrador) || (administradorId ? "ADMINISTRADOR REGISTRADO" : "SIN REGISTRO"),
      fechaExencion: usaExencionCuota ? cuota?.fechaExencion ?? null : exencionUsuario?.fechaRegistro ?? null,
      fuenteExencion: usaExencionCuota ? "CUOTA" : "USUARIO",
      visibleControlFinanciero,
      motivosNoVisible,
    };
  });

  const noVisiblesControlFinanciero = filas.filter((fila) => !fila.visibleControlFinanciero);
  const resumen = {
    totalUsuariosActivos: usuarios.length,
    disponiblesExencion: filas.length,
    visiblesControlFinanciero: filas.length - noVisiblesControlFinanciero.length,
    noVisiblesControlFinanciero: noVisiblesControlFinanciero.length,
  };
  const casos = [
    { codigo: "JONNY_HERRERA_CONDORI", palabras: ["JONNY", "HERRERA", "CONDORI"] },
    { codigo: "KENJI_GROVER_SADAKATA", palabras: ["KENJI", "GROVER", "SADAKATA"] },
  ];
  const casosValidacion = casos.map((caso) => {
    const encontrados = filas.filter((fila) => caso.palabras.every((palabra) => (` ${normalizar(fila.nombre)} `).includes(` ${palabra} `)));
    return { caso: caso.codigo, encontrado: encontrados.length > 0, coincidencias: encontrados.map((fila) => ({ usuarioId: fila.usuarioId, nombre: fila.nombre, ci: fila.ci, bloque: fila.bloque, estadoPago: fila.estadoPago, exento: fila.exento })) };
  });

  return {
    generadoEn: new Date(),
    gestion: { _id: gestion._id, nombre: gestion.nombre, anio: gestion.anio },
    resumen,
    usuarios: filas,
    noVisiblesControlFinanciero,
    casosValidacion,
    validaciones: {
      universoCompleto: resumen.totalUsuariosActivos === resumen.disponiblesExencion,
      usuariosUnicos: new Set(filas.map((fila) => fila.usuarioId)).size === filas.length,
      eliminadosExcluidos: filas.every((fila) => fila.estadoUsuario === "ACTIVO"),
    },
  };
}
