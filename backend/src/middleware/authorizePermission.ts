import type {
  NextFunction,
  Request,
  Response,
} from "express";

type RolPoblado = {
  _id: unknown;
  nombre?: string;
  codigo?: string;
  estado?: string;
  permisos?: string[];
};

export const authorizePermission = (
  permisoRequerido: string,
) => {
  return (
    req: Request,
    res: Response,
    next: NextFunction,
  ): void => {
    const usuario = req.usuario;

    if (!usuario) {
      res.status(401).json({
        error: "Usuario no autenticado",
      });

      return;
    }

    const roles =
      usuario.roles as unknown as RolPoblado[];

    if (
      !Array.isArray(roles) ||
      roles.length === 0
    ) {
      res.status(403).json({
        error:
          "El usuario no tiene roles asignados",
      });

      return;
    }

    const tienePermiso = roles.some(
      (rol) => {
        if (
          rol.estado &&
          rol.estado !== "ACTIVO"
        ) {
          return false;
        }

        return (
          Array.isArray(rol.permisos) &&
          rol.permisos.includes(
            permisoRequerido,
          )
        );
      },
    );

    if (!tienePermiso) {
      res.status(403).json({
        error:
          "No tienes permiso para realizar esta acción",
        permisoRequerido,
      });

      return;
    }

    next();
  };
};