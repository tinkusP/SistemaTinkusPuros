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
import Preregistro from "../models/Preregistro";
import { inscripcionesBloqueAbiertas, LIMITES_BLOQUE, mensajeCupoCompleto, normalizarGeneroBloque, puedeIncorporarAlBloque, validarCupoGuia, validarCupoIntegrante, validarNombreBloque } from "../services/BloqueService";
import { asegurarIndiceGuiaBloqueDisperso, asegurarIndiceGuiasBloqueParcial, asegurarIndicePostulanteGuiaDisperso } from "../services/IndiceBloqueService";
import { asegurarIndiceAsignacionActiva, FILTRO_ASIGNACION_ACTIVA, obtenerAsignacionActivaValida, resumirAsignacion } from "../services/AsignacionBloqueService";
import { idsGuiasDelBloque, retirarGuiaDeBloques, sincronizarContadoresGuias } from "../services/GuiaBloqueService";
import { crearPreregistroParaUsuario } from "./PreregistroController";
import { obtenerOCrearFraterno } from "../services/CodigoFraternoService";
import { randomUUID } from "node:crypto";
const poblarGuia = [{ path: "usuarioId", select: "nombres apellidoPaterno apellidoMaterno ci sexo telefono fotoPerfil" }, { path: "gestionId", select: "nombre anio" }, { path: "preregistroId", select: "numeroPreRegistro" }];
const normalizarGenero = normalizarGeneroBloque;
export const listarGuias = async (_req: Request, res: Response) => {
  const guias = await Guia.find({ estado: "ACTIVO" }).populate(poblarGuia);
  const bloques = await Bloque.find({ estado: "ACTIVO" }).populate({ path: "guiaId", populate: poblarGuia }).populate({ path: "guiasIds", populate: poblarGuia }).sort({ nombre: 1 });
  const detalles = await DetalleBloque.find(FILTRO_ASIGNACION_ACTIVA).populate("bloqueId", "nombre guiasIds guiaId estado").populate({ path: "fraternoId", populate: [{ path: "usuarioId", select: "nombres apellidoPaterno apellidoMaterno sexo ci email telefono fotoPerfil" }, { path: "preregistroId", select: "numeroPreRegistro" }] });
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
    const rol = await Rol.findOneAndUpdate({ codigo: "GUIA" }, { $set: { nombre: "Guía", estado: true, fechaEliminado: null, permisos: ["VISTA_COMUNICADOS", "VISTA_PASOS", "VISTA_CANCIONERO", "VISTA_MI_BLOQUE_GUIA", "VISTA_DIRECTORIO_BLOQUES", "BLOQUES_PROPIOS_GESTIONAR", "BLOQUES_PROPIOS_EXPORTAR"] }, $setOnInsert: { codigo: "GUIA", descripcion: "Organiza únicamente el bloque asignado por Administración", esRolSistema: true } }, { upsert: true, new: true });
    await PerfilUsuario.updateOne({ _id: preregistro.usuarioId }, { $addToSet: { roles: rol._id } });
    await registrarAuditoria(req, { accion: "CONVERTIR_EN_GUIA", modulo: "GUIAS", entidad: "PostulanteGuia", entidadId: postulante._id, descripcion: "El postulante fue aprobado y convertido en guía", datosDespues: { estado: postulante.estado, guiaId: guia._id, usuarioId: preregistro.usuarioId } });
    return res.json({ message: "Postulante aprobado como guía", guia });
  }

  const fraterno = await obtenerOCrearFraterno({ preregistroId: preregistro._id, usuarioId: preregistro.usuarioId, gestionId: preregistro.gestionId, usuarioCreador: req.usuario?._id });
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
  const datosBloque={ nombre, ...(guia?{guiaId:guia._id}:{}), guiasIds: guia?[guia._id]:[], gestionId, cantidadGuiasHombres: genero === "HOMBRE" ? 1 : 0, cantidadGuiasMujeres: genero === "MUJER" ? 1 : 0, usuarioCreador: req.usuario?._id };
  try {
    let bloque: any;
    for(let intento=0;intento<3&&!bloque;intento+=1){
      try { bloque=await Bloque.create(datosBloque); }
      catch(error){
        const duplicado=error as {code?:number;keyPattern?:Record<string,number>;keyValue?:Record<string,unknown>};
        if(duplicado.code!==11000||guia)throw error;
        if(duplicado.keyPattern?.guiaId||duplicado.keyValue?.guiaId===null)await asegurarIndiceGuiaBloqueDisperso();
        else if(duplicado.keyPattern?.guiasIds||Object.hasOwn(duplicado.keyValue??{},"guiasIds"))await asegurarIndiceGuiasBloqueParcial();
        else throw error;
      }
    }
    if(!bloque)throw new Error("No se pudo crear el bloque después de reparar sus índices");
    await registrarAuditoria(req, { accion: "CREAR_BLOQUE", modulo: "BLOQUES", entidad: "Bloque", entidadId: bloque._id, descripcion: `Administración creó el bloque ${bloque.nombre}`, datosDespues: { guiaId: guia?._id??null, gestionId } });
    return res.status(201).json({ message: "Bloque creado", bloque });
  } catch (error) {
    const duplicado=error as {code?:number;keyPattern?:Record<string,number>;keyValue?:Record<string,unknown>};
    if(duplicado.code===11000&&duplicado.keyPattern?.nombre)return res.status(409).json({error:`Ya existe un bloque llamado ${nombre} en esta gestión.`});
    if(duplicado.code===11000&&duplicado.keyPattern?.guiaId)return res.status(409).json({error:"El guía seleccionado ya pertenece a otro bloque."});
    if(duplicado.code===11000&&duplicado.keyPattern?.guiasIds)return res.status(409).json({error:"Uno de los guías seleccionados ya pertenece a otro bloque."});
    return res.status(409).json({ error: error instanceof Error ? error.message : "No se pudo crear el bloque" });
  }
}
export const crearBloque = crearBloqueAdministrativo;

