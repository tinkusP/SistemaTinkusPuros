import { useMemo, useState } from "react";

type TipoPublicacion =
  | "AFICHE"
  | "COMUNICADO"
  | "CONVOCATORIA"
  | "ACTIVIDAD";

type Publicacion = {
  _id: string;
  titulo: string;
  descripcion: string;
  tipo: TipoPublicacion;
  imagen?: string | null;
  archivo?: string | null;
  fechaPublicacion: string;
  fechaEvento?: string | null;
  fijado?: boolean;
  autor?: string;
};

const publicacionesEjemplo: Publicacion[] = [
  {
    _id: "1",
    titulo: "Gran ensayo general",
    descripcion:
      "Se comunica a todos los fraternos que el ensayo general se realizará este sábado. La asistencia será obligatoria.",
    tipo: "COMUNICADO",
    imagen:
      "/imagenes/comunicados/ensayo-general.jpg",
    fechaPublicacion: "2026-07-17T15:30:00",
    fechaEvento: "2026-07-20T15:00:00",
    fijado: true,
    autor: "Directiva Tinkus Puros",
  },
  {
    _id: "2",
    titulo: "Entrada Folklórica Universitaria 2026",
    descripcion:
      "Prepárate para representar con orgullo a nuestra facultad en la Entrada Folklórica Universitaria.",
    tipo: "AFICHE",
    imagen:
      "/imagenes/comunicados/entrada-2026.jpg",
    fechaPublicacion: "2026-07-16T10:00:00",
    fijado: true,
    autor: "Administración",
  },
  {
    _id: "3",
    titulo: "Convocatoria para guías de bloque",
    descripcion:
      "Se invita a los fraternos antiguos a postular como guías de bloque para la gestión 2026.",
    tipo: "CONVOCATORIA",
    archivo:
      "/documentos/convocatoria-guias.pdf",
    fechaPublicacion: "2026-07-14T09:00:00",
    fechaEvento: "2026-07-25T23:59:00",
    autor: "Directiva",
  },
];

const API_URL = String(
  import.meta.env.VITE_API_URL || "",
).replace(/\/api\/?$/, "");

function obtenerUrlArchivo(
  ruta?: string | null,
) {
  if (!ruta) return null;

  if (
    ruta.startsWith("http://") ||
    ruta.startsWith("https://")
  ) {
    return ruta;
  }

  /*
   * Si la ruta comienza con /imagenes y está en
   * la carpeta public del frontend, se utiliza directamente.
   */
  if (
    ruta.startsWith("/imagenes") ||
    ruta.startsWith("/documentos")
  ) {
    return ruta;
  }

  /*
   * Para imágenes y archivos almacenados en el backend:
   * /uploads/comunicados/archivo.webp
   */
  return `${API_URL}${ruta}`;
}

