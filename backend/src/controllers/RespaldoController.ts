import type { Request, Response } from "express";
import mongoose from "mongoose";
import { EJSON } from "bson";
import { gzipSync, gunzipSync } from "node:zlib";
import archiver from "archiver";
import unzipper from "unzipper";
import path from "node:path";
import {
  descargarArchivoAlmacenado,
  listarArchivosAlmacenados,
  restaurarArchivoAlmacenado,
} from "../services/AlmacenamientoService";

type ColeccionRespaldo = {
  nombre: string;
  documentos: Record<string, unknown>[];
  indices: Array<Record<string, unknown>>;
};

type ArchivoRespaldo = {
  key: string;
  contentType: string;
  contenidoBase64: string;
};

type RespaldoCompleto = {
  sistema: "SISTEMA_TINKUS_PUROS";
  version: 1;
  creadoEn: Date;
  baseDatos: string;
  colecciones: ColeccionRespaldo[];
  archivos: ArchivoRespaldo[];
};

const contentTypeDesdeNombre = (nombre: string) => ({ ".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".gif": "image/gif", ".avif": "image/avif", ".pdf": "application/pdf", ".json": "application/json" }[path.extname(nombre).toLowerCase()] ?? "application/octet-stream");
const rutaZipSegura = (nombre: string) => Boolean(nombre && !nombre.startsWith("/") && !nombre.includes("\\") && !nombre.split("/").includes(".."));
const valorRuta = (documento: Record<string, unknown>, ruta: string): unknown => ruta.split(".").reduce<unknown>((valor, segmento) => valor && typeof valor === "object" ? (valor as Record<string, unknown>)[segmento] : undefined, documento);

function filtrosIdentidad(documento: Record<string, unknown>, indices: Array<Record<string, unknown>>) {
  const filtros: Record<string, unknown>[] = [{ _id: documento._id }];
  for (const indice of indices) {
    const datos = indice as { key?: Record<string, unknown>; unique?: boolean; partialFilterExpression?: Record<string, unknown> };
    if (!datos.unique || !datos.key || "_id" in datos.key) continue;
    const campos = Object.keys(datos.key);
    const valores = campos.map((campo) => valorRuta(documento, campo));
    if (valores.some((valor) => valor === undefined || valor === null)) continue;
    filtros.push(Object.fromEntries(campos.map((campo, posicion) => [campo, valores[posicion]])));
  }
  return filtros;
}

async function leerRespaldoZip(buffer: Buffer): Promise<RespaldoCompleto> {
  const directorio = await unzipper.Open.buffer(buffer);
  if (directorio.files.length > 50_000) throw new Error("El ZIP contiene demasiados elementos");
  const totalDescomprimido = directorio.files.reduce((total, archivo) => total + Number(archivo.uncompressedSize || 0), 0);
  if (totalDescomprimido > 2 * 1024 * 1024 * 1024) throw new Error("El ZIP supera el límite descomprimido de 2 GB");
  const archivosPorRuta = new Map(directorio.files.filter((archivo) => archivo.type === "File").map((archivo) => [archivo.path, archivo]));
  for (const nombre of archivosPorRuta.keys()) if (!rutaZipSegura(nombre)) throw new Error("El ZIP contiene una ruta inválida");
  const manifiesto = archivosPorRuta.get("LEEME-manifiesto.json");
  if (!manifiesto) throw new Error("El ZIP no contiene el manifiesto de Tinkus");
  const datosManifiesto = JSON.parse((await manifiesto.buffer()).toString("utf8")) as { sistema?: string };
  if (datosManifiesto.sistema !== "SISTEMA_TINKUS_PUROS") throw new Error("El ZIP pertenece a otro sistema");
  const colecciones: ColeccionRespaldo[] = [];
  for (const [nombre, entrada] of archivosPorRuta) {
    const coincidencia = nombre.match(/^base-de-datos\/colecciones\/([^/]+)\.json$/);
    if (!coincidencia) continue;
    const nombreColeccion = coincidencia[1];
    if (nombreColeccion.startsWith("system.")) continue;
    const documentos = EJSON.parse((await entrada.buffer()).toString("utf8")) as Record<string, unknown>[];
    const entradaIndices = archivosPorRuta.get(`base-de-datos/indices/${nombreColeccion}.json`);
    const indices = entradaIndices ? EJSON.parse((await entradaIndices.buffer()).toString("utf8")) as Array<Record<string, unknown>> : [];
    if (!Array.isArray(documentos) || !Array.isArray(indices)) throw new Error(`La colección ${nombreColeccion} no es válida`);
    colecciones.push({ nombre: nombreColeccion, documentos, indices });
  }
  if (!colecciones.length) throw new Error("El ZIP no contiene colecciones para restaurar");
  const archivos: ArchivoRespaldo[] = [];
  for (const [nombre, entrada] of archivosPorRuta) {
    if (!nombre.startsWith("documentos/") || nombre.endsWith("/")) continue;
    archivos.push({ key: `uploads/${nombre.slice("documentos/".length)}`, contentType: contentTypeDesdeNombre(nombre), contenidoBase64: (await entrada.buffer()).toString("base64") });
  }
  return { sistema: "SISTEMA_TINKUS_PUROS", version: 1, creadoEn: new Date(), baseDatos: "zip-organizado", colecciones, archivos };
}

const dbActual = () => {
  const db = mongoose.connection.db;
  if (!db) throw new Error("La base de datos no está disponible");
  return db;
};

async function mapaConConcurrencia<T, R>(items: T[], limite: number, tarea: (item: T) => Promise<R>): Promise<R[]> {
  const resultados = new Array<R>(items.length);
  let siguiente = 0;
  const trabajador = async () => {
    while (siguiente < items.length) {
      const indice = siguiente++;
      resultados[indice] = await tarea(items[indice]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limite, Math.max(items.length, 1)) }, trabajador));
  return resultados;
}

export async function exportarRespaldo(_req: Request, res: Response) {
  try {
    const db = dbActual();
    const nombres = (await db.listCollections({}, { nameOnly: true }).toArray())
      .map((item) => item.name)
      .filter((nombre) => !nombre.startsWith("system."))
      .sort();

    const colecciones = await mapaConConcurrencia(nombres, 4, async (nombre): Promise<ColeccionRespaldo> => {
      const coleccion = db.collection(nombre);
      return {
        nombre,
        documentos: await coleccion.find({}).toArray(),
        indices: (await coleccion.indexes()).filter((indice) => indice.name !== "_id_") as Array<Record<string, unknown>>,
      };
    });

    const listado = await listarArchivosAlmacenados();
    const archivos = await mapaConConcurrencia(listado, 5, async ({ key }): Promise<ArchivoRespaldo> => {
      const archivo = await descargarArchivoAlmacenado(key);
      return {
        key,
        contentType: archivo.contentType,
        contenidoBase64: archivo.contenido.toString("base64"),
      };
    });

    const respaldo: RespaldoCompleto = {
      sistema: "SISTEMA_TINKUS_PUROS",
      version: 1,
      creadoEn: new Date(),
      baseDatos: db.databaseName,
      colecciones,
      archivos,
    };
    const comprimido = gzipSync(Buffer.from(EJSON.stringify(respaldo), "utf8"), { level: 6 });
    const fecha = new Date().toISOString().replace(/[:.]/g, "-");
    res.setHeader("content-type", "application/gzip");
    res.setHeader("content-disposition", `attachment; filename="tinkus-respaldo-${fecha}.tinkus.gz"`);
    res.setHeader("content-length", String(comprimido.length));
    return res.send(comprimido);
  } catch (error) {
    console.error("Error exportando respaldo completo", error);
    return res.status(500).json({ error: "No se pudo generar el respaldo completo" });
  }
}

export async function exportarRespaldoOrganizado(_req: Request, res: Response) {
  try {
    const db = dbActual();
    const nombres = (await db.listCollections({}, { nameOnly: true }).toArray())
      .map((item) => item.name)
      .filter((nombre) => !nombre.startsWith("system."))
      .sort();
    const listado = await listarArchivosAlmacenados();
    const fecha = new Date().toISOString().replace(/[:.]/g, "-");
    res.setHeader("content-type", "application/zip");
    res.setHeader("content-disposition", `attachment; filename="tinkus-completo-${fecha}.zip"`);

    const zip = archiver("zip", { zlib: { level: 6 } });
    zip.on("warning", (error) => console.warn("Advertencia creando ZIP de respaldo", error));
    zip.on("error", (error) => { throw error; });
    zip.pipe(res);
    zip.append(JSON.stringify({
      sistema: "SISTEMA_TINKUS_PUROS",
      creadoEn: new Date(),
      baseDatos: db.databaseName,
      colecciones: nombres.length,
      archivos: listado.length,
      version: 1,
      formato: "ZIP_ORGANIZADO_RESTAURABLE",
      nota: "Este ZIP es legible y también puede subirse directamente en Restaurar o sincronizar.",
    }, null, 2), { name: "LEEME-manifiesto.json" });

    for (const nombre of nombres) {
      const coleccion = db.collection(nombre);
      const [documentos, indices] = await Promise.all([coleccion.find({}).toArray(), coleccion.indexes()]);
      zip.append(EJSON.stringify(documentos, null, 2), { name: `base-de-datos/colecciones/${nombre}.json` });
      zip.append(EJSON.stringify(indices, null, 2), { name: `base-de-datos/indices/${nombre}.json` });
    }
    for (const { key } of listado) {
      if (!key.startsWith("uploads/") || key.includes("..")) continue;
      const archivo = await descargarArchivoAlmacenado(key);
      zip.append(archivo.contenido, { name: `documentos/${key.slice("uploads/".length)}` });
    }
    await zip.finalize();
  } catch (error) {
    console.error("Error exportando ZIP organizado", error);
    if (!res.headersSent) return res.status(500).json({ error: "No se pudo generar el ZIP organizado" });
    res.destroy(error instanceof Error ? error : undefined);
  }
}

export async function importarRespaldo(req: Request, res: Response) {
  try {
    if (!req.file?.buffer) return res.status(400).json({ error: "Debe seleccionar un archivo .zip o .tinkus.gz" });
    let respaldo: RespaldoCompleto;
    try {
      const esZip = req.file.buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
      respaldo = esZip ? await leerRespaldoZip(req.file.buffer) : EJSON.parse(gunzipSync(req.file.buffer).toString("utf8")) as RespaldoCompleto;
    } catch {
      return res.status(400).json({ error: "El archivo no es un respaldo Tinkus válido, compatible o está dañado" });
    }
    if (respaldo.sistema !== "SISTEMA_TINKUS_PUROS" || respaldo.version !== 1) {
      return res.status(400).json({ error: "El respaldo pertenece a otro sistema o versión" });
    }

    const db = dbActual();
    let documentosActualizados = 0;
    for (const item of respaldo.colecciones) {
      if (!item.nombre || item.nombre.startsWith("system.") || !Array.isArray(item.documentos)) continue;
      const coleccion = db.collection(item.nombre);
      const operaciones = item.documentos
        .filter((documento) => documento && documento._id)
        .map((documento) => {
          const { _id, ...campos } = documento;
          return {
            updateOne: {
              filter: { $or: filtrosIdentidad(documento, item.indices ?? []) },
              update: { $set: campos, $setOnInsert: { _id } },
              upsert: true,
            },
          };
        });
      for (let inicio = 0; inicio < operaciones.length; inicio += 500) {
        const lote = operaciones.slice(inicio, inicio + 500);
        if (lote.length) await coleccion.bulkWrite(lote, { ordered: false });
      }
      documentosActualizados += operaciones.length;
      for (const indice of item.indices ?? []) {
        const { key, name, ...opciones } = indice as { key?: Record<string, 1 | -1>; name?: string } & Record<string, unknown>;
        if (!key) continue;
        try {
          await coleccion.createIndex(key, { ...opciones, name } as Parameters<typeof coleccion.createIndex>[1]);
        } catch (error) {
          console.warn(`No se pudo restaurar el índice ${name ?? "sin nombre"} de ${item.nombre}`, error);
        }
      }
    }

    const archivos = Array.isArray(respaldo.archivos) ? respaldo.archivos : [];
    await mapaConConcurrencia(archivos, 5, async (archivo) => {
      if (!archivo.key?.startsWith("uploads/") || archivo.key.includes("..")) throw new Error("Ruta de respaldo inválida");
      await restaurarArchivoAlmacenado(
        archivo.key,
        Buffer.from(archivo.contenidoBase64, "base64"),
        archivo.contentType || "application/octet-stream",
      );
    });

    return res.json({
      message: "Respaldo restaurado correctamente sin eliminar datos adicionales",
      colecciones: respaldo.colecciones.length,
      documentos: documentosActualizados,
      archivos: archivos.length,
    });
  } catch (error) {
    console.error("Error importando respaldo completo", error);
    return res.status(500).json({ error: "No se pudo restaurar el respaldo completo" });
  }
}
