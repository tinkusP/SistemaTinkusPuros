

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { esRolPoblado } from "@/types/PerfilUsuarioType";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import api from "@/lib/axios";
import { obtenerMiIndumentaria } from "@/api/IndumentariaApi";
import { formatearFechaCivil } from "@/utils/fechaCivil";
import { FileText, Images, UploadCloud } from "lucide-react";
import { CARRERAS_FCPN, FACULTAD_FCPN, OPCIONES_ORIGEN_ACADEMICO, normalizarOrigenAcademico } from "@/constants/origenAcademico";
import type { TipoOrigen } from "@/types/PerfilUsuarioType";
import { obtenerMensajeError } from "@/api/apiError";

type OrigenEditable = { tipoOrigen: string; facultad: string; carrera: string; registroUniversitario: string };

function OrigenAcademicoAutorizado({ valor, cambiar }: { valor: OrigenEditable; cambiar: Dispatch<SetStateAction<OrigenEditable>> }) {
  const origen = normalizarOrigenAcademico(valor.tipoOrigen as TipoOrigen);
  const cambiarOrigen = (tipoOrigen: TipoOrigen) => cambiar((actual) => ({
    ...actual,
    tipoOrigen,
    facultad: tipoOrigen === "INTERNO_UMSA" ? FACULTAD_FCPN : tipoOrigen === "EXTERNO_NO_UMSA" ? "" : actual.facultad,
    carrera: tipoOrigen === "EXTERNO_NO_UMSA" || (tipoOrigen === "INTERNO_UMSA" && !CARRERAS_FCPN.includes(actual.carrera as typeof CARRERAS_FCPN[number])) ? "" : actual.carrera,
    registroUniversitario: tipoOrigen === "EXTERNO_NO_UMSA" ? "" : actual.registroUniversitario,
  }));
  return <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4"><h3 className="font-black text-emerald-900">Origen y facultad autorizados</h3><p className="mt-1 text-xs text-slate-600">Selecciona la misma clasificación utilizada en el formulario de registro.</p><div className="mt-3 grid gap-3 md:grid-cols-2"><label className="text-sm font-bold">Origen<select value={origen} onChange={e=>cambiarOrigen(e.target.value as TipoOrigen)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5">{OPCIONES_ORIGEN_ACADEMICO.map(opcion=><option key={opcion.value} value={opcion.value}>{opcion.label}</option>)}</select></label>{origen !== "EXTERNO_NO_UMSA" ? <label className="text-sm font-bold">Registro universitario<input value={valor.registroUniversitario} onChange={e=>cambiar(actual=>({...actual,registroUniversitario:e.target.value.toLocaleUpperCase("es-BO")}))} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5"/></label> : null}{origen === "INTERNO_UMSA" ? <><label className="text-sm font-bold">Facultad<input readOnly value={FACULTAD_FCPN} className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-100 px-3 py-2.5"/></label><label className="text-sm font-bold">Carrera FCPN<select value={valor.carrera} onChange={e=>cambiar(actual=>({...actual,carrera:e.target.value}))} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5"><option value="">Seleccionar carrera</option>{CARRERAS_FCPN.map(carrera=><option key={carrera} value={carrera}>{carrera}</option>)}</select></label></> : origen === "EXTERNO_UMSA" ? <>{[["facultad","Facultad UMSA"],["carrera","Carrera"]].map(([campo,etiqueta])=><label key={campo} className="text-sm font-bold">{etiqueta}<input value={valor[campo as keyof OrigenEditable]} onChange={e=>cambiar(actual=>({...actual,[campo]:e.target.value.toLocaleUpperCase("es-BO")}))} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5"/></label>)}</> : <p className="rounded-xl bg-white p-3 text-sm text-slate-600 md:col-span-2">No pertenece a la UMSA; no se solicitan facultad, carrera ni registro universitario.</p>}</div></div>;
}

