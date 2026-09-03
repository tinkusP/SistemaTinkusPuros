
import type {
  Request,
  Response,
  NextFunction,
} from "express";

import jwt from "jsonwebtoken";

import PerfilUsuario, {
  type PerfilUsuarioType,
} from "../models/PerfilUsuario";
import Fraterno from "../models/Fraterno";
import Guia from "../models/Guia";
import { esMetodoPermitidoEnCapacitacion } from "../services/CapacitacionService";

declare global {
  namespace Express {
    interface Request {
      usuario?: PerfilUsuarioType;
      usuarioAdministradorReal?: PerfilUsuarioType;
      modoCapacitacion?: boolean;
      tipoCapacitacion?: "GUIA" | "FRATERNO";
    }
  }
}

type JwtPayloadUsuario = {
  id: string;
  name: string;
  iat?: number;
  exp?: number;
};

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const authorization =
    req.headers.authorization;

  if (
    !authorization ||
    !authorization.startsWith("Bearer ")
  ) {
    res.status(401).json({
      error: "No autorizado",
    });
    return;
  }

  const token =
    authorization.split(" ")[1];

  if (!token) {
    res.status(401).json({
      error: "Token no proporcionado",
    });
    return;
  }

  const jwtSecret =
    process.env.JWT_SECRET;

  if (!jwtSecret) {
    res.status(500).json({
      error:
        "JWT_SECRET no está configurado",
    });
    return;
  }

  try {
    const decoded = jwt.verify(
      token,
      jwtSecret,
    ) as JwtPayloadUsuario;

    if (!decoded.id) {
      res.status(401).json({
        error:
          "El token no contiene un usuario válido",
      });
      return;
    }

    const usuario =
      await PerfilUsuario.findOne({
        _id: decoded.id,
        fechaEliminado: null,
      })
        .select("-password")
        .populate("roles");

    if (!usuario) {
      res.status(401).json({
        error:
          "Usuario no encontrado o eliminado",
      });
      return;
    }

    if (
      usuario.estado === "ELIMINADO" ||
      usuario.estado === "INACTIVO"
    ) {
      res.status(403).json({
        error:
          "La cuenta no está activa",
      });
      return;
    }

    const objetivoCapacitacion = String(req.headers["x-modo-capacitacion-usuario"] ?? "").trim();
    if (objetivoCapacitacion) {
      const tipoCapacitacion = String(req.headers["x-modo-capacitacion-tipo"] ?? "").toUpperCase();
      const roles = usuario.roles as unknown as { codigo?: string; nombre?: string }[];
      const esAdministrador = roles.some((rol) => [rol.codigo, rol.nombre].some((valor) => ["ADMIN", "ADMINISTRADOR", "SUPERADMIN", "SUPERADMINISTRADOR"].includes(String(valor ?? "").trim().toUpperCase().replace(/[\s_-]/g, ""))));
      if (!esAdministrador) {
        res.status(403).json({ error: "Solo un administrador puede utilizar el modo capacitación" });
        return;
      }
      if (!esMetodoPermitidoEnCapacitacion(req.method)) {
        res.status(403).json({ error: "Disponible únicamente fuera del modo capacitación." });
        return;
      }
      const [esFraterno, esGuia, objetivo] = await Promise.all([
        Fraterno.exists({ usuarioId: objetivoCapacitacion, estado: "ACTIVO", fechaEliminado: null }),
        Guia.exists({ usuarioId: objetivoCapacitacion, estado: "ACTIVO" }),
        PerfilUsuario.findOne({ _id: objetivoCapacitacion, estado: "ACTIVO", fechaEliminado: null }).select("-password").populate("roles"),
      ]);
      if (!(["GUIA", "FRATERNO"].includes(tipoCapacitacion)) || (tipoCapacitacion === "GUIA" ? !esGuia : !esFraterno) || !objetivo) {
        res.status(404).json({ error: "El usuario seleccionado no está disponible para capacitación" });
        return;
      }
      objetivo.roles = (objetivo.roles as unknown as { codigo?: string }[]).filter((rol) => String(rol.codigo ?? "").toUpperCase() === tipoCapacitacion) as never;
      req.usuarioAdministradorReal = usuario;
      req.usuario = objetivo;
      req.modoCapacitacion = true;
      req.tipoCapacitacion = tipoCapacitacion as "GUIA" | "FRATERNO";
      res.setHeader("Cache-Control", "private, no-store");
      next();
      return;
    }

    req.usuario = usuario;

    next();
  } catch (error) {
    console.error(
      "Error al verificar JWT:",
      error,
    );

    if (
      error instanceof jwt.TokenExpiredError
    ) {
      res.status(401).json({
        error: "Token vencido",
      });
      return;
    }

    res.status(401).json({
      error: "Token no válido",
    });
  }
};
