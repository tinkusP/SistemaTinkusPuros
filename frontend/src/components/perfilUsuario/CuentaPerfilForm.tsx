import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";

import {
  Camera,
  Check,
  Eye,
  EyeOff,
  FileImage,
  FileText,
  GraduationCap,
  LoaderCircle,
  Save,
  ShieldCheck,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";

import type {
  Gestion,
} from "@/types/GestionType";

import type {
  PerfilUsuarioForm as PerfilUsuarioRegistroPayload,
  TipoFraterno,
  TipoOrigen,
} from "@/types/PerfilUsuarioType";

import type {
  RolOption,
} from "@/types/RolType";

import {
  comprimirImagen,
} from "@/utils/comprimirImagen";
import { CARRERAS_FCPN, FACULTAD_FCPN, OPCIONES_ORIGEN_ACADEMICO } from "@/constants/origenAcademico";

/* =========================================
   MODOS DE USO
========================================= */

export type PerfilUsuarioFormModo =
  | "REGISTRO_PUBLICO"
  | "CREAR_ADMIN"
  | "EDITAR_ADMIN"
  | "EDITAR_PERSONAL";

/* =========================================
   DATOS INTERNOS DEL FORMULARIO
========================================= */

export type PerfilUsuarioFormData = {
  roles: string[];
  gestion: string[];

  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;

  ci: string;
  complementoCi: string;
  expedidoCi: string;

  fechaNacimiento: string;
  sexo: string;

  telefono: string;
  email: string;

  tipoOrigen: TipoOrigen;
  tipoFraterno: TipoFraterno;

  registroUniversitario: string;
  facultad: string;
  carrera: string;

  password: string;
  confirmarPassword: string;

  fotoPerfil: File | null;
  carnetIdentidadPdf: File | null;
  registroUniversitarioPdf: File | null;
};

export const valoresInicialesPerfilUsuario:
  PerfilUsuarioFormData = {
    roles: [],
    gestion: [],

    nombres: "",
    apellidoPaterno: "",
    apellidoMaterno: "",

    ci: "",
    complementoCi: "",
    expedidoCi: "",

    fechaNacimiento: "",
    sexo: "",

    telefono: "",
    email: "",

    tipoOrigen: "INTERNO_UMSA",
    tipoFraterno: "NUEVO",

    registroUniversitario: "",
    facultad: "",
    carrera: "",

    password: "",
    confirmarPassword: "",

    fotoPerfil: null,
    carnetIdentidadPdf: null,
    registroUniversitarioPdf: null,
  };

/* =========================================
   CONVERTIR A PAYLOAD DE REGISTRO
========================================= */

export function construirPayloadRegistro(
  datos: PerfilUsuarioFormData,
): PerfilUsuarioRegistroPayload {
  if (
    !datos.carnetIdentidadPdf ||
    !datos.registroUniversitarioPdf
  ) {
    throw new Error(
      "Debe seleccionar el carnet de identidad y el registro universitario en PDF",
    );
  }

  return {
    roles:
      datos.roles,

    gestion:
      datos.gestion,

    nombres:
      datos.nombres.trim(),

    apellidoPaterno:
      datos.apellidoPaterno.trim(),

    apellidoMaterno:
      datos.apellidoMaterno.trim() ||
      undefined,

    ci:
      datos.ci.trim(),

    complementoCi:
      datos.complementoCi.trim() ||
      undefined,

    expedidoCi:
      datos.expedidoCi.trim() ||
      undefined,

    fechaNacimiento:
      datos.fechaNacimiento ||
      undefined,

    sexo:
      datos.sexo ||
      undefined,

    telefono:
      datos.telefono.trim(),

    email:
      datos.email
        .trim()
        .toLowerCase(),

    tipoOrigen:
      datos.tipoOrigen,

    tipoFraterno:
      datos.tipoFraterno,

    registroUniversitario:
      datos.registroUniversitario.trim(),

    facultad:
      datos.facultad.trim() ||
      undefined,

    carrera:
      datos.carrera.trim() ||
      undefined,

    password:
      datos.password,

    fotoPerfil:
      datos.fotoPerfil,

    carnetIdentidadPdf:
      datos.carnetIdentidadPdf,

    registroUniversitarioPdf:
      datos.registroUniversitarioPdf,
  };
}

/* =========================================
   PROPS
========================================= */

type PerfilUsuarioFormProps = {
  modo: PerfilUsuarioFormModo;

  valoresIniciales?:
    Partial<PerfilUsuarioFormData>;

  roles?: RolOption[];
  gestiones?: Gestion[];

  fotoActual?: string | null;

  onSubmit: (
    datos: PerfilUsuarioFormData,
  ) => void | Promise<void>;

  cancelar?: () => void;

  guardando?: boolean;
  textoBoton?: string;
};

const MAX_PDF_BYTES =
  15 * 1024 * 1024;

const esModoCrear = (
  modo: PerfilUsuarioFormModo,
): boolean =>
  modo === "REGISTRO_PUBLICO" ||
  modo === "CREAR_ADMIN";

const esModoAdmin = (
  modo: PerfilUsuarioFormModo,
): boolean =>
  modo === "CREAR_ADMIN" ||
  modo === "EDITAR_ADMIN";

/* =========================================
   COMPONENTE
========================================= */

export default function PerfilUsuarioForm({
  modo,
  valoresIniciales,
  roles = [],
  gestiones = [],
  fotoActual = null,
  onSubmit,
  cancelar,
  guardando = false,
  textoBoton,
}: PerfilUsuarioFormProps) {
  const valoresCombinados =
    useMemo(
      () => ({
        ...valoresInicialesPerfilUsuario,
        ...valoresIniciales,

        roles:
          valoresIniciales?.roles ??
          valoresInicialesPerfilUsuario.roles,

        gestion:
          valoresIniciales?.gestion ??
          valoresInicialesPerfilUsuario.gestion,
      }),
      [
        valoresIniciales,
      ],
    );

  const [
    formData,
    setFormData,
  ] =
    useState<PerfilUsuarioFormData>(
      valoresCombinados,
    );

  const [
    errores,
    setErrores,
  ] =
    useState<
      Partial<
        Record<
          keyof PerfilUsuarioFormData,
          string
        >
      >
    >({});

  const [
    mostrarPassword,
    setMostrarPassword,
  ] =
    useState(false);

  const [
    mostrarConfirmacion,
    setMostrarConfirmacion,
  ] =
    useState(false);

  const [
    procesandoImagen,
    setProcesandoImagen,
  ] =
    useState(false);

  const [
    preview,
    setPreview,
  ] =
    useState<string | null>(
      fotoActual,
    );

  useEffect(() => {
    setFormData(
      valoresCombinados,
    );

    setErrores({});
  }, [
    valoresCombinados,
  ]);

  useEffect(() => {
    if (!formData.fotoPerfil) {
      setPreview(
        fotoActual,
      );

      return;
    }

    const url =
      URL.createObjectURL(
        formData.fotoPerfil,
      );

    setPreview(url);

    return () => {
      URL.revokeObjectURL(
        url,
      );
    };
  }, [
    formData.fotoPerfil,
    fotoActual,
  ]);

  const actualizarCampo = <
    K extends keyof PerfilUsuarioFormData,
  >(
    campo: K,
    valor: PerfilUsuarioFormData[K],
  ) => {
    setFormData(
      (actual) => ({
        ...actual,
        [campo]:
          valor,
      }),
    );

    setErrores(
      (actual) => ({
        ...actual,
        [campo]:
          undefined,
      }),
    );
  };

  const seleccionarImagen = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const archivo =
      event.target.files?.[0];

    event.target.value =
      "";

    if (!archivo) {
      return;
    }

    const tiposPermitidos = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (
      !tiposPermitidos.includes(
        archivo.type,
      )
    ) {
      setErrores(
        (actual) => ({
          ...actual,
          fotoPerfil:
            "Solo se permiten imágenes JPG, PNG o WebP",
        }),
      );

      return;
    }

    try {
      setProcesandoImagen(
        true,
      );

      const imagenComprimida =
        await comprimirImagen(
          archivo,
          {
            anchoMaximo:
              1200,

            altoMaximo:
              1200,

            calidad:
              0.72,
          },
        );

      actualizarCampo(
        "fotoPerfil",
        imagenComprimida,
      );
    } catch (error) {
      setErrores(
        (actual) => ({
          ...actual,
          fotoPerfil:
            error instanceof Error
              ? error.message
              : "No se pudo procesar la imagen",
        }),
      );
    } finally {
      setProcesandoImagen(
        false,
      );
    }
  };

  const seleccionarPdf = (
    campo:
      | "carnetIdentidadPdf"
      | "registroUniversitarioPdf",
  ) =>
    (
      event: ChangeEvent<HTMLInputElement>,
    ) => {
      const archivo =
        event.target.files?.[0];

      event.target.value =
        "";

      if (!archivo) {
        return;
      }

      const esPdf =
        archivo.type ===
          "application/pdf" ||
        archivo.name
          .toLowerCase()
          .endsWith(
            ".pdf",
          );

      if (!esPdf) {
        setErrores(
          (actual) => ({
            ...actual,
            [campo]:
              "Debe seleccionar un archivo PDF",
          }),
        );

        return;
      }

      if (
        archivo.size >
        MAX_PDF_BYTES
      ) {
        setErrores(
          (actual) => ({
            ...actual,
            [campo]:
              "El PDF no puede superar 15 MB",
          }),
        );

        return;
      }

      actualizarCampo(
        campo,
        archivo,
      );
    };

  const alternarRol = (
    rolId: string,
  ) => {
    const existe =
      formData.roles.includes(
        rolId,
      );

    actualizarCampo(
      "roles",
      existe
        ? formData.roles.filter(
            (id) =>
              id !==
              rolId,
          )
        : [
            ...formData.roles,
            rolId,
          ],
    );
  };

  const validarFormulario =
    (): boolean => {
      const nuevosErrores:
        Partial<
          Record<
            keyof PerfilUsuarioFormData,
            string
          >
        > = {};

      if (
        formData.roles.length ===
        0
      ) {
        nuevosErrores.roles =
          "Debe asignar al menos un rol";
      }

      if (
        formData.gestion.length ===
        0
      ) {
        nuevosErrores.gestion =
          "Debe asignar una gestión";
      }

      if (
        !formData.nombres.trim()
      ) {
        nuevosErrores.nombres =
          "Los nombres son obligatorios";
      }

      if (
        !formData.apellidoPaterno.trim()
      ) {
        nuevosErrores.apellidoPaterno =
          "El apellido paterno es obligatorio";
      }

      if (
        !formData.ci.trim()
      ) {
        nuevosErrores.ci =
          "El carnet de identidad es obligatorio";
      }

      if (
        !formData.telefono.trim()
      ) {
        nuevosErrores.telefono =
          "El teléfono es obligatorio";
      }

      if (
        !formData.email.trim()
      ) {
        nuevosErrores.email =
          "El correo es obligatorio";
      } else if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
          formData.email,
        )
      ) {
        nuevosErrores.email =
          "El correo no tiene un formato válido";
      }

      /*
       * El controlador actual exige el RU
       * para toda cuenta, incluso EXTERNO.
       */
      if (formData.tipoOrigen !== "EXTERNO_NO_UMSA" && !formData.registroUniversitario.trim()) {
        nuevosErrores.registroUniversitario =
          "El registro universitario es obligatorio";
      }

      if (
        formData.tipoOrigen === "INTERNO_UMSA" || formData.tipoOrigen === "EXTERNO_UMSA"
      ) {
        if (
          !formData.facultad.trim()
        ) {
          nuevosErrores.facultad =
            "La facultad es obligatoria para usuarios internos";
        }

        if (
          !formData.carrera.trim()
        ) {
          nuevosErrores.carrera =
            "La carrera es obligatoria para usuarios internos";
        }
      }

      if (
        esModoCrear(
          modo,
        )
      ) {
        if (
          formData.password.length <
          8
        ) {
          nuevosErrores.password =
            "La contraseña debe tener al menos 8 caracteres";
        }

        if (
          formData.password !==
          formData.confirmarPassword
        ) {
          nuevosErrores.confirmarPassword =
            "Las contraseñas no coinciden";
        }

        if (
          !formData.carnetIdentidadPdf
        ) {
          nuevosErrores.carnetIdentidadPdf =
            "Debe adjuntar el carnet de identidad en PDF";
        }

        if (
          !formData.registroUniversitarioPdf
        ) {
          nuevosErrores.registroUniversitarioPdf =
            "Debe adjuntar el registro universitario en PDF";
        }
      }

      setErrores(
        nuevosErrores,
      );

      return (
        Object.keys(
          nuevosErrores,
        ).length ===
        0
      );
    };

  const enviarFormulario =
    async (
      event: FormEvent<HTMLFormElement>,
    ) => {
      event.preventDefault();

      if (
        !validarFormulario()
      ) {
        return;
      }

      await onSubmit(
        formData,
      );
    };

  const mostrarRelaciones =
    esModoAdmin(
      modo,
    );

  return (
    <form
      onSubmit={
        enviarFormulario
      }
      className="space-y-7"
      noValidate
    >
      {/* FOTO */}

      <SeccionFormulario
        titulo="Fotografía de perfil"
        descripcion="La fotografía es opcional y será convertida a WebP por el sistema."
        icono={
          <Camera />
        }
      >
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="relative mx-auto h-32 w-32 shrink-0 sm:mx-0">
            <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-3xl border-4 border-white bg-gradient-to-br from-fuchsia-100 via-yellow-50 to-cyan-100 shadow-lg">
              {preview ? (
                <img
                  src={
                    preview
                  }
                  alt="Vista previa del perfil"
                  className="h-full w-full object-cover"
                />
              ) : (
                <UserRound className="h-14 w-14 text-fuchsia-500" />
              )}
            </div>

            <label className="absolute -bottom-2 -right-2 flex h-11 w-11 cursor-pointer items-center justify-center rounded-2xl bg-fuchsia-600 text-white shadow-lg transition hover:bg-fuchsia-700">
              {procesandoImagen ? (
                <LoaderCircle className="h-5 w-5 animate-spin" />
              ) : (
                <Camera className="h-5 w-5" />
              )}

              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={
                  guardando ||
                  procesandoImagen
                }
                onChange={
                  seleccionarImagen
                }
                className="hidden"
              />
            </label>
          </div>

          <div className="flex-1">
            <p className="text-sm leading-6 text-slate-500">
              Formatos permitidos: JPG, PNG y WebP.
            </p>

            {formData.fotoPerfil && (
              <ArchivoSeleccionado
                nombre={
                  formData.fotoPerfil.name
                }
                tamano={
                  formData.fotoPerfil.size
                }
                onQuitar={() =>
                  actualizarCampo(
                    "fotoPerfil",
                    null,
                  )
                }
              />
            )}

            <MensajeError
              mensaje={
                errores.fotoPerfil
              }
            />
          </div>
        </div>
      </SeccionFormulario>

      {/* RELACIONES ADMINISTRATIVAS */}

      {mostrarRelaciones && (
        <SeccionFormulario
          titulo="Asignación administrativa"
          descripcion="Selecciona los roles y la gestión del usuario."
          icono={
            <ShieldCheck />
          }
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <p className="mb-3 text-sm font-bold text-slate-700">
                Roles asignados
                <span className="ml-1 text-red-500">
                  *
                </span>
              </p>

              <div className="grid gap-2">
                {roles.map(
                  (rol) => {
                    const seleccionado =
                      formData.roles.includes(
                        rol._id,
                      );

                    return (
                      <button
                        key={
                          rol._id
                        }
                        type="button"
                        onClick={() =>
                          alternarRol(
                            rol._id,
                          )
                        }
                        className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                          seleccionado
                            ? "border-[#841534] bg-[#fff1f4]"
                            : "border-slate-200 bg-slate-50 hover:bg-white"
                        }`}
                      >
                        <span>
                          <span className="block text-sm font-bold text-slate-800">
                            {
                              rol.nombre
                            }
                          </span>

                          <span className="text-xs text-slate-500">
                            {
                              rol.codigo
                            }
                          </span>
                        </span>

                        {seleccionado && (
                          <Check className="h-5 w-5 text-[#841534]" />
                        )}
                      </button>
                    );
                  },
                )}
              </div>

              <MensajeError
                mensaje={
                  errores.roles
                }
              />
            </div>

            <div>
              <Seleccion
                label="Gestión"
                value={
                  formData.gestion[0] ??
                  ""
                }
                onChange={(
                  valor,
                ) =>
                  actualizarCampo(
                    "gestion",
                    valor
                      ? [
                          valor,
                        ]
                      : [],
                  )
                }
                required
                opciones={[
                  {
                    value:
                      "",
                    label:
                      "Seleccionar gestión",
                  },

                  ...gestiones.map(
                    (
                      gestion,
                    ) => ({
                      value:
                        gestion._id,

                      label:
                        `${gestion.nombre} (${gestion.estado})`,
                    }),
                  ),
                ]}
                error={
                  errores.gestion
                }
              />
            </div>
          </div>
        </SeccionFormulario>
      )}

      {/* DATOS PERSONALES */}

      <SeccionFormulario
        titulo="Datos personales"
        descripcion="Información personal del usuario."
        icono={
          <UserRound />
        }
      >
        <div className="grid gap-5 md:grid-cols-2">
          <Campo
            label="Nombres"
            value={
              formData.nombres
            }
            onChange={(
              valor,
            ) =>
              actualizarCampo(
                "nombres",
                valor,
              )
            }
            error={
              errores.nombres
            }
            required
          />

          <Campo
            label="Apellido paterno"
            value={
              formData.apellidoPaterno
            }
            onChange={(
              valor,
            ) =>
              actualizarCampo(
                "apellidoPaterno",
                valor,
              )
            }
            error={
              errores.apellidoPaterno
            }
            required
          />

          <Campo
            label="Apellido materno"
            value={
              formData.apellidoMaterno
            }
            onChange={(
              valor,
            ) =>
              actualizarCampo(
                "apellidoMaterno",
                valor,
              )
            }
          />

          <Campo
            label="Fecha de nacimiento"
            type="date"
            value={
              formData.fechaNacimiento
            }
            onChange={(
              valor,
            ) =>
              actualizarCampo(
                "fechaNacimiento",
                valor,
              )
            }
          />

          <Seleccion
            label="Género"
            value={
              formData.sexo
            }
            onChange={(
              valor,
            ) =>
              actualizarCampo(
                "sexo",
                valor,
              )
            }
            opciones={[
              {
                value:
                  "",
                label:
                  "Seleccionar",
              },
              {
                value:
                  "MASCULINO",
                label:
                  "Masculino",
              },
              {
                value:
                  "FEMENINO",
                label:
                  "Femenino",
              },
              {
                value:
                  "OTRO",
                label:
                  "Otro",
              },
            ]}
          />
        </div>
      </SeccionFormulario>

      {/* IDENTIDAD */}

      <SeccionFormulario
        titulo="Documento de identidad"
        descripcion="Información escrita y archivo PDF del carnet."
        icono={
          <FileText />
        }
      >
        <div className="grid gap-5 md:grid-cols-3">
          <Campo
            label="Carnet de identidad"
            value={
              formData.ci
            }
            onChange={(
              valor,
            ) =>
              actualizarCampo(
                "ci",
                valor,
              )
            }
            error={
              errores.ci
            }
            required
          />

          <Campo
            label="Complemento"
            value={
              formData.complementoCi
            }
            onChange={(
              valor,
            ) =>
              actualizarCampo(
                "complementoCi",
                valor,
              )
            }
            placeholder="Ejemplo: 1A"
          />

          <Campo
            label="Expedido"
            value={
              formData.expedidoCi
            }
            onChange={(
              valor,
            ) =>
              actualizarCampo(
                "expedidoCi",
                valor,
              )
            }
            placeholder="LP"
          />
        </div>

        {esModoCrear(
          modo,
        ) && (
          <div className="mt-5">
            <SelectorArchivo
              titulo="Carnet de identidad en PDF"
              descripcion="Archivo obligatorio. Máximo 15 MB."
              archivo={
                formData.carnetIdentidadPdf
              }
              onSeleccionar={
                seleccionarPdf(
                  "carnetIdentidadPdf",
                )
              }
              onQuitar={() =>
                actualizarCampo(
                  "carnetIdentidadPdf",
                  null,
                )
              }
              error={
                errores.carnetIdentidadPdf
              }
            />
          </div>
        )}
      </SeccionFormulario>

      {/* CONTACTO */}

      <SeccionFormulario
        titulo="Datos de contacto"
        descripcion="Información de acceso y comunicación."
        icono={
          <Users />
        }
      >
        <div className="grid gap-5 md:grid-cols-2">
          <Campo
            label="Teléfono"
            value={
              formData.telefono
            }
            onChange={(
              valor,
            ) =>
              actualizarCampo(
                "telefono",
                valor,
              )
            }
            error={
              errores.telefono
            }
            required
          />

          <Campo
            label="Correo electrónico"
            type="email"
            value={
              formData.email
            }
            onChange={(
              valor,
            ) =>
              actualizarCampo(
                "email",
                valor,
              )
            }
            error={
              errores.email
            }
            required
          />
        </div>
      </SeccionFormulario>

      {/* UNIVERSITARIO */}

      <SeccionFormulario
        titulo="Información universitaria"
        descripcion="Datos académicos y respaldo PDF del registro universitario."
        icono={
          <GraduationCap />
        }
      >
        <div className="grid gap-5 md:grid-cols-2">
          <Seleccion
            label="Origen"
            value={
              formData.tipoOrigen
            }
            onChange={(valor) => {
              const origen = valor as TipoOrigen;
              actualizarCampo("tipoOrigen", origen);
              if (origen === "INTERNO_UMSA") {
                actualizarCampo("facultad", FACULTAD_FCPN);
                if (!CARRERAS_FCPN.includes(formData.carrera as typeof CARRERAS_FCPN[number])) actualizarCampo("carrera", "");
              } else if (origen === "EXTERNO_NO_UMSA") {
                actualizarCampo("facultad", "");
                actualizarCampo("carrera", "");
                actualizarCampo("registroUniversitario", "");
              }
            }}
            opciones={OPCIONES_ORIGEN_ACADEMICO}
          />

          <Seleccion
            label="Tipo de fraterno"
            value={
              formData.tipoFraterno
            }
            onChange={(
              valor,
            ) =>
              actualizarCampo(
                "tipoFraterno",
                valor as TipoFraterno,
              )
            }
            opciones={[
              {
                value:
                  "NUEVO",
                label:
                  "Nuevo",
              },
              {
                value:
                  "ANTIGUO",
                label:
                  "Antiguo",
              },
            ]}
          />

          {formData.tipoOrigen !== "EXTERNO_NO_UMSA" && <Campo
            label="Registro universitario"
            value={
              formData.registroUniversitario
            }
            onChange={(
              valor,
            ) =>
              actualizarCampo(
                "registroUniversitario",
                valor,
              )
            }
            error={
              errores.registroUniversitario
            }
            required
          />}

          {formData.tipoOrigen === "INTERNO_UMSA" ? <Campo
            label="Facultad"
            value={FACULTAD_FCPN}
            onChange={() => undefined}
            readOnly
          /> : formData.tipoOrigen === "EXTERNO_UMSA" ? <Campo
            label="Facultad"
            value={
              formData.facultad
            }
            onChange={(
              valor,
            ) =>
              actualizarCampo(
                "facultad",
                valor,
              )
            }
            error={
              errores.facultad
            }
            required
          /> : null}

          {formData.tipoOrigen === "INTERNO_UMSA" ? <Seleccion
            label="Carrera FCPN"
            value={formData.carrera}
            onChange={(valor) => actualizarCampo("carrera", valor)}
            opciones={CARRERAS_FCPN.map((carrera) => ({ value: carrera, label: carrera }))}
            required
          /> : formData.tipoOrigen === "EXTERNO_UMSA" ? <Campo
            label="Carrera"
            value={
              formData.carrera
            }
            onChange={(
              valor,
            ) =>
              actualizarCampo(
                "carrera",
                valor,
              )
            }
            error={
              errores.carrera
            }
            required
          /> : null}
        </div>

        {esModoCrear(
          modo,
        ) && (
          <div className="mt-5">
            <SelectorArchivo
              titulo="Registro universitario en PDF"
              descripcion="Archivo obligatorio. Máximo 15 MB."
              archivo={
                formData.registroUniversitarioPdf
              }
              onSeleccionar={
                seleccionarPdf(
                  "registroUniversitarioPdf",
                )
              }
              onQuitar={() =>
                actualizarCampo(
                  "registroUniversitarioPdf",
                  null,
                )
              }
              error={
                errores.registroUniversitarioPdf
              }
            />
          </div>
        )}
      </SeccionFormulario>

      {/* SEGURIDAD */}

      {esModoCrear(
        modo,
      ) && (
        <SeccionFormulario
          titulo="Seguridad de la cuenta"
          descripcion="Crea una contraseña segura para ingresar al sistema."
          icono={
            <ShieldCheck />
          }
        >
          <div className="grid gap-5 md:grid-cols-2">
            <CampoPassword
              label="Contraseña"
              value={
                formData.password
              }
              mostrar={
                mostrarPassword
              }
              onMostrar={() =>
                setMostrarPassword(
                  (
                    actual,
                  ) =>
                    !actual,
                )
              }
              onChange={(
                valor,
              ) =>
                actualizarCampo(
                  "password",
                  valor,
                )
              }
              error={
                errores.password
              }
              required
            />

            <CampoPassword
              label="Confirmar contraseña"
              value={
                formData.confirmarPassword
              }
              mostrar={
                mostrarConfirmacion
              }
              onMostrar={() =>
                setMostrarConfirmacion(
                  (
                    actual,
                  ) =>
                    !actual,
                )
              }
              onChange={(
                valor,
              ) =>
                actualizarCampo(
                  "confirmarPassword",
                  valor,
                )
              }
              error={
                errores.confirmarPassword
              }
              required
            />
          </div>
        </SeccionFormulario>
      )}

      {/* ACCIONES */}

      <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:justify-end">
        {cancelar && (
          <button
            type="button"
            onClick={
              cancelar
            }
            disabled={
              guardando
            }
            className="rounded-2xl border border-slate-300 px-6 py-3 font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            Cancelar
          </button>
        )}

        <button
          type="submit"
          disabled={
            guardando ||
            procesandoImagen
          }
          className="inline-flex min-w-48 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-600 via-red-500 to-yellow-500 px-6 py-3 font-black text-white shadow-lg transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {guardando ? (
            <LoaderCircle className="h-5 w-5 animate-spin" />
          ) : (
            <Save className="h-5 w-5" />
          )}

          {guardando
            ? "Guardando..."
            : textoBoton ??
              (esModoCrear(
                modo,
              )
                ? "Crear cuenta"
                : "Guardar cambios")}
        </button>
      </div>
    </form>
  );
}

/* =========================================
   COMPONENTES INTERNOS
========================================= */

function SeccionFormulario({
  titulo,
  descripcion,
  icono,
  children,
}: {
  titulo: string;
  descripcion: string;
  icono: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#f8edcb] text-[#841534]">
          {icono}
        </div>

        <div>
          <h2 className="text-lg font-black text-slate-900">
            {titulo}
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            {descripcion}
          </p>
        </div>
      </div>

      {children}
    </section>
  );
}

function Campo({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  placeholder,
  error,
}: {
  label: string;
  value: string;
  onChange: (valor: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  error?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-700">
        {label}

        {required && (
          <span className="ml-1 text-red-500">
            *
          </span>
        )}
      </span>

      <input
        type={
          type
        }
        value={
          value
        }
        placeholder={
          placeholder
        }
        onChange={(
          event,
        ) =>
          onChange(
            event.target.value,
          )
        }
        className={`w-full rounded-2xl border bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:bg-white focus:ring-4 ${
          error
            ? "border-red-400 focus:border-red-500 focus:ring-red-100"
            : "border-slate-300 focus:border-fuchsia-500 focus:ring-fuchsia-100"
        }`}
      />

      <MensajeError
        mensaje={
          error
        }
      />
    </label>
  );
}

function Seleccion({
  label,
  value,
  onChange,
  opciones,
  required = false,
  error,
}: {
  label: string;
  value: string;
  onChange: (valor: string) => void;
  opciones: Array<{
    value: string;
    label: string;
  }>;
  required?: boolean;
  error?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-700">
        {label}

        {required && (
          <span className="ml-1 text-red-500">
            *
          </span>
        )}
      </span>

      <select
        value={
          value
        }
        onChange={(
          event,
        ) =>
          onChange(
            event.target.value,
          )
        }
        className={`w-full rounded-2xl border bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:bg-white focus:ring-4 ${
          error
            ? "border-red-400 focus:border-red-500 focus:ring-red-100"
            : "border-slate-300 focus:border-fuchsia-500 focus:ring-fuchsia-100"
        }`}
      >
        {opciones.map(
          (
            opcion,
          ) => (
            <option
              key={
                opcion.value
              }
              value={
                opcion.value
              }
            >
              {
                opcion.label
              }
            </option>
          ),
        )}
      </select>

      <MensajeError
        mensaje={
          error
        }
      />
    </label>
  );
}

function CampoPassword({
  label,
  value,
  onChange,
  mostrar,
  onMostrar,
  required,
  error,
}: {
  label: string;
  value: string;
  onChange: (valor: string) => void;
  mostrar: boolean;
  onMostrar: () => void;
  required: boolean;
  error?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-700">
        {label}

        {required && (
          <span className="ml-1 text-red-500">
            *
          </span>
        )}
      </span>

      <div className="relative">
        <input
          type={
            mostrar
              ? "text"
              : "password"
          }
          value={
            value
          }
          onChange={(
            event,
          ) =>
            onChange(
              event.target.value,
            )
          }
          className={`w-full rounded-2xl border bg-slate-50 px-4 py-3 pr-12 text-sm font-semibold text-slate-800 outline-none transition focus:bg-white focus:ring-4 ${
            error
              ? "border-red-400 focus:border-red-500 focus:ring-red-100"
              : "border-slate-300 focus:border-fuchsia-500 focus:ring-fuchsia-100"
          }`}
        />

        <button
          type="button"
          onClick={
            onMostrar
          }
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-900"
          aria-label={
            mostrar
              ? "Ocultar contraseña"
              : "Mostrar contraseña"
          }
        >
          {mostrar ? (
            <EyeOff size={18} />
          ) : (
            <Eye size={18} />
          )}
        </button>
      </div>

      <MensajeError
        mensaje={
          error
        }
      />
    </label>
  );
}

function SelectorArchivo({
  titulo,
  descripcion,
  archivo,
  onSeleccionar,
  onQuitar,
  error,
}: {
  titulo: string;
  descripcion: string;
  archivo: File | null;
  onSeleccionar: (
    event: ChangeEvent<HTMLInputElement>,
  ) => void;
  onQuitar: () => void;
  error?: string;
}) {
  return (
    <div>
      <label className={`block cursor-pointer rounded-2xl border-2 border-dashed p-5 transition ${
        error
          ? "border-red-400 bg-red-50"
          : "border-slate-300 bg-slate-50 hover:border-fuchsia-400 hover:bg-white"
      }`}>
        <input
          type="file"
          accept="application/pdf,.pdf"
          onChange={
            onSeleccionar
          }
          className="hidden"
        />

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-100 text-red-600">
            <FileText className="h-6 w-6" />
          </div>

          <div className="flex-1">
            <p className="font-bold text-slate-800">
              {titulo}
            </p>

            <p className="mt-1 text-sm text-slate-500">
              {descripcion}
            </p>
          </div>

          <span className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-[#841534] shadow-sm">
            Seleccionar PDF
          </span>
        </div>
      </label>

      {archivo && (
        <ArchivoSeleccionado
          nombre={
            archivo.name
          }
          tamano={
            archivo.size
          }
          onQuitar={
            onQuitar
          }
        />
      )}

      <MensajeError
        mensaje={
          error
        }
      />
    </div>
  );
}

function ArchivoSeleccionado({
  nombre,
  tamano,
  onQuitar,
}: {
  nombre: string;
  tamano: number;
  onQuitar: () => void;
}) {
  const tamanoTexto =
    tamano >=
    1024 * 1024
      ? `${(
          tamano /
          1024 /
          1024
        ).toFixed(2)} MB`
      : `${(
          tamano /
          1024
        ).toFixed(0)} KB`;

  return (
    <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-emerald-800">
          {nombre}
        </p>

        <p className="text-xs text-emerald-700">
          {tamanoTexto}
        </p>
      </div>

      <button
        type="button"
        onClick={
          onQuitar
        }
        className="rounded-xl p-2 text-red-600 transition hover:bg-red-100"
        aria-label={`Quitar ${nombre}`}
      >
        <Trash2 className="h-5 w-5" />
      </button>
    </div>
  );
}

function MensajeError({
  mensaje,
}: {
  mensaje?: string;
}) {
  if (!mensaje) {
    return null;
  }

  return (
    <p className="mt-1 text-sm font-semibold text-red-600">
      {mensaje}
    </p>
  );
}
