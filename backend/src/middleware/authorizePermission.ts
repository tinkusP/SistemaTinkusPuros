import type {
  NextFunction,
  Request,
  Response,
} from "express";

type RolPoblado = {
  _id: unknown;
  nombre?: string;
  codigo?: string;
  estado?: boolean | string;
  permisos?: string[];
};

export const rolEstaActivo = (estado: RolPoblado["estado"]) =>
  estado !== false && String(estado ?? "ACTIVO").toUpperCase() !== "INACTIVO";

const PERMISOS_BASE_GUIA = new Set([
  "VISTA_MI_BLOQUE_GUIA",
  "VISTA_DIRECTORIO_BLOQUES",
  "BLOQUES_PROPIOS_GESTIONAR",
  "BLOQUES_PROPIOS_EXPORTAR",
]);

export const rolAutorizaPermiso = (rol: RolPoblado, permiso: string) => {
  if (!rolEstaActivo(rol.estado)) return false;
  if (Array.isArray(rol.permisos) && rol.permisos.includes(permiso)) return true;
  return String(rol.codigo ?? "").toUpperCase() === "GUIA" && PERMISOS_BASE_GUIA.has(permiso);
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

    const tienePermiso = roles.some((rol) => rolAutorizaPermiso(rol, permisoRequerido));

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
