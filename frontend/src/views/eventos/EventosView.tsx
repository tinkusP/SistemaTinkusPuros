import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Html5Qrcode } from "html5-qrcode";
import { toast } from "react-toastify";
import {
  cambiarEstadoEvento,
  corregirAsistenciaEvento,
  crearEvento,
  listarEventos,
  obtenerEvento,
  registrarAsistenciaEvento,
  registrarAsistenciaEventoQr,
  type Evento,
  type FilaAsistenciaEvento,
} from "@/api/EventoApi";
import { buscarIdentidades, verificarCredencialQr, type ResultadoBusquedaIdentidad } from "@/api/CredencialQrApi";

const TIPOS = ["ELECCION_CHACHA_WARMI", "FIESTA_PREENTRADA", "PREENTRADA", "ENTRADA_UNIVERSITARIA", "REUNION", "OTRO"];
const vacio = { nombre: "", tipo: "REUNION", fecha: "", horaInicio: "", horaFin: "", descripcion: "" };
const fechaHora = (valor: string | null) => valor ? new Date(valor).toLocaleString("es-BO", { timeZone: "America/La_Paz" }) : "—";

export default function EventosView() {
  const qc = useQueryClient();
  const eventos = useQuery({ queryKey: ["eventos"], queryFn: listarEventos });
  const [form, setForm] = useState(vacio);
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const accion = useMutation({
    mutationFn: (fn: () => Promise<any>) => fn(),
    onSuccess: async (r) => { toast.success(r.message); setForm(vacio); await qc.invalidateQueries({ queryKey: ["eventos"] }); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "No se pudo completar la operación"),
  });
  return <main className="space-y-5">
    <header><p className="text-xs font-black uppercase tracking-widest text-[#8F5F2A]">Administración</p><h1 className="text-3xl font-black text-[#841534]">Eventos y asistencias especiales</h1><p className="text-slate-500">Entrada y salida por evento, sin afectar la asistencia general.</p></header>
    <form onSubmit={(e) => { e.preventDefault(); accion.mutate(() => crearEvento(form)); }} className="grid gap-3 rounded-2xl border bg-white p-5 md:grid-cols-2 xl:grid-cols-6">
      <input required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Nombre del evento" className="rounded-xl border p-3 xl:col-span-2" />
      <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className="rounded-xl border p-3">{TIPOS.map((t) => <option key={t}>{t}</option>)}</select>
      <input required type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} className="rounded-xl border p-3" />
      <input type="time" value={form.horaInicio} onChange={(e) => setForm({ ...form, horaInicio: e.target.value })} className="rounded-xl border p-3" />
      <button disabled={accion.isPending} className="rounded-xl bg-[#841534] p-3 font-black text-white disabled:opacity-50">Crear evento</button>
    </form>
    <section className="grid gap-4 lg:grid-cols-2">{eventos.data?.eventos.map((evento) => <article key={evento._id} className="rounded-2xl border bg-white p-5">
      <div className="flex justify-between gap-3"><div><h2 className="text-xl font-black text-[#841534]">{evento.nombre}</h2><p className="text-sm text-slate-500">{evento.tipo.replaceAll("_", " ")} · {new Date(evento.fecha).toLocaleDateString("es-BO")}</p></div><span className="h-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-black">{evento.estado}</span></div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center"><Metrica titulo="Entradas" valor={evento.entradas ?? evento.presentes} /><Metrica titulo="Salidas" valor={evento.salidas ?? 0} /><Metrica titulo="Dentro" valor={evento.dentro ?? 0} /></div>
      <div className="mt-4 flex flex-wrap gap-2"><button onClick={() => setSeleccionado(evento._id)} className="rounded-lg bg-[#841534] px-3 py-2 text-xs font-bold text-white">Gestionar asistencia</button>{evento.estado === "PROGRAMADO" && <button onClick={() => accion.mutate(() => cambiarEstadoEvento(evento._id, "ACTIVO"))} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white">Abrir registro</button>}{evento.estado === "ACTIVO" && <button onClick={() => confirm("¿Cerrar este evento? Ya no admitirá nuevas marcaciones.") && accion.mutate(() => cambiarEstadoEvento(evento._id, "CERRADO"))} className="rounded-lg bg-slate-700 px-3 py-2 text-xs font-bold text-white">Cerrar</button>}</div>
    </article>)}</section>
    {eventos.isLoading && <p>Cargando eventos...</p>}{!eventos.isLoading && !eventos.data?.eventos.length && <p className="rounded-xl bg-white p-8 text-center text-slate-500">No existen eventos registrados.</p>}
    {seleccionado && <PanelEvento eventoId={seleccionado} cerrar={() => setSeleccionado(null)} />}
  </main>;
}

