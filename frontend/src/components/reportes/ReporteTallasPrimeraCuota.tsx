import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { obtenerReporteTallasPrimeraCuota, type PersonaTallaCuota, type ResumenTallaCuota } from "@/api/ReporteApi";

type Filtros = { sexo: string; talla: string; pago: string; estado: string; rol: string; bloque: string; buscar: string };
const inicial: Filtros = { sexo: "TODOS", talla: "TODOS", pago: "TODOS", estado: "TODOS", rol: "TODOS", bloque: "TODOS", buscar: "" };
const columnas = ["N.º", "Nombre completo", "CI", "Código fraterno", "Sexo", "Teléfono", "WhatsApp", "Correo", "Roles", "Bloque", "Talla polera", "Talla chamarra", "Primera cuota", "Monto primera cuota", "Monto pagado", "Estado general"];
const fila = (p: PersonaTallaCuota, indice: number) => [indice + 1, p.nombre, p.ci, p.codigoFraterno, p.sexo, p.telefono, p.whatsapp ?? "", p.correo, p.roles.join(" / "), p.bloque, p.tallaPolera ?? "SIN REGISTRAR", p.tallaChamarra ?? "SIN REGISTRAR", p.primeraCuota, p.montoPrimeraCuota, p.montoPagadoPrimeraCuota, p.estadoGeneral];

function aplicarFiltros(personas: PersonaTallaCuota[], filtros: Filtros) {
  const texto = filtros.buscar.trim().toLocaleLowerCase("es");
  return personas.filter((p) => {
    const coincideTexto = !texto || `${p.nombre} ${p.ci} ${p.codigoFraterno} ${p.telefono}`.toLocaleLowerCase("es").includes(texto);
    const coincideSexo = filtros.sexo === "TODOS" || p.sexo === filtros.sexo;
    const coincideTalla = filtros.talla === "TODOS" || (filtros.talla === "CON_TALLA" && p.conTalla) || (filtros.talla === "SIN_POLERA" && !p.tienePolera) || (filtros.talla === "SIN_CHAMARRA" && !p.tieneChamarra) || (filtros.talla === "SIN_NINGUNA" && p.pendienteTalla === "AMBAS");
    const coincidePago = filtros.pago === "TODOS" || p.primeraCuota === filtros.pago;
    const coincideEstado = filtros.estado === "TODOS" || (filtros.estado === "SIN_TALLA" && !p.conTalla) || (filtros.estado === "SIN_PRIMERA" && p.primeraCuota === "PENDIENTE") || (filtros.estado === "AMBOS" && !p.conTalla && p.primeraCuota === "PENDIENTE");
    const coincideRol = filtros.rol === "TODOS" || p.roles.includes(filtros.rol);
    const coincideBloque = filtros.bloque === "TODOS" || p.bloque === filtros.bloque;
    return coincideTexto && coincideSexo && coincideTalla && coincidePago && coincideEstado && coincideRol && coincideBloque;
  });
}

