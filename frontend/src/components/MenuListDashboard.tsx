import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Link,
  useLocation,
} from "react-router-dom";

import {
  Boxes,
  ChevronDown,
  ChevronRight,
  CircleUserRound,
  FolderTree,
  LayoutDashboard,
  Menu,
  Package,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";

/* =====================================================
   TIPOS
===================================================== */

type MenuItem = {
  to: string;
  text: string;
  icon: React.ElementType;
};

type MenuSection = {
  title: string;
  icon: React.ElementType;
  items: MenuItem[];
};

/* =====================================================
   COMPONENTE
===================================================== */

export default function MenuListDashboard() {
  const location = useLocation();

  const [
    openSidebar,
    setOpenSidebar,
  ] = useState(false);

  const [
    openSection,
    setOpenSection,
  ] = useState<string | null>(
    "Inventario"
  );

  /* =====================================================
     ESTRUCTURA DEL MENÚ
  ===================================================== */

  const menu = useMemo<MenuSection[]>(
    () => [
      {
        title: "Inventario",
        icon: Boxes,

        items: [
          {
            to: "/producto",
            text: "Productos",
            icon: Package,
          },

          {
            to: "/categoriaProducto",
            text: "Categorías",
            icon: FolderTree,
          },
        ],
      },

      {
        title: "Usuarios",
        icon: Users,

        items: [
          {
            to: "/rol",
            text: "Roles",
            icon: ShieldCheck,
          },

          {
            to: "/perfilusuario",
            text: "Perfiles de usuario",
            icon: CircleUserRound,
          },
        ],
      },
    ],
    []
  );

  /* =====================================================
     FUNCIONES
  ===================================================== */

  const toggleSection = (
    section: string
  ) => {
    setOpenSection(
      (seccionActual) =>
        seccionActual === section
          ? null
          : section
    );
  };

  const normalizarRuta = (
    path: string
  ) => {
    if (path === "/") {
      return "/";
    }

    return path.replace(
      /\/+$/,
      ""
    );
  };

  const isActive = (
    path: string
  ) => {
    const rutaActual =
      normalizarRuta(
        location.pathname
      );

    const rutaMenu =
      normalizarRuta(path);

    return (
      rutaActual === rutaMenu ||
      rutaActual.startsWith(
        `${rutaMenu}/`
      )
    );
  };

  const seccionActiva = (
    section: MenuSection
  ) =>
    section.items.some(
      (item) =>
        isActive(item.to)
    );

  const cerrarSidebar = () => {
    setOpenSidebar(false);
  };

  /* =====================================================
     ABRIR AUTOMÁTICAMENTE LA SECCIÓN ACTIVA
  ===================================================== */

  useEffect(() => {
    const seccionEncontrada =
      menu.find(
        (section) =>
          section.items.some(
            (item) =>
              isActive(
                item.to
              )
          )
      );

    if (
      seccionEncontrada
    ) {
      setOpenSection(
        seccionEncontrada.title
      );
    }
  }, [
    location.pathname,
    menu,
  ]);

  /* =====================================================
     CERRAR AL CAMBIAR DE RUTA EN MÓVIL
  ===================================================== */

  useEffect(() => {
    setOpenSidebar(false);
  }, [
    location.pathname,
  ]);

  /* =====================================================
     BLOQUEAR SCROLL DEL BODY EN MÓVIL
  ===================================================== */

  useEffect(() => {
    if (
      !openSidebar
    ) {
      document.body.style.overflow =
        "";

      return;
    }

    document.body.style.overflow =
      "hidden";

    return () => {
      document.body.style.overflow =
        "";
    };
  }, [
    openSidebar,
  ]);

  /* =====================================================
     CERRAR CON ESCAPE
  ===================================================== */

  useEffect(() => {
    const cerrarConEscape = (
      event: KeyboardEvent
    ) => {
      if (
        event.key ===
        "Escape"
      ) {
        setOpenSidebar(false);
      }
    };

    window.addEventListener(
      "keydown",
      cerrarConEscape
    );

    return () => {
      window.removeEventListener(
        "keydown",
        cerrarConEscape
      );
    };
  }, []);

  return (
    <>
      {/* =================================================
          BOTÓN MÓVIL
      ================================================= */}

      <button
        type="button"
        onClick={() =>
          setOpenSidebar(true)
        }
        aria-label="Abrir menú lateral"
        className="
          fixed left-4 top-4 z-[60]
          flex h-11 w-11 items-center
          justify-center rounded-xl
          border border-slate-700
          bg-slate-950 text-white
          shadow-xl transition
          hover:bg-slate-900
          active:scale-95
          lg:hidden
        "
      >
        <Menu size={22} />
      </button>

      {/* =================================================
          OVERLAY MÓVIL
      ================================================= */}

      <div
        aria-hidden="true"
        onClick={
          cerrarSidebar
        }
        className={`
          fixed inset-0 z-40
          bg-black/65 backdrop-blur-sm
          transition-opacity duration-300
          lg:hidden

          ${
            openSidebar
              ? "visible opacity-100"
              : "invisible opacity-0"
          }
        `}
      />

      {/* =================================================
          SIDEBAR
      ================================================= */}

      <aside
        className={`
          fixed inset-y-0 left-0 z-50
          flex h-dvh w-[280px]
          flex-col overflow-hidden
          border-r border-slate-800
          bg-slate-950 text-slate-100
          shadow-2xl
          transition-transform duration-300
          ease-in-out

          sm:w-72

          lg:sticky
          lg:top-0
          lg:h-screen
          lg:translate-x-0
          lg:shadow-none

          ${
            openSidebar
              ? "translate-x-0"
              : "-translate-x-full"
          }
        `}
      >
        {/* ===============================================
            CABECERA
        =============================================== */}

    

        {/* ===============================================
            INICIO
        =============================================== */}

        <div className="shrink-0 px-3 pt-4">
          <Link
            to="/"
            onClick={
              cerrarSidebar
            }
            className={`
              flex items-center gap-3
              rounded-xl px-3 py-3
              text-sm font-semibold
              transition

              ${
                location.pathname ===
                "/"
                  ? `
                    bg-white
                    text-slate-950
                    shadow-lg
                    shadow-black/20
                  `
                  : `
                    text-slate-300
                    hover:bg-slate-900
                    hover:text-white
                  `
              }
            `}
          >
            <LayoutDashboard
              size={19}
            />

            <span>
              Panel principal
            </span>
          </Link>
        </div>

        {/* ===============================================
            NAVEGACIÓN
        =============================================== */}

        <nav
          aria-label="Menú principal"
          className="
            min-h-0 flex-1
            overflow-y-auto
            overscroll-contain
            px-3 pb-5 pt-4

            [scrollbar-color:#475569_transparent]
            [scrollbar-width:thin]
          "
        >
          <p
            className="
              mb-3 px-3 text-[11px]
              font-bold uppercase
              tracking-[0.18em]
              text-slate-500
            "
          >
            Administración
          </p>

          <div className="space-y-2">
            {menu.map(
              (section) => {
                const Icon =
                  section.icon;

                const isOpen =
                  openSection ===
                  section.title;

                const active =
                  seccionActiva(
                    section
                  );

                return (
                  <section
                    key={
                      section.title
                    }
                    className="overflow-hidden rounded-xl"
                  >
                    {/* CABECERA DE LA SECCIÓN */}

                    <button
                      type="button"
                      onClick={() =>
                        toggleSection(
                          section.title
                        )
                      }
                      aria-expanded={
                        isOpen
                      }
                      className={`
                        flex w-full items-center
                        justify-between gap-3
                        rounded-xl px-3 py-3
                        text-left transition

                        ${
                          active
                            ? `
                              bg-slate-900
                              text-white
                            `
                            : `
                              text-slate-300
                              hover:bg-slate-900/80
                              hover:text-white
                            `
                        }
                      `}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className={`
                            flex h-9 w-9 shrink-0
                            items-center justify-center
                            rounded-lg transition

                            ${
                              active
                                ? `
                                  bg-white/10
                                  text-white
                                `
                                : `
                                  bg-slate-900
                                  text-slate-400
                                `
                            }
                          `}
                        >
                          <Icon
                            size={18}
                          />
                        </div>

                        <span className="truncate text-sm font-semibold">
                          {section.title}
                        </span>
                      </div>

                      <div className="shrink-0 text-slate-500">
                        {isOpen ? (
                          <ChevronDown
                            size={17}
                          />
                        ) : (
                          <ChevronRight
                            size={17}
                          />
                        )}
                      </div>
                    </button>

                    {/* SUBMENÚ */}

                    <div
                      className={`
                        grid transition-all
                        duration-300 ease-in-out

                        ${
                          isOpen
                            ? `
                              grid-rows-[1fr]
                              opacity-100
                            `
                            : `
                              grid-rows-[0fr]
                              opacity-0
                            `
                        }
                      `}
                    >
                      <div className="overflow-hidden">
                        <div
                          className="
                            relative ml-[30px]
                            mt-1 space-y-1
                            border-l
                            border-slate-800
                            pb-2 pl-4
                          "
                        >
                          {section.items.map(
                            (item) => {
                              const ItemIcon =
                                item.icon;

                              const itemActive =
                                isActive(
                                  item.to
                                );

                              return (
                                <Link
                                  key={
                                    item.to
                                  }
                                  to={
                                    item.to
                                  }
                                  onClick={
                                    cerrarSidebar
                                  }
                                  className={`
                                    group flex
                                    items-center
                                    gap-3 rounded-lg
                                    px-3 py-2.5
                                    text-sm transition

                                    ${
                                      itemActive
                                        ? `
                                          bg-white
                                          font-semibold
                                          text-slate-950
                                          shadow-md
                                          shadow-black/20
                                        `
                                        : `
                                          text-slate-400
                                          hover:bg-slate-900
                                          hover:text-white
                                        `
                                    }
                                  `}
                                >
                                  <ItemIcon
                                    size={17}
                                    className={`
                                      shrink-0

                                      ${
                                        itemActive
                                          ? "text-slate-950"
                                          : `
                                            text-slate-500
                                            group-hover:text-white
                                          `
                                      }
                                    `}
                                  />

                                  <span className="truncate">
                                    {item.text}
                                  </span>
                                </Link>
                              );
                            }
                          )}
                        </div>
                      </div>
                    </div>
                  </section>
                );
              }
            )}
          </div>
        </nav>

        {/* ===============================================
            PIE DEL SIDEBAR
        =============================================== */}

        <footer className="shrink-0 border-t border-slate-800 bg-slate-950 p-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
            <div className="flex items-center gap-3">
              <div
                className="
                  flex h-9 w-9 shrink-0
                  items-center justify-center
                  rounded-full bg-slate-800
                  text-slate-300
                "
              >
                <CircleUserRound
                  size={19}
                />
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">
                  Administrador
                </p>

                <p className="truncate text-xs text-slate-500">
                  Acceso general
                </p>
              </div>
            </div>
          </div>

          <p className="mt-3 text-center text-[10px] text-slate-600">
            Discoteca Manager © 2026
          </p>
        </footer>
      </aside>
    </>
  );
}