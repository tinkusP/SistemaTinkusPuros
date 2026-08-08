// import multer from "multer";
// import path from "path";
// import fs from "fs";

// const carpetaDestino = path.resolve(
//   process.cwd(),
//   "uploads/cuentas-perfil",
// );

// if (!fs.existsSync(carpetaDestino)) {
//   fs.mkdirSync(carpetaDestino, {
//     recursive: true,
//   });
// }

// const storage = multer.diskStorage({
//   destination: (
//     _req,
//     _file,
//     callback,
//   ) => {
//     callback(null, carpetaDestino);
//   },

//   filename: (
//     req,
//     file,
//     callback,
//   ) => {
//     const ci =
//       typeof req.body?.ci === "string"
//         ? req.body.ci.replace(
//             /[^a-zA-Z0-9_-]/g,
//             "",
//           )
//         : Date.now().toString();

//     const extension =
//       path.extname(file.originalname) ||
//       ".webp";

//     callback(
//       null,
//       `${ci}-${Date.now()}${extension}`,
//     );
//   },
// });

// export const uploadCuentaPerfil =
//   multer({
//     storage,

//     limits: {
//       fileSize: 5 * 1024 * 1024,
//     },

//     fileFilter: (
//       _req,
//       file,
//       callback,
//     ) => {
//       const tiposPermitidos = [
//         "image/jpeg",
//         "image/png",
//         "image/webp",
//       ];

//       if (
//         !tiposPermitidos.includes(
//           file.mimetype,
//         )
//       ) {
//         return callback(
//           new Error(
//             "Solo se permiten imágenes JPG, PNG o WebP",
//           ),
//         );
//       }

//       callback(null, true);
//     },
//   });

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

import multer from "multer";

/*
|--------------------------------------------------------------------------
| Carpeta temporal
|--------------------------------------------------------------------------
|
| El controlador procesa los archivos después:
| - La foto se convierte a WebP.
| - Los PDF se comprimen.
| - Los temporales se eliminan al finalizar.
|
*/

const carpetaTemporal = path.resolve(
  process.cwd(),
  "storage",
  "temp",
  "registro-cuentas",
);

fs.mkdirSync(carpetaTemporal, {
  recursive: true,
});

/*
|--------------------------------------------------------------------------
| Tipos permitidos por campo
|--------------------------------------------------------------------------
*/

const TIPOS_IMAGEN_PERMITIDOS = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const CAMPOS_DOCUMENTO = new Set([
  "carnetIdentidadPdf",
  "carnetIdentidadReverso",
  "registroUniversitarioPdf",
]);

/*
|--------------------------------------------------------------------------
| Almacenamiento temporal
|--------------------------------------------------------------------------
*/

const storage = multer.diskStorage({
  destination: (
    _req,
    _file,
    callback,
  ) => {
    callback(
      null,
      carpetaTemporal,
    );
  },

  filename: (
    _req,
    file,
    callback,
  ) => {
    const extensionOriginal = path
      .extname(file.originalname)
      .toLowerCase();

    const extension =
      file.fieldname === "fotoPerfil"
        ? extensionOriginal || ".img"
        : extensionOriginal || ".documento";

    const nombreTemporal =
      `${file.fieldname}_${Date.now()}_${crypto.randomUUID()}${extension}`;

    callback(
      null,
      nombreTemporal,
    );
  },
});

/*
|--------------------------------------------------------------------------
| Validación inicial de archivos
|--------------------------------------------------------------------------
|
| El controlador también revisa la firma %PDF- para impedir que un archivo
| falso pase únicamente por tener extensión o MIME de PDF.
|
*/

const fileFilter: multer.Options["fileFilter"] = (
  _req,
  file,
  callback,
) => {
  const extension = path
    .extname(file.originalname)
    .toLowerCase();

  if (
    file.fieldname ===
    "fotoPerfil"
  ) {
    if (
      !TIPOS_IMAGEN_PERMITIDOS.has(
        file.mimetype,
      )
    ) {
      callback(
        new Error(
          "La foto de perfil debe ser JPG, PNG o WebP",
        ),
      );

      return;
    }

    callback(
      null,
      true,
    );

    return;
  }

  if (
    CAMPOS_DOCUMENTO.has(
      file.fieldname,
    )
  ) {
    if (
      !(
        (extension === ".pdf" && ["application/pdf", "application/octet-stream"].includes(file.mimetype)) ||
        TIPOS_IMAGEN_PERMITIDOS.has(file.mimetype)
      )
    ) {
      callback(
        new Error(
          "El carnet de identidad y el registro universitario deben ser PDF, JPG, PNG o WebP",
        ),
      );

      return;
    }

    callback(
      null,
      true,
    );

    return;
  }

  callback(
    new Error(
      `El campo de archivo ${file.fieldname} no está permitido`,
    ),
  );
};

/*
|--------------------------------------------------------------------------
| Middleware
|--------------------------------------------------------------------------
|
| El límite se aplica individualmente a cada archivo.
| La compresión posterior reduce el tamaño de los PDF almacenados.
|
*/

export const uploadRegistroCuenta =
  multer({
    storage,
    fileFilter,

    limits: {
      files: 4,

      /*
       * Máximo de 15 MB por archivo temporal.
       */
      fileSize:
        15 *
        1024 *
        1024,

      fields: 40,
    },
  });
