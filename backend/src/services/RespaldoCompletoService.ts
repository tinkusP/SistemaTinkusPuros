import archiver from "archiver";
import { EJSON } from "bson";
import mongoose from "mongoose";
import { createReadStream, createWriteStream, promises as fs } from "node:fs";
import { finished } from "node:stream/promises";
import { once } from "node:events";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Readable } from "node:stream";
import {
  abrirStreamArchivoAlmacenado,
  listarArchivosAlmacenados,
  type ArchivoAlmacenado,
} from "./AlmacenamientoService";
import { generarExcelRespaldo } from "./RespaldoExcelService";

export type ProgresoRespaldo = {
  etapa: "INICIALIZANDO" | "BASE_DATOS" | "EXCEL" | "ARCHIVOS" | "FINALIZANDO" | "COMPLETADO";
  tabla?: string;
  procesados?: number;
  total?: number;
  mensaje: string;
};

export type RespaldoTemporal = {
  ruta: string;
  nombre: string;
  bytes: number;
  colecciones: number;
  documentos: number;
  archivos: number;
  limpiar: () => Promise<void>;
};

export class ErrorGeneracionRespaldo extends Error {
  constructor(public etapa: string, public tabla: string | undefined, mensaje: string, public causa?: unknown) {
    super(mensaje);
    this.name = "ErrorGeneracionRespaldo";
  }
}

type DependenciasRespaldo = {
  db?: NonNullable<typeof mongoose.connection.db>;
  listarArchivos?: () => Promise<ArchivoAlmacenado[]>;
  abrirArchivo?: (key: string) => Promise<{ stream: Readable; contentType: string; size?: number }>;
  generarExcel?: typeof generarExcelRespaldo;
  raizTemporal?: string;
};

const informarConsola = (progreso: ProgresoRespaldo) => console.info("[respaldo-completo]", progreso);

const dbActual = () => {
  const db = mongoose.connection.db;
  if (!db) throw new ErrorGeneracionRespaldo("INICIALIZANDO", undefined, "La base de datos no está disponible");
  return db;
};

const rutaZipSegura = (nombre: string) => Boolean(
  nombre && !nombre.startsWith("/") && !nombre.includes("\\") && !nombre.split("/").includes(".."),
);

async function escribirConBackpressure(stream: NodeJS.WritableStream, contenido: string | Buffer) {
  if (!stream.write(contenido)) await once(stream, "drain");
}

/** Escribe un arreglo EJSON recorriendo el cursor por lotes, sin materializar la colección completa. */
export async function escribirDocumentosEjson(
  documentos: AsyncIterable<Record<string, unknown>>,
  rutaSalida: string,
): Promise<number> {
  const salida = createWriteStream(rutaSalida);
  let cantidad = 0;
  let primero = true;
  try {
    await escribirConBackpressure(salida, "[\n");
    for await (const documento of documentos) {
      await escribirConBackpressure(salida, `${primero ? "" : ",\n"}${EJSON.stringify(documento)}`);
      primero = false;
      cantidad += 1;
    }
    salida.end("\n]\n");
    await finished(salida);
    return cantidad;
  } catch (error) {
    salida.destroy();
    throw error;
  }
}

async function anexarEntrada(
  zip: archiver.Archiver,
  origen: string | Buffer | Readable,
  nombre: string,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const limpiarEventos = () => {
      zip.off("entry", alCompletar);
      zip.off("error", alFallar);
      zip.off("warning", alFallar);
      if (typeof origen !== "string" && !Buffer.isBuffer(origen)) origen.off("error", alFallar);
    };
    const alCompletar = (entrada: { name: string }) => {
      if (entrada.name !== nombre) return;
      limpiarEventos();
      resolve();
    };
    const alFallar = (error: Error) => {
      limpiarEventos();
      reject(error);
    };
    zip.on("entry", alCompletar);
    zip.on("error", alFallar);
    zip.on("warning", alFallar);
    if (typeof origen === "string") zip.file(origen, { name: nombre });
    else {
      if (!Buffer.isBuffer(origen)) origen.on("error", alFallar);
      zip.append(origen, { name: nombre });
    }
  });
}

function errorEtapa(error: unknown, etapa: string, tabla?: string): ErrorGeneracionRespaldo {
  if (error instanceof ErrorGeneracionRespaldo) return error;
  const mensaje = error instanceof Error ? error.message : String(error);
  return new ErrorGeneracionRespaldo(etapa, tabla, mensaje, error);
}

