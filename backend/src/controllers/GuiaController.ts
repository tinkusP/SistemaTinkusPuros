import type { Request, Response } from "express";
import PostulanteGuia from "../models/PostulanteGuia"; import Guia from "../models/Guia"; import Bloque from "../models/Bloque"; import DetalleBloque from "../models/DetalleBloque"; import Cuota from "../models/Cuota";
import Fraterno from "../models/Fraterno";
import PerfilUsuario from "../models/PerfilUsuario";
import Rol from "../models/Rol";
import { registrarAuditoria } from "../services/AuditoriaService";
import DetalleCuota from "../models/DetalleCuota";
import { capacidadSector, LIMITES_BLOQUE, mensajeCupoCompleto, normalizarGeneroBloque, validarDimensionesBloque } from "../services/BloqueService";
const poblarGuia = [{ path: "usuarioId", select: "nombres apellidoPaterno apellidoMaterno ci sexo telefono" }, { path: "gestionId", select: "nombre anio" }, { path: "preregistroId", select: "numeroPreRegistro" }];
const normalizarGenero = normalizarGeneroBloque;
export const listarGuias = async (_req: Request, res: Response) => { const guias = await Guia.find().populate(poblarGuia); const bloques = await Bloque.find().populate({ path: "guiaId", populate: poblarGuia }).populate({ path: "guiasIds", populate: poblarGuia }); const detalles = await DetalleBloque.find().populate("bloqueId", "nombre").populate({ path: "fraternoId", populate: { path: "usuarioId", select: "nombres apellidoPaterno apellidoMaterno sexo ci fotoPerfil" } }); const fraternos = await Fraterno.find({ estado: "ACTIVO", fechaEliminado: null }).populate({ path: "usuarioId", select: "nombres apellidoPaterno apellidoMaterno sexo ci fotoPerfil" }); const cuotas = await Cuota.find({ preregistroId: { $in: guias.map(g => g.preregistroId) }, fechaEliminado: null }); res.json({ guias, bloques, detalles, fraternos, cuotas }); };
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
    const rol = await Rol.findOneAndUpdate({ codigo: "GUIA" }, { $set: { nombre: "Guía", estado: true, fechaEliminado: null, permisos: ["VISTA_COMUNICADOS", "VISTA_PASOS", "VISTA_CANCIONERO", "VISTA_MI_BLOQUE_GUIA", "BLOQUES_PROPIOS_CREAR", "BLOQUES_PROPIOS_GESTIONAR", "BLOQUES_PROPIOS_EXPORTAR"] }, $setOnInsert: { codigo: "GUIA", descripcion: "Organiza y administra únicamente su bloque", esRolSistema: true } }, { upsert: true, new: true });
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
async function crearBloqueParaGuia(req: Request, res: Response, guiaId: string, nombre: string) {
  const guia = await Guia.findById(guiaId).populate("usuarioId", "sexo");
  if (!guia) return res.status(404).json({ error: "Guía no encontrado" });
  const genero = normalizarGenero((guia.usuarioId as any)?.sexo);
  if (!genero) return res.status(409).json({ error: "El guía debe tener registrado su sexo antes de crear un bloque" });
  try {
    const bloque = await Bloque.create({ nombre, guiaId: guia._id, guiasIds: [guia._id], gestionId: guia.gestionId, cantidadGuiasHombres: genero === "HOMBRE" ? 1 : 0, cantidadGuiasMujeres: genero === "MUJER" ? 1 : 0, usuarioCreador: req.usuario?._id });
    await registrarAuditoria(req, { accion: "CREAR_BLOQUE", modulo: "BLOQUES", entidad: "Bloque", entidadId: bloque._id, descripcion: `Se creó el bloque ${bloque.nombre}`, datosDespues: { guiaId: guia._id, gestionId: guia.gestionId } });
    return res.status(201).json({ message: "Bloque creado", bloque });
  } catch (error) {
    return res.status(409).json({ error: (error as { code?: number }).code === 11000 ? "El guía ya tiene bloque o el nombre está ocupado" : error instanceof Error ? error.message : "No se pudo crear el bloque" });
  }
}
export const crearBloque = async (req: Request, res: Response) => crearBloqueParaGuia(req, res, req.body.guiaId, req.body.nombre);

