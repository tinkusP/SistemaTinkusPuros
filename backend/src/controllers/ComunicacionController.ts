import type { Request, Response } from "express";
import Anuncio from "../models/Anuncio";
import Notificacion from "../models/Notificacion";
import PerfilUsuario from "../models/PerfilUsuario";
import Auditoria from "../models/Auditoria";
import { registrarAuditoria } from "../services/AuditoriaService";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

export const listarAnuncios = async (_req: Request, res: Response) => res.json({ anuncios: await Anuncio.find({ fechaEliminado: null }).sort({ fechaCreado: -1 }) });
export const crearAnuncio = async (req: Request, res: Response) => {
  const anuncio = await Anuncio.create({ ...req.body, publicado: String(req.body.publicado) === "true", usuarioCreador: req.usuario?._id, fechaPublicacion: String(req.body.publicado) === "true" ? new Date() : undefined });
  if (req.file) {
    const carpeta = path.resolve(process.cwd(), "public", "uploads", "anuncios");
    await fs.mkdir(carpeta, { recursive: true });
    const nombre = `AFICHE_${anuncio._id}.webp`;
    await sharp(req.file.buffer).rotate().resize({ width: 1800, height: 2400, fit: "inside", withoutEnlargement: true }).webp({ quality: 84 }).toFile(path.join(carpeta, nombre));
    anuncio.afiche = `/uploads/anuncios/${nombre}`;
    await anuncio.save();
  }
  if (anuncio.publicado && anuncio.tipo !== "ENSAYO") { const usuarios = await PerfilUsuario.find({ estado: "ACTIVO", fechaEliminado: null }).select("_id"); await Notificacion.insertMany(usuarios.map((u) => ({ usuarioId: u._id, anuncioId: anuncio._id, titulo: anuncio.titulo, mensaje: anuncio.contenido, tipo: anuncio.tipo === "URGENTE" ? "ADVERTENCIA" : "INFO", enlace: "/comunicados" })), { ordered: false }).catch(() => undefined); }
  await registrarAuditoria(req, { accion: "CREAR", modulo: "ANUNCIOS", entidad: "Anuncio", entidadId: anuncio._id, descripcion: `Se creó el anuncio ${anuncio.titulo}`, datosDespues: anuncio.toObject() });
  return res.status(201).json({ message: "Anuncio creado", anuncio });
};
export const actualizarAnuncio = async (req: Request, res: Response) => { const antes = await Anuncio.findById(req.params.id).lean(); const anuncio = await Anuncio.findOneAndUpdate({ _id: req.params.id, fechaEliminado: null }, { $set: { ...req.body, fechaEditado: new Date(), usuarioEditor: req.usuario?._id } }, { new: true, runValidators: true }); if (!anuncio) return res.status(404).json({ error: "Anuncio no encontrado" }); await registrarAuditoria(req, { accion: "ACTUALIZAR", modulo: "ANUNCIOS", entidad: "Anuncio", entidadId: anuncio._id, descripcion: "Se actualizó un anuncio", datosAntes: antes, datosDespues: anuncio.toObject() }); return res.json({ message: "Anuncio actualizado", anuncio }); };
export const eliminarAnuncio = async (req: Request, res: Response) => { const anuncio = await Anuncio.findOneAndUpdate({ _id: req.params.id, fechaEliminado: null }, { fechaEliminado: new Date() }, { new: true }); if (!anuncio) return res.status(404).json({ error: "Anuncio no encontrado" }); await registrarAuditoria(req, { accion: "ELIMINAR", modulo: "ANUNCIOS", entidadId: anuncio._id, descripcion: "Se eliminó un anuncio" }); return res.json({ message: "Anuncio eliminado" }); };
export const misNotificaciones = async (req: Request, res: Response) => { const ahora = new Date(); const ensayos = await Anuncio.find({ publicado: true, tipo: "ENSAYO", fechaEliminado: null, fechaEvento: { $gte: ahora } }); await Promise.all(ensayos.filter((a) => a.fechaEvento && a.fechaEvento.getTime() - ahora.getTime() <= (a.recordatorioHoras ?? 24) * 3600000).map((a) => Notificacion.updateOne({ usuarioId: req.usuario?._id, anuncioId: a._id }, { $setOnInsert: { titulo: `Recordatorio: ${a.titulo}`, mensaje: `${a.contenido}${a.lugar ? ` · Lugar: ${a.lugar}` : ""}`, tipo: "ADVERTENCIA", enlace: "/comunicados", leida: false, fechaCreado: ahora } }, { upsert: true }))); const notificaciones = await Notificacion.find({ usuarioId: req.usuario?._id }).sort({ fechaCreado: -1 }).limit(100); res.json({ notificaciones, noLeidas: notificaciones.filter((n) => !n.leida).length }); };
export const marcarLeida = async (req: Request, res: Response) => { const notificacion = await Notificacion.findOneAndUpdate({ _id: req.params.id, usuarioId: req.usuario?._id }, { leida: true, fechaLeida: new Date() }, { new: true }); if (!notificacion) return res.status(404).json({ error: "Notificación no encontrada" }); return res.json({ notificacion }); };
export const listarAuditoria = async (req: Request, res: Response) => { const filtro: Record<string, unknown> = {}; if (req.query.modulo) filtro.modulo = req.query.modulo; if (req.query.accion) filtro.accion = req.query.accion; const eventos = await Auditoria.find(filtro).populate("usuarioId", "nombres apellidoPaterno email fotoPerfil").sort({ fecha: -1 }).limit(Math.min(Number(req.query.limite) || 100, 500)); res.json({ eventos }); };
export const registrarLogout = async (req: Request, res: Response) => { await registrarAuditoria(req, { accion: "CERRAR_SESION", modulo: "AUTENTICACION", descripcion: "El usuario cerró sesión" }); res.json({ message: "Cierre de sesión registrado" }); };
