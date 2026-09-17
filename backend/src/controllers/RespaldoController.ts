import type { Request, Response } from "express";
import mongoose from "mongoose";
import { EJSON } from "bson";
import { gunzipSync } from "node:zlib";
import unzipper from "unzipper";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import {
  restaurarArchivoAlmacenado,
  restaurarStreamArchivoAlmacenado,
} from "../services/AlmacenamientoService";
import {
  crearStreamDescargaRespaldo,
  ErrorGeneracionRespaldo,
  generarRespaldoCompletoTemporal,
  type ProgresoRespaldo,
  type RespaldoTemporal,
} from "../services/RespaldoCompletoService";

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

async function sincronizarColeccion(item: ColeccionRespaldo): Promise<number> {
  if (!item.nombre || item.nombre.startsWith("system.") || !Array.isArray(item.documentos)) return 0;
  const coleccion = dbActual().collection(item.nombre);
  const operaciones = item.documentos
    .filter((documento) => documento && documento._id)
    .map((documento) => {
      const { _id, ...campos } = documento;
      return { updateOne: { filter: { $or: filtrosIdentidad(documento, item.indices ?? []) }, update: { $set: campos, $setOnInsert: { _id } }, upsert: true } };
    });
  for (let inicio = 0; inicio < operaciones.length; inicio += 500) {
    const lote = operaciones.slice(inicio, inicio + 500);
    if (lote.length) await coleccion.bulkWrite(lote, { ordered: false });
  }
  for (const indice of item.indices ?? []) {
    const { key, name, ...opciones } = indice as { key?: Record<string, 1 | -1>; name?: string } & Record<string, unknown>;
    if (!key) continue;
    try {
      await coleccion.createIndex(key, { ...opciones, name } as Parameters<typeof coleccion.createIndex>[1]);
    } catch (error) {
      console.warn(`No se pudo restaurar el índice ${name ?? "sin nombre"} de ${item.nombre}`, error);
    }
  }
  return operaciones.length;
}

async function restaurarZipDesdeArchivo(rutaArchivo: string) {
  const directorio = await unzipper.Open.file(rutaArchivo);
  if (directorio.files.length > 50_000) throw new Error("El ZIP contiene demasiados elementos");
  const totalDescomprimido = directorio.files.reduce((total, archivo) => total + Number(archivo.uncompressedSize || 0), 0);
  if (totalDescomprimido > 2 * 1024 * 1024 * 1024) throw new Error("El ZIP supera el límite descomprimido de 2 GB");
  const archivosPorRuta = new Map(directorio.files.filter((archivo) => archivo.type === "File").map((archivo) => [archivo.path, archivo]));
  for (const nombre of archivosPorRuta.keys()) if (!rutaZipSegura(nombre)) throw new Error("El ZIP contiene una ruta inválida");
  const manifiesto = archivosPorRuta.get("LEEME-manifiesto.json");
  if (!manifiesto) throw new Error("El ZIP no contiene el manifiesto de Tinkus");
  const datosManifiesto = JSON.parse((await manifiesto.buffer()).toString("utf8")) as { sistema?: string; version?: number };
  if (datosManifiesto.sistema !== "SISTEMA_TINKUS_PUROS" || datosManifiesto.version !== 1) throw new Error("El ZIP pertenece a otro sistema o versión");

  let colecciones = 0;
  let documentos = 0;
  let archivos = 0;
  for (const [nombre, entrada] of archivosPorRuta) {
    const coincidencia = nombre.match(/^base-de-datos\/colecciones\/([^/]+)\.json$/);
    if (!coincidencia) continue;
    const nombreColeccion = coincidencia[1];
    if (nombreColeccion.startsWith("system.")) continue;
    console.info("[restaurar-respaldo] colección", { tabla: nombreColeccion });
    const datos = EJSON.parse((await entrada.buffer()).toString("utf8")) as Record<string, unknown>[];
    const entradaIndices = archivosPorRuta.get(`base-de-datos/indices/${nombreColeccion}.json`);
    const indices = entradaIndices ? EJSON.parse((await entradaIndices.buffer()).toString("utf8")) as Array<Record<string, unknown>> : [];
    if (!Array.isArray(datos) || !Array.isArray(indices)) throw new Error(`La colección ${nombreColeccion} no es válida`);
    documentos += await sincronizarColeccion({ nombre: nombreColeccion, documentos: datos, indices });
    colecciones += 1;
  }
  if (!colecciones) throw new Error("El ZIP no contiene colecciones para restaurar");

  for (const [nombre, entrada] of archivosPorRuta) {
    if (!nombre.startsWith("documentos/") || nombre.endsWith("/")) continue;
    const key = `uploads/${nombre.slice("documentos/".length)}`;
    if (!rutaZipSegura(key)) throw new Error(`Ruta inválida dentro del ZIP: ${nombre}`);
    console.info("[restaurar-respaldo] archivo", { key, numero: archivos + 1 });
    await restaurarStreamArchivoAlmacenado(key, entrada.stream(), contentTypeDesdeNombre(nombre));
    archivos += 1;
  }
  return { colecciones, documentos, archivos };
}

