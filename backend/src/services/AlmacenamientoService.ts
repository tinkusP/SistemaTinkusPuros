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

const contentTypeDesdeRuta = (ruta: string): string => {
  const extension = path.extname(ruta).toLowerCase();
  return ({
    ".webp": "image/webp",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".avif": "image/avif",
    ".pdf": "application/pdf",
    ".json": "application/json",
  } as Record<string, string>)[extension] ?? "application/octet-stream";
};

export type ArchivoAlmacenado = {
  key: string;
  size: number;
  contentType?: string;
};

const rutaPublicaDesdeClave = (key: string) => `/${claveDesdeRuta(key)}`;

async function listarArchivosLocales(): Promise<ArchivoAlmacenado[]> {
  const raiz = path.resolve(process.cwd(), "public", "uploads");
  const encontrados: ArchivoAlmacenado[] = [];
  const recorrer = async (directorio: string): Promise<void> => {
    let entradas: import("node:fs").Dirent[] = [];
    try {
      entradas = await fs.readdir(directorio, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
    for (const entrada of entradas) {
      const absoluta = path.join(directorio, entrada.name);
      if (entrada.isDirectory()) await recorrer(absoluta);
      if (entrada.isFile()) {
        const estado = await fs.stat(absoluta);
        encontrados.push({
          key: path.relative(path.resolve(process.cwd(), "public"), absoluta).split(path.sep).join("/"),
          size: estado.size,
        });
      }
    }
  };
  await recorrer(raiz);
  return encontrados.sort((a, b) => a.key.localeCompare(b.key));
}

export async function listarArchivosAlmacenados(): Promise<ArchivoAlmacenado[]> {
  if (!almacenamientoR2Activo()) return listarArchivosLocales();
  const encontrados: ArchivoAlmacenado[] = [];
  let cursor = "";
  do {
    const url = new URL(`${urlBase()}/list`);
    url.searchParams.set("prefix", "uploads/");
    if (cursor) url.searchParams.set("cursor", cursor);
    const respuesta = await fetch(url, { headers: headersAutorizacion() });
    if (!respuesta.ok) throw new Error(`R2 rechazó el listado (${respuesta.status})`);
    const pagina = await respuesta.json() as {
      objects?: ArchivoAlmacenado[];
      truncated?: boolean;
      cursor?: string;
    };
    encontrados.push(...(pagina.objects ?? []));
    cursor = pagina.truncated && pagina.cursor ? pagina.cursor : "";
  } while (cursor);
  return encontrados.sort((a, b) => a.key.localeCompare(b.key));
}

export async function descargarArchivoAlmacenado(key: string): Promise<{ contenido: Buffer; contentType: string }> {
  const rutaPublica = rutaPublicaDesdeClave(key);
  if (almacenamientoR2Activo()) {
    const respuesta = await fetch(endpoint(rutaPublica), { headers: headersAutorizacion() });
    if (!respuesta.ok) throw new Error(`No se pudo descargar ${key} desde R2 (${respuesta.status})`);
    return {
      contenido: Buffer.from(await respuesta.arrayBuffer()),
      contentType: respuesta.headers.get("content-type") || "application/octet-stream",
    };
  }
  const absoluta = path.resolve(process.cwd(), "public", claveDesdeRuta(key));
  const raiz = path.resolve(process.cwd(), "public", "uploads");
  if (!absoluta.startsWith(`${raiz}${path.sep}`)) throw new Error("Ruta local inválida");
  return { contenido: await fs.readFile(absoluta), contentType: contentTypeDesdeRuta(key) };
}

export async function restaurarArchivoAlmacenado(key: string, contenido: Buffer, contentType: string): Promise<void> {
  const rutaPublica = rutaPublicaDesdeClave(key);
  if (almacenamientoR2Activo()) {
    await subirBuffer(rutaPublica, contenido, contentType);
    return;
  }
  const absoluta = path.resolve(process.cwd(), "public", claveDesdeRuta(key));
  const raiz = path.resolve(process.cwd(), "public", "uploads");
  if (!absoluta.startsWith(`${raiz}${path.sep}`)) throw new Error("Ruta local inválida");
  await fs.mkdir(path.dirname(absoluta), { recursive: true });
  await fs.writeFile(absoluta, contenido);
}

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