async function asignarFraterno(req: Request, res: Response, bloque: any, exigeGenero?: string, permitirBloqueCerrado = false) {
  const requestId = req.header("x-request-id") || randomUUID();
  if (!puedeIncorporarAlBloque(bloque, permitirBloqueCerrado)) return res.status(409).json({ code: "BLOCK_CLOSED", error: `El bloque ${bloque.nombre} tiene las inscripciones cerradas.`, message: `El bloque ${bloque.nombre} tiene las inscripciones cerradas.` });
  const fraterno: any = await Fraterno.findOne({ _id: req.body.fraternoId, gestionId: bloque.gestionId, estado: "ACTIVO", fechaEliminado: null }).populate("usuarioId", "sexo");
  if (!fraterno) return res.status(404).json({ error: "Fraterno no disponible para este bloque" });
  const genero = normalizarGenero(fraterno.usuarioId?.sexo);
  if (!genero || (exigeGenero && genero !== exigeGenero)) return res.status(400).json({ error: "El fraterno no corresponde al sector seleccionado" });
  const limite = LIMITES_BLOQUE[genero];
  const cantidad = await DetalleBloque.countDocuments({ bloqueId: bloque._id, genero, ...FILTRO_ASIGNACION_ACTIVA });
  const errorCupo=validarCupoIntegrante(genero,cantidad); if(errorCupo)return res.status(409).json({error:errorCupo});
  const existente: any = await obtenerAsignacionActivaValida(fraterno._id);
  if (existente) { const resumen = resumirAsignacion(existente); return res.status(409).json({ error: String(existente.bloqueId._id) === String(bloque._id) ? "Este fraterno ya está en tu bloque." : `Este fraterno pertenece actualmente al bloque ${existente.bloqueId.nombre}.`, asignacion: resumen }); }
  const campoCantidad = genero === "HOMBRE" ? "cantidadHombres" : "cantidadMujeres";
  await Bloque.updateOne({ _id: bloque._id, [campoCantidad]: { $lt: cantidad } }, { $set: { [campoCantidad]: cantidad } });
  const filtroReserva: Record<string, unknown> = { _id: bloque._id, [campoCantidad]: { $lt: limite } };
  if (!permitirBloqueCerrado) filtroReserva.inscripcionesAbiertas = { $ne: false };
  const reservado = await Bloque.findOneAndUpdate(filtroReserva, { $inc: { [campoCantidad]: 1 } }, { new: true });
  if (!reservado) { const vigente = await Bloque.findById(bloque._id).select("nombre inscripcionesAbiertas").lean(); if (!permitirBloqueCerrado && vigente && !inscripcionesBloqueAbiertas(vigente)) return res.status(409).json({ code: "BLOCK_CLOSED", error: `El bloque ${vigente.nombre} tiene las inscripciones cerradas.`, message: `El bloque ${vigente.nombre} tiene las inscripciones cerradas.` }); return res.status(409).json({ error: mensajeCupoCompleto(genero) }); }
  try {
    await asegurarIndiceAsignacionActiva();
    const detalle = await DetalleBloque.create({ bloqueId: bloque._id, fraternoId: fraterno._id, genero, estado: "ACTIVO" });
    await registrarAuditoria(req, { accion: "INCORPORAR_FRATERNO", modulo: "BLOQUES", entidad: "DetalleBloque", entidadId: detalle._id, descripcion: `Se incorporó un fraterno al bloque ${bloque.nombre}`, datosDespues: { bloqueId: bloque._id, fraternoId: fraterno._id, genero } });
    console.info(JSON.stringify({ requestId, accion: "ADD_TO_BLOCK", bloqueId: bloque._id, fraternoId: fraterno._id, ci: fraterno.usuarioId?.ci, resultado: "OK" }));
    return res.status(201).json({ message: "Fraterno agregado al bloque", detalle });
  } catch (error) {
    console.error(JSON.stringify({ requestId, accion: "ADD_TO_BLOCK", bloqueId: bloque._id, fraternoId: fraterno._id, ci: fraterno.usuarioId?.ci, resultado: "ERROR", error: error instanceof Error ? error.message : String(error) }));
    await Bloque.updateOne({ _id: bloque._id, [campoCantidad]: { $gt: 0 } }, { $inc: { [campoCantidad]: -1 } });
    if ((error as { code?: number }).code === 11000) {
      const ganadora: any = await obtenerAsignacionActivaValida(fraterno._id);
      const resumen = resumirAsignacion(ganadora);
      return res.status(409).json({ error: resumen ? `Este fraterno pertenece actualmente al bloque ${resumen.bloqueNombre}.` : "La asignación cambió durante la operación. Actualiza la búsqueda.", asignacion: resumen });
    }
    return res.status(409).json({ error: error instanceof Error ? error.message : "No se pudo asignar el fraterno" });
  }
}
export const asignarIntegrante = async (req: Request, res: Response) => { const bloque = await Bloque.findOne({ _id: req.body.bloqueId, estado: "ACTIVO" }); if (!bloque) return res.status(404).json({ error: "Bloque activo no encontrado" }); return asignarFraterno(req, res, bloque, req.body.genero, true); };
export const quitarIntegranteComoAdmin = async (req: Request, res: Response) => { const detalle: any = await DetalleBloque.findOneAndUpdate({ _id: req.params.detalleId, ...FILTRO_ASIGNACION_ACTIVA }, { $set: { estado: "INACTIVO", fechaRetiro: new Date() } }, { new: true }).populate("bloqueId", "nombre"); if (!detalle) return res.status(404).json({ error: "Integrante activo no encontrado" }); const bloqueId=detalle.bloqueId?._id??detalle.bloqueId; const campoCantidad=detalle.genero==="HOMBRE"?"cantidadHombres":"cantidadMujeres"; await Bloque.updateOne({ _id: bloqueId, [campoCantidad]: { $gt: 0 } }, { $inc: { [campoCantidad]: -1 } }); await registrarAuditoria(req, { accion: "RETIRAR_FRATERNO_BLOQUE", modulo: "BLOQUES", entidad: "DetalleBloque", entidadId: detalle._id, descripcion: `Administración retiró un fraterno del bloque ${detalle.bloqueId?.nombre ?? ""}`.trim(), datosAntes: { bloqueId, fraternoId: detalle.fraternoId, genero: detalle.genero }, datosDespues: { estado: "INACTIVO" } }); return res.json({ message: "Fraterno retirado del bloque; vuelve a estar disponible" }); };

