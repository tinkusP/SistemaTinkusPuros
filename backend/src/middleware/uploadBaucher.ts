import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import sharp from "sharp";
import { promises as fsPromises } from "node:fs";
import type { NextFunction, Request, Response } from "express";
import { subirArchivoProcesado } from "../services/AlmacenamientoService";
const carpeta = path.resolve(process.cwd(), "public", "uploads", "bauchers");
fs.mkdirSync(carpeta, { recursive: true });
const storage = multer.diskStorage({ destination: (_req, _file, cb) => cb(null, carpeta), filename: (_req, file, cb) => cb(null, `BAUCHER_${Date.now()}_${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase() || ".img"}`) });
export const uploadBaucher = multer({ storage, limits: { fileSize: 10 * 1024 * 1024, files: 1 }, fileFilter: (_req, file, cb) => cb(null, ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) });

export async function convertirBaucherAWebp(req: Request, res: Response, next: NextFunction) {
  if (!req.file) { next(); return; }
  const rutaOriginal = req.file.path;
  const nombreBase = path.parse(req.file.filename).name;
  const nombreWebp = `${nombreBase}.webp`;
  const rutaWebp = path.join(carpeta, nombreWebp);
  const rutaTemporal = path.join(carpeta, `${nombreBase}_${crypto.randomUUID()}.tmp.webp`);
  try {
    await sharp(rutaOriginal).rotate().resize({ width: 2200, height: 2200, fit: "inside", withoutEnlargement: true }).webp({ quality: 82, effort: 4 }).toFile(rutaTemporal);
    await fsPromises.unlink(rutaOriginal);
    await fsPromises.rename(rutaTemporal, rutaWebp);
    req.file.filename = nombreWebp;
    req.file.path = rutaWebp;
    req.file.mimetype = "image/webp";
    req.file.size = (await fsPromises.stat(rutaWebp)).size;
    await subirArchivoProcesado(
      `/uploads/bauchers/${nombreWebp}`,
      rutaWebp,
      "image/webp",
    );
    next();
  } catch (error) {
    await Promise.all([fsPromises.unlink(rutaOriginal).catch(() => undefined), fsPromises.unlink(rutaTemporal).catch(() => undefined)]);
    console.error("Error convirtiendo el baucher a WebP:", error);
    res.status(400).json({ error: "No se pudo procesar la imagen del baucher" });
  }
}