type TrabajoRespaldo = {
  id: string;
  usuarioId: string;
  estado: "PREPARANDO" | "LISTO" | "ERROR";
  progreso: ProgresoRespaldo;
  creadoEn: Date;
  respaldo?: RespaldoTemporal;
  error?: { etapa: string; tabla?: string; mensaje: string };
  temporizador?: NodeJS.Timeout;
};

const trabajos = new Map<string, TrabajoRespaldo>();
const VIDA_RESPALDO_MS = 30 * 60 * 1000;
const usuarioActual = (req: Request) => String(req.usuario?._id ?? "");

async function eliminarTrabajo(id: string) {
  const trabajo = trabajos.get(id);
  if (!trabajo) return;
  if (trabajo.temporizador) clearTimeout(trabajo.temporizador);
  await trabajo.respaldo?.limpiar().catch(() => undefined);
  trabajos.delete(id);
}

function programarLimpieza(trabajo: TrabajoRespaldo) {
  trabajo.temporizador = setTimeout(() => { void eliminarTrabajo(trabajo.id); }, VIDA_RESPALDO_MS);
  trabajo.temporizador.unref();
}

function describirError(error: unknown) {
  if (error instanceof ErrorGeneracionRespaldo) {
    return { etapa: error.etapa, tabla: error.tabla, mensaje: error.message };
  }
  return { etapa: "DESCONOCIDA", mensaje: error instanceof Error ? error.message : String(error) };
}

function iniciarTrabajo(usuarioId: string) {
  const existente = [...trabajos.values()].find((trabajo) => trabajo.usuarioId === usuarioId && trabajo.estado === "PREPARANDO");
  if (existente) return existente;
  const trabajo: TrabajoRespaldo = {
    id: randomUUID(), usuarioId, estado: "PREPARANDO", creadoEn: new Date(),
    progreso: { etapa: "INICIALIZANDO", mensaje: "Preparando respaldo" },
  };
  trabajos.set(trabajo.id, trabajo);
  console.info("[respaldo-completo] trabajo iniciado", { trabajoId: trabajo.id, usuarioId });
  let ultimaEtapa = "";
  void generarRespaldoCompletoTemporal((progreso) => {
    trabajo.progreso = progreso;
    const cambioEtapa = progreso.etapa !== ultimaEtapa;
    const puntoControl = progreso.etapa !== "ARCHIVOS" || (progreso.procesados ?? 0) % 50 === 0 || progreso.procesados === progreso.total;
    if (cambioEtapa || puntoControl) console.info("[respaldo-completo] progreso", { trabajoId: trabajo.id, ...progreso });
    ultimaEtapa = progreso.etapa;
  }).then((respaldo) => {
    trabajo.respaldo = respaldo;
    trabajo.estado = "LISTO";
    trabajo.progreso = { etapa: "COMPLETADO", procesados: respaldo.archivos, total: respaldo.archivos, mensaje: "Respaldo listo para descargar" };
    programarLimpieza(trabajo);
    console.info("[respaldo-completo] trabajo completado", { trabajoId: trabajo.id, bytes: respaldo.bytes, colecciones: respaldo.colecciones, documentos: respaldo.documentos, archivos: respaldo.archivos });
  }).catch((error) => {
    trabajo.estado = "ERROR";
    trabajo.error = describirError(error);
    programarLimpieza(trabajo);
    console.error("[respaldo-completo] trabajo falló", { trabajoId: trabajo.id, usuarioId, ...trabajo.error });
  });
  return trabajo;
}

function respuestaTrabajo(trabajo: TrabajoRespaldo) {
  return {
    id: trabajo.id,
    estado: trabajo.estado,
    progreso: trabajo.progreso,
    error: trabajo.error,
    archivo: trabajo.respaldo ? { nombre: trabajo.respaldo.nombre, bytes: trabajo.respaldo.bytes, colecciones: trabajo.respaldo.colecciones, documentos: trabajo.respaldo.documentos, archivos: trabajo.respaldo.archivos } : undefined,
  };
}

