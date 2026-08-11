import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { consultarPermisoPublicar, listarPasos, publicarPaso, type PasoVideo } from "@/api/PasoVideoApi";
import { MiniaturaYoutube, youtubeThumbnail } from "./PasosVideoView";
import { descargarLetraPdf } from "@/utils/cancionPdf";

const API = String(import.meta.env.VITE_API_URL || "").replace(/\/api\/?$/, "");

export default function CancioneroView() {
  const qc = useQueryClient();
  const permiso = useQuery({ queryKey: ["permiso-publicar-formacion"], queryFn: consultarPermisoPublicar });
  const consulta = useQuery({ queryKey: ["pasos-videos", "CANCION"], queryFn: () => listarPasos("CANCION") });
  const [form, setForm] = useState({ titulo: "", descripcion: "", youtubeUrl: "", video: null as File | null });
  const crear = useMutation({
    mutationFn: () => publicarPaso({ ...form, categoria: "CANCION" }),
    onSuccess: async (respuesta) => {
      toast.success(respuesta.message);
      setForm({ titulo: "", descripcion: "", youtubeUrl: "", video: null });
      await qc.invalidateQueries({ queryKey: ["pasos-videos", "CANCION"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return <main className="space-y-6"><header className="rounded-3xl bg-[#841534] p-6 text-white"><p className="text-xs font-bold uppercase tracking-widest text-[#e9cf91]">Música institucional</p><h1 className="text-3xl font-black">Cancionero</h1><p className="mb-4 mt-2 text-white/80">Escucha, practica y lleva contigo las letras de la fraternidad.</p><Link to="/comunicados" className="rounded-xl border border-white/30 px-4 py-2 font-bold">← Volver a mi panel</Link></header>
    {permiso.data ? <form onSubmit={(evento) => { evento.preventDefault(); crear.mutate(); }} className="grid gap-4 rounded-2xl bg-white p-5 sm:grid-cols-2"><h2 className="text-xl font-black text-[#841534] sm:col-span-2">Publicar canción</h2><input required className="input-preregistro" placeholder="Nombre de la canción" value={form.titulo} onChange={(evento) => setForm({ ...form, titulo: evento.target.value })} /><input className="input-preregistro" placeholder="Enlace de YouTube" value={form.youtubeUrl} onChange={(evento) => setForm({ ...form, youtubeUrl: evento.target.value, video: null })} /><textarea className="input-preregistro min-h-36 sm:col-span-2" placeholder="Letra completa de la canción" value={form.descripcion} onChange={(evento) => setForm({ ...form, descripcion: evento.target.value })} /><input type="file" accept="audio/*,video/*" className="input-preregistro sm:col-span-2" onChange={(evento) => setForm({ ...form, video: evento.target.files?.[0] ?? null, youtubeUrl: "" })} /><button disabled={crear.isPending || (!form.video && !form.youtubeUrl)} className="rounded-xl bg-[#841534] p-3 font-bold text-white sm:col-span-2">{crear.isPending ? "Preparando..." : "Publicar canción"}</button></form> : null}
    <section className="grid gap-4">{consulta.data?.map((cancion) => <CancionDesplegable key={cancion._id} cancion={cancion} />)}</section>
    {!consulta.isLoading && !consulta.data?.length ? <p className="rounded-2xl bg-white p-8 text-center text-slate-500">Todavía no hay canciones publicadas.</p> : null}
  </main>;
}

function CancionDesplegable({ cancion }: { cancion: PasoVideo }) {
  const miniatura = cancion.tipoFuente === "YOUTUBE" ? youtubeThumbnail(cancion.youtubeUrl) : "";
  const copiar = async () => {
    await navigator.clipboard.writeText(`${cancion.titulo}\n\n${cancion.descripcion ?? ""}`);
    toast.success("Letra copiada");
  };
  return <details className="group overflow-hidden rounded-2xl border border-[#d9c8aa] bg-white shadow-sm dark:border-white/10 dark:bg-[#262022]">
    <summary className="flex cursor-pointer list-none items-center gap-4 p-3 sm:p-4"><div className="h-20 w-28 shrink-0 overflow-hidden rounded-xl bg-[#241b1e]">{miniatura ? <img src={miniatura} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-3xl" aria-hidden="true">🎵</div>}</div><div className="min-w-0 flex-1"><h2 className="truncate text-lg font-black text-[#841534] dark:text-[#e9cf91]">{cancion.titulo}</h2><p className="mt-1 text-xs text-[#8F5F2A]">{cancion.autorNombre}</p><p className="mt-2 text-xs font-bold text-slate-500 group-open:hidden">Toca para ver video y letra</p></div><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#841534] text-white transition group-open:rotate-180" aria-hidden="true">⌄</span></summary>
    <div className="border-t border-[#eee3d2] p-4 sm:p-5"><div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,.9fr)]"><div>{cancion.tipoFuente === "YOUTUBE" ? <MiniaturaYoutube contenido={cancion} /> : <div className="rounded-xl bg-[#f5efe4] p-4 dark:bg-black/20"><audio controls preload="none" className="w-full" src={`${API}${cancion.rutaVideo}`} /></div>}</div><div><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-black text-[#74122A] dark:text-[#e9cf91]">Letra</h3>{cancion.descripcion ? <div className="flex gap-2"><button type="button" onClick={copiar} className="rounded-lg border border-[#841534] px-3 py-2 text-xs font-bold text-[#841534] dark:text-[#e9cf91]">Copiar</button><button type="button" onClick={() => descargarLetraPdf(cancion.titulo, cancion.descripcion ?? "")} className="rounded-lg bg-[#841534] px-3 py-2 text-xs font-bold text-white">Descargar PDF</button></div> : null}</div>{cancion.descripcion ? <p className="mt-4 max-h-80 overflow-y-auto whitespace-pre-wrap rounded-xl bg-[#faf7f1] p-4 text-sm leading-7 text-[#382d30] dark:bg-black/20 dark:text-slate-200">{cancion.descripcion}</p> : <p className="mt-4 text-sm text-slate-500">Esta canción todavía no tiene letra registrada.</p>}</div></div></div>
  </details>;
}
