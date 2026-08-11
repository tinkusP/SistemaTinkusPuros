import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Link,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";

import {
  ToastContainer,
} from "react-toastify";

import "react-toastify/dist/ReactToastify.css";
import { registrarCierreSesion } from "@/api/GuiaApi";
import ThemeToggle from "@/components/ThemeToggle";

import {
  useAuth,
} from "@/hooks/useAuth";

type RolUsuario = {
  _id?: string;
  nombre?: string;
  codigo?: string;
};

type OpcionMenu = {
  nombre: string;
  ruta: string;
  icono: string;
};

const opcionesMenu: OpcionMenu[] = [
  {
    nombre: "Dashboard",
    ruta: "/dashboard",
    icono: "🏠",
  },
  {
    nombre: "Reportes",
    ruta: "/reportes",
    icono: "📊",
  },
  {
    nombre: "Respaldo total",
    ruta: "/respaldo",
    icono: "💾",
  },
  {
    nombre: "Comunicados",
    ruta: "/comunicados",
    icono: "📢",
  },{
    nombre: "Biblioteca de pasos",
    ruta: "/pasos",
    icono: "🎬",
  },{
    nombre: "Cancionero",
    ruta: "/cancionero",
    icono: "🎵",
  },{
    nombre: "Escanear QR",
    ruta: "/escaner-qr",
    icono: "📷",
  },{
    nombre: "Gestiones",
    ruta: "/gestion",
    icono: "👥",
  },
  {
    nombre: "Gestión integral",
    ruta: "/perfil-usuario",
    icono: "👥",
  },
  {
    nombre: "Tokens de registro",
    ruta: "/tokens-registro",
    icono: "🔐",
  },
  {
    nombre: "Integrantes por facultad",
    ruta: "/facultades",
    icono: "🎓",
  },
  {
    nombre: "Roles",
    ruta: "/rol",
    icono: "🛡️",
  },
  
  {
    nombre: "Postulantes a guía",
    ruta: "/postulantes-guia",
    icono: "🪶",
  },
  {
    nombre: "Asistencia postulantes guía",
    ruta: "/asistencias-postulantes-guia",
    icono: "📋",
  },
  {
    nombre: "Guías y bloques",
    ruta: "/guias-bloques",
    icono: "🧭",
  },
  {
    nombre: "Mi bloque de guía",
    ruta: "/mi-bloque-guia",
    icono: "🎟️",
  },
  {
    nombre: "Tallas e indumentaria",
    ruta: "/indumentaria",
    icono: "👕",
  },
  {
    nombre: "Anuncios",
    ruta: "/anuncios",
    icono: "📣",
  },
  {
    nombre: "Auditoría",
    ruta: "/auditoria",
    icono: "🔎",
  },
  {
    nombre: "Asistencias",
    ruta: "/asistencias",
    icono: "✅",
  },
  {
    nombre: "Traspasos",
    ruta: "/traspasos",
    icono: "🔄",
  },

];

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const [
    menuLateralAbierto,
    setMenuLateralAbierto,
  ] = useState(false);

  const [
    menuUsuarioAbierto,
    setMenuUsuarioAbierto,
  ] = useState(false);

  const [
    errorFoto,
    setErrorFoto,
  ] = useState(false);

  const {
    data: usuario,
    isLoading,
    isError,
  } = useAuth();

  useEffect(() => {
    setMenuLateralAbierto(false);
    setMenuUsuarioAbierto(false);
  }, [location.pathname]);

  useEffect(() => {
    setErrorFoto(false);
  }, [usuario?.fotoPerfil]);

  const nombreCompleto = [
    usuario?.nombres,
    usuario?.apellidoPaterno,
    usuario?.apellidoMaterno,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  const iniciales = useMemo(() => {
    return (
      nombreCompleto
        .split(/\s+/)
        .filter(Boolean)
        .map((parte) =>
          parte.charAt(0),
        )
        .slice(0, 2)
        .join("")
        .toUpperCase() || "US"
    );
  }, [nombreCompleto]);

  const codigosRoles = Array.isArray(usuario?.roles) ? usuario.roles.map((rol) => typeof rol === "object" && rol ? String((rol as RolUsuario).codigo || (rol as RolUsuario).nombre || "").toUpperCase() : "") : [];
  const permisosUsuario = new Set(Array.isArray(usuario?.roles) ? usuario.roles.flatMap((rol) => typeof rol === "object" && rol && Array.isArray((rol as RolUsuario & {permisos?:string[]}).permisos) ? (rol as RolUsuario & {permisos?:string[]}).permisos! : []) : []);
  const esAdministrador = codigosRoles.some(codigo => ["ADMIN", "ADMINISTRADOR", "SUPERADMIN", "SUPERADMINISTRADOR"].includes(codigo.replace(/[\s_-]/g,"")));
  const esGuia = codigosRoles.includes("GUIA");
  const rolPrincipal = Array.isArray(usuario?.roles) ? usuario.roles.find((rol) => typeof rol === "object" && rol && String((rol as RolUsuario).codigo || "").toUpperCase() === (esAdministrador ? "ADMINISTRADOR" : esGuia ? "GUIA" : codigosRoles[0])) ?? usuario.roles[0] : null;

  const nombreRol =
    typeof rolPrincipal === "object" &&
    rolPrincipal !== null
      ? String(
          (rolPrincipal as RolUsuario).nombre ||
            (rolPrincipal as RolUsuario).codigo ||
            "",
        )
          .trim()
          .toUpperCase()
      : "";
  const permisoPorRuta:Record<string,string>={"/tokens-registro":"TOKENS_GESTIONAR","/dashboard":"VISTA_DASHBOARD","/gestion":"VISTA_GESTIONES","/perfil-usuario":"VISTA_USUARIOS","/facultades":"VISTA_FACULTADES","/rol":"VISTA_ROLES","/preregistros":"VISTA_PREREGISTROS","/postulantes-guia":"VISTA_POSTULANTES_GUIA","/asistencias-postulantes-guia":"VISTA_ASISTENCIA_GUIA","/guias-bloques":"VISTA_GUIAS_BLOQUES","/indumentaria":"VISTA_INDUMENTARIA","/anuncios":"VISTA_ANUNCIOS","/auditoria":"VISTA_AUDITORIA","/cuotas":"VISTA_PAGOS","/asistencias":"VISTA_ASISTENCIAS","/fraternos":"VISTA_FRATERNOS","/traspasos":"VISTA_TRASPASOS","/pasos":"VISTA_PASOS","/cancionero":"VISTA_CANCIONERO","/reportes":"VISTA_REPORTES"};
  const esPropietarioRespaldo = String(usuario?.email ?? "").trim().toLowerCase() === "devdjcod@gmail.com";
  const tienePermisosOperativos = permisosUsuario.size > 0;
  const opcionesVisibles = esAdministrador
    ? opcionesMenu.filter(opcion => (opcion.ruta !== "/mi-bloque-guia" || esGuia) && (opcion.ruta !== "/respaldo" || esPropietarioRespaldo))
    : esGuia
      ? opcionesMenu.filter(opcion => ["/comunicados", "/mi-bloque-guia", "/pasos", "/cancionero"].includes(opcion.ruta))
      : opcionesMenu.filter(opcion => tienePermisosOperativos
        ? opcion.ruta === "/dashboard" || permisosUsuario.has(permisoPorRuta[opcion.ruta]) || (opcion.ruta === "/tokens-registro" && permisosUsuario.has("VISTA_TOKENS"))
        : ["/comunicados", "/pasos", "/cancionero"].includes(opcion.ruta));

  const backendUrl = String(
    import.meta.env.VITE_API_URL || "",
  ).replace(/\/api\/?$/, "");

  const fotoPerfil =
    usuario?.fotoPerfil
      ? usuario.fotoPerfil.startsWith("http")
        ? usuario.fotoPerfil
        : `${backendUrl}${usuario.fotoPerfil}`
      : null;

  const cerrarSesion = async () => {
    await registrarCierreSesion();
    localStorage.removeItem("AUTH_TOKEN");
    localStorage.removeItem("AUTH_USER");

    navigate("/auth/login", {
      replace: true,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F6F0E3] p-6 dark:bg-[#262022]">
        <div className="mx-auto max-w-7xl animate-pulse space-y-5">
          <div className="h-16 rounded-2xl bg-[#B7A7A0]/25" />
          <div className="h-72 rounded-3xl bg-[#B7A7A0]/20" />
        </div>
      </div>
    );
  }

  if (isError || !usuario) {
    return (
      <Navigate
        to="/auth/login"
        replace
      />
    );
  }

  if (usuario.requiereCambioPassword) {
    return <Navigate to="/cambiar-password-obligatorio" replace />;
  }

  if (!esAdministrador && esGuia && !["/mi-bloque-guia", "/pasos", "/cancionero", "/comunicados"].some(ruta => location.pathname.startsWith(ruta))) {
    return <Navigate to="/mi-bloque-guia" replace />;
  }

  if(!esAdministrador&&!opcionesVisibles.some(opcion=>location.pathname===opcion.ruta||location.pathname.startsWith(`${opcion.ruta}/`))){return <Navigate to="/comunicados" replace/>;}

  return (
    <div className="min-h-screen bg-[#F6F0E3] text-[#262022] dark:bg-[#262022] dark:text-[#F6F0E3]">
      {menuLateralAbierto && (
        <button
          type="button"
          aria-label="Cerrar menú lateral"
          onClick={() =>
            setMenuLateralAbierto(false)
          }
          className="fixed inset-0 z-40 bg-[#262022]/60 lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-[#B7A7A0]/30 bg-[#262022] text-[#F6F0E3] shadow-2xl transition-transform duration-300 lg:translate-x-0 ${
          menuLateralAbierto
            ? "translate-x-0"
            : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-[#B7A7A0]/20 px-5 py-5">
          <Link
            to={esAdministrador ? "/dashboard" : esGuia ? "/mi-bloque-guia" : "/comunicados"}
            className="flex min-w-0 items-center gap-3"
          >
            <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-[#F6F0E3]">
              <img
                src="/imagenes/tinkus-puros.png"
                alt="Tinkus Puros"
                className="h-9 w-9 object-contain"
              />
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-black">
                Tinkus Puros
              </p>

              <p className="truncate text-xs text-[#B7A7A0]">
                {esAdministrador ? "Panel administrador" : esGuia ? "Panel de guía" : "Portal del usuario"}
              </p>
            </div>
          </Link>

          <button
            type="button"
            onClick={() =>
              setMenuLateralAbierto(false)
            }
            className="grid h-9 w-9 place-items-center rounded-lg text-[#B7A7A0] transition hover:bg-[#74122A] hover:text-[#F6F0E3] lg:hidden"
          >
            ✕
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-5">
          {opcionesVisibles.map(
            (opcion) => {
              const activo =
                location.pathname === opcion.ruta ||
                location.pathname.startsWith(
                  `${opcion.ruta}/`,
                );

              return (
                <Link
                  key={opcion.ruta}
                  to={opcion.ruta}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                    activo
                      ? "bg-[#74122A] text-[#F6F0E3] shadow-lg shadow-black/20"
                      : "text-[#B7A7A0] hover:bg-[#C59A3A]/15 hover:text-[#F6F0E3]"
                  }`}
                >
                  <span className="text-lg">
                    {opcion.icono}
                  </span>

                  <span>
                    {opcion.nombre}
                  </span>

                  {activo && (
                    <span className="ml-auto h-2 w-2 rounded-full bg-[#C59A3A]" />
                  )}
                </Link>
              );
            },
          )}
        </nav>

        <div className="border-t border-[#B7A7A0]/20 p-4">
          <div className="rounded-2xl bg-[#74122A]/25 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#C59A3A]">
              Sesión actual
            </p>

            <p className="mt-2 truncate text-sm font-bold">
              {nombreCompleto ||
                usuario.email ||
                "Administrador"}
            </p>

            <p className="mt-1 text-xs text-[#B7A7A0]">
              {nombreRol ||
                "ADMINISTRADOR"}
            </p>
          </div>
        </div>
      </aside>

      <div className="min-h-screen lg:pl-72">
        <header className="sticky top-0 z-30 border-b border-[#B7A7A0]/35 bg-[#F6F0E3]/95 backdrop-blur dark:bg-[#262022]/95">
          <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  setMenuLateralAbierto(true)
                }
                className="grid h-10 w-10 place-items-center rounded-xl bg-[#74122A] text-lg text-[#F6F0E3] lg:hidden"
              >
                ☰
              </button>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#74122A] dark:text-[#C59A3A]">
                  {esAdministrador ? "Panel administrativo" : esGuia ? "Panel de guía" : "Portal institucional"}
                </p>

                <h1 className="text-lg font-black">
                  Tinkus Puros y Naturales
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <ThemeToggle />
              <div className="relative">
              <button
                type="button"
                onClick={() =>
                  setMenuUsuarioAbierto(
                    (actual) => !actual,
                  )
                }
                className="flex items-center gap-3 rounded-2xl border border-[#B7A7A0] bg-[#F6F0E3] px-3 py-2 text-left transition hover:border-[#C59A3A] dark:border-[#B7A7A0]/40 dark:bg-[#262022]"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-[#74122A] text-xs font-black text-[#F6F0E3]">
                  {fotoPerfil && !errorFoto ? (
                    <img
                      src={fotoPerfil}
                      alt={`Foto de ${nombreCompleto}`}
                      className="h-full w-full object-cover"
                      onError={() =>
                        setErrorFoto(true)
                      }
                    />
                  ) : (
                    iniciales
                  )}
                </span>

                <span className="hidden min-w-0 sm:block">
                  <span className="block max-w-44 truncate text-sm font-bold">
                    {nombreCompleto ||
                      usuario.email ||
                      "Usuario"}
                  </span>

                  <span className="block text-xs text-[#B7A7A0]">
                    {nombreRol ||
                      "Mi cuenta"}
                  </span>
                </span>

                <span
                  className={`text-xs text-[#B7A7A0] transition ${
                    menuUsuarioAbierto
                      ? "rotate-180"
                      : ""
                  }`}
                >
                  ▼
                </span>
              </button>

              {menuUsuarioAbierto && (
                <div className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-[#B7A7A0] bg-[#F6F0E3] p-2 shadow-2xl dark:border-[#B7A7A0]/40 dark:bg-[#262022]">
                  <div className="border-b border-[#B7A7A0]/35 px-3 py-3">
                    <p className="truncate text-sm font-bold">
                      {nombreCompleto ||
                        "Usuario"}
                    </p>

                    {usuario.email && (
                      <p className="mt-1 truncate text-xs text-[#B7A7A0]">
                        {usuario.email}
                      </p>
                    )}
                  </div>

                  <Link
                    to="/admin/mi-perfil"
                    className="mt-2 block rounded-xl px-3 py-2.5 text-sm font-medium transition hover:bg-[#C59A3A]/15"
                  >
                    Mi perfil
                  </Link>

                  <button
                    type="button"
                    onClick={cerrarSesion}
                    className="mt-1 block w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-[#74122A] transition hover:bg-[#74122A]/10"
                  >
                    Cerrar sesión
                  </button>
                </div>
              )}
              </div>
            </div>
          </div>
        </header>

        <main className="px-3 py-5 sm:px-5 lg:px-8">
          <div className="mx-auto w-full max-w-7xl">
            <Outlet />
          </div>
        </main>

        <footer className="border-t border-[#B7A7A0]/30 px-4 py-5 text-center text-xs text-[#B7A7A0]">
          © {new Date().getFullYear()} Tinkus Puros y Naturales
        </footer>
      </div>

      <ToastContainer
        pauseOnHover={false}
        pauseOnFocusLoss={false}
      />
    </div>
  );
}
