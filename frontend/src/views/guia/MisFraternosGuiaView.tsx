import { useQuery } from "@tanstack/react-query";
import api from "@/lib/axios";

type Usuario = { nombres?: string; apellidoPaterno?: string; apellidoMaterno?: string; ci?: string; telefono?: string; sexo?: string };
type Fraterno = { _id: string; usuarioId?: Usuario; pago?: { saldo?: number; montoPagado?: number; estado?: string } };
type Detalle = { _id: string; fraternoId: string | Fraterno; genero: "HOMBRE" | "MUJER" };
type Respuesta = { bloque?: { nombre: string }; detalles: Detalle[]; fraternos: Fraterno[] };

const nombre = (f: Fraterno) => [f.usuarioId?.apellidoPaterno, f.usuarioId?.apellidoMaterno, f.usuarioId?.nombres].filter(Boolean).join(" ") || "Sin nombre";
const pago = (f: Fraterno) => !f.pago || Number(f.pago.montoPagado ?? 0) <= 0 ? "SIN PAGOS" : Number(f.pago.saldo ?? 0) <= 0 || f.pago.estado === "PAGADA" ? "PAGO COMPLETO" : "PAGO PARCIAL";

export default function MisFraternosGuiaView() {
  const consulta = useQuery({ queryKey: ["mi-bloque-guia"], queryFn: async () => (await api.get<Respuesta>("/guias/mi-bloque")).data });
  if (consulta.isLoading) return <p className="p-8">Cargando integrantes...</p>;
  if (consulta.isError) return <p className="rounded-2xl bg-red-50 p-6 text-red-700">No se pudieron cargar tus fraternos.</p>;
  const porId = new Map((consulta.data?.fraternos ?? []).map(f => [f._id, f]));
  const integrantes = (consulta.data?.detalles ?? []).map(d => typeof d.fraternoId === "string" ? porId.get(d.fraternoId) : porId.get(d.fraternoId._id) ?? d.fraternoId).filter((f): f is Fraterno => Boolean(f)).sort((a,b) => nombre(a).localeCompare(nombre(b), "es", { sensitivity: "base" }));
  return <main className="space-y-5"><header><p className="text-xs font-black uppercase tracking-widest text-[#8F5F2A]">Panel de guía</p><h1 className="text-3xl font-black text-[#841534]">Mis fraternos</h1><p className="text-slate-500">Integrantes asignados al bloque {consulta.data?.bloque?.nombre ?? "sin asignar"}.</p></header><section className="rounded-2xl border bg-white p-5"><div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-black text-[#841534]">Lista de integrantes</h2><b>{integrantes.length}/120</b></div><div className="grid gap-3 lg:grid-cols-2">{integrantes.map((f,indice)=><article key={f._id} className="flex items-start justify-between gap-3 rounded-xl border p-4"><div><p className="font-black">{indice+1}. {nombre(f)}</p><p className="text-sm text-slate-500">CI {f.usuarioId?.ci || "—"} · {f.usuarioId?.telefono || "Sin celular"}</p></div><span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-black text-amber-900">{pago(f)}</span></article>)}</div>{!integrantes.length?<p className="rounded-xl bg-slate-50 p-8 text-center text-slate-500">Tu bloque todavía no tiene integrantes.</p>:null}</section></main>;
}
