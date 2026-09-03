import { useQuery } from "@tanstack/react-query";
import api from "@/lib/axios";

type UsuarioGuia = { nombres?: string; apellidoPaterno?: string; apellidoMaterno?: string; sexo?: string; telefono?: string; fotoPerfil?: string };
type GuiaDirectorio = { _id: string; usuarioId?: UsuarioGuia };
type BloqueDirectorio = { _id: string; nombre: string; guiasIds?: GuiaDirectorio[] };

const esHombre = (sexo?: string) => ["HOMBRE", "MASCULINO", "M", "VARON", "VARÓN"].includes(String(sexo ?? "").toUpperCase());
const nombreCompleto = (guia: GuiaDirectorio) => [guia.usuarioId?.nombres, guia.usuarioId?.apellidoPaterno, guia.usuarioId?.apellidoMaterno].filter(Boolean).join(" ") || "Guía sin nombre";
const fotoUrl = (ruta?: string) => ruta ? (ruta.startsWith("http") ? ruta : `${String(import.meta.env.VITE_API_URL || "").replace(/\/api\/?$/, "")}${ruta}`) : "";

export default function DirectorioBloquesGuiaView() {
  const consulta = useQuery({
    queryKey: ["directorio-bloques-guia"],
    queryFn: async () => (await api.get<{ bloques: BloqueDirectorio[] }>("/guias/directorio-bloques")).data,
  });
  if (consulta.isLoading) return <p className="p-8">Cargando directorio...</p>;
  if (consulta.isError) return <p className="rounded-2xl bg-red-50 p-6 text-red-700">No se pudo cargar el directorio de bloques.</p>;
  return <main className="space-y-6"><header><p className="text-xs font-black uppercase tracking-widest text-[#8F5F2A]">Panel de guía · Solo consulta</p><h1 className="text-3xl font-black text-[#841534]">Directorio de bloques</h1><p className="text-slate-500">Organigrama general para identificar y contactar a los guías responsables.</p></header><section className="rounded-2xl bg-gradient-to-r from-[#841534] to-[#a65347] p-5 text-center text-white"><p className="text-xs font-bold uppercase tracking-[.25em]">Fraternidad</p><p className="mt-1 text-2xl font-black">Organización de bloques</p></section><div className="grid gap-5 xl:grid-cols-2">{consulta.data?.bloques.map(bloque => <Bloque key={bloque._id} bloque={bloque}/>)}</div>{!consulta.data?.bloques.length?<p className="rounded-2xl border bg-white p-8 text-center text-slate-500">No existen bloques activos.</p>:null}</main>;
}

function Bloque({ bloque }: { bloque: BloqueDirectorio }) {
  const guias = bloque.guiasIds ?? [], hombres = guias.filter(g => esHombre(g.usuarioId?.sexo)), mujeres = guias.filter(g => !esHombre(g.usuarioId?.sexo));
  return <article className="overflow-hidden rounded-2xl border bg-white shadow-sm"><header className="border-b bg-[#841534]/5 p-5"><p className="text-xs font-bold uppercase text-[#8F5F2A]">Bloque</p><h2 className="text-2xl font-black text-[#841534]">{bloque.nombre}</h2></header><div className="grid gap-5 p-5 sm:grid-cols-2"><Grupo titulo="Guías hombres" guias={hombres} rol="Guía hombre"/><Grupo titulo="Guías mujeres" guias={mujeres} rol="Guía mujer"/></div></article>;
}

function Grupo({ titulo, guias, rol }: { titulo: string; guias: GuiaDirectorio[]; rol: string }) {
  return <section><h3 className="font-black text-slate-800">{titulo}</h3><div className="mt-3 space-y-3">{guias.map(guia => <article key={guia._id} className="flex gap-3 rounded-xl bg-slate-50 p-3"><div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full bg-[#841534] font-black text-white">{guia.usuarioId?.fotoPerfil?<img src={fotoUrl(guia.usuarioId.fotoPerfil)} alt={`Foto de ${nombreCompleto(guia)}`} className="h-full w-full object-cover"/>:nombreCompleto(guia).charAt(0)}</div><div className="min-w-0"><p className="font-black text-slate-900">{nombreCompleto(guia)}</p><p className="text-xs font-bold text-[#841534]">{rol}</p><p className="mt-1 text-xs text-slate-500">{guia.usuarioId?.telefono || "Contacto no registrado"}</p></div></article>)}{!guias.length?<p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Sin guías asignados.</p>:null}</div></section>;
}