async function asignarFraterno(req: Request, res: Response, bloque: any, exigeGenero?: string) {
  const fraterno: any = await Fraterno.findOne({ _id: req.body.fraternoId, gestionId: bloque.gestionId, estado: "ACTIVO", fechaEliminado: null }).populate("usuarioId", "sexo");
  if (!fraterno) return res.status(404).json({ error: "Fraterno no disponible para este bloque" });
  const genero = normalizarGenero(fraterno.usuarioId?.sexo);
  if (!genero || (exigeGenero && genero !== exigeGenero)) return res.status(400).json({ error: "El fraterno no corresponde al sector seleccionado" });
  const maxFilas = genero === "HOMBRE" ? bloque.filasHombres : bloque.filasMujeres;
  const maxColumnas = genero === "HOMBRE" ? bloque.columnasHombres : bloque.columnasMujeres;
  if (req.body.fila > maxFilas || req.body.columna > maxColumnas) return res.status(400).json({ error: "Posición fuera de la capacidad del bloque" });
  const limite = capacidadSector(genero, maxFilas, maxColumnas);
  const cantidad = await DetalleBloque.countDocuments({ bloqueId: bloque._id, genero });
  if (cantidad >= limite) return res.status(409).json({ error: mensajeCupoCompleto(genero) });
  const existente: any = await DetalleBloque.findOne({ fraternoId: fraterno._id }).populate("bloqueId", "nombre");
  if (existente) return res.status(409).json({ error: String(existente.bloqueId?._id ?? existente.bloqueId) === String(bloque._id) ? "Este fraterno ya está en mi bloque." : "Este fraterno ya pertenece a otro bloque." });
  const campoCantidad = genero === "HOMBRE" ? "cantidadHombres" : "cantidadMujeres";
  await Bloque.updateOne({ _id: bloque._id, [campoCantidad]: { $lt: cantidad } }, { $set: { [campoCantidad]: cantidad } });
  const reservado = await Bloque.findOneAndUpdate({ _id: bloque._id, [campoCantidad]: { $lt: limite } }, { $inc: { [campoCantidad]: 1 } }, { new: true });
  if (!reservado) return res.status(409).json({ error: mensajeCupoCompleto(genero) });
  try {
    const detalle = await DetalleBloque.create({ bloqueId: bloque._id, fraternoId: fraterno._id, genero, fila: req.body.fila, columna: req.body.columna });
    await registrarAuditoria(req, { accion: "INCORPORAR_FRATERNO", modulo: "BLOQUES", entidad: "DetalleBloque", entidadId: detalle._id, descripcion: `Se incorporó un fraterno al bloque ${bloque.nombre}`, datosDespues: { bloqueId: bloque._id, fraternoId: fraterno._id, genero, fila: req.body.fila, columna: req.body.columna } });
    return res.status(201).json({ message: "Fraterno agregado al bloque", detalle });
  } catch (error) {
    await Bloque.updateOne({ _id: bloque._id, [campoCantidad]: { $gt: 0 } }, { $inc: { [campoCantidad]: -1 } });
    if ((error as { code?: number }).code === 11000) return res.status(409).json({ error: "El fraterno acaba de ser registrado en otro bloque o la posición ya fue ocupada." });
    return res.status(409).json({ error: error instanceof Error ? error.message : "No se pudo asignar el fraterno" });
  }
}
export const asignarPosicion = async (req: Request, res: Response) => { const bloque = await Bloque.findById(req.body.bloqueId); if (!bloque) return res.status(404).json({ error: "Bloque no encontrado" }); return asignarFraterno(req, res, bloque, req.body.genero); };
export const quitarPosicionComoAdmin = async (req: Request, res: Response) => { const detalle: any = await DetalleBloque.findByIdAndDelete(req.params.detalleId).populate("bloqueId", "nombre"); if (!detalle) return res.status(404).json({ error: "Posición no encontrada" }); const bloqueId=detalle.bloqueId?._id??detalle.bloqueId; const campoCantidad=detalle.genero==="HOMBRE"?"cantidadHombres":"cantidadMujeres"; await Bloque.updateOne({ _id: bloqueId, [campoCantidad]: { $gt: 0 } }, { $inc: { [campoCantidad]: -1 } }); await registrarAuditoria(req, { accion: "RETIRAR_FRATERNO_BLOQUE", modulo: "BLOQUES", entidad: "DetalleBloque", entidadId: detalle._id, descripcion: `Administración retiró un fraterno del bloque ${detalle.bloqueId?.nombre ?? ""}`.trim(), datosAntes: { bloqueId, fraternoId: detalle.fraternoId, genero: detalle.genero, fila: detalle.fila, columna: detalle.columna } }); return res.json({ message: "Fraterno retirado del bloque; vuelve a estar disponible" }); };

