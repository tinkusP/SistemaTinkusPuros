import type { Request, Response } from "express";
import PostulanteGuia from "../models/PostulanteGuia"; import Guia from "../models/Guia"; import Bloque from "../models/Bloque"; import DetalleBloque from "../models/DetalleBloque"; import Cuota from "../models/Cuota";
import Fraterno from "../models/Fraterno";
import PerfilUsuario from "../models/PerfilUsuario";
import Rol from "../models/Rol";
import { registrarAuditoria } from "../services/AuditoriaService";
const poblarGuia = [{ path: "usuarioId", select: "nombres apellidoPaterno apellidoMaterno ci sexo" }, { path: "gestionId", select: "nombre anio" }, { path: "preregistroId", select: "numeroPreRegistro" }];
const normalizarGenero = (valor: unknown) => {
  const genero = String(valor ?? "").trim().toUpperCase();
  if (["HOMBRE", "MASCULINO", "VARON", "VARÓN"].includes(genero)) return "HOMBRE";
  if (["MUJER", "FEMENINO"].includes(genero)) return "MUJER";
  return null;
};
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
    const rol = await Rol.findOneAndUpdate({ codigo: "GUIA" }, { $set: { nombre: "Guía", estado: true, fechaEliminado: null }, $setOnInsert: { codigo: "GUIA", descripcion: "Organiza y administra su bloque", esRolSistema: true } }, { upsert: true, new: true });
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
export const crearBloque = async (req: Request, res: Response) => { try { const guia = await Guia.findById(req.body.guiaId); if (!guia) return res.status(404).json({ error: "Guía no encontrado" }); const bloque = await Bloque.create({ nombre: req.body.nombre, guiaId: guia._id, gestionId: guia.gestionId, usuarioCreador: req.usuario?._id }); res.status(201).json({ message: "Bloque creado", bloque }); } catch { res.status(409).json({ error: "El guía ya tiene bloque o el nombre está ocupado" }); } };
export const asignarPosicion = async (req: Request, res: Response) => { try { const bloque: any = await Bloque.findById(req.body.bloqueId); if (!bloque) return res.status(404).json({ error: "Bloque no encontrado" }); const fraterno: any = await Fraterno.findOne({ _id: req.body.fraternoId, gestionId: bloque.gestionId, estado: "ACTIVO", fechaEliminado: null }).populate("usuarioId", "sexo"); if (!fraterno) return res.status(404).json({ error: "Fraterno no disponible para este bloque" }); const genero = normalizarGenero(fraterno.usuarioId?.sexo); if (!genero || genero !== req.body.genero) return res.status(400).json({ error: "El fraterno no corresponde al sector seleccionado" }); const maxFilas = genero === "HOMBRE" ? bloque.filasHombres : bloque.filasMujeres; const maxColumnas = genero === "HOMBRE" ? bloque.columnasHombres : bloque.columnasMujeres; if (req.body.fila > maxFilas || req.body.columna > maxColumnas) return res.status(400).json({ error: "Posición fuera de la capacidad del bloque" }); const detalle = await DetalleBloque.create({ bloqueId: bloque._id, fraternoId: fraterno._id, genero, fila: req.body.fila, columna: req.body.columna }); return res.status(201).json({ message: "Fraterno asignado al bloque", detalle }); } catch (e) { return res.status(409).json({ error: e instanceof Error ? e.message : "Posición o fraterno duplicado" }); } };
export const quitarPosicionComoAdmin = async (req: Request, res: Response) => { const detalle = await DetalleBloque.findByIdAndDelete(req.params.detalleId); if (!detalle) return res.status(404).json({ error: "Posición no encontrada" }); return res.json({ message: "Fraterno retirado del bloque" }); };

