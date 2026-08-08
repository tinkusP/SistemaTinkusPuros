import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  GraduationCap,
  LoaderCircle,
  Mail,
  Phone,
  Save,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import {
  Link,
  useNavigate,
  useParams,
} from "react-router-dom";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { fechaCivilParaInput } from "@/utils/fechaCivil";

import {
  toast,
} from "react-toastify";

import api from "@/lib/axios";

import {
  getPerfilUsuarioById,
  updatePerfilUsuario,
  autorizarEdicionPerfil,
  generarPasswordTemporal,
} from "@/api/PerfilUsuarioApi";

import type {
  PerfilUsuarioForm,
} from "@/types/PerfilUsuarioType";

type EstadoEditable =
  | "PENDIENTE"
  | "ACTIVO"
  | "BLOQUEADO"
  | "INACTIVO";

type ActualizarPerfilAdminForm = {
  roles?: string[];
  gestion?: string[];

  nombres?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;

  ci?: string;
  complementoCi?: string;
  expedidoCi?: string;

  fechaNacimiento?: string;
  sexo?: string;

  telefono?: string;
  fotoPerfil?: File | null;
  email?: string;

  tipoOrigen?:
    | "INTERNO"
    | "EXTERNO";

  tipoFraterno?:
    | "NUEVO"
    | "ANTIGUO";

  registroUniversitario?: string;
  facultad?: string;
  carrera?: string;

  estado?:
    EstadoEditable;

  emailVerificado?:
    boolean;

  requiereCambioPassword?:
    boolean;
};
type RolResumen = {
  _id: string;
  nombre: string;
  codigo?: string;
  estado?: boolean;
};

type GestionResumen = {
  _id: string;
  anio: number;
  nombre: string;
  estado: string;
};

type FormularioEdicion = {
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
  fotoPerfil: File | null;
  email: string;

  tipoOrigen:
    | "INTERNO"
    | "EXTERNO";

  tipoFraterno:
    | "NUEVO"
    | "ANTIGUO";

  registroUniversitario: string;
  facultad: string;
  carrera: string;

  estado:
    EstadoEditable;

  emailVerificado:
    boolean;

  requiereCambioPassword:
    boolean;
};

const FORMULARIO_INICIAL: FormularioEdicion = {
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
  fotoPerfil: null,
  email: "",

  tipoOrigen:
    "INTERNO",

  tipoFraterno:
    "NUEVO",

  registroUniversitario: "",
  facultad: "",
  carrera: "",

  estado:
    "PENDIENTE",

  emailVerificado:
    false,

  requiereCambioPassword:
    false,
};

const backendUrl =
  String(
    import.meta.env.VITE_API_URL ||
      "",
  )
    .trim()
    .replace(
      /\/api\/?$/,
      "",
    )
    .replace(
      /\/+$/,
      "",
    );

function obtenerUrlArchivo(
  ruta?: string | null,
): string | null {
  if (!ruta) {
    return null;
  }

  if (
    ruta.startsWith("http://") ||
    ruta.startsWith("https://")
  ) {
    return ruta;
  }

  return `${backendUrl}${
    ruta.startsWith("/")
      ? ruta
      : `/${ruta}`
  }`;
}

function obtenerIdRelacion(
  valor: unknown,
): string | null {
  if (
    typeof valor ===
    "string"
  ) {
    return valor;
  }

  if (
    typeof valor ===
      "object" &&
    valor !== null &&
    "_id" in valor
  ) {
    const id =
      (valor as {
        _id?: unknown;
      })._id;

    return typeof id ===
      "string"
      ? id
      : null;
  }

  return null;
}

function obtenerIdsRelaciones(
  valores: unknown,
): string[] {
  if (
    !Array.isArray(
      valores,
    )
  ) {
    return [];
  }

  return valores
    .map(
      obtenerIdRelacion,
    )
    .filter(
      (
        id,
      ): id is string =>
        Boolean(id),
    );
}

function fechaParaInput(
  fecha?: string | null,
): string {
  return fechaCivilParaInput(fecha);
}

function obtenerEstadoEditable(
  estado: string,
): EstadoEditable {
  if (
    estado ===
      "ACTIVO" ||
    estado ===
      "BLOQUEADO" ||
    estado ===
      "INACTIVO"
  ) {
    return estado;
  }

  return "PENDIENTE";
}

async function obtenerRoles(): Promise<
  RolResumen[]
> {
  const {
    data,
  } =
    await api.get(
      "/rol",
    );

  const roles =
    Array.isArray(data)
      ? data
      : Array.isArray(
            data?.roles,
          )
        ? data.roles
        : [];

  return roles.filter(
    (
      rol,
    ): rol is RolResumen =>
      typeof rol?._id ===
        "string" &&
      typeof rol?.nombre ===
        "string",
  );
}

async function obtenerGestiones(): Promise<
  GestionResumen[]