function Metrica({ titulo, valor }: { titulo: string; valor: number }) { return <div className="rounded-xl bg-slate-50 p-3"><b className="block text-2xl text-[#841534]">{valor}</b><span className="text-xs text-slate-500">{titulo}</span></div>; }

function PanelEvento({ eventoId, cerrar }: { eventoId: string; cerrar: () => void }) {
  const qc = useQueryClient();
  const detalle = useQuery({ queryKey: ["evento", eventoId], queryFn: () => obtenerEvento(eventoId), refetchInterval: 10_000 });
  const [texto, setTexto] = useState("");
  const [resultados, setResultados] = useState<ResultadoBusquedaIdentidad[]>([]);
  const [filtro, setFiltro] = useState("TODOS");
  const [ocupado, setOcupado] = useState(false);
  const refrescar = async () => { await Promise.all([qc.invalidateQueries({ queryKey: ["evento", eventoId] }), qc.invalidateQueries({ queryKey: ["eventos"] })]); };
  const marcar = async (usuarioId: string) => { setOcupado(true); try { const r = await registrarAsistenciaEvento(eventoId, usuarioId, "MANUAL"); toast.success(r.message); setResultados([]); setTexto(""); await refrescar(); } catch (e: any) { toast.error(e.response?.data?.error ?? e.message); } finally { setOcupado(false); } };
  const buscar = async () => { if (texto.trim().length < 2) return; setOcupado(true); try { setResultados((await buscarIdentidades(texto)).resultados); } catch (e: any) { toast.error(e.message); } finally { setOcupado(false); } };
  const filas = useMemo(() => (detalle.data?.asistencias ?? []).filter((a) => filtro === "TODOS" || a.estado === filtro), [detalle.data, filtro]);
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 p-3"><section className="mx-auto my-4 max-w-7xl rounded-2xl bg-white p-5 shadow-xl">
    <div className="flex items-start justify-between gap-3"><div><h2 className="text-2xl font-black text-[#841534]">{detalle.data?.evento.nombre ?? "Evento"}</h2><p className="text-sm text-slate-500">Actualización automática cada 10 segundos.</p></div><button onClick={cerrar} className="rounded-lg border px-3 py-2 font-bold">Cerrar panel</button></div>
    {detalle.data && <><div className="my-4 grid grid-cols-2 gap-2 md:grid-cols-5"><Metrica titulo="Esperados" valor={detalle.data.estadisticas.totalEsperado} /><Metrica titulo="Entradas" valor={detalle.data.estadisticas.entradas} /><Metrica titulo="Salidas" valor={detalle.data.estadisticas.salidas} /><Metrica titulo="Dentro" valor={detalle.data.estadisticas.dentro} /><Metrica titulo="Ausentes" valor={detalle.data.estadisticas.sinAsistencia} /></div>
      {detalle.data.evento.estado === "ACTIVO" && <div className="grid gap-4 rounded-xl border p-4 lg:grid-cols-2"><div><label className="text-xs font-black uppercase">Buscar por nombre, CI, matrícula o código</label><div className="mt-2 flex gap-2"><input value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void buscar()} className="min-w-0 flex-1 rounded-xl border p-2" /><button disabled={ocupado} onClick={() => void buscar()} className="rounded-xl bg-[#841534] px-4 font-bold text-white">Buscar</button></div>{resultados.map((u) => <button key={u._id} disabled={ocupado} onClick={() => void marcar(u._id)} className="mt-2 block w-full rounded-xl bg-slate-50 p-3 text-left hover:bg-emerald-50"><b>{u.nombres} {u.apellidoPaterno} {u.apellidoMaterno}</b><small className="block">CI {u.ci} · Matrícula {u.registroUniversitario || "SIN REGISTRO"} · Marcar entrada/salida</small></button>)}</div><EscanerEvento eventoId={eventoId} alRegistrar={refrescar} /></div>}
      <div className="mt-4 flex flex-wrap justify-between gap-2"><select value={filtro} onChange={(e) => setFiltro(e.target.value)} className="rounded-xl border p-2"><option value="TODOS">Todos</option><option value="SIN_REGISTRO">Sin asistencia</option><option value="DENTRO_DEL_EVENTO">Dentro del evento</option><option value="ASISTENCIA_COMPLETA">Asistencia completa</option></select><button onClick={() => void exportarEvento(detalle.data!)} className="rounded-xl bg-emerald-700 px-4 py-2 font-black text-white">Exportar Excel</button></div>
      <div className="mt-3 overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-[#841534] text-white"><tr>{["Matrícula", "Nombre", "CI", "Sexo", "Bloque", "Entrada", "Salida", "Duración", "Estado", "Acción"].map((h) => <th key={h} className="p-2 text-left">{h}</th>)}</tr></thead><tbody>{filas.map((a) => <tr key={a.usuarioId} className="border-b"><td className="p-2">{a.matricula || "SIN MATRÍCULA"}</td><td className="p-2 font-semibold">{a.nombreCompleto}</td><td className="p-2">{a.ci}</td><td className="p-2">{a.sexo}</td><td className="p-2">{a.bloque}</td><td className="p-2">{fechaHora(a.entrada)}</td><td className="p-2">{fechaHora(a.salida)}</td><td className="p-2">{a.duracion}</td><td className="p-2">{a.estado.replaceAll("_", " ")}</td><td className="p-2">{a.asistenciaId && <button onClick={() => void corregir(eventoId, a, refrescar)} className="text-xs font-bold text-[#841534]">Corregir</button>}</td></tr>)}</tbody></table></div>
    </>}{detalle.isLoading && <p className="p-10 text-center">Cargando...</p>}
  </section></div>;
}