export const obtenerMiBloque = async (req: Request, res: Response) => {
  const guia = await Guia.findOne({ usuarioId: req.usuario?._id, estado: "ACTIVO" }).populate(poblarGuia);
  if (!guia) return res.status(403).json({ error: "Tu cuenta no está designada como guía" });
  const bloque = await Bloque.findOne({ $or: [{ guiaId: guia._id }, { guiasIds: guia._id }] }).populate({ path: "guiasIds", populate: poblarGuia });
  const detalles = bloque ? await DetalleBloque.find({ bloqueId: bloque._id }).populate({ path: "fraternoId", populate: { path: "usuarioId", select: "nombres apellidoPaterno apellidoMaterno sexo ci" } }) : [];
  const fraternos = await Fraterno.find({ gestionId: guia.gestionId, estado: "ACTIVO", fechaEliminado: null }).populate({ path: "usuarioId", select: "nombres apellidoPaterno apellidoMaterno sexo ci" });
  const guiasGestion = await Guia.find({ gestionId: guia.gestionId, estado: "ACTIVO" }).populate(poblarGuia);
  const bloquesGestion = await Bloque.find({ gestionId: guia.gestionId }).select("nombre guiasIds guiaId");
  const ocupados = new Set(bloquesGestion.flatMap((item: any) => [item.guiaId, ...(item.guiasIds ?? [])].map(String)));
  const guiasDisponibles = guiasGestion.filter((item: any) => !ocupados.has(String(item._id)));
  const asignacionesGuias = bloquesGestion.flatMap((item: any) => [item.guiaId, ...(item.guiasIds ?? [])].filter(Boolean).map((guiaId: any) => ({ guiaId: String(guiaId), bloqueId: item._id, bloqueNombre: item.nombre })));
  const asignacionesFraternos = await DetalleBloque.find({ fraternoId: { $in: fraternos.map((item: any) => item._id) } }).populate("bloqueId", "nombre").select("fraternoId bloqueId fila columna");
  return res.json({ guia, bloque, detalles, fraternos, guiasDisponibles, guiasGestion, asignacionesGuias, asignacionesFraternos });
};
export const crearMiBloque = async (req: Request, res: Response) => {
  const guia = await Guia.findOne({ usuarioId: req.usuario?._id, estado: "ACTIVO" });
  if (!guia) return res.status(403).json({ error: "Tu cuenta no está designada como guía" });
  try { const bloque = await Bloque.create({ nombre: req.body.nombre, guiaId: guia._id, guiasIds: [guia._id], gestionId: guia.gestionId, usuarioCreador: req.usuario?._id }); return res.status(201).json({ message: "Bloque creado. Ahora agrega 2 o 3 guías más", bloque }); }
  catch { return res.status(409).json({ error: "Ya tienes un bloque o el nombre está ocupado" }); }
};
export const agregarGuiaAMiBloque = async (req: Request, res: Response) => {
  const responsable = await Guia.findOne({ usuarioId: req.usuario?._id, estado: "ACTIVO" });
  const bloque: any = responsable ? await Bloque.findOne({ guiaId: responsable._id }) : null;
  if (!bloque) return res.status(403).json({ error: "Solo el guía responsable puede agregar integrantes" });
  if ((bloque.guiasIds?.length ?? 1) >= 4) return res.status(400).json({ error: "El bloque ya tiene el máximo de 4 guías" });
  const nuevoGuia = await Guia.findOne({ _id: req.body.guiaId, gestionId: responsable!.gestionId, estado: "ACTIVO" });
  if (!nuevoGuia) return res.status(404).json({ error: "Guía no disponible en esta gestión" });
  const otroBloque = await Bloque.findOne({ _id: { $ne: bloque._id }, $or: [{ guiaId: nuevoGuia._id }, { guiasIds: nuevoGuia._id }] });
  if (otroBloque) return res.status(409).json({ error: "Este guía ya pertenece a otro bloque" });
  await Bloque.updateOne({ _id: bloque._id }, { $addToSet: { guiasIds: { $each: [responsable!._id, nuevoGuia._id] } } }, { runValidators: true });
  return res.json({ message: "Guía agregado al bloque" });
};
export const quitarGuiaDeMiBloque = async (req: Request, res: Response) => {
  return res.status(403).json({ error: "Solo administración puede retirar o mover un guía de bloque" });
};
export const moverGuiaComoAdmin = async (req: Request, res: Response) => {
  const guia = await Guia.findById(req.params.guiaId);
  if (!guia) return res.status(404).json({ error: "Guía no encontrado" });
  const bloqueOrigen: any = await Bloque.findOne({ $or: [{ guiaId: guia._id }, { guiasIds: guia._id }] });
  if (bloqueOrigen && String(bloqueOrigen.guiaId) === String(guia._id)) return res.status(409).json({ error: "Este guía es responsable del bloque; asigna antes otro responsable" });
  if (bloqueOrigen) await Bloque.updateOne({ _id: bloqueOrigen._id }, { $pull: { guiasIds: guia._id } });
  if (req.body.bloqueId) {
    const destino: any = await Bloque.findById(req.body.bloqueId);
    if (!destino || String(destino.gestionId) !== String(guia.gestionId)) return res.status(400).json({ error: "Bloque destino no válido" });
    if ((destino.guiasIds?.length ?? 1) >= 4) return res.status(409).json({ error: "El bloque destino ya tiene 4 guías" });
    await Bloque.updateOne({ _id: destino._id }, { $addToSet: { guiasIds: guia._id } });
  }
  return res.json({ message: req.body.bloqueId ? "Guía movido por administración" : "Guía retirado del bloque por administración" });
};
export const configurarMiBloque = async (req: Request, res: Response) => {
  const guia = await Guia.findOne({ usuarioId: req.usuario?._id, estado: "ACTIVO" });
  const bloque: any = guia ? await Bloque.findOne({ $or: [{ guiaId: guia._id }, { guiasIds: guia._id }] }) : null;
  if (!bloque) return res.status(404).json({ error: "Bloque no encontrado" });
  const campos = ["filasHombres", "columnasHombres", "filasMujeres", "columnasMujeres"] as const;
  const nuevaConfiguracion: any = Object.fromEntries(campos.map((campo) => [campo, Number(req.body[campo])]));
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
  const fraterno: any = await Fraterno.findOne({ _id: req.body.fraternoId, gestionId: guia!.gestionId, estado: "ACTIVO" }).populate("usuarioId", "sexo");
  if (!fraterno) return res.status(404).json({ error: "Fraterno no disponible" });
  const genero = normalizarGenero(fraterno.usuarioId?.sexo);
  if (!genero) return res.status(400).json({ error: "El fraterno no tiene género HOMBRE o MUJER registrado" });
  const maxFilas = genero === "HOMBRE" ? bloque.filasHombres : bloque.filasMujeres;
  const maxColumnas = genero === "HOMBRE" ? bloque.columnasHombres : bloque.columnasMujeres;
  if (req.body.fila > maxFilas || req.body.columna > maxColumnas) return res.status(400).json({ error: "La posición está fuera de la capacidad configurada" });
  const cantidad = await DetalleBloque.countDocuments({ bloqueId: bloque._id, genero });
  if (cantidad >= maxFilas * maxColumnas) return res.status(409).json({ error: `El bloque de ${genero === "HOMBRE" ? "hombres" : "mujeres"} ya está lleno` });
  const asignacionExistente: any = await DetalleBloque.findOne({ fraternoId: fraterno._id }).populate("bloqueId", "nombre");
  if (asignacionExistente) return res.status(409).json({ error: `Este fraterno ya pertenece al bloque ${asignacionExistente.bloqueId?.nombre ?? "otro bloque"}. Debe pedir a su guía que lo retire antes.` });
  try { const detalle = await DetalleBloque.create({ bloqueId: bloque._id, fraternoId: fraterno._id, genero, fila: req.body.fila, columna: req.body.columna }); return res.status(201).json({ message: "Posición asignada", detalle }); }
  catch (error) { return res.status(409).json({ error: error instanceof Error ? error.message : "La posición está ocupada" }); }
};
export const quitarDeMiBloque = async (req: Request, res: Response) => {
  const guia = await Guia.findOne({ usuarioId: req.usuario?._id, estado: "ACTIVO" });
  const bloque = guia ? await Bloque.findOne({ $or: [{ guiaId: guia._id }, { guiasIds: guia._id }] }) : null;
  const detalle = bloque ? await DetalleBloque.findOneAndDelete({ _id: req.params.detalleId, bloqueId: bloque._id }) : null;
  if (!detalle) return res.status(404).json({ error: "Posición no encontrada" });
  return res.json({ message: "Fraterno retirado de la posición" });
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
