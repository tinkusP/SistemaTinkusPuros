import type { Request, Response } from "express";
import mongoose from "mongoose";
import PostulanteGuia from "../models/PostulanteGuia"; import Guia from "../models/Guia"; import Bloque from "../models/Bloque"; import DetalleBloque from "../models/DetalleBloque"; import Cuota from "../models/Cuota";
import Fraterno from "../models/Fraterno";
import PerfilUsuario from "../models/PerfilUsuario";
import Rol from "../models/Rol";
import { registrarAuditoria } from "../services/AuditoriaService";
import DetalleCuota from "../models/DetalleCuota";
import Gestion from "../models/Gestion";
import TallaFraterno from "../models/TallaFraterno";
import { LIMITES_BLOQUE, mensajeCupoCompleto, normalizarGeneroBloque, validarCupoGuia, validarCupoIntegrante, validarNombreBloque } from "../services/BloqueService";
const poblarGuia = [{ path: "usuarioId", select: "nombres apellidoPaterno apellidoMaterno ci sexo telefono fotoPerfil" }, { path: "gestionId", select: "nombre anio" }, { path: "preregistroId", select: "numeroPreRegistro" }];
const normalizarGenero = normalizarGeneroBloque;
export const listarGuias = async (_req: Request, res: Response) => {
  const guias = await Guia.find().populate(poblarGuia);
  const bloques = await Bloque.find().populate({ path: "guiaId", populate: poblarGuia }).populate({ path: "guiasIds", populate: poblarGuia }).sort({ nombre: 1 });
  const detalles = await DetalleBloque.find().populate("bloqueId", "nombre guiasIds guiaId").populate({ path: "fraternoId", populate: [{ path: "usuarioId", select: "nombres apellidoPaterno apellidoMaterno sexo ci email telefono fotoPerfil" }, { path: "preregistroId", select: "numeroPreRegistro" }] });
  const fraternosDocumentos = await Fraterno.find({ estado: "ACTIVO", fechaEliminado: null }).populate({ path: "usuarioId", select: "nombres apellidoPaterno apellidoMaterno sexo ci email telefono fotoPerfil" }).populate("preregistroId", "numeroPreRegistro");
  const [cuotas, tallas] = await Promise.all([Cuota.find({ preregistroId: { $in: fraternosDocumentos.map(f=>f.preregistroId) }, fechaEliminado: null }).lean(), TallaFraterno.find({ fraternoId: { $in: fraternosDocumentos.map(f=>f._id) } }).lean()]);
  const cuotaPorPre = new Map(cuotas.map(c=>[String(c.preregistroId),c])); const tallaPorFraterno=new Map(tallas.map(t=>[String(t.fraternoId),t]));
  const fraternos=fraternosDocumentos.map((f:any)=>({...f.toObject(),cuota:cuotaPorPre.get(String(f.preregistroId?._id??f.preregistroId))??null,talla:tallaPorFraterno.get(String(f._id))??null}));
  res.json({ guias, bloques, detalles, fraternos });
};
export const designarGuia = async (req: Request, res: Response) => { const p = await PostulanteGuia.findOne({ _id: req.body.postulanteGuiaId, estado: "ELEGIDO", fechaEliminado: null }).populate("preregistroId"); if (!p) return res.status(400).json({ error: "Solo un postulante ELEGIDO puede ser guía" }); const pre: any = p.preregistroId; try { const guia = await Guia.create({ postulanteGuiaId: p._id, preregistroId: pre._id, usuarioId: pre.usuarioId, gestionId: pre.gestionId, usuarioCreador: req.usuario?._id }); res.status(201).json({ message: "Guía designado", guia }); } catch { res.status(409).json({ error: "El postulante ya fue designado guía" }); } };
export const decidirPostulante = async (req: Request, res: Response) => {
  const postulante = await PostulanteGuia.findOne({ _id: req.params.id, fechaEliminado: null }).populate("preregistroId");
  if (!postulante) return res.status(404).json({ error: "Postulante a guía no encontrado" });
  const preregistro: any = postulante.preregistroId;
  if (!preregistro) return res.status(404).json({ error: "El postulante no tiene preregistro" });

  if (req.body.decision === "GUIA") {
    const guia = await Guia.findOneAndUpdate(
      { postulanteGuiaId: postulante._id },
      { $setOnInsert: { preregistroId: preregistro._id, usuarioId: preregistro.usuarioId, gestionId: preregistro.gestionId, usuarioCreador: req.usuario?._id } },
      { upsert: true, new: true },
    );
    postulante.estado = "ELEGIDO"; postulante.fechaEleccion = new Date(); postulante.usuarioEvaluador = req.usuario?._id as any; postulante.observacion = req.body.observacion;
    await postulante.save();
    const rol = await Rol.findOneAndUpdate({ codigo: "GUIA" }, { $set: { nombre: "Guía", estado: true, fechaEliminado: null, permisos: ["VISTA_COMUNICADOS", "VISTA_PASOS", "VISTA_CANCIONERO", "VISTA_MI_BLOQUE_GUIA", "BLOQUES_PROPIOS_GESTIONAR", "BLOQUES_PROPIOS_EXPORTAR"] }, $setOnInsert: { codigo: "GUIA", descripcion: "Organiza únicamente el bloque asignado por Administración", esRolSistema: true } }, { upsert: true, new: true });
    await PerfilUsuario.updateOne({ _id: preregistro.usuarioId }, { $addToSet: { roles: rol._id } });
    await registrarAuditoria(req, { accion: "CONVERTIR_EN_GUIA", modulo: "GUIAS", entidad: "PostulanteGuia", entidadId: postulante._id, descripcion: "El postulante fue aprobado y convertido en guía", datosDespues: { estado: postulante.estado, guiaId: guia._id, usuarioId: preregistro.usuarioId } });
    return res.json({ message: "Postulante aprobado como guía", guia });
  }

  let fraterno = await Fraterno.findOne({ preregistroId: preregistro._id });
  if (!fraterno) {
    const correlativo = String((await Fraterno.countDocuments({ gestionId: preregistro.gestionId })) + 1).padStart(4, "0");
    fraterno = await Fraterno.create({ preregistroId: preregistro._id, usuarioId: preregistro.usuarioId, gestionId: preregistro.gestionId, numeroFraterno: `FRA-${new Date().getFullYear()}-${correlativo}`, usuarioCreador: req.usuario?._id });
  }
  postulante.estado = "NO_ELEGIDO"; postulante.fechaEleccion = new Date(); postulante.usuarioEvaluador = req.usuario?._id as any; postulante.observacion = req.body.observacion;
  await postulante.save();
  const rol = await Rol.findOneAndUpdate({ codigo: "FRATERNO" }, { $set: { nombre: "Fraterno", estado: true, fechaEliminado: null }, $setOnInsert: { codigo: "FRATERNO", descripcion: "Miembro activo de la fraternidad", esRolSistema: true } }, { upsert: true, new: true });
  await PerfilUsuario.updateOne({ _id: preregistro.usuarioId }, { $addToSet: { roles: rol._id } });
  await registrarAuditoria(req, { accion: "CONVERTIR_EN_FRATERNO", modulo: "GUIAS", entidad: "PostulanteGuia", entidadId: postulante._id, descripcion: "El postulante no fue elegido como guía y pasó a fraterno", datosDespues: { estado: postulante.estado, fraternoId: fraterno._id, usuarioId: preregistro.usuarioId } });
  return res.json({ message: "Postulante asignado como fraterno", fraterno });
};
async function crearBloqueAdministrativo(req: Request, res: Response) {
  const {nombre,error}=validarNombreBloque(req.body.nombre); if(error)return res.status(400).json({error});
  const guia:any=req.body.guiaId?await Guia.findById(req.body.guiaId).populate("usuarioId","sexo"):null;
  if(req.body.guiaId&&!guia)return res.status(404).json({error:"Guía no encontrado"});
  const gestionId=guia?.gestionId??req.body.gestionId??(await Gestion.findOne({estado:{$in:["ACTIVA","INSCRIPCIONES"]},fechaEliminado:null}).sort({anio:-1}).select("_id"))?._id;
  if(!gestionId)return res.status(404).json({error:"No existe una gestión activa para crear el bloque"});
  const genero=guia?normalizarGenero(guia.usuarioId?.sexo):null;
  if(guia&&!genero)return res.status(409).json({error:"El guía debe tener registrado su sexo"});
  try {
    const bloque = await Bloque.create({ nombre, guiaId: guia?._id, guiasIds: guia?[guia._id]:[], gestionId, cantidadGuiasHombres: genero === "HOMBRE" ? 1 : 0, cantidadGuiasMujeres: genero === "MUJER" ? 1 : 0, usuarioCreador: req.usuario?._id });
    await registrarAuditoria(req, { accion: "CREAR_BLOQUE", modulo: "BLOQUES", entidad: "Bloque", entidadId: bloque._id, descripcion: `Administración creó el bloque ${bloque.nombre}`, datosDespues: { guiaId: guia?._id??null, gestionId } });
    return res.status(201).json({ message: "Bloque creado", bloque });
  } catch (error) {
    return res.status(409).json({ error: (error as { code?: number }).code === 11000 ? "El guía ya tiene bloque o el nombre está ocupado" : error instanceof Error ? error.message : "No se pudo crear el bloque" });
  }
}
export const crearBloque = crearBloqueAdministrativo;

