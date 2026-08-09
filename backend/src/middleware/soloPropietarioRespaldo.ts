import type { NextFunction, Request, Response } from "express";

const CORREO_PROPIETARIO = "devdjcod@gmail.com";

export function soloPropietarioRespaldo(req: Request, res: Response, next: NextFunction): void {
  const email = String(req.usuario?.email ?? "").trim().toLowerCase();
  const roles = req.usuario?.roles as unknown as Array<{ codigo?: string; nombre?: string }> | undefined;
  const esAdministrador = roles?.some((rol) =>
    [rol.codigo, rol.nombre].some((valor) =>
      ["ADMIN", "ADMINISTRADOR", "SUPERADMIN", "SUPERADMINISTRADOR"].includes(
        String(valor ?? "").toUpperCase().replace(/[\s_-]/g, ""),
      ),
    ),
  );

  if (!esAdministrador || email !== CORREO_PROPIETARIO) {
    res.status(403).json({ error: "Solo el administrador propietario puede gestionar respaldos completos" });
    return;
  }
  next();
}
