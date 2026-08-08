import { zodResolver } from "@hookform/resolvers/zod";
import {
  CalendarDays,
  Save,
  UserRound,
  UsersRound,
} from "lucide-react";
import {
  useEffect,
  type ReactNode,
} from "react";
import {
  useForm,
  useWatch,
  type SubmitHandler,
} from "react-hook-form";

import {
  CrearGestionSchema,
  type GestionFormulario,
} from "../../types/GestionType";

type GestionFormProps = {
  valoresIniciales?: GestionFormulario;
  onSubmit: (
    formulario: GestionFormulario,
  ) => void | Promise<void>;
  isSubmitting?: boolean;
  textoBoton?: string;
};

const valoresPorDefecto: GestionFormulario = {
  anio: new Date().getFullYear(),
  nombre: "",
  descripcion: "",
  fechaInicio: "",
  fechaFin: "",
  fechaInicioInscripcion: "",
  fechaFinInscripcion: "",
  cupoMaximoHombres: 150,
  cupoMaximoMujeres: 150,
  estado: "PLANIFICACION",
};

export default function GestionForm({
  valoresIniciales,
  onSubmit,
  isSubmitting = false,
  textoBoton = "Guardar gestión",
}: GestionFormProps) {
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<GestionFormulario>({
    resolver: zodResolver(
      CrearGestionSchema,
    ),
    defaultValues:
      valoresIniciales ??
      valoresPorDefecto,
  });

  useEffect(() => {
    reset(
      valoresIniciales ??
        valoresPorDefecto,
    );
  }, [valoresIniciales, reset]);

  const cupoMaximoHombres =
    useWatch({
      control,
      name: "cupoMaximoHombres",
    }) ?? 0;

  const cupoMaximoMujeres =
    useWatch({
      control,
      name: "cupoMaximoMujeres",
    }) ?? 0;

  const cupoMaximoTotal =
    Number.isFinite(
      cupoMaximoHombres,
    ) &&
    Number.isFinite(
      cupoMaximoMujeres,
    )
      ? cupoMaximoHombres +
        cupoMaximoMujeres
      : 0;

  const procesarFormulario: SubmitHandler<
    GestionFormulario
  > = async (datos) => {
    const formulario: GestionFormulario = {
      ...datos,
      nombre:
        datos.nombre.trim(),
      descripcion:
        datos.descripcion?.trim() ||
        "",
      fechaInicioInscripcion:
        datos.fechaInicioInscripcion ||
        "",
      fechaFinInscripcion:
        datos.fechaFinInscripcion ||
        "",
      cupoMaximoHombres:
        Number(
          datos.cupoMaximoHombres,
        ),
      cupoMaximoMujeres:
        Number(
          datos.cupoMaximoMujeres,
        ),
    };

    await onSubmit(formulario);
  };

  return (
    <form
      onSubmit={handleSubmit(
        procesarFormulario,
      )}
      className="space-y-6"
      noValidate
    >
      <div className="grid gap-5 md:grid-cols-2">
        <CampoFormulario
          label="Año de gestión"
          error={errors.anio?.message}
          requerido
        >
          <input
            type="number"
            min={2020}
            max={2100}
            {...register("anio", {
              valueAsNumber: true,
            })}
            className="input-gestion"
            placeholder="Ej. 2026"
            disabled={isSubmitting}
          />
        </CampoFormulario>

        <CampoFormulario
          label="Nombre de la gestión"
          error={errors.nombre?.message}
          requerido
        >
          <input
            type="text"
            {...register("nombre")}
            className="input-gestion"
            placeholder="Ej. Gestión 2026"
            disabled={isSubmitting}
          />
        </CampoFormulario>

        <CampoFormulario
          label="Fecha de inicio"
          error={
            errors.fechaInicio?.message
          }
          requerido
        >
          <InputFecha>
            <input
              type="date"
              {...register(
                "fechaInicio",
              )}
              className="input-gestion pl-11"
              disabled={isSubmitting}
            />
          </InputFecha>
        </CampoFormulario>

        <CampoFormulario
          label="Fecha de finalización"
          error={
            errors.fechaFin?.message
          }
          requerido
        >
          <InputFecha>
            <input
              type="date"
              {...register(
                "fechaFin",
              )}
              className="input-gestion pl-11"
              disabled={isSubmitting}
            />
          </InputFecha>
        </CampoFormulario>

        <CampoFormulario
          label="Inicio de inscripciones"
          error={
            errors
              .fechaInicioInscripcion
              ?.message
          }
        >
          <InputFecha>
            <input
              type="date"
              {...register(
                "fechaInicioInscripcion",
              )}
              className="input-gestion pl-11"
              disabled={isSubmitting}
            />
          </InputFecha>
        </CampoFormulario>

        <CampoFormulario
          label="Cierre de inscripciones"
          error={
            errors
              .fechaFinInscripcion
              ?.message
          }
        >
          <InputFecha>
            <input
              type="date"
              {...register(
                "fechaFinInscripcion",
              )}
              className="input-gestion pl-11"
              disabled={isSubmitting}
            />
          </InputFecha>
        </CampoFormulario>

        <CampoFormulario
          label="Cupo máximo de hombres"
          error={
            errors
              .cupoMaximoHombres
              ?.message
          }
          requerido
        >
          <div className="relative">
            <UserRound className="pointer-events-none absolute left-3 top-3.5 h-5 w-5 text-[#8F5F2A]" />

            <input
              type="number"
              min={0}
              {...register(
                "cupoMaximoHombres",
                {
                  valueAsNumber: true,
                },
              )}
              className="input-gestion pl-11"
              placeholder="Ej. 150"
              disabled={isSubmitting}
            />
          </div>
        </CampoFormulario>

        <CampoFormulario
          label="Cupo máximo de mujeres"
          error={
            errors
              .cupoMaximoMujeres
              ?.message
          }
          requerido
        >
          <div className="relative">
            <UsersRound className="pointer-events-none absolute left-3 top-3.5 h-5 w-5 text-[#8F5F2A]" />

            <input
              type="number"
              min={0}
              {...register(
                "cupoMaximoMujeres",
                {
                  valueAsNumber: true,
                },
              )}
              className="input-gestion pl-11"
              placeholder="Ej. 150"
              disabled={isSubmitting}
            />
          </div>
        </CampoFormulario>

        <CampoFormulario
          label="Estado de la gestión"
          error={errors.estado?.message}
          requerido
        >
          <select
            {...register("estado")}
            className="input-gestion"
            disabled={isSubmitting}
          >
            <option value="PLANIFICACION">
              Planificación
            </option>
            <option value="INSCRIPCIONES">
              Inscripciones
            </option>
            <option value="ACTIVA">
              Activa
            </option>
            <option value="CERRADA">
              Cerrada
            </option>
          </select>
        </CampoFormulario>

        <div className="rounded-xl border border-[#D8CABB] bg-white p-4">
          <p className="text-sm font-semibold text-[#796D70]">
            Cupo máximo total
          </p>

          <div className="mt-2 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F1E5CC] text-[#74122A]">
              <UsersRound className="h-6 w-6" />
            </div>

            <div>
              <p className="text-2xl font-bold text-[#74122A]">
                {cupoMaximoTotal}
              </p>

              <p className="text-xs text-[#796D70]">
                Calculado automáticamente
              </p>
            </div>
          </div>
        </div>
      </div>

      <CampoFormulario
        label="Descripción"
        error={errors.descripcion?.message}
      >
        <textarea
          rows={4}
          {...register("descripcion")}
          className="input-gestion resize-none"
          placeholder="Descripción general de la gestión"
          disabled={isSubmitting}
        />
      </CampoFormulario>

      <div className="flex justify-end border-t border-[#D8CABB] pt-5">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 rounded-xl bg-[#74122A] px-6 py-3 font-semibold text-white transition hover:bg-[#5C0E21] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save className="h-5 w-5" />
          {isSubmitting
            ? "Guardando..."
            : textoBoton}
        </button>
      </div>
    </form>
  );
}

type CampoFormularioProps = {
  label: string;
  error?: string;
  requerido?: boolean;
  children: ReactNode;
};

function CampoFormulario({
  label,
  error,
  requerido = false,
  children,
}: CampoFormularioProps) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-[#262022]">
        {label}

        {requerido && (
          <span className="ml-1 text-red-600">
            *
          </span>
        )}
      </label>

      {children}

      {error && (
        <p className="mt-1 text-sm font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

function InputFecha({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="relative">
      <CalendarDays className="pointer-events-none absolute left-3 top-3.5 h-5 w-5 text-[#8F5F2A]" />
      {children}
    </div>
  );
}