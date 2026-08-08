import {
  useMemo,
} from "react";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  ArrowLeft,
  UserPlus,
} from "lucide-react";

import {
  useNavigate,
} from "react-router-dom";

import {
  toast,
} from "react-toastify";

import {
  createPerfilUsuario,
} from "@/api/PerfilUsuarioApi";

import {
  obtenerGestiones,
} from "@/api/GestionApi";

import {
  obtenerRolesActivos,
} from "@/api/RolApi";

import PerfilUsuarioForm, {
  construirPayloadRegistro,
  type PerfilUsuarioFormData,
} from "@/components/perfilUsuario/PerfilUsuarioForm";

export default function CrearPerfilUsuarioView() {
  const navigate =
    useNavigate();

  const queryClient =
    useQueryClient();

  const rolesQuery =
    useQuery({
      queryKey: [
        "roles-activos",
      ],

      queryFn:
        obtenerRolesActivos,
    });

  const gestionesQuery =
    useQuery({
      queryKey: [
        "gestiones",
        "selector-perfil",
      ],

      queryFn: () =>
        obtenerGestiones({
          pagina:
            1,

          limite:
            100,
        }),
    });

  const gestiones =
    gestionesQuery.data
      ?.gestiones ??
    [];

  const gestionPredeterminada =
    useMemo(
      () =>
        gestiones.find(
          (gestion) =>
            gestion.estado ===
            "ACTIVA",
        ) ??
        gestiones.find(
          (gestion) =>
            gestion.estado ===
            "INSCRIPCIONES",
        ) ??
        gestiones[0],
      [
        gestiones,
      ],
    );

  const mutation =
    useMutation({
      mutationFn:
        createPerfilUsuario,

      onSuccess:
        async (
          respuesta,
        ) => {
          toast.success(
            respuesta.message ||
              "Perfil creado correctamente",
          );

          await queryClient.invalidateQueries(
            {
              queryKey: [
                "perfilusuarios",
              ],
            },
          );

          navigate(
            "/perfil-usuario",
          );
        },

      onError:
        (
          error,
        ) => {
          toast.error(
            error instanceof Error
              ? error.message
              : "Error creando el perfil",
          );
        },
    });

  const enviarFormulario =
    async (
      datos: PerfilUsuarioFormData,
    ) => {
      const payload =
        construirPayloadRegistro(
          datos,
        );

      await mutation.mutateAsync(
        payload,
      );
    };

  const cargando =
    rolesQuery.isLoading ||
    gestionesQuery.isLoading;

  if (cargando) {
    return (
      <div className="rounded-3xl bg-white p-10 text-center shadow-sm">
        Cargando opciones del formulario...
      </div>
    );
  }

  if (
    rolesQuery.isError ||
    gestionesQuery.isError
  ) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-center text-red-700">
        No se pudieron cargar los roles o las gestiones.
      </div>
    );
  }

  return (
    <main className="space-y-6">
      <button
        type="button"
        onClick={() =>
          navigate(
            "/perfil-usuario",
          )
        }
        className="inline-flex items-center gap-2 font-bold text-[#841534] hover:underline"
      >
        <ArrowLeft className="h-5 w-5" />
        Volver a perfiles
      </button>

      <header className="rounded-3xl bg-gradient-to-r from-[#841534] via-[#a33b39] to-[#c39b37] p-7 text-white shadow-xl">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-white/15 p-3">
            <UserPlus className="h-8 w-8" />
          </div>

          <div>
            <p className="text-sm font-semibold text-white/80">
              Panel administrativo
            </p>

            <h1 className="text-3xl font-black">
              Crear perfil de usuario
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/85">
              Registra un usuario, asigna sus roles y gestión, y carga sus documentos de respaldo.
            </p>
          </div>
        </div>
      </header>

      <PerfilUsuarioForm
        modo="CREAR_ADMIN"
        roles={
          rolesQuery.data ??
          []
        }
        gestiones={
          gestiones
        }
        valoresIniciales={{
          gestion:
            gestionPredeterminada
              ? [
                  gestionPredeterminada._id,
                ]
              : [],
        }}
        guardando={
          mutation.isPending
        }
        textoBoton="Registrar usuario"
        onSubmit={
          enviarFormulario
        }
        cancelar={() =>
          navigate(
            "/perfil-usuario",
          )
        }
      />
    </main>
  );
}