export const obtenerMiBloque = async (req: Request, res: Response) => {
  const guia = await Guia.findOne({ usuarioId: req.usuario?._id, estado: "ACTIVO" }).populate(poblarGuia);
  if (!guia) return res.status(403).json({ error: "Tu cuenta no está designada como guía" });
  const bloque = await Bloque.findOne({ estado: "ACTIVO", $or: [{ guiaId: guia._id }, { guiasIds: guia._id }] })
    .populate({ path: "guiaId", populate: poblarGuia })
    .populate({ path: "guiasIds", populate: poblarGuia });
  const detalles = bloque ? await DetalleBloque.find({ bloqueId: bloque._id, ...FILTRO_ASIGNACION_ACTIVA }).populate({ path: "fraternoId", populate: [{ path: "usuarioId", select: "nombres apellidoPaterno apellidoMaterno sexo ci email telefono" }, { path: "preregistroId", select: "numeroPreRegistro estado" }] }) : [];
  const idsIntegrantes = detalles.map((item: any) => item.fraternoId?._id ?? item.fraternoId).filter(Boolean);
  const fraternosDocumentos = await Fraterno.find({ _id: { $in: idsIntegrantes }, estado: "ACTIVO", fechaEliminado: null }).populate({ path: "usuarioId", select: "nombres apellidoPaterno apellidoMaterno sexo ci email telefono" }).populate("preregistroId", "numeroPreRegistro estado");
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
  return res.json({ guia, bloque, detalles, fraternos, guiasDisponibles, guiasGestion, asignacionesGuias, limites: LIMITES_BLOQUE });
};
async function buscarUsuariosDisponiblesParaBloque(bloque: any, termino: string) {
  const expresion = new RegExp(termino.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const usuarios: any[] = await PerfilUsuario.find({ fechaEliminado: null, $or: [{ ci: expresion }, { nombres: expresion }, { apellidoPaterno: expresion }, { apellidoMaterno: expresion }] }).select("nombres apellidoPaterno apellidoMaterno ci sexo email telefono roles estado").populate("roles", "codigo nombre").limit(50).lean();
  const fraternos: any[] = await Fraterno.find({ gestionId: bloque.gestionId, fechaEliminado: null, $or: [{ usuarioId: { $in: usuarios.map((usuario) => usuario._id) } }, { numeroFraterno: expresion }] })
    .populate("usuarioId", "nombres apellidoPaterno apellidoMaterno sexo ci email telefono")
    .populate("preregistroId", "numeroPreRegistro estado")
    .limit(30);
  const fraternoPorUsuario = new Map(fraternos.map((fraterno) => [String(fraterno.usuarioId?._id ?? fraterno.usuarioId), fraterno]));
  const preregistros: any[] = await Preregistro.find({ usuarioId: { $in: usuarios.map((usuario) => usuario._id) }, gestionId: bloque.gestionId, fechaEliminado: null }).sort({ fechaRegistro: -1 }).select("usuarioId numeroPreRegistro estado gestionId").lean();
  const preregistroPorUsuario = new Map(preregistros.map((item) => [String(item.usuarioId), item]));
  const asignaciones: any[] = await DetalleBloque.find({ fraternoId: { $in: fraternos.map((fraterno) => fraterno._id) }, ...FILTRO_ASIGNACION_ACTIVA }).populate({ path: "bloqueId", match: { estado: "ACTIVO" }, select: "nombre estado guiaId guiasIds", populate: [{ path: "guiasIds", populate: poblarGuia }, { path: "guiaId", populate: poblarGuia }] }).lean();
  const asignacionPorFraterno = new Map(asignaciones.filter((item) => item.bloqueId).map((item) => [String(item.fraternoId), item]));
  const resultados = usuarios.map((usuario) => {
    const fraterno = fraternoPorUsuario.get(String(usuario._id));
    const asignacionActual: any = fraterno ? asignacionPorFraterno.get(String(fraterno._id)) : null;
    const resumen: any = resumirAsignacion(asignacionActual);
    if (resumen) resumen.esMiBloque = String(resumen.bloqueId) === String(bloque._id);
    return fraterno ? { ...fraterno.toObject(), usuarioId: usuario, estadoFraterno: fraterno.estado, asignacion: resumen } : { _id: `usuario-${usuario._id}`, usuarioId: usuario, preregistroId: preregistroPorUsuario.get(String(usuario._id)) ?? null, estadoFraterno: "NO_REGISTRADO", asignacion: null };
  });
  for (const fraterno of fraternos) if (!resultados.some((item: any) => String(item._id) === String(fraterno._id))) {
    const resumen: any = resumirAsignacion(asignacionPorFraterno.get(String(fraterno._id)));
    if (resumen) resumen.esMiBloque = String(resumen.bloqueId) === String(bloque._id);
    resultados.push({ ...fraterno.toObject(), estadoFraterno: fraterno.estado, asignacion: resumen });
  }
  return resultados;
}
export const buscarFraternosParaMiBloque = async (req: Request, res: Response) => {
  const termino = String(req.query.buscar ?? "").trim();
  if (termino.length < 2) return res.status(400).json({ error: "Escribe al menos 2 caracteres para buscar" });
  const guia = await Guia.findOne({ usuarioId: req.usuario?._id, estado: "ACTIVO" });
  if (!guia) return res.status(403).json({ error: "Tu cuenta no está designada como guía" });
  const bloque = await Bloque.findOne({ estado: "ACTIVO", $or: [{ guiaId: guia._id }, { guiasIds: guia._id }] }).select("_id nombre gestionId");
  if (!bloque) return res.status(404).json({ error: "Aún no tienes un bloque asignado" });
  return res.json({ fraternos: await buscarUsuariosDisponiblesParaBloque(bloque, termino) });
};
export const buscarUsuariosParaBloqueComoAdmin = async (req: Request, res: Response) => {
  const termino = String(req.query.buscar ?? "").trim();
  const bloque = await Bloque.findOne({ _id: req.query.bloqueId, estado: "ACTIVO" }).select("_id nombre gestionId");
  if (!bloque) return res.status(404).json({ error: "Bloque activo no encontrado" });
  return res.json({ fraternos: await buscarUsuariosDisponiblesParaBloque(bloque, termino) });
};
async function registrarUsuarioYAsignar(req: Request, res: Response, bloque: any, permitirBloqueCerrado = false) {
  const requestId = req.header("x-request-id") || randomUUID();
  if (!puedeIncorporarAlBloque(bloque, permitirBloqueCerrado)) return res.status(409).json({ code: "BLOCK_CLOSED", error: `El bloque ${bloque.nombre} tiene las inscripciones cerradas.`, message: `El bloque ${bloque.nombre} tiene las inscripciones cerradas.` });
  const usuario: any = await PerfilUsuario.findOne({ _id: req.body.usuarioId, fechaEliminado: null }).select("_id ci sexo roles");
  if (!usuario) return res.status(404).json({ error: "Usuario no encontrado" });
  let preregistro: any = await Preregistro.findOne({ usuarioId: usuario._id, gestionId: bloque.gestionId, fechaEliminado: null }).sort({ fechaRegistro: -1 });
  if (!preregistro) {
    try { preregistro = await crearPreregistroParaUsuario({ usuarioId: usuario._id, gestionId: String(bloque.gestionId), creadorId: req.usuario?._id }); }
    catch (error) { return res.status(409).json({ error: error instanceof Error ? error.message : "No se pudo crear el perfil fraterno" }); }
  }
  let fraterno: any;
  try {
    fraterno = await obtenerOCrearFraterno({ preregistroId: preregistro._id, usuarioId: usuario._id, gestionId: bloque.gestionId, usuarioCreador: req.usuario?._id });
    console.info(JSON.stringify({ requestId, accion: "REGISTER_FRATERNO", usuarioId: usuario._id, ci: usuario.ci, fraternoId: fraterno._id, codigo: fraterno.numeroFraterno, resultado: "OK" }));
  } catch (error) {
    console.error(JSON.stringify({ requestId, accion: "REGISTER_FRATERNO", usuarioId: usuario._id, ci: usuario.ci, resultado: "ERROR", error: error instanceof Error ? error.message : String(error) }));
    return res.status((error as { statusCode?: number }).statusCode ?? 409).json({ error: error instanceof Error ? error.message : "No se pudo registrar al fraterno", requestId });
  }
  const rol = await Rol.findOneAndUpdate({ codigo: "FRATERNO" }, { $set: { nombre: "Fraterno", estado: true, fechaEliminado: null }, $setOnInsert: { descripcion: "Miembro activo de la fraternidad", esRolSistema: true } }, { upsert: true, new: true });
  await PerfilUsuario.updateOne({ _id: usuario._id }, { $addToSet: { roles: rol._id } });
  req.body.fraternoId = fraterno._id;
  return asignarFraterno(req, res, bloque, undefined, permitirBloqueCerrado);
}
export const registrarFraternoEnMiBloque = async (req: Request, res: Response) => {
  const guia = await Guia.findOne({ usuarioId: req.usuario?._id, estado: "ACTIVO" });
  if (!guia) return res.status(403).json({ error: "Tu cuenta no está designada como guía" });
  const bloque = await Bloque.findOne({ $or: [{ guiaId: guia._id }, { guiasIds: guia._id }], estado: "ACTIVO" });
  if (!bloque) return res.status(404).json({ error: "Aún no tienes un bloque activo asignado" });
  return registrarUsuarioYAsignar(req, res, bloque);
};
export const registrarFraternoEnBloqueComoAdmin = async (req: Request, res: Response) => {
  const bloque = await Bloque.findOne({ _id: req.body.bloqueId, estado: "ACTIVO" });
  if (!bloque) return res.status(404).json({ error: "Bloque activo no encontrado" });
  return registrarUsuarioYAsignar(req, res, bloque, true);
};
export const obtenerDirectorioBloques = async (_req: Request, res: Response) => {
  const bloques = await Bloque.find({ estado: "ACTIVO" })
    .select("nombre estado guiasIds guiaId")
    .populate({
      path: "guiasIds",
      select: "usuarioId estado",
      match: { estado: "ACTIVO" },
      populate: { path: "usuarioId", select: "nombres apellidoPaterno apellidoMaterno sexo telefono fotoPerfil" },
    })
    .populate({
      path: "guiaId",
      select: "usuarioId estado",
      match: { estado: "ACTIVO" },
      populate: { path: "usuarioId", select: "nombres apellidoPaterno apellidoMaterno sexo telefono fotoPerfil" },
    })
    .sort({ nombre: 1 })
    .lean();
  const directorio = bloques.map((bloque: any) => {
    const guias = [...(bloque.guiasIds ?? [])];
    if (bloque.guiaId && !guias.some((guia: any) => String(guia._id) === String(bloque.guiaId._id))) guias.unshift(bloque.guiaId);
    return { _id: bloque._id, nombre: bloque.nombre, estado: bloque.estado, guiasIds: guias };
  });
  return res.json({ bloques: directorio });
};
export const moverGuiaComoAdmin = async (req: Request, res: Response) => {
  const guia = await Guia.findById(req.params.guiaId).populate("usuarioId", "sexo");
  if (!guia || guia.estado !== "ACTIVO") return res.status(404).json({ error: "Guía activo no encontrado" });
  const genero = normalizarGenero((guia.usuarioId as any)?.sexo);
  if (!genero) return res.status(409).json({ error: "El guía debe tener registrado su sexo" });
  const bloqueOrigen: any = await Bloque.findOne({ estado: "ACTIVO", $or: [{ guiaId: guia._id }, { guiasIds: guia._id }] });
  if (bloqueOrigen && String(req.body.bloqueId ?? "") === String(bloqueOrigen._id)) return res.json({ message: "El guía ya pertenece a este bloque" });
  if (bloqueOrigen && req.body.bloqueId && req.body.confirmarMovimiento !== true) return res.status(409).json({ error: `Este usuario ya es guía del bloque ${bloqueOrigen.nombre}.` });
  const destinoSolicitado: any = req.body.bloqueId ? await Bloque.findById(req.body.bloqueId) : null;
  if (req.body.bloqueId && (!destinoSolicitado || destinoSolicitado.estado !== "ACTIVO" || String(destinoSolicitado.gestionId) !== String(guia.gestionId))) return res.status(400).json({ error: "Bloque destino no válido" });
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await retirarGuiaDeBloques(guia._id, session, destinoSolicitado?._id);
      if (!destinoSolicitado) return;
      const destino: any = await Bloque.findById(destinoSolicitado._id).session(session);
      if (!destino || destino.estado !== "ACTIVO") throw new Error("BLOQUE_DESTINO_INVALIDO");
      const idsActuales = idsGuiasDelBloque(destino).filter((id) => String(id) !== String(guia._id));
      const guiasActuales: any[] = await Guia.find({ _id: { $in: idsActuales }, estado: "ACTIVO" }).populate("usuarioId", "sexo").session(session);
      const cantidadGenero = guiasActuales.filter((item) => normalizarGenero((item.usuarioId as any)?.sexo) === genero).length;
      const errorCupo = validarCupoGuia(genero, cantidadGenero);
      if (errorCupo || idsActuales.length >= LIMITES_BLOQUE.GUIAS_TOTAL) throw new Error(errorCupo ?? "El bloque ya tiene 4 guías");
      destino.guiasIds = [...idsActuales, guia._id];
      if (!destino.guiaId) destino.guiaId = guia._id;
      await destino.save({ session });
      await sincronizarContadoresGuias(destino, session);
    });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "No se pudo actualizar la asignación";
    return res.status(mensaje === "BLOQUE_DESTINO_INVALIDO" ? 400 : 409).json({ error: mensaje === "BLOQUE_DESTINO_INVALIDO" ? "Bloque destino no válido" : mensaje });
  } finally {
    await session.endSession();
  }
  await registrarAuditoria(req, { accion: req.body.bloqueId ? "MOVER_GUIA_BLOQUE" : "RETIRAR_GUIA_BLOQUE", modulo: "BLOQUES", entidad: "Guia", entidadId: guia._id, descripcion: req.body.bloqueId ? "Administración movió un guía a otro bloque" : "Administración retiró un guía de su bloque", datosAntes: { bloqueId: bloqueOrigen?._id }, datosDespues: { bloqueId: req.body.bloqueId ?? null, genero } });
  return res.json({ message: req.body.bloqueId ? "Guía movido por administración" : "Guía retirado del bloque por administración" });
};

