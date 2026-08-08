import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarCog,
  RefreshCw,
} from "lucide-react";
import {
  useNavigate,
  useParams,
} from "react-router-dom";
import {
  toast,
} from "react-toastify";

import {
  actualizarGestion,
  obtenerGestionPorId,
} from "../../api/GestionApi";
import GestionForm from "../../components/gestion/GestionForm";
import type {
  GestionFormulario,
} from "../../types/GestionType";

const convertirFechaInput = (
  fecha?: string | null,
): string => {
  if (!fecha) {
    return "";
  }

  const fechaConvertida =
    new Date(fecha);

  if (
    Number.isNaN(
      fechaConvertida.getTime(),
    )
  ) {
    return "";
  }

  return fechaConvertida
    .toISOString()
    .slice(0, 10);
};

export default function EditarGestion() {
  const {
    gestionId,
  } =
    useParams<{
      gestionId: string;
    }>();

  const navigate =
    useNavigate();

  const queryClient =
    useQueryClient();

  const gestionQuery =
    useQuery({
      queryKey: [
        "gestion",
        gestionId,
      ],

      queryFn: () =>
        obtenerGestionPorId(
          gestionId!,
        ),

      enabled:
        Boolean(
          gestionId,
        ),

      retry:
        1,
    });

  const mutation =
    useMutation({
      mutationFn:
        actualizarGestion,

      onSuccess:
        async (
          respuesta,
        ) => {
          toast.success(
            respuesta.message ||
              "Gestión actualizada correctamente",
          );

          await Promise.all([
            queryClient.invalidateQueries(
              {
                queryKey: [
                  "gestiones",
                ],
              },
            ),

            queryClient.invalidateQueries(
              {
                queryKey: [
                  "gestion",
                  gestionId,
                ],
              },
            ),
          ]);

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
              : "No se pudo actualizar la gestión",
          );
        },
    });

  if (!gestionId) {
    return (
      <EstadoCarga
        tipo="error"
        mensaje="No se recibió el identificador de la gestión."
      />
    );
  }

  if (
    gestionQuery.isLoading
  ) {
    return (
      <EstadoCarga
        tipo="cargando"
        mensaje="Cargando gestión..."
      />
    );
  }

  if (
    gestionQuery.isError ||
    !gestionQuery.data
      ?.gestion
  ) {
    return (
      <EstadoCarga
        tipo="error"
        mensaje={
          gestionQuery.error instanceof Error
            ? gestionQuery.error.message
            : "No se pudo cargar la gestión."
        }
      />
    );
  }

  const gestion =
    gestionQuery.data
      .gestion;

  const valoresIniciales: GestionFormulario =
    {
      anio:
        gestion.anio,

      nombre:
        gestion.nombre,

      descripcion:
        gestion.descripcion ??
        "",

      fechaInicio:
        convertirFechaInput(
          gestion.fechaInicio,
        ),

      fechaFin:
        convertirFechaInput(
          gestion.fechaFin,
        ),

      fechaInicioInscripcion:
        convertirFechaInput(
          gestion.fechaInicioInscripcion,
        ),

      fechaFinInscripcion:
        convertirFechaInput(
          gestion.fechaFinInscripcion,
        ),

      cupoMaximoHombres:
        gestion.cupoMaximoHombres,

      cupoMaximoMujeres:
        gestion.cupoMaximoMujeres,

      estado:
        gestion.estado,
    };

  const guardarCambios =
    async (
      formulario: GestionFormulario,
    ): Promise<void> => {
      await mutation.mutateAsync(
        {
          gestionId,
          formulario,
        },
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
            <CalendarCog className="h-8 w-8" />

            <div>
              <h1 className="text-2xl font-bold">
                Editar gestión
              </h1>

              <p className="text-white/80">
                Actualiza los datos de{" "}
                {gestion.nombre}.
              </p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <GestionForm
            valoresIniciales={
              valoresIniciales
            }
            onSubmit={
              guardarCambios
            }
            isSubmitting={
              mutation.isPending
            }
            textoBoton="Guardar cambios"
          />
        </div>
      </div>
    </div>
  );
}

function EstadoCarga({
  tipo,
  mensaje,
}: {
  tipo:
    | "cargando"
    | "error";

  mensaje:
    string;
}) {
  return (
    <div
      className={`rounded-2xl border p-10 text-center shadow-sm ${
        tipo ===
        "error"
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-[#D8CABB] bg-white text-[#796D70]"
      }`}
    >
      {tipo ===
        "cargando" && (
        <RefreshCw className="mx-auto mb-3 h-8 w-8 animate-spin" />
      )}

      <p className="font-semibold">
        {mensaje}
      </p>
    </div>
  );
}