export async function generarRespaldoCompletoTemporal(
  informar: (progreso: ProgresoRespaldo) => void = informarConsola,
  dependencias: DependenciasRespaldo = {},
): Promise<RespaldoTemporal> {
  const db = dependencias.db ?? dbActual();
  const listar = dependencias.listarArchivos ?? listarArchivosAlmacenados;
  const abrir = dependencias.abrirArchivo ?? abrirStreamArchivoAlmacenado;
  const generarExcel = dependencias.generarExcel ?? generarExcelRespaldo;
  const raiz = dependencias.raizTemporal ?? tmpdir();
  const directorio = await fs.mkdtemp(path.join(raiz, "tinkus-respaldo-"));
  const fecha = new Date().toISOString().replace(/[:.]/g, "-");
  const nombre = `tinkus-completo-${fecha}.zip`;
  const ruta = path.join(directorio, nombre);
  const rutaTrabajo = path.join(directorio, "trabajo");
  await fs.mkdir(rutaTrabajo, { recursive: true });
  const limpiar = () => fs.rm(directorio, { recursive: true, force: true });

  let coleccionesExportadas = 0;
  let documentosExportados = 0;
  let archivosExportados = 0;
  let salidaActiva: ReturnType<typeof createWriteStream> | undefined;
  let zipActivo: archiver.Archiver | undefined;
  let finalizacionActiva: Promise<void> | undefined;

  try {
    informar({ etapa: "INICIALIZANDO", mensaje: "Consultando colecciones y archivos" });
    const nombres = (await db.listCollections({}, { nameOnly: true }).toArray())
      .map((item) => item.name)
      .filter((item) => !item.startsWith("system."))
      .sort();
    const archivos = await listar();
    const salidaZip = createWriteStream(ruta);
    const zip = archiver("zip", { zlib: { level: 6 } });
    salidaActiva = salidaZip;
    zipActivo = zip;
    zip.pipe(salidaZip);
    const zipTerminado = finished(salidaZip);
    finalizacionActiva = zipTerminado;

    const manifiesto = {
      sistema: "SISTEMA_TINKUS_PUROS",
      creadoEn: new Date(),
      baseDatos: db.databaseName,
      colecciones: nombres.length,
      archivos: archivos.length,
      bytesArchivos: archivos.reduce((total, archivo) => total + Number(archivo.size || 0), 0),
      version: 1,
      formato: "ZIP_ORGANIZADO_RESTAURABLE",
      incluyeExcel: true,
      nota: "Este ZIP es legible y también puede subirse directamente en Restaurar o sincronizar.",
    };
    await anexarEntrada(zip, Buffer.from(JSON.stringify(manifiesto, null, 2)), "LEEME-manifiesto.json");

    for (let posicion = 0; posicion < nombres.length; posicion += 1) {
      const nombreColeccion = nombres[posicion];
      informar({ etapa: "BASE_DATOS", tabla: nombreColeccion, procesados: posicion, total: nombres.length, mensaje: `Exportando colección ${nombreColeccion}` });
      try {
        const coleccion = db.collection(nombreColeccion);
        const rutaDocumentos = path.join(rutaTrabajo, `${nombreColeccion}.json`);
        const rutaIndices = path.join(rutaTrabajo, `${nombreColeccion}.indices.json`);
        const cantidad = await escribirDocumentosEjson(coleccion.find({}).batchSize(100) as any, rutaDocumentos);
        const indices = await coleccion.indexes();
        await fs.writeFile(rutaIndices, EJSON.stringify(indices, null, 2), "utf8");
        await anexarEntrada(zip, rutaDocumentos, `base-de-datos/colecciones/${nombreColeccion}.json`);
        await anexarEntrada(zip, rutaIndices, `base-de-datos/indices/${nombreColeccion}.json`);
        await Promise.all([fs.rm(rutaDocumentos, { force: true }), fs.rm(rutaIndices, { force: true })]);
        coleccionesExportadas += 1;
        documentosExportados += cantidad;
      } catch (error) {
        throw errorEtapa(error, "BASE_DATOS", nombreColeccion);
      }
    }

    informar({ etapa: "EXCEL", mensaje: "Generando reporte general Excel" });
    const rutaExcel = path.join(rutaTrabajo, "reporte-general.xlsx");
    try {
      await generarExcel(db, rutaExcel);
      await anexarEntrada(zip, rutaExcel, "reportes/reporte-general.xlsx");
      await fs.rm(rutaExcel, { force: true });
    } catch (error) {
      throw errorEtapa(error, "EXCEL", "reporte-general.xlsx");
    }

    for (let posicion = 0; posicion < archivos.length; posicion += 1) {
      const archivo = archivos[posicion];
      informar({ etapa: "ARCHIVOS", tabla: archivo.key, procesados: posicion, total: archivos.length, mensaje: `Comprimiendo archivo ${posicion + 1} de ${archivos.length}` });
      try {
        if (!archivo.key.startsWith("uploads/") || !rutaZipSegura(archivo.key)) throw new Error("Ruta de archivo inválida");
        const fuente = await abrir(archivo.key);
        await anexarEntrada(zip, fuente.stream, `documentos/${archivo.key.slice("uploads/".length)}`);
        archivosExportados += 1;
      } catch (error) {
        throw errorEtapa(error, "ARCHIVOS", archivo.key);
      }
    }

    informar({ etapa: "FINALIZANDO", procesados: archivos.length, total: archivos.length, mensaje: "Cerrando archivo ZIP" });
    await zip.finalize();
    await zipTerminado;
    const estado = await fs.stat(ruta);
    informar({ etapa: "COMPLETADO", procesados: archivos.length, total: archivos.length, mensaje: "Respaldo listo para descargar" });
    return { ruta, nombre, bytes: estado.size, colecciones: coleccionesExportadas, documentos: documentosExportados, archivos: archivosExportados, limpiar };
  } catch (error) {
    zipActivo?.abort();
    salidaActiva?.destroy();
    await finalizacionActiva?.catch(() => undefined);
    await limpiar().catch(() => undefined);
    throw errorEtapa(error, "FINALIZANDO");
  }
}

export function crearStreamDescargaRespaldo(respaldo: RespaldoTemporal) {
  return createReadStream(respaldo.ruta);
}