export const quitarRolGuiaComoAdmin = async (req: Request, res: Response) => {
  const guia = await Guia.findById(req.params.guiaId);
  if (!guia) return res.status(404).json({ error: "Guía no encontrado" });
  const rolGuia = await Rol.findOne({ codigo: "GUIA" }).select("_id");
  const bloquesAntes = await Bloque.find({ $or: [{ guiaId: guia._id }, { guiasIds: guia._id }] }).select("_id nombre").lean();
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await retirarGuiaDeBloques(guia._id, session);
      await Guia.updateOne({ _id: guia._id }, { $set: { estado: "INACTIVO" } }, { session });
      if (rolGuia) await PerfilUsuario.updateOne({ _id: guia.usuarioId }, { $pull: { roles: rolGuia._id } }, { session });
    });
  } catch {
    return res.status(409).json({ error: "No se pudo quitar el rol de guía de forma segura" });
  } finally {
    await session.endSession();
  }
  await registrarAuditoria(req, { accion: "QUITAR_ROL_GUIA", modulo: "GUIAS", entidad: "Guia", entidadId: guia._id, descripcion: "Administración quitó el rol de guía y liberó sus bloques", datosAntes: { estado: guia.estado, bloques: bloquesAntes }, datosDespues: { estado: "INACTIVO", bloqueId: null } });
  return res.json({ message: "Rol de guía retirado. La persona conserva su perfil y datos de fraterno." });
};
export const asignarEnMiBloque = async (req: Request, res: Response) => {
  const guia = await Guia.findOne({ usuarioId: req.usuario?._id, estado: "ACTIVO" });
  const bloque = guia ? await Bloque.findOne({ _id: req.body.bloqueId, estado: "ACTIVO", $or: [{ guiaId: guia._id }, { guiasIds: guia._id }] }) : null;
  if (!bloque) return res.status(403).json({ error: "No puedes modificar este bloque" });
  return asignarFraterno(req, res, bloque);
};
async function renombrar(req:Request,res:Response,bloque:any){const {nombre,error}=validarNombreBloque(req.body.nombre);if(error)return res.status(400).json({error});const anterior=bloque.nombre;try{const actualizado=await Bloque.findOneAndUpdate({_id:bloque._id,gestionId:bloque.gestionId},{$set:{nombre}},{new:true,runValidators:true});if(!actualizado)return res.status(404).json({error:"Bloque no encontrado"});await registrarAuditoria(req,{accion:"RENOMBRAR_BLOQUE",modulo:"BLOQUES",entidad:"Bloque",entidadId:actualizado._id,descripcion:`Se cambió el nombre de ${anterior} a ${actualizado.nombre}`,datosAntes:{nombre:anterior},datosDespues:{nombre:actualizado.nombre}});return res.json({message:"Nombre del bloque actualizado correctamente.",bloque:actualizado});}catch(error){if((error as any)?.code===11000)return res.status(409).json({error:"Ya existe un bloque con ese nombre en esta gestión"});return res.status(400).json({error:"No se pudo actualizar el nombre del bloque"});}}
export const renombrarMiBloque=async(req:Request,res:Response)=>{const guia=await Guia.findOne({usuarioId:req.usuario?._id,estado:"ACTIVO"});const bloque=guia?await Bloque.findOne({$or:[{guiaId:guia._id},{guiasIds:guia._id}]}):null;if(!bloque)return res.status(404).json({error:"No tienes un bloque asignado"});return renombrar(req,res,bloque);};
export const renombrarBloqueComoAdmin=async(req:Request,res:Response)=>{const bloque=await Bloque.findById(req.params.bloqueId);if(!bloque)return res.status(404).json({error:"Bloque no encontrado"});return renombrar(req,res,bloque);};

