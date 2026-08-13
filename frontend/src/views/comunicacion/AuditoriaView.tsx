import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listarAuditoria } from "@/api/GuiaApi";
import type { EventoAuditoria } from "@/types/GuiaType";

type Categoria = "TODOS" | "SESIONES" | "OBSERVACIONES" | "ERRORES" | "ALTAS";

const nombreUsuario = (evento: EventoAuditoria) => evento.usuarioId ? `${evento.usuarioId.nombres} ${evento.usuarioId.apellidoPaterno}`.trim() : "Usuario no identificado";
const ipLimpia = (ip?: string) => String(ip || "Sin IP").replace(/^::ffff:/, "");
const fechaBolivia = (fecha: string) => new Date(fecha).toLocaleString("es-BO", { timeZone: "America/La_Paz", dateStyle: "medium", timeStyle: "medium" });
const esObservacion = (evento: EventoAuditoria) => evento.accion.includes("OBSERV") || evento.descripcion.toUpperCase().includes("OBSERVADO");
const esError = (evento: EventoAuditoria) => evento.accion.includes("ERROR") || /\berror\s[45]\d\d/i.test(evento.descripcion);
const dispositivo = (agente?: string) => {
  const ua = String(agente || "");
  const tipo = /android|iphone|ipad|mobile/i.test(ua) ? "Celular/tablet" : ua ? "Computadora" : "No identificado";
  const sistema = /android/i.test(ua) ? "Android" : /iphone|ipad/i.test(ua) ? "iOS" : /windows/i.test(ua) ? "Windows" : /mac os|macintosh/i.test(ua) ? "macOS" : /linux/i.test(ua) ? "Linux" : "Sistema desconocido";
  const navegador = /edg/i.test(ua) ? "Edge" : /chrome/i.test(ua) ? "Chrome" : /firefox/i.test(ua) ? "Firefox" : /safari/i.test(ua) ? "Safari" : "Navegador desconocido";
  return { tipo, sistema, navegador, resumen: `${tipo} · ${sistema} · ${navegador}` };
};

