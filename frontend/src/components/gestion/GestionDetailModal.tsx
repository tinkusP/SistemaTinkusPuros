import {
  CalendarDays,
  CircleX,
  FileText,
  UserRound,
  UsersRound,
} from "lucide-react";
import {
  useEffect,
  type ReactNode,
} from "react";

import type {
  Gestion,
} from "../../types/GestionType";

type GestionDetailModalProps = {
  gestion:
    | Gestion
    | null;
  abierto:
    boolean;
  onCerrar:
    () => void;
};

const obtenerNombreEstado = (
  estado: Gestion["estado"],
): string => {
  const nombres: Record<
    Gestion["estado"],
    string
  > = {
    PLANIFICACION:
      "Planificación",
    INSCRIPCIONES:
      "Inscripciones",
    ACTIVA:
      "Activa",
    CERRADA:
      "Cerrada",
  };

  return nombres[estado];
};

const obtenerClaseEstado = (
  estado: Gestion["estado"],
): string => {
  const clases: Record<
    Gestion["estado"],
    string
  > = {
    PLANIFICACION:
      "bg-slate-100 text-slate-700",
    INSCRIPCIONES:
      "bg-amber-100 text-amber-800",
    ACTIVA:
      "bg-emerald-100 text-emerald-800",
    CERRADA:
      "bg-red-100 text-red-700",
  };

  return clases[estado];
};

const formatearFecha = (
  fecha?: string | null,
): string => {
  if (!fecha) {
    return "No registrada";
  }

  const fechaConvertida =
    new Date(fecha);

  if (
    Number.isNaN(
      fechaConvertida.getTime(),
    )
  ) {
    return "Fecha no válida";
  }

  return new Intl.DateTimeFormat(
    "es-BO",
    {
      year: "numeric",
      month: "long",
      day: "2-digit",
    },
  ).format(
    fechaConvertida,
  );
};

