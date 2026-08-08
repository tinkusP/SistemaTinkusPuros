import type { Request, Response } from "express";
import Cuota from "../models/Cuota";
import Fraterno from "../models/Fraterno";
import PerfilUsuario from "../models/PerfilUsuario";
import Preregistro from "../models/Preregistro";
import Traspaso from "../models/Traspaso";
import { registrarAuditoria } from "../services/AuditoriaService";

const poblar = [
  { path: "preregistroId", select: "numeroPreRegistro estado gestionId" },
  { path: "usuarioOrigenId", select: "nombres apellidoPaterno apellidoMaterno ci email" },
  { path: "usuarioDestinoId", select: "nombres apellidoPaterno apellidoMaterno ci email" },
  { path: "usuarioResolutor", select: "nombres apellidoPaterno" },
];

export async function listarTraspasos(_req: Request, res: Response) {
  res.json({ traspasos: await Traspaso.find().populate(poblar).sort({ fechaSolicitud: -1 }) });
}

export async function traspasarCupo(req: Request, res: Response) {
  const preregistro = await Preregistro.findOne({ _id: req.body.preregistroId, fechaEliminado: null });
  if (!preregistro) return res.status(404).json({ error: "Preregistro no encontrado" });
  if (await Fraterno.exists({ preregistroId: preregistro._id, estado: "ACTIVO" })) return res.status(409).json({ error: "El cupo ya fue convertido en fraterno y no puede traspasarse" });
  const destino = await PerfilUsuario.findOne({ _id: req.body.usuarioDestinoId, fechaEliminado: null, estado: { $ne: "ELIMINADO" } });
  if (!destino) return res.status(404).json({ error: "Usuario destino no encontrado" });
  if (String(preregistro.usuarioId) === String(destino._id)) return res.status(409).json({ error: "El usuario destino ya es titular del preregistro" });
  if (await Preregistro.exists({ usuarioId: destino._id, gestionId: preregistro.gestionId, fechaEliminado: null, _id: { $ne: preregistro._id } })) return res.status(409).json({ error: "El usuario destino ya tiene un preregistro en esta gestión" });

  const cuota = await Cuota.findOne({ preregistroId: preregistro._id, fechaEliminado: null });
  const origen = preregistro.usuarioId;
  const traspaso = await Traspaso.create({
    preregistroId: preregistro._id,
    usuarioOrigenId: origen,
    usuarioDestinoId: destino._id,
    cuotaId: cuota?._id,
    montoTotalCuota: cuota?.montoTotal ?? 0,
    montoPagadoAlTraspaso: cuota?.montoPagado ?? 0,
    saldoAlTraspaso: cuota?.saldo ?? 0,
    motivo: req.body.motivo,
    observacion: req.body.observacion,
    estado: "APROBADO",
    fechaResolucion: new Date(),
    usuarioResolutor: req.usuario?._id,
    usuarioCreador: req.usuario?._id,
  });
  preregistro.usuarioId = destino._id;
  preregistro.fechaEditado = new Date();
  preregistro.usuarioEditor = req.usuario?._id;
  await preregistro.save();
  await registrarAuditoria(req, { accion: "TRASPASAR_CUPO", modulo: "TRASPASOS", entidad: "Preregistro", entidadId: preregistro._id, descripcion: "Se traspasó el titular del preregistro conservando cuota, pagos y proceso", datosAntes: { usuarioId: origen }, datosDespues: { usuarioId: destino._id, traspasoId: traspaso._id } });
  await traspaso.populate(poblar);
  return res.status(201).json({ message: "Cupo traspasado correctamente", traspaso });
}
