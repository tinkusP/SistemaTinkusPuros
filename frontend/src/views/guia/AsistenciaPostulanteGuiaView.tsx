import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { listarAsistenciaPostulantesGuia, marcarEntradaGuiaAdmin, marcarSalidaGuiaAdmin } from "@/api/AsistenciaPostulanteGuiaApi";

const fechaLocal = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/La_Paz", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const hora = (valor?: string) => valor ? new Date(valor).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" }) : "—";

export default function AsistenciaPostulanteGuiaView() {
  const [fecha, setFecha] = useState(fechaLocal());
  const [buscar, setBuscar] = useState("");
  const qc = useQueryClient();
  const consulta = useQuery({ queryKey: ["asistencia-postulantes-guia", fecha], queryFn: () => listarAsistenciaPostulantesGuia(fecha) });
  const accion = useMutation({ mutationFn: ({ id, tipo }: { id: string; tipo: "ENTRADA" | "SALIDA" }) => tipo === "ENTRADA" ? marcarEntradaGuiaAdmin(id) : marcarSalidaGuiaAdmin(id), onSuccess: (r) => { toast.success(r.message); qc.invalidateQueries({ queryKey: ["asistencia-postulantes-guia"] }); }, onError: (e: Error) => toast.error(e.message) });
  const filas = useMemo(() => (consulta.data?.postulantes ?? []).map((p) => ({ postulante: p, asistencia: consulta.data?.asistencias.find((a) => String(a.postulanteGuiaId) === p._id) })).filter(({ postulante: p }) => `${p.preregistroId.usuarioId.nombres} ${p.preregistroId.usuarioId.apellidoPaterno} ${p.preregistroId.usuarioId.apellidoMaterno ?? ""} ${p.preregistroId.usuarioId.ci}`.toLowerCase().includes(buscar.toLowerCase())), [consulta.data, buscar]);
  const completas = filas.filter((f) => f.asistencia?.estado === "PRESENTE").length;
  const incompletas = filas.filter((f) => f.asistencia?.estado === "INCOMPLETA").length;
  return <div className="space-y-6">
    <header><p className="text-xs font-bold uppercase tracking-[.2em] text-[#8F5F2A]">Evaluación de postulantes</p><h1 className="text-3xl font-black text-[#74122A]">Asistencia de postulantes a guía</h1><p className="text-sm text-[#735f55]">Control diario separado de la asistencia de fraternos.</p></header>
    <section className="grid gap-3 sm:grid-cols-4">{[["Habilitados", filas.length], ["Presentes", completas], ["Sin salida", incompletas], ["Sin registro", filas.length-completas-incompletas]].map(([t,n]) => <article key={String(t)} className="rounded-2xl border bg-white p-5"><p className="text-sm text-slate-500">{t}</p><strong className="text-3xl text-[#841534]">{n}</strong></article>)}</section>
    <section className="grid gap-3 rounded-2xl bg-white p-4 sm:grid-cols-[1fr_auto]"><input className="input-preregistro" type="search" placeholder="Buscar por nombre o CI..." value={buscar} onChange={(e) => setBuscar(e.target.value)} /><input className="input-preregistro" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></section>
    <section className="overflow-x-auto rounded-2xl border bg-white"><table className="w-full min-w-[900px] text-sm"><thead className="bg-[#841534] text-white"><tr>{["Postulante", "CI", "Gestión", "Méritos", "Entrada", "Salida", "Estado", "Acción"].map((x) => <th key={x} className="p-4 text-left">{x}</th>)}</tr></thead><tbody>{filas.map(({ postulante: p, asistencia: a }) => { const u=p.preregistroId.usuarioId; return <tr key={p._id} className="border-b"><td className="p-4 font-bold">{u.nombres} {u.apellidoPaterno} {u.apellidoMaterno}</td><td className="p-4">{u.ci}</td><td className="p-4">{p.preregistroId.gestionId?.nombre ?? "—"}</td><td className="p-4 font-black text-[#841534]">{p.puntajeTotal}</td><td className="p-4">{hora(a?.horaEntrada)}</td><td className="p-4">{hora(a?.horaSalida)}</td><td className="p-4"><span className={`rounded-full px-3 py-1 text-xs font-bold ${a ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{a?.estado ?? "SIN REGISTRO"}</span></td><td className="p-4">{fecha === fechaLocal() && (!a ? <button disabled={accion.isPending} onClick={() => accion.mutate({id:p._id,tipo:"ENTRADA"})} className="rounded-lg bg-[#841534] px-3 py-2 font-bold text-white">Marcar entrada</button> : !a.horaSalida ? <button disabled={accion.isPending} onClick={() => accion.mutate({id:p._id,tipo:"SALIDA"})} className="rounded-lg bg-emerald-600 px-3 py-2 font-bold text-white">Marcar salida</button> : <span className="font-bold text-emerald-700">Completa</span>)}</td></tr>})}</tbody></table>{!consulta.isLoading && !filas.length && <p className="p-10 text-center text-slate-500">No hay postulantes a guía habilitados para mostrar.</p>}</section>
  </div>;
}