const obtenerNombreUsuarioAuditoria = (
  usuario:
    | Gestion["usuarioCreador"]
    | Gestion["usuarioEdit"],
): string => {
  if (!usuario) {
    return "No registrado";
  }

  if (
    typeof usuario ===
    "string"
  ) {
    return usuario;
  }

  const nombreCompleto = [
    usuario.nombres,
    usuario.apellidoPaterno,
    usuario.apellidoMaterno,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  return (
    nombreCompleto ||
    usuario.email ||
    usuario._id
  );
};

export default function GestionDetailModal({
  gestion,
  abierto,
  onCerrar,
}: GestionDetailModalProps) {
  useEffect(() => {
    if (!abierto) {
      return;
    }

    const cerrarConEscape = (
      event: KeyboardEvent,
    ) => {
      if (
        event.key ===
        "Escape"
      ) {
        onCerrar();
      }
    };

    document.addEventListener(
      "keydown",
      cerrarConEscape,
    );

    const overflowAnterior =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    return () => {
      document.removeEventListener(
        "keydown",
        cerrarConEscape,
      );

      document.body.style.overflow =
        overflowAnterior;
    };
  }, [
    abierto,
    onCerrar,
  ]);

  if (
    !abierto ||
    !gestion
  ) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gestion-detail-title"
      onMouseDown={(
        event,
      ) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onCerrar();
        }
      }}
    >
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-[#F6F0E3] shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between bg-gradient-to-r from-[#74122A] via-[#8F5F2A] to-[#C59A3A] p-6 text-white">
          <div>
            <p className="text-sm text-white/80">
              Información de la gestión
            </p>

            <h2
              id="gestion-detail-title"
              className="text-2xl font-bold"
            >
              {gestion.nombre}
            </h2>
          </div>

          <button
            type="button"
            onClick={onCerrar}
            className="rounded-full p-2 transition hover:bg-white/20"
            aria-label="Cerrar modal"
          >
            <CircleX className="h-7 w-7" />
          </button>
        </div>

        <div className="space-y-6 p-6">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`rounded-full px-4 py-1.5 text-sm font-semibold ${obtenerClaseEstado(
                gestion.estado,
              )}`}
            >
              {obtenerNombreEstado(
                gestion.estado,
              )}
            </span>

            <span className="rounded-full bg-[#E9DDC8] px-4 py-1.5 text-sm font-semibold text-[#74122A]">
              Gestión {gestion.anio}
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <DetalleItem
              icon={<CalendarDays />}
              titulo="Fecha de inicio"
              valor={formatearFecha(
                gestion.fechaInicio,
              )}
            />

            <DetalleItem
              icon={<CalendarDays />}
              titulo="Fecha de finalización"
              valor={formatearFecha(
                gestion.fechaFin,
              )}
            />

            <DetalleItem
              icon={<CalendarDays />}
              titulo="Inicio de inscripciones"
              valor={formatearFecha(
                gestion.fechaInicioInscripcion,
              )}
            />

            <DetalleItem
              icon={<CalendarDays />}
              titulo="Cierre de inscripciones"
              valor={formatearFecha(
                gestion.fechaFinInscripcion,
              )}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <DetalleItem
              icon={<UserRound />}
              titulo="Cupo de hombres"
              valor={`${gestion.cupoMaximoHombres} participantes`}
            />

            <DetalleItem
              icon={<UsersRound />}
              titulo="Cupo de mujeres"
              valor={`${gestion.cupoMaximoMujeres} participantes`}
            />

            <DetalleItem
              icon={<UsersRound />}
              titulo="Cupo total"
              valor={`${gestion.cupoMaximo} participantes`}
              destacado
            />
          </div>

          <div className="rounded-xl border border-[#D8CABB] bg-white p-5">
            <h3 className="mb-2 font-semibold text-[#74122A]">
              Descripción
            </h3>

            <p className="leading-relaxed text-[#4E4548]">
              {gestion.descripcion ||
                "La gestión no tiene una descripción registrada."}
            </p>
          </div>

          <div>
            <h3 className="mb-3 font-semibold text-[#74122A]">
              Auditoría
            </h3>

            <div className="grid gap-4 md:grid-cols-2">
              <DetalleItem
                icon={<FileText />}
                titulo="Fecha de creación"
                valor={formatearFecha(
                  gestion.fechaCreado,
                )}
              />

              <DetalleItem
                icon={<UserRound />}
                titulo="Creado por"
                valor={obtenerNombreUsuarioAuditoria(
                  gestion.usuarioCreador,
                )}
              />

              <DetalleItem
                icon={<FileText />}
                titulo="Última edición"
                valor={formatearFecha(
                  gestion.fechaEdit,
                )}
              />

              <DetalleItem
                icon={<UserRound />}
                titulo="Editado por"
                valor={obtenerNombreUsuarioAuditoria(
                  gestion.usuarioEdit,
                )}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={onCerrar}
              className="rounded-xl border border-[#74122A] px-5 py-2.5 font-semibold text-[#74122A] transition hover:bg-[#74122A] hover:text-white"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

type DetalleItemProps = {
  icon:
    ReactNode;
  titulo:
    string;
  valor:
    string;
  destacado?:
    boolean;
};

function DetalleItem({
  icon,
  titulo,
  valor,
  destacado = false,
}: DetalleItemProps) {
  return (
    <div
      className={`flex gap-3 rounded-xl border p-4 ${
        destacado
          ? "border-[#C59A3A] bg-[#FFF9EA]"
          : "border-[#D8CABB] bg-white"
      }`}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#F1E5CC] text-[#74122A]">
        {icon}
      </div>

      <div>
        <p className="text-sm text-[#796D70]">
          {titulo}
        </p>

        <p className="break-words font-semibold text-[#262022]">
          {valor}
        </p>
      </div>
    </div>
  );
}