import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { consultarPermisoPublicar, eliminarPaso, listarPasos, publicarPaso, type PasoVideo } from "@/api/PasoVideoApi";

const API = String(import.meta.env.VITE_API_URL || "").replace(/\/api\/?$/, "");

export const youtubeId = (url?: string) => {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    return parsed.hostname.includes("youtu.be")
      ? parsed.pathname.slice(1).split("/")[0]
      : parsed.searchParams.get("v") || parsed.pathname.split("/").filter(Boolean).pop() || "";
  } catch {
    return "";
  }
};

export const youtubeThumbnail = (url?: string) => {
  const id = youtubeId(url);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : "";
};

export function MiniaturaYoutube({ contenido }: { contenido: PasoVideo }) {
  const miniatura = youtubeThumbnail(contenido.youtubeUrl);
  return (
    <a href={contenido.youtubeUrl} target="_blank" rel="noreferrer" className="group relative block aspect-video overflow-hidden bg-[#171214]" aria-label={`Abrir ${contenido.titulo} en YouTube`}>
      {miniatura ? <img src={miniatura} alt={`Miniatura de ${contenido.titulo}`} loading="lazy" decoding="async" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" /> : <div className="grid h-full place-items-center text-sm text-white/70">Video de YouTube</div>}
      <span className="absolute inset-0 bg-black/20 transition group-hover:bg-black/10" />
      <span className="absolute left-1/2 top-1/2 grid h-14 w-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-2xl bg-red-600 text-2xl text-white shadow-xl" aria-hidden="true">▶</span>
      <span className="absolute bottom-3 right-3 rounded-lg bg-black/75 px-3 py-1 text-xs font-bold text-white">Abrir en YouTube</span>
    </a>
  );
}

export default function PasosVideoView() {
  const qc = useQueryClient();
  const permiso = useQuery({ queryKey: ["permiso-publicar-formacion"], queryFn: consultarPermisoPublicar });
  const puedePublicar = Boolean(permiso.data);
  const [form, setForm] = useState({ titulo: "", descripcion: "", youtubeUrl: "", video: null as File | null });
  const consulta = useQuery({ queryKey: ["pasos-videos", "PASO"], queryFn: () => listarPasos("PASO") });
  const crear = useMutation({
    mutationFn: () => publicarPaso({ ...form, categoria: "PASO" }),
    onSuccess: async (respuesta) => {
      toast.success(respuesta.message);
      setForm({ titulo: "", descripcion: "", youtubeUrl: "", video: null });
      await qc.invalidateQueries({ queryKey: ["pasos-videos", "PASO"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const borrar = useMutation({ mutationFn: eliminarPaso, onSuccess: () => qc.invalidateQueries({ queryKey: ["pasos-videos", "PASO"] }) });

  return (
    <Contenido titulo="Biblioteca de pasos" subtitulo="Aprende pasos creados y sugeridos por nuestros guías y postulantes a guía.">
      <Link to="/comunicados" className="inline-block rounded-xl border border-white/30 px-4 py-2 font-bold">← Volver a mi panel</Link>
      {puedePublicar ? <Formulario form={form} setForm={setForm} enviar={() => crear.mutate()} cargando={crear.isPending} /> : null}
      <section className="grid gap-5 md:grid-cols-2">
        {consulta.data?.map((video) => (
          <article key={video._id} className="overflow-hidden rounded-2xl bg-white shadow dark:bg-[#262022]">
            {video.tipoFuente === "ARCHIVO" ? <div className="aspect-video bg-black"><video controls preload="metadata" className="h-full w-full" src={`${API}${video.rutaVideo}`} /></div> : <MiniaturaYoutube contenido={video} />}
            <div className="p-5"><h2 className="text-xl font-black text-[#841534] dark:text-[#e9cf91]">{video.titulo}</h2><p className="text-xs font-bold text-[#8F5F2A]">Creado por {video.autorNombre}</p>{video.descripcion ? <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{video.descripcion}</p> : null}{puedePublicar ? <button type="button" onClick={() => borrar.mutate(video._id)} className="mt-3 text-sm font-bold text-red-700">Quitar</button> : null}</div>
          </article>
        ))}
      </section>
      {!consulta.isLoading && !consulta.data?.length ? <p className="rounded-2xl bg-white p-10 text-center text-slate-500">Todavía no se publicaron pasos.</p> : null}
    </Contenido>
  );
}

function Contenido({ titulo, subtitulo, children }: { titulo: string; subtitulo: string; children: ReactNode }) {
  const elementos = Array.isArray(children) ? children : [children];
  return <main className="space-y-6"><header className="rounded-3xl bg-[#841534] p-6 text-white"><p className="text-xs font-bold uppercase tracking-[.2em] text-[#e9cf91]">Formación y danza</p><h1 className="mt-1 text-3xl font-black">{titulo}</h1><p className="mb-4 mt-2 text-white/80">{subtitulo}</p>{elementos[0]}</header>{elementos.slice(1)}</main>;
}

function Formulario({ form, setForm, enviar, cargando }: { form: { titulo: string; descripcion: string; youtubeUrl: string; video: File | null }; setForm: (formulario: { titulo: string; descripcion: string; youtubeUrl: string; video: File | null }) => void; enviar: () => void; cargando: boolean }) {
  return <form onSubmit={(evento) => { evento.preventDefault(); enviar(); }} className="grid gap-4 rounded-2xl bg-white p-5 shadow sm:grid-cols-2"><h2 className="text-xl font-black text-[#841534] sm:col-span-2">Publicar un paso</h2><input required placeholder="Nombre del paso" className="input-preregistro" value={form.titulo} onChange={(evento) => setForm({ ...form, titulo: evento.target.value })} /><input placeholder="Enlace de YouTube" className="input-preregistro" value={form.youtubeUrl} onChange={(evento) => setForm({ ...form, youtubeUrl: evento.target.value, video: null })} /><textarea placeholder="Descripción o sugerencia" className="input-preregistro min-h-24 sm:col-span-2" value={form.descripcion} onChange={(evento) => setForm({ ...form, descripcion: evento.target.value })} /><label className="sm:col-span-2"><b>Subir video</b><input type="file" accept="video/*" className="input-preregistro mt-1" onChange={(evento) => setForm({ ...form, video: evento.target.files?.[0] ?? null, youtubeUrl: "" })} /></label><button disabled={cargando || (!form.video && !form.youtubeUrl)} className="rounded-xl bg-[#841534] p-3 font-bold text-white sm:col-span-2">{cargando ? "Convirtiendo..." : "Publicar paso"}</button></form>;
}