async function asignarFraterno(req: Request, res: Response, bloque: any, exigeGenero?: string) {
  const fraterno: any = await Fraterno.findOne({ _id: req.body.fraternoId, gestionId: bloque.gestionId, estado: "ACTIVO", fechaEliminado: null }).populate("usuarioId", "sexo");
  if (!fraterno) return res.status(404).json({ error: "Fraterno no disponible para este bloque" });
  const genero = normalizarGenero(fraterno.usuarioId?.sexo);
  if (!genero || (exigeGenero && genero !== exigeGenero)) return res.status(400).json({ error: "El fraterno no corresponde al sector seleccionado" });
  const limite = LIMITES_BLOQUE[genero];
  const cantidad = await DetalleBloque.countDocuments({ bloqueId: bloque._id, genero });
  const errorCupo=validarCupoIntegrante(genero,cantidad); if(errorCupo)return res.status(409).json({error:errorCupo});
  const existente: any = await DetalleBloque.findOne({ fraternoId: fraterno._id }).populate("bloqueId", "nombre");
  if (existente) return res.status(409).json({ error: String(existente.bloqueId?._id ?? existente.bloqueId) === String(bloque._id) ? "Este fraterno ya está en mi bloque." : "Este fraterno ya pertenece a otro bloque." });
  const campoCantidad = genero === "HOMBRE" ? "cantidadHombres" : "cantidadMujeres";
  await Bloque.updateOne({ _id: bloque._id, [campoCantidad]: { $lt: cantidad } }, { $set: { [campoCantidad]: cantidad } });
  const reservado = await Bloque.findOneAndUpdate({ _id: bloque._id, [campoCantidad]: { $lt: limite } }, { $inc: { [campoCantidad]: 1 } }, { new: true });
  if (!reservado) return res.status(409).json({ error: mensajeCupoCompleto(genero) });
  try {
    const detalle = await DetalleBloque.create({ bloqueId: bloque._id, fraternoId: fraterno._id, genero });
    await registrarAuditoria(req, { accion: "INCORPORAR_FRATERNO", modulo: "BLOQUES", entidad: "DetalleBloque", entidadId: detalle._id, descripcion: `Se incorporó un fraterno al bloque ${bloque.nombre}`, datosDespues: { bloqueId: bloque._id, fraternoId: fraterno._id, genero } });
    return res.status(201).json({ message: "Fraterno agregado al bloque", detalle });
  } catch (error) {
    await Bloque.updateOne({ _id: bloque._id, [campoCantidad]: { $gt: 0 } }, { $inc: { [campoCantidad]: -1 } });
    if ((error as { code?: number }).code === 11000) return res.status(409).json({ error: "El fraterno acaba de ser registrado en otro bloque." });
    return res.status(409).json({ error: error instanceof Error ? error.message : "No se pudo asignar el fraterno" });
  }
}
export const asignarIntegrante = async (req: Request, res: Response) => { const bloque = await Bloque.findById(req.body.bloqueId); if (!bloque) return res.status(404).json({ error: "Bloque no encontrado" }); return asignarFraterno(req, res, bloque, req.body.genero); };
export const quitarIntegranteComoAdmin = async (req: Request, res: Response) => { const detalle: any = await DetalleBloque.findByIdAndDelete(req.params.detalleId).populate("bloqueId", "nombre"); if (!detalle) return res.status(404).json({ error: "Integrante no encontrado" }); const bloqueId=detalle.bloqueId?._id??detalle.bloqueId; const campoCantidad=detalle.genero==="HOMBRE"?"cantidadHombres":"cantidadMujeres"; await Bloque.updateOne({ _id: bloqueId, [campoCantidad]: { $gt: 0 } }, { $inc: { [campoCantidad]: -1 } }); await registrarAuditoria(req, { accion: "RETIRAR_FRATERNO_BLOQUE", modulo: "BLOQUES", entidad: "DetalleBloque", entidadId: detalle._id, descripcion: `Administración retiró un fraterno del bloque ${detalle.bloqueId?.nombre ?? ""}`.trim(), datosAntes: { bloqueId, fraternoId: detalle.fraternoId, genero: detalle.genero } }); return res.json({ message: "Fraterno retirado del bloque; vuelve a estar disponible" }); };

