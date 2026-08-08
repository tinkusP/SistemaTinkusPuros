import {
  useMemo,
} from "react";

import {
  useNavigate,
  useParams,
} from "react-router-dom";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  toast,
} from "react-toastify";

import RolForm, {
  type RolFormularioPayload,
} from "@/components/rol/RolForm";

import {
  actualizarRol,
  obtenerRolPorId,
} from "@/api/RolApi";

export default function EditRolView() {
  const {
    rolId,
  } = useParams<{
    rolId: string;
  }>();

  const navigate =
    useNavigate();

  const queryClient =
    useQueryClient();

  const {
    data: rol,
    isLoading:
      cargandoRol,
    isError,
    error,
  } = useQuery({
    queryKey: [
      "rol",
      rolId,
    ],
    queryFn: () =>
      obtenerRolPorId(
        rolId!,
      ),
    enabled:
      Boolean(rolId),
  });

  const valoresIniciales =
    useMemo(() => {
      if (!rol) {
        return undefined;
      }

      return {
        nombre:
          rol.nombre,
        codigo:
          rol.codigo,
        descripcion:
          rol.descripcion ||
          "",
        estado:
          rol.estado ??
          true,
        esRolSistema:
          rol.esRolSistema ??
          false,
        permisos:
          (
            rol.permisos ||
            []
          ).map(
            (permiso) =>
              typeof permiso ===
              "string"
                ? permiso
                : permiso.codigo,
          ),
      };
    }, [
      rol,
    ]);

const {
  mutateAsync:
    actualizarRolMutation,
  isPending,
} = useMutation({
  mutationFn: (
    datos: RolFormularioPayload,
  ) =>
    actualizarRol(
      rolId!,
      datos,
    ),

  onSuccess: async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: [
          "roles",
        ],
      }),
      queryClient.invalidateQueries({
        queryKey: [
          "rol",
          rolId,
        ],
      }),
    ]);

    toast.success(
      "Rol actualizado correctamente",
    );

    navigate(
      "/rol",
    );
  },

  onError: (
    errorMutation: unknown,
  ) => {
    toast.error(
      errorMutation instanceof Error
        ? errorMutation.message
        : "No se pudo actualizar el rol",
    );
  },
});

const guardarCambios = async (
  datos: RolFormularioPayload,
): Promise<void> => {
  await actualizarRolMutation(
    datos,
  );
};

  if (!rolId) {
    return (
      <div className="rounded-2xl border border-[#74122A]/30 bg-[#74122A]/10 p-5 text-[#74122A]">
        No se proporcionó el identificador del rol.
      </div>
    );
  }

  if (
    cargandoRol
  ) {
    return (
      <div className="rounded-3xl bg-[#B7A7A0]/15 p-8 text-center text-sm text-[#B7A7A0]">
        Cargando rol...
      </div>
    );
  }

  if (
    isError ||
    !rol
  ) {
    return (
      <div className="rounded-2xl border border-[#74122A]/30 bg-[#74122A]/10 p-5 text-[#74122A]">
        {error instanceof Error
          ? error.message
          : "No se pudo cargar el rol"}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#74122A] dark:text-[#C59A3A]">
          Roles y permisos
        </p>

        <h1 className="mt-1 text-3xl font-black">
          Editar rol
        </h1>

        <p className="mt-2 text-sm text-[#B7A7A0]">
          Modifica los datos y permisos de{" "}
          <strong>
            {rol.nombre}
          </strong>
          .
        </p>
      </header>
<RolForm
  valoresIniciales={
    valoresIniciales
  }
  enviando={
    isPending
  }
  textoBoton="Guardar cambios"
  onSubmit={
    guardarCambios
  }
  onCancelar={() =>
    navigate(
      "/rol",
    )
  }
/>
    </div>
  );
}