import type { NextFunction, Request, Response } from "express";
import { registrarAuditoria } from "../services/AuditoriaService";

export function auditarActividad(req: Request, res: Response, next: NextFunction) {
  const esMutacion = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);
  if (esMutacion && !req.originalUrl.includes("/auditoria/") && !req.originalUrl.endsWith("/login")) {
    res.on("finish", () => {
      if (res.statusCode < 400 && req.usuario?._id) {
        const modulo = req.path.split("/").filter(Boolean)[1]?.toUpperCase() || "SISTEMA";
        void registrarAuditoria(req, {
          accion: req.method === "POST" ? "CREAR" : req.method === "DELETE" ? "ELIMINAR" : "ACTUALIZAR",
          modulo,
          descripcion: `${req.method} ${req.originalUrl} finalizó con estado ${res.statusCode}`,
        });
      }
    });
  }
  next();
}
