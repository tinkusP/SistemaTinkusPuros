import type { Request, Response } from "express";
import mongoose from "mongoose";
import Gestion from "../models/Gestion";
import PerfilUsuario from "../models/PerfilUsuario";
import Preregistro, { type EstadoPreregistro } from "../models/Preregistro";
import PostulanteGuia from "../models/PostulanteGuia";
import Fraterno from "../models/Fraterno";

const populate = [
  { path: "usuarioId", select: "nombres apellidoPaterno apellidoMaterno ci email telefono sexo estado fotoPerfil fechaCreado" },
  { path: "gestionId", select: "anio nombre estado cupoMaximo cupoMaximoHombres cupoMaximoMujeres" },
  { path: "usuarioAprobador", select: "nombres apellidoPaterno apellidoMaterno" },
  { path: "usuarioRevisor", select: "nombres apellidoPaterno apellidoMaterno" },
  { path: "usuarioCreador", select: "nombres apellidoPaterno apellidoMaterno email" },
];

const error = (res: Response, causa: unknown, mensaje: string) => {
  console.error(mensaje, causa);
  if (causa instanceof mongoose.Error.ValidationError) {
    return res.status(400).json({ error: Object.values(causa.errors).map((item) => item.message).join(", ") });
  }
  if ((causa as { code?: number })?.code === 11000) {
    return res.status(409).json({ error: "El usuario ya tiene un preregistro en esta gestión" });
  }
  return res.status(500).json({ error: mensaje });
};

const gestionDisponible = async (gestionId?: string) => {
  if (gestionId) return Gestion.findOne({ _id: gestionId, estado: { $in: ["INSCRIPCIONES", "ACTIVA"] }, fechaEliminado: null });
  return Gestion.findOne({ estado: { $in: ["INSCRIPCIONES", "ACTIVA"] }, fechaEliminado: null })
    .sort({ estado: -1, anio: -1, fechaInicio: -1 });
};

const siguienteNumero = async (gestion: { _id: mongoose.Types.ObjectId; anio: number }) => {
  const cantidad = await Preregistro.countDocuments({ gestionId: gestion._id });
  return `PRE-${gestion.anio}-${String(cantidad + 1).padStart(4, "0")}`;
};

const grupoSexo = (sexo?: string | null) => {
  const valor = String(sexo ?? "").trim().toUpperCase();
  if (["MASCULINO", "HOMBRE", "M"].includes(valor)) return "HOMBRE" as const;
  if (["FEMENINO", "MUJER", "F"].includes(valor)) return "MUJER" as const;
  return null;
};

async function verificarCupoPorSexo(gestion: { _id: mongoose.Types.ObjectId; cupoMaximoHombres: number; cupoMaximoMujeres: number }, usuario: { _id: mongoose.Types.ObjectId; sexo?: string | null }, excluirId?: mongoose.Types.ObjectId) {
  const grupo = grupoSexo(usuario.sexo);
  if (!grupo) throw new Error("El perfil debe tener el sexo MASCULINO o FEMENINO antes de aprobar el preregistro");
  const usuariosDelGrupo = await PerfilUsuario.find({ sexo: grupo === "HOMBRE" ? { $in: [/^masculino$/i, /^hombre$/i, /^m$/i] } : { $in: [/^femenino$/i, /^mujer$/i, /^f$/i] } }).distinct("_id");
  const ocupados = await Preregistro.countDocuments({ gestionId: gestion._id, usuarioId: { $in: usuariosDelGrupo }, estado: "APROBADO", fechaEliminado: null, ...(excluirId ? { _id: { $ne: excluirId } } : {}) });
  const maximo = grupo === "HOMBRE" ? gestion.cupoMaximoHombres : gestion.cupoMaximoMujeres;
  return { grupo, ocupados, maximo, disponible: ocupados < maximo };
}

export const crearPreregistroParaUsuario = async ({
  usuarioId,
  gestionId,
  creadorId,
  aceptoReglamento = false,
}: {
  usuarioId: string | mongoose.Types.ObjectId;
  gestionId?: string;
  creadorId?: mongoose.Types.ObjectId;
  aceptoReglamento?: boolean;
}) => {
  const gestion = await gestionDisponible(gestionId);
  if (!gestion) throw new Error("No existe una gestión en inscripciones o activa para crear el preregistro");

  const [existente, usuario] = await Promise.all([
    Preregistro.findOne({ usuarioId, gestionId: gestion._id, fechaEliminado: null }),
    PerfilUsuario.findOne({ _id: usuarioId, estado: { $ne: "ELIMINADO" } }),
  ]);
  if (existente) return existente;
  if (!usuario) throw new Error("El usuario no existe");

  const capacidad = await verificarCupoPorSexo(gestion, usuario);
  const sinCupo = !capacidad.disponible;
  return Preregistro.create({
    usuarioId: usuario._id,
    gestionId: gestion._id,
    numeroPreRegistro: await siguienteNumero(gestion),
    estado: sinCupo ? "LISTA_ESPERA" : "PENDIENTE",
    observacion: sinCupo ? `Asignado automáticamente a lista de espera: cupo de ${capacidad.grupo.toLowerCase()}s completo (${capacidad.ocupados}/${capacidad.maximo})` : undefined,
    aceptoReglamento,
    aprobado: false,
    usuarioCreador: creadorId,
  });
};

