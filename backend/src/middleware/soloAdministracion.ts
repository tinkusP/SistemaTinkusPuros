import type { NextFunction, Request, Response } from "express";

type RolAutorizacion = { codigo?: string; nombre?: string; permisos?: string[] };

const normalizar = (valor: unknown) => String(valor ?? "").trim().toUpperCase().replace(/[\s_-]/g, "");
const CODIGOS_ADMIN = new Set(["ADMINISTRADOR", "ADMIN", "SUPERADMIN", "SUPERADMINISTRADOR"]);

export const usuarioEsAdministrador = (req: Request) => {
  const roles = req.usuario?.roles as unknown as RolAutorizacion[] | undefined;
  return Boolean(roles?.some((rol) => [rol.codigo, rol.nombre].some((valor) => CODIGOS_ADMIN.has(normalizar(valor)))));
};

const permisosDelUsuario = (req: Request) => {
  const roles = req.usuario?.roles as unknown as RolAutorizacion[] | undefined;
  return new Set((roles ?? []).flatMap((rol) => rol.permisos ?? []).map((permiso) => permiso.toUpperCase()));
};

function permisosNecesarios(req: Request): string[] {
  const base = req.baseUrl.toLowerCase();
  const metodo = req.method.toUpperCase();
  const ruta = req.path.toLowerCase();
  const lectura = metodo === "GET";

  if (base.includes("perfilusuario")) {
    if (lectura) return ["VISTA_USUARIOS", "USUARIOS_VER"];
    if (metodo === "POST") return ["USUARIOS_CREAR"];
    if (metodo === "DELETE") return ["USUARIOS_ELIMINAR"];
    if (ruta.includes("password")) return ["USUARIOS_RESTABLECER_PASSWORD"];
    if (ruta.includes("estado")) return ["USUARIOS_CAMBIAR_ESTADO"];
    return ["USUARIOS_EDITAR"];
  }
  if (base.endsWith("/rol")) {
    if (lectura) return ["VISTA_ROLES", "ROLES_VER"];
    if (metodo === "POST") return ["ROLES_CREAR"];
    if (metodo === "DELETE") return ["ROLES_ELIMINAR"];
    return ["ROLES_EDITAR"];
  }
  if (base.includes("gestiones")) {
    if (lectura) return ["VISTA_GESTIONES", "GESTIONES_VER"];
    if (metodo === "POST") return ["GESTIONES_CREAR"];
    if (metodo === "DELETE") return ["GESTIONES_ELIMINAR"];
    return ["GESTIONES_EDITAR"];
  }
  if (base.includes("preregistros")) {
    if (lectura) return ["VISTA_PREREGISTROS", "PREREGISTROS_VER"];
    if (metodo === "DELETE") return ["PREREGISTROS_ELIMINAR"];
    return ["PREREGISTROS_EDITAR"];
  }
  if (base.includes("asistencias-postulantes-guia")) return lectura ? ["VISTA_ASISTENCIA_GUIA"] : ["ASISTENCIA_GUIA_GESTIONAR"];
  if (base.includes("postulantes-guia")) return lectura ? ["VISTA_POSTULANTES_GUIA"] : ["GUIAS_GESTIONAR"];
  if (base.includes("guias")) return lectura ? ["VISTA_GUIAS_BLOQUES"] : ruta.includes("bloques") ? ["BLOQUES_SUPERVISAR"] : ["GUIAS_GESTIONAR"];
  if (base.includes("indumentaria")) {
    if (metodo === "PUT" && ruta === "/tallas/usuario") return ["TALLAS_REGISTRAR", "INDUMENTARIA_GESTIONAR"];
    return lectura ? ["VISTA_INDUMENTARIA"] : ["INDUMENTARIA_GESTIONAR"];
  }
  if (base.includes("facultades")) return ["VISTA_FACULTADES"];
  if (base.includes("configuracion-pagos")) return ["PAGOS_CONFIGURAR"];
  if (base.includes("cuotas")) {
    if (lectura) return ["VISTA_PAGOS", "PAGOS_VER"];
    if (ruta.includes("/revision")) return ["PAGOS_REVISAR"];
    return ["PAGOS_GESTIONAR"];
  }
  if (base.includes("comunicacion")) {
    if (ruta.includes("auditoria")) return ["VISTA_AUDITORIA", "AUDITORIA_VER"];
    return lectura ? ["VISTA_ANUNCIOS"] : ["ANUNCIOS_GESTIONAR"];
  }
  if (base.includes("asistencias")) return lectura ? ["VISTA_ASISTENCIAS"] : ["ASISTENCIAS_GESTIONAR"];
  if (base.includes("fraternos")) return lectura ? ["VISTA_FRATERNOS"] : ["FRATERNOS_GESTIONAR"];
  if (base.includes("traspasos")) return lectura ? ["VISTA_TRASPASOS"] : ["TRASPASOS_GESTIONAR"];
  if (base.includes("credenciales-qr")) return ["VISTA_ASISTENCIAS", "ASISTENCIAS_GESTIONAR", "TALLAS_REGISTRAR"];
  if (base.includes("reportes")) return ["VISTA_REPORTES"];
  if (base.includes("tokens-registro")) return lectura ? ["VISTA_TOKENS", "TOKENS_GESTIONAR"] : ["TOKENS_GESTIONAR"];
  return [];
}

export function soloAdministracion(req: Request, res: Response, next: NextFunction) {
  if (usuarioEsAdministrador(req)) return next();
  const requeridos = permisosNecesarios(req);
  const asignados = permisosDelUsuario(req);
  if (requeridos.length > 0 && requeridos.some((permiso) => asignados.has(permiso))) return next();
  res.status(403).json({
    error: "No tienes permiso para realizar esta operación",
    permisosRequeridos: requeridos,
  });
}

export function soloAdministradorReal(req: Request, res: Response, next: NextFunction) {
  if (usuarioEsAdministrador(req)) return next();
  res.status(403).json({ error: "Esta operación solo puede realizarla un administrador" });
}
