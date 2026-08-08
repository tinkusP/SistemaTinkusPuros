import type { Request, Response } from "express";
import path from "node:path";
import { promises as fs } from "node:fs";
import sharp from "sharp";
import PerfilUsuario from "../models/PerfilUsuario";
import DocumentoUsuario, { type TipoDocumentoUsuario } from "../models/DocumentoUsuario";
import Autorizacion from "../models/AutorizacionEdicionPerfil";
import { comprimirPdfOptimizado } from "../services/pdfService";
import {
  eliminarArchivoAlmacenado,
  subirArchivoProcesado,
} from "../services/AlmacenamientoService";

type Archivo = { path: string; mimetype: string };
type CampoAutorizado = "DATOS_PERSONALES" | "FOTO_PERFIL" | "CARNET_ANVERSO" | "CARNET_REVERSO" | "REGISTRO_UNIVERSITARIO";

const eliminarArchivoPublico = async (ruta?: string | null) => {
  await eliminarArchivoAlmacenado(ruta);
};

export const completarPerfilAutorizado = async (req: Request, res: Response) => {
  const autorizacion = await Autorizacion.findOne({ perfilUsuarioId: req.usuario?._id, estado: "ACTIVA", fechaVencimiento: { $gt: new Date() } });
  if (!autorizacion) return res.status(403).json({ error: "No tiene una autorización vigente para editar archivos" });
  const perfil = await PerfilUsuario.findById(req.usuario?._id);
  if (!perfil) return res.status(404).json({ error: "Perfil no encontrado" });

  const files = (req.files ?? {}) as Record<string, Archivo[]>;
  const entradas: Array<{ archivo?: Archivo; permiso: CampoAutorizado; campo: string }> = [
    { archivo: files.fotoPerfil?.[0], permiso: "FOTO_PERFIL", campo: "foto" },
    { archivo: files.carnetIdentidadPdf?.[0], permiso: "CARNET_ANVERSO", campo: "carnet" },
    { archivo: files.carnetIdentidadReverso?.[0], permiso: "CARNET_REVERSO", campo: "reverso" },
    { archivo: files.registroUniversitarioPdf?.[0], permiso: "REGISTRO_UNIVERSITARIO", campo: "ru" },
  ];
  const enviados = entradas.filter((item) => item.archivo);
  const camposDatos = ["nombres", "apellidoPaterno", "apellidoMaterno", "telefono", "ci", "fechaNacimiento", "sexo"] as const;
  const hayDatosPersonales = camposDatos.some((campo) => req.body[campo] !== undefined);
  if (!enviados.length && !hayDatosPersonales) return res.status(400).json({ error: "Debe modificar datos o seleccionar al menos un archivo autorizado" });
  if (hayDatosPersonales && !autorizacion.campos.includes("DATOS_PERSONALES")) return res.status(403).json({ error: "No fue autorizado para modificar datos personales" });
  const noPermitido = enviados.find((item) => !autorizacion.campos.includes(item.permiso));
  if (noPermitido) return res.status(403).json({ error: `No fue autorizado para actualizar: ${noPermitido.permiso}` });

  const ci = files.carnetIdentidadPdf?.[0];
  const reverso = files.carnetIdentidadReverso?.[0];
  if (ci && ci.mimetype !== "application/pdf" && autorizacion.campos.includes("CARNET_REVERSO") && !reverso) return res.status(400).json({ error: "Debe subir también el reverso del carnet" });
  if (reverso?.mimetype === "application/pdf") return res.status(400).json({ error: "El reverso debe ser una imagen" });

  const seguro = String(hayDatosPersonales ? req.body.ci : perfil.ci).replace(/[^a-zA-Z0-9_-]/g, "_");
  const carpeta = path.resolve(process.cwd(), "public", "uploads", "cuentas-perfil", seguro);
  await fs.mkdir(carpeta, { recursive: true });

  const guardarDocumento = async (archivo: Archivo | undefined, prefijo: string, tipo: TipoDocumentoUsuario) => {
    if (!archivo) return;
    const anterior = await DocumentoUsuario.findOne({ perfilUsuario: perfil._id, tipoDocumento: tipo, fechaEliminado: null });
    const esPdf = archivo.mimetype === "application/pdf";
    const nombre = `${prefijo}_${seguro}.${esPdf ? "pdf" : "webp"}`;
    const salida = path.join(carpeta, nombre);
    if (esPdf) await comprimirPdfOptimizado({ rutaEntrada: archivo.path, rutaSalida: salida });
    else await sharp(archivo.path).rotate().resize({ width: 1800, height: 1800, fit: "inside", withoutEnlargement: true }).webp({ quality: 78 }).toFile(salida);
    const nuevaRuta = `/uploads/cuentas-perfil/${seguro}/${nombre}`;
    await subirArchivoProcesado(
      nuevaRuta,
      salida,
      esPdf ? "application/pdf" : "image/webp",
    );
    if (anterior?.ruta && anterior.ruta !== nuevaRuta) await eliminarArchivoPublico(anterior.ruta);
    await DocumentoUsuario.findOneAndUpdate({ perfilUsuario: perfil._id, tipoDocumento: tipo, fechaEliminado: null }, { ruta: nuevaRuta, estado: "PENDIENTE", observacion: null, usuarioEdit: perfil._id, fechaEdit: new Date() }, { upsert: true, new: true });
  };

  try {
    if (hayDatosPersonales) {
      const ciNuevo = String(req.body.ci ?? "").trim();
      if (!/^\d+$/.test(ciNuevo)) return res.status(400).json({ error: "El CI solo puede contener números" });
      const sexo = String(req.body.sexo ?? "").trim().toUpperCase();
      if (!["HOMBRE", "MUJER"].includes(sexo)) return res.status(400).json({ error: "El género debe ser HOMBRE o MUJER" });
      const requerido = (campo: string, etiqueta: string) => { const valor = String(req.body[campo] ?? "").trim(); if (!valor) throw new Error(`${etiqueta} es obligatorio`); return valor.toLocaleUpperCase("es-BO"); };
      perfil.nombres = requerido("nombres", "El nombre");
      perfil.apellidoPaterno = requerido("apellidoPaterno", "El apellido paterno");
      perfil.apellidoMaterno = String(req.body.apellidoMaterno ?? "").trim().toLocaleUpperCase("es-BO") || undefined;
      perfil.telefono = requerido("telefono", "El celular");
      perfil.ci = ciNuevo;
      perfil.sexo = sexo;
      perfil.fechaNacimiento = req.body.fechaNacimiento ? new Date(req.body.fechaNacimiento) : undefined;
      await perfil.save();
    }
    const foto = files.fotoPerfil?.[0];
    if (foto) {
      const nombre = `FOTO_${seguro}.webp`;
      const nuevaRuta = `/uploads/cuentas-perfil/${seguro}/${nombre}`;
      const salida = path.join(carpeta, nombre);
      await sharp(foto.path).rotate().resize({ width: 1000, height: 1000, fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toFile(salida);
      await subirArchivoProcesado(nuevaRuta, salida, "image/webp");
      if (perfil.fotoPerfil && perfil.fotoPerfil !== nuevaRuta) await eliminarArchivoPublico(perfil.fotoPerfil);
      perfil.fotoPerfil = nuevaRuta;
      await perfil.save();
    }
    await guardarDocumento(files.carnetIdentidadPdf?.[0], "CI", "CARNET_IDENTIDAD");
    await guardarDocumento(files.carnetIdentidadReverso?.[0], "CI_REVERSO", "CARNET_IDENTIDAD_REVERSO");
    await guardarDocumento(files.registroUniversitarioPdf?.[0], "RU", "REGISTRO_UNIVERSITARIO");
    autorizacion.estado = "USADA"; autorizacion.fechaUso = new Date(); await autorizacion.save();
    return res.json({ message: "Archivos reemplazados correctamente y pendientes de revisión" });
  } finally {
    await Promise.all(Object.values(files).flat().map((archivo) => fs.rm(archivo.path, { force: true })));
  }
};
