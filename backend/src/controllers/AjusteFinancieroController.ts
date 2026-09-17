import type { Request, Response } from "express";
import AjusteFinanciero from "../models/AjusteFinanciero";
import Cuota from "../models/Cuota";
import Gestion from "../models/Gestion";
import PerfilUsuario from "../models/PerfilUsuario";
import Preregistro from "../models/Preregistro";
import { registrarAuditoria } from "../services/AuditoriaService";

const dinero = (valor: unknown) => Number((Number(valor) || 0).toFixed(2));

async function obtenerGestionActual() {
  return Gestion.findOne({ estado: { $in: ["ACTIVA", "INSCRIPCIONES"] }, fechaEliminado: null }).sort({ anio: -1 }).select("_id nombre anio").lean();
}

export const registrarAjusteFinanciero = async (req: Request, res: Response) => {
  const gestion = await obtenerGestionActual();
  if (!gestion) return res.status(409).json({ error: "No existe una gestión activa" });
  const usuario = await PerfilUsuario.findOne({ _id: req.params.usuarioId, estado: "ACTIVO", fechaEliminado: null }).select("nombres apellidoPaterno apellidoMaterno ci").lean();
  if (!usuario) return res.status(404).json({ error: "Usuario activo no encontrado" });
  const preregistros = await Preregistro.find({ usuarioId: usuario._id, gestionId: gestion._id, fechaEliminado: null }).select("_id").lean();
  const cuota: any = await Cuota.findOne({ preregistroId: { $in: preregistros.map((item) => item._id) }, fechaEliminado: null }).select("_id montoTotal").lean();
  if (!cuota) return res.status(409).json({ error: "No existe una cuota vigente para gestionar en esta auditoría" });

  const accion = String(req.body.accion ?? "").trim().toUpperCase();
  const motivo = String(req.body.motivo ?? "").trim();
  const tipoExencion = String(req.body.tipoExencion ?? "").trim().toUpperCase() || undefined;
  const original = dinero(cuota.montoTotal);
  let porcentajeDescuento: number | undefined;
  let montoFinal = original;
  if (accion === "EXCLUIR_CALCULO" || accion === "MARCAR_EXENTO") montoFinal = 0;
  if (accion === "MARCAR_DESCUENTO") {
    porcentajeDescuento = dinero(req.body.porcentajeDescuento);
    if (!(porcentajeDescuento > 0 && porcentajeDescuento < 100)) return res.status(400).json({ error: "El porcentaje de descuento debe ser mayor a 0 y menor a 100" });
    const montoCalculado = dinero(original * (1 - porcentajeDescuento / 100));
    const montoSolicitado = req.body.montoEsperadoFinal === undefined ? montoCalculado : dinero(req.body.montoEsperadoFinal);
    if (Math.abs(montoSolicitado - montoCalculado) > 0.01) return res.status(400).json({ error: "El monto final no coincide con el porcentaje de descuento" });
    montoFinal = montoCalculado;
    if (!(montoFinal >= 0 && montoFinal < original)) return res.status(400).json({ error: "El monto final debe ser menor al monto esperado original" });
  }
  if (accion === "MARCAR_EXENTO" && !tipoExencion) return res.status(400).json({ error: "Selecciona el tipo de exención" });

  const ajuste: any = await AjusteFinanciero.create({
    gestionId: gestion._id,
    usuarioId: usuario._id,
    cuotaId: cuota._id,
    accion,
    motivo,
    tipoExencion: accion === "MARCAR_EXENTO" ? tipoExencion : undefined,
    porcentajeDescuento,
    montoEsperadoOriginal: original,
    montoEsperadoFinal: montoFinal,
    usuarioAdministrador: req.usuario?._id,
  });
  const nombre = [usuario.nombres, usuario.apellidoPaterno, usuario.apellidoMaterno].filter(Boolean).join(" ");
  await registrarAuditoria(req, {
    accion,
    modulo: "CUOTAS",
    entidad: "AjusteFinanciero",
    entidadId: ajuste._id,
    descripcion: `${accion.replaceAll("_", " ")} para ${nombre}. Motivo: ${motivo}`,
    datosDespues: { usuarioId: usuario._id, cuotaId: cuota._id, motivo, tipoExencion, porcentajeDescuento, montoEsperadoOriginal: original, montoEsperadoFinal: montoFinal },
  });
  return res.status(201).json({
    message: accion === "RESTAURAR_CALCULO" ? "Usuario restaurado al cálculo" : "Ajuste financiero registrado",
    ajuste,
  });
};