async function exportar(reporte: NonNullable<ReturnType<typeof useReporte>["data"]>, personas: PersonaTallaCuota[], completo: boolean) {
  const { default: ExcelJS } = await import("exceljs");
  const libro = new ExcelJS.Workbook(); libro.creator = "Fraternidad Tinkus Puros"; libro.created = new Date();
  const agregar = (nombre: string, datos: PersonaTallaCuota[], extraPendiente = false) => {
    const encabezados = extraPendiente ? [...columnas, "Pendiente"] : columnas;
    const hoja = libro.addWorksheet(nombre); hoja.addRow(encabezados);
    datos.forEach((p, i) => hoja.addRow(extraPendiente ? [...fila(p, i), p.pendienteTalla ?? ""] : fila(p, i)));
    hoja.views = [{ state: "frozen", ySplit: 1 }]; hoja.autoFilter = { from: "A1", to: `${String.fromCharCode(64 + encabezados.length)}1` };
    const cabecera = hoja.getRow(1); cabecera.font = { bold: true, color: { argb: "FFFFFFFF" } }; cabecera.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF74122A" } };
    hoja.columns.forEach((columna, i) => { columna.width = Math.min(42, Math.max(12, encabezados[i].length + 2, ...datos.map((p, n) => String(fila(p, n)[i] ?? "").length + 2))); });
    [3, 6, 7].forEach((numero) => { hoja.getColumn(numero).numFmt = "@"; });
  };
  const base = completo ? reporte.personas : personas;
  const resumen = libro.addWorksheet("Resumen general");
  const hombres = base.filter((p) => p.sexo === "HOMBRE"), mujeres = base.filter((p) => p.sexo === "MUJER");
  resumen.addRows([["REPORTE GENERAL DE TALLAS Y PRIMERA CUOTA"], [reporte.gestion.nombre], [], ["Indicador", "Total"], ["Total personas", base.length], ["Total hombres", hombres.length], ["Total mujeres", mujeres.length], ["Con talla", base.filter((p) => p.conTalla).length], ["Sin talla", base.filter((p) => !p.conTalla).length], ["Primera cuota pagada", base.filter((p) => p.primeraCuota === "PAGADA").length], ["Primera cuota pendiente", base.filter((p) => p.primeraCuota === "PENDIENTE").length], ["Sin talla + sin primera cuota", base.filter((p) => !p.conTalla && p.primeraCuota === "PENDIENTE").length], [], ["HOMBRES"], ["Con talla", hombres.filter((p) => p.conTalla).length], ["Sin talla", hombres.filter((p) => !p.conTalla).length], ["Primera cuota pendiente", hombres.filter((p) => p.primeraCuota === "PENDIENTE").length], ["Sin talla + sin primera cuota", hombres.filter((p) => !p.conTalla && p.primeraCuota === "PENDIENTE").length], [], ["MUJERES"], ["Con talla", mujeres.filter((p) => p.conTalla).length], ["Sin talla", mujeres.filter((p) => !p.conTalla).length], ["Primera cuota pendiente", mujeres.filter((p) => p.primeraCuota === "PENDIENTE").length], ["Sin talla + sin primera cuota", mujeres.filter((p) => !p.conTalla && p.primeraCuota === "PENDIENTE").length]]);
  resumen.getRow(1).font = { bold: true, size: 16, color: { argb: "FF74122A" } }; resumen.getRow(4).font = { bold: true }; resumen.columns = [{ width: 40 }, { width: 16 }];
  agregar("Listado general", base); agregar("Hombres", base.filter((p) => p.sexo === "HOMBRE")); agregar("Mujeres", base.filter((p) => p.sexo === "MUJER")); agregar("Con talla", base.filter((p) => p.conTalla)); agregar("Sin talla", base.filter((p) => !p.conTalla), true); agregar("Sin primera cuota", base.filter((p) => p.primeraCuota === "PENDIENTE")); agregar("Sin talla y sin cuota", base.filter((p) => !p.conTalla && p.primeraCuota === "PENDIENTE"));
  const datos = await libro.xlsx.writeBuffer(); const url = URL.createObjectURL(new Blob([datos], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })); const enlace = document.createElement("a"); enlace.href = url; enlace.download = completo ? "reporte-tallas-primera-cuota-completo.xlsx" : "reporte-tallas-primera-cuota-filtrado.xlsx"; enlace.click(); URL.revokeObjectURL(url);
}

function useReporte(abierto: boolean) { return useQuery({ queryKey: ["reporte-tallas-primera-cuota"], queryFn: obtenerReporteTallasPrimeraCuota, enabled: abierto }); }

