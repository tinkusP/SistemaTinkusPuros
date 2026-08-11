import {
  useEffect,
  useState,
} from "react";

import {
  useForm,
} from "react-hook-form";

import {
  zodResolver,
} from "@hookform/resolvers/zod";

import {
  z,
} from "zod";
import { GRUPOS_PERMISOS, VISTAS_REQUERIDAS_POR_ACCION } from "@/security/permisosCatalogo";

export const RolFormularioSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(
      2,
      "El nombre debe tener al menos 2 caracteres",
    ),

  codigo: z
    .string()
    .trim()
    .min(
      2,
      "El código debe tener al menos 2 caracteres",
    )
    .regex(
      /^[A-Za-z0-9_]+$/,
      "Solo se permiten letras, números y guion bajo",
    )
    .transform(
      (valor) =>
        valor.toUpperCase(),
    ),

  descripcion: z
    .string()
    .trim()
    .max(
      500,
      "La descripción no puede superar 500 caracteres",
    )
    .optional()
    .or(
      z.literal(""),
    ),

  permisos: z
    .array(
      z
        .string()
        .trim()
        .min(
          1,
          "El permiso no puede estar vacío",
        )
        .transform(
          (valor) =>
            valor.toUpperCase(),
        ),
    )
    .default([]),

  estado: z
    .boolean()
    .default(true),

  esRolSistema: z
    .boolean()
    .default(false),
});

export type RolFormularioValores =
  z.input<
    typeof RolFormularioSchema
  >;

export type RolFormularioPayload =
  z.output<
    typeof RolFormularioSchema
  >;

type RolFormProps = {
  valoresIniciales?: Partial<RolFormularioValores>;
  enviando?: boolean;
  textoBoton?: string;
  onSubmit: (
    valores: RolFormularioPayload,
  ) => void | Promise<void>;
  onCancelar?: () => void;
};

const valoresPorDefecto: RolFormularioValores = {
  nombre: "",
  codigo: "",
  descripcion: "",
  permisos: [],
  estado: true,
  esRolSistema: false,
};

