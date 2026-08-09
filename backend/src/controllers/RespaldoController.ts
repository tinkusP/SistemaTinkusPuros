import type { Request, Response } from "express";
import mongoose from "mongoose";
import { EJSON } from "bson";
import { gzipSync, gunzipSync } from "node:zlib";
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

export async function importarRespaldo(req: Request, res: Response) {
  try {
    if (!req.file?.buffer) return res.status(400).json({ error: "Debe seleccionar un archivo .tinkus.gz" });
    let respaldo: RespaldoCompleto;
    try {
      respaldo = EJSON.parse(gunzipSync(req.file.buffer).toString("utf8")) as RespaldoCompleto;
    } catch {
      return res.status(400).json({ error: "El archivo no es un respaldo válido o está dañado" });
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
        .map((documento) => ({
          replaceOne: { filter: { _id: documento._id }, replacement: documento, upsert: true },
        }));
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
