

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { esRolPoblado } from "@/types/PerfilUsuarioType";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import api from "@/lib/axios";
import { obtenerMiIndumentaria } from "@/api/IndumentariaApi";
import { formatearFechaCivil } from "@/utils/fechaCivil";

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
  const [fotoNueva,setFotoNueva]=useState<File|null>(null); const [carnetFrente,setCarnetFrente]=useState<File|null>(null); const [carnetReverso,setCarnetReverso]=useState<File|null>(null); const [ruNuevo,setRuNuevo]=useState<File|null>(null); const queryClient=useQueryClient();
  const [datosEditables,setDatosEditables]=useState({nombres:"",apellidoPaterno:"",apellidoMaterno:"",telefono:"",ci:"",fechaNacimiento:"",sexo:""});
  useEffect(()=>{if(perfil)setDatosEditables({nombres:perfil.nombres??"",apellidoPaterno:perfil.apellidoPaterno??"",apellidoMaterno:perfil.apellidoMaterno??"",telefono:perfil.telefono??"",ci:perfil.ci??"",fechaNacimiento:perfil.fechaNacimiento?String(perfil.fechaNacimiento).slice(0,10):"",sexo:perfil.sexo??""});},[perfil]);
  const autorizacionQuery=useQuery({queryKey:["mi-autorizacion-edicion"],queryFn:async()=> (await api.get("/perfilusuario/autorizacion-edicion/mia")).data});
  const indumentariaQuery=useQuery({queryKey:["mi-indumentaria"],queryFn:obtenerMiIndumentaria});
  const completarMutation=useMutation({mutationFn:async()=>{const fd=new FormData();if(fotoNueva)fd.append("fotoPerfil",fotoNueva);if(carnetFrente)fd.append("carnetIdentidadPdf",carnetFrente);if(carnetReverso)fd.append("carnetIdentidadReverso",carnetReverso);if(ruNuevo)fd.append("registroUniversitarioPdf",ruNuevo);if(autorizacionQuery.data?.autorizacion?.campos.includes("DATOS_PERSONALES"))Object.entries(datosEditables).forEach(([campo,valor])=>fd.append(campo,valor));return(await api.post("/perfilusuario/completar-perfil-autorizado",fd)).data;},onSuccess:async r=>{toast.success(r.message);setModalCambiosGuardados(true);setFotoNueva(null);setCarnetFrente(null);setCarnetReverso(null);setRuNuevo(null);await Promise.all([queryClient.invalidateQueries({queryKey:["usuario"]}),queryClient.invalidateQueries({queryKey:["mi-autorizacion-edicion"]})]);},onError:(e:any)=>toast.error(e.response?.data?.error??"No se pudo actualizar")});

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
          <section className="rounded-3xl border border-emerald-300 bg-emerald-50 p-5 text-slate-800 shadow-sm">
            <h2 className="text-lg font-black text-emerald-800">Edición habilitada por administración</h2>
            <p className="mt-1 text-sm">Motivo: {autorizacionQuery.data.autorizacion.motivo}. Vigente hasta {new Date(autorizacionQuery.data.autorizacion.fechaVencimiento).toLocaleString()}.</p>
            {autorizacionQuery.data.autorizacion.campos.includes("DATOS_PERSONALES") && (
              <div className="mt-5 rounded-2xl border border-emerald-200 bg-white p-4"><h3 className="font-black text-emerald-800">Información personal autorizada</h3><div className="mt-3 grid gap-3 md:grid-cols-2">
                {[['nombres','Nombres'],['apellidoPaterno','Apellido paterno'],['apellidoMaterno','Apellido materno'],['telefono','Celular con WhatsApp'],['ci','Carnet de identidad']].map(([campo,label])=><label key={campo} className="text-sm font-bold">{label}<input value={datosEditables[campo as keyof typeof datosEditables]} onChange={e=>setDatosEditables(actual=>({...actual,[campo]:campo==='ci'?e.target.value.replace(/\D/g,''):e.target.value.toLocaleUpperCase('es-BO')}))} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>)}
                <label className="text-sm font-bold">Fecha de nacimiento<input type="date" value={datosEditables.fechaNacimiento} onChange={e=>setDatosEditables(actual=>({...actual,fechaNacimiento:e.target.value}))} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
                <label className="text-sm font-bold">Género<select value={datosEditables.sexo} onChange={e=>setDatosEditables(actual=>({...actual,sexo:e.target.value}))} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5"><option value="">Seleccionar</option><option value="HOMBRE">Hombre</option><option value="MUJER">Mujer</option></select></label>
              </div></div>
            )}
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {autorizacionQuery.data.autorizacion.campos.includes("FOTO_PERFIL") && <label className="text-sm font-bold">Foto de perfil<input className="mt-1 block w-full text-xs" type="file" accept="image/*" onChange={e=>setFotoNueva(e.target.files?.[0]??null)}/></label>}
              {autorizacionQuery.data.autorizacion.campos.includes("CARNET_ANVERSO") && <label className="text-sm font-bold">Carnet completo: PDF o anverso<input className="mt-1 block w-full text-xs" type="file" accept=".pdf,application/pdf,image/*" onChange={e=>{const archivo=e.target.files?.[0]??null;setCarnetFrente(archivo);if(archivo&&(archivo.type==="application/pdf"||archivo.name.toLowerCase().endsWith(".pdf")))setCarnetReverso(null)}}/></label>}
              {autorizacionQuery.data.autorizacion.campos.includes("CARNET_REVERSO") && !(carnetFrente&&(carnetFrente.type==="application/pdf"||carnetFrente.name.toLowerCase().endsWith(".pdf"))) && <label className="text-sm font-bold">Reverso del carnet (obligatorio si eliges imagen)<input className="mt-1 block w-full text-xs" type="file" accept="image/*" onChange={e=>setCarnetReverso(e.target.files?.[0]??null)}/></label>}
              {autorizacionQuery.data.autorizacion.campos.includes("REGISTRO_UNIVERSITARIO") && <label className="text-sm font-bold">Registro universitario PDF o imagen<input className="mt-1 block w-full text-xs" type="file" accept=".pdf,application/pdf,image/*" onChange={e=>setRuNuevo(e.target.files?.[0]??null)}/></label>}
            </div>
            {(fotoNueva || carnetFrente || carnetReverso || ruNuevo) && (
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {fotoNueva && <VistaPreviaArchivo titulo="Nueva foto de perfil" archivo={fotoNueva} quitar={() => setFotoNueva(null)} />}
                {carnetFrente && <VistaPreviaArchivo titulo={carnetFrente.type === "application/pdf" ? "Carnet en PDF" : "Anverso del carnet"} archivo={carnetFrente} quitar={() => setCarnetFrente(null)} />}
                {carnetReverso && <VistaPreviaArchivo titulo="Reverso del carnet" archivo={carnetReverso} quitar={() => setCarnetReverso(null)} />}
                {ruNuevo && <VistaPreviaArchivo titulo="Registro universitario" archivo={ruNuevo} quitar={() => setRuNuevo(null)} />}
              </div>
            )}
            <button type="button" disabled={completarMutation.isPending||(!autorizacionQuery.data.autorizacion.campos.includes("DATOS_PERSONALES")&&!fotoNueva&&!carnetFrente&&!carnetReverso&&!ruNuevo)} onClick={()=>completarMutation.mutate()} className="mt-4 rounded-xl bg-emerald-700 px-5 py-2.5 font-bold text-white disabled:opacity-50">{completarMutation.isPending?"Guardando...":"Guardar cambios autorizados"}</button>
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