export const obtenerMiBloque = async (req: Request, res: Response) => {
  const guia = await Guia.findOne({ usuarioId: req.usuario?._id, estado: "ACTIVO" }).populate(poblarGuia);
  if (!guia) return res.status(403).json({ error: "Tu cuenta no está designada como guía" });
  const bloque = await Bloque.findOne({ $or: [{ guiaId: guia._id }, { guiasIds: guia._id }] }).populate({ path: "guiasIds", populate: poblarGuia });
  const detalles = bloque ? await DetalleBloque.find({ bloqueId: bloque._id }).populate({ path: "fraternoId", populate: [{ path: "usuarioId", select: "nombres apellidoPaterno apellidoMaterno sexo ci email telefono" }, { path: "preregistroId", select: "numeroPreRegistro estado" }] }) : [];
  const fraternosDocumentos = await Fraterno.find({ gestionId: guia.gestionId, estado: "ACTIVO", fechaEliminado: null }).populate({ path: "usuarioId", select: "nombres apellidoPaterno apellidoMaterno sexo ci email telefono" }).populate("preregistroId", "numeroPreRegistro estado");
  const guiasGestion = await Guia.find({ gestionId: guia.gestionId, estado: "ACTIVO" }).populate(poblarGuia);
  const bloquesGestion = await Bloque.find({ gestionId: guia.gestionId }).select("nombre guiasIds guiaId");
  const ocupados = new Set(bloquesGestion.flatMap((item: any) => [item.guiaId, ...(item.guiasIds ?? [])].map(String)));
  const guiasDisponibles = guiasGestion.filter((item: any) => !ocupados.has(String(item._id)));
  const asignacionesGuias = bloquesGestion.flatMap((item: any) => [item.guiaId, ...(item.guiasIds ?? [])].filter(Boolean).map((guiaId: any) => ({ guiaId: String(guiaId), bloqueId: item._id, bloqueNombre: item.nombre })));
  const cuotas = await Cuota.find({ preregistroId: { $in: fraternosDocumentos.map((item: any) => item.preregistroId?._id ?? item.preregistroId) }, fechaEliminado: null }).select("preregistroId montoTotal montoPagado saldo estado numeroCuotasElegidas").lean();
  const pagosVerificados = await DetalleCuota.aggregate([{ $match: { cuotaId: { $in: cuotas.map((cuota) => cuota._id) }, estadoRevision: "VERIFICADO", fechaEliminado: null } }, { $group: { _id: "$cuotaId", total: { $sum: 1 } } }]);
  const cantidadPagos = new Map(pagosVerificados.map((item) => [String(item._id), item.total]));
  const cuotaPorPreregistro = new Map(cuotas.map((cuota) => [String(cuota.preregistroId), { ...cuota, cuotasPagadas: cantidadPagos.get(String(cuota._id)) ?? 0 }]));
  const tallas=await TallaFraterno.find({fraternoId:{$in:fraternosDocumentos.map(item=>item._id)}}).lean();const tallaPorFraterno=new Map(tallas.map(t=>[String(t.fraternoId),t]));
  const fraternos = fraternosDocumentos.map((item: any) => ({ ...item.toObject(), pago: cuotaPorPreregistro.get(String(item.preregistroId?._id ?? item.preregistroId)) ?? null, talla:tallaPorFraterno.get(String(item._id))??null }));
  const asignacionesFraternos = await DetalleBloque.find({ fraternoId: { $in: fraternosDocumentos.map((item) => item._id) } }).populate({path:"bloqueId",select:"nombre guiasIds guiaId",populate:{path:"guiasIds",populate:poblarGuia}}).select("fraternoId bloqueId");
  return res.json({ guia, bloque, detalles, fraternos, guiasDisponibles, guiasGestion, asignacionesGuias, asignacionesFraternos, limites: LIMITES_BLOQUE });
};
export const moverGuiaComoAdmin = async (req: Request, res: Response) => {
  const guia = await Guia.findById(req.params.guiaId).populate("usuarioId", "sexo");
  if (!guia) return res.status(404).json({ error: "Guía no encontrado" });
  const genero = normalizarGenero((guia.usuarioId as any)?.sexo);
  if (!genero) return res.status(409).json({ error: "El guía debe tener registrado su sexo" });
  const campoCantidad = genero === "HOMBRE" ? "cantidadGuiasHombres" : "cantidadGuiasMujeres";
  const bloqueOrigen: any = await Bloque.findOne({ $or: [{ guiaId: guia._id }, { guiasIds: guia._id }] });
  if (bloqueOrigen && String(req.body.bloqueId ?? "") === String(bloqueOrigen._id)) return res.json({ message: "El guía ya pertenece a este bloque" });
  if (bloqueOrigen && req.body.bloqueId && req.body.confirmarMovimiento !== true) return res.status(409).json({ error: `Este usuario ya es guía del bloque ${bloqueOrigen.nombre}.` });
  const destinoSolicitado: any = req.body.bloqueId ? await Bloque.findById(req.body.bloqueId) : null;
  if (req.body.bloqueId && (!destinoSolicitado || String(destinoSolicitado.gestionId) !== String(guia.gestionId))) return res.status(400).json({ error: "Bloque destino no válido" });
  if (bloqueOrigen) {
    const restantes=(bloqueOrigen.guiasIds??[]).filter((id:any)=>String(id)!==String(guia._id));
    const cambioOrigen:any={ $pull: { guiasIds: guia._id }, $inc: { [campoCantidad]: -1 } };
    if(restantes[0])cambioOrigen.$set={guiaId:restantes[0]};else cambioOrigen.$unset={guiaId:""};
    await Bloque.updateOne({ _id: bloqueOrigen._id }, cambioOrigen);
  }
  if (req.body.bloqueId) {
    const destino = destinoSolicitado;
    const cantidadGenero=genero==="HOMBRE"?destino.cantidadGuiasHombres:destino.cantidadGuiasMujeres;const errorCupoGuia=validarCupoGuia(genero,cantidadGenero??0);if(errorCupoGuia){if(bloqueOrigen){const reversa:any={$addToSet:{guiasIds:guia._id},$inc:{[campoCantidad]:1}};if(bloqueOrigen.guiaId)reversa.$set={guiaId:bloqueOrigen.guiaId};await Bloque.updateOne({_id:bloqueOrigen._id},reversa);}return res.status(409).json({error:errorCupoGuia});}
    const actualizado = await Bloque.findOneAndUpdate({ _id: destino._id, guiasIds: { $ne: guia._id }, [campoCantidad]: { $lt: LIMITES_BLOQUE.GUIAS_POR_GENERO }, $expr: { $lt: [{ $size: "$guiasIds" }, LIMITES_BLOQUE.GUIAS_TOTAL] } }, { $addToSet: { guiasIds: guia._id }, $set: { ...(destino.guiaId?{}:{guiaId:guia._id}) }, $inc: { [campoCantidad]: 1 } }, { new: true, runValidators: true }).catch(() => null);
    if (!actualizado) {
      if (bloqueOrigen) {const reversa:any={$addToSet:{guiasIds:guia._id},$inc:{[campoCantidad]:1}};if(bloqueOrigen.guiaId)reversa.$set={guiaId:bloqueOrigen.guiaId};await Bloque.updateOne({_id:bloqueOrigen._id},reversa);}
      return res.status(409).json({ error: `El bloque destino no tiene cupo para otro guía ${genero === "HOMBRE" ? "hombre" : "mujer"}` });
    }
  }
  await registrarAuditoria(req, { accion: req.body.bloqueId ? "MOVER_GUIA_BLOQUE" : "RETIRAR_GUIA_BLOQUE", modulo: "BLOQUES", entidad: "Guia", entidadId: guia._id, descripcion: req.body.bloqueId ? "Administración movió un guía a otro bloque" : "Administración retiró un guía de su bloque", datosAntes: { bloqueId: bloqueOrigen?._id }, datosDespues: { bloqueId: req.body.bloqueId ?? null, genero } });
  return res.json({ message: req.body.bloqueId ? "Guía movido por administración" : "Guía retirado del bloque por administración" });
};
export const asignarEnMiBloque = async (req: Request, res: Response) => {
  const guia = await Guia.findOne({ usuarioId: req.usuario?._id, estado: "ACTIVO" });
  const bloque = guia ? await Bloque.findOne({ _id: req.body.bloqueId, $or: [{ guiaId: guia._id }, { guiasIds: guia._id }] }) : null;
  if (!bloque) return res.status(403).json({ error: "No puedes modificar este bloque" });
  return asignarFraterno(req, res, bloque);
};
async function renombrar(req:Request,res:Response,bloque:any){const {nombre,error}=validarNombreBloque(req.body.nombre);if(error)return res.status(400).json({error});const anterior=bloque.nombre;try{const actualizado=await Bloque.findOneAndUpdate({_id:bloque._id,gestionId:bloque.gestionId},{$set:{nombre}},{new:true,runValidators:true});if(!actualizado)return res.status(404).json({error:"Bloque no encontrado"});await registrarAuditoria(req,{accion:"RENOMBRAR_BLOQUE",modulo:"BLOQUES",entidad:"Bloque",entidadId:actualizado._id,descripcion:`Se cambió el nombre de ${anterior} a ${actualizado.nombre}`,datosAntes:{nombre:anterior},datosDespues:{nombre:actualizado.nombre}});return res.json({message:"Nombre del bloque actualizado correctamente.",bloque:actualizado});}catch(error){if((error as any)?.code===11000)return res.status(409).json({error:"Ya existe un bloque con ese nombre en esta gestión"});return res.status(400).json({error:"No se pudo actualizar el nombre del bloque"});}}
export const renombrarMiBloque=async(req:Request,res:Response)=>{const guia=await Guia.findOne({usuarioId:req.usuario?._id,estado:"ACTIVO"});const bloque=guia?await Bloque.findOne({$or:[{guiaId:guia._id},{guiasIds:guia._id}]}):null;if(!bloque)return res.status(404).json({error:"No tienes un bloque asignado"});return renombrar(req,res,bloque);};
export const renombrarBloqueComoAdmin=async(req:Request,res:Response)=>{const bloque=await Bloque.findById(req.params.bloqueId);if(!bloque)return res.status(404).json({error:"Bloque no encontrado"});return renombrar(req,res,bloque);};

