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
  Images,
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
import { guardarArchivoBorrador, guardarDatosBorrador, leerArchivosBorrador, leerDatosBorrador } from "@/utils/borradorRegistro";
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
  tokenRegistro: string;
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
  carnetIdentidadReverso: File | null;
  registroUniversitarioPdf: File | null;
};

export const valoresInicialesPerfilUsuario:
  PerfilUsuarioFormData = {
    tokenRegistro: "",
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
    carnetIdentidadReverso: null,
    registroUniversitarioPdf: null,
  };

/* =========================================
   CONVERTIR A PAYLOAD DE REGISTRO
========================================= */

export function construirPayloadRegistro(
  datos: PerfilUsuarioFormData,
): PerfilUsuarioRegistroPayload {
  const perteneceUmsa = ["INTERNO", "INTERNO_UMSA", "EXTERNO_UMSA"].includes(datos.tipoOrigen);
  return {
    tokenRegistro: datos.tokenRegistro.trim(),
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
      undefined,

    expedidoCi:
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
      (perteneceUmsa ? datos.registroUniversitario.trim() : "") ||
      undefined,

    facultad:
      (datos.tipoOrigen === "INTERNO_UMSA" || datos.tipoOrigen === "INTERNO"
        ? "FACULTAD DE CIENCIAS PURAS Y NATURALES"
        : perteneceUmsa ? datos.facultad.trim() : "") ||
      undefined,

    carrera:
      (perteneceUmsa ? datos.carrera.trim() : "") ||
      undefined,

    password:
      datos.password,

    fotoPerfil:
      datos.fotoPerfil,

    carnetIdentidadPdf:
      datos.carnetIdentidadPdf,
    carnetIdentidadReverso:
      datos.carnetIdentidadReverso,

    registroUniversitarioPdf:
      perteneceUmsa ? datos.registroUniversitarioPdf : null,
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
  30 * 1024 * 1024;

const TIPOS_IMAGEN_ADMITIDOS = new Set([
  "image/jpeg", "image/jfif", "image/png", "image/webp", "image/avif", "image/heic", "image/heif", "image/tiff", "image/gif", "image/bmp",
]);
const EXTENSIONES_IMAGEN_ADMITIDAS = new Set([
  "jpg", "jpeg", "jfif", "png", "webp", "avif", "heic", "heif", "tif", "tiff", "gif", "bmp",
]);

const esArchivoPdf = (archivo?: File | null): boolean => Boolean(
  archivo && (archivo.type === "application/pdf" || archivo.name.toLowerCase().endsWith(".pdf")),
);

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

  const [requisitosFaltantes, setRequisitosFaltantes] = useState<string[]>([]);

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

  const [borradorCargado, setBorradorCargado] = useState(false);
  const [tipoCargaCarnet, setTipoCargaCarnet] = useState<"PDF" | "IMAGENES" | "">("");

  const [
    preview,
    setPreview,
  ] =
    useState<string | null>(
      fotoActual,
    );

  useEffect(() => {
    let vigente = true;
    const cargar = async () => {
      if (modo !== "REGISTRO_PUBLICO") {
        setFormData(valoresCombinados); setErrores({}); setBorradorCargado(true); return;
      }
      const datos = leerDatosBorrador<PerfilUsuarioFormData>();
      const archivos = await leerArchivosBorrador();
      if (!vigente) return;
      setFormData({ ...valoresCombinados, ...datos, roles: valoresCombinados.roles, gestion: valoresCombinados.gestion, password: "", confirmarPassword: "", fotoPerfil: archivos.fotoPerfil, carnetIdentidadPdf: archivos.carnetIdentidadPdf, carnetIdentidadReverso: archivos.carnetIdentidadReverso, registroUniversitarioPdf: archivos.registroUniversitarioPdf });
      setErrores({}); setBorradorCargado(true);
    };
    void cargar();
    return () => { vigente = false; };
  }, [
    valoresCombinados,
    modo,
  ]);

  useEffect(() => {
    if (modo !== "REGISTRO_PUBLICO" || !borradorCargado) return;
    const temporizador = window.setTimeout(() => {
      const { password: _p, confirmarPassword: _c, fotoPerfil: _f, carnetIdentidadPdf: _ci, carnetIdentidadReverso: _cir, registroUniversitarioPdf: _ru, ...datosSeguros } = formData;
      guardarDatosBorrador(datosSeguros);
    }, 350);
    return () => window.clearTimeout(temporizador);
  }, [formData, modo, borradorCargado]);

  useEffect(() => {
    if (!formData.carnetIdentidadPdf) return;
    setTipoCargaCarnet(esArchivoPdf(formData.carnetIdentidadPdf) ? "PDF" : "IMAGENES");
  }, [formData.carnetIdentidadPdf]);

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
    let valorNormalizado = valor;

    if (
      modo === "REGISTRO_PUBLICO" &&
      typeof valor === "string"
    ) {
      if (campo === "ci" || campo === "registroUniversitario") {
        valorNormalizado = valor.replace(/\D/g, "") as PerfilUsuarioFormData[K];
      } else if (
        !["email", "password", "confirmarPassword", "fechaNacimiento"].includes(
          String(campo),
        )
      ) {
        valorNormalizado = valor.toLocaleUpperCase("es-BO") as PerfilUsuarioFormData[K];
      }
    }

    setFormData(
      (actual) => ({
        ...actual,
        [campo]:
          valorNormalizado,
      }),
    );

    setErrores(
      (actual) => ({
        ...actual,
        [campo]:
          undefined,
      }),
    );

    if (
      modo === "REGISTRO_PUBLICO" &&
      ["fotoPerfil", "carnetIdentidadPdf", "carnetIdentidadReverso", "registroUniversitarioPdf"].includes(String(campo))
    ) {
      void guardarArchivoBorrador(String(campo), valorNormalizado instanceof File ? valorNormalizado : null);
    }
  };

  const seleccionarImagen = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const archivoRecibido =
      event.target.files?.[0];

    event.target.value =
      "";

    if (!archivoRecibido) {
      return;
    }

    if (archivoRecibido.size > MAX_PDF_BYTES) {
      setErrores((actual) => ({ ...actual, fotoPerfil: "La fotografía no puede superar 30 MB" }));
      return;
    }

    const extension = archivoRecibido.name.split(".").pop()?.toLowerCase();
    const tipoInferido = archivoRecibido.type || (extension === "jpg" || extension === "jpeg" ? "image/jpeg" : extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : "");
    const archivo = archivoRecibido.type
      ? archivoRecibido
      : new File([archivoRecibido], archivoRecibido.name || `foto-camara-${Date.now()}.jpg`, { type: tipoInferido, lastModified: archivoRecibido.lastModified || Date.now() });

    if (
      !TIPOS_IMAGEN_ADMITIDOS.has(tipoInferido) &&
      !EXTENSIONES_IMAGEN_ADMITIDAS.has(extension ?? "")
    ) {
      setErrores(
        (actual) => ({
          ...actual,
          fotoPerfil:
            "Selecciona una imagen JPG, PNG, WebP, AVIF, HEIC, TIFF, GIF o BMP",
        }),
      );

      return;
    }

    try {
      // Mostrar y conservar inmediatamente la captura. En algunos móviles la
      // conversión tarda varios segundos y antes parecía que no se había cargado.
      actualizarCampo("fotoPerfil", archivo);
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
      // Si el navegador no puede comprimir, se conserva el JPG/PNG original;
      // el backend igualmente lo convierte a WebP al guardar.
      actualizarCampo("fotoPerfil", archivo);
      setErrores((actual) => ({ ...actual, fotoPerfil: undefined }));
    } finally {
      setProcesandoImagen(
        false,
      );
    }
  };

  const seleccionarDocumento = (
    campo:
      | "carnetIdentidadPdf"
      | "carnetIdentidadReverso"
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

      const esDocumentoPermitido =
        esArchivoPdf(archivo) ||
        TIPOS_IMAGEN_ADMITIDOS.has(archivo.type) ||
        EXTENSIONES_IMAGEN_ADMITIDAS.has(archivo.name.split(".").pop()?.toLowerCase() ?? "") ||
        archivo.name
          .toLowerCase()
          .endsWith(
            ".pdf",
          );

      if (!esDocumentoPermitido) {
        setErrores(
          (actual) => ({
            ...actual,
            [campo]:
              "Debe seleccionar un PDF o una imagen compatible (JPG, PNG, WebP, AVIF, HEIC, TIFF, GIF o BMP)",
          }),
        );

        return;
      }

      if (campo === "carnetIdentidadReverso" && esArchivoPdf(archivo)) {
        setErrores((actual) => ({ ...actual, [campo]: "El reverso separado debe ser una imagen JPG, PNG o WebP" }));
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
              "Cada archivo no puede superar 30 MB",
          }),
        );

        return;
      }

      actualizarCampo(
        campo,
        archivo,
      );
      if (campo === "carnetIdentidadPdf" && esArchivoPdf(archivo)) {
        actualizarCampo("carnetIdentidadReverso", null);
        setErrores((actual) => ({ ...actual, carnetIdentidadReverso: undefined }));
      }
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

      if (!formData.apellidoPaterno.trim() && !formData.apellidoMaterno.trim()) {
        nuevosErrores.apellidoPaterno =
          "Debe ingresar al menos un apellido";
        nuevosErrores.apellidoMaterno =
          "Puede registrar el único apellido en cualquiera de los dos campos";
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

      const perteneceUmsa = ["INTERNO", "INTERNO_UMSA", "EXTERNO_UMSA"].includes(formData.tipoOrigen);
      if (perteneceUmsa) {
        if (!formData.registroUniversitario.trim()) {
          nuevosErrores.registroUniversitario = "El registro universitario es obligatorio para estudiantes UMSA";
        }
        if (formData.tipoOrigen === "EXTERNO_UMSA" && !formData.facultad.trim()) {
          nuevosErrores.facultad =
            "La facultad es obligatoria cuando pertenece a otra facultad de la UMSA";
        }

        if (
          !formData.carrera.trim()
        ) {
          nuevosErrores.carrera =
            "La carrera es obligatoria para estudiantes UMSA";
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

        if (!formData.carnetIdentidadPdf) {
          nuevosErrores.carnetIdentidadPdf =
            "Debe adjuntar el carnet de identidad como PDF o imagen";
        }
        if (!formData.fotoPerfil) nuevosErrores.fotoPerfil = "La foto de perfil es obligatoria";
        if (formData.carnetIdentidadPdf && !esArchivoPdf(formData.carnetIdentidadPdf) && !formData.carnetIdentidadReverso) nuevosErrores.carnetIdentidadReverso = "Debe adjuntar la foto del reverso del carnet";
        if (perteneceUmsa && !formData.registroUniversitarioPdf) nuevosErrores.registroUniversitarioPdf = "Debe adjuntar una imagen o PDF del registro universitario";

      }

      setErrores(
        nuevosErrores,
      );

      const faltantes = Array.from(new Set(Object.values(nuevosErrores).filter((mensaje): mensaje is string => Boolean(mensaje))));
      setRequisitosFaltantes(faltantes);

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
  const mostrarDatosUniversitarios = formData.tipoOrigen !== "EXTERNO_NO_UMSA";

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
        descripcion={esModoCrear(modo) ? "La fotografía es obligatoria, debe ser clara y será convertida a WebP." : "Puedes actualizar la fotografía; el sistema la convertirá a WebP."}
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
                accept="image/*"
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
            <p className="text-base font-black text-slate-800">
              Subir foto de perfil
              {esModoCrear(modo) && <span className="ml-1 text-red-500">*</span>}
            </p>
            <p className="text-sm leading-6 text-slate-500">
              Aceptamos formatos comunes de cámara y los convertimos a WebP. Utiliza una fotografía clara, de frente, sin gorra ni lentes.
            </p>

            <div className="mt-4 flex flex-wrap gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#841534] px-5 py-3 text-sm font-black text-white shadow transition hover:bg-[#681027]">
                <FileImage className="h-5 w-5" />
                {formData.fotoPerfil ? "Cambiar imagen" : "Cargar desde galería"}
                <input type="file" accept="image/*" disabled={guardando || procesandoImagen} onChange={seleccionarImagen} className="hidden" />
              </label>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-black text-white shadow transition hover:bg-emerald-800">
                {procesandoImagen ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
                Tomar foto con cámara
                <input type="file" accept="image/*" capture="user" disabled={guardando || procesandoImagen} onChange={seleccionarImagen} className="hidden" />
              </label>
            </div>

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
            placeholder="Nombres"
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
            placeholder="Opcional si registra el materno"
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
            error={errores.apellidoMaterno}
            placeholder="Opcional si registra el paterno"
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
                  "HOMBRE",
                label:
                  "Hombre",
              },
              {
                value:
                  "MUJER",
                label:
                  "Mujer",
              },
            ]}
          />
        </div>
      </SeccionFormulario>

      {/* IDENTIDAD */}

      <SeccionFormulario
        titulo="Documento de identidad"
        descripcion="Datos y archivos de tu carnet de identidad."
        icono={
          <FileText />
        }
      >
        <div className="grid gap-5">
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

        </div>

        {esModoCrear(
          modo,
        ) && (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
            <h3 className="text-lg font-black text-[#74122A]">¿Cómo subirás tu carnet?</h3>
            <p className="mt-1 text-sm text-slate-600">Elige una opción. No necesitas usar las dos.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => { if (tipoCargaCarnet !== "PDF") { actualizarCampo("carnetIdentidadPdf", null); actualizarCampo("carnetIdentidadReverso", null); } setTipoCargaCarnet("PDF"); }} className={`rounded-2xl border-2 p-4 text-left transition ${tipoCargaCarnet === "PDF" ? "border-[#74122A] bg-[#74122A]/5 shadow-sm" : "border-slate-200 bg-white hover:border-[#C59A3A]"}`}>
                <FileText className="h-7 w-7 text-[#74122A]"/><strong className="mt-2 block">PDF completo</strong><span className="mt-1 block text-xs text-slate-600">Un solo PDF que contenga anverso y reverso. No se pedirá otro archivo.</span>
              </button>
              <button type="button" onClick={() => { if (tipoCargaCarnet !== "IMAGENES") { actualizarCampo("carnetIdentidadPdf", null); actualizarCampo("carnetIdentidadReverso", null); } setTipoCargaCarnet("IMAGENES"); }} className={`rounded-2xl border-2 p-4 text-left transition ${tipoCargaCarnet === "IMAGENES" ? "border-[#74122A] bg-[#74122A]/5 shadow-sm" : "border-slate-200 bg-white hover:border-[#C59A3A]"}`}>
                <Images className="h-7 w-7 text-[#74122A]"/><strong className="mt-2 block">Dos imágenes</strong><span className="mt-1 block text-xs text-slate-600">Una foto del anverso y otra del reverso, ambas claras y completas.</span>
              </button>
            </div>
            {tipoCargaCarnet === "PDF" && <div className="mt-4"><SelectorArchivo titulo="PDF completo del carnet" descripcion="Archivo PDF de hasta 30 MB con las dos caras." archivo={formData.carnetIdentidadPdf} onSeleccionar={seleccionarDocumento("carnetIdentidadPdf")} onQuitar={() => actualizarCampo("carnetIdentidadPdf", null)} error={errores.carnetIdentidadPdf} accept="application/pdf,.pdf" textoBoton="Seleccionar PDF" /></div>}
            {tipoCargaCarnet === "IMAGENES" && <div className="mt-4 grid gap-4 sm:grid-cols-2"><SelectorArchivo titulo="Imagen del anverso" descripcion="La cara frontal debe verse completa." archivo={formData.carnetIdentidadPdf} onSeleccionar={seleccionarDocumento("carnetIdentidadPdf")} onQuitar={() => actualizarCampo("carnetIdentidadPdf", null)} error={errores.carnetIdentidadPdf} accept="image/*" textoBoton="Seleccionar imagen"/><SelectorArchivo titulo="Imagen del reverso" descripcion="La parte posterior debe verse completa." archivo={formData.carnetIdentidadReverso} onSeleccionar={seleccionarDocumento("carnetIdentidadReverso")} onQuitar={() => actualizarCampo("carnetIdentidadReverso", null)} error={errores.carnetIdentidadReverso} accept="image/*" textoBoton="Seleccionar imagen"/></div>}
            {!tipoCargaCarnet && <p className="mt-4 rounded-xl bg-blue-50 p-3 text-sm text-blue-800">Selecciona <strong>PDF completo</strong> o <strong>Dos imágenes</strong> para mostrar los archivos necesarios.</p>}
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
            label="Celular con WhatsApp"
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
              if (origen === "EXTERNO_NO_UMSA") {
                actualizarCampo("registroUniversitario", "");
                actualizarCampo("facultad", "");
                actualizarCampo("carrera", "");
                actualizarCampo("registroUniversitarioPdf", null);
              } else if (origen === "INTERNO_UMSA") {
                actualizarCampo("facultad", FACULTAD_FCPN);
                if (!CARRERAS_FCPN.includes(formData.carrera as typeof CARRERAS_FCPN[number])) actualizarCampo("carrera", "");
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

          {mostrarDatosUniversitarios && <Campo
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
            placeholder="Solo números"
            required={["INTERNO", "INTERNO_UMSA", "EXTERNO_UMSA"].includes(formData.tipoOrigen)}
          />}

          {formData.tipoOrigen === "INTERNO_UMSA" && <Campo
            label="Facultad"
            value={FACULTAD_FCPN}
            onChange={() => undefined}
            readOnly
          />}

          {formData.tipoOrigen === "EXTERNO_UMSA" && <Campo
            label="Facultad"
            value={formData.facultad}
            onChange={(valor) => actualizarCampo("facultad", valor)}
            error={errores.facultad}
            required
          />}

          {formData.tipoOrigen === "INTERNO_UMSA" ? <Seleccion
            label="Carrera FCPN"
            value={formData.carrera}
            onChange={(valor) => actualizarCampo("carrera", valor)}
            opciones={CARRERAS_FCPN.map((carrera) => ({ value: carrera, label: carrera }))}
          /> : mostrarDatosUniversitarios && <Campo
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
            required={
              ["INTERNO", "INTERNO_UMSA", "EXTERNO_UMSA"].includes(formData.tipoOrigen)
            }
          />}
        </div>

        {mostrarDatosUniversitarios && esModoCrear(
          modo,
        ) && (
          <div className="mt-5">
            <SelectorArchivo
              titulo="Registro universitario"
              descripcion={["INTERNO", "INTERNO_UMSA", "EXTERNO_UMSA"].includes(formData.tipoOrigen) ? "Obligatorio para estudiantes UMSA. PDF o imagen. Máximo 15 MB." : "No requerido para personas que no pertenecen a la UMSA."}
              archivo={
                formData.registroUniversitarioPdf
              }
              onSeleccionar={
                seleccionarDocumento(
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
      {requisitosFaltantes.length > 0 && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="titulo-requisitos">
          <section className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <button type="button" onClick={() => setRequisitosFaltantes([])} aria-label="Cerrar" className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-xl font-black text-slate-700">✕</button>
            <h2 id="titulo-requisitos" className="pr-12 text-2xl font-black text-[#841534]">Faltan requisitos por completar</h2>
            <p className="mt-2 text-sm text-slate-600">Antes de enviar tu solicitud completa lo siguiente:</p>
            <ul className="mt-4 space-y-2">{requisitosFaltantes.map((mensaje) => <li key={mensaje} className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">• {mensaje}</li>)}</ul>
            <button type="button" onClick={() => setRequisitosFaltantes([])} className="mt-6 w-full rounded-xl bg-[#841534] px-5 py-3 font-bold text-white">Entendido, completar datos</button>
          </section>
        </div>
      )}
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
  readOnly = false,
}: {
  label: string;
  value: string;
  onChange: (valor: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  error?: string;
  readOnly?: boolean;
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
        readOnly={readOnly}
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
        className={`w-full rounded-2xl border px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:ring-4 ${readOnly ? "cursor-not-allowed bg-slate-200" : "bg-slate-50 focus:bg-white"} ${
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
  accept = "application/pdf,.pdf,image/*,.jpg,.jpeg,.jfif,.png,.webp,.avif,.heic,.heif,.tif,.tiff,.gif,.bmp",
  textoBoton = "Seleccionar archivo",
}: {
  titulo: string;
  descripcion: string;
  archivo: File | null;
  onSeleccionar: (
    event: ChangeEvent<HTMLInputElement>,
  ) => void;
  onQuitar: () => void;
  error?: string;
  accept?: string;
  textoBoton?: string;
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
          accept={accept}
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
            {textoBoton}
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
