import type { Request, Response } from "express";
import Cuota from "../models/Cuota";
import ExencionPagoUsuario from "../models/ExencionPagoUsuario";
import Gestion from "../models/Gestion";
import PerfilUsuario from "../models/PerfilUsuario";
import Preregistro from "../models/Preregistro";
import { registrarAuditoria } from "../services/AuditoriaService";
import { obtenerUsuariosSelectorExenciones } from "../services/SelectorExencionesService";

async function gestionActual() {
  return Gestion.findOne({ estado: { $in: ["ACTIVA", "INSCRIPCIONES"] }, fechaEliminado: null }).sort({ anio: -1 }).select("_id nombre anio").lean();
}

export const listarUsuariosExencion = async (_req: Request, res: Response) => {
  return res.json(await obtenerUsuariosSelectorExenciones());
};

export const actualizarExencionUsuarioSinCuota = async (req: Request, res: Response) => {
  const gestion = await gestionActual();
  if (!gestion) return res.status(409).json({ error: "No existe una gestión activa" });
  const usuario = await PerfilUsuario.findOne({ _id: req.params.usuarioId, estado: "ACTIVO", fechaEliminado: null }).select("nombres apellidoPaterno apellidoMaterno ci").lean();
  if (!usuario) return res.status(404).json({ error: "Usuario activo no encontrado" });

  const preregistros = await Preregistro.find({ usuarioId: usuario._id, gestionId: gestion._id, fechaEliminado: null }).select("_id").lean();
  const cuota = await Cuota.findOne({ preregistroId: { $in: preregistros.map((preregistro) => preregistro._id) }, fechaEliminado: null }).select("_id").lean();
  if (cuota) return res.status(409).json({ error: "El usuario ya tiene cuota. Actualiza la exención desde su cuota vigente." });

  const exentoPago = Boolean(req.body.exentoPago);
  const categoria = String(req.body.categoria ?? "").trim().toUpperCase();
  const descripcion = String(req.body.descripcion ?? "").trim();
  if (exentoPago && !categoria) return res.status(400).json({ error: "Selecciona el motivo de la exención" });
  if (exentoPago && categoria === "OTRO" && descripcion.length < 3) return res.status(400).json({ error: "Describe el motivo de la exención" });

  const anterior: any = await ExencionPagoUsuario.findOne({ usuarioId: usuario._id, gestionId: gestion._id }).lean();
  let exencion: any;
  if (exentoPago) {
    exencion = await ExencionPagoUsuario.findOneAndUpdate(
      { usuarioId: usuario._id, gestionId: gestion._id },
      {
        $set: { activa: true, categoria, descripcion, usuarioAdministrador: req.usuario?._id, fechaRegistro: new Date(), fechaEditado: new Date(), usuarioEditor: req.usuario?._id },
        $setOnInsert: { usuarioId: usuario._id, gestionId: gestion._id },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  } else {
    exencion = await ExencionPagoUsuario.findOneAndUpdate(
      { usuarioId: usuario._id, gestionId: gestion._id },
      { $set: { activa: false, fechaEditado: new Date(), usuarioEditor: req.usuario?._id } },
      { new: true },
    );
  }

  const nombre = [usuario.nombres, usuario.apellidoPaterno, usuario.apellidoMaterno].filter(Boolean).join(" ");
  await registrarAuditoria(req, {
    accion: exentoPago ? "MARCAR_EXENTO_SIN_CUOTA" : "RETIRAR_EXENCION_SIN_CUOTA",
    modulo: "CUOTAS",
    entidad: "ExencionPagoUsuario",
    entidadId: exencion?._id,
    descripcion: exentoPago ? `Exención administrativa sin cuota para ${nombre}: ${categoria}` : `Se retiró la exención administrativa sin cuota de ${nombre}`,
    datosAntes: anterior,
    datosDespues: exencion?.toObject?.() ?? exencion,
  });
  return res.json({
    message: exentoPago ? "Exención administrativa registrada. No altera cálculos mientras el usuario no tenga cuota." : "Exención administrativa retirada",
    exencion,
  });
};
