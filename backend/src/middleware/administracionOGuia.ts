import type {NextFunction,Request,Response} from "express";
import Preregistro from "../models/Preregistro";
import PostulanteGuia from "../models/PostulanteGuia";

export async function puedePublicarFormacion(req:Request){
  const roles=req.usuario?.roles as unknown as {codigo?:string;nombre?:string}[]|undefined;
  const autorizadoPorRol=roles?.some(r=>[r.codigo,r.nombre].some(v=>["ADMINISTRADOR","ADMIN","GUIA","GUÍA"].includes(String(v??"").trim().toUpperCase())));
  if(autorizadoPorRol)return true;
  const preregistros=await Preregistro.find({usuarioId:req.usuario?._id,fechaEliminado:null}).distinct("_id");
  return Boolean(await PostulanteGuia.exists({preregistroId:{$in:preregistros},habilitado:true,fechaEliminado:null}));
}

export async function administracionOGuia(req:Request,res:Response,next:NextFunction){
  if(!await puedePublicarFormacion(req)){res.status(403).json({error:"Solo administradores, guías y postulantes a guía pueden publicar"});return;}
  next();
}
