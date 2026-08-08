import type {NextFunction,Request,Response}from"express";

function permisoNecesario(req:Request){
  const base=req.baseUrl,metodo=req.method,path=req.path;
  if(base.includes("perfilusuario")){if(metodo==="GET")return"USUARIOS_VER";if(metodo==="DELETE")return"USUARIOS_ELIMINAR";if(path.includes("password"))return"USUARIOS_RESTABLECER_PASSWORD";return"USUARIOS_EDITAR";}
  if(base.endsWith("/rol")){if(metodo==="GET")return"ROLES_VER";if(metodo==="POST")return"ROLES_CREAR";if(metodo==="DELETE")return"ROLES_ELIMINAR";return"ROLES_EDITAR";}
  if(base.includes("gestiones")){if(metodo==="GET")return"GESTIONES_VER";if(metodo==="POST")return"GESTIONES_CREAR";if(metodo==="DELETE")return"GESTIONES_ELIMINAR";return"GESTIONES_EDITAR";}
  if(base.includes("preregistros")){if(metodo==="GET")return"PREREGISTROS_VER";if(metodo==="DELETE")return"PREREGISTROS_ELIMINAR";return"PREREGISTROS_EDITAR";}
  if(base.includes("postulantes-guia")||base.includes("guias"))return"GUIAS_GESTIONAR";
  if(base.includes("indumentaria"))return"INDUMENTARIA_GESTIONAR";
  if(base.includes("facultades"))return"VISTA_FACULTADES";
  if(base.includes("configuracion-pagos"))return"PAGOS_REVISAR";
  if(base.includes("comunicacion")){if(path.includes("auditoria"))return"AUDITORIA_VER";return"ANUNCIOS_GESTIONAR";}
  if(base.includes("asistencias"))return"VISTA_ASISTENCIAS";
  if(base.includes("fraternos"))return"VISTA_FRATERNOS";
  if(base.includes("traspasos"))return"VISTA_TRASPASOS";
  if(base.includes("credenciales-qr"))return"USUARIOS_VER";
  if(base.includes("reportes"))return"VISTA_REPORTES";
  if(base.includes("tokens-registro"))return"TOKENS_GESTIONAR";
  return null;
}

export function soloAdministracion(req:Request,res:Response,next:NextFunction){
  const roles=req.usuario?.roles as unknown as{codigo?:string;nombre?:string;permisos?:string[]}[]|undefined;
  const administrador=roles?.some(rol=>[rol.codigo,rol.nombre].some(valor=>["ADMINISTRADOR","ADMIN","SUPERADMIN","SUPERADMINISTRADOR"].includes(String(valor??"").toUpperCase().replace(/[\s_-]/g,""))));
  const requerido=permisoNecesario(req);
  const autorizado=administrador||Boolean(requerido&&roles?.some(rol=>rol.permisos?.includes(requerido)));
  if(!autorizado){res.status(403).json({error:"No tienes permiso para realizar esta operación",permisoRequerido:requerido});return;}
  next();
}
