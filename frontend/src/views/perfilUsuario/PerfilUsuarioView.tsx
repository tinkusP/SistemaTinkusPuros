import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Link,
  useNavigate,
} from "react-router-dom";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  Eye,
  LoaderCircle,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";

import {
  toast,
} from "react-toastify";

import {
  deletePerfilUsuario,
  getPerfilUsuarioById,
  getPerfilUsuarios,
} from "@/api/PerfilUsuarioApi";

import {
  esRolPoblado,
  type PerfilUsuarioDetalleType,
  type PerfilUsuarioType,
} from "@/types/PerfilUsuarioType";

import PerfilUsuarioDetalleModal from "@/components/perfilUsuario/PerfilUsuarioDetalleModal";

export default function PerfilUsuarioView() {
  const navigate =
    useNavigate();

  const queryClient =
    useQueryClient();

  /* =========================================
     MODAL DE DETALLE
  ========================================= */

  const [
    perfilSeleccionado,
    setPerfilSeleccionado,
  ] =
    useState<
      PerfilUsuarioDetalleType | null
    >(null);

  const [
    perfilCargandoId,
    setPerfilCargandoId,
  ] =
    useState<string | null>(
      null,
    );

  /* =========================================
     LISTADO
  ========================================= */

  const {
    data:
      perfiles = [],

    isLoading,
    isError,
    error,
  } =
    useQuery({
      queryKey: [
        "perfilusuarios",
      ],

      queryFn:
        getPerfilUsuarios,

      retry:
        false,
    });

  const [busqueda, setBusqueda] = useState("");
  const [filtroRapido, setFiltroRapido] = useState<"TODOS" | "PENDIENTE" | "ACTIVO" | "POSTULANTE" | "INACTIVO" | "ADMINISTRADOR">("TODOS");
  const [filasPorPagina, setFilasPorPagina] = useState(() =>
    window.innerWidth < 640 ? 5 : window.innerWidth < 1280 ? 10 : 20,
  );
  const [paginaActual, setPaginaActual] = useState(1);

  const perfilesFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return perfiles.filter((perfil) => {
      const roles = perfil.roles
        .filter(esRolPoblado)
        .map((rol) => `${rol.nombre} ${rol.codigo ?? ""}`)
        .join(" ");
      const coincideFiltro = filtroRapido === "TODOS"
        || (["PENDIENTE", "ACTIVO", "INACTIVO"].includes(filtroRapido) && perfil.estado === filtroRapido)
        || (["POSTULANTE", "ADMINISTRADOR"].includes(filtroRapido) && roles.toUpperCase().includes(filtroRapido));
      return coincideFiltro && (!texto || `${perfil.nombres} ${perfil.apellidoPaterno} ${perfil.apellidoMaterno ?? ""} ${perfil.ci} ${perfil.complementoCi ?? ""} ${perfil.email} ${perfil.estado} ${roles}`
        .toLowerCase()
        .includes(texto));
    });
  }, [busqueda, filtroRapido, perfiles]);

  const totalPaginas = Math.max(1, Math.ceil(perfilesFiltrados.length / filasPorPagina));
  const perfilesPagina = useMemo(() => {
    const inicio = (paginaActual - 1) * filasPorPagina;
    return perfilesFiltrados.slice(inicio, inicio + filasPorPagina);
  }, [filasPorPagina, paginaActual, perfilesFiltrados]);

  useEffect(() => {
    setPaginaActual(1);
  }, [busqueda, filtroRapido, filasPorPagina]);

  useEffect(() => {
    if (paginaActual > totalPaginas) setPaginaActual(totalPaginas);
  }, [paginaActual, totalPaginas]);

  /* =========================================
     ESTADÍSTICAS
  ========================================= */

  const estadisticas =
    useMemo(
      () => ({
        total:
          perfiles.length,

        activos:
          perfiles.filter(
            (perfil) =>
              perfil.estado ===
              "ACTIVO",
          ).length,

        pendientes:
          perfiles.filter(
            (perfil) =>
              perfil.estado ===
              "PENDIENTE",
          ).length,

        bloqueados:
          perfiles.filter(
            (perfil) =>
              perfil.estado ===
              "BLOQUEADO",
          ).length,
      }),
      [
        perfiles,
      ],
    );

  /* =========================================
     ABRIR PERFIL COMPLETO
  ========================================= */

  const abrirDetallePerfil =
    async (
      perfilId: string,
    ): Promise<void> => {
      try {
        setPerfilCargandoId(
          perfilId,
        );

        /*
         * No se utiliza directamente el perfil
         * del listado porque ese objeto no incluye
         * los documentos.
         */
        const perfilCompleto =
          await getPerfilUsuarioById(
            perfilId,
          );

        setPerfilSeleccionado(
          perfilCompleto,
        );
      } catch (errorDetalle) {
        toast.error(
          errorDetalle instanceof Error
            ? errorDetalle.message
            : "No se pudo cargar la información del perfil",
        );
      } finally {
        setPerfilCargandoId(
          null,
        );
      }
    };

  /* =========================================
     ELIMINAR PERFIL
  ========================================= */

  const eliminarMutation =
    useMutation({
      mutationFn:
        deletePerfilUsuario,

      onSuccess:
        async (
          respuesta,
          perfilId,
        ) => {
          toast.success(
            respuesta.message ||
              "Usuario eliminado correctamente",
          );

          if (
            perfilSeleccionado?._id ===
            perfilId
          ) {
            setPerfilSeleccionado(
              null,
            );
          }

          await queryClient.invalidateQueries(
            {
              queryKey: [
                "perfilusuarios",
              ],
            },
          );
        },

      onError:
        (
          errorEliminacion,
        ) => {
          toast.error(
            errorEliminacion instanceof Error
              ? errorEliminacion.message
              : "No se pudo eliminar el usuario",
          );
        },
    });

  /* =========================================
     ESTADOS DE CARGA
  ========================================= */

  if (isLoading) {
    return (
      <div className="rounded-2xl bg-white p-8 text-center">
        Cargando perfiles...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-2xl bg-red-100 p-5 text-red-700">
        {error instanceof Error
          ? error.message
          : "Error cargando perfiles"}
      </div>
    );
  }

  return (
    <main className="space-y-6">
      {/* HEADER */}

      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-black text-[#741229]">
            Gestión de perfiles
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            Administración de usuarios, roles y estados del sistema.
          </p>
        </div>

        <Link
          to="/perfilUsuario/crear"
          className="flex items-center gap-2 rounded-xl bg-[#841534] px-5 py-3 font-bold text-white transition hover:bg-[#641025]"
        >
          <Plus size={20} />
          Nuevo perfil
        </Link>
      </header>

      {/* CARDS */}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card
          titulo="Total"
          valor={
            estadisticas.total
          }
        />

        <Card
          titulo="Activos"
          valor={
            estadisticas.activos
          }
        />

        <Card
          titulo="Pendientes"
          valor={
            estadisticas.pendientes
          }
        />

        <Card
          titulo="Bloqueados"
          valor={
            estadisticas.bloqueados
          }
        />
      </section>

      <section className="flex flex-wrap gap-2">
        {(["TODOS", "PENDIENTE", "ACTIVO", "POSTULANTE", "INACTIVO", "ADMINISTRADOR"] as const).map((filtro) => (
          <button key={filtro} type="button" onClick={() => setFiltroRapido(filtro)} className={`rounded-xl px-4 py-2.5 text-sm font-bold transition ${filtroRapido === filtro ? "bg-[#841534] text-white shadow" : "border border-[#841534]/20 bg-white text-[#841534] hover:bg-[#841534]/5"}`}>
            {filtro === "TODOS" ? "Todos" : filtro.charAt(0) + filtro.slice(1).toLowerCase()}
          </button>
        ))}
      </section>

      {/* BÚSQUEDA Y TAMAÑO DE PÁGINA */}

      <section className="grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-[1fr_auto]">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="search"
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Buscar por nombre, CI, correo, rol o estado..."
            className="w-full rounded-xl border border-gray-300 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-[#841534] focus:ring-4 focus:ring-[#841534]/10"
          />
        </label>
        <select
          value={filasPorPagina}
          onChange={(event) => setFilasPorPagina(Number(event.target.value))}
          className="rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-[#841534]"
          aria-label="Cantidad de perfiles por página"
        >
          {[5, 10, 20, 50, 100].map((cantidad) => <option key={cantidad} value={cantidad}>{cantidad} filas</option>)}
        </select>
      </section>

      {/* TABLA */}

      <section className="overflow-hidden rounded-2xl border bg-white">
        {perfilesFiltrados.length ===
        0 ? (
          <div className="p-10 text-center text-gray-500">
            {busqueda ? "No se encontraron perfiles con esa búsqueda." : "No existen perfiles registrados."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#841534] text-white">
                <tr>
                  <th className="p-4 text-left">
                    Nombre
                  </th>

                  <th className="p-4 text-left">
                    CI
                  </th>

                  <th className="p-4 text-left">
                    Email
                  </th>

                  <th className="p-4 text-left">
                    Roles
                  </th>

                  <th className="p-4 text-left">
                    Estado
                  </th>

                  <th className="p-4 text-center">
                    Acciones
                  </th>
                </tr>
              </thead>

              <tbody>
                {perfilesPagina.map(
                  (
                    perfil,
                  ) => {
                    const cargandoDetalle =
                      perfilCargandoId ===
                      perfil._id;

                    const eliminando =
                      eliminarMutation.isPending &&
                      eliminarMutation.variables ===
                        perfil._id;

                    return (
                      <tr
                        key={
                          perfil._id
                        }
                        className="border-b transition hover:bg-gray-50"
                      >
                        <td className="p-4 font-semibold">
                          <div className="flex min-w-56 items-center gap-3">
                            <FotoPerfilMiniatura perfil={perfil} />
                            <span>
                              {perfil.nombres}{" "}
                              {perfil.apellidoPaterno}{" "}
                              {perfil.apellidoMaterno ?? ""}
                            </span>
                          </div>
                        </td>

                        <td className="p-4">
                          {
                            perfil.ci
                          }
                          {perfil.complementoCi
                            ? `-${perfil.complementoCi}`
                            : ""}
                        </td>

                        <td className="p-4">
                          {
                            perfil.email
                          }
                        </td>

                        <td className="p-4">
                          <RolesPerfil
                            perfil={
                              perfil
                            }
                          />
                        </td>

                        <td className="p-4">
                          <span className={`inline-flex rounded-full px-3 py-1.5 text-xs font-black ${perfil.estado === "ACTIVO" ? "bg-emerald-100 text-emerald-800" : perfil.estado === "PENDIENTE" ? "bg-amber-100 text-amber-800" : perfil.estado === "BLOQUEADO" ? "bg-red-100 text-red-700" : "bg-slate-200 text-slate-700"}`}>
                            {perfil.estado}
                          </span>
                        </td>

                        <td className="p-4">
                          <div className="flex justify-center gap-2">
                            {/* VER DETALLE COMPLETO */}

                            <button
                              type="button"
                              disabled={
                                cargandoDetalle
                              }
                              onClick={() =>
                                abrirDetallePerfil(
                                  perfil._id,
                                )
                              }
                              className="rounded-lg bg-blue-100 p-2 text-blue-700 transition hover:bg-blue-200 disabled:cursor-not-allowed disabled:opacity-50"
                              title="Ver perfil completo"
                              aria-label={`Ver perfil de ${perfil.nombres}`}
                            >
                              {cargandoDetalle ? (
                                <LoaderCircle
                                  size={18}
                                  className="animate-spin"
                                />
                              ) : (
                                <Eye size={18} />
                              )}
                            </button>

                            {/* EDITAR */}

                            <button
                              type="button"
                              onClick={() =>
                                navigate(
                                  `/perfilUsuario/${perfil._id}/editar`,
                                )
                              }
                              
                              className="rounded-lg bg-yellow-100 p-2 text-yellow-700 transition hover:bg-yellow-200"
                              title="Editar perfil"
                              aria-label={`Editar perfil de ${perfil.nombres}`}
                            >
                              <Pencil size={18} />
                            </button>

                            {/* ELIMINAR */}

                            <button
                              type="button"
                              disabled={
                                eliminando
                              }
                              onClick={() => {
                                const confirmarEliminacion =
                                  window.confirm(
                                    `¿Eliminar el perfil de ${perfil.nombres} ${perfil.apellidoPaterno}?`,
                                  );

                                if (
                                  confirmarEliminacion
                                ) {
                                  eliminarMutation.mutate(
                                    perfil._id,
                                  );
                                }
                              }}
                              className="rounded-lg bg-red-100 p-2 text-red-700 transition hover:bg-red-200 disabled:cursor-not-allowed disabled:opacity-50"
                              title="Eliminar perfil"
                              aria-label={`Eliminar perfil de ${perfil.nombres}`}
                            >
                              {eliminando ? (
                                <LoaderCircle
                                  size={18}
                                  className="animate-spin"
                                />
                              ) : (
                                <Trash2 size={18} />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  },
                )}
              </tbody>
            </table>
          </div>
        )}

        {perfilesFiltrados.length > 0 && (
          <footer className="flex flex-col gap-3 border-t bg-gray-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-500">
              Mostrando {(paginaActual - 1) * filasPorPagina + 1}–{Math.min(paginaActual * filasPorPagina, perfilesFiltrados.length)} de {perfilesFiltrados.length}
            </p>
            <nav className="flex flex-wrap items-center gap-2" aria-label="Paginación de perfiles">
              <button type="button" disabled={paginaActual === 1} onClick={() => setPaginaActual((pagina) => pagina - 1)} className="rounded-lg border bg-white px-3 py-2 text-sm font-semibold disabled:opacity-40">Anterior</button>
              {Array.from({ length: totalPaginas }, (_, indice) => indice + 1)
                .filter((pagina) => totalPaginas <= 7 || pagina === 1 || pagina === totalPaginas || Math.abs(pagina - paginaActual) <= 1)
                .map((pagina, indice, paginas) => <span key={pagina} className="contents">{indice > 0 && pagina - paginas[indice - 1] > 1 && <span className="px-1 text-gray-400">…</span>}<button type="button" onClick={() => setPaginaActual(pagina)} aria-current={pagina === paginaActual ? "page" : undefined} className={`h-9 min-w-9 rounded-lg px-2 text-sm font-bold ${pagina === paginaActual ? "bg-[#841534] text-white" : "border bg-white text-gray-700"}`}>{pagina}</button></span>)}
              <button type="button" disabled={paginaActual === totalPaginas} onClick={() => setPaginaActual((pagina) => pagina + 1)} className="rounded-lg border bg-white px-3 py-2 text-sm font-semibold disabled:opacity-40">Siguiente</button>
            </nav>
          </footer>
        )}
      </section>

      {/* MODAL DE DETALLE */}

      <PerfilUsuarioDetalleModal
        perfil={
          perfilSeleccionado
        }
        abierto={Boolean(
          perfilSeleccionado,
        )}
        cerrar={() =>
          setPerfilSeleccionado(
            null,
          )
        }
        actualizado={(perfilActualizado) => {
          setPerfilSeleccionado(perfilActualizado);
          void queryClient.invalidateQueries({ queryKey: ["perfilusuarios"] });
        }}
      />
    </main>
  );
}

function FotoPerfilMiniatura({ perfil }: { perfil: PerfilUsuarioType }) {
  const [error, setError] = useState(false);
  const base = String(import.meta.env.VITE_API_URL || "").trim().replace(/\/api\/?$/, "").replace(/\/+$/, "");
  const ruta = perfil.fotoPerfil;
  const url = ruta
    ? /^https?:\/\//i.test(ruta) ? ruta : `${base}${ruta.startsWith("/") ? ruta : `/${ruta}`}`
    : "";
  const letras = `${perfil.nombres.charAt(0)}${perfil.apellidoPaterno.charAt(0)}`.toUpperCase();

  return url && !error ? (
    <img src={url} alt={`Foto de ${perfil.nombres}`} onError={() => setError(true)} loading="lazy" className="h-11 w-11 shrink-0 rounded-full border-2 border-[#d5b66c] object-cover shadow-sm" />
  ) : (
    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#f1e0b8] text-xs font-black text-[#841534]">{letras}</span>
  );
}

/* =========================================
   ROLES
========================================= */

function RolesPerfil({
  perfil,
}: {
  perfil:
    PerfilUsuarioType;
}) {
  const roles =
    perfil.roles.filter(
      esRolPoblado,
    );

  if (
    roles.length ===
    0
  ) {
    return (
      <span className="text-xs text-gray-500">
        Sin roles cargados
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {roles.map(
        (
          rol,
        ) => (
          <span
            key={
              rol._id
            }
            className="rounded-full bg-[#f8edcb] px-3 py-1 text-xs font-semibold text-[#841534]"
          >
            {
              rol.nombre
            }
          </span>
        ),
      )}
    </div>
  );
}

/* =========================================
   TARJETA
========================================= */

function Card({
  titulo,
  valor,
}: {
  titulo:
    string;

  valor:
    number;
}) {
  return (
    <div className="rounded-2xl border bg-white p-5">
      <p className="text-sm text-gray-500">
        {titulo}
      </p>

      <p className="mt-2 text-3xl font-black text-[#841534]">
        {valor}
      </p>
    </div>
  );
}
