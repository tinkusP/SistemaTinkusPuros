import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Link } from "react-router-dom";
import { obtenerReporteEjecutivo } from "@/api/ReporteApi";
import { getPerfilUsuarios } from "@/api/PerfilUsuarioApi";

const COLORES_ESTADO: Record<string, string> = {
  APROBADO: "#12805c",
  PENDIENTE: "#d79b24",
  OBSERVADO: "#e06c2f",
  LISTA_ESPERA: "#64748b",
  RECHAZADO: "#c93636",
  CANCELADO: "#78716c",
};

const ETIQUETAS: Record<string, string> = {
  APROBADO: "Aprobados",
  PENDIENTE: "Pendientes",
  OBSERVADO: "Observados",
  LISTA_ESPERA: "Lista de espera",
  RECHAZADO: "Rechazados",
  CANCELADO: "Cancelados",
};

const estadosOrdenados = [
  "APROBADO",
  "PENDIENTE",
  "OBSERVADO",
  "LISTA_ESPERA",
  "RECHAZADO",
  "CANCELADO",
];

const accesosRapidos = [
  { titulo: "Registrar usuario", descripcion: "Crear un nuevo perfil de usuario.", ruta: "/perfilUsuario/crear", icono: "➕" },
  { titulo: "Gestionar preregistros", descripcion: "Revisar postulantes, estados y cupos.", ruta: "/preregistros", icono: "📝" },
  { titulo: "Gestionar pagos", descripcion: "Registrar y verificar cuotas.", ruta: "/cuotas", icono: "💰" },
  { titulo: "Publicar anuncio", descripcion: "Crear un aviso para los integrantes.", ruta: "/anuncios", icono: "📢" },
  { titulo: "Ver reportes", descripcion: "Consultar información consolidada.", ruta: "/reportes", icono: "📊" },
];

function Tarjeta({ titulo, valor, descripcion, icono, ruta }: { titulo: string; valor: string | number; descripcion: string; icono: string; ruta: string }) {
  return (
    <Link to={ruta} className="group rounded-3xl border border-[#B7A7A0] bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-[#C59A3A] hover:shadow-lg dark:border-[#B7A7A0]/30 dark:bg-[#262022]">
      <div className="flex items-start justify-between gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#74122A] text-xl text-white">{icono}</span>
        <span className="text-xs font-semibold text-[#8F5F2A]">Ver módulo →</span>
      </div>
      <p className="mt-5 text-3xl font-black text-[#262022] dark:text-white">{valor}</p>
      <h3 className="mt-2 text-sm font-bold">{titulo}</h3>
      <p className="mt-1 text-xs leading-5 text-[#8b7770]">{descripcion}</p>
    </Link>
  );
}