export const cambiarInscripcionesBloqueComoAdmin = async (req: Request, res: Response) => {
  const bloque: any = await Bloque.findOne({ _id: req.params.bloqueId, estado: "ACTIVO" });
  if (!bloque) return res.status(404).json({ error: "Bloque activo no encontrado" });
  const anterior = inscripcionesBloqueAbiertas(bloque), nuevo = req.body.inscripcionesAbiertas === true;
  if (anterior === nuevo) return res.json({ message: `Las inscripciones del ${bloque.nombre} ya están ${nuevo ? "abiertas" : "cerradas"}.`, bloque });
  bloque.inscripcionesAbiertas = nuevo; await bloque.save();
  await registrarAuditoria(req, { accion: nuevo ? "BLOQUE_INSCRIPCIONES_ABIERTAS" : "BLOQUE_INSCRIPCIONES_CERRADAS", modulo: "BLOQUES", entidad: "Bloque", entidadId: bloque._id, descripcion: `Administración ${nuevo ? "abrió" : "cerró"} las inscripciones del ${bloque.nombre}`, datosAntes: { nombre: bloque.nombre, inscripcionesAbiertas: anterior }, datosDespues: { nombre: bloque.nombre, inscripcionesAbiertas: nuevo } });
  return res.json({ message: `Inscripciones del ${bloque.nombre} ${nuevo ? "abiertas" : "cerradas"}.`, bloque });
};