export const obtenerMiBloque = async (req: Request, res: Response) => {
  const guia = await Guia.findOne({ usuarioId: req.usuario?._id, estado: "ACTIVO" }).populate(poblarGuia);
  if (!guia) return res.status(403).json({ error: "Tu cuenta no está designada como guía" });
  const bloque = await Bloque.findOne({ $or: [{ guiaId: guia._id }, { guiasIds: guia._id }] }).populate({ path: "guiasIds", populate: poblarGuia });
  const detalles = bloque ? await DetalleBloque.find({ bloqueId: bloque._id }).populate({ path: "fraternoId", populate: [{ path: "usuarioId", select: "nombres apellidoPaterno apellidoMaterno sexo ci telefono" }, { path: "preregistroId", select: "numeroPreRegistro estado" }] }) : [];
  const fraternosDocumentos = await Fraterno.find({ gestionId: guia.gestionId, estado: "ACTIVO", fechaEliminado: null }).populate({ path: "usuarioId", select: "nombres apellidoPaterno apellidoMaterno sexo ci telefono" }).populate("preregistroId", "numeroPreRegistro estado");
  const guiasGestion = await Guia.find({ gestionId: guia.gestionId, estado: "ACTIVO" }).populate(poblarGuia);
  const bloquesGestion = await Bloque.find({ gestionId: guia.gestionId }).select("nombre guiasIds guiaId");
  const ocupados = new Set(bloquesGestion.flatMap((item: any) => [item.guiaId, ...(item.guiasIds ?? [])].map(String)));
  const guiasDisponibles = guiasGestion.filter((item: any) => !ocupados.has(String(item._id)));
  const asignacionesGuias = bloquesGestion.flatMap((item: any) => [item.guiaId, ...(item.guiasIds ?? [])].filter(Boolean).map((guiaId: any) => ({ guiaId: String(guiaId), bloqueId: item._id, bloqueNombre: item.nombre })));
  const cuotas = await Cuota.find({ preregistroId: { $in: fraternosDocumentos.map((item: any) => item.preregistroId?._id ?? item.preregistroId) }, fechaEliminado: null }).select("preregistroId montoTotal montoPagado saldo estado numeroCuotasElegidas").lean();
  const pagosVerificados = await DetalleCuota.aggregate([{ $match: { cuotaId: { $in: cuotas.map((cuota) => cuota._id) }, estadoRevision: "VERIFICADO", fechaEliminado: null } }, { $group: { _id: "$cuotaId", total: { $sum: 1 } } }]);
  const cantidadPagos = new Map(pagosVerificados.map((item) => [String(item._id), item.total]));
  const cuotaPorPreregistro = new Map(cuotas.map((cuota) => [String(cuota.preregistroId), { ...cuota, cuotasPagadas: cantidadPagos.get(String(cuota._id)) ?? 0 }]));
  const fraternos = fraternosDocumentos.map((item: any) => ({ ...item.toObject(), pago: cuotaPorPreregistro.get(String(item.preregistroId?._id ?? item.preregistroId)) ?? null }));
  const asignacionesFraternos = await DetalleBloque.find({ fraternoId: { $in: fraternosDocumentos.map((item) => item._id) } }).populate("bloqueId", "nombre").select("fraternoId bloqueId fila columna");
  return res.json({ guia, bloque, detalles, fraternos, guiasDisponibles, guiasGestion, asignacionesGuias, asignacionesFraternos, limites: LIMITES_BLOQUE });
};
export const crearMiBloque = async (req: Request, res: Response) => {
  const guia = await Guia.findOne({ usuarioId: req.usuario?._id, estado: "ACTIVO" });
  if (!guia) return res.status(403).json({ error: "Tu cuenta no está designada como guía" });
  return crearBloqueParaGuia(req, res, String(guia._id), req.body.nombre);
};
export const agregarGuiaAMiBloque = async (req: Request, res: Response) => {
  const responsable = await Guia.findOne({ usuarioId: req.usuario?._id, estado: "ACTIVO" });
  const bloque: any = responsable ? await Bloque.findOne({ guiaId: responsable._id }) : null;
  if (!bloque) return res.status(403).json({ error: "Solo el guía responsable puede agregar integrantes" });
  if ((bloque.guiasIds?.length ?? 1) >= LIMITES_BLOQUE.GUIAS_TOTAL) return res.status(400).json({ error: "El bloque ya tiene el máximo de 4 guías" });
  const nuevoGuia = await Guia.findOne({ _id: req.body.guiaId, gestionId: responsable!.gestionId, estado: "ACTIVO" }).populate("usuarioId", "sexo");
  if (!nuevoGuia) return res.status(404).json({ error: "Guía no disponible en esta gestión" });
  const genero = normalizarGenero((nuevoGuia.usuarioId as any)?.sexo);
  if (!genero) return res.status(409).json({ error: "El guía debe tener registrado su sexo" });
  const otroBloque = await Bloque.findOne({ _id: { $ne: bloque._id }, $or: [{ guiaId: nuevoGuia._id }, { guiasIds: nuevoGuia._id }] });
  if (otroBloque) return res.status(409).json({ error: "Este guía ya pertenece a otro bloque" });
  const campoCantidad = genero === "HOMBRE" ? "cantidadGuiasHombres" : "cantidadGuiasMujeres";
  try {
    const actualizado = await Bloque.findOneAndUpdate(
      { _id: bloque._id, guiasIds: { $ne: nuevoGuia._id }, [campoCantidad]: { $lt: LIMITES_BLOQUE.GUIAS_POR_GENERO } },
      { $addToSet: { guiasIds: nuevoGuia._id }, $inc: { [campoCantidad]: 1 } },
      { new: true, runValidators: true },
    );
    if (!actualizado) return res.status(409).json({ error: `El bloque ya tiene 2 guías ${genero === "HOMBRE" ? "hombres" : "mujeres"}.` });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) return res.status(409).json({ error: "Este guía acaba de ser asignado a otro bloque." });
    throw error;
  }
  await registrarAuditoria(req, { accion: "AGREGAR_GUIA_BLOQUE", modulo: "BLOQUES", entidad: "Bloque", entidadId: bloque._id, descripcion: `Se agregó un guía ${genero.toLowerCase()} al bloque ${bloque.nombre}`, datosDespues: { guiaId: nuevoGuia._id, genero } });
  return res.json({ message: "Guía agregado al bloque" });
};
export const quitarGuiaDeMiBloque = async (req: Request, res: Response) => {
  return res.status(403).json({ error: "Solo administración puede retirar o mover un guía de bloque" });
};
export const moverGuiaComoAdmin = async (req: Request, res: Response) => {
  const guia = await Guia.findById(req.params.guiaId).populate("usuarioId", "sexo");
  if (!guia) return res.status(404).json({ error: "Guía no encontrado" });
  const genero = normalizarGenero((guia.usuarioId as any)?.sexo);
  if (!genero) return res.status(409).json({ error: "El guía debe tener registrado su sexo" });
  const campoCantidad = genero === "HOMBRE" ? "cantidadGuiasHombres" : "cantidadGuiasMujeres";
  const bloqueOrigen: any = await Bloque.findOne({ $or: [{ guiaId: guia._id }, { guiasIds: guia._id }] });
  if (bloqueOrigen && String(bloqueOrigen.guiaId) === String(guia._id)) return res.status(409).json({ error: "Este guía es responsable del bloque; asigna antes otro responsable" });
  if (bloqueOrigen && String(req.body.bloqueId ?? "") === String(bloqueOrigen._id)) return res.json({ message: "El guía ya pertenece a este bloque" });
  const destinoSolicitado: any = req.body.bloqueId ? await Bloque.findById(req.body.bloqueId) : null;
  if (req.body.bloqueId && (!destinoSolicitado || String(destinoSolicitado.gestionId) !== String(guia.gestionId))) return res.status(400).json({ error: "Bloque destino no válido" });
  if (bloqueOrigen) await Bloque.updateOne({ _id: bloqueOrigen._id }, { $pull: { guiasIds: guia._id }, $inc: { [campoCantidad]: -1 } });
  if (req.body.bloqueId) {
    const destino = destinoSolicitado;
    const actualizado = await Bloque.findOneAndUpdate({ _id: destino._id, guiasIds: { $ne: guia._id }, [campoCantidad]: { $lt: LIMITES_BLOQUE.GUIAS_POR_GENERO }, $expr: { $lt: [{ $size: "$guiasIds" }, LIMITES_BLOQUE.GUIAS_TOTAL] } }, { $addToSet: { guiasIds: guia._id }, $inc: { [campoCantidad]: 1 } }, { new: true, runValidators: true }).catch(() => null);
    if (!actualizado) {
      if (bloqueOrigen) await Bloque.updateOne({ _id: bloqueOrigen._id }, { $addToSet: { guiasIds: guia._id }, $inc: { [campoCantidad]: 1 } });
      return res.status(409).json({ error: `El bloque destino no tiene cupo para otro guía ${genero === "HOMBRE" ? "hombre" : "mujer"}` });
    }
  }
  await registrarAuditoria(req, { accion: req.body.bloqueId ? "MOVER_GUIA_BLOQUE" : "RETIRAR_GUIA_BLOQUE", modulo: "BLOQUES", entidad: "Guia", entidadId: guia._id, descripcion: req.body.bloqueId ? "Administración movió un guía a otro bloque" : "Administración retiró un guía de su bloque", datosAntes: { bloqueId: bloqueOrigen?._id }, datosDespues: { bloqueId: req.body.bloqueId ?? null, genero } });
  return res.json({ message: req.body.bloqueId ? "Guía movido por administración" : "Guía retirado del bloque por administración" });
};
export const configurarMiBloque = async (req: Request, res: Response) => {
  const guia = await Guia.findOne({ usuarioId: req.usuario?._id, estado: "ACTIVO" });
  const bloque: any = guia ? await Bloque.findOne({ $or: [{ guiaId: guia._id }, { guiasIds: guia._id }] }) : null;
  if (!bloque) return res.status(404).json({ error: "Bloque no encontrado" });
  const campos = ["filasHombres", "columnasHombres", "filasMujeres", "columnasMujeres"] as const;
  const nuevaConfiguracion: any = Object.fromEntries(campos.map((campo) => [campo, Number(req.body[campo])]));
  const errorCapacidad = validarDimensionesBloque(nuevaConfiguracion);
  if (errorCapacidad) return res.status(409).json({ error: errorCapacidad });
  const ocupadas = await DetalleBloque.find({ bloqueId: bloque._id });
  const fueraDeRango = ocupadas.find((posicion: any) => posicion.fila > nuevaConfiguracion[posicion.genero === "HOMBRE" ? "filasHombres" : "filasMujeres"] || posicion.columna > nuevaConfiguracion[posicion.genero === "HOMBRE" ? "columnasHombres" : "columnasMujeres"]);
  if (fueraDeRango) return res.status(409).json({ error: "No puedes reducir la capacidad porque existen fraternos en las filas o columnas que desaparecerían" });
  const actualizado = await Bloque.findByIdAndUpdate(bloque._id, nuevaConfiguracion, { new: true, runValidators: true });
  return res.json({ message: "Capacidad del bloque actualizada", bloque: actualizado });
};
export const asignarEnMiBloque = async (req: Request, res: Response) => {
  const guia = await Guia.findOne({ usuarioId: req.usuario?._id, estado: "ACTIVO" });
  const bloque = guia ? await Bloque.findOne({ _id: req.body.bloqueId, $or: [{ guiaId: guia._id }, { guiasIds: guia._id }] }) : null;
  if (!bloque) return res.status(403).json({ error: "No puedes modificar este bloque" });
  return asignarFraterno(req, res, bloque);
};
export const quitarDeMiBloque = async (req: Request, res: Response) => {
  return res.status(403).json({ error: "Un Guía no puede retirar fraternos del bloque. Solicita la acción a un Administrador." });
};
export const moverEnMiBloque = async (req: Request, res: Response) => {
  const guia = await Guia.findOne({ usuarioId: req.usuario?._id, estado: "ACTIVO" });
  const bloque: any = guia ? await Bloque.findOne({ $or: [{ guiaId: guia._id }, { guiasIds: guia._id }] }) : null;
  if (!bloque) return res.status(403).json({ error: "No tienes acceso a este bloque" });
  const detalle: any = await DetalleBloque.findOne({ _id: req.params.detalleId, bloqueId: bloque._id });
  if (!detalle) return res.status(404).json({ error: "Fraterno no encontrado en tu bloque" });
  const maxFilas = detalle.genero === "HOMBRE" ? bloque.filasHombres : bloque.filasMujeres;
  const maxColumnas = detalle.genero === "HOMBRE" ? bloque.columnasHombres : bloque.columnasMujeres;
  if (req.body.fila > maxFilas || req.body.columna > maxColumnas) return res.status(400).json({ error: "La posición destino está fuera de la capacidad" });
  const ocupada = await DetalleBloque.findOne({ bloqueId: bloque._id, genero: detalle.genero, fila: req.body.fila, columna: req.body.columna, _id: { $ne: detalle._id } });
  if (ocupada) return res.status(409).json({ error: "La posición destino ya está ocupada" });
  detalle.fila = req.body.fila; detalle.columna = req.body.columna; await detalle.save();
  return res.json({ message: "Fraterno movido a la nueva posición", detalle });
};