export const convertirFraternoEnGuia=async(req:Request,res:Response)=>{const ci=String(req.body.ci??"").trim(),fraternoId=req.body.fraternoId;const usuario=ci?await PerfilUsuario.findOne({ci,fechaEliminado:null}).select("nombres apellidoPaterno apellidoMaterno ci sexo email roles"):null;const fraterno:any=await Fraterno.findOne({...(fraternoId?{_id:fraternoId}:usuario?{usuarioId:usuario._id}:{}),estado:"ACTIVO",fechaEliminado:null}).populate("usuarioId","nombres apellidoPaterno apellidoMaterno ci sexo email roles");if((!ci&&!fraternoId)||!fraterno||!fraterno.usuarioId)return res.status(404).json({error:"No se encontró un fraterno activo con ese CI"});const existente=await Guia.findOne({usuarioId:fraterno.usuarioId._id});if(existente)return res.status(409).json({error:"Este usuario ya tiene el rol y registro de guía"});const rol=await Rol.findOneAndUpdate({codigo:"GUIA"},{$set:{nombre:"Guía",estado:true,fechaEliminado:null,permisos:["VISTA_COMUNICADOS","VISTA_PASOS","VISTA_CANCIONERO","VISTA_MI_BLOQUE_GUIA","BLOQUES_PROPIOS_GESTIONAR","BLOQUES_PROPIOS_EXPORTAR"]},$setOnInsert:{codigo:"GUIA",descripcion:"Organiza únicamente el bloque asignado por Administración",esRolSistema:true}},{upsert:true,new:true});try{const guia=await Guia.create({preregistroId:fraterno.preregistroId,usuarioId:fraterno.usuarioId._id,gestionId:fraterno.gestionId,usuarioCreador:req.usuario?._id});await PerfilUsuario.updateOne({_id:fraterno.usuarioId._id},{$addToSet:{roles:rol._id}});await registrarAuditoria(req,{accion:"CONVERTIR_FRATERNO_EN_GUIA",modulo:"GUIAS",entidad:"Guia",entidadId:guia._id,descripcion:`Administración convirtió en guía al fraterno CI ${fraterno.usuarioId.ci}`,datosDespues:{usuarioId:fraterno.usuarioId._id,fraternoId:fraterno._id}});return res.status(201).json({message:"Fraterno convertido en guía correctamente.",guia});}catch(error){return res.status(409).json({error:(error as any)?.code===11000?"Este usuario ya fue convertido en guía":"No se pudo convertir el fraterno en guía"});}};

