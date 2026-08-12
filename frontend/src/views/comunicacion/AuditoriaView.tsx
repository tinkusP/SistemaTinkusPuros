import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listarAuditoria } from "@/api/GuiaApi";

export default function AuditoriaView() {
  const [buscar, setBuscar] = useState("");
  const [administrador, setAdministrador] = useState("TODOS");
  const [soloAltas, setSoloAltas] = useState(false);
  const [limite, setLimite] = useState(() => window.innerWidth < 640 ? 10 : window.innerWidth < 1280 ? 25 : 50);
  const consulta = useQuery({ queryKey: ["auditoria"], queryFn: listarAuditoria, refetchInterval: 30000 });
  const administradores = Array.from(new Map((consulta.data ?? []).filter(e => e.usuarioId).map(e => [e.usuarioId!.email, e.usuarioId!] as const)).values());
  const eventos = (consulta.data ?? []).filter((evento) => {
    const coincideAdministrador = administrador === "TODOS" || evento.usuarioId?.email === administrador;
    const coincideAlta = !soloAltas || evento.accion === "DAR_DE_ALTA";
    const texto = `${evento.usuarioId?.nombres ?? ""} ${evento.usuarioId?.apellidoPaterno ?? ""} ${evento.accion} ${evento.modulo} ${evento.descripcion} ${evento.ruta ?? ""}`.toLowerCase();
    return coincideAdministrador && coincideAlta && texto.includes(buscar.trim().toLowerCase());
  }).slice(0, limite);
  return <div className="space-y-5">
    <header><p className="text-xs font-bold uppercase tracking-widest text-[#8F5F2A]">Seguridad y trazabilidad</p><h1 className="text-3xl font-black text-[#74122A]">Auditoría del sistema</h1><p className="text-sm text-[#735f55]">Actividad reciente, quién dio de alta y la hora exacta de cada acción.</p></header>
    <section className="grid gap-3 rounded-2xl bg-white p-4 lg:grid-cols-[1fr_260px_auto_auto]"><input type="search" value={buscar} onChange={e=>setBuscar(e.target.value)} className="input-preregistro" placeholder="Buscar administrador, acción, módulo o ruta..."/><select value={administrador} onChange={e=>setAdministrador(e.target.value)} className="input-preregistro"><option value="TODOS">Todos los administradores</option>{administradores.map(admin=><option key={admin.email} value={admin.email}>{admin.nombres} {admin.apellidoPaterno}</option>)}</select><label className="flex items-center gap-2 rounded-xl border px-3 text-sm font-bold"><input type="checkbox" checked={soloAltas} onChange={e=>setSoloAltas(e.target.checked)}/> Solo altas</label><select value={limite} onChange={e=>setLimite(Number(e.target.value))} className="input-preregistro">{[10,25,50,100,500].map(n=><option key={n} value={n}>{n} filas</option>)}</select></section>
    <div className="overflow-x-auto rounded-2xl border bg-white"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-[#74122A] text-white"><tr>{["Fecha y hora", "Administrador", "Acción", "Módulo", "Descripción", "Ruta"].map(titulo=><th key={titulo} className="p-3">{titulo}</th>)}</tr></thead><tbody>{eventos.map(evento=><tr key={evento._id} className="border-b"><td className="p-3">{new Date(evento.fecha).toLocaleString("es-BO")}</td><td className="p-3 font-bold">{evento.usuarioId ? `${evento.usuarioId.nombres} ${evento.usuarioId.apellidoPaterno}` : "Sistema"}</td><td className="p-3 font-bold text-[#74122A]">{evento.accion.replaceAll("_"," ")}</td><td className="p-3">{evento.modulo}</td><td className="p-3">{evento.descripcion}</td><td className="p-3 text-xs">{evento.metodo} {evento.ruta}</td></tr>)}</tbody></table></div>
  </div>;
}