export default function DashboardView() {
  const reporteQuery = useQuery({
    queryKey: ["reporte-ejecutivo", "dashboard"],
    queryFn: obtenerReporteEjecutivo,
    refetchInterval: 30_000,
  });
  const usuariosQuery = useQuery({
    queryKey: ["perfilusuarios", "dashboard-total"],
    queryFn: getPerfilUsuarios,
    refetchInterval: 30_000,
  });

  const reporte = reporteQuery.data;
  const resumen = reporte?.resumen ?? {};
  const estadosApi = new Map(
    (reporte?.distribuciones.estadoPreregistro ?? []).map((item) => [item.nombre, item.total]),
  );
  const estados = estadosOrdenados.map((estado) => ({
    estado,
    nombre: ETIQUETAS[estado],
    total: estadosApi.get(estado) ?? 0,
    color: COLORES_ESTADO[estado],
  }));
  const integrantes = [
    { nombre: "Usuarios", total: usuariosQuery.data?.length ?? 0, color: "#8F5F2A" },
    { nombre: "Preregistrados", total: resumen.total ?? 0, color: "#841534" },
    { nombre: "Aprobados", total: estadosApi.get("APROBADO") ?? 0, color: "#12805c" },
    { nombre: "Fraternos", total: resumen.fraternos ?? 0, color: "#2563a8" },
    { nombre: "Guías", total: resumen.guias ?? 0, color: "#7c3aed" },
  ];
  const cargando = reporteQuery.isLoading || usuariosQuery.isLoading;

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl bg-gradient-to-r from-[#74122A] via-[#8F5F2A] to-[#C59A3A] px-6 py-8 text-[#F6F0E3] shadow-lg sm:px-8 sm:py-10">
        <span className="inline-flex rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">Administración general</span>
        <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Dashboard administrativo</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85 sm:text-base">
          Información actualizada de usuarios, preregistros, fraternos, pagos y asistencias.
        </p>
        {reporte && <p className="mt-3 text-xs text-white/75">{reporte.gestion.nombre} · actualizado {new Date(reporte.generadoEn).toLocaleString("es-BO")}</p>}
      </section>

      {(reporteQuery.isError || usuariosQuery.isError) && (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800">
          <p className="font-black">No se pudo cargar toda la información del dashboard.</p>
          <p className="mt-1 text-sm">{reporteQuery.error?.message || usuariosQuery.error?.message}</p>
          <button type="button" onClick={() => { reporteQuery.refetch(); usuariosQuery.refetch(); }} className="mt-3 rounded-xl bg-[#841534] px-4 py-2 text-sm font-bold text-white">Volver a intentar</button>
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tarjeta titulo="Usuarios registrados" valor={cargando ? "…" : usuariosQuery.data?.length ?? 0} descripcion="Todas las cuentas del sistema" icono="👥" ruta="/perfil-usuario" />
        <Tarjeta titulo="Preregistrados" valor={cargando ? "…" : resumen.total ?? 0} descripcion="Postulantes de la gestión actual" icono="📝" ruta="/preregistros" />
        <Tarjeta titulo="Fraternos activos" valor={cargando ? "…" : resumen.fraternos ?? 0} descripcion="Integrantes habilitados como fraternos" icono="🕺" ruta="/fraternos" />
        <Tarjeta titulo="Asistencias" valor={cargando ? "…" : resumen.asistencias ?? 0} descripcion="Asistencias presentes registradas" icono="✅" ruta="/asistencias" />
        <Tarjeta titulo="Pendientes" valor={cargando ? "…" : estadosApi.get("PENDIENTE") ?? 0} descripcion="Preregistros pendientes de revisión" icono="⏳" ruta="/preregistros" />
        <Tarjeta titulo="Observados" valor={cargando ? "…" : estadosApi.get("OBSERVADO") ?? 0} descripcion="Deben regularizar información" icono="⚠️" ruta="/preregistros" />
        <Tarjeta titulo="Lista de espera" valor={cargando ? "…" : estadosApi.get("LISTA_ESPERA") ?? 0} descripcion="Postulantes esperando un cupo" icono="📋" ruta="/preregistros" />
        <Tarjeta titulo="Cobrado verificado" valor={cargando ? "…" : `Bs ${(reporte?.finanzas.montoCobrado ?? 0).toFixed(2)}`} descripcion="Pagos verificados de la gestión" icono="💳" ruta="/cuotas" />
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <article className="rounded-3xl border border-[#d3c9bb] bg-white p-5 shadow-sm dark:bg-[#262022] sm:p-6">
          <h2 className="text-xl font-black text-[#74122A] dark:text-[#e9cf91]">Estados de preregistro</h2>
          <p className="mt-1 text-sm text-slate-500">Situación actual de todos los postulantes.</p>
          <div className="mt-5 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={estados} margin={{ top: 10, right: 10, left: -15, bottom: 45 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="nombre" angle={-25} textAnchor="end" interval={0} tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip formatter={(valor) => [valor, "Personas"]} />
                <Bar dataKey="total" name="Personas" radius={[8, 8, 0, 0]}>
                  {estados.map((item) => <Cell key={item.estado} fill={item.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="rounded-3xl border border-[#d3c9bb] bg-white p-5 shadow-sm dark:bg-[#262022] sm:p-6">
          <h2 className="text-xl font-black text-[#74122A] dark:text-[#e9cf91]">Resumen de integrantes</h2>
          <p className="mt-1 text-sm text-slate-500">Avance desde preregistro hasta fraterno o guía.</p>
          <div className="mt-5 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={integrantes} layout="vertical" margin={{ top: 10, right: 35, left: 25, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="nombre" width={105} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(valor) => [valor, "Personas"]} />
                <Bar dataKey="total" name="Personas" radius={[0, 8, 8, 0]}>
                  {integrantes.map((item) => <Cell key={item.nombre} fill={item.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>

      <section className="rounded-3xl border border-[#B7A7A0] bg-white p-5 shadow-sm dark:border-[#B7A7A0]/30 dark:bg-[#262022] sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#74122A] dark:text-[#C59A3A]">Acciones frecuentes</p>
        <h2 className="mt-1 text-2xl font-black">Accesos rápidos</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {accesosRapidos.map((acceso) => (
            <Link key={acceso.titulo} to={acceso.ruta} className="rounded-2xl border border-[#B7A7A0]/70 p-4 transition hover:border-[#C59A3A] hover:bg-[#C59A3A]/10">
              <span className="text-2xl">{acceso.icono}</span>
              <h3 className="mt-3 font-bold">{acceso.titulo}</h3>
              <p className="mt-1 text-xs leading-5 text-[#8b7770]">{acceso.descripcion}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
