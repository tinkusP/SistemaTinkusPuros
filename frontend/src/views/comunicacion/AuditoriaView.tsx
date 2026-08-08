import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listarAuditoria } from "@/api/GuiaApi";

export default function AuditoriaView() {
  const [buscar, setBuscar] = useState("");
  const [limite, setLimite] = useState(() => window.innerWidth < 640 ? 10 : window.innerWidth < 1280 ? 25 : 50);
  const consulta = useQuery({ queryKey: ["auditoria"], queryFn: listarAuditoria, refetchInterval: 30000 });
  const eventos = (consulta.data ?? []).filter((evento) => `${evento.usuarioId?.nombres ?? ""} ${evento.usuarioId?.apellidoPaterno ?? ""} ${evento.accion} ${evento.modulo} ${evento.descripcion} ${evento.ruta ?? ""}`.toLowerCase().includes(buscar.trim().toLowerCase())).slice(0, limite);
  return <div className="space-y-5">
    <header><p className="text-xs font-bold uppercase tracking-widest text-[#8F5F2A]">Seguridad y trazabilidad</p><h1 className="text-3xl font-black text-[#74122A]">Auditoría del sistema</h1><p className="text-sm text-[#735f55]">Actividad reciente, accesos y cambios críticos.</p></header>
    <section className="grid gap-3 rounded-2xl bg-white p-4 sm:grid-cols-[1fr_auto]"><input type="search" value={buscar} onChange={(e) => setBuscar(e.target.value)} className="input-preregistro" placeholder="Buscar usuario, acción, módulo o ruta..." /><select value={limite} onChange={(e) => setLimite(Number(e.target.value))} className="input-preregistro"><option value={10}>10 filas</option><option value={25}>25 filas</option><option value={50}>50 filas</option><option value={100}>100 filas</option><option value={500}>500 filas</option></select></section>
    <div className="overflow-x-auto rounded-2xl border bg-white"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-[#74122A] text-white"><tr>{["Fecha", "Usuario", "Acción", "Módulo", "Descripción", "Ruta"].map((titulo) => <th key={titulo} className="p-3">{titulo}</th>)}</tr></thead><tbody>{eventos.map((evento) => <tr key={evento._id} className="border-b"><td className="p-3">{new Date(evento.fecha).toLocaleString("es-BO")}</td><td className="p-3">{evento.usuarioId ? `${evento.usuarioId.nombres} ${evento.usuarioId.apellidoPaterno}` : "Sistema"}</td><td className="p-3 font-bold text-[#74122A]">{evento.accion}</td><td className="p-3">{evento.modulo}</td><td className="p-3">{evento.descripcion}</td><td className="p-3 text-xs">{evento.metodo} {evento.ruta}</td></tr>)}</tbody></table></div>
  </div>;
}