export default function AuditoriaView() {
  const [buscar, setBuscar] = useState("");
  const [usuario, setUsuario] = useState("TODOS");
  const [ip, setIp] = useState("TODAS");
  const [categoria, setCategoria] = useState<Categoria>("TODOS");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [limite, setLimite] = useState(() => window.innerWidth < 640 ? 10 : window.innerWidth < 1280 ? 25 : 50);
  const consulta = useQuery({ queryKey: ["auditoria", 500], queryFn: listarAuditoria, refetchInterval: 30000 });
  const todos = useMemo(() => consulta.data ?? [], [consulta.data]);

  const usuarios = useMemo(() => Array.from(new Map(todos.filter((evento) => evento.usuarioId).map((evento) => [evento.usuarioId!.email, evento.usuarioId!] as const)).values()), [todos]);
  const ips = useMemo(() => Array.from(new Set(todos.map((evento) => ipLimpia(evento.ip)))).sort(), [todos]);
  const eventos = useMemo(() => todos.filter((evento) => {
    const fecha = new Date(evento.fecha).getTime();
    const coincideCategoria = categoria === "TODOS"
      || (categoria === "SESIONES" && ["INICIAR_SESION", "CERRAR_SESION"].includes(evento.accion))
      || (categoria === "OBSERVACIONES" && esObservacion(evento))
      || (categoria === "ERRORES" && esError(evento))
      || (categoria === "ALTAS" && evento.accion === "DAR_DE_ALTA");
    const texto = `${nombreUsuario(evento)} ${evento.usuarioId?.email ?? ""} ${evento.accion} ${evento.modulo} ${evento.descripcion} ${evento.ruta ?? ""} ${ipLimpia(evento.ip)} ${dispositivo(evento.userAgent).resumen}`.toLowerCase();
    return coincideCategoria
      && (usuario === "TODOS" || evento.usuarioId?.email === usuario)
      && (ip === "TODAS" || ipLimpia(evento.ip) === ip)
      && (!desde || fecha >= new Date(`${desde}T00:00:00`).getTime())
      && (!hasta || fecha <= new Date(`${hasta}T23:59:59.999`).getTime())
      && texto.includes(buscar.trim().toLowerCase());
  }), [todos, buscar, usuario, ip, categoria, desde, hasta]);

  const resumen = useMemo(() => ({
    eventos: eventos.length,
    ips: new Set(eventos.map((evento) => ipLimpia(evento.ip))).size,
    celulares: eventos.filter((evento) => dispositivo(evento.userAgent).tipo === "Celular/tablet").length,
    sesiones: eventos.filter((evento) => evento.accion === "INICIAR_SESION").length,
    observaciones: eventos.filter(esObservacion).length,
    errores: eventos.filter(esError).length,
  }), [eventos]);

  return <main className="space-y-5">
    <header><p className="text-xs font-bold uppercase tracking-widest text-[#8F5F2A]">Seguridad, fallos y trazabilidad</p><h1 className="text-3xl font-black text-[#74122A] dark:text-[#e9cf91]">Centro de auditoría</h1><p className="text-sm text-[#735f55] dark:text-slate-300">Consulta quién ingresó, desde qué IP y dispositivo, quién realizó observaciones y qué solicitudes produjeron errores.</p></header>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      <Resumen titulo="Eventos" valor={resumen.eventos} icono="🧾"/><Resumen titulo="IP distintas" valor={resumen.ips} icono="🌐"/><Resumen titulo="Desde celulares" valor={resumen.celulares} icono="📱"/><Resumen titulo="Inicios de sesión" valor={resumen.sesiones} icono="🔐"/><Resumen titulo="Observaciones" valor={resumen.observaciones} icono="⚠️"/><Resumen titulo="Errores" valor={resumen.errores} icono="🚨" alerta={resumen.errores > 0}/>
    </section>

    <section className="rounded-2xl border bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-[#342d30]">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><input type="search" value={buscar} onChange={(evento) => setBuscar(evento.target.value)} className="input-preregistro" placeholder="Buscar persona, acción, IP, ruta o dispositivo..."/><select value={usuario} onChange={(evento) => setUsuario(evento.target.value)} className="input-preregistro"><option value="TODOS">Todos los usuarios</option>{usuarios.map((item) => <option key={item.email} value={item.email}>{item.nombres} {item.apellidoPaterno}</option>)}</select><select value={ip} onChange={(evento) => setIp(evento.target.value)} className="input-preregistro"><option value="TODAS">Todas las IP</option>{ips.map((item) => <option key={item} value={item}>{item}</option>)}</select><select value={categoria} onChange={(evento) => setCategoria(evento.target.value as Categoria)} className="input-preregistro"><option value="TODOS">Toda la actividad</option><option value="SESIONES">Ingresos y cierres de sesión</option><option value="OBSERVACIONES">Quién realizó observaciones</option><option value="ALTAS">Quién dio de alta</option><option value="ERRORES">Fallos y errores HTTP</option></select></div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3 xl:max-w-3xl"><label className="text-xs font-bold text-slate-600 dark:text-slate-200">Desde<input type="date" value={desde} onChange={(evento) => setDesde(evento.target.value)} className="input-preregistro mt-1"/></label><label className="text-xs font-bold text-slate-600 dark:text-slate-200">Hasta<input type="date" value={hasta} onChange={(evento) => setHasta(evento.target.value)} className="input-preregistro mt-1"/></label><label className="text-xs font-bold text-slate-600 dark:text-slate-200">Filas<select value={limite} onChange={(evento) => setLimite(Number(evento.target.value))} className="input-preregistro mt-1">{[10,25,50,100,500].map((numero) => <option key={numero} value={numero}>{numero} filas</option>)}</select></label></div>
    </section>

    {consulta.isLoading ? <p className="rounded-2xl bg-white p-8 text-center">Cargando auditoría...</p> : <div className="overflow-x-auto rounded-2xl border bg-white dark:border-slate-700 dark:bg-[#342d30]"><table className="w-full min-w-[1350px] text-left text-sm"><thead className="bg-[#74122A] text-white"><tr>{["Fecha y hora", "Usuario", "Actividad", "Módulo", "IP", "Dispositivo", "Descripción", "Solicitud"].map((titulo) => <th key={titulo} className="p-3">{titulo}</th>)}</tr></thead><tbody>{eventos.slice(0, limite).map((evento) => { const equipo = dispositivo(evento.userAgent); return <tr key={evento._id} className={`border-b dark:border-slate-700 ${esError(evento) ? "bg-red-50 dark:bg-red-950/30" : ""}`}><td className="whitespace-nowrap p-3 font-semibold">{fechaBolivia(evento.fecha)}</td><td className="p-3"><strong className="block">{nombreUsuario(evento)}</strong><small className="text-slate-500 dark:text-slate-300">{evento.usuarioId?.email ?? "Sin cuenta identificada"}</small></td><td className="p-3"><span className={`rounded-full px-2 py-1 text-xs font-black ${esError(evento) ? "bg-red-200 text-red-900" : esObservacion(evento) ? "bg-amber-200 text-amber-900" : "bg-[#74122A]/10 text-[#74122A] dark:bg-white/10 dark:text-[#f3d99c]"}`}>{evento.accion.replaceAll("_", " ")}</span></td><td className="p-3 font-bold">{evento.modulo}</td><td className="p-3 font-mono text-xs">{ipLimpia(evento.ip)}</td><td className="p-3"><strong className="block">{equipo.tipo}</strong><small>{equipo.sistema} · {equipo.navegador}</small><details className="mt-1"><summary className="cursor-pointer text-xs text-blue-700 dark:text-blue-300">Ver identificación técnica</summary><p className="mt-1 max-w-sm break-all text-xs text-slate-500 dark:text-slate-300">{evento.userAgent || "No disponible"}</p></details></td><td className="max-w-sm p-3">{evento.descripcion}</td><td className="p-3 font-mono text-xs"><strong>{evento.metodo || "—"}</strong> {evento.ruta || "—"}</td></tr>; })}</tbody></table>{eventos.length === 0 ? <p className="p-8 text-center text-slate-500">No existen eventos que coincidan con los filtros seleccionados.</p> : null}</div>}
    <p className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100">La IP identifica una conexión, no necesariamente una persona: varios celulares pueden compartir la misma red. El dispositivo se deduce de la identificación enviada por el navegador.</p>
  </main>;
}

function Resumen({ titulo, valor, icono, alerta = false }: { titulo: string; valor: number; icono: string; alerta?: boolean }) { return <article className={`rounded-2xl border p-4 shadow-sm ${alerta ? "border-red-300 bg-red-50 dark:bg-red-950/30" : "bg-white dark:border-slate-700 dark:bg-[#342d30]"}`}><span className="text-2xl">{icono}</span><strong className="ml-2 text-2xl text-[#74122A] dark:text-[#f3d99c]">{valor}</strong><p className="mt-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-300">{titulo}</p></article>; }