export const buscarCandidatoGuia = async (req: Request, res: Response) => {
  const ci = String(req.query.ci ?? "").trim();
  const usuario = await PerfilUsuario.findOne({ ci, fechaEliminado: null }).select("nombres apellidoPaterno apellidoMaterno ci sexo email telefono fotoPerfil estado").lean();
  if (!usuario) return res.status(404).json({ error: "No existe un usuario registrado con ese CI" });
  const [preregistro, fraterno, guia] = await Promise.all([
    Preregistro.findOne({ usuarioId: usuario._id, fechaEliminado: null }).sort({ fechaRegistro: -1 }).select("_id numeroPreRegistro estado gestionId").lean(),
    Fraterno.findOne({ usuarioId: usuario._id, fechaEliminado: null }).sort({ fechaIngreso: -1 }).select("_id numeroFraterno estado").lean(),
    Guia.findOne({ usuarioId: usuario._id }).select("_id estado").lean(),
  ]);
  return res.json({ candidato: { usuario, preregistro, fraterno, guia, puedeConvertirse: Boolean(preregistro) } });
};

export const convertirFraternoEnGuia = async (req: Request, res: Response) => {
  const ci = String(req.body.ci ?? "").trim();
  const fraternoId = req.body.fraternoId;
  const usuarioPorCi = ci ? await PerfilUsuario.findOne({ ci, fechaEliminado: null }).select("nombres apellidoPaterno apellidoMaterno ci sexo email roles") : null;
  const fraterno: any = fraternoId ? await Fraterno.findOne({ _id: fraternoId, fechaEliminado: null }).populate("usuarioId", "nombres apellidoPaterno apellidoMaterno ci sexo email roles") : null;
  const usuario: any = fraterno?.usuarioId ?? usuarioPorCi;
  if (!usuario) return res.status(404).json({ error: "No se encontró un usuario registrado con ese CI" });
  const preregistro: any = await Preregistro.findOne({ usuarioId: usuario._id, fechaEliminado: null }).sort({ fechaRegistro: -1 });
  if (!preregistro) return res.status(409).json({ error: "El usuario existe, pero todavía no tiene un preregistro y no puede ser designado guía." });
  const rol = await Rol.findOneAndUpdate({ codigo: "GUIA" }, { $set: { nombre: "Guía", estado: true, fechaEliminado: null, permisos: ["VISTA_COMUNICADOS", "VISTA_PASOS", "VISTA_CANCIONERO", "VISTA_MI_BLOQUE_GUIA", "VISTA_DIRECTORIO_BLOQUES", "BLOQUES_PROPIOS_GESTIONAR", "BLOQUES_PROPIOS_EXPORTAR"] }, $setOnInsert: { codigo: "GUIA", descripcion: "Organiza únicamente el bloque asignado por Administración", esRolSistema: true } }, { upsert: true, new: true });
  const existente = await Guia.findOne({ $or: [{ usuarioId: usuario._id }, { preregistroId: preregistro._id }] });
  if (existente) {
    existente.usuarioId=usuario._id; existente.preregistroId=preregistro._id; existente.gestionId=preregistro.gestionId; existente.estado="ACTIVO";
    await existente.save();
    await PerfilUsuario.updateOne({ _id: usuario._id }, { $addToSet: { roles: rol._id } });
    return res.json({ message: "El registro de guía fue recuperado y ya está disponible en la lista.", guia: existente });
  }
  const datos = { preregistroId: preregistro._id, usuarioId: usuario._id, gestionId: preregistro.gestionId, usuarioCreador: req.usuario?._id };
  try {
    let guia;
    try { guia = await Guia.create(datos); }
    catch (error) {
      const duplicado = error as { code?: number; keyPattern?: Record<string, number>; keyValue?: Record<string, unknown> };
      if (duplicado.code === 11000 && (duplicado.keyPattern?.postulanteGuiaId || duplicado.keyValue?.postulanteGuiaId === null)) { await asegurarIndicePostulanteGuiaDisperso(); guia = await Guia.create(datos); }
      else throw error;
    }
    await PerfilUsuario.updateOne({ _id: usuario._id }, { $addToSet: { roles: rol._id } });
    await registrarAuditoria(req, { accion: "CONVERTIR_USUARIO_EN_GUIA", modulo: "GUIAS", entidad: "Guia", entidadId: guia._id, descripcion: `Administración convirtió en guía al usuario CI ${usuario.ci}`, datosDespues: { usuarioId: usuario._id, fraternoId: fraterno?._id ?? null, preregistroId: preregistro._id } });
    return res.status(201).json({ message: "Usuario convertido en guía correctamente.", guia });
  } catch (error) {
    const duplicado = error as { code?: number };
    return res.status(409).json({ error: duplicado.code === 11000 ? "Ya existe un registro relacionado con este usuario. Recarga la lista antes de continuar." : "No se pudo convertir el fraterno en guía" });
  }
};

