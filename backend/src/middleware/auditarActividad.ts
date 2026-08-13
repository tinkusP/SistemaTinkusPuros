import type { NextFunction, Request, Response } from "express";
import { registrarAuditoria } from "../services/AuditoriaService";

export function auditarActividad(req: Request, res: Response, next: NextFunction) {
  const esMutacion = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);
  const esRutaAuditoria = req.originalUrl.includes("/auditoria/");
  res.on("finish", () => {
    const modulo = req.originalUrl.split("?")[0].split("/").filter(Boolean)[1]?.toUpperCase() || "SISTEMA";
    if (res.statusCode >= 400 && !esRutaAuditoria) {
      const identificadorIntentado = req.originalUrl.endsWith("/login") ? String(req.body?.email ?? "").trim().toLowerCase().slice(0, 200) : "";
      void registrarAuditoria(req, {
        accion: "ERROR_HTTP",
        modulo,
        descripcion: `${req.method} ${req.originalUrl.split("?")[0]} respondió con error ${res.statusCode}${identificadorIntentado ? ` para ${identificadorIntentado}` : ""}`,
        datosDespues: { estadoHttp: res.statusCode, ...(identificadorIntentado ? { emailIntentado: identificadorIntentado } : {}) },
      });
      return;
    }
    if (esMutacion && !esRutaAuditoria && !req.originalUrl.endsWith("/login") && req.usuario?._id) {
        void registrarAuditoria(req, {
          accion: req.method === "POST" ? "CREAR" : req.method === "DELETE" ? "ELIMINAR" : "ACTUALIZAR",
          modulo,
          descripcion: `${req.method} ${req.originalUrl} finalizó con estado ${res.statusCode}`,
        });
    }
  });
  next();
}
