import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import api from "@/lib/axios";

const nombre = (guia:any) => [guia?.usuarioId?.nombres,guia?.usuarioId?.apellidoPaterno,guia?.usuarioId?.apellidoMaterno].filter(Boolean).join(" ");
export default function MiBloqueFraternoView(){
  const consulta=useQuery({queryKey:["mi-bloque-fraterno"],queryFn:async()=>(await api.get("/fraternos/mi-bloque")).data});
  if(consulta.isLoading)return <main className="grid min-h-screen place-items-center bg-[#eee8dc] p-5"><p>Cargando tu posición...</p></main>;
  if(consulta.isError)return <main className="grid min-h-screen place-items-center bg-[#eee8dc] p-5"><div className="max-w-md rounded-3xl bg-white p-7 text-center"><h1 className="text-xl font-black text-[#841534]">No se pudo consultar tu bloque</h1><p className="mt-2 text-sm text-slate-500">Verifica que administración te haya registrado como fraterno.</p><Link to="/comunicados" className="mt-5 inline-block font-bold text-[#841534]">Volver</Link></div></main>;
  const posicion=consulta.data.posicion; const bloque=posicion?.bloqueId; const guias=bloque?.guiasIds?.length?bloque.guiasIds:[bloque?.guiaId].filter(Boolean);
  return <main className="min-h-screen bg-[#eee8dc] p-4 sm:p-8"><div className="mx-auto max-w-4xl space-y-5"><header className="rounded-3xl bg-[#841534] p-6 text-white"><p className="text-xs font-bold uppercase tracking-[.25em] text-[#e9cf91]">Información del fraterno</p><h1 className="mt-2 text-3xl font-black">Mi bloque y posición</h1><Link to="/comunicados" className="mt-4 inline-block rounded-xl border border-white/30 px-4 py-2 text-sm font-bold">← Volver a comunicados</Link></header>
    {!posicion?<section className="rounded-3xl border border-amber-300 bg-amber-50 p-8 text-center"><div className="text-4xl">⏳</div><h2 className="mt-3 text-xl font-black text-amber-900">Todavía no tienes una posición asignada</h2><p className="mt-2 text-sm text-amber-800">Cuando un guía te incorpore a su bloque, aquí aparecerán el bloque, la fila y la columna.</p></section>:<>
      <section className="overflow-hidden rounded-3xl bg-white shadow"><div className="bg-[#292329] p-6 text-white"><p className="text-xs font-bold uppercase tracking-widest text-amber-300">Tu bloque</p><h2 className="mt-2 text-3xl font-black">{bloque.nombre}</h2></div><div className="grid gap-4 p-6 sm:grid-cols-3"><Dato titulo="Sección" valor={posicion.genero}/><Dato titulo="Fila" valor={posicion.fila}/><Dato titulo="Columna" valor={posicion.columna}/></div></section>
      <section className="rounded-3xl bg-white p-6 shadow"><h2 className="text-xl font-black text-[#841534]">Guías de mi bloque</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{guias.map((guia:any)=><article key={guia._id} className="rounded-2xl border bg-slate-50 p-4"><p className="font-black text-slate-800">{nombre(guia)}</p><p className="mt-1 text-xs text-slate-500">Guía del bloque</p></article>)}</div></section>
    </>}
  </div></main>;
}
function Dato({titulo,valor}:{titulo:string;valor:string|number}){return <div className="rounded-2xl border bg-slate-50 p-5 text-center"><p className="text-xs font-bold uppercase text-slate-500">{titulo}</p><strong className="mt-2 block text-3xl text-[#841534]">{valor}</strong></div>}
