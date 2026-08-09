import { useState } from "react";
import { useForm } from "react-hook-form";
import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  LogIn,
  Mail,
  ShieldCheck,
  Sparkles,
  AlarmClock,
  UserPlus,
} from "lucide-react";

import {
  ErrorLogin,
  loginPerfilUsuario,
} from "@/api/PerfilUsuarioApi";

import type {
  LoginForm,
} from "@/types/PerfilUsuarioType";

import ErrorMessage from "@/components/ErrorMessage";

/* =========================================
   TIPOS AUXILIARES
========================================= */

type RolLogin = {
  _id: string;
  nombre: string;
  codigo: string;
  descripcion?: string;
  permisos?: string[];
  estado?: boolean;
};


type UsuarioLogin = {
  _id?: string;

  nombres?: string;

  apellidoPaterno?: string;

  apellidoMaterno?: string;

  email?: string;
  requiereCambioPassword?: boolean;


  roles?: RolLogin[];
};

/* =========================================
   VISTA LOGIN
========================================= */

export default function LoginView() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
 
  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

  const [
    mensajeLogin,
    setMensajeLogin,
  ] = useState("");

  const [modalRevision, setModalRevision] = useState<{ titulo: string; mensaje: string } | null>(null);
  const [cuentaNoExiste, setCuentaNoExiste] = useState(false);

  const [
    verificandoRol,
    setVerificandoRol,
  ] = useState(false);

  const {
    register,
    handleSubmit,

    formState: {
      errors,
    },
  } = useForm<LoginForm>({
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const {
    mutate,
    isPending,
  } = useMutation({
    mutationFn:
      loginPerfilUsuario,

    onSuccess: async (
      respuesta,
    ) => {
      setMensajeLogin("");
      setVerificandoRol(true);

      try {
        /*
         * No dependemos de una sesión anterior.
         * Primero se inicia sesión y se guarda
         * el token recibido.
         */
        localStorage.setItem(
          "AUTH_TOKEN",
          respuesta.tokenjwt,
        );

        const usuario =
          respuesta.usuario as UsuarioLogin;

        /*
         * useAuth consulta esta misma clave. Al actualizarla antes de navegar,
         * los layouts reciben inmediatamente al usuario de la nueva sesión y
         * no conservan un error o los datos de una sesión anterior.
         */
        queryClient.setQueryData(
          ["usuario"],
          respuesta.usuario,
        );

        if (usuario.requiereCambioPassword) {
          toast.info("Debes cambiar la contraseña temporal antes de continuar");
          navigate("/cambiar-password-obligatorio", { replace: true });
          return;
        }

        console.log(
          "Respuesta completa del login:",
          respuesta,
        );

        console.log(
          "Usuario autenticado:",
          usuario,
        );

        console.log(
          "IDs de roles:",
          usuario.roles,
        );

        /*
         * Validamos que el usuario tenga
         * por lo menos un rol asignado.
         */
        if (
          !Array.isArray(
            usuario.roles,
          ) ||
          usuario.roles.length === 0
        ) {
          throw new Error(
            "El usuario no tiene un rol asignado",
          );
        }

        const codigosRoles = usuario.roles.map((rolUsuario) =>
          String(rolUsuario?.codigo ?? rolUsuario?.nombre ?? "").trim().toUpperCase(),
        );
        const esAdministrador = codigosRoles.some((codigo) =>
          ["ADMIN", "ADMINISTRADOR", "SUPERADMIN", "SUPERADMINISTRADOR"].includes(
            codigo.replace(/[\s_-]/g, ""),
          ),
        );

        const nombreCompleto = [
          usuario.nombres,
          usuario.apellidoPaterno,
          usuario.apellidoMaterno,
        ]
          .filter(Boolean)
          .join(" ")
          .trim();

        toast.success(
          `Bienvenido ${
            nombreCompleto ||
            usuario.email ||
            "Usuario"
          }`,
        );

        /*
         * Redirección por código de rol.
         */
        if (codigosRoles.includes("GUIA")) {
          navigate("/mi-bloque-guia", { replace: true });
          return;
        }
        if (
          !esAdministrador &&
          (codigosRoles.includes("POSTULANTE") ||
            codigosRoles.includes("FRATERNO"))
        ) {
          navigate(
            "/comunicados",
            {
              replace: true,
            },
          );

          return;
        }

        if (
          esAdministrador
        ) {
          navigate(
            "/dashboard",
            {
              replace: true,
            },
          );

          return;
        }

        /*
         * Ruta por defecto para otros roles.
         */
        navigate(
          "/dashboard",
          {
            replace: true,
          },
        );
      } catch (
        error: unknown
      ) {
        /*
         * Si falla la consulta del rol,
         * eliminamos el token para no dejar
         * una sesión incompleta.
         */
        localStorage.removeItem(
          "AUTH_TOKEN",
        );

        queryClient.removeQueries({
          queryKey: ["usuario"],
        });

        const mensaje =
          error instanceof Error
            ? error.message
            : "No se pudo verificar el rol del usuario";

        console.error(
          "Error verificando el rol:",
          error,
        );

        setMensajeLogin(
          mensaje,
        );

        toast.error(
          mensaje,
        );
      } finally {
        setVerificandoRol(
          false,
        );
      }
    },

    onError: (
      error: unknown,
    ) => {
      localStorage.removeItem(
        "AUTH_TOKEN",
      );

      queryClient.removeQueries({
        queryKey: ["usuario"],
      });

      const mensaje =
        error instanceof Error
          ? error.message
          : "No se pudo iniciar sesión";

      if (error instanceof ErrorLogin && ["CUENTA_EN_REVISION", "CUENTA_SIN_ALTA"].includes(error.codigo)) {
        setMensajeLogin("");
        setCuentaNoExiste(false);
        setModalRevision({
          titulo: error.codigo === "CUENTA_EN_REVISION" ? "Cuenta en revisión" : "Aún no te dieron de alta",
          mensaje,
        });
        return;
      }

      const noExiste = error instanceof ErrorLogin && error.codigo === "CUENTA_NO_EXISTE";
      setCuentaNoExiste(noExiste);

      setMensajeLogin(
        mensaje,
      );

      toast.error(
        mensaje,
      );
    },
  });

  const procesando =
    isPending ||
    verificandoRol;

  const onSubmit = (
    formData: LoginForm,
  ) => {
    setMensajeLogin("");
    setCuentaNoExiste(false);
    setModalRevision(null);

    mutate({
      email: formData.email
        .trim()
        .toLowerCase(),

      password:
        formData.password,
    });
  };

  return (
    <section className="relative min-h-screen overflow-hidden bg-slate-100">
      {/* FONDO DECORATIVO */}

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(236,72,153,0.22),transparent_30%),radial-gradient(circle_at_80%_15%,rgba(34,211,238,0.22),transparent_28%),radial-gradient(circle_at_75%_85%,rgba(250,204,21,0.20),transparent_30%)]" />

      <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(15,23,42,.5)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,.5)_1px,transparent_1px)] [background-size:42px_42px]" />

      <div className="relative z-10 flex min-h-screen items-center justify-center p-4 sm:p-6">
        <div className="grid w-full max-w-6xl overflow-hidden rounded-[2rem] border border-white bg-white shadow-2xl lg:grid-cols-[1.05fr_0.95fr]">
          {/* PANEL DE IDENTIDAD */}

          <aside className="relative hidden min-h-[700px] overflow-hidden lg:block">
            <img
              src="/imagenes/tinkus-puros.png"
              alt="Tinkus Puros"
              className="absolute inset-0 h-full w-full object-cover object-center"
            />

            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/35 to-white/10" />

            <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-600/15 via-transparent to-cyan-500/15" />

            <div className="relative z-10 flex h-full flex-col justify-between p-10">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-black/30 px-4 py-2 text-sm font-black text-white backdrop-blur-md">
                  <Sparkles className="h-4 w-4 text-yellow-300" />

                  Fraternidad Tinkus Puros
                </div>
              </div>

              <div>
                <p className="text-xs font-black uppercase tracking-[0.28em] text-yellow-300">
                  Puros y Naturales
                </p>

                <h1 className="mt-3 max-w-xl text-5xl font-black leading-tight text-white">
                  Sistema de gestión de la fraternidad
                </h1>

                <p className="mt-5 max-w-lg text-base leading-7 text-slate-200">
                  Administra postulantes, fraternos,
                  asistencias, pagos, documentos, bloques
                  e indumentaria desde una sola plataforma.
                </p>

                <div className="mt-7 flex items-center gap-3 rounded-2xl border border-white/20 bg-black/30 p-4 backdrop-blur-md">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-fuchsia-700">
                    <ShieldCheck className="h-6 w-6" />
                  </div>

                  <div>
                    <p className="font-black text-white">
                      Acceso institucional
                    </p>

                    <p className="mt-1 text-sm text-slate-300">
                      Ingresa con tu cuenta registrada.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </aside>

          {/* FORMULARIO */}

          <div className="relative flex min-h-[700px] items-center bg-white p-6 sm:p-10 lg:p-12">
            <div className="absolute right-0 top-0 h-40 w-40 rounded-bl-full bg-gradient-to-br from-fuchsia-100 via-yellow-50 to-cyan-100" />

            <div className="relative z-10 mx-auto w-full max-w-md">
              {/* LOGO MÓVIL */}

              <div className="mb-7 text-center">
                <div className="mx-auto h-28 w-28 overflow-hidden rounded-3xl border-4 border-white bg-white shadow-xl lg:hidden">
                  <img
                    src="/imagenes/tinkus-puros.png"
                    alt="Logo Tinkus Puros"
                    className="h-full w-full object-cover"
                  />
                </div>

                <div className="mx-auto hidden h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-fuchsia-600 via-red-500 to-yellow-400 text-white shadow-xl shadow-fuchsia-500/25 lg:flex">
                  <LockKeyhole className="h-9 w-9" />
                </div>

                <p className="mt-5 text-xs font-black uppercase tracking-[0.22em] text-fuchsia-700">
                  Tinkus Puros y Naturales
                </p>

                <h2 className="mt-2 text-4xl font-black tracking-tight text-slate-950">
                  Iniciar sesión
                </h2>

                <p className="mt-3 text-sm leading-6 text-slate-500">
                  Ingresa tu correo electrónico y contraseña
                  para acceder al sistema.
                </p>
              </div>

              <form
                onSubmit={
                  handleSubmit(
                    onSubmit,
                  )
                }
                noValidate
                className="space-y-5"
              >
                {/* CORREO */}

                <div className="space-y-2">
                  <label
                    htmlFor="email"
                    className="text-sm font-black text-slate-700"
                  >
                    Correo electrónico
                  </label>

                  <div className="group relative">
                    <div className="pointer-events-none absolute left-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl bg-slate-100 text-slate-400 transition group-focus-within:bg-fuchsia-100 group-focus-within:text-fuchsia-700">
                      <Mail className="h-5 w-5" />
                    </div>

                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="correo@ejemplo.com"
                      disabled={procesando}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-4 pl-16 pr-4 text-sm font-bold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-fuchsia-500 focus:bg-white focus:ring-4 focus:ring-fuchsia-100 disabled:cursor-not-allowed disabled:opacity-60"
                      {...register(
                        "email",
                        {
                          required:
                            "El correo electrónico es obligatorio",

                          pattern: {
                            value:
                              /^[^\s@]+@[^\s@]+\.[^\s@]+$/,

                            message:
                              "El correo electrónico no es válido",
                          },
                        },
                      )}
                    />
                  </div>

                  {errors.email && (
                    <ErrorMessage>
                      {
                        errors.email
                          .message
                      }
                    </ErrorMessage>
                  )}
                </div>

                {/* CONTRASEÑA */}

                <div className="space-y-2">
                  <label
                    htmlFor="password"
                    className="text-sm font-black text-slate-700"
                  >
                    Contraseña
                  </label>

                  <div className="group relative">
                    <div className="pointer-events-none absolute left-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl bg-slate-100 text-slate-400 transition group-focus-within:bg-cyan-100 group-focus-within:text-cyan-700">
                      <LockKeyhole className="h-5 w-5" />
                    </div>

                    <input
                      id="password"
                      type={
                        showPassword
                          ? "text"
                          : "password"
                      }
                      autoComplete="current-password"
                      placeholder="Ingresa tu contraseña"
                      disabled={procesando}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-4 pl-16 pr-14 text-sm font-bold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
                      {...register(
                        "password",
                        {
                          required:
                            "La contraseña es obligatoria",
                        },
                      )}
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowPassword(
                          (valor) =>
                            !valor,
                        )
                      }
                      disabled={procesando}
                      className="absolute right-4 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-200 hover:text-slate-900 disabled:opacity-50"
                      aria-label={
                        showPassword
                          ? "Ocultar contraseña"
                          : "Mostrar contraseña"
                      }
                    >
                      {showPassword ? (
                        <EyeOff
                          size={18}
                        />
                      ) : (
                        <Eye
                          size={18}
                        />
                      )}
                    </button>
                  </div>

                  {errors.password && (
                    <ErrorMessage>
                      {
                        errors.password
                          .message
                      }
                    </ErrorMessage>
                  )}
                </div>

                {/* MENSAJE DEL BACKEND */}

                {mensajeLogin && (
                  <div
                    role="alert"
                    className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                        <ShieldCheck className="h-5 w-5" />
                      </div>

                      <div>
                        <p className="text-sm font-black text-amber-900">
                          No se puede iniciar sesión
                        </p>

                        <p className="mt-1 text-sm font-medium leading-5 text-amber-800">
                          {mensajeLogin}
                        </p>
                        {cuentaNoExiste ? <button type="button" onClick={() => navigate("/auth/registrar")} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#841534] px-4 py-2 text-sm font-bold text-white"><UserPlus className="h-4 w-4"/>No tengo cuenta, registrarme</button> : null}
                      </div>
                    </div>
                  </div>
                )}

                {/* BOTÓN */}

                <button
                  type="submit"
                  disabled={procesando}
                  className="group relative inline-flex w-full items-center justify-center overflow-hidden rounded-2xl px-5 py-4 text-sm font-black text-white shadow-xl shadow-fuchsia-500/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-fuchsia-600 via-red-500 to-yellow-500 transition group-hover:scale-105" />

                  <span className="relative z-10 inline-flex items-center gap-2">
                    {procesando ? (
                      <>
                        <span
                          className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white"
                          aria-hidden="true"
                        />

                        {verificandoRol
                          ? "Verificando rol..."
                          : "Ingresando..."}
                      </>
                    ) : (
                      <>
                        <LogIn className="h-5 w-5" />

                        Iniciar sesión

                        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                      </>
                    )}
                  </span>
                </button>
              </form>

              {/* REGISTRO */}

              <div className="mt-6">
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-slate-300" />

                  <span className="whitespace-nowrap text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                    ¿Aún no tienes cuenta?
                  </span>

                  <div className="h-px flex-1 bg-slate-300" />
                </div>

                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      "/auth/registrar",
                    )
                  }
                  className="group relative mt-4 flex h-14 w-full items-center justify-center overflow-hidden rounded-2xl border-0 shadow-lg shadow-fuchsia-500/20 transition duration-300 hover:-translate-y-0.5 hover:shadow-xl"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-fuchsia-600 via-red-500 to-yellow-400 transition duration-300 group-hover:scale-105" />

                  <span className="relative z-10 text-base font-black tracking-wide text-white">
                    Crear una cuenta
                  </span>
                </button>

                <p className="mt-3 text-center text-xs font-medium leading-5 text-slate-600">
                  Regístrate para iniciar tu preinscripción
                  a la fraternidad.
                </p>
              </div>

              {/* SEGURIDAD */}

              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                    <ShieldCheck className="h-5 w-5" />
                  </div>

                  <p className="text-xs font-medium leading-5 text-slate-500">
                    Tus credenciales son validadas de forma
                    segura por el sistema. No compartas tu
                    contraseña con otras personas.
                  </p>
                </div>
              </div>

              <p className="mt-7 text-center text-xs text-slate-400">
                Fraternidad Tinkus Puros y Naturales · Gestión 2026
              </p>
            </div>
          </div>
        </div>
      </div>
      {modalRevision ? <div className="fixed inset-0 z-[200] grid place-items-center bg-slate-950/70 p-4" role="dialog" aria-modal="true" aria-labelledby="titulo-cuenta-revision"><section className="w-full max-w-md rounded-3xl bg-white p-7 text-center shadow-2xl"><div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-amber-100 text-amber-700"><AlarmClock className="h-9 w-9"/></div><h2 id="titulo-cuenta-revision" className="mt-4 text-2xl font-black text-[#841534]">{modalRevision.titulo}</h2><p className="mt-3 leading-6 text-slate-600">{modalRevision.mensaje}</p><div className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">No necesitas volver a registrarte. Administración debe revisar y habilitar tu cuenta.</div><button type="button" autoFocus onClick={() => setModalRevision(null)} className="mt-6 w-full rounded-xl bg-[#841534] px-5 py-3 font-bold text-white">Entendido, esperaré</button></section></div> : null}
    </section>
  );
}