export const crearPreregistro = async (req: Request, res: Response) => {
  try {
    const preregistro = await crearPreregistroParaUsuario({
      usuarioId: req.body.usuarioId ?? req.usuario?._id,
      gestionId: req.body.gestionId,
      creadorId: req.usuario?._id,
      aceptoReglamento: Boolean(req.body.aceptoReglamento),
    });
    await preregistro.populate(populate);
    return res.status(201).json({ message: "Preregistro creado correctamente", preregistro });
  } catch (causa) {
    if (causa instanceof Error && causa.message.startsWith("No existe")) return res.status(409).json({ error: causa.message });
    return error(res, causa, "Error al crear el preregistro");
  }
};

export const obtenerPreregistros = async (req: Request, res: Response) => {
  try {
    const pagina = Math.max(Number(req.query.pagina) || 1, 1);
    // La gestión unificada necesita relacionar todos los perfiles visibles con
    // su preregistro. El límite anterior de 100 producía falsos "Sin
    // preregistro" cuando existían más de cien registros en la gestión.
    const limite = Math.min(Math.max(Number(req.query.limite) || 20, 1), 1000);
    const filtro: Record<string, unknown> = { fechaEliminado: null };
    if (req.query.estado) filtro.estado = req.query.estado;
    if (req.query.gestionId) filtro.gestionId = req.query.gestionId;
    if (req.query.usuarioId) filtro.usuarioId = req.query.usuarioId;
    const filtroResumen: Record<string, unknown> = { fechaEliminado: null };
    if (req.query.gestionId) filtroResumen.gestionId = req.query.gestionId;
    const [preregistros, total, estados, gestionResumen] = await Promise.all([
      Preregistro.find(filtro).populate(populate).sort({ fechaRegistro: -1 }).skip((pagina - 1) * limite).limit(limite).maxTimeMS(12000),
      Preregistro.countDocuments(filtro),
      Preregistro.aggregate([{ $match: filtroResumen }, { $group: { _id: "$estado", total: { $sum: 1 } } }]).option({ maxTimeMS: 12000 }),
      req.query.gestionId ? Gestion.findById(req.query.gestionId) : gestionDisponible(),
    ]);
    let cupos = null;
    if (gestionResumen) {
      const aprobados = await Preregistro.find({ gestionId: gestionResumen._id, estado: "APROBADO", fechaEliminado: null }).populate<{ usuarioId: { sexo?: string } }>("usuarioId", "sexo");
      const hombres = aprobados.filter((p) => grupoSexo(p.usuarioId?.sexo) === "HOMBRE").length;
      const mujeres = aprobados.filter((p) => grupoSexo(p.usuarioId?.sexo) === "MUJER").length;
      cupos = { hombres, mujeres, maximoHombres: gestionResumen.cupoMaximoHombres, maximoMujeres: gestionResumen.cupoMaximoMujeres, total: hombres + mujeres, maximoTotal: gestionResumen.cupoMaximo };
    }
    const relacionesGuia = await PostulanteGuia.find({ preregistroId: { $in: preregistros.map((item) => item._id) }, fechaEliminado: null }).select("preregistroId estado habilitado puntajeTotal").lean();
    const guiaPorPreregistro = new Map(relacionesGuia.map((item) => [String(item.preregistroId), item]));
    const preregistrosConGuia = preregistros.map((item) => ({ ...item.toObject(), postulanteGuia: guiaPorPreregistro.get(String(item._id)) ?? null }));
    return res.json({ preregistros: preregistrosConGuia, paginacion: { pagina, limite, total, paginas: Math.ceil(total / limite) }, resumen: Object.fromEntries(estados.map((item) => [item._id, item.total])), cupos });
  } catch (causa) { return error(res, causa, "Error al obtener los preregistros"); }
};