export default function RolForm({
  valoresIniciales,
  enviando = false,
  textoBoton = "Guardar rol",
  onSubmit,
  onCancelar,
}: RolFormProps) {
  const [
    permisoNuevo,
    setPermisoNuevo,
  ] = useState("");
  const [modalPermisos,setModalPermisos]=useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: {
      errors,
    },
  } = useForm<RolFormularioValores>({
    resolver:
      zodResolver(
        RolFormularioSchema,
      ),
    defaultValues: {
      ...valoresPorDefecto,
      ...valoresIniciales,
    },
  });

  useEffect(() => {
    reset({
      ...valoresPorDefecto,
      ...valoresIniciales,
      permisos:
        valoresIniciales?.permisos ||
        [],
    });
  }, [
    valoresIniciales,
    reset,
  ]);

  const permisos =
    watch("permisos") || [];

  const agregarPermiso = () => {
    const permisoNormalizado =
      permisoNuevo
        .trim()
        .toUpperCase()
        .replace(
          /\s+/g,
          "_",
        );

    if (!permisoNormalizado) {
      return;
    }

    if (
      permisos.includes(
        permisoNormalizado,
      )
    ) {
      setPermisoNuevo("");
      return;
    }

    setValue(
      "permisos",
      [
        ...permisos,
        permisoNormalizado,
      ],
      {
        shouldDirty: true,
        shouldValidate: true,
      },
    );

    setPermisoNuevo("");
  };

  const eliminarPermiso = (
    permisoEliminar: string,
  ) => {
    setValue(
      "permisos",
      permisos.filter(
        (permiso) =>
          permiso !==
          permisoEliminar,
      ),
      {
        shouldDirty: true,
        shouldValidate: true,
      },
    );
  };

  const cambiarPermisoCatalogo = (codigo: string, seleccionado: boolean) => {
    const siguientes = new Set(permisos);
    if (seleccionado) {
      siguientes.add(codigo);
      for (const vista of VISTAS_REQUERIDAS_POR_ACCION[codigo] ?? []) siguientes.add(vista);
    } else {
      siguientes.delete(codigo);
      if (codigo.startsWith("VISTA_")) {
        for (const [accion, vistas] of Object.entries(VISTAS_REQUERIDAS_POR_ACCION)) {
          if (vistas.includes(codigo)) siguientes.delete(accion);
        }
      }
    }
    setValue("permisos", Array.from(siguientes), { shouldDirty: true, shouldValidate: true });
  };

  const agregarPermisosPegados = (
    texto: string,
  ) => {
    const nuevosPermisos =
      texto
        .split(
          /[\n,;]+/,
        )
        .map(
          (permiso) =>
            permiso
              .trim()
              .toUpperCase()
              .replace(
                /\s+/g,
                "_",
              ),
        )
        .filter(Boolean);

    if (
      nuevosPermisos.length ===
      0
    ) {
      return;
    }

    const permisosUnicos =
      Array.from(
        new Set([
          ...permisos,
          ...nuevosPermisos,
        ]),
      );

    setValue(
      "permisos",
      permisosUnicos,
      {
        shouldDirty: true,
        shouldValidate: true,
      },
    );
  };

  return (
    <form
      onSubmit={handleSubmit(
        async (
          valores,
        ) => {
          const datos =
            RolFormularioSchema.parse(
              valores,
            );

          await onSubmit(
            datos,
          );
        },
      )}
      className="space-y-6"
    >
      <section className="rounded-3xl border border-[#B7A7A0] bg-[#F6F0E3] p-5 shadow-sm dark:border-[#B7A7A0]/30 dark:bg-[#262022] sm:p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#74122A] dark:text-[#C59A3A]">
            Información principal
          </p>

          <h2 className="mt-1 text-xl font-black">
            Datos del rol
          </h2>
        </div>

        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <div>
            <label
              htmlFor="nombre"
              className="mb-2 block text-sm font-bold"
            >
              Nombre
            </label>

            <input
              id="nombre"
              type="text"
              placeholder="Ejemplo: Postulante"
              {...register(
                "nombre",
              )}
              className="w-full rounded-xl border border-[#B7A7A0] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#74122A] focus:ring-4 focus:ring-[#C59A3A]/20 dark:bg-[#262022]"
            />

            {errors.nombre && (
              <p className="mt-1 text-xs text-[#74122A]">
                {
                  errors.nombre
                    .message
                }
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="codigo"
              className="mb-2 block text-sm font-bold"
            >
              Código
            </label>

            <input
              id="codigo"
              type="text"
              placeholder="Ejemplo: POSTULANTE"
              {...register(
                "codigo",
              )}
              className="w-full rounded-xl border border-[#B7A7A0] bg-white px-4 py-3 text-sm uppercase outline-none transition focus:border-[#74122A] focus:ring-4 focus:ring-[#C59A3A]/20 dark:bg-[#262022]"
            />

            {errors.codigo && (
              <p className="mt-1 text-xs text-[#74122A]">
                {
                  errors.codigo
                    .message
                }
              </p>
            )}
          </div>

          <div className="md:col-span-2">
            <label
              htmlFor="descripcion"
              className="mb-2 block text-sm font-bold"
            >
              Descripción
            </label>

            <textarea
              id="descripcion"
              rows={4}
              placeholder="Describe las funciones principales del rol..."
              {...register(
                "descripcion",
              )}
              className="w-full resize-none rounded-xl border border-[#B7A7A0] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#74122A] focus:ring-4 focus:ring-[#C59A3A]/20 dark:bg-[#262022]"
            />
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-[#B7A7A0]/70 p-4">
            <span>
              <span className="block text-sm font-bold">
                Rol activo
              </span>

              <span className="mt-1 block text-xs text-[#B7A7A0]">
                Permite asignar y utilizar este rol.
              </span>
            </span>

            <input
              type="checkbox"
              {...register(
                "estado",
              )}
              className="h-5 w-5 accent-[#74122A]"
            />
          </label>

          <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-[#B7A7A0]/70 p-4">
            <span>
              <span className="block text-sm font-bold">
                Rol del sistema
              </span>

              <span className="mt-1 block text-xs text-[#B7A7A0]">
                Marca roles protegidos o esenciales.
              </span>
            </span>

            <input
              type="checkbox"
              {...register(
                "esRolSistema",
              )}
              className="h-5 w-5 accent-[#74122A]"
            />
          </label>
        </div>
      </section>

      <section className="rounded-3xl border border-[#B7A7A0] bg-[#F6F0E3] p-5 shadow-sm dark:border-[#B7A7A0]/30 dark:bg-[#262022] sm:p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#74122A] dark:text-[#C59A3A]">
            Seguridad
          </p>

          <h2 className="mt-1 text-xl font-black">
            Permisos del rol
          </h2>

          <p className="mt-2 text-sm text-[#B7A7A0]">
            Selecciona las vistas y acciones permitidas desde el catálogo seguro.
          </p>
        </div>

        <button type="button" onClick={()=>setModalPermisos(true)} className="mt-5 w-full rounded-xl bg-[#74122A] px-5 py-3 font-bold text-white">Seleccionar vistas y acciones ({permisos.length})</button>

        <div className="hidden mt-5 flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={
              permisoNuevo
            }
            onChange={(
              event,
            ) =>
              setPermisoNuevo(
                event.target.value,
              )
            }
            onKeyDown={(
              event,
            ) => {
              if (
                event.key ===
                "Enter"
              ) {
                event.preventDefault();
                agregarPermiso();
              }
            }}
            placeholder="Ejemplo: PERFIL_PROPIO_VER"
            className="min-w-0 flex-1 rounded-xl border border-[#B7A7A0] bg-white px-4 py-3 text-sm uppercase outline-none transition focus:border-[#74122A] focus:ring-4 focus:ring-[#C59A3A]/20 dark:bg-[#262022]"
          />

          <button
            type="button"
            onClick={
              agregarPermiso
            }
            className="rounded-xl bg-[#74122A] px-5 py-3 text-sm font-bold text-[#F6F0E3] transition hover:bg-[#5E0E22]"
          >
            Agregar permiso
          </button>
        </div>

        <div className="hidden mt-4">
          <label
            htmlFor="permisosPegados"
            className="mb-2 block text-sm font-bold"
          >
            Agregar varios permisos
          </label>

          <textarea
            id="permisosPegados"
            rows={4}
            placeholder={`PERFIL_PROPIO_VER
PERFIL_PROPIO_EDITAR
POSTULACION_PROPIA_VER`}
            onBlur={(
              event,
            ) => {
              agregarPermisosPegados(
                event.target.value,
              );

              event.target.value =
                "";
            }}
            className="w-full resize-none rounded-xl border border-[#B7A7A0] bg-white px-4 py-3 font-mono text-sm uppercase outline-none transition focus:border-[#74122A] focus:ring-4 focus:ring-[#C59A3A]/20 dark:bg-[#262022]"
          />

          <p className="mt-1 text-xs text-[#B7A7A0]">
            Puedes separar los permisos por salto de línea, coma o punto y coma. Se agregan al salir del campo.
          </p>
        </div>

        {permisos.length ===
        0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-[#B7A7A0] p-6 text-center text-sm text-[#B7A7A0]">
            Todavía no agregaste permisos.
          </div>
        ) : (
          <div className="mt-5 flex flex-wrap gap-2">
            {permisos.map(
              (permiso) => (
                <span
                  key={permiso}
                  className="inline-flex items-center gap-2 rounded-full bg-[#C59A3A]/20 px-3 py-2 text-xs font-bold text-[#74122A] dark:text-[#C59A3A]"
                >
                  {permiso}

                  <button
                    type="button"
                    onClick={() =>
                      eliminarPermiso(
                        permiso,
                      )
                    }
                    className="grid h-5 w-5 place-items-center rounded-full bg-[#74122A] text-[10px] text-[#F6F0E3]"
                    aria-label={`Eliminar permiso ${permiso}`}
                  >
                    ✕
                  </button>
                </span>
              ),
            )}
          </div>
        )}

        {errors.permisos && (
          <p className="mt-2 text-xs text-[#74122A]">
            {
              errors.permisos
                .message
            }
          </p>
        )}
      </section>

      {modalPermisos && <div className="fixed inset-0 z-[150] grid place-items-center overflow-y-auto bg-black/70 p-3"><section className="relative max-h-[calc(100dvh-1.5rem)] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white p-5 text-[#262022] shadow-2xl sm:p-7"><button type="button" aria-label="Cerrar" onClick={() => setModalPermisos(false)} className="sticky left-full top-0 z-10 grid h-10 w-10 place-items-center rounded-full bg-slate-100 font-black">✕</button><div className="-mt-10 pr-12"><p className="text-xs font-bold uppercase tracking-widest text-[#8F5F2A]">Seguridad del rol</p><h2 className="text-2xl font-black text-[#74122A]">Vistas y acciones permitidas</h2><p className="mt-1 text-sm text-slate-500">Primero concede la vista. Las acciones permiten crear, editar, aprobar o eliminar. Al marcar una acción, su vista se activa automáticamente.</p></div><div className="mt-6 space-y-5">{GRUPOS_PERMISOS.map((grupo) => <fieldset key={grupo.grupo} className="rounded-2xl border p-4"><legend className="px-2 font-black text-[#74122A]">{grupo.grupo}</legend><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{grupo.items.map(([codigo, nombre]) => <label key={codigo} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${permisos.includes(codigo) ? "border-[#841534] bg-[#841534]/10" : "bg-white"}`}><input type="checkbox" checked={permisos.includes(codigo)} onChange={(evento) => cambiarPermisoCatalogo(codigo, evento.target.checked)} className="mt-1 h-4 w-4 accent-[#841534]"/><span><b className="block text-sm">{nombre}</b><small className="text-[10px] text-slate-500">{codigo}</small></span></label>)}</div></fieldset>)}</div><div className="sticky bottom-0 mt-6 flex justify-end border-t bg-white pt-4"><button type="button" onClick={() => setModalPermisos(false)} className="rounded-xl bg-[#74122A] px-6 py-3 font-bold text-white">Aplicar selección</button></div></section></div>}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        {onCancelar && (
          <button
            type="button"
            onClick={
              onCancelar
            }
            disabled={enviando}
            className="rounded-xl border border-[#B7A7A0] px-5 py-3 text-sm font-bold transition hover:bg-[#B7A7A0]/15 disabled:opacity-50"
          >
            Cancelar
          </button>
        )}

        <button
          type="submit"
          disabled={enviando}
          className="rounded-xl bg-[#74122A] px-6 py-3 text-sm font-bold text-[#F6F0E3] transition hover:bg-[#5E0E22] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {enviando
            ? "Guardando..."
            : textoBoton}
        </button>
      </div>
    </form>
  );
}
