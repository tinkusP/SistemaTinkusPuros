import type { Request, Response } from "express";
import Preregistro from "../models/Preregistro";
import { registrarAuditoria } from "../services/AuditoriaService";
import { sincronizarCuotaPreregistro } from "../services/SincronizacionCuotaService";

export async function habilitarCuotasMasivas(req: Request, res: Response) {
  try {
    const tarifaInterno = Number(req.body.tarifaInterno ?? 750);
    const tarifaExterno = Number(req.body.tarifaExterno ?? 850);
    const fechaVencimiento = req.body.fechaVencimiento || undefined;
    if (tarifaInterno <= 0 || tarifaExterno <= 0) return res.status(400).json({ error: "Las tarifas deben ser mayores a cero" });
    const preregistros = await Preregistro.find({ fechaEliminado: null, estado: "APROBADO", aprobado: true }).select("_id");
    const resultados = await Promise.all(preregistros.map((preregistro) => sincronizarCuotaPreregistro(preregistro._id, { crearSiFalta: true, usuarioCreador: req.usuario?._id, tarifaInterno, tarifaExterno, fechaVencimiento: fechaVencimiento ? new Date(fechaVencimiento) : undefined })));
    const validos = resultados.filter(Boolean);
    const creadas = validos.filter((resultado) => resultado?.creada).length;
    const actualizadas = validos.filter((resultado) => resultado?.actualizada).length;
    const yaExistentes = validos.length - creadas;
    await registrarAuditoria(req, { accion: "SINCRONIZAR_MASIVO", modulo: "CUOTAS", entidad: "Cuota", descripcion: `Se vincularon ${creadas} cuotas y se sincronizaron ${actualizadas} tarifas sin alterar pagos ni bauchers`, datosDespues: { creadas, actualizadas, yaExistentes, tarifaInterno, tarifaExterno } });
    return res.json({ message: "Vinculación y sincronización masiva completada", creadas, actualizadas, yaExistentes, totalEvaluados: preregistros.length, tarifas: { INTERNO: tarifaInterno, EXTERNO: tarifaExterno } });
  } catch (error) { console.error("Error habilitando cuotas masivas", error); return res.status(500).json({ error: "No se pudieron habilitar las cuotas masivamente" }); }
}
