import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Link,
  useLocation,
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
  Pin,
  PinOff,
  Plus,
  Printer,
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
import { crearPreregistro, obtenerPreregistros } from "@/api/PreregistroApi";
import { habilitarGuia, listarGuias } from "@/api/GuiaApi";
import { listarFraternos } from "@/api/FraternoApi";
import { GestionarFraternoModal } from "@/views/fraterno/FraternoView";
import type { Fraterno } from "@/types/FraternoType";
import { listarCuotas, obtenerCuota } from "@/api/CuotaApi";
import type { Cuota } from "@/types/CuotaType";
import { ESTADOS_PREREGISTRO, type EstadoPreregistro } from "@/types/PreregistroType";
import { obtenerReporteTallas } from "@/api/ReporteApi";

type FilaReporteUsuario = { numero: number; nombre: string; ci: string; genero: string; tallaPolera: string; tallaChamarra: string; email: string; estado: string; preregistro: string; estadoPreregistro: string; fraterno: string; pago: string; terminos: string; situacion: string; cupo: string; esPreregistro: boolean; esPostulanteGuia: boolean; esFraterno: boolean; cumpleFiltroActual: boolean };
type FiltroPerfil = "TODOS" | "PENDIENTE" | "ACTIVO" | "POSTULANTE" | "INACTIVO" | "ADMINISTRADOR";
type EstadoRetornoPagos = { reopenCuotaId?: string; viewState?: { busqueda?: string; filtroRapido?: FiltroPerfil; filtroPreregistro?: EstadoPreregistro | "TODOS" | "SIN_PREREGISTRO"; paginaActual?: number } };
const COLUMNAS_TABLA = [["nombre","Nombre",288],["ci","CI",150],["email","Email",300],["roles","Roles",180],["estado","Estado",150],["preregistro","Preregistro",190],["guia","Postulante a guía",210],["fraterno","N.º fraterno",170],["gestion","Gestión",150],["ingreso","Ingreso",140],["pago","Pago",170],["terminos","Términos",190],["situacion","Situación",160],["cupo","Cupo",140],["cuota","Pagos y bauchers",210],["acciones","Acciones",200]] as const;
type ColumnaTabla = (typeof COLUMNAS_TABLA)[number][0];

