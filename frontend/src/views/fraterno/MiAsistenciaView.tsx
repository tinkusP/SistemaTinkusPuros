import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Navigate } from "react-router-dom";
import { toast } from "react-toastify";
import { marcarEntrada, marcarSalida, misAsistencias } from "@/api/FraternoApi";
import { useAuth } from "@/hooks/useAuth";

export default function MiAsistenciaView() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const consulta = useQuery({ queryKey: ["mis-asistencias"], queryFn: misAsistencias, retry: false });
  const refrescar = () => queryClient.invalidateQueries({ queryKey: ["mis-asistencias"] });
  const entrada = useMutation({ mutationFn: marcarEntrada, onSuccess: async (data) => { toast.success(data.message); await refrescar(); }, onError: (error) => toast.error(error.message) });
  const salida = useMutation({ mutationFn: marcarSalida, onSuccess: async (data) => { toast.success(data.message); await refrescar(); }, onError: (error) => toast.error(error.message) });

  if (!localStorage.getItem("AUTH_TOKEN")) return <Navigate to="/auth/login" replace />;
  const hoy = consulta.data?.hoy;
  const bloqueado = consulta.isError || consulta.data?.habilitado === false;

  return <main className="min-h-screen bg-[#f5efe3] p-4 text-[#262022] sm:p-8"><div className="mx-auto max-w-5xl space-y-6">
    <header className="rounded-3xl bg-gradient-to-r from-[#74122A] to-[#9b5b25] p-6 text-white shadow-xl sm:p-9"><p className="text-xs font-bold uppercase tracking-[.22em] text-[#ead08f]">Tinkus Puros y Naturales</p><div className="mt-3 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-3xl font-black">Mi asistencia</h1><p className="mt-2 opacity-90">{auth.data?.nombres} {auth.data?.apellidoPaterno}</p></div><Link to="/comunicados" className="rounded-xl border border-white/50 px-5 py-3 text-center font-bold">Volver al portal</Link></div></header>
    {bloqueado ? <section className="rounded-2xl bg-white p-8 text-center shadow"><div className="text-4xl">🔒</div><h2 className="mt-3 text-xl font-black text-[#74122A]">Asistencia no habilitada</h2><p className="mt-2 text-slate-600">{consulta.data?.motivoNoHabilitado ?? "No se pudo comprobar tu condición de fraterno."}</p><Link to="/mis-pagos" className="mt-5 inline-block rounded-xl bg-[#74122A] px-5 py-3 font-bold text-white">Consultar mis pagos</Link></section> : <>
      <section className="rounded-2xl border bg-white p-6 shadow-sm"><p className="text-xs font-bold uppercase tracking-[.18em] text-[#8F5F2A]">Registro de hoy</p><h2 className="mt-1 text-2xl font-black text-[#74122A]">{new Date().toLocaleDateString("es-BO", { dateStyle: "full" })}</h2><div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-emerald-50 p-5"><span className="text-sm font-bold text-emerald-800">Entrada</span><p className="mt-2 text-2xl font-black">{hoy ? new Date(hoy.horaEntrada).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" }) : "Sin marcar"}</p><button disabled={!!hoy || entrada.isPending} onClick={() => entrada.mutate()} className="mt-4 w-full rounded-xl bg-emerald-700 px-4 py-3 font-bold text-white disabled:opacity-40">Marcar entrada</button></div>
        <div className="rounded-2xl bg-amber-50 p-5"><span className="text-sm font-bold text-amber-800">Salida</span><p className="mt-2 text-2xl font-black">{hoy?.horaSalida ? new Date(hoy.horaSalida).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" }) : "Sin marcar"}</p><button disabled={!hoy || !!hoy.horaSalida || salida.isPending} onClick={() => salida.mutate()} className="mt-4 w-full rounded-xl bg-[#74122A] px-4 py-3 font-bold text-white disabled:opacity-40">Marcar salida</button></div>
      </div></section>
      <section className="overflow-hidden rounded-2xl border bg-white"><div className="p-5"><h2 className="text-xl font-black text-[#74122A]">Mi historial</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[600px] text-sm"><thead className="bg-[#74122A] text-white"><tr><th className="p-3 text-left">Fecha</th><th className="p-3 text-left">Entrada</th><th className="p-3 text-left">Salida</th><th className="p-3 text-left">Estado</th></tr></thead><tbody>{(consulta.data?.asistencias ?? []).map((asistencia) => <tr className="border-b" key={asistencia._id}><td className="p-3">{asistencia.fechaClave}</td><td className="p-3">{new Date(asistencia.horaEntrada).toLocaleTimeString("es-BO")}</td><td className="p-3">{asistencia.horaSalida ? new Date(asistencia.horaSalida).toLocaleTimeString("es-BO") : "—"}</td><td className="p-3">{asistencia.estado}</td></tr>)}</tbody></table></div></section>
    </>}
  </div></main>;
}
