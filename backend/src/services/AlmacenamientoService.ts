import type { NextFunction, Request, Response } from "express";
import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";

const urlBase = () => String(process.env.R2_WORKER_URL ?? "").replace(/\/+$/, "");
const token = () => String(process.env.R2_WORKER_TOKEN ?? "");

export const almacenamientoR2Activo = () => Boolean(urlBase() && token());

const claveDesdeRuta = (ruta: string) => {
  const limpia = ruta.split("?")[0].replace(/^\/+/, "");
  if (!limpia.startsWith("uploads/") || limpia.includes("..")) {
    throw new Error("Ruta de almacenamiento inválida");
  }
  return limpia;
};

const endpoint = (ruta: string) =>
  `${urlBase()}/objects/${encodeURIComponent(claveDesdeRuta(ruta))}`;

const headersAutorizacion = () => ({ authorization: `Bearer ${token()}` });

export async function subirArchivoProcesado(
  rutaPublica: string,
  rutaLocal: string,
  contentType: string,
  eliminarLocal = true,
) {
  if (!almacenamientoR2Activo()) return;
  const stream = Readable.toWeb(createReadStream(rutaLocal));
  const respuesta = await fetch(endpoint(rutaPublica), {
    method: "PUT",
    headers: { ...headersAutorizacion(), "content-type": contentType },
    body: stream,
    duplex: "half",
  } as RequestInit & { duplex: "half" });
  if (!respuesta.ok) {
    throw new Error(`R2 rechazó la carga (${respuesta.status})`);
  }
  if (eliminarLocal) await fs.rm(rutaLocal, { force: true });
}

export async function subirBuffer(
  rutaPublica: string,
  contenido: Buffer,
  contentType: string,
) {
  if (!almacenamientoR2Activo()) return false;
  const respuesta = await fetch(endpoint(rutaPublica), {
    method: "PUT",
    headers: { ...headersAutorizacion(), "content-type": contentType },
    body: contenido,
  });
  if (!respuesta.ok) throw new Error(`R2 rechazó la carga (${respuesta.status})`);
  return true;
}

export async function eliminarArchivoAlmacenado(ruta?: string | null) {
  if (!ruta?.startsWith("/uploads/")) return;
  if (almacenamientoR2Activo()) {
    const respuesta = await fetch(endpoint(ruta), {
      method: "DELETE",
      headers: headersAutorizacion(),
    });
    if (!respuesta.ok && respuesta.status !== 404) {
      throw new Error(`R2 rechazó la eliminación (${respuesta.status})`);
    }
  }
  const local = path.resolve(process.cwd(), "public", ruta.replace(/^\/+/, ""));
  const raiz = path.resolve(process.cwd(), "public", "uploads");
  if (local.startsWith(`${raiz}${path.sep}`)) await fs.rm(local, { force: true });
}

/** Mueve una ruta conservando el archivo tanto en R2 como en almacenamiento local. */
export async function moverArchivoAlmacenado(rutaOrigen: string, rutaDestino: string, contentType: string) {
  if (rutaOrigen === rutaDestino) return true;
  let encontrado = false;
  if (almacenamientoR2Activo()) {
    const origen = await fetch(endpoint(rutaOrigen), { headers: headersAutorizacion() });
    if (origen.ok) {
      const contenido = await origen.arrayBuffer();
      const subida = await fetch(endpoint(rutaDestino), { method: "PUT", headers: { ...headersAutorizacion(), "content-type": origen.headers.get("content-type") || contentType }, body: contenido });
      if (!subida.ok) throw new Error(`R2 rechazó la migración (${subida.status})`);
      const eliminacion = await fetch(endpoint(rutaOrigen), { method: "DELETE", headers: headersAutorizacion() });
      if (!eliminacion.ok && eliminacion.status !== 404) throw new Error(`R2 rechazó la eliminación anterior (${eliminacion.status})`);
      encontrado = true;
    } else if (origen.status !== 404) {
      throw new Error(`R2 rechazó la lectura para migración (${origen.status})`);
    }
  }
  const raiz = path.resolve(process.cwd(), "public", "uploads");
  const localOrigen = path.resolve(process.cwd(), "public", rutaOrigen.replace(/^\/+/, ""));
  const localDestino = path.resolve(process.cwd(), "public", rutaDestino.replace(/^\/+/, ""));
  if (localOrigen.startsWith(`${raiz}${path.sep}`) && localDestino.startsWith(`${raiz}${path.sep}`)) {
    try {
      await fs.access(localOrigen);
      await fs.mkdir(path.dirname(localDestino), { recursive: true });
      await fs.rm(localDestino, { force: true });
      await fs.rename(localOrigen, localDestino);
      encontrado = true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return encontrado;
}

export async function servirArchivoR2(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!almacenamientoR2Activo()) return next();
  try {
    const ruta = `/uploads${req.path.startsWith("/") ? req.path : `/${req.path}`}`;
    const respuesta = await fetch(endpoint(ruta), {
      headers: headersAutorizacion(),
    });
    if (respuesta.status === 404) return next();
    if (!respuesta.ok || !respuesta.body) {
      return res.status(502).json({ error: "No se pudo recuperar el archivo" });
    }
    for (const cabecera of ["content-type", "content-length", "etag", "cache-control"]) {
      const valor = respuesta.headers.get(cabecera);
      if (valor) res.setHeader(cabecera, valor);
    }
    res.setHeader("x-content-type-options", "nosniff");
    Readable.fromWeb(respuesta.body as import("node:stream/web").ReadableStream).pipe(res);
  } catch (error) {
    console.error("Error recuperando archivo desde R2", error);
    next();
  }
}