> {
  const {
    data,
  } =
    await api.get(
      "/gestiones",
      {
        params: {
          pagina: 1,
          limite: 100,
        },
      },
    );

  const gestiones =
    Array.isArray(data)
      ? data
      : Array.isArray(
            data?.gestiones,
          )
        ? data.gestiones
        : [];

  return gestiones.filter(
    (
      gestion,
    ): gestion is GestionResumen =>
      typeof gestion?._id ===
        "string" &&
      typeof gestion?.nombre ===
        "string" &&
      typeof gestion?.anio ===
        "number",
  );
}

export default function EditarPerfilUsuarioAdminView() {
 const  params = useParams();
 const id = params.perfilUsuarioId;

  const navigate =
    useNavigate();

  const queryClient =
    useQueryClient();

  const [
    formulario,
    setFormulario,
  ] =
    useState<FormularioEdicion>(
      FORMULARIO_INICIAL,
    );
  const [modalPermisoAbierto, setModalPermisoAbierto] = useState(false);
  const [motivoPermiso, setMotivoPermiso] = useState("");
  const [camposPermiso, setCamposPermiso] = useState<string[]>([]);
  const [passwordTemporal, setPasswordTemporal] = useState("");
  const [modalPasswordAbierto, setModalPasswordAbierto] = useState(false);

  const [
    datosCargados,
    setDatosCargados,
  ] =
    useState(false);

  const perfilQuery =
    useQuery({
      queryKey: [
        "perfilusuario",
        id,
      ],

      queryFn: () => {
        if (!id) {
          throw new Error(
            "El ID del perfil no está disponible",
          );
        }

        return getPerfilUsuarioById(
          id,
        );
      },

      enabled:
        Boolean(id),

      retry:
        false,
    });

  const rolesQuery =
    useQuery({
      queryKey: [
        "roles",
        "edicion-perfil",
      ],

      queryFn:
        obtenerRoles,

      retry:
        false,
    });

  const gestionesQuery =
    useQuery({
      queryKey: [
        "gestiones",
        "edicion-perfil",
      ],

      queryFn:
        obtenerGestiones,

      retry:
        false,
    });

  useEffect(() => {
    if (
      !perfilQuery.data ||
      datosCargados
    ) {
      return;
    }

    const perfil =
      perfilQuery.data;

    setFormulario({
      roles:
        obtenerIdsRelaciones(
          perfil.roles,
        ),

      gestion:
        obtenerIdsRelaciones(
          perfil.gestion,
        ),

      nombres:
        perfil.nombres ??
        "",

      apellidoPaterno:
        perfil.apellidoPaterno ??
        "",

      apellidoMaterno:
        perfil.apellidoMaterno ??
        "",

      ci:
        perfil.ci ??
        "",

      complementoCi:
        perfil.complementoCi ??
        "",

      expedidoCi:
        perfil.expedidoCi ??
        "",

      fechaNacimiento:
        fechaParaInput(
          perfil.fechaNacimiento,
        ),

      sexo:
        perfil.sexo ??
        "",

      telefono:
        perfil.telefono ??
        "",
      fotoPerfil: null,

      email:
        perfil.email ??
        "",

      tipoOrigen:
        perfil.tipoOrigen ===
        "EXTERNO"
          ? "EXTERNO"
          : "INTERNO",

      tipoFraterno:
        perfil.tipoFraterno ===
        "ANTIGUO"
          ? "ANTIGUO"
          : "NUEVO",

      registroUniversitario:
        perfil.registroUniversitario ??
        "",

      facultad:
        perfil.facultad ??
        "",

      carrera:
        perfil.carrera ??
        "",

      estado:
        obtenerEstadoEditable(
          perfil.estado,
        ),

      emailVerificado:
        Boolean(
          perfil.emailVerificado,
        ),

      requiereCambioPassword:
        Boolean(
          perfil.requiereCambioPassword,
        ),
    });

    setDatosCargados(
      true,
    );
  }, [
    perfilQuery.data,
    datosCargados,
  ]);

  const fotoActual =
    useMemo(
      () =>
        obtenerUrlArchivo(
          perfilQuery.data
            ?.fotoPerfil,
        ),
      [
        perfilQuery.data
          ?.fotoPerfil,
      ],
    );

  const nombreCompleto =
    useMemo(
      () =>
        [
          formulario.nombres,
          formulario.apellidoPaterno,
          formulario.apellidoMaterno,
        ]
          .filter(Boolean)
          .join(" ")
          .trim(),
      [
        formulario.nombres,
        formulario.apellidoPaterno,
        formulario.apellidoMaterno,
      ],
    );

  const actualizarCampo = <
    K extends keyof FormularioEdicion,
  >(
    campo: K,
    valor: FormularioEdicion[K],
  ) => {
    let valorNormalizado = valor;
    if (typeof valor === "string") {
      if (campo === "ci" || campo === "registroUniversitario") valorNormalizado = valor.replace(/\D/g, "") as FormularioEdicion[K];
      else if (!["email", "fechaNacimiento"].includes(String(campo))) valorNormalizado = valor.toLocaleUpperCase("es-BO") as FormularioEdicion[K];
    }
    setFormulario(
      (
        actual,
      ) => ({
        ...actual,
        [campo]:
          valorNormalizado,
      }),
    );
  };

  const alternarRelacion = (
    campo:
      | "roles"
      | "gestion",

    relacionId:
      string,
  ) => {
    setFormulario(
      (
        actual,
      ) => {
        const seleccionados =
          actual[
            campo
          ];

        const nuevos =
          seleccionados.includes(
            relacionId,
          )
            ? seleccionados.filter(
                (
                  idSeleccionado,
                ) =>
                  idSeleccionado !==
                  relacionId,
              )
            : [
                ...seleccionados,
                relacionId,
              ];

        return {
          ...actual,
          [campo]:
            nuevos,
        };
      },
    );
  };

  const actualizarMutation =
    useMutation({
      mutationFn:
        (
          datos:
            ActualizarPerfilAdminForm,
        ) => {
          if (!id) {
            throw new Error(
              "El ID del perfil no está disponible",
            );
          }

          return updatePerfilUsuario({
            perfilUsuarioId:
              id,

            formData:
              datos,
          });
        },

      onSuccess:
        async (
          respuesta,
        ) => {
          toast.success(
            respuesta.message ||
              "Perfil actualizado correctamente",
          );

          await Promise.all([
            queryClient.invalidateQueries(
              {
                queryKey: [
                  "perfilusuarios",
                ],
              },
            ),

            queryClient.invalidateQueries(
              {
                queryKey: [
                  "perfilusuario",
                  id,
                ],
              },
            ),
          ]);

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
              : "No se pudo actualizar el perfil",
          );
        },
    });

  const autorizacionMutation = useMutation({
    mutationFn: () => autorizarEdicionPerfil(id!, { motivo: motivoPermiso.trim(), campos: camposPermiso }),
    onSuccess: (respuesta) => { toast.success(respuesta.message); setModalPermisoAbierto(false); setMotivoPermiso(""); setCamposPermiso([]); },
    onError: (error) => toast.error(error instanceof Error ? error.message : "No se pudo habilitar la edición"),
  });
  const passwordTemporalMutation = useMutation({ mutationFn: () => generarPasswordTemporal(id!), onSuccess: (respuesta) => { setPasswordTemporal(respuesta.passwordTemporal); setModalPasswordAbierto(false); toast.success(respuesta.message); }, onError: (error) => toast.error(error instanceof Error ? error.message : "No se pudo generar la contraseña temporal") });

  const validarFormulario =
    (): string | null => {
      if (
        !formulario.nombres.trim()
      ) {
        return "Los nombres son obligatorios";
      }

      if (
        !formulario.apellidoPaterno.trim()
      ) {
        return "El apellido paterno es obligatorio";
      }

      if (
        !formulario.ci.trim()
      ) {
        return "El carnet de identidad es obligatorio";
      }

      if (
        !formulario.telefono.trim()
      ) {
        return "El teléfono es obligatorio";
      }

      if (
        !formulario.email.trim()
      ) {
        return "El correo es obligatorio";
      }

      if (
        formulario.roles.length ===
        0
      ) {
        return "Debe asignar al menos un rol";
      }

      if (
        formulario.gestion.length ===
        0
      ) {
        return "Debe asignar al menos una gestión";
      }

      return null;
    };

  const guardarCambios = (
    event:
      FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    const errorValidacion =
      validarFormulario();

    if (
      errorValidacion
    ) {
      toast.error(
        errorValidacion,
      );

      return;
    }

    actualizarMutation.mutate({
      roles:
        formulario.roles,

      gestion:
        formulario.gestion,

      nombres:
        formulario.nombres.trim(),

      apellidoPaterno:
        formulario.apellidoPaterno.trim(),

      apellidoMaterno:
        formulario.apellidoMaterno.trim(),

      ci:
        formulario.ci.trim(),

      complementoCi:
        formulario.complementoCi.trim(),

      expedidoCi:
        formulario.expedidoCi.trim(),

      fechaNacimiento:
        formulario.fechaNacimiento ||
        undefined,

      sexo:
        formulario.sexo ||
        undefined,

      telefono:
        formulario.telefono.trim(),
      fotoPerfil: formulario.fotoPerfil,

      email:
        formulario.email
          .trim()
          .toLowerCase(),

      tipoOrigen:
        formulario.tipoOrigen,

      tipoFraterno:
        formulario.tipoFraterno,

      registroUniversitario:
        formulario.registroUniversitario.trim(),

      facultad:
        formulario.facultad.trim(),

      carrera:
        formulario.carrera.trim(),

      estado:
        formulario.estado,

      emailVerificado:
        formulario.emailVerificado,

      requiereCambioPassword:
        formulario.requiereCambioPassword,
    });
  };

  const cargando =
    perfilQuery.isLoading ||
    rolesQuery.isLoading ||
    gestionesQuery.isLoading;

  const errorCarga =
    perfilQuery.error ||
    rolesQuery.error ||
    gestionesQuery.error;

  if (
    !id
  ) {
    return (
      <MensajeEstado
        tipo="error"
        titulo="ID no válido"
        mensaje="No se recibió el identificador del perfil que se desea editar."
      />
    );
  }

  if (
    cargando
  ) {
    return (
      <MensajeEstado
        titulo="Cargando perfil"
        mensaje="Estamos recuperando la información del usuario."
        cargando
      />
    );
  }

  if (
    errorCarga ||
    !perfilQuery.data
  ) {
    return (
      <MensajeEstado
        tipo="error"
        titulo="No se pudo cargar el perfil"
        mensaje={
          errorCarga instanceof Error
            ? errorCarga.message
            : "El perfil solicitado no está disponible"
        }
      />
    );
  }

  const roles =
    rolesQuery.data ??
    [];

  const gestiones =
    gestionesQuery.data ??
    [];

  const esInterno =
    formulario.tipoOrigen ===
    "INTERNO";

  return (
    <main className="space-y-6">
      {modalPermisoAbierto && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-black/65 p-4">
          <section className="relative w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <button type="button" onClick={()=>setModalPermisoAbierto(false)} aria-label="Cerrar" className="absolute right-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-full bg-white/15 text-xl font-black text-white">✕</button>
            <header className="bg-gradient-to-r from-[#841534] to-[#C59A3A] p-5 text-white"><h2 className="text-xl font-black">Habilitar archivos o datos</h2><p className="mt-1 text-sm text-white/80">Selecciona únicamente lo que el postulante necesita completar o reemplazar.</p></header>
            <div className="space-y-5 p-6">
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ["DATOS_PERSONALES", "Datos personales", "Información registrada"],
                  ["FOTO_PERFIL", "Foto de perfil", perfilQuery.data.fotoPerfil ? "Ya tiene foto · permitir reemplazo" : "Falta subir"],
                  ["CARNET_ANVERSO", "Carnet / anverso", perfilQuery.data.documentos?.some(d=>d.tipoDocumento==="CARNET_IDENTIDAD") ? "Ya existe · permitir reemplazo" : "Falta subir"],
                  ["CARNET_REVERSO", "Reverso del carnet", perfilQuery.data.documentos?.some(d=>d.tipoDocumento==="CARNET_IDENTIDAD_REVERSO") ? "Ya existe · permitir reemplazo" : "Falta subir"],
                  ["REGISTRO_UNIVERSITARIO", "Registro universitario", perfilQuery.data.documentos?.some(d=>d.tipoDocumento==="REGISTRO_UNIVERSITARIO") ? "Ya existe · permitir reemplazo" : "Falta subir"],
                ].map(([codigo,titulo,estado]) => <label key={codigo} className={`cursor-pointer rounded-2xl border p-4 ${camposPermiso.includes(codigo) ? "border-[#841534] bg-[#841534]/5" : "border-slate-200"}`}><input type="checkbox" className="mr-3" checked={camposPermiso.includes(codigo)} onChange={()=>setCamposPermiso(actual=>actual.includes(codigo)?actual.filter(x=>x!==codigo):[...actual,codigo])}/><strong>{titulo}</strong><span className="mt-1 block pl-6 text-xs text-slate-500">{estado}</span></label>)}
              </div>
              <div className="rounded-2xl bg-slate-50 p-4"><p className="text-sm font-black">Archivos actuales</p><div className="mt-2 flex flex-wrap gap-2">{perfilQuery.data.fotoPerfil && <a href={obtenerUrlArchivo(perfilQuery.data.fotoPerfil) ?? "#"} target="_blank" rel="noreferrer" className="rounded-lg border bg-white px-3 py-2 text-xs font-bold text-[#841534]">Ver foto</a>}{perfilQuery.data.documentos?.map(documento=><a key={documento._id} href={obtenerUrlArchivo(documento.ruta) ?? "#"} target="_blank" rel="noreferrer" className="rounded-lg border bg-white px-3 py-2 text-xs font-bold text-[#841534]">Ver {documento.tipoDocumento.replaceAll("_", " ").toLowerCase()}</a>)}{!perfilQuery.data.fotoPerfil && !perfilQuery.data.documentos?.length && <span className="text-xs text-slate-500">No tiene archivos guardados.</span>}</div></div>
              <textarea value={motivoPermiso} onChange={e=>setMotivoPermiso(e.target.value)} maxLength={500} className="min-h-28 w-full rounded-2xl border border-slate-300 p-4" placeholder="Motivo obligatorio. Ej.: reemplazar foto borrosa y subir reverso faltante..." />
              <p className="text-xs text-slate-500">La autorización durará 48 horas, quedará registrada con tu usuario administrador y se marcará como usada después de guardar.</p>
              <div className="flex justify-end gap-3"><button type="button" onClick={()=>setModalPermisoAbierto(false)} className="rounded-xl border px-5 py-3 font-bold">Cancelar</button><button type="button" disabled={!motivoPermiso.trim()||camposPermiso.length===0||autorizacionMutation.isPending} onClick={()=>autorizacionMutation.mutate()} className="rounded-xl bg-[#841534] px-5 py-3 font-bold text-white disabled:opacity-50">{autorizacionMutation.isPending?"Habilitando...":"Habilitar selección"}</button></div>
            </div>
          </section>
        </div>
      )}
      {modalPasswordAbierto && (
        <div className="fixed inset-0 z-[95] grid place-items-center bg-[#21181b]/70 p-4" role="dialog" aria-modal="true">
          <section className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl">
            <button type="button" onClick={()=>setModalPasswordAbierto(false)} aria-label="Cerrar" className="absolute right-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-full bg-white/15 text-xl font-black text-white">✕</button>
            <header className="bg-gradient-to-r from-[#841534] to-[#C59A3A] p-6 text-white"><p className="text-xs font-bold uppercase tracking-[.2em] text-white/75">Seguridad de la cuenta</p><h2 className="mt-2 text-2xl font-black">Generar contraseña temporal</h2></header>
            <div className="space-y-5 p-6"><p className="text-sm leading-6 text-slate-600">Se reemplazará inmediatamente la contraseña actual de <strong>{nombreCompleto}</strong>. El usuario deberá iniciar sesión con la contraseña temporal y crear una nueva antes de acceder al sistema.</p><div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><strong>Importante:</strong> la contraseña temporal se mostrará una sola vez. Entrégala al usuario mediante un medio seguro.</div><div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" disabled={passwordTemporalMutation.isPending} onClick={()=>setModalPasswordAbierto(false)} className="rounded-xl border border-slate-300 px-5 py-3 font-bold">Cancelar</button><button type="button" disabled={passwordTemporalMutation.isPending} onClick={()=>passwordTemporalMutation.mutate()} className="rounded-xl bg-[#841534] px-5 py-3 font-bold text-white disabled:opacity-50">{passwordTemporalMutation.isPending?"Generando...":"Sí, generar contraseña"}</button></div></div>
          </section>
        </div>
      )}
      {/* CABECERA */}

      <header className="flex flex-col gap-4 rounded-3xl bg-gradient-to-r from-[#741229] via-[#841534] to-[#C59A3A] p-6 text-white shadow-lg md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/70">
            Administración de usuarios
          </p>

          <h1 className="mt-2 text-3xl font-black">
            Editar perfil
          </h1>

          <p className="mt-2 text-sm text-white/80">
            {nombreCompleto ||
              "Perfil de usuario"}
          </p>
        </div>

        <Link
          to="/perfil-usuario"
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/30 bg-white/10 px-5 py-3 text-sm font-bold transition hover:bg-white/20"
        >
          <ArrowLeft size={18} />
          Volver a perfiles
        </Link>
        <button type="button" disabled={autorizacionMutation.isPending} onClick={() => setModalPermisoAbierto(true)} className="inline-flex items-center justify-center rounded-2xl border border-white/30 bg-white/10 px-5 py-3 text-sm font-bold transition hover:bg-white/20 disabled:opacity-60">
          {autorizacionMutation.isPending ? "Habilitando..." : "Habilitar edición al usuario"}
        </button>
        <button type="button" disabled={passwordTemporalMutation.isPending} onClick={() => setModalPasswordAbierto(true)} className="inline-flex items-center justify-center rounded-2xl border border-white/30 bg-white/10 px-5 py-3 text-sm font-bold transition hover:bg-white/20 disabled:opacity-60">{passwordTemporalMutation.isPending ? "Generando..." : "Generar contraseña temporal"}</button>
      </header>
      {passwordTemporal && <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5"><p className="font-black text-amber-900">Contraseña temporal generada</p><p className="mt-1 text-sm text-amber-800">Entrégala al usuario por un medio seguro. Solo se muestra en esta sesión.</p><div className="mt-3 flex flex-wrap items-center gap-3"><code className="rounded-xl bg-white px-4 py-3 text-lg font-black tracking-wider">{passwordTemporal}</code><button type="button" onClick={() => navigator.clipboard.writeText(passwordTemporal).then(() => toast.success("Contraseña copiada"))} className="rounded-xl bg-[#841534] px-4 py-3 font-bold text-white">Copiar</button>{perfilQuery.data.telefono && <button type="button" onClick={()=>{const digitos=perfilQuery.data!.telefono.replace(/\D/g,"").replace(/^0+/,"");const numero=digitos.startsWith("591")?digitos:`591${digitos}`;const mensaje=`Hola ${nombreCompleto}. Se restableció tu acceso a Tinkus Puros y Naturales. Tu contraseña temporal es: ${passwordTemporal}.`;window.open(`https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`,"_blank","noopener,noreferrer");}} className="rounded-xl bg-emerald-600 px-4 py-3 font-bold text-white">Enviar por WhatsApp</button>}{perfilQuery.data.email && <button type="button" onClick={()=>{const asunto="Contraseña temporal - Tinkus Puros y Naturales";const mensaje=`Hola ${nombreCompleto}. Se restableció tu acceso a Tinkus Puros y Naturales. Tu contraseña temporal es: ${passwordTemporal}.`;window.location.href=`mailto:${perfilQuery.data!.email}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(mensaje)}`;}} className="rounded-xl bg-blue-600 px-4 py-3 font-bold text-white">Enviar por correo</button>}<button type="button" onClick={()=>setPasswordTemporal("")} className="rounded-xl border px-4 py-3 font-bold">Ocultar</button></div><p className="mt-3 text-xs text-amber-800">WhatsApp o correo se abrirán con el mensaje preparado; revisa el destinatario y confirma el envío.</p></section>}

      <form
        onSubmit={
          guardarCambios
        }
        className="space-y-7"
      >
        {/* FOTO ACTUAL */}

        <SeccionFormulario
          titulo="Fotografía de perfil"
          descripcion="Como administrador puedes reemplazar la fotografía del usuario. Se convertirá a WebP."
          icono={
            <UserRound />
          }
        >
          <div className="flex flex-col items-center gap-5 sm:flex-row">
            <div className="flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-3xl border-4 border-white bg-gradient-to-br from-fuchsia-100 via-yellow-50 to-cyan-100 shadow-lg">
              {fotoActual ? (
                <img
                  src={
                    fotoActual
                  }
                  alt={`Foto de ${nombreCompleto}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <UserRound className="h-14 w-14 text-fuchsia-500" />
              )}
            </div>

            <div>
              <p className="font-black text-slate-900">
                {nombreCompleto}
              </p>

              <p className="mt-1 text-sm text-slate-500">
                CI:{" "}
                {
                  formulario.ci
                }
              </p>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
                Esta vista actualiza la información administrativa del perfil. Los archivos almacenados permanecen asociados al mismo usuario.
              </p>
              <label className="mt-4 inline-flex cursor-pointer rounded-xl bg-[#841534] px-4 py-2.5 text-sm font-bold text-white">
                Cambiar fotografía
                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => actualizarCampo("fotoPerfil", event.target.files?.[0] ?? null)} />
              </label>
              {formulario.fotoPerfil && <p className="mt-2 text-xs font-semibold text-emerald-700">Nueva foto: {formulario.fotoPerfil.name}</p>}
            </div>
          </div>
        </SeccionFormulario>

        {/* DATOS PERSONALES */}

        <SeccionFormulario
          titulo="Datos personales"
          descripcion="Información personal registrada para el usuario."
          icono={
            <UserRound />
          }
        >
          <div className="grid gap-5 md:grid-cols-2">
            <Campo
              label="Nombres"
              value={
                formulario.nombres
              }
              onChange={(
                valor,
              ) =>
                actualizarCampo(
                  "nombres",
                  valor,
                )
              }
              required
            />

            <Campo
              label="Apellido paterno"
              value={
                formulario.apellidoPaterno
              }
              onChange={(
                valor,
              ) =>
                actualizarCampo(
                  "apellidoPaterno",
                  valor,
                )
              }
              required
            />

            <Campo
              label="Apellido materno"
              value={
                formulario.apellidoMaterno
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
                formulario.fechaNacimiento
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
                formulario.sexo
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
                  value: "",
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
          descripcion="Datos del carnet de identidad."
          icono={
            <CreditCard />
          }
        >
          <div className="grid gap-5 md:grid-cols-3">
            <Campo
              label="Carnet de identidad"
              value={
                formulario.ci
              }
              onChange={(
                valor,
              ) =>
                actualizarCampo(
                  "ci",
                  valor,
                )
              }
              required
            />

            <Campo
              label="Complemento"
              value={
                formulario.complementoCi
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
                formulario.expedidoCi
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
        </SeccionFormulario>

        {/* CONTACTO */}

        <SeccionFormulario
          titulo="Datos de contacto"
          descripcion="Información utilizada para el acceso y las comunicaciones."
          icono={
            <Mail />
          }
        >
          <div className="grid gap-5 md:grid-cols-2">
            <Campo
              label="Celular con WhatsApp"
              value={
                formulario.telefono
              }
              onChange={(
                valor,
              ) =>
                actualizarCampo(
                  "telefono",
                  valor,
                )
              }
              required
              icono={
                <Phone size={17} />
              }
            />

            <Campo
              label="Correo electrónico"
              type="email"
              value={
                formulario.email
              }
              onChange={(
                valor,
              ) =>
                actualizarCampo(
                  "email",
                  valor,
                )
              }
              required
              icono={
                <Mail size={17} />
              }
            />
          </div>
        </SeccionFormulario>

        {/* UNIVERSIDAD */}

        <SeccionFormulario
          titulo="Información universitaria"
          descripcion="Datos académicos y tipo de participación."
          icono={
            <GraduationCap />
          }
        >
          <div className="grid gap-5 md:grid-cols-2">
            <Seleccion
              label="Origen"
              value={
                formulario.tipoOrigen
              }
              onChange={(
                valor,
              ) =>
                actualizarCampo(
                  "tipoOrigen",
                  valor as
                    | "INTERNO"
                    | "EXTERNO",
                )
              }
              opciones={[
                {
                  value:
                    "INTERNO",
                  label:
                    "Interno - UMSA",
                },
                {
                  value:
                    "EXTERNO",
                  label:
                    "Externo",
                },
              ]}
            />

            <Seleccion
              label="Tipo de fraterno"
              value={
                formulario.tipoFraterno
              }
              onChange={(
                valor,
              ) =>
                actualizarCampo(
                  "tipoFraterno",
                  valor as
                    | "NUEVO"
                    | "ANTIGUO",
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
          </div>

          {esInterno && (
            <div className="mt-5 grid gap-5 md:grid-cols-3">
              <Campo
                label="Registro universitario"
                value={
                  formulario.registroUniversitario
                }
                onChange={(
                  valor,
                ) =>
                  actualizarCampo(
                    "registroUniversitario",
                    valor,
                  )
                }
              />

              <Campo
                label="Facultad"
                value={
                  formulario.facultad
                }
                onChange={(
                  valor,
                ) =>
                  actualizarCampo(
                    "facultad",
                    valor,
                  )
                }
              />

              <Campo
                label="Carrera"
                value={
                  formulario.carrera
                }
                onChange={(
                  valor,
                ) =>
                  actualizarCampo(
                    "carrera",
                    valor,
                  )
                }
              />
            </div>
          )}
        </SeccionFormulario>

        {/* ROLES */}

        <SeccionFormulario
          titulo="Roles del usuario"
          descripcion="Seleccione uno o varios roles para el perfil."
          icono={
            <ShieldCheck />
          }
        >
          {roles.length >
          0 ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {roles.map(
                (
                  rol,
                ) => {
                  const seleccionado =
                    formulario.roles.includes(
                      rol._id,
                    );

                  return (
                    <button
                      key={
                        rol._id
                      }
                      type="button"
                      onClick={() =>
                        alternarRelacion(
                          "roles",
                          rol._id,
                        )
                      }
                      className={`flex items-center justify-between rounded-2xl border p-4 text-left transition ${
                        seleccionado
                          ? "border-[#841534] bg-[#841534]/10 ring-2 ring-[#841534]/20"
                          : "border-slate-200 bg-white hover:border-[#C59A3A]"
                      }`}
                    >
                      <span>
                        <span className="block font-black text-slate-900">
                          {
                            rol.nombre
                          }
                        </span>

                        <span className="mt-1 block text-xs text-slate-500">
                          {
                            rol.codigo ||
                            "Sin código"
                          }
                        </span>
                      </span>

                      {seleccionado && (
                        <CheckCircle2 className="text-[#841534]" />
                      )}
                    </button>
                  );
                },
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              No se encontraron roles disponibles.
            </p>
          )}
        </SeccionFormulario>

        {/* GESTIONES */}

        <SeccionFormulario
          titulo="Gestiones asignadas"
          descripcion="Seleccione las gestiones asociadas al usuario."
          icono={
            <CalendarDays />
          }
        >
          {gestiones.length >
          0 ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {gestiones.map(
                (
                  gestion,
                ) => {
                  const seleccionado =
                    formulario.gestion.includes(
                      gestion._id,
                    );

                  return (
                    <button
                      key={
                        gestion._id
                      }
                      type="button"
                      onClick={() =>
                        alternarRelacion(
                          "gestion",
                          gestion._id,
                        )
                      }
                      className={`flex items-center justify-between rounded-2xl border p-4 text-left transition ${
                        seleccionado
                          ? "border-[#C59A3A] bg-[#C59A3A]/10 ring-2 ring-[#C59A3A]/20"
                          : "border-slate-200 bg-white hover:border-[#841534]"
                      }`}
                    >
                      <span>
                        <span className="block font-black text-slate-900">
                          {
                            gestion.nombre
                          }
                        </span>

                        <span className="mt-1 block text-xs text-slate-500">
                          Año{" "}
                          {
                            gestion.anio
                          }{" "}
                          ·{" "}
                          {
                            gestion.estado
                          }
                        </span>
                      </span>

                      {seleccionado && (
                        <CheckCircle2 className="text-[#C59A3A]" />
                      )}
                    </button>
                  );
                },
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              No se encontraron gestiones disponibles.
            </p>
          )}
        </SeccionFormulario>

        {/* ADMINISTRACIÓN */}

        <SeccionFormulario
          titulo="Estado y seguridad"
          descripcion="Controles exclusivos para la administración del perfil."
          icono={
            <ShieldCheck />
          }
        >
          <div className="grid gap-5 lg:grid-cols-3">
            <Seleccion
              label="Estado del perfil"
              value={
                formulario.estado
              }
              onChange={(
                valor,
              ) =>
                actualizarCampo(
                  "estado",
                  valor as EstadoEditable,
                )
              }
              opciones={[
                {
                  value:
                    "PENDIENTE",
                  label:
                    "Pendiente",
                },
                {
                  value:
                    "ACTIVO",
                  label:
                    "Activo",
                },
                {
                  value:
                    "BLOQUEADO",
                  label:
                    "Bloqueado",
                },
                {
                  value:
                    "INACTIVO",
                  label:
                    "Inactivo",
                },
              ]}
            />

            <Interruptor
              titulo="Correo verificado"
              descripcion="Indica que el correo fue validado."
              activo={
                formulario.emailVerificado
              }
              onChange={(
                valor,
              ) =>
                actualizarCampo(
                  "emailVerificado",
                  valor,
                )
              }
            />

            <Interruptor
              titulo="Exigir cambio de contraseña"
              descripcion="Solicita cambiar la contraseña en el siguiente acceso."
              activo={
                formulario.requiereCambioPassword
              }
              onChange={(
                valor,
              ) =>
                actualizarCampo(
                  "requiereCambioPassword",
                  valor,
                )
              }
            />
          </div>
        </SeccionFormulario>

        {/* ACCIONES */}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() =>
              navigate(
                "/perfil-usuario",
              )
            }
            disabled={
              actualizarMutation.isPending
            }
            className="rounded-2xl border border-slate-300 bg-white px-6 py-3 font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            Cancelar
          </button>

          <button
            type="submit"
            disabled={
              actualizarMutation.isPending
            }
            className="inline-flex min-w-52 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-600 via-red-500 to-yellow-500 px-6 py-4 font-black text-white shadow-lg transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {actualizarMutation.isPending ? (
              <LoaderCircle className="h-5 w-5 animate-spin" />
            ) : (
              <Save className="h-5 w-5" />
            )}

            {actualizarMutation.isPending
              ? "Guardando..."
              : "Guardar cambios"}
          </button>
        </div>
      </form>
    </main>
  );
}

/* =========================================
   COMPONENTES AUXILIARES
========================================= */

function SeccionFormulario({
  titulo,
  descripcion,
  icono,
  children,
}: {
  titulo:
    string;

  descripcion:
    string;

  icono:
    ReactNode;

  children:
    ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-start gap-3">
        <span className="rounded-2xl bg-[#841534]/10 p-3 text-[#841534]">
          {
            icono
          }
        </span>

        <div>
          <h2 className="text-lg font-black text-slate-900">
            {
              titulo
            }
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            {
              descripcion
            }
          </p>
        </div>
      </div>

      {
        children
      }
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
  icono,
}: {
  label:
    string;

  value:
    string;

  onChange:
    (
      valor:
        string,
    ) => void;

  type?:
    string;

  required?:
    boolean;

  placeholder?:
    string;

  icono?:
    ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-700">
        {
          label
        }

        {required && (
          <span className="ml-1 text-red-500">
            *
          </span>
        )}
      </span>

      <span className="relative block">
        {icono && (
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
            {
              icono
            }
          </span>
        )}

        <input
          type={
            type
          }
          value={
            value
          }
          required={
            required
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
          className={`w-full rounded-2xl border border-slate-300 bg-slate-50 py-3 pr-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-fuchsia-500 focus:bg-white focus:ring-4 focus:ring-fuchsia-100 ${
            icono
              ? "pl-11"
              : "pl-4"
          }`}
        />
      </span>
    </label>
  );
}

function Seleccion({
  label,
  value,
  onChange,
  opciones,
}: {
  label:
    string;

  value:
    string;

  onChange:
    (
      valor:
        string,
    ) => void;

  opciones:
    Array<{
      value:
        string;

      label:
        string;
    }>;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-700">
        {
          label
        }
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
        className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-fuchsia-500 focus:bg-white focus:ring-4 focus:ring-fuchsia-100"
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
    </label>
  );
}

function Interruptor({
  titulo,
  descripcion,
  activo,
  onChange,
}: {
  titulo:
    string;

  descripcion:
    string;

  activo:
    boolean;

  onChange:
    (
      valor:
        boolean,
    ) => void;
}) {
  return (
    <button
      type="button"
      onClick={() =>
        onChange(
          !activo,
        )
      }
      className={`flex min-h-28 items-center justify-between gap-4 rounded-2xl border p-4 text-left transition ${
        activo
          ? "border-emerald-400 bg-emerald-50"
          : "border-slate-200 bg-slate-50"
      }`}
    >
      <span>
        <span className="block font-black text-slate-900">
          {
            titulo
          }
        </span>

        <span className="mt-1 block text-xs leading-5 text-slate-500">
          {
            descripcion
          }
        </span>
      </span>

      <span
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${
          activo
            ? "bg-emerald-500"
            : "bg-slate-300"
        }`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${
            activo
              ? "left-6"
              : "left-1"
          }`}
        />
      </span>
    </button>
  );
}

function MensajeEstado({
  titulo,
  mensaje,
  tipo = "normal",
  cargando = false,
}: {
  titulo:
    string;

  mensaje:
    string;

  tipo?:
    "normal" |
    "error";

  cargando?:
    boolean;
}) {
  return (
    <div
      className={`rounded-3xl border p-10 text-center ${
        tipo ===
        "error"
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-slate-200 bg-white text-slate-700"
      }`}
    >
      {cargando && (
        <LoaderCircle className="mx-auto mb-4 h-8 w-8 animate-spin" />
      )}

      <h2 className="text-xl font-black">
        {
          titulo
        }
      </h2>

      <p className="mt-2 text-sm">
        {
          mensaje
        }
      </p>

      {!cargando && (
        <Link
          to="/perfil-usuario"
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#841534] px-5 py-3 font-bold text-white"
        >
          <ArrowLeft size={17} />
          Volver
        </Link>
      )}
    </div>
  );
}
