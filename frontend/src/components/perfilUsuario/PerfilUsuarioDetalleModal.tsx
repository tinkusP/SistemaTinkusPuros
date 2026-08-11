import {
  CalendarDays,
  CreditCard,
  ExternalLink,
  FileDown,
  FileText,
  GraduationCap,
  Mail,
  Phone,
  ShieldCheck,
  UserRound,
  Users,
  X,
} from "lucide-react";

import {
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { updatePerfilUsuario } from "@/api/PerfilUsuarioApi";
import { habilitarGuiaPorUsuario } from "@/api/GuiaApi";
import AsignarEstadoPreregistroModal from "@/components/preregistro/AsignarEstadoPreregistroModal";
import { obtenerPreregistros } from "@/api/PreregistroApi";
import { formatearFechaCivil } from "@/utils/fechaCivil";

import {
  esGestionPoblada,
  esRolPoblado,
  type PerfilUsuarioDetalleType,
} from "@/types/PerfilUsuarioType";

import type {
  DocumentoUsuarioType,
} from "@/types/DocumentoUsuarioType";

interface Props {
  perfil:
    | PerfilUsuarioDetalleType
    | null;

  abierto:
    boolean;

  cerrar:
    () => void;

  actualizado?: (perfil: PerfilUsuarioDetalleType) => void;
}


const backendUrl = String(
  import.meta.env.VITE_API_URL || "",
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

/*
 * Construye la URL pública de cualquier archivo.
 *
 * Ejemplos guardados en MongoDB:
 *
 * /uploads/cuentas-perfil/98657676/FOTO_98657676.webp
 * /uploads/cuentas-perfil/98657676/CI_98657676.pdf
 * /uploads/cuentas-perfil/98657676/RU_98657676.pdf
 */
function obtenerUrlArchivo(
  ruta?: string | null,
): string | null {
  if (!ruta) {
    return null;
  }

  if (
    ruta.startsWith(
      "http://",
    ) ||
    ruta.startsWith(
      "https://",
    )
  ) {
    return ruta;
  }

  const rutaNormalizada =
    ruta.startsWith("/")
      ? ruta
      : `/${ruta}`;

  return `${backendUrl}${rutaNormalizada}`;
}

function nombreCompleto(
  perfil: PerfilUsuarioDetalleType,
): string {
  return [
    perfil.nombres,
    perfil.apellidoPaterno,
    perfil.apellidoMaterno,
  ]
    .filter(Boolean)
    .join(" ");
}

function iniciales(
  perfil: PerfilUsuarioDetalleType,
): string {
  return `${perfil.nombres
    .charAt(0)
    .toUpperCase()}${perfil.apellidoPaterno
    .charAt(0)
    .toUpperCase()}`;
}

function formatearFecha(
  fecha?: string | null,
): string {
  if (!fecha) {
    return "No registrada";
  }

  const valor =
    new Date(fecha);

  if (
    Number.isNaN(
      valor.getTime(),
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
    valor,
  );
}

const nombresEstado = {
  PENDIENTE:
    "Pendiente",

  ACTIVO:
    "Activo",

  BLOQUEADO:
    "Bloqueado",

  INACTIVO:
    "Inactivo",

  ELIMINADO:
    "Eliminado",
} as const;

export default function PerfilUsuarioDetalleModal({
  perfil,
  abierto,
  cerrar,
  actualizado,
}: Props) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [
    errorFoto,
    setErrorFoto,
  ] =
    useState(false);

  useEffect(() => {
    setErrorFoto(
      false,
    );
  }, [
    perfil?._id,
  ]);

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
        cerrar();
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
    cerrar,
  ]);

  const [estadoSeleccionado, setEstadoSeleccionado] = useState<"PENDIENTE" | "ACTIVO" | "BLOQUEADO" | "INACTIVO">("PENDIENTE");
  const [aprobacionVisible, setAprobacionVisible] = useState(false);
  const [decisionPreregistroVisible, setDecisionPreregistroVisible] = useState(false);
  const [preregistroAprobado, setPreregistroAprobado] = useState(false);

  useEffect(() => {
    if (perfil) {
      setEstadoSeleccionado(perfil.estado === "ELIMINADO" ? "INACTIVO" : perfil.estado);
      setAprobacionVisible(false);
      setDecisionPreregistroVisible(false);
      setPreregistroAprobado(false);
    }
  }, [perfil]);

  const guardarEstado = useMutation({
    mutationFn: () => {
      if (!perfil) throw new Error("No existe un perfil seleccionado");
      return updatePerfilUsuario({
        perfilUsuarioId: perfil._id,
        formData: { estado: estadoSeleccionado },
      });
    },
    onSuccess: (respuesta) => {
      if (!perfil) return;
      if (estadoSeleccionado === "ACTIVO" && perfil.estado !== "ACTIVO") {
        setAprobacionVisible(true);
      } else {
        toast.success(respuesta.message || "Estado actualizado correctamente");
      }
      actualizado?.({ ...perfil, ...respuesta.perfil, documentos: perfil.documentos } as PerfilUsuarioDetalleType);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "No se pudo actualizar el estado"),
  });

  const nombrarPostulanteGuia = useMutation({
    mutationFn: () => {
      if (!perfil) throw new Error("No existe un perfil seleccionado");
      return habilitarGuiaPorUsuario(perfil._id);
    },
    onSuccess: async () => {
      toast.success("La persona fue nombrada postulante a guía");
      if (perfil) await queryClient.invalidateQueries({ queryKey: ["preregistro-perfil", perfil._id] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "No se pudo nombrar al postulante a guía"),
  });

  const preregistroConsulta = useQuery({
    queryKey: ["preregistro-perfil", perfil?._id],
    queryFn: () => obtenerPreregistros({ usuarioId: perfil!._id, limite: 100 }),
    enabled: Boolean(abierto && perfil?._id && perfil?.estado === "ACTIVO"),
    retry: false,
  });

  if (
    !abierto ||
    !perfil
  ) {
    return null;
  }

  const foto =
    obtenerUrlArchivo(
      perfil.fotoPerfil,
    );

  const roles =
    perfil.roles.filter(
      esRolPoblado,
    );

  const gestiones =
    perfil.gestion.filter(
      esGestionPoblada,
    );

  const documentos =
    perfil.documentos ??
    [];
  const preregistroVigente = preregistroConsulta.data?.preregistros[0];
  const telefonoWhatsApp = String(perfil.telefono ?? "").replace(/\D/g, "");
  const numeroWhatsApp = telefonoWhatsApp.startsWith("591") ? telefonoWhatsApp : telefonoWhatsApp.length === 8 ? `591${telefonoWhatsApp}` : telefonoWhatsApp;
  const preregistroEstaAprobado = preregistroAprobado || preregistroVigente?.estado === "APROBADO";
  const yaEsPostulanteGuia = Boolean(preregistroVigente?.postulanteGuia);

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex h-[100dvh] w-screen items-stretch justify-center overflow-hidden bg-black/65 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="perfil-modal-title"
      onMouseDown={(
        event,
      ) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          cerrar();
        }
      }}
    >
      <div className="flex h-[100dvh] min-h-0 w-full max-w-6xl flex-col overflow-hidden bg-white shadow-2xl sm:h-[94dvh] sm:rounded-3xl">
        <div className="flex shrink-0 items-center justify-between gap-2 bg-gradient-to-r from-[#841534] to-[#c39b37] px-3 py-3 text-white sm:px-6 sm:py-5">
          <div>
            <p className="text-xs text-white/80">
              Información completa
            </p>

            <h2
              id="perfil-modal-title"
              className="text-xl font-bold"
            >
              Perfil de usuario
            </h2>
          </div>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2"><button type="button" onClick={() => { cerrar(); navigate(`/perfilUsuario/${perfil._id}/editar`); }} className="rounded-lg border border-white/30 px-2 py-2 text-xs font-bold transition hover:bg-white/20 sm:px-3"><span className="hidden sm:inline">Editar usuario</span><span className="sm:hidden">Editar</span></button><button
            type="button"
            onClick={
              cerrar
            }
            className="rounded-lg p-2 transition hover:bg-white/20"
            aria-label="Cerrar modal"
          >
            <X className="h-5 w-5" />
          </button></div>
        </div>

        <div className="min-h-0 flex-1 touch-pan-y overflow-x-hidden overflow-y-auto overscroll-contain p-3 [scrollbar-gutter:stable] sm:p-6">
          <div className="space-y-5">
            <section className="grid min-w-0 gap-4 rounded-2xl border border-[#eadcc7] bg-[#fdf8ef] p-3 sm:p-5 md:grid-cols-[1fr_190px]">
              <div className="flex min-h-36 flex-col justify-center rounded-2xl border bg-white p-6">
                <p className="text-xs font-bold uppercase tracking-widest text-[#9a6823]">Nombre personal</p>
                <h3 className="mt-2 text-2xl font-black text-[#741229]">{nombreCompleto(perfil)}</h3>
                <p className="mt-2 text-sm text-slate-500">CI {perfil.ci}{perfil.complementoCi ? `-${perfil.complementoCi}` : ""}</p>
              </div>
              <div className="grid min-h-36 place-items-center overflow-hidden rounded-2xl border bg-white p-3">
                {foto && !errorFoto ? <img src={foto} alt={nombreCompleto(perfil)} onError={() => setErrorFoto(true)} className="h-32 w-32 rounded-2xl border-4 border-[#d5b66c] object-cover" /> : <div className="grid h-32 w-32 place-items-center rounded-2xl bg-[#f1e0b8] text-3xl font-bold text-[#841534]">{iniciales(perfil)}</div>}
              </div>
            </section>

            <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(260px,.78fr)_minmax(300px,.9fr)]">
              <section className="space-y-5">
                {(["CARNET_IDENTIDAD", "CARNET_IDENTIDAD_REVERSO"] as const).map((tipo) => {
                  const documento = documentos.find((item) => item.tipoDocumento === tipo);
                  return documento ? <DocumentoPdf key={documento._id} documento={documento} /> : <div key={tipo} className="grid min-h-48 place-items-center rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50 p-5 text-center font-bold text-amber-900">{tipo === "CARNET_IDENTIDAD" ? "Falta el carnet de identidad / anverso" : "Falta el reverso del carnet de identidad"}</div>;
                })}
              </section>

              <section className="space-y-5">
                {(() => {
                  const matricula = documentos.find((item) => item.tipoDocumento === "REGISTRO_UNIVERSITARIO")
                    ?? documentos.find((item) => item.tipoDocumento === "CARNET_IDENTIDAD_REVERSO");
                  return matricula ? <DocumentoPdf documento={matricula} compacto /> : null;
                })()}
                <Bloque titulo="Matrícula" icono={<GraduationCap />}>
                  <div className="space-y-3">
                    <Dato icono={<GraduationCap />} titulo="Registro universitario" valor={perfil.registroUniversitario || "No registrado"} />
                    <Dato icono={<GraduationCap />} titulo="Facultad" valor={perfil.facultad || "No registrada"} />
                    <Dato icono={<GraduationCap />} titulo="Carrera" valor={perfil.carrera || "No registrada"} />
                  </div>
                </Bloque>
                <Bloque titulo="Estado de la cuenta" icono={<ShieldCheck />}>
                  <select value={estadoSeleccionado} onChange={(event) => setEstadoSeleccionado(event.target.value as typeof estadoSeleccionado)} className="w-full rounded-xl border border-[#d8c7af] bg-white px-4 py-3 font-bold text-slate-800">
                    {(["PENDIENTE", "ACTIVO", "BLOQUEADO", "INACTIVO"] as const).map((estado) => <option key={estado} value={estado}>{estado}</option>)}
                  </select>
                  <button type="button" onClick={() => guardarEstado.mutate()} disabled={guardarEstado.isPending || estadoSeleccionado === perfil.estado} className="mt-3 w-full rounded-xl bg-[#841534] px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{guardarEstado.isPending ? "Guardando..." : estadoSeleccionado === "ACTIVO" && perfil.estado !== "ACTIVO" ? "Activar y guardar" : "Guardar estado"}</button>
                  {perfil.estado === "ACTIVO" && preregistroConsulta.isLoading && <p className="mt-3 rounded-xl bg-slate-100 p-3 text-center text-sm font-semibold text-slate-600">Verificando preregistro...</p>}
                  {perfil.estado === "ACTIVO" && !preregistroConsulta.isLoading && !preregistroEstaAprobado && <button type="button" onClick={() => setDecisionPreregistroVisible(true)} className="mt-3 w-full rounded-xl bg-amber-600 px-5 py-3 font-bold text-white">Definir estado del preregistro</button>}
                  {perfil.estado === "ACTIVO" && preregistroEstaAprobado && !yaEsPostulanteGuia && <button type="button" onClick={() => nombrarPostulanteGuia.mutate()} disabled={nombrarPostulanteGuia.isPending} className="mt-3 w-full rounded-xl bg-purple-700 px-5 py-3 font-bold text-white disabled:opacity-50">{nombrarPostulanteGuia.isPending ? "Nombrando..." : "🪶 Nombrar postulante a guía"}</button>}
                  {perfil.estado === "ACTIVO" && yaEsPostulanteGuia && <p className="mt-3 rounded-xl bg-purple-100 p-3 text-center text-sm font-black text-purple-800">✓ Ya es postulante a guía</p>}
                  {preregistroVigente && <div className="mt-4 rounded-xl border border-[#dfd2bf] bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div><p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Preregistro</p><p className="font-black text-[#741229]">{preregistroVigente.numeroPreRegistro}</p></div>
                      <span className={`rounded-full px-3 py-1 text-xs font-black ${preregistroVigente.estado === "APROBADO" ? "bg-emerald-100 text-emerald-800" : preregistroVigente.estado === "OBSERVADO" ? "bg-orange-100 text-orange-800" : preregistroVigente.estado === "LISTA_ESPERA" ? "bg-blue-100 text-blue-800" : preregistroVigente.estado === "RECHAZADO" || preregistroVigente.estado === "CANCELADO" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}>{preregistroVigente.estado.replaceAll("_", " ")}</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">Registrado: {new Date(preregistroVigente.fechaRegistro).toLocaleDateString("es-BO")}</p>
                    {preregistroVigente.observacion && <div className="mt-3 rounded-lg bg-amber-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Observación</p><p className="mt-1 whitespace-pre-wrap text-sm text-amber-900">{preregistroVigente.observacion}</p>{numeroWhatsApp&&<a href={`https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent(`Hola ${nombreCompleto(perfil)},\n\nTu preregistro tiene la siguiente observación:\n${preregistroVigente.observacion}\n\nPor favor corrige tus datos o documentos para continuar.`)}`} target="_blank" rel="noreferrer" className="mt-3 inline-flex rounded-lg bg-[#25D366] px-3 py-2 text-xs font-black text-white">Enviar observación por WhatsApp</a>}</div>}
                  </div>}
                  {!preregistroConsulta.isLoading && !preregistroVigente && <p className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-3 text-center text-sm text-slate-500">No existe un preregistro vigente.</p>}
                </Bloque>
              </section>

              <Bloque titulo="Datos personales" icono={<UserRound />}>
                <div className="space-y-3">
                  <Dato icono={<CreditCard />} titulo="Número de carnet de identidad" valor={`${perfil.ci}${perfil.complementoCi ? `-${perfil.complementoCi}` : ""}`} />
                  <Dato icono={<Mail />} titulo="Correo" valor={perfil.email} />
                  <Dato icono={<Phone />} titulo="Teléfono" valor={perfil.telefono} />
                  <Dato icono={<CreditCard />} titulo="Expedido" valor={perfil.expedidoCi || "No registrado"} />
                  <Dato icono={<UserRound />} titulo="Género" valor={perfil.sexo || "No registrado"} />
                  <Dato icono={<CalendarDays />} titulo="Fecha de nacimiento" valor={formatearFechaCivil(perfil.fechaNacimiento)} />
                  <Dato icono={<UserRound />} titulo="Tipo de fraterno" valor={perfil.tipoFraterno} />
                  <Dato icono={<ShieldCheck />} titulo="Origen" valor={perfil.tipoOrigen} />
                </div>
              </Bloque>
            </div>

            <div className="grid gap-5 lg:grid-cols-3">
              <Bloque titulo="Roles asignados" icono={<ShieldCheck />}><div className="flex flex-wrap gap-2">{roles.length ? roles.map((rol) => <span key={rol._id} className="rounded-full bg-[#841534] px-3 py-1 text-xs font-semibold text-white">{rol.nombre} · {rol.codigo}</span>) : <TextoVacio>Sin roles asignados</TextoVacio>}</div></Bloque>
              <Bloque titulo="Gestiones asignadas" icono={<CalendarDays />}><div className="space-y-2">{gestiones.length ? gestiones.map((gestion) => <div key={gestion._id} className="rounded-xl border bg-white p-3"><p className="font-bold">{gestion.nombre}</p><p className="text-xs text-slate-500">Año {gestion.anio} · {gestion.estado} · Cupo {gestion.cupoMaximo}</p></div>) : <TextoVacio>Sin gestiones asignadas</TextoVacio>}</div></Bloque>
              <Bloque titulo="Más información" icono={<ShieldCheck />}><div className="space-y-3"><Dato icono={<Mail />} titulo="Correo verificado" valor={perfil.emailVerificado ? "Sí" : "No"} /><Dato icono={<CalendarDays />} titulo="Fecha de creación" valor={formatearFecha(perfil.fechaCreado)} /><Dato icono={<CalendarDays />} titulo="Último ingreso" valor={formatearFecha(perfil.ultimoLogin)} /></div></Bloque>
            </div>

          </div>

          {aprobacionVisible && <div className="fixed inset-0 z-[120] grid place-items-center bg-[#21181b]/75 p-4" role="alertdialog" aria-modal="true" aria-labelledby="usuario-aprobado-titulo">
            <section className="w-full max-w-md overflow-hidden rounded-3xl bg-white text-center shadow-2xl">
              <header className="bg-gradient-to-r from-[#841534] to-[#C59A3A] p-6 text-white"><p className="text-xs font-bold uppercase tracking-[.2em] text-white/80">Proceso completado</p><h3 id="usuario-aprobado-titulo" className="mt-1 text-2xl font-black">Usuario aprobado</h3></header>
              <div className="p-7"><div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-100 text-4xl font-black text-emerald-700">✓</div><p className="mt-5 text-slate-700"><strong>{nombreCompleto(perfil)}</strong> tiene ahora una cuenta ACTIVA y su preregistro fue generado correctamente.</p><p className="mt-3 text-sm text-slate-500">Ahora debes definir si su preregistro queda aprobado, observado, rechazado o en lista de espera.</p><button type="button" autoFocus onClick={() => { setAprobacionVisible(false); setDecisionPreregistroVisible(true); }} className="mt-6 w-full rounded-xl bg-[#841534] px-5 py-3 font-bold text-white">Continuar</button></div>
            </section>
          </div>}
          {decisionPreregistroVisible && <AsignarEstadoPreregistroModal usuarioId={perfil._id} nombre={nombreCompleto(perfil)} telefono={perfil.telefono} cerrar={() => setDecisionPreregistroVisible(false)} completado={(estado) => { setPreregistroAprobado(estado === "APROBADO"); void queryClient.invalidateQueries({ queryKey: ["preregistro-perfil", perfil._id] }); }} />}

          <div className="hidden">
          {/* PERFIL */}

          <div className="flex flex-col items-center gap-4 border-b border-[#eadcc7] pb-6 sm:flex-row">
            {foto &&
            !errorFoto ? (
              <img
                src={
                  foto
                }
                alt={
                  nombreCompleto(
                    perfil,
                  )
                }
                onError={() =>
                  setErrorFoto(
                    true,
                  )
                }
                className="h-28 w-28 rounded-full border-4 border-[#d5b66c] object-cover"
              />
            ) : (
              <div className="flex h-28 w-28 items-center justify-center rounded-full bg-[#f1e0b8] text-3xl font-bold text-[#841534]">
                {
                  iniciales(
                    perfil,
                  )
                }
              </div>
            )}

            <div className="text-center sm:text-left">
              <h3 className="text-2xl font-bold text-[#741229]">
                {
                  nombreCompleto(
                    perfil,
                  )
                }
              </h3>

              <p className="text-sm text-slate-500">
                CI:{" "}
                {perfil.ci}
                {perfil.complementoCi
                  ? `-${perfil.complementoCi}`
                  : ""}
              </p>

              <span className="mt-2 inline-flex rounded-full bg-[#f8edcb] px-3 py-1 text-xs font-semibold text-[#8a641c]">
                {
                  nombresEstado[
                    perfil.estado
                  ]
                }
              </span>

              {foto &&
                errorFoto && (
                <p className="mt-2 text-xs font-semibold text-red-600">
                  No se pudo mostrar la fotografía.
                </p>
              )}
            </div>
          </div>

          {/* DATOS PERSONALES */}

          <Bloque
            titulo="Información personal"
            icono={
              <UserRound />
            }
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Dato
                icono={
                  <Mail />
                }
                titulo="Correo"
                valor={
                  perfil.email
                }
              />

              <Dato
                icono={
                  <Phone />
                }
                titulo="Teléfono"
                valor={
                  perfil.telefono
                }
              />

              <Dato
                icono={
                  <CreditCard />
                }
                titulo="Carnet de identidad"
                valor={`${perfil.ci}${
                  perfil.complementoCi
                    ? `-${perfil.complementoCi}`
                    : ""
                }`}
              />

              <Dato
                icono={
                  <CreditCard />
                }
                titulo="Expedido"
                valor={
                  perfil.expedidoCi ||
                  "No registrado"
                }
              />

              <Dato
                icono={
                  <UserRound />
                }
                titulo="Género"
                valor={
                  perfil.sexo ||
                  "No registrado"
                }
              />

              <Dato
                icono={
                  <CalendarDays />
                }
                titulo="Fecha de nacimiento"
                valor={formatearFechaCivil(
                  perfil.fechaNacimiento,
                )}
              />

              <Dato
                icono={
                  <UserRound />
                }
                titulo="Tipo de fraterno"
                valor={
                  perfil.tipoFraterno
                }
              />

              <Dato
                icono={
                  <ShieldCheck />
                }
                titulo="Origen"
                valor={
                  perfil.tipoOrigen
                }
              />
            </div>
          </Bloque>

          {/* UNIVERSIDAD */}

          <Bloque
            titulo="Información universitaria"
            icono={
              <GraduationCap />
            }
          >
            <div className="grid gap-4 md:grid-cols-3">
              <Dato
                icono={
                  <GraduationCap />
                }
                titulo="Registro universitario"
                valor={
                  perfil.registroUniversitario ||
                  "No registrado"
                }
              />

              <Dato
                icono={
                  <GraduationCap />
                }
                titulo="Facultad"
                valor={
                  perfil.facultad ||
                  "No registrada"
                }
              />

              <Dato
                icono={
                  <GraduationCap />
                }
                titulo="Carrera"
                valor={
                  perfil.carrera ||
                  "No registrada"
                }
              />
            </div>
          </Bloque>

          {/* ROLES Y GESTIONES */}

          <div className="grid gap-5 lg:grid-cols-2">
            <Bloque
              titulo="Roles asignados"
              icono={
                <ShieldCheck />
              }
            >
              <div className="flex flex-wrap gap-2">
                {roles.length >
                0 ? (
                  roles.map(
                    (
                      rol,
                    ) => (
                      <span
                        key={
                          rol._id
                        }
                        className="rounded-full bg-[#841534] px-3 py-1 text-xs font-semibold text-white"
                      >
                        {
                          rol.nombre
                        }
                        {" · "}
                        {
                          rol.codigo
                        }
                      </span>
                    ),
                  )
                ) : (
                  <TextoVacio>
                    Sin roles asignados
                  </TextoVacio>
                )}
              </div>
            </Bloque>

            <Bloque
              titulo="Gestiones asignadas"
              icono={
                <CalendarDays />
              }
            >
              <div className="space-y-2">
                {gestiones.length >
                0 ? (
                  gestiones.map(
                    (
                      gestion,
                    ) => (
                      <div
                        key={
                          gestion._id
                        }
                        className="rounded-xl border border-[#eadcc7] bg-white p-3"
                      >
                        <p className="font-bold text-slate-800">
                          {
                            gestion.nombre
                          }
                        </p>

                        <p className="text-xs text-slate-500">
                          Año{" "}
                          {
                            gestion.anio
                          }{" "}
                          ·{" "}
                          {
                            gestion.estado
                          }{" "}
                          · Cupo{" "}
                          {
                            gestion.cupoMaximo
                          }
                        </p>
                      </div>
                    ),
                  )
                ) : (
                  <TextoVacio>
                    Sin gestiones asignadas
                  </TextoVacio>
                )}
              </div>
            </Bloque>
          </div>

          {/* DOCUMENTOS */}

          <Bloque
            titulo="Documentos registrados"
            icono={
              <FileText />
            }
          >
            {documentos.length >
            0 ? (
              <div className="grid gap-5 xl:grid-cols-2">
                {documentos.map(
                  (
                    documento,
                  ) => (
                    <DocumentoPdf
                      key={
                        documento._id
                      }
                      documento={
                        documento
                      }
                    />
                  ),
                )}
                {!documentos.some((documento) => documento.tipoDocumento === "CARNET_IDENTIDAD_REVERSO") && (
                  <article className="grid min-h-40 place-items-center rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50 p-6 text-center">
                    <div><FileText className="mx-auto h-8 w-8 text-amber-600" /><p className="mt-3 font-black text-amber-900">Falta reverso de foto del carnet</p><p className="mt-1 text-sm text-amber-800">No existe un documento de tipo reverso registrado en la base de datos.</p></div>
                  </article>
                )}
              </div>
            ) : (
              <TextoVacio>
                No existen documentos registrados para este perfil.
              </TextoVacio>
            )}
          </Bloque>

          {/* SEGURIDAD */}

          <Bloque
            titulo="Seguridad y actividad"
            icono={
              <ShieldCheck />
            }
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Dato
                icono={
                  <Users />
                }
                titulo="Correo verificado"
                valor={
                  perfil.emailVerificado
                    ? "Sí"
                    : "No"
                }
              />

              <Dato
                icono={
                  <ShieldCheck />
                }
                titulo="Cambio de contraseña"
                valor={
                  perfil.requiereCambioPassword
                    ? "Requerido"
                    : "No requerido"
                }
              />

              <Dato
                icono={
                  <ShieldCheck />
                }
                titulo="Intentos fallidos"
                valor={String(
                  perfil.intentosFallidos,
                )}
              />

              <Dato
                icono={
                  <CalendarDays />
                }
                titulo="Bloqueado hasta"
                valor={formatearFecha(
                  perfil.bloqueadoHasta,
                )}
              />

              <Dato
                icono={
                  <CalendarDays />
                }
                titulo="Último ingreso"
                valor={formatearFecha(
                  perfil.ultimoLogin,
                )}
              />

              <Dato
                icono={
                  <CalendarDays />
                }
                titulo="Último cambio de contraseña"
                valor={formatearFecha(
                  perfil.ultimoCambioPassword,
                )}
              />

              <Dato
                icono={
                  <CalendarDays />
                }
                titulo="Fecha de creación"
                valor={formatearFecha(
                  perfil.fechaCreado,
                )}
              />

              <Dato
                icono={
                  <CalendarDays />
                }
                titulo="Última edición"
                valor={formatearFecha(
                  perfil.fechaEdit,
                )}
              />
            </div>
          </Bloque>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={
                cerrar
              }
              className="rounded-xl border border-[#841534] px-5 py-2.5 font-bold text-[#841534] transition hover:bg-[#841534] hover:text-white"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
    </div>
  , document.body);
}

/* =========================================
   DOCUMENTO PDF
========================================= */

function DocumentoPdf({
  documento,
  compacto = false,
}: {
  documento:
    DocumentoUsuarioType;
  compacto?: boolean;
}) {
  const [
    errorPdf,
    setErrorPdf,
  ] =
    useState(false);

  const url =
    obtenerUrlArchivo(
      documento.ruta,
    );

  const nombresDocumento: Record<string, string> = {
    CARNET_IDENTIDAD: "Carnet de identidad / anverso",
    CARNET_IDENTIDAD_REVERSO: "Reverso del carnet de identidad",
    REGISTRO_UNIVERSITARIO: "Registro universitario",
  };
  const nombre = nombresDocumento[documento.tipoDocumento] ?? documento.tipoDocumento;
  const esImagen = Boolean(url) && !/\.pdf(?:$|[?#])/i.test(url!);

  return (
    <article className="w-full min-w-0 max-w-full overflow-hidden rounded-2xl border border-[#eadcc7] bg-white">
      <div className="flex min-w-0 items-start justify-between gap-2 border-b border-[#eadcc7] p-3 sm:gap-3 sm:p-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="rounded-xl bg-red-100 p-2 text-red-600">
            <FileText className="h-5 w-5" />
          </div>

          <div className="min-w-0">
            <p className="font-bold text-slate-800">
              {nombre}
            </p>

            <p className="truncate text-xs text-slate-500">
              {
                documento.ruta
              }
            </p>

            <span className="mt-2 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
              {
                documento.estado
              }
            </span>
          </div>
        </div>

        {url && (
          <div className="flex gap-1">
            <a
              href={
                url
              }
              target="_blank"
              rel="noreferrer"
              className="rounded-lg p-2 text-[#841534] hover:bg-[#f8edcb]"
              title="Abrir documento"
            >
              <ExternalLink className="h-5 w-5" />
            </a>

            <a
              href={
                url
              }
              download
              className="rounded-lg p-2 text-[#841534] hover:bg-[#f8edcb]"
              title="Descargar documento"
            >
              <FileDown className="h-5 w-5" />
            </a>
          </div>
        )}
      </div>

      {documento.observacion && (
        <p className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {
            documento.observacion
          }
        </p>
      )}

      <div className={`${compacto ? "h-52 sm:h-[260px]" : "h-64 sm:h-[500px]"} bg-slate-100`}>
        {url &&
        !errorPdf ? (
          esImagen ? (
            <a href={url} target="_blank" rel="noreferrer" className="flex h-full w-full items-center justify-center overflow-hidden bg-slate-100 p-2" title="Abrir imagen en tamaño completo">
              <img
                src={url}
                alt={`Vista previa de ${nombre}`}
                onError={() => setErrorPdf(true)}
                className="block h-full w-full object-contain"
              />
            </a>
          ) : (<>
            <iframe
              src={url}
              title={`Vista previa de ${nombre}`}
              onError={() => setErrorPdf(true)}
              className="hidden h-full w-full max-w-full border-0 sm:block"
            />
            <a href={url} target="_blank" rel="noreferrer" className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center font-bold text-[#841534] sm:hidden"><FileText className="h-12 w-12"/>Abrir documento PDF</a>
          </>)
        ) : (
          <div className="flex h-full items-center justify-center p-6 text-center text-sm font-semibold text-red-600">
            No se pudo cargar la vista previa del PDF.
          </div>
        )}
      </div>
    </article>
  );
}

/* =========================================
   AUXILIARES
========================================= */

function Bloque({
  titulo,
  icono,
  children,
}: {
  titulo: string;
  icono: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[#eadcc7] bg-[#fdf8ef] p-4">
      <div className="mb-3 flex items-center gap-2 font-bold text-[#741229]">
        {icono}
        {titulo}
      </div>

      {children}
    </section>
  );
}

function TextoVacio({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <span className="text-sm text-slate-500">
      {children}
    </span>
  );
}

function Dato({
  icono,
  titulo,
  valor,
}: {
  icono: ReactNode;
  titulo: string;
  valor: string;
}) {
  return (
    <div className="flex gap-3 rounded-xl border border-[#eadcc7] bg-white p-3">
      <div className="text-[#9a6823]">
        {icono}
      </div>

      <div className="min-w-0">
        <p className="text-xs text-slate-500">
          {titulo}
        </p>

        <p className="break-words text-sm font-semibold text-slate-800">
          {valor}
        </p>
      </div>
    </div>
  );
}