export const eliminarBloqueComoAdmin=async(req:Request,res:Response)=>{const bloque=await Bloque.findById(req.params.bloqueId);if(!bloque)return res.status(404).json({error:"Bloque no encontrado"});const datosAntes={nombre:bloque.nombre,guiasIds:bloque.guiasIds,cantidadHombres:bloque.cantidadHombres,cantidadMujeres:bloque.cantidadMujeres};const ejecutar=async(session?:mongoose.ClientSession)=>{await DetalleBloque.deleteMany({bloqueId:bloque._id},{session});await Bloque.deleteOne({_id:bloque._id},{session});};const session=await mongoose.startSession();try{try{await session.withTransaction(()=>ejecutar(session));}catch(error){const mensaje=String((error as Error).message);if(!/Transaction numbers are only allowed|replica set|mongos/i.test(mensaje))throw error;await ejecutar();}await registrarAuditoria(req,{accion:"ELIMINAR_BLOQUE",modulo:"BLOQUES",entidad:"Bloque",entidadId:bloque._id,descripcion:`Administración eliminó el bloque ${bloque.nombre}; sus guías e integrantes quedaron disponibles`,datosAntes});return res.json({message:"Bloque eliminado correctamente."});}catch{return res.status(409).json({error:"No se pudo eliminar el bloque de forma segura"});}finally{await session.endSession();}};