export default function PerfilView() {
  const navigate = useNavigate();

  const {
    data: perfil,
    isLoading,
    isError,
  } = useAuth();
  const [errorImagen, setErrorImagen] =
    useState(false);
  const [modalCambiosGuardados, setModalCambiosGuardados] = useState(false);
  const [tipoCarnet, setTipoCarnet] = useState<"PDF" | "IMAGENES" | "">("");
  const [fotoNueva,setFotoNueva]=useState<File|null>(null); const [carnetFrente,setCarnetFrente]=useState<File|null>(null); const [carnetReverso,setCarnetReverso]=useState<File|null>(null); const [ruNuevo,setRuNuevo]=useState<File|null>(null); const queryClient=useQueryClient();
  const [datosEditables,setDatosEditables]=useState({nombres:"",apellidoPaterno:"",apellidoMaterno:"",telefono:"",ci:"",fechaNacimiento:"",sexo:""});
  const [correoEditable,setCorreoEditable]=useState("");
  const [origenEditable,setOrigenEditable]=useState({tipoOrigen:"INTERNO",facultad:"",carrera:"",registroUniversitario:""});
  useEffect(()=>{if(perfil){setCorreoEditable(perfil.email??"");setDatosEditables({nombres:perfil.nombres??"",apellidoPaterno:perfil.apellidoPaterno??"",apellidoMaterno:perfil.apellidoMaterno??"",telefono:perfil.telefono??"",ci:perfil.ci??"",fechaNacimiento:perfil.fechaNacimiento?String(perfil.fechaNacimiento).slice(0,10):"",sexo:perfil.sexo??""});setOrigenEditable({tipoOrigen:perfil.tipoOrigen??"INTERNO",facultad:perfil.facultad??"",carrera:perfil.carrera??"",registroUniversitario:perfil.registroUniversitario??""})}},[perfil]);
  const autorizacionQuery=useQuery({queryKey:["mi-autorizacion-edicion"],queryFn:async()=> (await api.get("/perfilusuario/autorizacion-edicion/mia")).data});
  const indumentariaQuery=useQuery({queryKey:["mi-indumentaria"],queryFn:obtenerMiIndumentaria});
  const completarMutation=useMutation({mutationFn:async()=>{const fd=new FormData();if(autorizacionQuery.data?.autorizacion?.campos.includes("CORREO_ELECTRONICO"))fd.append("email",correoEditable.trim().toLowerCase());if(fotoNueva)fd.append("fotoPerfil",fotoNueva);if(carnetFrente)fd.append("carnetIdentidadPdf",carnetFrente);if(carnetReverso)fd.append("carnetIdentidadReverso",carnetReverso);if(ruNuevo)fd.append("registroUniversitarioPdf",ruNuevo);if(autorizacionQuery.data?.autorizacion?.campos.includes("DATOS_PERSONALES"))Object.entries(datosEditables).forEach(([campo,valor])=>fd.append(campo,valor));if(autorizacionQuery.data?.autorizacion?.campos.includes("ORIGEN_ACADEMICO"))Object.entries(origenEditable).forEach(([campo,valor])=>fd.append(campo,valor));return(await api.post("/perfilusuario/completar-perfil-autorizado",fd)).data;},onSuccess:async r=>{toast.success(r.message);setModalCambiosGuardados(true);setTipoCarnet("");setFotoNueva(null);setCarnetFrente(null);setCarnetReverso(null);setRuNuevo(null);await queryClient.invalidateQueries();},onError:(e:unknown)=>toast.error(obtenerMensajeError(e,"No se pudo actualizar"))});

  const cambiarTipoCarnet = (tipo: "PDF" | "IMAGENES") => {
    setTipoCarnet(tipo);
    setCarnetFrente(null);
    setCarnetReverso(null);
  };

  const guardarCambiosAutorizados = () => {
    if (tipoCarnet && !carnetFrente) {
      toast.info(tipoCarnet === "PDF" ? "Selecciona el PDF completo de tu carnet." : "Selecciona la imagen del anverso de tu carnet.");
      return;
    }
    if (tipoCarnet === "IMAGENES" && carnetFrente && !carnetReverso) {
      toast.info("Falta la imagen del reverso de tu carnet.");
      return;
    }
    completarMutation.mutate();
  };

  const backendUrl = String(
  import.meta.env.VITE_API_URL || "",
).replace(/\/api\/?$/, "");

  const fotoPerfil =
    perfil?.fotoPerfil && !errorImagen
      ? perfil.fotoPerfil.startsWith("http")
        ? perfil.fotoPerfil
        : `${backendUrl}${perfil.fotoPerfil}`
      : null;

  const nombresRoles = useMemo(
    () =>
      perfil?.roles
        .filter(esRolPoblado)
        .map((rol) => rol.nombre)
        .join(", ") || "",
    [perfil],
  );

  const esAdministrador = useMemo(
    () =>
      perfil?.roles
        .filter(esRolPoblado)
        .some((rol) => {
          const valores = [
            rol.nombre,
            rol.codigo,
          ].map((valor) =>
            String(valor ?? "")
              .trim()
              .toUpperCase()
              .replace(/[\s_-]/g, ""),
          );

          return valores.some((valor) =>
            [
              "ADMIN",
              "ADMINISTRADOR",
              "SUPERADMIN",
              "SUPERADMINISTRADOR",
            ].includes(valor),
          );
        }) ?? false,
    [perfil],
  );
  const nombreCompleto = useMemo(() => {
    if (!perfil) return "Usuario";

    return [
      perfil.nombres,
      perfil.apellidoPaterno,
      perfil.apellidoMaterno,
    ]
      .filter(Boolean)
      .join(" ")
      .trim();
  }, [perfil]);

  const iniciales = useMemo(() => {
    return (
      nombreCompleto
        .split(/\s+/)
        .filter(Boolean)
        .map((nombre) =>
          nombre.charAt(0),
        )
        .slice(0, 2)
        .join("")
        .toUpperCase() || "US"
    );
  }, [nombreCompleto]);

  if (isLoading) {
    return <PerfilSkeleton />;
  }

  if (isError || !perfil) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900/40 dark:bg-red-950/20">
          <div className="mb-3 text-4xl">
            ⚠️
          </div>

          <h2 className="text-lg font-bold text-red-700 dark:text-red-300">
            No se pudo cargar el perfil
          </h2>

          <p className="mt-2 text-sm text-red-600 dark:text-red-400">
            Ocurrió un problema al obtener los datos
            de tu cuenta.
          </p>

          <button
            type="button"
            onClick={() =>
              navigate("/auth/login")
            }
            className="mt-5 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700"
          >
            Volver al inicio de sesión
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-[#eee8dc] px-3 py-4 text-[#262022] sm:px-5 sm:py-7 lg:px-8 dark:bg-[#1f1a1c] dark:text-[#F6F0E3]">
      <div className="mx-auto w-full min-w-0 max-w-6xl space-y-5 sm:space-y-6">
        {/* =========================================
            ENCABEZADO
        ========================================= */}

        <section className="overflow-hidden rounded-[1.75rem] border border-[#cdbfae] bg-[#fffdf8] shadow-xl shadow-[#74122A]/10 dark:border-[#B7A7A0]/30 dark:bg-[#262022]">
          <div className="relative h-40 overflow-hidden bg-[#74122A] sm:h-52">
            <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(45deg,transparent_42%,#C59A3A_42%,#C59A3A_48%,transparent_48%,transparent_52%,#C59A3A_52%,#C59A3A_58%,transparent_58%)] [background-size:70px_70px]" />
            <div className="absolute -right-8 -top-12 h-64 w-64 rounded-full border-[28px] border-[#C59A3A]/20" />
            <img
              src="/imagenes/tinkus-puros.png"
              alt="Tinkus Puros y Naturales"
              className="absolute right-5 top-1/2 hidden h-36 w-36 -translate-y-1/2 rounded-full border-2 border-[#e9cf91]/60 bg-[#F6F0E3]/90 object-cover p-1 opacity-90 sm:block lg:right-10"
            />
            <div className="relative flex h-full max-w-3xl flex-col justify-center px-6 pb-8 sm:px-10">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#e9cf91] sm:text-xs">
                Fraternidad folklórica
              </p>
              <p className="mt-2 text-2xl font-black uppercase tracking-wide text-[#F6F0E3] sm:text-3xl">
                Tinkus Puros y Naturales
              </p>
              <p className="mt-2 max-w-lg text-xs text-[#F6F0E3]/75 sm:text-sm">
                Identidad, fuerza y tradición andina
              </p>
            </div>
          </div>

          <div className="relative px-4 pb-6 sm:px-8 sm:pb-8">
            <div className="-mt-14 flex flex-col gap-5 sm:-mt-16 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-end">
                {/* Foto de perfil */}

               <div className="grid h-28 w-28 shrink-0 place-items-center overflow-hidden rounded-full border-[5px] border-[#fffdf8] bg-[#74122A] text-2xl font-black text-[#F6F0E3] shadow-xl ring-2 ring-[#C59A3A] sm:h-32 sm:w-32 dark:border-[#262022]">
  {fotoPerfil ? (
    <img
      src={fotoPerfil}
      alt={`Foto de perfil de ${nombreCompleto}`}
      className="h-full w-full object-cover"
      onError={() => setErrorImagen(true)}
    />
  ) : (
    iniciales
  )}
</div>

                {/* Datos principales */}

                <div className="pb-1 text-center sm:text-left">
                  <h1 className="text-2xl font-black capitalize text-[#262022] sm:text-3xl dark:text-[#F6F0E3]">
                    {nombreCompleto ||
                      "Usuario"}
                  </h1>

                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {perfil.email ||
                      "Sin correo registrado"}
                  </p>

                  <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
                    <EstadoBadge
                      estado={
                        perfil.estado ||
                        "SIN ESTADO"
                      }
                    />

                    {nombresRoles && (
                      <span className="rounded-full border border-[#C59A3A]/40 bg-[#C59A3A]/15 px-3 py-1 text-xs font-bold text-[#74122A] dark:text-[#e9cf91]">
                        {nombresRoles}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Acciones */}

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() =>
                    navigate(-1)
                  }
                  className="rounded-xl border border-[#B7A7A0] bg-transparent px-5 py-2.5 text-sm font-bold text-[#4d4145] transition hover:border-[#74122A] hover:text-[#74122A] dark:text-[#F6F0E3]"
                >
                  Volver
                </button>

                {esAdministrador && (
                  <button
                    type="button"
                    onClick={() =>
                      navigate(`/perfilUsuario/${perfil._id}/editar`)
                    }
                    className="rounded-xl bg-[#74122A] px-5 py-2.5 text-sm font-bold text-[#F6F0E3] shadow-md transition hover:bg-[#5E0E22] hover:shadow-lg"
                  >
                    Editar perfil
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        {autorizacionQuery.data?.autorizacion && (
          <section className="overflow-hidden rounded-3xl border border-emerald-200 bg-white text-slate-800 shadow-lg shadow-emerald-900/5">
            <header className="bg-gradient-to-r from-emerald-800 to-emerald-600 px-5 py-5 text-white sm:px-7"><p className="text-xs font-bold uppercase tracking-[.2em] text-emerald-100">Permiso temporal</p><h2 className="mt-1 text-xl font-black">Edición habilitada por administración</h2><p className="mt-2 text-sm text-emerald-50"><strong>Motivo:</strong> {autorizacionQuery.data.autorizacion.motivo}</p><p className="mt-1 text-xs text-emerald-100">Disponible hasta {new Date(autorizacionQuery.data.autorizacion.fechaVencimiento).toLocaleString("es-BO")}.</p></header>
            <div className="p-5 sm:p-7">
            {autorizacionQuery.data.autorizacion.campos.includes("DATOS_PERSONALES") && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4"><h3 className="font-black text-emerald-900">Información personal autorizada</h3><p className="mt-1 text-xs text-slate-600">Corrige únicamente los datos necesarios y revisa que estén escritos correctamente.</p><div className="mt-3 grid gap-3 md:grid-cols-2">
                {[['nombres','Nombres'],['apellidoPaterno','Apellido paterno'],['apellidoMaterno','Apellido materno'],['telefono','Celular con WhatsApp'],['ci','Carnet de identidad']].map(([campo,label])=><label key={campo} className="text-sm font-bold">{label}<input value={datosEditables[campo as keyof typeof datosEditables]} onChange={e=>setDatosEditables(actual=>({...actual,[campo]:campo==='ci'?e.target.value.replace(/\D/g,''):e.target.value.toLocaleUpperCase('es-BO')}))} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>)}
                <label className="text-sm font-bold">Fecha de nacimiento<input type="date" value={datosEditables.fechaNacimiento} onChange={e=>setDatosEditables(actual=>({...actual,fechaNacimiento:e.target.value}))} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
                <label className="text-sm font-bold">Género<select value={datosEditables.sexo} onChange={e=>setDatosEditables(actual=>({...actual,sexo:e.target.value}))} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5"><option value="">Seleccionar</option><option value="HOMBRE">Hombre</option><option value="MUJER">Mujer</option></select></label>
              </div></div>
            )}
            {autorizacionQuery.data.autorizacion.campos.includes("CORREO_ELECTRONICO") && <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50/60 p-4"><h3 className="font-black text-blue-900">Correo electrónico autorizado</h3><p className="mt-1 text-xs text-slate-600">Al guardar, este será el nuevo correo para iniciar sesión. Deberá verificarse nuevamente.</p><label className="mt-3 block text-sm font-bold">Nuevo correo electrónico<input type="email" required autoComplete="email" value={correoEditable} onChange={e=>setCorreoEditable(e.target.value.toLowerCase())} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" placeholder="usuario@correo.com"/></label></div>}
            {autorizacionQuery.data.autorizacion.campos.includes("ORIGEN_ACADEMICO") && <OrigenAcademicoAutorizado valor={origenEditable} cambiar={setOrigenEditable}/>}
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {autorizacionQuery.data.autorizacion.campos.includes("FOTO_PERFIL") && <CampoArchivoElegante id="foto-perfil-edicion" titulo="Nueva foto de perfil" descripcion="Selecciona una fotografía clara y de frente." archivo={fotoNueva} accept="image/*" seleccionar={setFotoNueva}/>}
              {autorizacionQuery.data.autorizacion.campos.includes("REGISTRO_UNIVERSITARIO") && <CampoArchivoElegante id="ru-edicion" titulo="Registro universitario" descripcion="Puedes subir una imagen legible o un PDF." archivo={ruNuevo} accept=".pdf,application/pdf,image/*" seleccionar={setRuNuevo}/>}
            </div>
            {autorizacionQuery.data.autorizacion.campos.includes("CARNET_ANVERSO") && <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5"><div><h3 className="text-lg font-black text-[#74122A]">¿Cómo subirás tu carnet?</h3><p className="mt-1 text-sm text-slate-600">Elige una opción. No necesitas usar las dos.</p></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><button type="button" onClick={()=>cambiarTipoCarnet("PDF")} className={`rounded-2xl border-2 p-4 text-left transition ${tipoCarnet==="PDF"?"border-[#74122A] bg-[#74122A]/5 shadow-sm":"border-slate-200 bg-white hover:border-[#C59A3A]"}`}><FileText className="h-7 w-7 text-[#74122A]"/><strong className="mt-2 block">PDF completo</strong><span className="mt-1 block text-xs text-slate-600">Un solo PDF que contenga anverso y reverso. No se pedirá otro archivo.</span></button><button type="button" onClick={()=>cambiarTipoCarnet("IMAGENES")} className={`rounded-2xl border-2 p-4 text-left transition ${tipoCarnet==="IMAGENES"?"border-[#74122A] bg-[#74122A]/5 shadow-sm":"border-slate-200 bg-white hover:border-[#C59A3A]"}`}><Images className="h-7 w-7 text-[#74122A]"/><strong className="mt-2 block">Dos imágenes</strong><span className="mt-1 block text-xs text-slate-600">Una foto del anverso y otra del reverso, ambas claras y completas.</span></button></div>{tipoCarnet==="PDF"&&<div className="mt-4"><CampoArchivoElegante id="carnet-pdf-edicion" titulo="PDF completo del carnet" descripcion="Archivo PDF de hasta 30 MB con las dos caras." archivo={carnetFrente} accept=".pdf,application/pdf" seleccionar={archivo=>{setCarnetFrente(archivo);setCarnetReverso(null)}}/></div>}{tipoCarnet==="IMAGENES"&&<div className="mt-4 grid gap-4 sm:grid-cols-2"><CampoArchivoElegante id="carnet-anverso-edicion" titulo="Imagen del anverso" descripcion="La cara frontal debe verse completa." archivo={carnetFrente} accept="image/*" seleccionar={setCarnetFrente}/><CampoArchivoElegante id="carnet-reverso-edicion" titulo="Imagen del reverso" descripcion="La parte posterior debe verse completa." archivo={carnetReverso} accept="image/*" seleccionar={setCarnetReverso}/></div>}{!tipoCarnet&&<p className="mt-4 rounded-xl bg-blue-50 p-3 text-sm text-blue-800">Selecciona <strong>PDF completo</strong> o <strong>Dos imágenes</strong> para mostrar los archivos necesarios.</p>}</div>}
            {(fotoNueva || carnetFrente || carnetReverso || ruNuevo) && (
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {fotoNueva && <VistaPreviaArchivo titulo="Nueva foto de perfil" archivo={fotoNueva} quitar={() => setFotoNueva(null)} />}
                {carnetFrente && <VistaPreviaArchivo titulo={carnetFrente.type === "application/pdf" ? "Carnet en PDF" : "Anverso del carnet"} archivo={carnetFrente} quitar={() => setCarnetFrente(null)} />}
                {carnetReverso && <VistaPreviaArchivo titulo="Reverso del carnet" archivo={carnetReverso} quitar={() => setCarnetReverso(null)} />}
                {ruNuevo && <VistaPreviaArchivo titulo="Registro universitario" archivo={ruNuevo} quitar={() => setRuNuevo(null)} />}
              </div>
            )}
            <button type="button" disabled={completarMutation.isPending||(!autorizacionQuery.data.autorizacion.campos.includes("DATOS_PERSONALES")&&!autorizacionQuery.data.autorizacion.campos.includes("CORREO_ELECTRONICO")&&!autorizacionQuery.data.autorizacion.campos.includes("ORIGEN_ACADEMICO")&&!fotoNueva&&!carnetFrente&&!carnetReverso&&!ruNuevo)} onClick={guardarCambiosAutorizados} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3.5 font-bold text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"><UploadCloud className="h-5 w-5"/>{completarMutation.isPending?"Guardando cambios...":"Guardar cambios autorizados"}</button>
            </div>
          </section>
        )}

        {/* =========================================
            INFORMACIÓN PERSONAL
        ========================================= */}

        <section className="overflow-hidden rounded-[1.5rem] border border-[#cdbfae] bg-[#fffdf8] shadow-sm dark:border-[#B7A7A0]/30 dark:bg-[#262022]">
          <div className="border-b border-[#d8cbbb] bg-[#f5efe4] px-5 py-5 sm:px-7 dark:border-[#B7A7A0]/20 dark:bg-[#332B2E]">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#8F5F2A]">Datos del fraterno</p>
            <h2 className="mt-1 text-xl font-black text-[#74122A] dark:text-[#e9cf91]">
              Información personal
            </h2>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Datos registrados en tu cuenta.
            </p>
          </div>

          <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-7 lg:grid-cols-3">
            <DatoPerfil
              titulo="Nombres"
              valor={perfil.nombres}
              icono="👤"
            />

            <DatoPerfil
              titulo="Apellido paterno"
              valor={
                perfil.apellidoPaterno
              }
              icono="🪪"
            />

            <DatoPerfil
              titulo="Apellido materno"
              valor={
                perfil.apellidoMaterno
              }
              icono="🪪"
            />

            <DatoPerfil
              titulo="Correo electrónico"
              valor={perfil.email}
              icono="✉️"
            />

            <DatoPerfil
              titulo="Número de celular"
              valor={perfil.telefono}
              icono="📱"
            />

            <DatoPerfil
              titulo="Carnet de identidad"
              valor={[perfil.ci, perfil.complementoCi]
                .filter(Boolean)
                .join(" ")}
              icono="📄"
            />

            <DatoPerfil
              titulo="Fecha de nacimiento"
              valor={formatearFechaCivil(
                perfil.fechaNacimiento,
              )}
              icono="📅"
            />

            <DatoPerfil
              titulo="Género"
              valor={perfil.sexo}
              icono="⚧"
            />

            <DatoPerfil
              titulo="Estado de cuenta"
              valor={perfil.estado}
              icono="✅"
            />
          </div>
        </section>

        <section className="overflow-hidden rounded-[1.5rem] border border-[#cdbfae] bg-[#fffdf8] shadow-sm dark:border-[#B7A7A0]/30 dark:bg-[#262022]">
          <div className="border-b border-[#d8cbbb] bg-[#f5efe4] px-5 py-5 sm:px-7 dark:border-[#B7A7A0]/20 dark:bg-[#332B2E]"><p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#8F5F2A]">Archivos registrados</p><h2 className="mt-1 text-xl font-black text-[#74122A] dark:text-[#e9cf91]">Mis documentos</h2><p className="mt-1 text-sm text-slate-500">Revisa los documentos que enviaste y su estado de validación.</p></div>
          <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-7 lg:grid-cols-3">
            {perfil.documentos?.map((documento) => {
              const url = documento.ruta.startsWith("http") ? documento.ruta : `${backendUrl}${documento.ruta}`;
              const esPdf = documento.ruta.toLowerCase().endsWith(".pdf");
              const nombres: Record<string,string> = { CARNET_IDENTIDAD: "Carnet de identidad / anverso", CARNET_IDENTIDAD_REVERSO: "Reverso del carnet", REGISTRO_UNIVERSITARIO: "Registro universitario" };
              return <article key={documento._id} className="overflow-hidden rounded-2xl border border-[#d8cbbb] bg-white shadow-sm"><div className="flex h-52 items-center justify-center bg-slate-100">{esPdf ? <iframe src={url} title={nombres[documento.tipoDocumento] ?? documento.tipoDocumento} className="h-full w-full" /> : <img src={url} alt={nombres[documento.tipoDocumento] ?? documento.tipoDocumento} className="h-full w-full object-contain" />}</div><div className="p-4"><div className="flex items-start justify-between gap-2"><h3 className="font-black text-slate-800">{nombres[documento.tipoDocumento] ?? documento.tipoDocumento}</h3><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${documento.estado === "APROBADO" ? "bg-emerald-100 text-emerald-800" : documento.estado === "OBSERVADO" || documento.estado === "RECHAZADO" ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-700"}`}>{documento.estado}</span></div>{documento.observacion && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">{documento.observacion}</p>}<a href={url} target="_blank" rel="noreferrer" className="mt-3 inline-flex rounded-lg bg-[#841534] px-3 py-2 text-xs font-bold text-white">{esPdf ? "Abrir PDF" : "Ver imagen completa"}</a></div></article>;
            })}
            {!perfil.documentos?.length && <p className="col-span-full rounded-2xl bg-slate-50 p-8 text-center text-sm text-slate-500">No tienes documentos registrados.</p>}
          </div>
        </section>

        {indumentariaQuery.data?.fraterno && (
          <section className="overflow-hidden rounded-[1.5rem] border border-[#cdbfae] bg-[#fffdf8] shadow-sm dark:border-[#B7A7A0]/30 dark:bg-[#262022]">
            <div className="border-b border-[#d8cbbb] bg-[#f5efe4] px-5 py-5 sm:px-7 dark:border-[#B7A7A0]/20 dark:bg-[#332B2E]">
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#8F5F2A]">Entrega al fraterno</p>
              <h2 className="mt-1 text-xl font-black text-[#74122A] dark:text-[#e9cf91]">Mis tallas e indumentaria</h2>
              <p className="mt-1 text-sm text-slate-500">Consulta las prendas que administración registró como entregadas.</p>
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-7 lg:grid-cols-3">
              <PrendaPerfil nombre="POLERA" talla={indumentariaQuery.data.talla?.tallaPolera} entregas={indumentariaQuery.data.entregas} />
              <PrendaPerfil nombre="CHAMARRA" talla={indumentariaQuery.data.talla?.tallaChamarra} entregas={indumentariaQuery.data.entregas} />
              {indumentariaQuery.data.entregas.filter((entrega) => !["POLERA", "CHAMARRA"].includes(entrega.prendaId?.nombre)).map((entrega) => <PrendaPerfil key={entrega._id} nombre={entrega.prendaId?.nombre ?? "PRENDA"} talla={entrega.talla} entregas={[entrega]} />)}
              {!indumentariaQuery.data.entregas.some((entrega) => !["POLERA", "CHAMARRA"].includes(entrega.prendaId?.nombre)) && <div className="rounded-2xl border border-dashed border-[#d8cbbb] p-5 text-sm text-slate-500">Aún no tienes prendas del traje registradas.</div>}
            </div>
          </section>
        )}

        {/* =========================================
            INFORMACIÓN DEL SISTEMA
        ========================================= */}

        <section className="overflow-hidden rounded-[1.5rem] border border-[#cdbfae] bg-[#fffdf8] shadow-sm dark:border-[#B7A7A0]/30 dark:bg-[#262022]">
          <div className="border-b border-[#d8cbbb] bg-[#f5efe4] px-5 py-5 sm:px-7 dark:border-[#B7A7A0]/20 dark:bg-[#332B2E]">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#8F5F2A]">Registro institucional</p>
            <h2 className="mt-1 text-xl font-black text-[#74122A] dark:text-[#e9cf91]">
              Información de la cuenta
            </h2>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Información relacionada con el acceso al
              sistema.
            </p>
          </div>

          <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-7 lg:grid-cols-3">
            <DatoPerfil
              titulo="Rol"
              valor={nombresRoles}
              icono="🔐"
            />

            <DatoPerfil
              titulo="Tipo de origen"
              valor={perfil.tipoOrigen}
              icono="📍"
            />

            <DatoPerfil
              titulo="Fecha de registro"
              valor={formatearFecha(
                perfil.fechaCreado,
              )}
              icono="🗓️"
            />

            <DatoPerfil
              titulo="Última actualización"
              valor={formatearFecha(
                perfil.fechaEdit,
              )}
              icono="🔄"
            />

            <DatoPerfil
              titulo="Identificador"
              valor={perfil._id}
              icono="🆔"
            />
          </div>
        </section>

        <button
          type="button"
          onClick={() => navigate(-1)}
          className="w-full rounded-2xl border border-[#B7A7A0] bg-[#fffdf8] px-5 py-3.5 font-bold text-[#4d4145] shadow-sm transition hover:border-[#74122A] hover:text-[#74122A] dark:bg-[#262022] dark:text-[#F6F0E3]"
        >
          ← Volver
        </button>
      </div>
      {modalCambiosGuardados ? <div className="fixed inset-0 z-[200] grid place-items-center bg-slate-950/70 p-4" role="dialog" aria-modal="true" aria-labelledby="titulo-cambios-guardados"><section className="w-full max-w-md rounded-3xl bg-white p-7 text-center shadow-2xl"><div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-3xl text-emerald-700">✓</div><h2 id="titulo-cambios-guardados" className="mt-4 text-2xl font-black text-[#841534]">Cambios realizados</h2><p className="mt-3 leading-6 text-slate-600">Tus datos y documentos nuevos se guardaron correctamente. Los documentos enviados quedaron pendientes de revisión administrativa.</p><button type="button" autoFocus onClick={() => setModalCambiosGuardados(false)} className="mt-6 w-full rounded-xl bg-[#841534] px-5 py-3 font-bold text-white">Entendido</button></section></div> : null}
    </div>
  );
}

function PrendaPerfil({ nombre, talla, entregas }: { nombre: string; talla?: string; entregas: Array<{ estado: string; fechaEntrega: string; prendaId?: { nombre?: string } }> }) {
  const entrega = entregas.find((item) => item.prendaId?.nombre === nombre && item.estado === "ENTREGADO");
  return <article className="rounded-2xl border border-[#d8cbbb] bg-white p-5 shadow-sm">
    <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-[#8F5F2A]">Prenda</p><h3 className="mt-1 font-black text-slate-800">{nombre}</h3></div><span className={`rounded-full px-3 py-1 text-[10px] font-black ${entrega ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{entrega ? "ENTREGADO" : "NO ENTREGADO"}</span></div>
    {talla && <p className="mt-4 text-sm text-slate-600">Talla: <strong className="text-slate-900">{talla}</strong></p>}
    {entrega && <p className="mt-1 text-xs text-slate-500">Fecha de entrega: {new Date(entrega.fechaEntrega).toLocaleDateString("es-BO")}</p>}
  </article>;
}

/* =========================================
   COMPONENTE PARA MOSTRAR UN DATO
========================================= */

type DatoPerfilProps = {
  titulo: string;
  valor?: string | number | null;
  icono?: string;
};

function CampoArchivoElegante({ id, titulo, descripcion, archivo, accept, seleccionar }: { id: string; titulo: string; descripcion: string; archivo: File | null; accept: string; seleccionar: (archivo: File | null) => void }) {
  const tamano = archivo
    ? archivo.size < 1024 * 1024
      ? `${(archivo.size / 1024).toFixed(1)} KB`
      : `${(archivo.size / 1024 / 1024).toFixed(2)} MB`
    : "";
  return <div className={`rounded-2xl border-2 border-dashed p-4 transition ${archivo ? "border-emerald-400 bg-emerald-50" : "border-slate-300 bg-white"}`}><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#74122A]/10 text-[#74122A]"><UploadCloud className="h-5 w-5"/></span><div className="min-w-0"><p className="font-black text-slate-800">{titulo}</p><p className="mt-1 text-xs leading-5 text-slate-500">{descripcion}</p></div></div>{archivo?<div className="mt-3 rounded-xl border border-emerald-200 bg-white p-3"><p className="truncate text-sm font-bold text-emerald-900">{archivo.name}</p><p className="mt-1 text-xs text-emerald-700">{tamano} · archivo listo</p><div className="mt-3 flex gap-2"><label htmlFor={id} className="cursor-pointer rounded-lg border border-emerald-300 px-3 py-2 text-xs font-bold text-emerald-800">Cambiar archivo</label><button type="button" onClick={()=>seleccionar(null)} className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700">Quitar</button></div></div>:<label htmlFor={id} className="mt-4 flex cursor-pointer items-center justify-center rounded-xl bg-[#74122A] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#5E0E22]">Seleccionar archivo</label>}<input id={id} type="file" accept={accept} className="sr-only" onChange={evento=>{seleccionar(evento.target.files?.[0]??null);evento.target.value=""}}/></div>;
}

function VistaPreviaArchivo({ titulo, archivo, quitar }: { titulo: string; archivo: File; quitar: () => void }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const nuevaUrl = URL.createObjectURL(archivo);
    setUrl(nuevaUrl);
    return () => URL.revokeObjectURL(nuevaUrl);
  }, [archivo]);
  const esPdf = archivo.type === "application/pdf" || archivo.name.toLowerCase().endsWith(".pdf");
  const tamano = archivo.size < 1024 * 1024 ? `${(archivo.size / 1024).toFixed(1)} KB` : `${(archivo.size / 1024 / 1024).toFixed(2)} MB`;
  return (
    <article className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b p-3"><div className="min-w-0"><p className="font-bold text-slate-800">{titulo}</p><p className="truncate text-xs text-slate-500">{archivo.name} · {tamano}</p></div><button type="button" onClick={quitar} className="shrink-0 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700">Quitar</button></div>
      {esPdf ? <iframe src={url} title={`Vista previa de ${titulo}`} className="h-72 w-full bg-slate-100" /> : <img src={url} alt={`Vista previa de ${titulo}`} className="h-72 w-full bg-slate-100 object-contain" />}
    </article>
  );
}

function DatoPerfil({
  titulo,
  valor,
  icono,
}: DatoPerfilProps) {
  const contenido =
    valor !== undefined &&
    valor !== null &&
    String(valor).trim() !== ""
      ? String(valor)
      : "No registrado";

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-[#ddd2c3] bg-[#faf7f1] p-4 transition duration-300 hover:-translate-y-0.5 hover:border-[#C59A3A] hover:bg-white hover:shadow-md dark:border-[#B7A7A0]/25 dark:bg-[#211c1e] dark:hover:border-[#C59A3A]/60">
      <div className="absolute inset-y-0 left-0 w-1 bg-[#74122A] opacity-0 transition group-hover:opacity-100" />
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#C59A3A]/25 bg-white text-lg shadow-sm dark:bg-[#332B2E]">
          {icono}
        </span>

        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8a7469] dark:text-[#B7A7A0]">
            {titulo}
          </p>

          <p className="mt-1 break-words text-sm font-bold text-[#332B2E] dark:text-[#F6F0E3]">
            {contenido}
          </p>
        </div>
      </div>
    </div>
  );
}

/* =========================================
   BADGE DEL ESTADO
========================================= */

function EstadoBadge({
  estado,
}: {
  estado: string;
}) {
  const estadoNormalizado =
    estado.toUpperCase();

  const estilos =
    estadoNormalizado === "ACTIVO" ||
    estadoNormalizado === "APROBADO"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
      : estadoNormalizado ===
          "PENDIENTE"
        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
        : estadoNormalizado ===
            "INACTIVO"
          ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
          : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${estilos}`}
    >
      {estadoNormalizado}
    </span>
  );
}

/* =========================================
   FORMATEAR FECHA
========================================= */

function formatearFecha(
  fecha?: string | Date | null,
) {
  if (!fecha) {
    return "No registrado";
  }

  const fechaConvertida =
    new Date(fecha);

  if (
    Number.isNaN(
      fechaConvertida.getTime(),
    )
  ) {
    return String(fecha);
  }

  return fechaConvertida.toLocaleDateString(
    "es-BO",
    {
      day: "2-digit",
      month: "long",
      year: "numeric",
    },
  );
}

/* =========================================
   SKELETON
========================================= */

function PerfilSkeleton() {
  return (
    <div className="w-full px-3 py-4 sm:px-5 sm:py-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="h-32 animate-pulse bg-slate-200 sm:h-40 dark:bg-slate-800" />

          <div className="px-6 pb-6">
            <div className="-mt-14 flex flex-col items-center gap-4 sm:flex-row sm:items-end">
              <div className="h-28 w-28 animate-pulse rounded-full border-4 border-white bg-slate-300 sm:h-32 sm:w-32 dark:border-slate-900 dark:bg-slate-700" />

              <div className="w-full space-y-3 pb-2 sm:w-auto">
                <div className="h-7 w-56 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                <div className="h-4 w-40 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-6 h-7 w-48 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({
              length: 6,
            }).map((_, index) => (
              <div
                key={index}
                className="h-24 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
