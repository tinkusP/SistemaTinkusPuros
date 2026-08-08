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
    const archivo =
      await fs.open(
        rutaArchivo,
        "r",
      );

    try {
      const encabezado =
        Buffer.alloc(5);

      await archivo.read(
        encabezado,
        0,
        encabezado.length,
        0,
      );

      return (
        encabezado.toString(
          "utf8",
        ) ===
        "%PDF-"
      );
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

      throw error;
    }
  };