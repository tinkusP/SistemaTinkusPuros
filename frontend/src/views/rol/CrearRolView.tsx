import {
  useNavigate,
} from "react-router-dom";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import {
  toast,
} from "react-toastify";

import RolForm, {
  type RolFormularioPayload,
} from "@/components/rol/RolForm";

import {
  crearRol,
} from "@/api/RolApi";

export default function CreateRolView() {
  const navigate =
    useNavigate();

  const queryClient =
    useQueryClient();

  const {
    mutateAsync:
      crearRolMutation,
    isPending,
  } = useMutation({
    mutationFn:
      crearRol,

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: [
          "roles",
        ],
      });

      toast.success(
        "Rol creado correctamente",
      );

      navigate(
        "/rol",
      );
    },

    onError: (
      error: unknown,
    ) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo crear el rol",
      );
    },
  });

  const guardarRol = async (
    datos: RolFormularioPayload,
  ) => {
    await crearRolMutation(
      datos,
    );
  };

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#74122A] dark:text-[#C59A3A]">
          Roles y permisos
        </p>

        <h1 className="mt-1 text-3xl font-black">
          Crear nuevo rol
        </h1>

        <p className="mt-2 text-sm text-[#B7A7A0]">
          Registra el rol e introduce directamente los permisos que tendrá.
        </p>
      </header>

      <RolForm
        enviando={
          isPending
        }
        textoBoton="Crear rol"
        onSubmit={
          guardarRol
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
