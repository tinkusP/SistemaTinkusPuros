import {
  keepPreviousData,
  useQuery,
} from "@tanstack/react-query";
import {
  CalendarCheck,
  CalendarDays,
  Eye,
  Pencil,
  Plus,
  Search,
  UserRound,
  UsersRound,
} from "lucide-react";
import {
  useDeferredValue,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  useNavigate,
} from "react-router-dom";

import {
  obtenerGestiones,
} from "../../api/GestionApi";
import GestionDetailModal from "../../components/gestion/GestionDetailModal";
import type {
  EstadoGestion,
  Gestion,
} from "../../types/GestionType";

const formatearFecha = (
  fecha?: string | null,
): string => {
  if (!fecha) {
    return "Sin configurar";
  }

  const fechaConvertida =
    new Date(fecha);

  if (
    Number.isNaN(
      fechaConvertida.getTime(),
    )
  ) {
    return "Fecha no válida";
  }

  return new Intl.DateTimeFormat(
    "es-BO",
    {
      year: "numeric",
      month: "short",
      day: "2-digit",
    },
  ).format(
    fechaConvertida,
  );
};

const claseEstado = (
  estado: EstadoGestion,
): string => {
  const clases: Record<
    EstadoGestion,
    string
  > = {
    PLANIFICACION:
      "bg-slate-100 text-slate-700",
    INSCRIPCIONES:
      "bg-amber-100 text-amber-800",
    ACTIVA:
      "bg-emerald-100 text-emerald-800",
    CERRADA:
      "bg-red-100 text-red-700",
  };

  return clases[estado];
};

const nombreEstado = (
  estado: EstadoGestion,
): string => {
  const nombres: Record<
    EstadoGestion,
    string
  > = {
    PLANIFICACION:
      "Planificación",
    INSCRIPCIONES:
      "Inscripciones",
    ACTIVA:
      "Activa",
    CERRADA:
      "Cerrada",
  };

  return nombres[estado];
};