export default function ReporteTallasPrimeraCuota() {
  const [abierto, setAbierto] = useState(false), [filtros, setFiltros] = useState(inicial);
  const consulta = useReporte(abierto); const personas = useMemo(() => aplicarFiltros(consulta.data?.personas ?? [], filtros), [consulta.data, filtros]);
  const cambiar = (campo: keyof Filtros, valor: string) => setFiltros((actual) => ({ ...actual, [campo]: valor }));
  return <section className="rounded-2xl border border-[#74122A]/20 bg-white p-5 shadow-sm print:hidden">
    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center"><div><h2 className="text-xl font-black text-[#74122A]">Reporte general de tallas y primera cuota</h2><p className="text-sm text-slate-600">Resumen de tallas, primera cuota y datos de contacto de los fraternos.</p></div><button onClick={() => setAbierto((v) => !v)} className="rounded-xl bg-[#74122A] px-5 py-3 font-black text-white">{abierto ? "OCULTAR REPORTE" : "VER REPORTE"}</button></div>
    {abierto && <div className="mt-5 space-y-5">{consulta.isLoading ? <p>Cargando reporte…</p> : consulta.error ? <p className="text-red-700">{consulta.error.message}</p> : consulta.data && <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5"><Metrica titulo="Total personas" valor={consulta.data.resumen.total}/><Metrica titulo="Hombres" valor={consulta.data.resumen.hombres.total}/><Metrica titulo="Mujeres" valor={consulta.data.resumen.mujeres.total}/><Metrica titulo="Con talla completa" valor={consulta.data.resumen.conTalla}/><Metrica titulo="Sin talla" valor={consulta.data.resumen.sinTalla}/><Metrica titulo="Con talla polera" valor={consulta.data.resumen.conPolera}/><Metrica titulo="Sin talla polera" valor={consulta.data.resumen.sinPolera}/><Metrica titulo="Con talla chamarra" valor={consulta.data.resumen.conChamarra}/><Metrica titulo="Sin talla chamarra" valor={consulta.data.resumen.sinChamarra}/><Metrica titulo="Sin ninguna talla" valor={consulta.data.resumen.sinNingunaTalla}/><Metrica titulo="Primera cuota pagada" valor={consulta.data.resumen.primeraCuotaPagada}/><Metrica titulo="Primera cuota pendiente" valor={consulta.data.resumen.primeraCuotaPendiente}/><Metrica titulo="Sin talla y cuota" valor={consulta.data.resumen.sinTallaYSinPrimeraCuota}/></div>
      <div className="grid gap-3 md:grid-cols-2"><ResumenGenero titulo="Hombres" resumen={consulta.data.resumen.hombres}/><ResumenGenero titulo="Mujeres" resumen={consulta.data.resumen.mujeres}/></div>
      <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6"><input value={filtros.buscar} onChange={(e) => cambiar("buscar", e.target.value)} placeholder="Nombre, CI, código o teléfono" className="rounded-xl border p-3 md:col-span-3 xl:col-span-2"/><Select valor={filtros.sexo} cambiar={(v) => cambiar("sexo", v)} opciones={[["TODOS","Sexo: todos"],["HOMBRE","Hombres"],["MUJER","Mujeres"]]}/><Select valor={filtros.talla} cambiar={(v) => cambiar("talla", v)} opciones={[["TODOS","Talla: todas"],["CON_TALLA","Con talla"],["SIN_POLERA","Sin polera"],["SIN_CHAMARRA","Sin chamarra"],["SIN_NINGUNA","Sin ninguna talla"]]}/><Select valor={filtros.pago} cambiar={(v) => cambiar("pago", v)} opciones={[["TODOS","Pago: todos"],["PAGADA","Primera pagada"],["PENDIENTE","Primera pendiente"]]}/><Select valor={filtros.estado} cambiar={(v) => cambiar("estado", v)} opciones={[["TODOS","Estado: todos"],["SIN_TALLA","Sin talla"],["SIN_PRIMERA","Sin primera cuota"],["AMBOS","Sin talla + cuota"]]}/><Select valor={filtros.rol} cambiar={(v) => cambiar("rol", v)} opciones={[["TODOS","Rol: todos"],["FRATERNO","Fraterno"],["GUIA","Guía"],["ADMINISTRADOR","Administrador"]]}/><Select valor={filtros.bloque} cambiar={(v) => cambiar("bloque", v)} opciones={[["TODOS","Bloque: todos"],...consulta.data.bloques.map((b) => [b,b])]}/></div>
      <div className="flex flex-wrap gap-3"><button onClick={() => void exportar(consulta.data!, personas, false)} className="rounded-xl bg-blue-700 px-4 py-2 font-bold text-white">Exportar filtrados</button><button onClick={() => void exportar(consulta.data!, consulta.data!.personas, true)} className="rounded-xl bg-emerald-700 px-4 py-2 font-bold text-white">Exportar reporte completo</button><span className="self-center text-sm font-bold text-slate-600">{personas.length} resultado(s)</span></div>
      <div className="overflow-x-auto"><table className="min-w-[1500px] w-full text-xs"><thead><tr>{columnas.map((c) => <th key={c} className="border bg-slate-100 p-2 text-left">{c}</th>)}</tr></thead><tbody>{personas.map((p, i) => <tr key={p.fraternoId}>{fila(p,i).map((v,j) => <td key={columnas[j]} className="border p-2">{j === 6 && p.whatsapp ? <a className="text-emerald-700 underline" href={`https://wa.me/${p.whatsapp.replace("+","")}`} target="_blank" rel="noreferrer">{v}</a> : String(v)}</td>)}</tr>)}</tbody></table></div>
    </>}</div>}
  </section>;
}

function Metrica({titulo,valor}:{titulo:string;valor:number}) { return <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">{titulo}</p><b className="text-2xl text-[#74122A]">{valor}</b></div>; }
function ResumenGenero({titulo,resumen}:{titulo:string;resumen:ResumenTallaCuota}) { return <div className="rounded-xl border p-4"><h3 className="font-black text-[#74122A]">{titulo}</h3><div className="mt-2 grid grid-cols-2 gap-2 text-sm"><span>Total: <b>{resumen.total}</b></span><span>Con talla: <b>{resumen.conTalla}</b></span><span>Sin talla: <b>{resumen.sinTalla}</b></span><span>Primera pagada: <b>{resumen.primeraCuotaPagada}</b></span><span>Primera pendiente: <b>{resumen.primeraCuotaPendiente}</b></span><span>Sin talla + pendiente: <b>{resumen.sinTallaYSinPrimeraCuota}</b></span></div></div>; }
function Select({valor,cambiar,opciones}:{valor:string;cambiar:(v:string)=>void;opciones:string[][]}) { return <select value={valor} onChange={(e) => cambiar(e.target.value)} className="rounded-xl border p-3">{opciones.map(([v,t]) => <option key={v} value={v}>{t}</option>)}</select>; }