function enviarArchivoTemporal(res: Response, trabajo: TrabajoRespaldo) {
  const respaldo = trabajo.respaldo;
  if (!respaldo) return res.status(409).json({ error: "El respaldo todavía no está listo" });
  res.setHeader("content-type", "application/zip");
  res.setHeader("content-disposition", `attachment; filename="${respaldo.nombre}"`);
  res.setHeader("content-length", String(respaldo.bytes));
  const stream = crearStreamDescargaRespaldo(respaldo);
  stream.on("error", (error) => {
    console.error("[respaldo-completo] error enviando archivo", { trabajoId: trabajo.id, mensaje: error.message });
    if (!res.headersSent) res.status(500).json({ error: "No se pudo leer el respaldo temporal", etapa: "DESCARGA", mensaje: error.message });
    else res.destroy(error);
  });
  res.on("finish", () => { void eliminarTrabajo(trabajo.id); });
  return stream.pipe(res);
}

export async function prepararRespaldo(req: Request, res: Response) {
  const trabajo = iniciarTrabajo(usuarioActual(req));
  return res.status(202).json(respuestaTrabajo(trabajo));
}

export async function estadoRespaldo(req: Request, res: Response) {
  const trabajo = trabajos.get(String(req.params.id));
  if (!trabajo || trabajo.usuarioId !== usuarioActual(req)) return res.status(404).json({ error: "El trabajo de respaldo no existe o venció" });
  return res.json(respuestaTrabajo(trabajo));
}

export async function descargarRespaldoPreparado(req: Request, res: Response) {
  const trabajo = trabajos.get(String(req.params.id));
  if (!trabajo || trabajo.usuarioId !== usuarioActual(req)) return res.status(404).json({ error: "El trabajo de respaldo no existe o venció" });
  if (trabajo.estado === "ERROR") return res.status(500).json({ error: "Falló la generación del respaldo", ...trabajo.error });
  if (trabajo.estado !== "LISTO") return res.status(409).json({ error: "El respaldo todavía se está preparando", progreso: trabajo.progreso });
  return enviarArchivoTemporal(res, trabajo);
}

export async function exportarRespaldo(req: Request, res: Response) {
  let trabajo: TrabajoRespaldo | undefined;
  try {
    trabajo = iniciarTrabajo(usuarioActual(req));
    while (trabajo.estado === "PREPARANDO") await new Promise((resolve) => setTimeout(resolve, 1000));
    if (trabajo.estado === "ERROR") return res.status(500).json({ error: "Falló la generación del respaldo", ...trabajo.error });
    return enviarArchivoTemporal(res, trabajo);
  } catch (error) {
    const detalle = describirError(error);
    console.error("Error exportando respaldo completo", detalle);
    if (trabajo) await eliminarTrabajo(trabajo.id);
    return res.status(500).json({ error: "No se pudo generar el respaldo completo", ...detalle });
  }
}

export const exportarRespaldoOrganizado = exportarRespaldo;

export async function importarRespaldo(req: Request, res: Response) {
  const rutaTemporal = req.file?.path;
  try {
    if (!rutaTemporal) return res.status(400).json({ error: "Debe seleccionar un archivo .zip o .tinkus.gz" });
    const descriptor = await fs.open(rutaTemporal, "r");
    const firma = Buffer.alloc(4);
    await descriptor.read(firma, 0, 4, 0);
    await descriptor.close();
    const esZip = firma.equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    if (esZip) {
      console.info("[restaurar-respaldo] iniciando ZIP", { bytes: req.file?.size });
      const resultado = await restaurarZipDesdeArchivo(rutaTemporal);
      return res.json({ message: "Respaldo restaurado correctamente sin eliminar datos adicionales", ...resultado });
    }

    let respaldo: RespaldoCompleto;
    try {
      const contenido = await fs.readFile(rutaTemporal);
      respaldo = EJSON.parse(gunzipSync(contenido).toString("utf8")) as RespaldoCompleto;
    } catch (error) {
      console.warn("[restaurar-respaldo] archivo legado inválido", { mensaje: error instanceof Error ? error.message : String(error) });
      return res.status(400).json({ error: "El archivo no es un respaldo Tinkus válido, compatible o está dañado" });
    }
    if (respaldo.sistema !== "SISTEMA_TINKUS_PUROS" || respaldo.version !== 1) {
      return res.status(400).json({ error: "El respaldo pertenece a otro sistema o versión" });
    }

    let documentosActualizados = 0;
    for (const item of respaldo.colecciones) {
      documentosActualizados += await sincronizarColeccion(item);
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
    return res.status(500).json({ error: "No se pudo restaurar el respaldo completo", etapa: "IMPORTACION", mensaje: error instanceof Error ? error.message : String(error) });
  } finally {
    if (rutaTemporal) await fs.rm(rutaTemporal, { force: true }).catch(() => undefined);
  }
}
