import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Link,
  Navigate,
  useNavigate,
} from "react-router-dom";

import { useAuth } from "@/hooks/useAuth";
import { registrarCierreSesion } from "@/api/GuiaApi";
import { listarAnuncios, leerNotificacion, misNotificaciones } from "@/api/GuiaApi";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

type TipoPublicacion =
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

type RolUsuario = {
  _id?: string;
  nombre?: string;
  codigo?: string;
};


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
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [
    menuUsuarioAbierto,
    setMenuUsuarioAbierto,
  ] = useState(false);

  const [errorFoto, setErrorFoto] =
    useState(false);

  const {
    data: usuario,
  } = useAuth();

  const anunciosQuery = useQuery({ queryKey: ["anuncios"], queryFn: listarAnuncios, refetchInterval: 30_000 });
  const notificacionesQuery = useQuery({ queryKey: ["notificaciones"], queryFn: misNotificaciones });
  const marcarLeida = useMutation({ mutationFn: leerNotificacion, onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["notificaciones"] }) });
  const [busqueda, setBusqueda] =
    useState("");
  const [busquedaNotificaciones, setBusquedaNotificaciones] = useState("");
  const [limiteNotificaciones, setLimiteNotificaciones] = useState(() => window.innerWidth < 640 ? 3 : 5);

  const [tipoSeleccionado, setTipoSeleccionado] =
    useState<"TODOS" | TipoPublicacion>(
      "TODOS",
    );

  const nombreCompleto = [
    usuario?.nombres,
    usuario?.apellidoPaterno,
    usuario?.apellidoMaterno,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  const iniciales =
    nombreCompleto
      .split(/\s+/)
      .filter(Boolean)
      .map((parte) =>
        parte.charAt(0),
      )
      .slice(0, 2)
      .join("")
      .toUpperCase() || "US";

  const rolPrincipal =
    Array.isArray(usuario?.roles) &&
    usuario.roles.length > 0
      ? usuario.roles[0]
      : null;

  const nombreRol =
    typeof rolPrincipal === "object" &&
    rolPrincipal !== null
      ? String(
          (rolPrincipal as RolUsuario)
            .nombre ||
            (rolPrincipal as RolUsuario)
              .codigo ||
            "",
        )
          .trim()
          .toUpperCase()
      : "";

  const esAdministrador = Array.isArray(usuario?.roles) && usuario.roles.some((rol) => {
    if (typeof rol !== "object" || rol === null) return false;
    const datos = rol as RolUsuario;
    return [datos.nombre, datos.codigo].some((valor) =>
      ["ADMIN", "ADMINISTRADOR", "SUPERADMIN", "SUPERADMINISTRADOR"].includes(
        String(valor ?? "").trim().toUpperCase().replace(/[\s_-]/g, ""),
      ),
    );
  });
  const esGuia = Array.isArray(usuario?.roles) && usuario.roles.some((rol) => {
    if (typeof rol !== "object" || rol === null) return false;
    const datos = rol as RolUsuario;
    return [datos.nombre, datos.codigo].some((valor) =>
      String(valor ?? "").trim().toUpperCase().replace(/[\s_-]/g, "") === "GUIA",
    );
  });
  const esPostulante = Array.isArray(usuario?.roles) && usuario.roles.some((rol) => {
    if (typeof rol !== "object" || rol === null) return false;
    const datos = rol as RolUsuario;
    return [datos.nombre, datos.codigo].some((valor) =>
      String(valor ?? "").trim().toUpperCase().replace(/[\s_-]/g, "") === "POSTULANTE",
    );
  });
  const esFraterno = Array.isArray(usuario?.roles) && usuario.roles.some((rol) => {
    if (typeof rol !== "object" || rol === null) return false;
    const datos = rol as RolUsuario;
    return [datos.nombre, datos.codigo].some((valor) =>
      String(valor ?? "").trim().toUpperCase().replace(/[\s_-]/g, "") === "FRATERNO",
    );
  });

  const anunciosPublicados = (anunciosQuery.data ?? []).filter((anuncio) => {
    const vigente = anuncio.publicado && (!anuncio.fechaExpiracion || new Date(anuncio.fechaExpiracion) >= new Date());
    const dirigidoAlUsuario = esAdministrador || anuncio.destinatario === "TODOS" ||
      (anuncio.destinatario === "POSTULANTES" && esPostulante) ||
      (anuncio.destinatario === "GUIAS" && esGuia) ||
      (anuncio.destinatario === "ADMINISTRADORES" && esAdministrador);
    return vigente && dirigidoAlUsuario;
  });
  const publicaciones: Publicacion[] = anunciosPublicados.map((anuncio) => ({
    _id: anuncio._id,
    titulo: anuncio.titulo,
    descripcion: anuncio.contenido,
    tipo: anuncio.tipo === "CONVOCATORIA" ? "CONVOCATORIA" : anuncio.tipo === "ENSAYO" ? "ACTIVIDAD" : "COMUNICADO",
    fechaPublicacion: anuncio.fechaPublicacion ?? anuncio.fechaCreado,
    fechaEvento: anuncio.fechaEvento,
    imagen: anuncio.afiche,
  }));
  const proximosEnsayos = anunciosPublicados.filter((anuncio) => anuncio.tipo === "ENSAYO" && anuncio.fechaEvento && new Date(anuncio.fechaEvento) >= new Date()).sort((a, b) => new Date(a.fechaEvento!).getTime() - new Date(b.fechaEvento!).getTime()).slice(0, 5);

  const backendUrl = String(
    import.meta.env.VITE_API_URL || "",
  ).replace(/\/api\/?$/, "");

  const fotoPerfil =
    usuario?.fotoPerfil && !errorFoto
      ? usuario.fotoPerfil.startsWith(
          "http",
        )
        ? usuario.fotoPerfil
        : `${backendUrl}${usuario.fotoPerfil}`
      : null;

  useEffect(() => {
    setErrorFoto(false);
  }, [usuario?.fotoPerfil]);

  const cerrarSesion = async () => {
    await registrarCierreSesion();
    localStorage.removeItem(
      "AUTH_TOKEN",
    );

    localStorage.removeItem(
      "AUTH_USER",
    );

    setMenuUsuarioAbierto(false);

    navigate(
      "/auth/login",
      {
        replace: true,
      },
    );
  };

  if (usuario?.requiereCambioPassword) {
    return <Navigate to="/cambiar-password-obligatorio" replace />;
  }

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
    <div className="min-h-screen w-full bg-[#eeeae2] text-[#262022] dark:bg-[#1f1a1c] dark:text-[#F6F0E3]">
      {/* Cabecera institucional */}

      <header className="border-t-[6px] border-[#74122A] bg-white shadow-sm dark:bg-[#262022]">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <Link to="/comunicados" className="flex min-w-0 items-center gap-4">
            <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-[#C59A3A] bg-[#F6F0E3] p-1 shadow-sm sm:h-20 sm:w-20">
              <img
                src="/imagenes/tinkus-puros.png"
                alt="Emblema Tinkus Puros y Naturales"
                className="h-full w-full rounded-full object-cover"
              />
            </div>

            <div className="min-w-0 border-l border-[#C59A3A]/50 pl-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#8F5F2A] sm:text-xs">
                Fraternidad folklórica
              </p>
              <p className="mt-1 text-xl font-black uppercase leading-tight tracking-wide text-[#74122A] sm:text-2xl dark:text-[#F6F0E3]">
                Tinkus Puros y Naturales
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-[#B7A7A0]">
                Portal institucional de información y actividades
              </p>
            </div>
          </Link>

          <div className="hidden text-right text-xs leading-5 text-slate-500 lg:block dark:text-[#B7A7A0]">
            <p className="font-bold uppercase tracking-wider text-[#74122A] dark:text-[#C59A3A]">
              Información oficial
            </p>
            <p>Comunicados de la directiva</p>
            <p>La Paz, Bolivia</p>
          </div>
        </div>

        <nav aria-label="Navegación principal" className="bg-[#74122A] text-white">
          <div className="mx-auto flex w-full max-w-7xl items-stretch justify-between gap-3 px-3 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-stretch overflow-x-auto">
              <Link to="/comunicados" className="shrink-0 border-b-4 border-[#C59A3A] px-3 py-3 text-xs font-bold uppercase tracking-wider sm:px-4">
                Inicio
              </Link>
              <button type="button" onClick={() => setTipoSeleccionado("COMUNICADO")} className="shrink-0 border-b-4 border-transparent px-3 py-3 text-xs font-semibold uppercase tracking-wider transition hover:bg-white/10 sm:px-4">
                Comunicados
              </button>
              <button type="button" onClick={() => setTipoSeleccionado("CONVOCATORIA")} className="shrink-0 border-b-4 border-transparent px-3 py-3 text-xs font-semibold uppercase tracking-wider transition hover:bg-white/10 sm:px-4">
                Convocatorias
              </button>
              <button type="button" onClick={() => setTipoSeleccionado("ACTIVIDAD")} className="shrink-0 border-b-4 border-transparent px-3 py-3 text-xs font-semibold uppercase tracking-wider transition hover:bg-white/10 sm:px-4">
                Actividades
              </button>
              {esGuia && <Link to="/mi-bloque-guia" className="shrink-0 border-b-4 border-transparent bg-[#C59A3A]/25 px-3 py-3 text-xs font-black uppercase tracking-wider transition hover:bg-white/10 sm:px-4">Mi bloque</Link>}
            </div>

            {/* Cuenta del usuario */}
            <div className="relative z-50 flex shrink-0 items-center">
              <button
                type="button"
                onClick={() => setMenuUsuarioAbierto((abierto) => !abierto)}
                className="flex h-full items-center gap-2 border-x border-white/15 bg-[#5E0E22] px-2.5 text-left transition hover:bg-[#4c0b1b] sm:min-w-52 sm:px-4"
                aria-expanded={menuUsuarioAbierto}
                aria-haspopup="menu"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full border border-[#C59A3A] bg-[#F6F0E3] text-[10px] font-black text-[#74122A] sm:h-9 sm:w-9">
                  {fotoPerfil ? (
                    <img src={fotoPerfil} onError={() => setErrorFoto(true)} alt={`Foto de ${nombreCompleto || "usuario"}`} className="h-full w-full object-cover" />
                  ) : iniciales}
                </span>
                <span className="hidden min-w-0 flex-1 sm:block">
                  <span className="block max-w-36 truncate text-xs font-bold normal-case">{nombreCompleto || usuario?.email || "Usuario"}</span>
                  <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-wider text-[#e9cf91]">{nombreRol || "Mi cuenta"}</span>
                </span>
                <span className={`text-[10px] text-[#e9cf91] transition-transform ${menuUsuarioAbierto ? "rotate-180" : ""}`}>▼</span>
              </button>

              {menuUsuarioAbierto && (
                <div role="menu" className="absolute right-0 top-full mt-2 w-64 overflow-hidden rounded-xl border border-[#B7A7A0] bg-[#F6F0E3] p-2 text-[#262022] shadow-2xl dark:border-[#B7A7A0]/40 dark:bg-[#262022] dark:text-[#F6F0E3]">
                  <div className="border-b border-[#B7A7A0]/40 px-3 py-3">
                    <p className="truncate text-sm font-bold">{nombreCompleto || "Usuario"}</p>
                    {usuario?.email && <p className="mt-1 truncate text-xs text-[#8a7469] dark:text-[#B7A7A0]">{usuario.email}</p>}
                  </div>
                  <Link to="/perfil" role="menuitem" onClick={() => setMenuUsuarioAbierto(false)} className="mt-2 block rounded-lg px-3 py-2.5 text-sm font-medium transition hover:bg-[#C59A3A]/15">
                    Mi perfil
                  </Link>
                  <Link to="/mis-preregistros" role="menuitem" onClick={() => setMenuUsuarioAbierto(false)} className="mt-1 block rounded-lg px-3 py-2.5 text-sm font-medium transition hover:bg-[#C59A3A]/15">
                    Mis preregistros
                  </Link>
                  <Link to="/notificaciones" role="menuitem" onClick={() => setMenuUsuarioAbierto(false)} className="mt-1 block rounded-lg px-3 py-2.5 text-sm font-medium transition hover:bg-[#C59A3A]/15">
                    Notificaciones
                  </Link>
                  <Link to="/mis-pagos" role="menuitem" onClick={() => setMenuUsuarioAbierto(false)} className="mt-1 block rounded-lg px-3 py-2.5 text-sm font-medium transition hover:bg-[#C59A3A]/15">
                    Mis pagos
                  </Link>
                  {esFraterno && <Link to="/mis-tallas" role="menuitem" onClick={() => setMenuUsuarioAbierto(false)} className="mt-1 block rounded-lg px-3 py-2.5 text-sm font-medium transition hover:bg-[#C59A3A]/15">Mis tallas de polera y chamarra</Link>}
                  <Link to="/pasos" role="menuitem" onClick={() => setMenuUsuarioAbierto(false)} className="mt-1 block rounded-lg px-3 py-2.5 text-sm font-medium transition hover:bg-[#C59A3A]/15">Biblioteca de pasos</Link>
                  <Link to="/cancionero" role="menuitem" onClick={() => setMenuUsuarioAbierto(false)} className="mt-1 block rounded-lg px-3 py-2.5 text-sm font-medium transition hover:bg-[#C59A3A]/15">Cancionero</Link>
                  <Link to="/mi-credencial-qr" role="menuitem" onClick={() => setMenuUsuarioAbierto(false)} className="mt-1 block rounded-lg px-3 py-2.5 text-sm font-medium transition hover:bg-[#C59A3A]/15">Mi credencial QR</Link>
                  {esPostulante && (
                    <Link to="/mi-asistencia-guia" role="menuitem" onClick={() => setMenuUsuarioAbierto(false)} className="mt-1 block rounded-lg bg-[#C59A3A]/15 px-3 py-2.5 text-sm font-bold text-[#74122A] transition hover:bg-[#C59A3A]/25">
                      Mi asistencia a guía
                    </Link>
                  )}
                  {esGuia && (
                    <Link to="/mi-bloque-guia" role="menuitem" onClick={() => setMenuUsuarioAbierto(false)} className="mt-1 block rounded-lg bg-[#C59A3A]/20 px-3 py-2.5 text-sm font-black text-[#74122A] transition hover:bg-[#C59A3A]/30">
                      Mi bloque de guía
                    </Link>
                  )}
                  {esFraterno && (
                    <Link to="/mi-bloque" role="menuitem" onClick={() => setMenuUsuarioAbierto(false)} className="mt-1 block rounded-lg bg-emerald-100 px-3 py-2.5 text-sm font-black text-emerald-900 transition hover:bg-emerald-200">
                      Mi bloque y posición
                    </Link>
                  )}
                  {esAdministrador && (
                    <Link to="/dashboard" role="menuitem" onClick={() => setMenuUsuarioAbierto(false)} className="mt-1 block rounded-lg bg-[#841534] px-3 py-2.5 text-sm font-bold text-white transition hover:bg-[#641025]">
                      Ir al dashboard
                    </Link>
                  )}
                  {/* <Link to="/mi-asistencia" role="menuitem" onClick={() => setMenuUsuarioAbierto(false)} className="mt-1 block rounded-lg px-3 py-2.5 text-sm font-medium transition hover:bg-[#C59A3A]/15">
                    Mi asistencia
                  </Link> */}
                  <button type="button" role="menuitem" onClick={cerrarSesion} className="mt-1 block w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-[#74122A] transition hover:bg-[#74122A]/10 dark:text-[#e9cf91]">
                    Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          </div>
        </nav>
      </header>

      <div className="mx-auto w-full max-w-7xl space-y-6 px-3 py-6 sm:px-5 lg:px-8 lg:py-8">
        {/* Encabezado */}

        <section className="relative overflow-hidden border-l-[7px] border-[#C59A3A] bg-[#74122A] px-5 py-9 text-[#F6F0E3] shadow-md sm:px-10 sm:py-12">
          <div className="absolute inset-y-0 right-0 w-2/5 bg-[radial-gradient(circle_at_center,rgba(197,154,58,.32),transparent_65%)]" />
          <div className="relative max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#e9cf91]">
              Unidad de comunicación • Información oficial
            </p>

            <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
              Comunicados institucionales
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#F6F0E3]/85 sm:text-base">
              Consulta avisos, convocatorias, afiches y actividades publicados por la directiva de la fraternidad.
            </p>
          </div>
        </section>

        {/* Buscador y filtros */}

        <section className="grid gap-5 lg:grid-cols-[1.35fr_.65fr]">
          <div className="border border-[#d3c9bb] bg-white p-5 shadow-sm dark:bg-[#262022]">
            <div className="flex items-center justify-between border-b border-[#d3c9bb] pb-3"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#8F5F2A]">Información oficial</p><h2 className="text-xl font-black text-[#74122A] dark:text-[#e9cf91]">Anuncios recientes</h2></div><span className="rounded-full bg-[#74122A] px-2.5 py-1 text-xs font-bold text-white">{anunciosPublicados.length}</span></div>
            <div className="mt-4 max-h-80 space-y-3 overflow-y-auto pr-1">{anunciosPublicados.slice(0, 8).map((anuncio) => <article key={anuncio._id} className="border-l-4 border-[#C59A3A] bg-[#faf7f1] p-4 dark:bg-[#332B2E]"><div className="flex justify-between gap-3"><h3 className="font-bold">{anuncio.titulo}</h3><span className="text-[10px] font-bold text-[#74122A] dark:text-[#e9cf91]">{anuncio.tipo}</span></div><p className="mt-1 line-clamp-2 text-sm text-[#735f55] dark:text-[#B7A7A0]">{anuncio.contenido}</p></article>)}{anunciosPublicados.length === 0 && <p className="py-8 text-center text-sm text-slate-500">No hay anuncios publicados.</p>}</div>
          </div>
          <div className="border border-[#d3c9bb] bg-white p-5 shadow-sm dark:bg-[#262022]">
            <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#8F5F2A]">Agenda</p><h2 className="text-xl font-black text-[#74122A] dark:text-[#e9cf91]">📅 Próximos ensayos</h2><div className="mt-4 space-y-3">{proximosEnsayos.map((ensayo) => { const fecha = new Date(ensayo.fechaEvento!); return <article key={ensayo._id} className="flex gap-3 rounded-xl bg-[#f5efe4] p-3 dark:bg-[#332B2E]"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-[#74122A] text-center text-white"><span className="text-[9px] uppercase">{fecha.toLocaleDateString("es-BO", { month: "short" })}</span><strong className="-mt-2 text-lg">{fecha.getDate()}</strong></div><div><p className="text-sm font-bold">{ensayo.titulo}</p><p className="text-xs text-[#735f55] dark:text-[#B7A7A0]">{fecha.toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" })} · {ensayo.lugar || "Lugar por confirmar"}</p><p className="mt-1 text-[10px] text-[#8F5F2A]">🔔 Recordatorio {ensayo.recordatorioHoras ?? 24} h antes</p></div></article>; })}{proximosEnsayos.length === 0 && <p className="py-6 text-center text-sm text-slate-500">Sin ensayos próximos.</p>}</div>
          </div>
        </section>

        <section className="border border-[#d3c9bb] bg-white p-5 shadow-sm dark:bg-[#262022]"><div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#8F5F2A]">Bandeja personal</p><h2 className="text-xl font-black text-[#74122A] dark:text-[#e9cf91]">🔔 Notificaciones</h2></div><Link to="/notificaciones" className="text-sm font-bold text-[#74122A] dark:text-[#e9cf91]">Ver todas</Link></div><div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]"><input type="search" value={busquedaNotificaciones} onChange={(e) => setBusquedaNotificaciones(e.target.value)} className="input-preregistro" placeholder="Buscar notificación..." /><select value={limiteNotificaciones} onChange={(e) => setLimiteNotificaciones(Number(e.target.value))} className="input-preregistro"><option value={3}>3 filas</option><option value={5}>5 filas</option><option value={10}>10 filas</option><option value={20}>20 filas</option></select></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead><tr className="border-b text-xs uppercase text-[#735f55]"><th className="p-2">Estado</th><th className="p-2">Notificación</th><th className="p-2">Fecha</th><th className="p-2">Acción</th></tr></thead><tbody>{(notificacionesQuery.data?.notificaciones ?? []).filter((n) => `${n.titulo} ${n.mensaje}`.toLowerCase().includes(busquedaNotificaciones.trim().toLowerCase())).slice(0, limiteNotificaciones).map((n) => <tr key={n._id} className="border-b border-[#eee8dc]"><td className="p-2">{n.leida ? "Leída" : "🔴 Nueva"}</td><td className="p-2"><strong>{n.titulo}</strong><p className="line-clamp-1 text-xs text-slate-500">{n.mensaje}</p></td><td className="p-2 text-xs">{new Date(n.fechaCreado).toLocaleDateString("es-BO")}</td><td className="p-2">{!n.leida && <button onClick={() => marcarLeida.mutate(n._id)} className="text-xs font-bold text-[#74122A]">Marcar leída</button>}</td></tr>)}</tbody></table></div></section>

        <section className="border border-[#d3c9bb] bg-white p-4 shadow-sm dark:border-[#B7A7A0]/30 dark:bg-[#262022]">
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
                className="w-full rounded-xl border border-[#B7A7A0] bg-[#F6F0E3] px-4 py-3 pl-11 text-sm outline-none transition focus:border-[#74122A] focus:ring-4 focus:ring-[#C59A3A]/25 dark:border-[#B7A7A0]/40 dark:bg-[#262022] dark:focus:ring-[#74122A]/30"
              />

              <span className="pointer-events-none absolute left-4 top-3 text-[#B7A7A0]">
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

        {anunciosQuery.isLoading ? (
          <section className="border border-[#d3c9bb] bg-white px-6 py-16 text-center text-slate-500 dark:bg-[#262022]">Cargando publicaciones oficiales...</section>
        ) : anunciosQuery.isError ? (
          <section className="border border-red-200 bg-red-50 px-6 py-12 text-center text-red-700"><p className="font-bold">No se pudieron cargar las publicaciones.</p><button type="button" onClick={() => anunciosQuery.refetch()} className="mt-4 rounded-xl bg-[#74122A] px-4 py-2 font-bold text-white">Volver a intentar</button></section>
        ) : publicacionesFiltradas.length >
        0 ? (
          <section>
            <div className="mb-5 flex items-end justify-between border-b-2 border-[#74122A] pb-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#8F5F2A]">Actualidad institucional</p>
                <h2 className="mt-1 text-2xl font-black text-[#262022] dark:text-[#F6F0E3]">Noticias y comunicados</h2>
              </div>
              <span className="hidden text-sm text-slate-500 sm:block">{publicacionesFiltradas.length} publicaciones</span>
            </div>
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
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
            </div>
          </section>
        ) : (
          <section className="border border-dashed border-[#B7A7A0] bg-white px-6 py-16 text-center dark:border-[#B7A7A0]/40 dark:bg-[#262022]">
            <div className="text-5xl">
              📭
            </div>

            <h2 className="mt-4 text-xl font-bold">
              No se encontraron publicaciones
            </h2>

            <p className="mt-2 text-sm text-[#B7A7A0] dark:text-[#B7A7A0]">
              Intenta cambiar el filtro o el
              texto de búsqueda.
            </p>
          </section>
        )}
      </div>

      <footer className="mt-4 border-t-4 border-[#C59A3A] bg-[#262022] px-4 py-8 text-center text-sm text-[#B7A7A0]">
        <p className="font-bold uppercase tracking-wider text-[#F6F0E3]">Tinkus Puros y Naturales</p>
        <p className="mt-2">Portal institucional • La Paz, Bolivia</p>
      </footer>
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
    <article className="group flex h-full flex-col overflow-hidden border border-[#d3c9bb] border-t-4 border-t-[#74122A] bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl dark:border-[#B7A7A0]/30 dark:border-t-[#C59A3A] dark:bg-[#262022]">
      {/* Imagen */}

      {urlImagen && !errorImagen ? (
        <div className="relative aspect-[16/10] overflow-hidden bg-[#B7A7A0]/20 dark:bg-[#332B2E]">
          <img
            src={urlImagen}
            alt={publicacion.titulo}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            onError={() =>
              setErrorImagen(true)
            }
          />

          {publicacion.fijado && (
            <span className="absolute left-3 top-3 rounded-full bg-[#262022]/80 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
              📌 Fijado
            </span>
          )}
        </div>
      ) : (
        <div className="relative grid aspect-[16/10] place-items-center bg-gradient-to-br from-[#5b0d20] via-[#74122A] to-[#9a6d28] text-6xl text-[#F6F0E3]">
          {obtenerIconoTipo(
            publicacion.tipo,
          )}

          {publicacion.fijado && (
            <span className="absolute left-3 top-3 rounded-full bg-[#262022]/80 px-3 py-1 text-xs font-semibold text-[#F6F0E3]">
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

          <span className="text-xs text-[#B7A7A0]">
            {formatearFecha(
              publicacion.fechaPublicacion,
            )}
          </span>
        </div>

        <h2 className="mt-4 text-xl font-bold leading-snug text-[#262022] transition group-hover:text-[#74122A] dark:text-[#F6F0E3] dark:group-hover:text-[#C59A3A]">
          {publicacion.titulo}
        </h2>

        <p className="mt-3 line-clamp-4 text-sm leading-6 text-[#262022]/75 dark:text-[#F6F0E3]/80">
          {publicacion.descripcion}
        </p>

        {publicacion.fechaEvento && (
          <div className="mt-4 rounded-xl bg-[#C59A3A]/15 px-3 py-2 text-sm text-[#74122A] dark:bg-[#C59A3A]/10 dark:text-[#C59A3A]">
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
            <p className="mb-3 text-xs text-[#B7A7A0]">
              Publicado por{" "}
              <span className="font-semibold text-[#262022]/75 dark:text-[#F6F0E3]/80">
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
                className="rounded-xl bg-[#74122A] px-4 py-2 text-sm font-semibold text-[#F6F0E3] transition hover:bg-[#5E0E22]"
              >
                Ver afiche
              </a>
            )}

            {urlArchivo && (
              <a
                href={urlArchivo}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-[#B7A7A0] px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-[#C59A3A]/15 dark:border-[#B7A7A0]/40 dark:text-[#F6F0E3] dark:hover:bg-[#332B2E]"
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
          ? "bg-[#74122A] text-[#F6F0E3] shadow-sm"
          : "bg-[#B7A7A0]/20 text-[#262022]/75 hover:bg-[#C59A3A]/25 dark:bg-[#332B2E] dark:text-[#F6F0E3]/80 dark:hover:bg-[#4A3E42]"
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
    COMUNICADO:
      "bg-[#B7A7A0]/20 text-[#262022] dark:bg-[#B7A7A0]/15 dark:text-[#F6F0E3]",

    CONVOCATORIA:
      "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-[#C59A3A]",

    ACTIVIDAD:
      "bg-[#74122A]/10 text-[#74122A] dark:bg-[#74122A]/20 dark:text-[#C59A3A]",
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