export default function PerfilUsuarioView() {
  const location = useLocation();
  const estadoRetorno = location.state as EstadoRetornoPagos | null;
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

  const [busqueda, setBusqueda] = useState(() => estadoRetorno?.viewState?.busqueda ?? "");
  const [filtroRapido, setFiltroRapido] = useState<FiltroPerfil>(() => estadoRetorno?.viewState?.filtroRapido ?? "TODOS");
  const [filasPorPagina, setFilasPorPagina] = useState(() =>
    window.innerWidth < 640 ? 5 : window.innerWidth < 1280 ? 10 : 20,
  );
  const [paginaActual, setPaginaActual] = useState(() => estadoRetorno?.viewState?.paginaActual ?? 1);
  const [columnasFijadas, setColumnasFijadas] = useState<Set<ColumnaTabla>>(() => new Set(["nombre"]));
  const [columnasVisibles, setColumnasVisibles] = useState<Set<ColumnaTabla>>(() => new Set(COLUMNAS_TABLA.map(([id]) => id)));
  const [vistaCompleta, setVistaCompleta] = useState(true);
  const [filtroPreregistro, setFiltroPreregistro] = useState<EstadoPreregistro | "TODOS" | "SIN_PREREGISTRO">(() => estadoRetorno?.viewState?.filtroPreregistro ?? "TODOS");
  const [fraternoSeleccionado, setFraternoSeleccionado] = useState<Fraterno | null>(null);
  const [cuotaSeleccionada, setCuotaSeleccionada] = useState<Cuota | null>(null);
  const [reporteAbierto, setReporteAbierto] = useState(false);
  const [logoReporteIzquierdo, setLogoReporteIzquierdo] = useState(() => localStorage.getItem("LOGO_REPORTE_IZQUIERDO") ?? "/imagenes/tinkus-puros.png");
  const [logoReporteDerecho, setLogoReporteDerecho] = useState(() => localStorage.getItem("LOGO_REPORTE_DERECHO") ?? "");

  const preregistrosQuery = useQuery({
    queryKey: ["preregistros", "vista-unificada"],
    queryFn: () => obtenerPreregistros({ limite: 1000 }),
    retry: false,
  });
  const postulantesGuiaQuery = useQuery({ queryKey: ["postulantes-guia"], queryFn: listarGuias, retry: false });
  const fraternosQuery = useQuery({ queryKey: ["fraternos"], queryFn: listarFraternos, retry: false });
  const cuotasQuery = useQuery({ queryKey: ["cuotas"], queryFn: listarCuotas, retry: false });
  const tallasQuery = useQuery({ queryKey: ["reporte-tallas"], queryFn: obtenerReporteTallas, retry: false });

  const preregistroPorUsuario = useMemo(() => new Map(
    (preregistrosQuery.data?.preregistros ?? []).flatMap((preregistro) => {
      const usuarioId = typeof preregistro.usuarioId === "object" ? preregistro.usuarioId._id : preregistro.usuarioId;
      return usuarioId ? [[usuarioId, preregistro] as const] : [];
    }),
  ), [preregistrosQuery.data]);
  const guiaPorPreregistro = useMemo(() => new Map(
    (postulantesGuiaQuery.data ?? []).map((postulante) => [postulante.preregistroId._id, postulante] as const),
  ), [postulantesGuiaQuery.data]);
  const fraternoPorUsuario = useMemo(() => new Map(
    (fraternosQuery.data?.fraternos ?? []).flatMap((fraterno) => {
      const usuarioId = typeof fraterno.usuarioId === "object" ? fraterno.usuarioId._id : fraterno.usuarioId;
      return usuarioId ? [[usuarioId, fraterno] as const] : [];
    }),
  ), [fraternosQuery.data]);
  const cuotaPorPreregistro = useMemo(() => new Map(
    (cuotasQuery.data ?? []).map((cuota) => [cuota.preregistroId._id, cuota] as const),
  ), [cuotasQuery.data]);
  const tallasPorCi = useMemo(() => new Map((tallasQuery.data?.registros ?? []).map((registro) => [String(registro.ci), registro] as const)), [tallasQuery.data]);
  const estilosColumnasFijas = useMemo(() => {
    const reglas: string[] = [];
    let izquierda = 0;
    for (let indice = 0; indice < 8; indice += 1) {
      const [id,,ancho] = COLUMNAS_TABLA[indice];
      if (!columnasVisibles.has(id) || !columnasFijadas.has(id)) continue;
      reglas.push(`.tabla-configurable th:nth-child(${indice + 1}),.tabla-configurable td:nth-child(${indice + 1}){position:sticky;left:${izquierda}px;z-index:20;box-shadow:8px 0 12px -12px rgba(0,0,0,.8)}.tabla-configurable th:nth-child(${indice + 1}){z-index:30;background:#841534}.tabla-configurable td:nth-child(${indice + 1}){background:white}`);
      izquierda += ancho;
    }
    let derecha = 0;
    for (let indice = COLUMNAS_TABLA.length - 1; indice >= 8; indice -= 1) {
      const [id,,ancho] = COLUMNAS_TABLA[indice];
      if (!columnasVisibles.has(id) || !columnasFijadas.has(id)) continue;
      reglas.push(`.tabla-configurable th:nth-child(${indice + 1}),.tabla-configurable td:nth-child(${indice + 1}){position:sticky;right:${derecha}px;z-index:20;box-shadow:-8px 0 12px -12px rgba(0,0,0,.8)}.tabla-configurable th:nth-child(${indice + 1}){z-index:30;background:#841534}.tabla-configurable td:nth-child(${indice + 1}){background:white}`);
      derecha += ancho;
    }
    return reglas.join("");
  }, [columnasFijadas, columnasVisibles]);

  useEffect(() => {
    const cuotaId = estadoRetorno?.reopenCuotaId;
    if (!cuotaId || !cuotasQuery.data) return;
    const cuota = cuotasQuery.data.find((item) => item._id === cuotaId);
    if (cuota) setCuotaSeleccionada(cuota);
    navigate(location.pathname, { replace: true, state: null });
  }, [cuotasQuery.data, estadoRetorno?.reopenCuotaId, location.pathname, navigate]);

  const asignarGuia = useMutation({
    mutationFn: habilitarGuia,
    onSuccess: async () => {
      toast.success("Postulante enviado correctamente al proceso de guía");
      await queryClient.invalidateQueries({ queryKey: ["postulantes-guia"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "No se pudo enviar al proceso de guía"),
  });

  const crearPreregistroFaltante = useMutation({
    mutationFn: (usuarioId: string) => crearPreregistro({ usuarioId }),
    onSuccess: async (preregistro) => {
      toast.success(`Preregistro ${preregistro.numeroPreRegistro} creado correctamente`);
      await queryClient.invalidateQueries({ queryKey: ["preregistros"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "No se pudo crear el preregistro"),
  });

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
      const preregistro = preregistroPorUsuario.get(perfil._id);
      const coincidePreregistro = filtroPreregistro === "TODOS"
        || (filtroPreregistro === "SIN_PREREGISTRO" ? !preregistro : preregistro?.estado === filtroPreregistro);
      return coincideFiltro && coincidePreregistro && (!texto || `${perfil.nombres} ${perfil.apellidoPaterno} ${perfil.apellidoMaterno ?? ""} ${perfil.ci} ${perfil.complementoCi ?? ""} ${perfil.email} ${perfil.estado} ${roles}`
        .toLowerCase()
        .includes(texto));
    });
  }, [busqueda, filtroPreregistro, filtroRapido, perfiles, preregistroPorUsuario]);

  const idsPerfilesFiltrados = useMemo(() => new Set(perfilesFiltrados.map((perfil) => perfil._id)), [perfilesFiltrados]);
  const filasReporte = useMemo<FilaReporteUsuario[]>(() => perfiles.map((perfil, indice): FilaReporteUsuario => {
    const preregistro = preregistroPorUsuario.get(perfil._id);
    const fraterno = fraternoPorUsuario.get(perfil._id);
    const postulanteGuia = preregistro ? guiaPorPreregistro.get(preregistro._id) : undefined;
    const cuota = preregistro ? cuotaPorPreregistro.get(preregistro._id) : undefined;
    const tallas = tallasPorCi.get(String(perfil.ci));
    return {
      numero: indice + 1, nombre: `${perfil.nombres} ${perfil.apellidoPaterno} ${perfil.apellidoMaterno ?? ""}`.trim(), ci: `${perfil.ci}${perfil.complementoCi ? `-${perfil.complementoCi}` : ""}`, genero: perfil.sexo ?? "NO REGISTRADO", tallaPolera: tallas?.tallaPolera ?? "—", tallaChamarra: tallas?.tallaChamarra ?? "—", email: perfil.email,
      estado: perfil.estado, preregistro: preregistro?.numeroPreRegistro ?? "—", estadoPreregistro: preregistro?.estado.replaceAll("_", " ") ?? "SIN PREREGISTRO", fraterno: fraterno?.numeroFraterno ?? "—",
      pago: cuota ? `Bs ${cuota.montoPagado.toFixed(2)} / ${cuota.montoTotal.toFixed(2)}` : "SIN CUOTA", terminos: fraterno?.terminos?.estado.replaceAll("_", " ") ?? "—", situacion: fraterno ? (fraterno.situacion ?? fraterno.estado).replaceAll("_", " ") : "—", cupo: fraterno?.ocupaCupo ? "OCUPA" : "LIBRE",
      esPreregistro: Boolean(preregistro), esPostulanteGuia: Boolean(postulanteGuia), esFraterno: Boolean(fraterno), cumpleFiltroActual: idsPerfilesFiltrados.has(perfil._id),
    };
  }), [cuotaPorPreregistro, fraternoPorUsuario, guiaPorPreregistro, idsPerfilesFiltrados, perfiles, preregistroPorUsuario, tallasPorCi]);

  const totalPaginas = Math.max(1, Math.ceil(perfilesFiltrados.length / filasPorPagina));
  const perfilesPagina = useMemo(() => {
    const inicio = (paginaActual - 1) * filasPorPagina;
    return perfilesFiltrados.slice(inicio, inicio + filasPorPagina);
  }, [filasPorPagina, paginaActual, perfilesFiltrados]);

  useEffect(() => {
    setPaginaActual(1);
  }, [busqueda, filtroPreregistro, filtroRapido, filasPorPagina]);

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

  const resumenProceso = useMemo(() => {
    const preregistros = preregistrosQuery.data?.preregistros ?? [];
    const fraternos = fraternosQuery.data?.fraternos ?? [];
    const cupos = preregistrosQuery.data?.cupos;
    return {
      preregistros: preregistros.length,
      preregistrosAprobados: preregistros.filter((item) => item.estado === "APROBADO").length,
      fraternos: fraternos.length,
      fraternosConCupo: fraternos.filter((item) => item.ocupaCupo).length,
      fraternosListaEspera: fraternos.filter((item) => (item.situacion ?? item.estado) === "LISTA_ESPERA").length,
      cuposDisponibles: cupos ? Math.max(0, cupos.maximoTotal - cupos.total) : null,
      cuposHombres: cupos ? `${cupos.hombres} / ${cupos.maximoHombres}` : "—",
      cuposMujeres: cupos ? `${cupos.mujeres} / ${cupos.maximoMujeres}` : "—",
    };
  }, [fraternosQuery.data, preregistrosQuery.data]);

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

      <section className="rounded-3xl border border-[#d9c8aa] bg-[#fffaf0] p-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[.18em] text-[#8F5F2A]">Resumen general</p><h2 className="mt-1 text-xl font-black text-[#741229]">Admisión, cupos y fraternos</h2></div><p className="text-xs text-slate-500">Datos de la gestión vigente</p></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          <ResumenCard titulo="Preregistros" valor={resumenProceso.preregistros} />
          <ResumenCard titulo="Aprobados" valor={resumenProceso.preregistrosAprobados} tono="verde" />
          <ResumenCard titulo="Cupo hombres" valor={resumenProceso.cuposHombres} />
          <ResumenCard titulo="Cupo mujeres" valor={resumenProceso.cuposMujeres} />
          <ResumenCard titulo="Disponibles" valor={resumenProceso.cuposDisponibles ?? "—"} tono="dorado" />
          <ResumenCard titulo="Fraternos" valor={resumenProceso.fraternos} />
          <ResumenCard titulo="Ocupan cupo" valor={resumenProceso.fraternosConCupo} tono="verde" />
          <ResumenCard titulo="Lista de espera" valor={resumenProceso.fraternosListaEspera} tono="dorado" />
        </div>
        <div className="mt-4 flex flex-wrap gap-2 rounded-2xl bg-white/70 p-3"><span className="mr-1 text-xs font-black uppercase text-[#741229]">Detalle de los {resumenProceso.preregistros}:</span>{ESTADOS_PREREGISTRO.map((estado) => <span key={estado} className={`rounded-full px-3 py-1 text-xs font-black ${(preregistrosQuery.data?.resumen?.[estado] ?? 0) > 0 ? "bg-[#841534] text-white" : "bg-slate-100 text-slate-500"}`}>{estado.replaceAll("_", " ")}: {preregistrosQuery.data?.resumen?.[estado] ?? 0}</span>)}</div>
      </section>

      <section className="flex flex-wrap gap-2">
        {(["TODOS", "PENDIENTE", "ACTIVO", "POSTULANTE", "INACTIVO", "ADMINISTRADOR"] as const).map((filtro) => (
          <button key={filtro} type="button" onClick={() => setFiltroRapido(filtro)} className={`rounded-xl px-4 py-2.5 text-sm font-bold transition ${filtroRapido === filtro ? "bg-[#841534] text-white shadow" : "border border-[#841534]/20 bg-white text-[#841534] hover:bg-[#841534]/5"}`}>
            {filtro === "TODOS" ? "Todos" : filtro.charAt(0) + filtro.slice(1).toLowerCase()}
          </button>
        ))}
      </section>

      <section className="rounded-2xl border bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div><p className="text-xs font-black uppercase tracking-[.16em] text-[#8F5F2A]">Filtrar por preregistro</p><div className="mt-2 flex flex-wrap gap-2"><button type="button" onClick={() => setFiltroPreregistro("TODOS")} className={`rounded-xl px-3 py-2 text-xs font-black ${filtroPreregistro === "TODOS" ? "bg-[#841534] text-white" : "bg-[#eee8dc] text-[#5d4a42]"}`}>TODOS ({preregistroPorUsuario.size})</button>{ESTADOS_PREREGISTRO.map((estado) => <button type="button" key={estado} onClick={() => setFiltroPreregistro(estado)} className={`rounded-xl px-3 py-2 text-xs font-black ${filtroPreregistro === estado ? "bg-[#841534] text-white" : "bg-[#eee8dc] text-[#5d4a42]"}`}>{estado.replaceAll("_", " ")} ({preregistrosQuery.data?.resumen?.[estado] ?? 0})</button>)}<button type="button" onClick={() => setFiltroPreregistro("SIN_PREREGISTRO")} className={`rounded-xl px-3 py-2 text-xs font-black ${filtroPreregistro === "SIN_PREREGISTRO" ? "bg-[#841534] text-white" : "bg-[#eee8dc] text-[#5d4a42]"}`}>SIN PREREGISTRO ({Math.max(0, perfiles.length - preregistroPorUsuario.size)})</button></div></div>
          <div className="flex shrink-0 flex-wrap gap-2"><button type="button" onClick={() => setVistaCompleta((valor) => { const completa = !valor; const compactas: ColumnaTabla[] = ["nombre","ci","estado","preregistro","fraterno","pago","situacion","cupo","cuota","acciones"]; setColumnasVisibles(new Set(completa ? COLUMNAS_TABLA.map(([id]) => id) : compactas)); return completa; })} className="rounded-xl border border-[#841534] bg-white px-4 py-2.5 text-sm font-black text-[#841534]">{vistaCompleta ? "Vista compacta" : "Mostrar información completa"}</button><button type="button" onClick={() => setReporteAbierto(true)} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white"><Printer size={18}/> Crear reporte</button></div>
        </div>
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

      <section className="flex flex-col gap-3 rounded-2xl border border-[#d9c8aa] bg-[#fffaf0] p-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[.18em] text-[#8F5F2A]">Ubicación actual</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm font-bold text-[#5d4a42]">
            <span className="rounded-full bg-[#841534] px-3 py-1.5 text-white">1. Perfil</span><span aria-hidden="true">→</span>
            <span className="rounded-full bg-white px-3 py-1.5">2. Preregistro</span><span aria-hidden="true">→</span>
            <span className="rounded-full bg-white px-3 py-1.5">3. Postulante a guía</span><span aria-hidden="true">→</span>
            <span className="rounded-full bg-white px-3 py-1.5">4. Fraterno</span>
          </div>
        </div>
        <button type="button" aria-pressed={columnasFijadas.size > 0} onClick={() => setColumnasFijadas((actuales) => actuales.size ? new Set() : new Set(["nombre"]))} className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-black transition ${columnasFijadas.size ? "border-[#841534] bg-[#841534] text-white" : "border-[#841534]/30 bg-white text-[#841534]"}`}>
          {columnasFijadas.size ? <Pin size={18} /> : <PinOff size={18} />}
          {columnasFijadas.size ? `${columnasFijadas.size} columna${columnasFijadas.size === 1 ? "" : "s"} fijada${columnasFijadas.size === 1 ? "" : "s"}` : "Fijar columnas"}
        </button>
      </section>

      <details className="rounded-2xl border bg-white p-4"><summary className="cursor-pointer font-black text-[#741229]">⚙️ Mostrar, ocultar o fijar columnas</summary><p className="mt-2 text-xs text-slate-500">Marca las columnas que deseas ver. Puedes fijar varias desde sus encabezados y se acomodarán de izquierda a derecha.</p><div className="mt-3 flex flex-wrap gap-2">{COLUMNAS_TABLA.map(([id,titulo]) => <label key={id} className={`rounded-xl border px-3 py-2 text-sm font-bold ${columnasVisibles.has(id)?"bg-[#fffaf0] text-[#741229]":"bg-slate-50 text-slate-400"}`}><input type="checkbox" className="mr-2" checked={columnasVisibles.has(id)} onChange={() => setColumnasVisibles((actuales) => { const nuevas=new Set(actuales); if(nuevas.has(id)){if(nuevas.size===1){toast.error("Debe quedar al menos una columna visible");return actuales}nuevas.delete(id);setColumnasFijadas((fijadas)=>{const siguientes=new Set(fijadas);siguientes.delete(id);return siguientes})}else nuevas.add(id);return nuevas; })}/>{titulo}</label>)}</div></details>

      {/* TABLA */}

      <section className="overflow-hidden rounded-2xl border bg-white">
        {perfilesFiltrados.length ===
        0 ? (
          <div className="p-10 text-center text-gray-500">
            {busqueda ? "No se encontraron perfiles con esa búsqueda." : "No existen perfiles registrados."}
          </div>
        ) : (
          <div className="max-w-full overflow-x-auto overscroll-x-contain" aria-label="Tabla unificada; desplázate horizontalmente para ver todas las etapas">
            <style>{estilosColumnasFijas}</style>
            <table className={`tabla-configurable w-full table-fixed text-sm ${vistaCompleta ? "min-w-[3200px]" : "min-w-[1900px]"}`}>
              <colgroup>{COLUMNAS_TABLA.map(([id,,ancho])=><col key={id} style={{visibility:columnasVisibles.has(id)?"visible":"collapse",width:ancho}}/>)}</colgroup>
              <thead className="bg-[#841534] text-white">
                <tr>{COLUMNAS_TABLA.map(([id,titulo])=><th key={id} className={`p-4 text-left ${id==="nombre"?"min-w-72":""}`}><label className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap font-black"><input type="checkbox" checked={columnasFijadas.has(id)} onChange={()=>setColumnasFijadas((actuales)=>{const nuevas=new Set(actuales);if(nuevas.has(id))nuevas.delete(id);else nuevas.add(id);return nuevas})} className="h-4 w-4 accent-[#C59A3A]" aria-label={`Fijar columna ${titulo}`}/>{titulo}</label></th>)}</tr>
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

                    const preregistro = preregistroPorUsuario.get(perfil._id);
                    const postulanteGuia = preregistro ? guiaPorPreregistro.get(preregistro._id) : undefined;
                    const fraterno = fraternoPorUsuario.get(perfil._id);
                    const cuota = preregistro ? cuotaPorPreregistro.get(preregistro._id) : undefined;
                    const asignandoGuia = asignarGuia.isPending && asignarGuia.variables === preregistro?._id;
                    const creandoPreregistro = crearPreregistroFaltante.isPending && crearPreregistroFaltante.variables === perfil._id;

                    return (
                      <tr
                        key={
                          perfil._id
                        }
                        className="border-b transition hover:bg-gray-50"
                      >
                        <td className="min-w-72 p-4 font-semibold">
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
                          {preregistro ? <div className="space-y-2"><span className={`inline-flex rounded-full px-3 py-1.5 text-xs font-black ${preregistro.estado === "APROBADO" ? "bg-emerald-100 text-emerald-800" : preregistro.estado === "OBSERVADO" ? "bg-orange-100 text-orange-800" : "bg-slate-100 text-slate-700"}`}>{preregistro.estado.replaceAll("_", " ")}</span><p className="text-xs font-semibold text-slate-500">{preregistro.numeroPreRegistro}</p><button type="button" onClick={() => navigate(`/preregistros/${preregistro._id}/editar`, { state: { returnTo: "/perfil-usuario" } })} className="text-xs font-black text-[#841534] underline underline-offset-2">Revisar preregistro</button></div> : <div className="space-y-2"><span className="block text-xs font-bold text-amber-700">Sin preregistro</span><button type="button" disabled={creandoPreregistro} onClick={() => { if (window.confirm(`Se creará un preregistro en la gestión vigente para ${perfil.nombres}. ¿Deseas continuar?`)) crearPreregistroFaltante.mutate(perfil._id); }} className="rounded-xl bg-amber-100 px-3 py-2 text-xs font-black text-amber-900 transition hover:bg-amber-200 disabled:cursor-wait disabled:opacity-60">{creandoPreregistro ? "Creando..." : "+ Crear preregistro"}</button></div>}
                        </td>

                        <td className="p-4">
                          {postulanteGuia ? <button type="button" onClick={() => navigate(`/postulantes-guia/${postulanteGuia._id}`)} className="rounded-xl bg-purple-100 px-3 py-2 text-left text-xs font-black text-purple-800">{postulanteGuia.estado.replaceAll("_", " ")}<span className="mt-1 block font-medium">Abrir evaluación</span></button> : preregistro ? <button type="button" disabled={asignandoGuia || postulantesGuiaQuery.isLoading} onClick={() => asignarGuia.mutate(preregistro._id)} className="rounded-xl border border-purple-200 bg-white px-3 py-2 text-xs font-black text-purple-800 disabled:opacity-50">{asignandoGuia ? "Enviando..." : "Enviar a postulante guía"}</button> : <span className="text-xs font-semibold text-slate-400">Primero crea el preregistro</span>}
                        </td>

                        <td className="p-4">{fraterno ? <button type="button" onClick={() => navigate(`/fraternos?buscar=${encodeURIComponent(perfil.ci)}`)} className="rounded-xl bg-emerald-100 px-3 py-2 text-left text-xs font-black text-emerald-800">{fraterno.numeroFraterno}<span className="mt-1 block font-medium">Gestionar</span></button> : <span className="text-xs text-slate-400">—</span>}</td>
                        <td className="p-4 font-semibold">{fraterno && typeof fraterno.gestionId === "object" ? fraterno.gestionId.nombre : "—"}</td>
                        <td className="p-4">{fraterno ? new Date(fraterno.fechaIngreso).toLocaleDateString("es-BO") : "—"}</td>
                        <td className="p-4">{fraterno ? <span className={`inline-flex rounded-full px-3 py-1.5 text-xs font-black ${fraterno.estadoPago === "SALDADO" ? "bg-emerald-100 text-emerald-800" : fraterno.estadoPago === "EN_VERIFICACION" ? "bg-blue-100 text-blue-800" : fraterno.estadoPago === "OBSERVADO" ? "bg-orange-100 text-orange-800" : "bg-slate-100 text-slate-700"}`}>{(fraterno.estadoPago ?? "SIN_PAGO").replaceAll("_", " ")}</span> : "—"}</td>
                        <td className="p-4">{fraterno ? <span className="text-xs font-black">{fraterno.terminos?.estado === "ACEPTADOS" ? "✅ ACEPTADOS" : fraterno.terminos?.estado === "REQUIERE_NUEVA_ACEPTACION" ? "🔄 NUEVA ACEPTACIÓN" : fraterno.terminos?.estado === "NO_ACEPTADOS" ? "❌ NO ACEPTADOS" : "⚠️ PENDIENTE"}</span> : "—"}</td>
                        <td className="p-4 font-black">{fraterno ? (fraterno.situacion ?? fraterno.estado).replaceAll("_", " ") : "—"}</td>
                        <td className="p-4">{fraterno ? <span className={`inline-flex items-center gap-2 font-bold ${fraterno.ocupaCupo ? "text-emerald-700" : "text-slate-500"}`}><span aria-hidden="true">{fraterno.ocupaCupo ? "🟢" : "⚪"}</span>{fraterno.ocupaCupo ? "OCUPA" : "LIBRE"}</span> : "—"}</td>
                        <td className="p-4">{cuota ? <button type="button" onClick={() => setCuotaSeleccionada(cuota)} className="rounded-xl bg-blue-100 px-4 py-2 text-xs font-black text-blue-800">Ver pagos<span className="mt-1 block font-medium">Bs {cuota.montoPagado.toFixed(2)} / {cuota.montoTotal.toFixed(2)}</span></button> : <span className="text-xs text-slate-400">Sin cuota</span>}</td>

                        <td className="p-4">
                          <div className="flex flex-wrap justify-center gap-2">
                            {fraterno ? <button type="button" onClick={() => setFraternoSeleccionado(fraterno)} className="rounded-lg bg-[#841534] px-4 py-2 font-black text-white transition hover:bg-[#641025]" title="Abrir gestión completa del fraterno">Gestionar</button> : null}
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
                                  { state: { returnTo: "/perfil-usuario", returnLabel: "Volver a gestión unificada" } },
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
      {fraternoSeleccionado ? <GestionarFraternoModal fraterno={fraternoSeleccionado} cerrar={() => setFraternoSeleccionado(null)} /> : null}
      {cuotaSeleccionada ? <PagosModal cuota={cuotaSeleccionada} cerrar={() => setCuotaSeleccionada(null)} abrirGestion={() => navigate(`/cuotas/${cuotaSeleccionada._id}`, { state: { returnTo: "/perfil-usuario", reopenCuotaId: cuotaSeleccionada._id, viewState: { busqueda, filtroRapido, filtroPreregistro, paginaActual } } })} /> : null}
      {reporteAbierto ? <><ReporteSeleccionableModal filas={filasReporte} logoIzquierdo={logoReporteIzquierdo} logoDerecho={logoReporteDerecho} cerrar={() => setReporteAbierto(false)} /><SelectorLogosReporte logoIzquierdo={logoReporteIzquierdo} logoDerecho={logoReporteDerecho} cambiarIzquierdo={setLogoReporteIzquierdo} cambiarDerecho={setLogoReporteDerecho}/></> : null}
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

function PagosModal({ cuota, cerrar, abrirGestion }: { cuota: Cuota; cerrar: () => void; abrirGestion: () => void }) {
  const detalle = useQuery({ queryKey: ["cuota", cuota._id], queryFn: () => obtenerCuota(cuota._id) });
  const apiBase = String(import.meta.env.VITE_API_URL || "").replace(/\/api\/?$/, "");
  return <div className="fixed inset-0 z-[150] overflow-y-auto bg-black/65 p-3" role="dialog" aria-modal="true" aria-labelledby="titulo-pagos-usuario"><section className="mx-auto my-5 w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl"><header className="flex items-start justify-between gap-4 bg-gradient-to-r from-[#841534] to-[#C59A3A] p-5 text-white"><div><p className="text-xs font-black uppercase tracking-widest">Pagos y bauchers</p><h2 id="titulo-pagos-usuario" className="mt-1 text-2xl font-black">{cuota.preregistroId.usuarioId?.nombres} {cuota.preregistroId.usuarioId?.apellidoPaterno}</h2><p className="text-sm text-white/80">{cuota.preregistroId.numeroPreRegistro}</p></div><button type="button" onClick={cerrar} aria-label="Cerrar pagos" className="grid h-10 w-10 place-items-center rounded-full bg-white/15 text-xl font-black">✕</button></header><div className="max-h-[78dvh] space-y-5 overflow-y-auto p-5"><section className="grid gap-3 sm:grid-cols-4"><ResumenCard titulo="Total" valor={`Bs ${cuota.montoTotal.toFixed(2)}`}/><ResumenCard titulo="Pagado" valor={`Bs ${cuota.montoPagado.toFixed(2)}`} tono="verde"/><ResumenCard titulo="Saldo" valor={`Bs ${cuota.saldo.toFixed(2)}`} tono="dorado"/><ResumenCard titulo="Estado" valor={cuota.estado.replaceAll("_", " ")}/></section>{detalle.isLoading ? <p className="rounded-xl bg-slate-50 p-6 text-center">Cargando pagos...</p> : detalle.isError ? <p className="rounded-xl bg-red-50 p-4 text-red-700">No se pudieron cargar los pagos.</p> : <section className="space-y-3"><h3 className="font-black text-[#74122A]">MOVIMIENTOS REGISTRADOS</h3>{detalle.data?.pagos.length ? detalle.data.pagos.map((pago) => <article key={pago._id} className="rounded-2xl border p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><strong>Pago {pago.numeroPago} · Bs {pago.monto.toFixed(2)}</strong><p className="text-sm text-slate-500">{new Date(pago.fechaPago).toLocaleString("es-BO")} · {pago.metodoPago}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black">{pago.estadoRevision}</span></div>{pago.nombrePagador ? <p className="mt-2 text-sm">Pagador: {pago.nombrePagador}</p> : null}{pago.observacionRevision ? <p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{pago.observacionRevision}</p> : null}<div className="mt-3 flex flex-wrap gap-2">{pago.baucherImagen ? <a href={`${apiBase}${pago.baucherImagen}`} target="_blank" rel="noreferrer" className="rounded-lg bg-blue-100 px-3 py-2 text-sm font-bold text-blue-800">Ver baucher</a> : null}{pago.respaldoAdminImagen ? <a href={`${apiBase}${pago.respaldoAdminImagen}`} target="_blank" rel="noreferrer" className="rounded-lg bg-emerald-100 px-3 py-2 text-sm font-bold text-emerald-800">Ver respaldo</a> : null}</div></article>) : <p className="rounded-xl bg-slate-50 p-5 text-center text-slate-500">Todavía no existen pagos registrados.</p>}</section>}<div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={cerrar} className="rounded-xl border px-5 py-3 font-bold">Cerrar</button><button type="button" onClick={abrirGestion} className="rounded-xl bg-[#841534] px-5 py-3 font-bold text-white">Revisar o registrar pagos</button></div></div></section></div>;
}

const CAMPOS_REPORTE = [
  ["numero", "N.º"], ["nombre", "Nombre y apellidos"], ["ci", "CI"], ["genero", "Género"], ["tallaPolera", "Talla polera"], ["tallaChamarra", "Talla chamarra"], ["email", "Correo"], ["estado", "Estado de usuario"], ["preregistro", "N.º preregistro"], ["estadoPreregistro", "Estado preregistro"], ["fraterno", "N.º fraterno"], ["pago", "Pago"], ["terminos", "Términos"], ["situacion", "Situación"], ["cupo", "Cupo"], ["firma", "Firma"],
] as const;
type CampoReporteId = (typeof CAMPOS_REPORTE)[number][0];
type ListaReporte = "FILTRO_ACTUAL" | "USUARIOS" | "PREREGISTROS" | "POSTULANTES_GUIA" | "FRATERNOS";
const LISTAS_REPORTE: ReadonlyArray<[ListaReporte, string]> = [["FILTRO_ACTUAL", "Resultados filtrados en pantalla"], ["USUARIOS", "Todos los usuarios"], ["PREREGISTROS", "Todos los preregistros"], ["POSTULANTES_GUIA", "Todos los postulantes a guía"], ["FRATERNOS", "Todos los fraternos"]];
const escaparHtml = (valor: string) => valor.replace(/[&<>"']/g, (caracter) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[caracter] ?? caracter));

function ReporteSeleccionableModal({ filas, logoIzquierdo, logoDerecho, cerrar }: { filas: FilaReporteUsuario[]; logoIzquierdo: string; logoDerecho: string; cerrar: () => void }) {
  const [titulo, setTitulo] = useState("REPORTE GENERAL DE USUARIOS");
  const [campos, setCampos] = useState<CampoReporteId[]>(["numero", "nombre", "ci", "genero", "tallaPolera", "tallaChamarra", "estadoPreregistro", "fraterno", "cupo", "firma"]);
  const [lista, setLista] = useState<ListaReporte>("FILTRO_ACTUAL");
  const filasSeleccionadas = useMemo(() => filas.filter((fila) => lista === "USUARIOS" || (lista === "FILTRO_ACTUAL" && fila.cumpleFiltroActual) || (lista === "PREREGISTROS" && fila.esPreregistro) || (lista === "POSTULANTES_GUIA" && fila.esPostulanteGuia) || (lista === "FRATERNOS" && fila.esFraterno)).map((fila, indice) => ({ ...fila, numero: indice + 1 })), [filas, lista]);
  const imprimir = () => {
    if (!campos.length) return toast.error("Selecciona al menos una columna para imprimir");
    if (!filasSeleccionadas.length) return toast.error("La lista seleccionada no tiene registros para imprimir");
    const seleccionados = CAMPOS_REPORTE.filter(([id]) => campos.includes(id));
    const ventana = window.open("", "_blank", "width=1200,height=800");
    if (!ventana) return toast.error("El navegador bloqueó la ventana de impresión");
    const cabecera = seleccionados.map(([, nombre]) => `<th>${escaparHtml(nombre)}</th>`).join("");
    const cuerpo = filasSeleccionadas.map((fila, indice) => `<tr>${seleccionados.map(([id]) => `<td class="${id === "firma" ? "firma" : ""}">${id === "firma" ? "" : escaparHtml(String(fila[id as keyof FilaReporteUsuario] ?? indice + 1))}</td>`).join("")}</tr>`).join("");
    const logo1 = logoIzquierdo ? `<img src="${escaparHtml(logoIzquierdo)}" alt="Logo izquierdo">` : "<span></span>";
    const logo2 = logoDerecho ? `<img src="${escaparHtml(logoDerecho)}" alt="Logo derecho">` : "<span></span>";
    ventana.document.write(`<!doctype html><html><head><title>${escaparHtml(titulo)}</title><style>body{font-family:Arial,sans-serif;margin:24px;color:#21181b}.cabecera{display:grid;grid-template-columns:110px 1fr 110px;align-items:center;gap:24px;border-bottom:2px solid #741229;padding-bottom:14px}.cabecera img{width:90px;height:90px;object-fit:contain}.cabecera img:last-child{justify-self:end}h1{text-align:center;color:#741229;font-size:22px;margin:0}.cabecera p{text-align:center;font-size:12px}table{width:100%;border-collapse:collapse;margin-top:20px;font-size:11px}th,td{border:1px solid #777;padding:7px;text-align:left}th{background:#741229;color:white}.firma{height:44px}@page{size:landscape;margin:12mm}</style></head><body><header class="cabecera">${logo1}<div><h1>${escaparHtml(titulo)}</h1><p>Generado el ${new Date().toLocaleString("es-BO")} · ${filasSeleccionadas.length} registros</p></div>${logo2}</header><table><thead><tr>${cabecera}</tr></thead><tbody>${cuerpo}</tbody></table><script>window.onload=()=>{window.print()}</script></body></html>`);
    ventana.document.close();
  };
  return <div className="fixed inset-0 z-[160] overflow-y-auto bg-black/70 p-3" role="dialog" aria-modal="true" aria-labelledby="titulo-constructor-reporte"><section className="mx-auto my-5 w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl"><header className="flex items-start justify-between bg-gradient-to-r from-[#841534] to-[#C59A3A] p-5 text-white"><div><p className="text-xs font-black uppercase tracking-widest">Constructor de impresión</p><h2 id="titulo-constructor-reporte" className="text-2xl font-black">Selecciona qué tendrá tu reporte</h2></div><button type="button" onClick={cerrar} aria-label="Cerrar reporte" className="grid h-10 w-10 place-items-center rounded-full bg-white/15 text-xl">✕</button></header><div className="space-y-5 p-5"><div className="grid gap-4 md:grid-cols-2"><label className="block"><span className="mb-1 block text-xs font-black uppercase text-slate-500">Lista que se imprimirá</span><select value={lista} onChange={(evento) => setLista(evento.target.value as ListaReporte)} className="input-preregistro">{LISTAS_REPORTE.map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}</select></label><label className="block"><span className="mb-1 block text-xs font-black uppercase text-slate-500">Título de la página</span><input value={titulo} onChange={(evento) => setTitulo(evento.target.value)} className="input-preregistro"/></label></div><div className="rounded-xl bg-blue-50 px-4 py-3 text-sm font-bold text-blue-900">{filasSeleccionadas.length} personas en la lista seleccionada</div><div><p className="text-sm font-black text-[#74122A]">Columnas para imprimir</p><div className="mt-3 flex flex-wrap gap-2">{CAMPOS_REPORTE.map(([id, nombre]) => <label key={id} className={`cursor-pointer rounded-xl border px-3 py-2 text-sm font-bold ${campos.includes(id) ? "border-[#841534] bg-[#841534] text-white" : "bg-white"}`}><input type="checkbox" className="mr-2" checked={campos.includes(id)} onChange={() => setCampos((actuales) => actuales.includes(id) ? actuales.filter((campo) => campo !== id) : [...actuales, id])}/>{nombre}</label>)}</div></div><div className="max-h-72 overflow-auto rounded-2xl border"><table className="min-w-full text-xs"><thead className="sticky top-0 bg-slate-100"><tr>{CAMPOS_REPORTE.filter(([id]) => campos.includes(id)).map(([id, nombre]) => <th key={id} className="p-3 text-left">{nombre}</th>)}</tr></thead><tbody>{filasSeleccionadas.slice(0, 10).map((fila, indice) => <tr key={`${fila.ci}-${indice}`} className="border-t">{CAMPOS_REPORTE.filter(([id]) => campos.includes(id)).map(([id]) => <td key={id} className="whitespace-nowrap p-3">{id === "firma" ? "________________" : fila[id as keyof FilaReporteUsuario]}</td>)}</tr>)}</tbody></table></div><p className="text-xs text-slate-500">Vista previa de hasta 10 registros. La impresión incluirá las {filasSeleccionadas.length} personas de la lista seleccionada.</p><div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={cerrar} className="rounded-xl border px-5 py-3 font-bold">Cancelar</button><button type="button" onClick={imprimir} disabled={!filasSeleccionadas.length} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 font-black text-white disabled:cursor-not-allowed disabled:opacity-50"><Printer size={18}/> Imprimir reporte</button></div></div></section></div>;
}

function SelectorLogosReporte({logoIzquierdo,logoDerecho,cambiarIzquierdo,cambiarDerecho}:{logoIzquierdo:string;logoDerecho:string;cambiarIzquierdo:(valor:string)=>void;cambiarDerecho:(valor:string)=>void}) {
  const cargar=(archivo:File|undefined,llave:string,cambiar:(valor:string)=>void)=>{if(!archivo)return;const lector=new FileReader();lector.onload=()=>{const valor=String(lector.result);localStorage.setItem(llave,valor);cambiar(valor)};lector.readAsDataURL(archivo)};
  return <aside className="fixed bottom-3 left-3 z-[170] w-[calc(100%-1.5rem)] max-w-md rounded-2xl border border-[#d9c8aa] bg-white p-3 shadow-2xl"><p className="text-xs font-black uppercase text-[#741229]">Logos de la cabecera</p><div className="mt-2 grid grid-cols-2 gap-2"><label className="rounded-xl border p-2 text-xs font-bold"><span className="flex items-center gap-2">{logoIzquierdo?<img src={logoIzquierdo} alt="Logo izquierdo" className="h-8 w-8 object-contain"/>:null}Esquina izquierda</span><input type="file" accept="image/*" onChange={(e)=>cargar(e.target.files?.[0],"LOGO_REPORTE_IZQUIERDO",cambiarIzquierdo)} className="mt-2 block w-full text-[10px]"/></label><label className="rounded-xl border p-2 text-xs font-bold"><span className="flex items-center gap-2">{logoDerecho?<img src={logoDerecho} alt="Logo derecho" className="h-8 w-8 object-contain"/>:null}Esquina derecha</span><input type="file" accept="image/*" onChange={(e)=>cargar(e.target.files?.[0],"LOGO_REPORTE_DERECHO",cambiarDerecho)} className="mt-2 block w-full text-[10px]"/></label></div></aside>;
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

function ResumenCard({ titulo, valor, tono = "vino" }: { titulo: string; valor: number | string; tono?: "vino" | "verde" | "dorado" }) {
  const color = tono === "verde" ? "text-emerald-700" : tono === "dorado" ? "text-amber-700" : "text-[#841534]";
  return <article className="rounded-2xl border border-[#eadfce] bg-white p-4 shadow-sm"><p className="text-xs font-bold text-slate-500">{titulo}</p><strong className={`mt-2 block text-2xl ${color}`}>{valor}</strong></article>;
}

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
