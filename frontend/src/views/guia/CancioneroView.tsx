import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { consultarPermisoPublicar, listarPasos, publicarPaso } from "@/api/PasoVideoApi";
import { MiniaturaYoutube } from "./PasosVideoView";

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

  return <main className="space-y-6"><header className="rounded-3xl bg-[#841534] p-6 text-white"><p className="text-xs font-bold uppercase tracking-widest text-[#e9cf91]">Música institucional</p><h1 className="text-3xl font-black">Cancionero</h1><p className="mb-4 mt-2">Canciones para ensayos y presentaciones.</p><Link to="/comunicados" className="rounded-xl border px-4 py-2 font-bold">← Volver a Comunicados</Link></header>
    {permiso.data ? <form onSubmit={(evento) => { evento.preventDefault(); crear.mutate(); }} className="grid gap-4 rounded-2xl bg-white p-5 sm:grid-cols-2"><h2 className="text-xl font-black text-[#841534] sm:col-span-2">Subir canción</h2><input required className="input-preregistro" placeholder="Nombre de la canción" value={form.titulo} onChange={(evento) => setForm({ ...form, titulo: evento.target.value })} /><input className="input-preregistro" placeholder="Enlace de YouTube" value={form.youtubeUrl} onChange={(evento) => setForm({ ...form, youtubeUrl: evento.target.value, video: null })} /><textarea className="input-preregistro sm:col-span-2" placeholder="Letra, descripción o indicaciones" value={form.descripcion} onChange={(evento) => setForm({ ...form, descripcion: evento.target.value })} /><input type="file" accept="audio/*,video/*" className="input-preregistro sm:col-span-2" onChange={(evento) => setForm({ ...form, video: evento.target.files?.[0] ?? null, youtubeUrl: "" })} /><button disabled={crear.isPending || (!form.video && !form.youtubeUrl)} className="rounded-xl bg-[#841534] p-3 font-bold text-white sm:col-span-2">{crear.isPending ? "Comprimiendo..." : "Publicar canción"}</button></form> : null}
    <section className="grid gap-4 md:grid-cols-2">{consulta.data?.map((cancion) => <article key={cancion._id} className="overflow-hidden rounded-2xl bg-white shadow dark:bg-[#262022]">{cancion.tipoFuente === "ARCHIVO" ? <div className="p-5"><audio controls preload="metadata" className="w-full" src={`${API}${cancion.rutaVideo}`} /></div> : <MiniaturaYoutube contenido={cancion} />}<div className="p-5"><h2 className="text-xl font-black text-[#841534] dark:text-[#e9cf91]">{cancion.titulo}</h2><p className="text-xs text-[#8F5F2A]">Subido por {cancion.autorNombre}</p>{cancion.descripcion ? <p className="mt-3 whitespace-pre-wrap text-sm">{cancion.descripcion}</p> : null}</div></article>)}</section>
    {!consulta.isLoading && !consulta.data?.length ? <p className="rounded-2xl bg-white p-8 text-center">Todavía no hay canciones.</p> : null}
  </main>;
}
