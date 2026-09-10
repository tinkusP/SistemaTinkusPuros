import { useQuery } from "@tanstack/react-query";
import { obtenerReportePagosCronologicos, type PersonaPagoCronologico } from "@/api/ReporteApi";

const fecha = (valor?: string | null) => valor ? new Date(valor).toLocaleString("es-BO") : "—";

export default function ReportePagosCronologicos() {
  const consulta = useQuery({ queryKey: ["reporte-pagos-cronologicos"], queryFn: obtenerReportePagosCronologicos });
  if (consulta.isLoading) return <section className="rounded-2xl bg-white p-5">Generando cronología de pagos…</section>;
  if (!consulta.data?.gestion) return <section className="rounded-2xl bg-white p-5 text-slate-600">No existe una gestión activa para generar la cronología.</section>;
  const exportar = async () => {
    const { default: ExcelJS } = await import("exceljs"); const libro = new ExcelJS.Workbook();
    const agregar = (nombre: string, personas: PersonaPagoCronologico[], campo: "primera" | "segunda" | "tercera" | "fechaCompleto") => {
      const hoja = libro.addWorksheet(nombre); hoja.addRow(["Posición", "Nombre", "CI", "Bloque", "Plan", "Fecha", "Monto verificado", "Saldo"]);
      personas.forEach((p, i) => hoja.addRow([i + 1, p.nombre, p.ci, p.bloque, p.planElegido ?? "SIN PLAN", fecha(campo === "fechaCompleto" ? p.fechaCompleto : p[campo]?.fechaPago), p.montoVerificado, p.saldoVerificado]));
      hoja.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } }; hoja.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF74122A" } }; hoja.columns.forEach(c => c.width = 22);
    };
    agregar("Primera cuota", consulta.data.rankings.primera, "primera"); agregar("Segunda cuota", consulta.data.rankings.segunda, "segunda"); agregar("Tercera cuota", consulta.data.rankings.tercera, "tercera"); agregar("Pago completo", consulta.data.rankings.completos, "fechaCompleto");
    const contenido = await libro.xlsx.writeBuffer(); const enlace = document.createElement("a"); enlace.href = URL.createObjectURL(new Blob([contenido])); enlace.download = "reporte-pagos-cronologicos.xlsx"; enlace.click(); URL.revokeObjectURL(enlace.href);
  };
  return <section className="rounded-2xl border bg-white p-5 shadow-sm print:hidden">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black text-[#74122A]">Orden cronológico de pagos</h2><p className="text-sm text-slate-600">Solo utiliza pagos verificados; separa primera, segunda, tercera cuota y pago completo.</p></div><button onClick={() => void exportar()} className="rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white">Exportar Excel</button></div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{([['Primera cuota',consulta.data.rankings.primera],['Segunda cuota',consulta.data.rankings.segunda],['Tercera cuota',consulta.data.rankings.tercera],['Pago completo',consulta.data.rankings.completos]] as const).map(([titulo, lista]) => <div key={titulo} className="rounded-xl bg-slate-50 p-4"><b>{titulo}</b><p className="text-2xl font-black text-[#74122A]">{lista.length}</p><p className="truncate text-xs text-slate-600">Primero: {lista[0]?.nombre || "Sin registros"}</p></div>)}</div>
  </section>;
}