export default function ComunicadosView() {
  const [publicaciones] =
    useState<Publicacion[]>(
      publicacionesEjemplo,
    );

  const [busqueda, setBusqueda] =
    useState("");

  const [tipoSeleccionado, setTipoSeleccionado] =
    useState<"TODOS" | TipoPublicacion>(
      "TODOS",
    );

  const publicacionesFiltradas =
    useMemo(() => {
      const texto =
        busqueda.trim().toLowerCase();

      return publicaciones
        .filter((publicacion) => {
          const coincideTipo =
            tipoSeleccionado === "TODOS" ||
            publicacion.tipo ===
              tipoSeleccionado;

          const coincideTexto =
            !texto ||
            publicacion.titulo
              .toLowerCase()
              .includes(texto) ||
            publicacion.descripcion
              .toLowerCase()
              .includes(texto);

          return (
            coincideTipo &&
            coincideTexto
          );
        })
        .sort((a, b) => {
          if (a.fijado && !b.fijado) {
            return -1;
          }

          if (!a.fijado && b.fijado) {
            return 1;
          }

          return (
            new Date(
              b.fechaPublicacion,
            ).getTime() -
            new Date(
              a.fechaPublicacion,
            ).getTime()
          );
        });
    }, [
      publicaciones,
      busqueda,
      tipoSeleccionado,
    ]);

  return (
    <div className="min-h-screen w-full bg-slate-50 px-3 py-5 text-slate-900 sm:px-5 lg:px-8 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        {/* Encabezado */}

        <section className="overflow-hidden rounded-3xl bg-gradient-to-r from-fuchsia-700 via-purple-700 to-indigo-700 px-5 py-8 text-white shadow-lg sm:px-8 sm:py-10">
          <div className="max-w-3xl">
            <span className="inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">
              Tinkus Puros y Naturales
            </span>

            <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
              Comunicados y actividades
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/80 sm:text-base">
              Revisa los últimos afiches,
              convocatorias, ensayos y avisos
              importantes publicados por la
              directiva.
            </p>
          </div>
        </section>

        {/* Buscador y filtros */}

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-md">
              <input
                type="search"
                value={busqueda}
                onChange={(event) =>
                  setBusqueda(
                    event.target.value,
                  )
                }
                placeholder="Buscar comunicado..."
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 pl-11 text-sm outline-none transition focus:border-fuchsia-500 focus:ring-4 focus:ring-fuchsia-100 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-fuchsia-950"
              />

              <span className="pointer-events-none absolute left-4 top-3 text-slate-400">
                🔎
              </span>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              <BotonFiltro
                texto="Todos"
                activo={
                  tipoSeleccionado ===
                  "TODOS"
                }
                onClick={() =>
                  setTipoSeleccionado(
                    "TODOS",
                  )
                }
              />

              <BotonFiltro
                texto="Afiches"
                activo={
                  tipoSeleccionado ===
                  "AFICHE"
                }
                onClick={() =>
                  setTipoSeleccionado(
                    "AFICHE",
                  )
                }
              />

              <BotonFiltro
                texto="Comunicados"
                activo={
                  tipoSeleccionado ===
                  "COMUNICADO"
                }
                onClick={() =>
                  setTipoSeleccionado(
                    "COMUNICADO",
                  )
                }
              />

              <BotonFiltro
                texto="Convocatorias"
                activo={
                  tipoSeleccionado ===
                  "CONVOCATORIA"
                }
                onClick={() =>
                  setTipoSeleccionado(
                    "CONVOCATORIA",
                  )
                }
              />

              <BotonFiltro
                texto="Actividades"
                activo={
                  tipoSeleccionado ===
                  "ACTIVIDAD"
                }
                onClick={() =>
                  setTipoSeleccionado(
                    "ACTIVIDAD",
                  )
                }
              />
            </div>
          </div>
        </section>

        {/* Publicaciones */}

        {publicacionesFiltradas.length >
        0 ? (
          <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {publicacionesFiltradas.map(
              (publicacion) => (
                <TarjetaPublicacion
                  key={publicacion._id}
                  publicacion={
                    publicacion
                  }
                />
              ),
            )}
          </section>
        ) : (
          <section className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center dark:border-slate-700 dark:bg-slate-900">
            <div className="text-5xl">
              📭
            </div>

            <h2 className="mt-4 text-xl font-bold">
              No se encontraron publicaciones
            </h2>

            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Intenta cambiar el filtro o el
              texto de búsqueda.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}

type TarjetaPublicacionProps = {
  publicacion: Publicacion;
};

function TarjetaPublicacion({
  publicacion,
}: TarjetaPublicacionProps) {
  const [errorImagen, setErrorImagen] =
    useState(false);

  const urlImagen = obtenerUrlArchivo(
    publicacion.imagen,
  );

  const urlArchivo = obtenerUrlArchivo(
    publicacion.archivo,
  );

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900">
      {/* Imagen */}

      {urlImagen && !errorImagen ? (
        <div className="relative aspect-[16/10] overflow-hidden bg-slate-100 dark:bg-slate-800">
          <img
            src={urlImagen}
            alt={publicacion.titulo}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            onError={() =>
              setErrorImagen(true)
            }
          />

          {publicacion.fijado && (
            <span className="absolute left-3 top-3 rounded-full bg-slate-950/75 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
              📌 Fijado
            </span>
          )}
        </div>
      ) : (
        <div className="relative grid aspect-[16/10] place-items-center bg-gradient-to-br from-fuchsia-600 to-indigo-700 text-6xl text-white">
          {obtenerIconoTipo(
            publicacion.tipo,
          )}

          {publicacion.fijado && (
            <span className="absolute left-3 top-3 rounded-full bg-slate-950/75 px-3 py-1 text-xs font-semibold text-white">
              📌 Fijado
            </span>
          )}
        </div>
      )}

      {/* Contenido */}

      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <EtiquetaTipo
            tipo={publicacion.tipo}
          />

          <span className="text-xs text-slate-400">
            {formatearFecha(
              publicacion.fechaPublicacion,
            )}
          </span>
        </div>

        <h2 className="mt-4 text-xl font-black leading-snug text-slate-900 dark:text-white">
          {publicacion.titulo}
        </h2>

        <p className="mt-3 line-clamp-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
          {publicacion.descripcion}
        </p>

        {publicacion.fechaEvento && (
          <div className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            <span className="font-semibold">
              📅 Fecha importante:
            </span>{" "}
            {formatearFechaHora(
              publicacion.fechaEvento,
            )}
          </div>
        )}

        <div className="mt-auto pt-5">
          {publicacion.autor && (
            <p className="mb-3 text-xs text-slate-400">
              Publicado por{" "}
              <span className="font-semibold text-slate-600 dark:text-slate-300">
                {publicacion.autor}
              </span>
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {urlImagen && (
              <a
                href={urlImagen}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl bg-fuchsia-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-fuchsia-700"
              >
                Ver afiche
              </a>
            )}

            {urlArchivo && (
              <a
                href={urlArchivo}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Ver documento
              </a>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

type BotonFiltroProps = {
  texto: string;
  activo: boolean;
  onClick: () => void;
};

function BotonFiltro({
  texto,
  activo,
  onClick,
}: BotonFiltroProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-xl px-4 py-2 text-sm font-semibold transition ${
        activo
          ? "bg-fuchsia-600 text-white shadow-sm"
          : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
      }`}
    >
      {texto}
    </button>
  );
}

function EtiquetaTipo({
  tipo,
}: {
  tipo: TipoPublicacion;
}) {
  const estilos: Record<
    TipoPublicacion,
    string
  > = {
    AFICHE:
      "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950/40 dark:text-fuchsia-300",

    COMUNICADO:
      "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",

    CONVOCATORIA:
      "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",

    ACTIVIDAD:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  };

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-bold ${estilos[tipo]}`}
    >
      {obtenerIconoTipo(tipo)}{" "}
      {tipo}
    </span>
  );
}

function obtenerIconoTipo(
  tipo: TipoPublicacion,
) {
  const iconos: Record<
    TipoPublicacion,
    string
  > = {
    AFICHE: "🖼️",
    COMUNICADO: "📢",
    CONVOCATORIA: "📋",
    ACTIVIDAD: "🎉",
  };

  return iconos[tipo];
}

function formatearFecha(
  fecha: string,
) {
  const fechaConvertida =
    new Date(fecha);

  if (
    Number.isNaN(
      fechaConvertida.getTime(),
    )
  ) {
    return fecha;
  }

  return fechaConvertida.toLocaleDateString(
    "es-BO",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    },
  );
}

function formatearFechaHora(
  fecha: string,
) {
  const fechaConvertida =
    new Date(fecha);

  if (
    Number.isNaN(
      fechaConvertida.getTime(),
    )
  ) {
    return fecha;
  }

  return fechaConvertida.toLocaleString(
    "es-BO",
    {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  );
}