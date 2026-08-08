import {
  useMemo,
  useState,
} from "react";

import {
  Link,
} from "react-router-dom";

import {
  useQuery,
} from "@tanstack/react-query";

import {
  obtenerRoles,
} from "@/api/RolApi";

import RolDetailModal from "@/components/rol/RolDetailModal";

type Rol = {
  _id: string;
  nombre: string;
  codigo: string;
  descripcion?: string | null;
  permisos?: string[];
  estado?: boolean;
  esRolSistema?: boolean;
  fechaCreado?: string | null;
};

type RespuestaRoles =
  | Rol[]
  | {
      roles?: Rol[];
      data?: Rol[];
    };

function normalizarRoles(
  respuesta: RespuestaRoles | undefined,
): Rol[] {
  if (!respuesta) {
    return [];
  }

  if (Array.isArray(respuesta)) {
    return respuesta;
  }

  if (
    Array.isArray(
      respuesta.roles,
    )
  ) {
    return respuesta.roles;
  }

  if (
    Array.isArray(
      respuesta.data,
    )
  ) {
    return respuesta.data;
  }

  return [];
}

export default function RolesView() {
  const [
    busqueda,
    setBusqueda,
  ] = useState("");

  const [
    rolSeleccionado,
    setRolSeleccionado,
  ] = useState<string | null>(
    null,
  );

  const {
    data,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: [
      "roles",
    ],
    queryFn:
      obtenerRoles,
  });

  const roles =
    useMemo(
      () =>
        normalizarRoles(
          data as RespuestaRoles,
        ),
      [
        data,
      ],
    );

  const rolesFiltrados =
    useMemo(() => {
      const texto =
        busqueda
          .trim()
          .toLowerCase();

      if (!texto) {
        return roles;
      }

      return roles.filter(
        (rol) => {
          const permisos =
            rol.permisos ||
            [];

          return (
            rol.nombre
              .toLowerCase()
              .includes(
                texto,
              ) ||
            rol.codigo
              .toLowerCase()
              .includes(
                texto,
              ) ||
            (
              rol.descripcion ||
              ""
            )
              .toLowerCase()
              .includes(
                texto,
              ) ||
            permisos.some(
              (
                permiso,
              ) =>
                permiso
                  .toLowerCase()
                  .includes(
                    texto,
                  ),
            )
          );
        },
      );
    }, [
      roles,
      busqueda,
    ]);

  const cantidadActivos =
    roles.filter(
      (rol) =>
        rol.estado !==
        false,
    ).length;

  const cantidadInactivos =
    roles.length -
    cantidadActivos;

  const totalPermisos =
    roles.reduce(
      (
        acumulador,
        rol,
      ) =>
        acumulador +
        (
          rol.permisos ||
          []
        ).length,
      0,
    );

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#74122A] dark:text-[#C59A3A]">
            Administración
          </p>

          <h1 className="mt-1 text-3xl font-black">
            Gestión de roles
          </h1>

          <p className="mt-2 max-w-2xl text-sm text-[#B7A7A0]">
            Consulta, crea y modifica los roles y permisos disponibles en el sistema.
          </p>
        </div>

        <Link
          to="/rol/crear"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#74122A] px-5 py-3 text-sm font-bold text-[#F6F0E3] transition hover:bg-[#5E0E22]"
        >
          <span>
            ＋
          </span>

          Crear rol
        </Link>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <TarjetaResumen
          titulo="Total de roles"
          valor={
            roles.length
          }
          icono="🛡️"
        />

        <TarjetaResumen
          titulo="Roles activos"
          valor={
            cantidadActivos
          }
          icono="✅"
        />

        <TarjetaResumen
          titulo="Roles inactivos"
          valor={
            cantidadInactivos
          }
          icono="⛔"
        />

        <TarjetaResumen
          titulo="Permisos asignados"
          valor={
            totalPermisos
          }
          icono="🔐"
        />
      </section>

      <section className="overflow-hidden rounded-3xl border border-[#B7A7A0] bg-[#F6F0E3] shadow-sm dark:border-[#B7A7A0]/30 dark:bg-[#262022]">
        <div className="flex flex-col gap-4 border-b border-[#B7A7A0]/40 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <h2 className="text-xl font-black">
              Lista de roles
            </h2>

            <p className="mt-1 text-sm text-[#B7A7A0]">
              Mostrando{" "}
              <strong>
                {
                  rolesFiltrados.length
                }
              </strong>{" "}
              de{" "}
              <strong>
                {
                  roles.length
                }
              </strong>{" "}
              roles.
            </p>
          </div>

          <div className="relative w-full sm:w-80">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#B7A7A0]">
              🔎
            </span>

            <input
              type="search"
              value={
                busqueda
              }
              onChange={(
                event,
              ) =>
                setBusqueda(
                  event.target.value,
                )
              }
              placeholder="Buscar por nombre, código o permiso..."
              className="w-full rounded-xl border border-[#B7A7A0] bg-white py-3 pl-11 pr-4 text-sm outline-none transition focus:border-[#74122A] focus:ring-4 focus:ring-[#C59A3A]/20 dark:bg-[#262022]"
            />
          </div>
        </div>

        {isLoading && (
          <div className="p-8 text-center text-sm text-[#B7A7A0]">
            Cargando roles...
          </div>
        )}

        {isError && (
          <div className="m-5 rounded-2xl border border-[#74122A]/30 bg-[#74122A]/10 p-5 text-sm text-[#74122A]">
            {error instanceof Error
              ? error.message
              : "No se pudo obtener la lista de roles"}
          </div>
        )}

        {!isLoading &&
          !isError &&
          rolesFiltrados.length ===
            0 && (
            <div className="p-10 text-center">
              <p className="text-lg font-bold">
                No se encontraron roles
              </p>

              <p className="mt-2 text-sm text-[#B7A7A0]">
                Prueba con otro criterio de búsqueda.
              </p>
            </div>
          )}

        {!isLoading &&
          !isError &&
          rolesFiltrados.length >
            0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] border-collapse text-left">
                <thead className="bg-[#B7A7A0]/15">
                  <tr className="text-xs uppercase tracking-wide text-[#B7A7A0]">
                    <th className="px-5 py-4 font-bold">
                      Rol
                    </th>

                    <th className="px-5 py-4 font-bold">
                      Código
                    </th>

                    <th className="px-5 py-4 font-bold">
                      Permisos
                    </th>

                    <th className="px-5 py-4 font-bold">
                      Estado
                    </th>

                    <th className="px-5 py-4 font-bold">
                      Tipo
                    </th>

                    <th className="px-5 py-4 text-right font-bold">
                      Acciones
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#B7A7A0]/30">
                  {rolesFiltrados.map(
                    (rol) => (
                      <tr
                        key={
                          rol._id
                        }
                        className="transition hover:bg-[#C59A3A]/10"
                      >
                        <td className="px-5 py-4">
                          <div>
                            <p className="font-bold">
                              {
                                rol.nombre
                              }
                            </p>

                            <p className="mt-1 max-w-xs truncate text-xs text-[#B7A7A0]">
                              {rol.descripcion ||
                                "Sin descripción"}
                            </p>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <span className="rounded-lg bg-[#74122A]/10 px-3 py-1.5 font-mono text-xs font-bold text-[#74122A] dark:text-[#C59A3A]">
                            {
                              rol.codigo
                            }
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex max-w-sm flex-wrap gap-1.5">
                            {(
                              rol.permisos ||
                              []
                            )
                              .slice(
                                0,
                                3,
                              )
                              .map(
                                (
                                  permiso,
                                ) => (
                                  <span
                                    key={
                                      permiso
                                    }
                                    className="rounded-full bg-[#C59A3A]/20 px-2.5 py-1 text-[11px] font-semibold text-[#74122A] dark:text-[#C59A3A]"
                                  >
                                    {
                                      permiso
                                    }
                                  </span>
                                ),
                              )}

                            {(
                              rol.permisos ||
                              []
                            ).length >
                              3 && (
                              <span className="rounded-full bg-[#B7A7A0]/20 px-2.5 py-1 text-[11px] font-semibold">
                                +
                                {(
                                  rol.permisos ||
                                  []
                                )
                                  .length -
                                  3}
                              </span>
                            )}

                            {(
                              rol.permisos ||
                              []
                            ).length ===
                              0 && (
                              <span className="text-xs text-[#B7A7A0]">
                                Sin permisos
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-bold ${
                              rol.estado !==
                              false
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {rol.estado !==
                            false
                              ? "ACTIVO"
                              : "INACTIVO"}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <span className="text-xs font-semibold">
                            {rol.esRolSistema
                              ? "Sistema"
                              : "Personalizado"}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setRolSeleccionado(
                                  rol._id,
                                )
                              }
                              className="rounded-lg border border-[#B7A7A0] px-3 py-2 text-xs font-bold transition hover:border-[#C59A3A] hover:bg-[#C59A3A]/10"
                            >
                              Ver
                            </button>

                            <Link
                              to={`/rol/${rol._id}/editar`}
                              className="rounded-lg bg-[#74122A] px-3 py-2 text-xs font-bold text-[#F6F0E3] transition hover:bg-[#5E0E22]"
                            >
                              Editar
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          )}
      </section>

      <RolDetailModal
        rolId={
          rolSeleccionado
        }
        abierto={Boolean(
          rolSeleccionado,
        )}
        onCerrar={() =>
          setRolSeleccionado(
            null,
          )
        }
      />
    </div>
  );
}

type TarjetaResumenProps = {
  titulo: string;
  valor: number;
  icono: string;
};

function TarjetaResumen({
  titulo,
  valor,
  icono,
}: TarjetaResumenProps) {
  return (
    <article className="rounded-3xl border border-[#B7A7A0] bg-[#F6F0E3] p-5 shadow-sm dark:border-[#B7A7A0]/30 dark:bg-[#262022]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#B7A7A0]">
            {titulo}
          </p>

          <p className="mt-3 text-3xl font-black">
            {valor}
          </p>
        </div>

        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#74122A] text-xl text-[#F6F0E3]">
          {icono}
        </span>
      </div>
    </article>
  );
}