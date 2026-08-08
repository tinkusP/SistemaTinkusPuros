interface OpcionesCompresion {
  anchoMaximo?: number;
  altoMaximo?: number;
  calidad?: number;
}

export async function comprimirImagen(
  archivo: File,
  opciones: OpcionesCompresion = {},
): Promise<File> {
  const {
    anchoMaximo = 1200,
    altoMaximo = 1200,
    calidad = 0.75,
  } = opciones;

  if (!archivo.type.startsWith("image/")) {
    throw new Error("El archivo seleccionado no es una imagen");
  }

  const imagen = await cargarImagen(archivo);

  const escala = Math.min(
    anchoMaximo / imagen.width,
    altoMaximo / imagen.height,
    1,
  );

  const nuevoAncho = Math.round(
    imagen.width * escala,
  );

  const nuevoAlto = Math.round(
    imagen.height * escala,
  );

  const canvas =
    document.createElement("canvas");

  canvas.width = nuevoAncho;
  canvas.height = nuevoAlto;

  const contexto =
    canvas.getContext("2d");

  if (!contexto) {
    throw new Error(
      "No se pudo procesar la imagen",
    );
  }

  contexto.drawImage(
    imagen,
    0,
    0,
    nuevoAncho,
    nuevoAlto,
  );

  const blob = await new Promise<Blob>(
    (resolve, reject) => {
      canvas.toBlob(
        (resultado) => {
          if (!resultado) {
            reject(
              new Error(
                "No se pudo comprimir la imagen",
              ),
            );

            return;
          }

          resolve(resultado);
        },
        "image/webp",
        calidad,
      );
    },
  );

  const nombreBase =
    archivo.name.replace(/\.[^.]+$/, "");

  return new File(
    [blob],
    `${nombreBase}.webp`,
    {
      type: "image/webp",
      lastModified: Date.now(),
    },
  );
}

function cargarImagen(
  archivo: File,
): Promise<HTMLImageElement> {
  return new Promise(
    (resolve, reject) => {
      const imagen = new Image();
      const url = URL.createObjectURL(archivo);

      imagen.onload = () => {
        URL.revokeObjectURL(url);
        resolve(imagen);
      };

      imagen.onerror = () => {
        URL.revokeObjectURL(url);

        reject(
          new Error(
            "No se pudo leer la imagen seleccionada",
          ),
        );
      };

      imagen.src = url;
    },
  );
}