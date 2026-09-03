import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import api from "@/lib/axios";

const API=String(import.meta.env.VITE_API_URL||"").replace(/\/api\/?$/,"");
const nombre=(g:any)=>[g?.usuarioId?.nombres,g?.usuarioId?.apellidoPaterno,g?.usuarioId?.apellidoMaterno].filter(Boolean).join(" ");
const genero=(v:any)=>["HOMBRE","MASCULINO","M","VARON","VARÓN"].includes(String(v??"").toUpperCase())?"HOMBRE":"MUJER";

export default function MiBloqueFraternoView(){
 const q=useQuery({queryKey:["mi-bloque-fraterno"],queryFn:async()=>(await api.get("/fraternos/mi-bloque")).data});
 if(q.isLoading)return <main className="grid min-h-screen place-items-center bg-[#eee8dc] p-5"><p>Cargando tu bloque...</p></main>;
 if(q.isError)return <Estado titulo="No se pudo consultar tu bloque" texto="Verifica que Administración te haya registrado como fraterno."/>;
 const bloque=q.data.bloque;if(!bloque)return <Estado titulo="Aún no tienes un bloque asignado" texto="Cuando un guía te incorpore a su bloque, aquí aparecerán el nombre y tus guías responsables."/>;
 const guias=bloque.guiasIds?.length?bloque.guiasIds:[bloque.guiaId].filter(Boolean),hombres=guias.filter((g:any)=>genero(g.usuarioId?.sexo)==="HOMBRE"),mujeres=guias.filter((g:any)=>genero(g.usuarioId?.sexo)==="MUJER");
 return <main className="min-h-screen bg-[#eee8dc] p-4 sm:p-8"><div className="mx-auto max-w-5xl space-y-5"><header className="rounded-3xl bg-[#841534] p-6 text-white"><p className="text-xs font-bold uppercase tracking-[.25em] text-[#e9cf91]">Información del fraterno</p><h1 className="mt-2 text-3xl font-black">Mi bloque</h1><Link to="/comunicados" className="mt-4 inline-block rounded-xl border border-white/30 px-4 py-2 text-sm font-bold">← Volver a comunicados</Link></header>
  <section className="overflow-hidden rounded-3xl bg-white shadow"><div className="bg-[#292329] p-6 text-white"><p className="text-xs font-bold uppercase tracking-widest text-amber-300">Ya tienes un bloque asignado</p><h2 className="mt-2 text-3xl font-black">{bloque.nombre}</h2></div></section>
  <section className="rounded-3xl bg-white p-6 shadow"><h2 className="text-xl font-black text-[#841534]">Tus guías</h2><p className="mt-1 text-sm text-slate-500">Identifica a las personas responsables de tu bloque.</p><div className="mt-5 grid gap-5 lg:grid-cols-2"><Grupo titulo="Guías hombres" guias={hombres}/><Grupo titulo="Guías mujeres" guias={mujeres}/></div></section>
 </div></main>;
}
function Grupo({titulo,guias}:{titulo:string;guias:any[]}){return <div><h3 className="font-black text-slate-700">{titulo}</h3><div className="mt-3 grid gap-3 sm:grid-cols-2">{guias.map(g=>{const u=g.usuarioId,ruta=u?.fotoPerfil?(u.fotoPerfil.startsWith("http")?u.fotoPerfil:`${API}${u.fotoPerfil}`):"";return <article key={g._id} className="rounded-2xl border bg-slate-50 p-4 text-center">{ruta?<img src={ruta} alt={`Foto de ${nombre(g)}`} className="mx-auto h-28 w-28 rounded-2xl object-cover"/>:<div className="mx-auto grid h-28 w-28 place-items-center rounded-2xl bg-slate-200 text-3xl font-black text-[#841534]">{nombre(g).charAt(0)}</div>}<p className="mt-3 font-black">{nombre(g)}</p><p className="mt-1 text-sm text-slate-600">{u?.telefono||"Celular no registrado"}</p></article>})}{!guias.length&&<p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">Administración aún no asignó guías en este grupo.</p>}</div></div>}
function Estado({titulo,texto}:{titulo:string;texto:string}){return <main className="grid min-h-screen place-items-center bg-[#eee8dc] p-5"><div className="max-w-md rounded-3xl bg-white p-7 text-center"><h1 className="text-xl font-black text-[#841534]">{titulo}</h1><p className="mt-2 text-sm text-slate-500">{texto}</p><Link to="/comunicados" className="mt-5 inline-block font-bold text-[#841534]">Volver</Link></div></main>}
