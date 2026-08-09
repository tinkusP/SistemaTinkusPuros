import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import sharp from "sharp";
import { promises as fsPromises } from "node:fs";
import type { NextFunction, Request, Response } from "express";
import { subirArchivoProcesado } from "../services/AlmacenamientoService";
import { comprimirPdfOptimizado, verificarArchivoPdf } from "../services/pdfService";

type ArchivoComprobante = Express.Multer.File & { rutaPublica?: string };
const imagenes = new Set(["image/jpeg", "image/jfif", "image/png", "image/webp", "image/avif", "image/heic", "image/heif", "image/tiff", "image/gif", "image/bmp"]);
const extensionesImagen = new Set([".jpg", ".jpeg", ".jfif", ".png", ".webp", ".avif", ".heic", ".heif", ".tif", ".tiff", ".gif", ".bmp"]);
const ciSeguro = (req: Request) => String(req.usuario?.ci || "SIN_CI").replace(/[^a-zA-Z0-9_-]/g, "_");
const carpetaUsuario = (req: Request) => path.resolve(process.cwd(), "public", "uploads", "cuentas-perfil", ciSeguro(req), "comprobantes");

const storage = multer.diskStorage({
  destination: (req, _file, callback) => {
    const carpeta = carpetaUsuario(req);
    fs.mkdirSync(carpeta, { recursive: true });
    callback(null, carpeta);
  },
  filename: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase() || ".archivo";
    callback(null, `TEMP_COMPROBANTE_${ciSeguro(req)}_${Date.now()}_${crypto.randomUUID()}${extension}`);
  },
});

export const uploadBaucher = multer({
  storage,
  limits: { fileSize: 30 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const esPdf = extension === ".pdf" && ["application/pdf", "application/octet-stream"].includes(file.mimetype);
    if (esPdf || imagenes.has(file.mimetype) || extensionesImagen.has(extension)) return callback(null, true);
    callback(new Error("El comprobante debe ser una imagen o un archivo PDF válido"));
  },
});

export async function convertirBaucherAWebp(req: Request, res: Response, next: NextFunction) {
  if (!req.file) { next(); return; }
  const archivo = req.file as ArchivoComprobante;
  const rutaOriginal = archivo.path;
  const carpeta = path.dirname(rutaOriginal);
  const base = `COMPROBANTE_${ciSeguro(req)}_${Date.now()}_${crypto.randomUUID()}`;
  const extensionOriginal = path.extname(archivo.originalname).toLowerCase();
  const parecePdf = archivo.mimetype === "application/pdf" || extensionOriginal === ".pdf";
  const rutaSalida = path.join(carpeta, `${base}.${parecePdf ? "pdf" : "webp"}`);
  try {
    let contentType = "image/webp";
    if (parecePdf) {
      if (!(await verificarArchivoPdf(rutaOriginal))) throw new Error("El archivo no contiene un PDF válido");
      await comprimirPdfOptimizado({ rutaEntrada: rutaOriginal, rutaSalida });
      contentType = "application/pdf";
    } else {
      await sharp(rutaOriginal).rotate().resize({ width: 2000, height: 2400, fit: "inside", withoutEnlargement: true }).webp({ quality: 80, effort: 5 }).toFile(rutaSalida);
    }
    await fsPromises.rm(rutaOriginal, { force: true });
    const rutaPublica = `/uploads/cuentas-perfil/${ciSeguro(req)}/comprobantes/${path.basename(rutaSalida)}`;
    archivo.filename = path.basename(rutaSalida);
    archivo.path = rutaSalida;
    archivo.mimetype = contentType;
    archivo.size = (await fsPromises.stat(rutaSalida)).size;
    archivo.rutaPublica = rutaPublica;
    await subirArchivoProcesado(rutaPublica, rutaSalida, contentType);
    next();
  } catch (error) {
    await Promise.all([fsPromises.rm(rutaOriginal, { force: true }), fsPromises.rm(rutaSalida, { force: true })]);
    console.error("Error procesando el comprobante:", error);
    res.status(400).json({ error: parecePdf ? "El PDF está dañado o no pudo comprimirse" : "La imagen está dañada o su formato no pudo convertirse" });
  }
}