export default function GestionView() {
  const navigate =
    useNavigate();

  const [
    buscar,
    setBuscar,
  ] =
    useState("");

  const buscarDiferido =
    useDeferredValue(
      buscar.trim(),
    );

  const [
    estado,
    setEstado,
  ] =
    useState<
      EstadoGestion | ""
    >("");

  const [
    anio,
    setAnio,
  ] =
    useState<
      number | ""
    >("");

  const [
    pagina,
    setPagina,
  ] =
    useState(1);

  const [
    gestionSeleccionada,
    setGestionSeleccionada,
  ] =
    useState<
      Gestion | null
    >(null);

  const gestionesQuery =
    useQuery({
      queryKey: [
        "gestiones",
        {
          buscar:
            buscarDiferido,
          estado,
          anio,
          pagina,
          limite:
            10,
        },
      ],

      queryFn: () =>
        obtenerGestiones({
          buscar:
            buscarDiferido,
          estado,
          anio,
          pagina,
          limite:
            10,
        }),

      placeholderData:
        keepPreviousData,
    });

  const gestiones =
    gestionesQuery.data
      ?.gestiones ?? [];

  const estadisticasPagina =
    useMemo(() => {
      return {
        totalRegistros:
          gestionesQuery
            .data
            ?.paginacion
            .total ?? 0,

        activas:
          gestiones.filter(
            (gestion) =>
              gestion.estado ===
              "ACTIVA",
          ).length,

        cupoHombres:
          gestiones.reduce(
            (
              acumulado,
              gestion,
            ) =>
              acumulado +
              gestion.cupoMaximoHombres,
            0,
          ),

        cupoMujeres:
          gestiones.reduce(
            (
              acumulado,
              gestion,
            ) =>
              acumulado +
              gestion.cupoMaximoMujeres,
            0,
          ),
      };
    }, [
      gestiones,
      gestionesQuery.data,
    ]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-gradient-to-r from-[#74122A] via-[#8F5F2A] to-[#C59A3A] p-6 text-white shadow-lg">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div>
            <p className="text-sm font-medium text-white/80">
              Administración anual
            </p>

            <h1 className="text-3xl font-bold">
              Gestiones
            </h1>

            <p className="mt-2 max-w-2xl text-white/80">
              Administra periodos, inscripciones, cupos por hombres y mujeres, y estados.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              navigate(
                "/gestion/crear",
              )
            }
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 font-semibold text-[#74122A] transition hover:bg-[#F6F0E3]"
          >
            <Plus className="h-5 w-5" />
            Crear gestión
          </button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <TarjetaEstadistica
          titulo="Total de gestiones"
          valor={
            estadisticasPagina
              .totalRegistros
          }
          icon={
            <CalendarDays />
          }
        />

        <TarjetaEstadistica
          titulo="Activas en esta página"
          valor={
            estadisticasPagina
              .activas
          }
          icon={
            <CalendarCheck />
          }
        />

        <TarjetaEstadistica
          titulo="Cupo hombres visible"
          valor={
            estadisticasPagina
              .cupoHombres
          }
          icon={
            <UserRound />
          }
        />

        <TarjetaEstadistica
          titulo="Cupo mujeres visible"
          valor={
            estadisticasPagina
              .cupoMujeres
          }
          icon={
            <UsersRound />
          }
        />
      </section>

      <section className="rounded-2xl border border-[#D8CABB] bg-white shadow-sm">
        <div className="grid gap-4 border-b border-[#E5D9CC] p-5 md:grid-cols-[minmax(0,1fr)_220px_180px]">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-5 w-5 text-[#8F5F2A]" />

            <input
              type="text"
              value={buscar}
              onChange={(
                event,
              ) => {
                setBuscar(
                  event.target
                    .value,
                );
                setPagina(1);
              }}
              placeholder="Buscar por nombre o descripción..."
              className="input-gestion pl-11"
            />
          </div>

          <select
            value={estado}
            onChange={(
              event,
            ) => {
              setEstado(
                event.target
                  .value as
                  | EstadoGestion
                  | "",
              );
              setPagina(1);
            }}
            className="input-gestion"
          >
            <option value="">
              Todos los estados
            </option>
            <option value="PLANIFICACION">
              Planificación
            </option>
            <option value="INSCRIPCIONES">
              Inscripciones
            </option>
            <option value="ACTIVA">
              Activa
            </option>
            <option value="CERRADA">
              Cerrada
            </option>
          </select>

          <input
            type="number"
            min={2020}
            max={2100}
            value={anio}
            onChange={(
              event,
            ) => {
              const valor =
                event.target.value;

              setAnio(
                valor
                  ? Number(valor)
                  : "",
              );
              setPagina(1);
            }}
            className="input-gestion"
            placeholder="Filtrar por año"
          />
        </div>

        {gestionesQuery.isLoading && (
          <div className="p-10 text-center text-[#796D70]">
            Cargando gestiones...
          </div>
        )}

        {gestionesQuery.isError && (
          <div className="p-10 text-center text-red-600">
            {gestionesQuery.error instanceof Error
              ? gestionesQuery.error.message
              : "No se pudieron cargar las gestiones."}
          </div>
        )}

        {!gestionesQuery.isLoading &&
          !gestionesQuery.isError &&
          gestiones.length === 0 && (
            <div className="p-12 text-center">
              <CalendarDays className="mx-auto mb-3 h-12 w-12 text-[#C59A3A]" />

              <p className="font-semibold text-[#262022]">
                No existen gestiones para los filtros seleccionados
              </p>

              <p className="mt-1 text-sm text-[#796D70]">
                Cambia los filtros o registra una nueva gestión.
              </p>
            </div>
          )}

        {gestiones.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-[#F6F0E3] text-left text-sm text-[#74122A]">
                <tr>
                  <th className="px-5 py-4">
                    Gestión
                  </th>
                  <th className="px-5 py-4">
                    Periodo
                  </th>
                  <th className="px-5 py-4">
                    Inscripciones
                  </th>
                  <th className="px-5 py-4">
                    Cupos
                  </th>
                  <th className="px-5 py-4">
                    Estado
                  </th>
                  <th className="px-5 py-4 text-right">
                    Acciones
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#EEE5DB]">
                {gestiones.map(
                  (
                    gestion,
                  ) => (
                    <tr
                      key={gestion._id}
                      className="transition hover:bg-[#FCF9F3]"
                    >
                      <td className="px-5 py-4">
                        <p className="font-semibold text-[#262022]">
                          {gestion.nombre}
                        </p>

                        <p className="text-sm text-[#796D70]">
                          Año {gestion.anio}
                        </p>
                      </td>

                      <td className="px-5 py-4 text-sm text-[#4E4548]">
                        <p>
                          {formatearFecha(
                            gestion.fechaInicio,
                          )}
                        </p>

                        <p className="text-[#796D70]">
                          hasta{" "}
                          {formatearFecha(
                            gestion.fechaFin,
                          )}
                        </p>
                      </td>

                      <td className="px-5 py-4 text-sm text-[#4E4548]">
                        {gestion.fechaInicioInscripcion &&
                        gestion.fechaFinInscripcion ? (
                          <>
                            <p>
                              {formatearFecha(
                                gestion.fechaInicioInscripcion,
                              )}
                            </p>

                            <p className="text-[#796D70]">
                              hasta{" "}
                              {formatearFecha(
                                gestion.fechaFinInscripcion,
                              )}
                            </p>
                          </>
                        ) : (
                          <span className="text-[#B7A7A0]">
                            Sin configurar
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4 text-sm">
                        <p className="text-[#4E4548]">
                          Hombres:{" "}
                          <strong>
                            {gestion.cupoMaximoHombres}
                          </strong>
                        </p>

                        <p className="text-[#4E4548]">
                          Mujeres:{" "}
                          <strong>
                            {gestion.cupoMaximoMujeres}
                          </strong>
                        </p>

                        <p className="mt-1 font-semibold text-[#74122A]">
                          Total:{" "}
                          {gestion.cupoMaximo}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${claseEstado(
                            gestion.estado,
                          )}`}
                        >
                          {nombreEstado(
                            gestion.estado,
                          )}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setGestionSeleccionada(
                                gestion,
                              )
                            }
                            className="rounded-lg border border-[#C59A3A] p-2 text-[#8F5F2A] transition hover:bg-[#F6F0E3]"
                            title="Ver gestión"
                            aria-label={`Ver ${gestion.nombre}`}
                          >
                            <Eye className="h-5 w-5" />
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              navigate(
                                `/gestion/${gestion._id}/editar`,
                              )
                            }
                            className="rounded-lg bg-[#74122A] p-2 text-white transition hover:bg-[#5C0E21]"
                            title="Editar gestión"
                            aria-label={`Editar ${gestion.nombre}`}
                          >
                            <Pencil className="h-5 w-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}

        {gestionesQuery.data &&
          gestionesQuery.data
            .paginacion
            .totalPaginas > 1 && (
            <div className="flex flex-col gap-3 border-t border-[#E5D9CC] p-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-[#796D70]">
                Página{" "}
                {
                  gestionesQuery
                    .data
                    .paginacion
                    .pagina
                }{" "}
                de{" "}
                {
                  gestionesQuery
                    .data
                    .paginacion
                    .totalPaginas
                }
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={
                    pagina === 1 ||
                    gestionesQuery.isFetching
                  }
                  onClick={() =>
                    setPagina(
                      (
                        paginaActual,
                      ) =>
                        Math.max(
                          1,
                          paginaActual - 1,
                        ),
                    )
                  }
                  className="rounded-lg border border-[#74122A] px-4 py-2 text-sm font-semibold text-[#74122A] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Anterior
                </button>

                <button
                  type="button"
                  disabled={
                    pagina >=
                      gestionesQuery
                        .data
                        .paginacion
                        .totalPaginas ||
                    gestionesQuery.isFetching
                  }
                  onClick={() =>
                    setPagina(
                      (
                        paginaActual,
                      ) =>
                        paginaActual + 1,
                    )
                  }
                  className="rounded-lg bg-[#74122A] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
      </section>

      <GestionDetailModal
        gestion={gestionSeleccionada}
        abierto={Boolean(
          gestionSeleccionada,
        )}
        onCerrar={() =>
          setGestionSeleccionada(
            null,
          )
        }
      />
    </div>
  );
}

type TarjetaEstadisticaProps = {
  titulo:
    string;
  valor:
    number;
  icon:
    ReactNode;
};

function TarjetaEstadistica({
  titulo,
  valor,
  icon,
}: TarjetaEstadisticaProps) {
  return (
    <article className="rounded-2xl border border-[#D8CABB] bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-[#796D70]">
            {titulo}
          </p>

          <p className="mt-1 text-3xl font-bold text-[#74122A]">
            {valor}
          </p>
        </div>

        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#F1E5CC] text-[#8F5F2A]">
          {icon}
        </div>
      </div>
    </article>
  );
}