export const eliminarBloqueComoAdmin=async(req:Request,res:Response)=>{const bloque=await Bloque.findById(req.params.bloqueId);if(!bloque)return res.status(404).json({error:"Bloque no encontrado"});const datosAntes={nombre:bloque.nombre,guiasIds:bloque.guiasIds,cantidadHombres:bloque.cantidadHombres,cantidadMujeres:bloque.cantidadMujeres};const ejecutar=async(session?:mongoose.ClientSession)=>{await DetalleBloque.updateMany({bloqueId:bloque._id,...FILTRO_ASIGNACION_ACTIVA},{$set:{estado:"INACTIVO",fechaRetiro:new Date()}},{session});await Bloque.deleteOne({_id:bloque._id},{session});};const session=await mongoose.startSession();try{try{await session.withTransaction(()=>ejecutar(session));}catch(error){const mensaje=String((error as Error).message);if(!/Transaction numbers are only allowed|replica set|mongos/i.test(mensaje))throw error;await ejecutar();}await registrarAuditoria(req,{accion:"ELIMINAR_BLOQUE",modulo:"BLOQUES",entidad:"Bloque",entidadId:bloque._id,descripcion:`Administración eliminó el bloque ${bloque.nombre}; sus guías e integrantes quedaron disponibles`,datosAntes});return res.json({message:"Bloque eliminado correctamente."});}catch{return res.status(409).json({error:"No se pudo eliminar el bloque de forma segura"});}finally{await session.endSession();}};
