
import type {
  Request,
  Response,
  NextFunction,
} from "express";

import jwt from "jsonwebtoken";

import PerfilUsuario, {
  type PerfilUsuarioType,
} from "../models/PerfilUsuario";

declare global {
  namespace Express {
    interface Request {
      usuario?: PerfilUsuarioType;
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