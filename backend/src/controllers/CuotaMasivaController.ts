import type { Request, Response } from "express";
import Cuota from "../models/Cuota";
import Preregistro from "../models/Preregistro";
import { registrarAuditoria } from "../services/AuditoriaService";

type UsuarioOrigen = { tipoOrigen?: "INTERNO" | "EXTERNO" | "INTERNO_UMSA" | "EXTERNO_UMSA" | "EXTERNO_NO_UMSA" };

export async function habilitarCuotasMasivas(req: Request, res: Response) {
  try {
    const tarifaInterno = Number(req.body.tarifaInterno ?? 750);
    const tarifaExterno = Number(req.body.tarifaExterno ?? 850);
    const fechaVencimiento = req.body.fechaVencimiento || undefined;
    if (tarifaInterno <= 0 || tarifaExterno <= 0) return res.status(400).json({ error: "Las tarifas deben ser mayores a cero" });
    const preregistros = await Preregistro.find({ fechaEliminado: null, estado: { $nin: ["RECHAZADO", "CANCELADO"] } }).populate("usuarioId", "tipoOrigen");
    const existentes = await Cuota.find({ preregistroId: { $in: preregistros.map((p) => p._id) } }).distinct("preregistroId");
    const existentesSet = new Set(existentes.map(String));
    const nuevos = preregistros.filter((p) => !existentesSet.has(String(p._id)));
    if (nuevos.length) await Cuota.insertMany(nuevos.map((p) => { const usuario = p.usuarioId as unknown as UsuarioOrigen; const tipoOrigenTarifa = ["EXTERNO", "EXTERNO_UMSA", "EXTERNO_NO_UMSA"].includes(String(usuario.tipoOrigen)) ? "EXTERNO" : "INTERNO"; const tarifaAplicada = tipoOrigenTarifa === "EXTERNO" ? tarifaExterno : tarifaInterno; return { preregistroId: p._id, tipoOrigenTarifa, tarifaAplicada, montoTotal: tarifaAplicada, montoPagado: 0, saldo: tarifaAplicada, estado: "PENDIENTE", fechaVencimiento, observacion: `Tarifa ${tipoOrigenTarifa} generada masivamente`, usuarioCreador: req.usuario?._id }; }), { ordered: false });
    const yaExistentes = preregistros.length - nuevos.length;
    await registrarAuditoria(req, { accion: "HABILITAR_MASIVO", modulo: "CUOTAS", entidad: "Cuota", descripcion: `Se generaron ${nuevos.length} cuotas: interno Bs ${tarifaInterno}, externo Bs ${tarifaExterno}`, datosDespues: { creadas: nuevos.length, yaExistentes, tarifaInterno, tarifaExterno } });
    return res.json({ message: "Habilitación masiva completada", creadas: nuevos.length, yaExistentes, totalEvaluados: preregistros.length, tarifas: { INTERNO: tarifaInterno, EXTERNO: tarifaExterno } });
  } catch (error) { console.error("Error habilitando cuotas masivas", error); return res.status(500).json({ error: "No se pudieron habilitar las cuotas masivamente" }); }
}
