import {
  execFile,
} from "node:child_process";

import {
  promisify,
} from "node:util";

import {
  promises as fs,
} from "node:fs";

import path from "node:path";

const ejecutarArchivo =
  promisify(execFile);

export const verificarArchivoPdf =
  async (
    rutaArchivo: string,
  ): Promise<boolean> => {
    const archivo = await fs.open(rutaArchivo, "r");

    try {
      const estado = await archivo.stat();
      if (estado.size < 8) return false;

      // Algunos escáneres móviles agregan BOM, saltos de línea o metadatos
      // antes de la cabecera. La especificación permite encontrar %PDF- en
      // los primeros 1024 bytes; usamos 4096 para tolerar exportadores reales.
      const inicio = Buffer.alloc(Math.min(4096, estado.size));
      await archivo.read(inicio, 0, inicio.length, 0);
      if (!inicio.includes(Buffer.from("%PDF-"))) return false;

      // Comprobar también el cierre evita aceptar una imagen renombrada o un
      // PDF que quedó truncado durante la selección/carga desde el teléfono.
      const longitudFinal = Math.min(8192, estado.size);
      const final = Buffer.alloc(longitudFinal);
      await archivo.read(final, 0, longitudFinal, estado.size - longitudFinal);
      return final.includes(Buffer.from("%%EOF"));
    } finally {
      await archivo.close();
    }
  };

const ejecutarCompresionPdf =
  async ({
    rutaEntrada,
    rutaSalida,
  }: {
    rutaEntrada: string;
    rutaSalida: string;
  }): Promise<void> => {
    await ejecutarArchivo(
      "gs",
      [
        "-sDEVICE=pdfwrite",
        "-dCompatibilityLevel=1.4",
        "-dPDFSETTINGS=/ebook",
        "-dDetectDuplicateImages=true",
        "-dCompressFonts=true",
        "-dSubsetFonts=true",
        "-dDownsampleColorImages=true",
        "-dColorImageResolution=150",
        "-dDownsampleGrayImages=true",
        "-dGrayImageResolution=150",
        "-dDownsampleMonoImages=true",
        "-dMonoImageResolution=300",
        "-dNOPAUSE",
        "-dQUIET",
        "-dBATCH",
        `-sOutputFile=${rutaSalida}`,
        rutaEntrada,
      ],
      {
        maxBuffer:
          10 *
          1024 *
          1024,
      },
    );
  };

/*
|--------------------------------------------------------------------------
| Comprimir PDF conservando siempre el archivo más pequeño
|--------------------------------------------------------------------------
|
| Ghostscript puede generar un archivo mayor cuando el PDF original ya está
| optimizado. En ese caso se conserva el original.
|
*/

export const comprimirPdfOptimizado =
  async ({
    rutaEntrada,
    rutaSalida,
  }: {
    rutaEntrada: string;
    rutaSalida: string;
  }): Promise<void> => {
    const carpetaSalida =
      path.dirname(
        rutaSalida,
      );

    await fs.mkdir(
      carpetaSalida,
      {
        recursive: true,
      },
    );

    const rutaComprimidaTemporal =
      `${rutaSalida}.optimizando`;

    try {
      await ejecutarCompresionPdf({
        rutaEntrada,
        rutaSalida:
          rutaComprimidaTemporal,
      });

      const pdfComprimidoValido =
        await verificarArchivoPdf(
          rutaComprimidaTemporal,
        );

      if (!pdfComprimidoValido) {
        throw new Error(
          "Ghostscript no generó un PDF válido",
        );
      }

      const [
        original,
        comprimido,
      ] =
        await Promise.all([
          fs.stat(
            rutaEntrada,
          ),

          fs.stat(
            rutaComprimidaTemporal,
          ),
        ]);

      if (
        comprimido.size <
        original.size
      ) {
        await fs.rename(
          rutaComprimidaTemporal,
          rutaSalida,
        );
      } else {
        await fs.copyFile(
          rutaEntrada,
          rutaSalida,
        );

        await fs.rm(
          rutaComprimidaTemporal,
          {
            force: true,
          },
        );
      }
    } catch (error) {
      await fs.rm(
        rutaComprimidaTemporal,
        {
          force: true,
        },
      );

      // Si Ghostscript no está instalado en el contenedor o no puede
      // optimizar un PDF que ya verificamos, conservar el original. La
      // compresión es una mejora, no debe impedir el registro del usuario.
      if (await verificarArchivoPdf(rutaEntrada)) {
        await fs.copyFile(rutaEntrada, rutaSalida);
        return;
      }

      throw error;
    }
  };
