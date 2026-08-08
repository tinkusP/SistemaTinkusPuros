import type { Request } from "express";
import Auditoria from "../models/Auditoria";
export async function registrarAuditoria(req: Request, datos: { accion: string; modulo: string; entidad?: string; entidadId?: unknown; descripcion: string; datosAntes?: unknown; datosDespues?: unknown; usuarioId?: unknown }) {
  try {
    await Auditoria.create({ ...datos, usuarioId: datos.usuarioId ?? req.usuario?._id, entidadId: datos.entidadId, metodo: req.method, ruta: req.originalUrl, ip: req.ip, userAgent: req.get("user-agent") });
  } catch (error) { console.error("No se pudo registrar auditoría", error); }
}