export const obtenerMisPreregistros = async (req: Request, res: Response) => {
  try {
    const usuarioId = req.usuario?._id;
    if (!usuarioId) return res.status(401).json({ error: "Usuario no autenticado" });

    const filtro = {
      usuarioId,
    };

    const [preregistros, total] = await Promise.all([
      Preregistro.find(filtro)
        .populate(populate)
        .sort({ fechaRegistro: -1 }),
      Preregistro.countDocuments(filtro),
    ]);
    const fraternos = await Fraterno.find({
      preregistroId: { $in: preregistros.map((item) => item._id) },
      fechaEliminado: null,
    }).select("preregistroId numeroFraterno estado fechaIngreso").lean();
    const fraternoPorPreregistro = new Map(fraternos.map((item) => [String(item.preregistroId), item]));
    const preregistrosConCalidad = preregistros.map((item) => ({
      ...item.toObject(),
      fraterno: fraternoPorPreregistro.get(String(item._id)) ?? null,
    }));

    return res.json({
      preregistros: preregistrosConCalidad,
      paginacion: {
        pagina: 1,
        limite: Math.max(total, 1),
        total,
        paginas: total > 0 ? 1 : 0,
      },
      resumen: preregistros.reduce<Record<string, number>>((acumulado, item) => {
        acumulado[item.estado] = (acumulado[item.estado] ?? 0) + 1;
        return acumulado;
      }, {}),
      cupos: null,
    });
  } catch (causa) {
    return error(res, causa, "Error al obtener los preregistros del usuario autenticado");
  }
};

export const obtenerPreregistroPorId = async (req: Request, res: Response) => {
  try {
    const preregistro = await Preregistro.findOne({ _id: req.params.id, fechaEliminado: null }).populate(populate);
    if (!preregistro) return res.status(404).json({ error: "Preregistro no encontrado" });
    const postulanteGuia = await PostulanteGuia.findOne({ preregistroId: preregistro._id, fechaEliminado: null }).select("estado habilitado puntajeTotal").lean();
    return res.json({ preregistro: { ...preregistro.toObject(), postulanteGuia } });
  } catch (causa) { return error(res, causa, "Error al obtener el preregistro"); }
};

export const actualizarPreregistro = async (req: Request, res: Response) => {
  try {
    if (["OBSERVADO", "RECHAZADO", "LISTA_ESPERA", "CANCELADO"].includes(req.body.estado) && !String(req.body.observacion ?? "").trim()) {
      return res.status(400).json({ error: "Debe registrar una observación o motivo para el estado seleccionado" });
    }
    const permitido = ["estado", "aceptoReglamento", "examen1", "examen2", "examen3", "examen4", "examen5", "examen6", "puntajeTotal", "observacion"];
    const preregistro = await Preregistro.findOne({ _id: req.params.id, fechaEliminado: null });
    if (!preregistro) return res.status(404).json({ error: "Preregistro no encontrado" });
    if (req.body.estado === "APROBADO" && preregistro.estado !== "APROBADO") {
      const [gestion, usuario] = await Promise.all([Gestion.findById(preregistro.gestionId), PerfilUsuario.findById(preregistro.usuarioId)]);
      if (!gestion || !usuario) return res.status(409).json({ error: "No se pudo verificar la gestión o el usuario" });
      const capacidad = await verificarCupoPorSexo(gestion, usuario, preregistro._id);
      if (!capacidad.disponible) return res.status(409).json({ error: `No hay cupo disponible para ${capacidad.grupo.toLowerCase()}s (${capacidad.ocupados}/${capacidad.maximo}). Seleccione LISTA_ESPERA.` });
    }
    for (const campo of permitido) if (req.body[campo] !== undefined) preregistro.set(campo, req.body[campo]);
    if (req.body.estado !== undefined || req.body.observacion !== undefined) {
      preregistro.fechaRevision = new Date();
      preregistro.usuarioRevisor = req.usuario?._id;
    }
    if (req.body.estado === "APROBADO" && preregistro.estado !== "APROBADO") {
      preregistro.fechaAprobacion = new Date();
      preregistro.usuarioAprobador = req.usuario?._id;
    }
    preregistro.fechaEditado = new Date();
    preregistro.usuarioEditor = req.usuario?._id;
    await preregistro.save();
    await preregistro.populate(populate);
    return res.json({ message: "Preregistro actualizado correctamente", preregistro });
  } catch (causa) { return error(res, causa, "Error al actualizar el preregistro"); }
};

export const eliminarPreregistro = async (req: Request, res: Response) => {
  try {
    const preregistro = await Preregistro.findOneAndUpdate(
      { _id: req.params.id, fechaEliminado: null },
      { estado: "CANCELADO" as EstadoPreregistro, fechaEliminado: new Date(), usuarioEliminador: req.usuario?._id },
      { new: true },
    );
    if (!preregistro) return res.status(404).json({ error: "Preregistro no encontrado" });
    return res.json({ message: "Preregistro eliminado correctamente" });
  } catch (causa) { return error(res, causa, "Error al eliminar el preregistro"); }
};
