import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { obtenerAuditoriaIntegral, type AuditoriaIntegral as Reporte, type FilaIntegral } from "@/api/AuditoriaIntegralApi";
import { obtenerMensajeError } from "@/api/apiError";
import { useAuth } from "@/hooks/useAuth";

const texto = (valor: unknown) => valor == null ? "SIN REGISTRO" : typeof valor === "boolean" ? valor ? "SÍ" : "NO" : String(valor);
const titulo = (clave: string) => clave.replace(/([A-Z])/g, " $1").replace(/^./, c => c.toUpperCase());
const normalizar = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const boton = "rounded-xl bg-[#74122A] px-4 py-2 font-bold text-white disabled:opacity-50";

export default function AuditoriaIntegral() {
  const { data: usuario } = useAuth();
  const administrador = usuario?.roles?.some(r => typeof r !== "string" && ["ADMIN", "ADMINISTRADOR", "SUPERADMIN", "SUPERADMINISTRADOR"].includes(String(r.codigo || r.nombre).toUpperCase().replace(/[\s_-]/g, ""))) ?? false;
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState("TODOS");
  const [exportando, setExportando] = useState(false);
  const q = useQuery({ queryKey: ["auditoria-integral", usuario?._id], queryFn: obtenerAuditoriaIntegral, enabled: abierto && administrador, retry: 1 });
  const filas = useMemo(() => (q.data?.personas ?? []).filter(p =>
    (!busqueda.trim() || normalizar(Object.values(p).map(texto).join(" ")).includes(normalizar(busqueda.trim()))) &&
    (filtro === "TODOS" || filtro === "CON_BLOQUE" && p.tieneBloque || filtro === "TALLA_SIN_BLOQUE" && p.tieneTalla && !p.tieneBloque || filtro === "SIN_TALLA" && !p.tieneTalla)), [q.data, busqueda, filtro]);
  async function exportar() {
    if (!q.data || exportando) return;
    setExportando(true);
    try { await exportarAuditoriaIntegral(q.data); toast.success("Excel de ocho hojas generado"); }
    catch (error) { toast.error(obtenerMensajeError(error)); }
    finally { setExportando(false); }
  }
  if (!administrador) return null;
  return <section className="space-y-4 rounded-2xl border bg-white p-5 text-slate-800">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-black text-[#74122A]">Auditoría integral de fraternos</h2><p>Todas las cuentas, roles, bloques, tallas, pagos y entregas. Solo lectura.</p></div><button type="button" className={boton} aria-expanded={abierto} onClick={() => setAbierto(v => !v)}>{abierto ? "Ocultar reporte" : "Ver reporte"}</button></header>
    {abierto ? <>
      {q.isLoading ? <p role="status">Consultando información…</p> : null}
      {q.isError ? <div role="alert" className="text-red-700">{obtenerMensajeError(q.error)} <button type="button" className={boton} onClick={() => void q.refetch()}>Reintentar</button></div> : null}
      {q.data ? <>
        <p className="rounded-lg bg-amber-50 p-3 text-sm">{q.data.alcance}</p>
        <p className="text-sm">Gestión: {q.data.gestion ? `${q.data.gestion.nombre} (${q.data.gestion.anio})` : "SIN GESTIÓN ACTIVA"} · Consulta: {new Date(q.data.generadoEn).toLocaleString("es-BO")}</p>
        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-7">{["totalUsuarios", "conBloque", "sinBloque", "conTalla", "sinTalla", "conRu", "sinRu"].map(k => <div key={k} className="rounded-lg bg-slate-50 p-3"><p>{titulo(k)}</p><strong className="text-2xl">{q.data!.resumen[k]}</strong></div>)}</div>
        <div className="rounded-xl border p-4"><h3 className="font-bold">Conciliación bloques vs tallas</h3><p>Personas con talla: {q.data.resumen.conTalla} − personas con bloque: {q.data.resumen.conBloque} = diferencia neta: {q.data.resumen.diferenciaNeta}.</p><p>Con talla sin bloque: {q.data.resumen.conTallaSinBloque} · Con bloque sin talla: {q.data.resumen.conBloqueSinTalla} · En ambos: {q.data.resumen.ambos}.</p><p>Documentos físicos de tallas: {q.data.resumen.registrosTalla}. No equivalen necesariamente a personas únicas.</p><button type="button" className={`${boton} mt-3`} onClick={() => { setFiltro("TALLA_SIN_BLOQUE"); setBusqueda(""); }}>Ver personas con talla sin bloque</button></div>
        <details><summary className="cursor-pointer font-bold">Resumen por tipo</summary><Tabla filas={q.data.porTipo}/></details>
        <details><summary className="cursor-pointer font-bold">Resumen por bloque</summary><p>Una persona con asignaciones inconsistentes puede figurar en varios bloques; el total general cuenta cada cuenta una vez.</p><Tabla filas={q.data.porBloque}/></details>
        <div className="flex flex-wrap gap-3"><label>Buscar<input className="ml-2 rounded border p-2" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Nombre, CI, RU, rol…"/></label><label>Mostrar<select className="ml-2 rounded border p-2" value={filtro} onChange={e => setFiltro(e.target.value)}><option value="TODOS">Todos los usuarios</option><option value="CON_BLOQUE">Con bloque</option><option value="TALLA_SIN_BLOQUE">Con talla sin bloque</option><option value="SIN_TALLA">Sin talla válida</option></select></label><button type="button" className={boton} disabled={q.isFetching} onClick={() => void q.refetch()}>Actualizar</button><button type="button" className={boton} disabled={exportando} onClick={() => void exportar()}>{exportando ? "Generando…" : "Exportar auditoría completa (8 hojas)"}</button></div>
        <p>{filas.length} personas visibles. El Excel incluye todo el universo, sin los filtros de pantalla.</p>
        <Tabla filas={filas}/>
        <details><summary className="cursor-pointer font-bold">Diferencias encontradas ({q.data.diferencias.length})</summary><p>Son alertas para revisión, no autorizan fusionar ni modificar usuarios.</p><Tabla filas={q.data.diferencias}/></details>
        <details><summary className="cursor-pointer font-bold">Pagos detallados</summary><Tabla filas={q.data.pagosDetallados}/></details>
        <details><summary className="cursor-pointer font-bold">Entregas de indumentaria</summary><Tabla filas={q.data.entregasDetalladas}/></details>
      </> : null}
    </> : null}
  </section>;
}

function Tabla({ filas }: { filas: FilaIntegral[] }) {
  const columnas = Object.keys(filas[0] ?? {});
  if (!filas.length) return <p className="p-4">Sin registros.</p>;
  return <div className="max-h-[520px] overflow-auto rounded-lg border"><table className="w-full text-left text-sm"><thead className="sticky top-0 bg-[#74122A] text-white"><tr>{columnas.map(c => <th scope="col" className="whitespace-nowrap p-3" key={c}>{titulo(c)}</th>)}</tr></thead><tbody>{filas.map((f, i) => <tr className="border-t" key={String(f.pagoId ?? f.entregaId ?? f.usuarioId ?? i) + i}>{columnas.map(c => <td key={c} className="min-w-[130px] p-3">{texto(f[c])}</td>)}</tr>)}</tbody></table></div>;
}

async function exportarAuditoriaIntegral(reporte: Reporte) {
  const { default: ExcelJS } = await import("exceljs");
  const libro = new ExcelJS.Workbook();
  const agregar = (nombre: string, filas: FilaIntegral[]) => {
    const hoja = libro.addWorksheet(nombre);
    const claves = Object.keys(filas[0] ?? { resultado: "" });
    hoja.addRow(claves.map(titulo));
    filas.forEach(f => hoja.addRow(claves.map(k => typeof f[k] === "number" ? f[k] : texto(f[k]))));
    hoja.views = [{ state: "frozen", ySplit: 1 }];
    hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: claves.length } };
    hoja.columns.forEach(c => { c.width = 24; });
    hoja.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    hoja.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF74122A" } };
    return hoja;
  };
  const resumen = agregar("Resumen general", Object.entries(reporte.resumen).map(([indicador, valor]) => ({ indicador: titulo(indicador), valor })));
  resumen.addRows([[], ["Generado", reporte.generadoEn], ["Gestión", reporte.gestion?.nombre ?? "SIN GESTIÓN"], ["Alcance", reporte.alcance], [], ["Por tipo"]]);
  for (const fila of reporte.porTipo) { resumen.addRow(Object.keys(fila).map(titulo)); resumen.addRow(Object.values(fila)); }
  resumen.addRow(["Por bloque"]);
  for (const fila of reporte.porBloque) { resumen.addRow(Object.keys(fila).map(titulo)); resumen.addRow(Object.values(fila)); }
  agregar("Todos los usuarios", reporte.personas);
  agregar("Usuarios con bloque", reporte.personas.filter(p => p.tieneBloque));
  agregar("Usuarios con talla sin bloque", reporte.personas.filter(p => p.tieneTalla && !p.tieneBloque));
  agregar("Usuarios sin talla", reporte.personas.filter(p => !p.tieneTalla));
  agregar("Pagos detallados", reporte.pagosDetallados);
  agregar("Entregas de indumentaria", reporte.entregasDetalladas);
  agregar("Diferencias encontradas", reporte.diferencias);
  const buffer = await libro.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a"); a.href = url; a.download = `Auditoria_integral_${reporte.generadoEn.slice(0, 10)}.xlsx`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
