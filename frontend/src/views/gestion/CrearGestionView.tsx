import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarPlus,
} from "lucide-react";
import {
  useNavigate,
} from "react-router-dom";
import {
  toast,
} from "react-toastify";

import {
  crearGestion,
} from "../../api/GestionApi";
import GestionForm from "../../components/gestion/GestionForm";
import type {
  GestionFormulario,
} from "../../types/GestionType";

export default function CrearGestion() {
  const navigate =
    useNavigate();

  const queryClient =
    useQueryClient();

  const mutation =
    useMutation({
      mutationFn:
        crearGestion,

      onSuccess:
        async (
          respuesta,
        ) => {
          toast.success(
            respuesta.message ||
              "Gestión registrada correctamente",
          );

          await queryClient.invalidateQueries(
            {
              queryKey: [
                "gestiones",
              ],
            },
          );

          navigate(
            "/gestion",
          );
        },

      onError:
        (
          error,
        ) => {
          toast.error(
            error instanceof Error
              ? error.message
              : "No se pudo crear la gestión",
          );
        },
    });

  const guardarGestion =
    async (
      formulario: GestionFormulario,
    ): Promise<void> => {
      await mutation.mutateAsync(
        formulario,
      );
    };

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() =>
          navigate(
            "/gestion",
          )
        }
        className="inline-flex items-center gap-2 font-semibold text-[#74122A] hover:underline"
      >
        <ArrowLeft className="h-5 w-5" />
        Volver a gestiones
      </button>

      <div className="overflow-hidden rounded-2xl border border-[#D8CABB] bg-[#F6F0E3] shadow-sm">
        <div className="bg-gradient-to-r from-[#74122A] via-[#8F5F2A] to-[#C59A3A] p-6 text-white">
          <div className="flex items-center gap-3">
            <CalendarPlus className="h-8 w-8" />

            <div>
              <h1 className="text-2xl font-bold">
                Crear gestión
              </h1>

              <p className="text-white/80">
                Registra las fechas, cupos y estado de una nueva gestión.
              </p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <GestionForm
            onSubmit={
              guardarGestion
            }
            isSubmitting={
              mutation.isPending
            }
            textoBoton="Registrar gestión"
          />
        </div>
      </div>
    </div>
  );
}