function EscanerEvento({ eventoId, alRegistrar }: { eventoId: string; alRegistrar: () => Promise<void> }) {
  const lector = useRef<Html5Qrcode | null>(null);
  const [activo, setActivo] = useState(false);
  const id = `lector-evento-${eventoId}`;
  const detener = async () => { if (lector.current?.isScanning) await lector.current.stop(); setActivo(false); };
  useEffect(() => () => { if (lector.current?.isScanning) void lector.current.stop(); }, []);
  const procesar = async (token: string) => { try { const identidad = await verificarCredencialQr(token); const nombre = [identidad.usuario.nombres, identidad.usuario.apellidoPaterno, identidad.usuario.apellidoMaterno].filter(Boolean).join(" "); if (!confirm(`${nombre}\nCI: ${identidad.usuario.ci}\nMatrícula: ${identidad.usuario.registroUniversitario || "SIN MATRÍCULA"}\nBloque: ${identidad.bloque}\n\n¿Registrar la siguiente marcación de este evento?`)) return; const r = await registrarAsistenciaEventoQr(eventoId, token); toast.success(r.message); await alRegistrar(); } catch (e: any) { toast.error(e.response?.data?.error ?? e.message ?? "No se pudo leer la credencial"); } };
  const iniciar = async () => { const { Html5Qrcode: Constructor } = await import("html5-qrcode"); lector.current ??= new Constructor(id); setActivo(true); try { await lector.current.start({ facingMode: "environment" }, { fps: 8, qrbox: 240 }, async (texto) => { await detener(); await procesar(texto); }, () => undefined); } catch { setActivo(false); toast.error("No se pudo abrir la cámara. Verifica permisos y HTTPS."); } };
  const archivo = async (file?: File) => { if (!file) return; const { Html5Qrcode: Constructor } = await import("html5-qrcode"); lector.current ??= new Constructor(id); try { await procesar(await lector.current.scanFile(file, true)); } catch { toast.error("No se encontró un QR válido en la imagen."); } };
  return <div><p className="text-xs font-black uppercase">Credencial QR</p><div id={id} className="mt-2 max-w-sm overflow-hidden rounded-xl" /><div className="mt-2 flex flex-wrap gap-2">{activo ? <button onClick={() => void detener()} className="rounded-xl bg-slate-700 px-4 py-2 font-bold text-white">Detener cámara</button> : <button onClick={() => void iniciar()} className="rounded-xl bg-emerald-700 px-4 py-2 font-bold text-white">Escanear cámara</button>}<label className="cursor-pointer rounded-xl border px-4 py-2 font-bold">Leer imagen<input type="file" accept="image/*" className="hidden" onChange={(e) => void archivo(e.target.files?.[0])} /></label></div></div>;
}

