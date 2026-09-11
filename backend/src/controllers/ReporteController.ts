import type { Request, Response } from "express";
import { obtenerReporteIntegrantesBloque } from "../services/ReporteIntegrantesBloqueService";
import Gestion from "../models/Gestion";
import Preregistro from "../models/Preregistro";
import Cuota from "../models/Cuota";
import DetalleCuota from "../models/DetalleCuota";
import Guia from "../models/Guia";
import Bloque from "../models/Bloque";
import Fraterno from "../models/Fraterno";
import EntregaIndumentaria from "../models/EntregaIndumentaria";
import Asistencia from "../models/Asistencia";
import { LIMITES_BLOQUE } from "../services/BloqueService";
import { generarReporteTallasPrimeraCuota } from "../services/ReporteTallasPrimeraCuotaService";

const genero=(sexo?:string)=>["HOMBRE","MASCULINO","M"].includes(String(sexo??"").toUpperCase())?"HOMBRE":["MUJER","FEMENINO","F"].includes(String(sexo??"").toUpperCase())?"MUJER":"SIN REGISTRO";

export async function reporteEjecutivo(req:Request,res:Response){
 const gestion=req.query.gestionId?await Gestion.findById(req.query.gestionId):await Gestion.findOne({estado:{$in:["ACTIVA","INSCRIPCIONES"]},fechaEliminado:null}).sort({anio:-1});
 if(!gestion)return res.status(404).json({error:"No existe una gestión para generar reportes"});
 const preregistros=await Preregistro.find({gestionId:gestion._id,fechaEliminado:null}).populate("usuarioId","nombres apellidoPaterno apellidoMaterno ci telefono sexo facultad carrera tipoOrigen estado fotoPerfil email").lean();
 const ids=preregistros.map(p=>p._id),cuotas=await Cuota.find({preregistroId:{$in:ids},fechaEliminado:null}).lean(),pagos=await DetalleCuota.find({cuotaId:{$in:cuotas.map(c=>c._id)},estadoRevision:"VERIFICADO",fechaEliminado:null}).sort({numeroPago:1}).lean();
 const cuotaPorPre=new Map(cuotas.map(c=>[String(c.preregistroId),c])),pagosPorCuota=new Map<string,typeof pagos>();
 for(const p of pagos){const clave=String(p.cuotaId);pagosPorCuota.set(clave,[...(pagosPorCuota.get(clave)||[]),p]);}
 const personas=preregistros.map(p=>{const u=p.usuarioId as any,c=cuotaPorPre.get(String(p._id)),ps=c?pagosPorCuota.get(String(c._id))||[]:[];let clasificacion="SIN_CUOTA";if(c){if(!ps.length)clasificacion="SIN_PAGO";else if(c.estado==="PAGADA"&&ps.length===1&&ps[0].metodoPago==="QR")clasificacion="TOTAL_UN_SOLO_QR";else if(c.estado==="PAGADA")clasificacion="PAGADO_TOTAL";else if(ps.length===1)clasificacion="PRIMERA_CUOTA";else clasificacion="SEGUNDA_CUOTA";}return{usuarioId:u?._id,preregistroId:p._id,nombres:u?.nombres,apellidoPaterno:u?.apellidoPaterno,apellidoMaterno:u?.apellidoMaterno,nombre:[u?.nombres,u?.apellidoPaterno,u?.apellidoMaterno].filter(Boolean).join(" "),ci:u?.ci,telefono:u?.telefono,email:u?.email,genero:genero(u?.sexo),facultad:u?.facultad||"SIN FACULTAD",carrera:u?.carrera||"SIN CARRERA",origen:u?.tipoOrigen||"SIN ORIGEN",estadoUsuario:u?.estado,estadoPreregistro:p.estado,fotoPerfil:u?.fotoPerfil,cuota:{clasificacion,montoTotal:c?.montoTotal||0,montoPagado:c?.montoPagado||0,saldo:c?.saldo||0,cantidadPagos:ps.length}}});
 const agrupar=(campo:"genero"|"facultad"|"carrera"|"origen"|"estadoPreregistro")=>Object.entries(personas.reduce<Record<string,number>>((a,p)=>(a[p[campo]||"SIN REGISTRO"]=(a[p[campo]||"SIN REGISTRO"]||0)+1,a),{})).map(([nombre,total])=>({nombre,total})).sort((a,b)=>b.total-a.total);
 const[guias,fraternos,bloques,entregas,asistencias]=await Promise.all([Guia.countDocuments({gestionId:gestion._id,estado:"ACTIVO"}),Fraterno.countDocuments({gestionId:gestion._id,estado:"ACTIVO",fechaEliminado:null}),Bloque.countDocuments({gestionId:gestion._id}),EntregaIndumentaria.countDocuments({estado:"ENTREGADO"}),Asistencia.countDocuments({gestionId:gestion._id,estado:"PRESENTE"})]);
 const finanzas={montoEsperado:cuotas.reduce((s,c)=>s+c.montoTotal,0),montoCobrado:cuotas.reduce((s,c)=>s+c.montoPagado,0),saldoPendiente:cuotas.reduce((s,c)=>s+c.saldo,0),sinPago:personas.filter(p=>p.cuota.clasificacion==="SIN_PAGO").length,primeraCuota:personas.filter(p=>p.cuota.clasificacion==="PRIMERA_CUOTA").length,segundaCuota:personas.filter(p=>p.cuota.clasificacion==="SEGUNDA_CUOTA").length,totalUnQr:personas.filter(p=>p.cuota.clasificacion==="TOTAL_UN_SOLO_QR").length,pagadoTotal:personas.filter(p=>["TOTAL_UN_SOLO_QR","PAGADO_TOTAL"].includes(p.cuota.clasificacion)).length};
 return res.json({generadoEn:new Date(),gestion:{_id:gestion._id,nombre:gestion.nombre,anio:gestion.anio},resumen:{total:personas.length,hombres:personas.filter(p=>p.genero==="HOMBRE").length,mujeres:personas.filter(p=>p.genero==="MUJER").length,pendientes:personas.filter(p=>p.estadoPreregistro==="PENDIENTE").length,aprobados:personas.filter(p=>p.estadoPreregistro==="APROBADO").length,fraternos,guias,bloques,capacidadBloques:bloques*LIMITES_BLOQUE.TOTAL,entregas,asistencias},finanzas,distribuciones:{genero:agrupar("genero"),facultad:agrupar("facultad"),carrera:agrupar("carrera"),origen:agrupar("origen"),estadoPreregistro:agrupar("estadoPreregistro")},personas});
}

export async function reporteTallasPrimeraCuota(req: Request, res: Response) {
 const reporte = await generarReporteTallasPrimeraCuota(req.query.gestionId ? String(req.query.gestionId) : undefined);
 if (!reporte) return res.status(404).json({ error: "No existe una gestión para generar el reporte" });
 return res.json(reporte);
}

export async function reporteIntegrantesPorMatricula(req: Request, res: Response) {
 const reporte = await obtenerReporteIntegrantesBloque(req.query.gestionId ? String(req.query.gestionId) : undefined);
 if (!reporte.gestion) return res.status(404).json({ error: "No existen bloques activos para generar el reporte" });
 return res.json(reporte);
}