async function corregir(eventoId: string, fila: FilaAsistenciaEvento, refrescar: () => Promise<void>) {
  const motivo = prompt("Motivo obligatorio de la corrección:", fila.observacion || "");
  if (!motivo || motivo.trim().length < 5 || !fila.asistenciaId) return;
  const entrada = prompt("Entrada en formato ISO (vacío conserva el valor):", fila.entrada || "") || undefined;
  const salidaTexto = prompt("Salida en formato ISO (vacío conserva el valor, escriba SIN SALIDA para eliminarla):", fila.salida || "");
  const horaSalida = salidaTexto === "SIN SALIDA" ? null : salidaTexto || undefined;
  if (!confirm("¿Guardar esta corrección? Quedará registrada en auditoría.")) return;
  try { const r = await corregirAsistenciaEvento(eventoId, fila.asistenciaId, { motivo: motivo.trim(), horaIngreso: entrada, horaSalida }); toast.success(r.message); await refrescar(); } catch (e: any) { toast.error(e.response?.data?.error ?? "No se pudo corregir la asistencia"); }
}

async function exportarEvento(data: Awaited<ReturnType<typeof obtenerEvento>>) {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook(); wb.creator = "Fraternidad Tinkus Puros";
  const columnas = ["Nº", "Matrícula", "Nombre completo", "CI", "Sexo", "Teléfono", "Bloque", "Condición", "Entrada", "Salida", "Duración", "Estado", "Método entrada", "Método salida", "Observación"];
  const agregar = (nombre: string, filas: FilaAsistenciaEvento[]) => { const ws = wb.addWorksheet(nombre); ws.addRow(columnas); filas.forEach((a, i) => ws.addRow([i + 1, a.matricula || "SIN MATRÍCULA", a.nombreCompleto, a.ci, a.sexo, a.telefono, a.bloque, a.condicion, fechaHora(a.entrada), fechaHora(a.salida), a.duracion, a.estado.replaceAll("_", " "), a.metodoEntrada, a.metodoSalida, a.observacion])); ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } }; ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF841534" } }; ws.views = [{ state: "frozen", ySplit: 1 }]; ws.autoFilter = { from: "A1", to: "O1" }; ws.columns.forEach((c, i) => { c.width = [7, 18, 38, 15, 12, 16, 20, 15, 22, 22, 14, 24, 16, 16, 35][i]; }); };
  const porcentaje = data.estadisticas.totalEsperado ? `${((data.estadisticas.entradas / data.estadisticas.totalEsperado) * 100).toFixed(1)}%` : "0%";
  const gestion = typeof data.evento.gestionId === "object" ? data.evento.gestionId.anio ?? data.evento.gestionId.nombre ?? "SIN REGISTRO" : data.evento.gestionId ?? "SIN REGISTRO";
  const porBloque = [...new Set(data.asistencias.map((a) => a.bloque))].sort().map((bloque) => [bloque, data.asistencias.filter((a) => a.bloque === bloque).length]);
  const s = wb.addWorksheet("RESUMEN"); s.addRows([[data.evento.nombre], ["Tipo", data.evento.tipo], ["Fecha", new Date(data.evento.fecha).toLocaleDateString("es-BO")], ["Gestión", gestion], ["Estado", data.evento.estado], ["Esperados", data.estadisticas.totalEsperado], ["Entradas", data.estadisticas.entradas], ["Salidas", data.estadisticas.salidas], ["Dentro", data.estadisticas.dentro], ["Asistencia completa", data.estadisticas.completas], ["Sin asistencia", data.estadisticas.sinAsistencia], ["Porcentaje de asistencia", porcentaje], ["Hombres", data.estadisticas.hombres], ["Mujeres", data.estadisticas.mujeres], [], ["Personas por bloque", "Total"], ...porBloque]); s.getRow(1).font = { bold: true, size: 16, color: { argb: "FF841534" } }; s.getRow(16).font = { bold: true }; s.columns = [{ width: 30 }, { width: 35 }];
  agregar("TODOS", data.asistencias); agregar("ASISTENCIA COMPLETA", data.asistencias.filter((a) => a.estado === "ASISTENCIA_COMPLETA")); agregar("DENTRO", data.asistencias.filter((a) => a.estado === "DENTRO_DEL_EVENTO")); agregar("SIN ASISTENCIA", data.asistencias.filter((a) => a.estado === "SIN_REGISTRO"));
  const buffer = await wb.xlsx.writeBuffer(); const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })); const enlace = document.createElement("a"); enlace.href = url; enlace.download = `ASISTENCIA_${data.evento.nombre.replace(/[^a-z0-9]+/gi, "_").toUpperCase()}_${new Date().toISOString().slice(0, 10)}.xlsx`; enlace.click(); URL.revokeObjectURL(url);
}
