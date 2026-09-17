import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  obtenerAuditoriaParticipacion,
  type AuditoriaParticipacion as AuditoriaParticipacionDatos,
  type PersonaAuditoriaParticipacion,
} from "@/api/ReporteApi";

const bs = (valor: number) => `Bs ${Number(valor || 0).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fecha = (valor: string | null) => valor ? new Date(valor).toLocaleDateString("es-BO") : "SIN REGISTRO";
const siNo = (valor: boolean) => valor ? "SÍ" : "NO";

const encabezados = [
  "Nombre completo", "CI", "RU", "Código fraterno", "Celular", "WhatsApp", "Correo", "Sexo", "Roles", "Bloque", "Guías del bloque", "Estado participación", "Evidencias",
  "Tiene polera", "Talla polera", "Tiene chamarra", "Talla chamarra", "Fecha medición", "Tipo participante", "Origen", "Monto original", "Monto esperado registrado", "Monto esperado auditado",
  "Primera cuota", "Monto primera", "Fecha primera", "Segunda cuota", "Monto segunda", "Fecha segunda", "Tercera cuota", "Monto tercera", "Fecha tercera",
  "Total pagado", "Total verificado", "Saldo pendiente", "Estado cuota", "Motivo exención", "Administrador exención", "Fecha exención", "Beneficio referenciado", "Estado beneficio", "Última actividad", "Inconsistencias",
];

const fila = (persona: PersonaAuditoriaParticipacion) => [
  persona.nombre, persona.ci, persona.ru, persona.codigoFraterno, persona.celular, persona.whatsapp, persona.correo, persona.sexo, persona.rolActual, persona.bloque, persona.guiasBloque.join(" / "), persona.estadoParticipacion, persona.evidencias.join(" / "),
  siNo(persona.tienePolera), persona.tallaPolera, siNo(persona.tieneChamarra), persona.tallaChamarra, fecha(persona.fechaMedicion), persona.tipoParticipante, persona.origen, persona.montoOriginal, persona.montoEsperadoRegistrado, persona.montoEsperado,
  persona.primeraCuota.estado, persona.primeraCuota.monto, fecha(persona.primeraCuota.fecha), persona.segundaCuota.estado, persona.segundaCuota.monto, fecha(persona.segundaCuota.fecha), persona.terceraCuota.estado, persona.terceraCuota.monto, fecha(persona.terceraCuota.fecha),
  persona.totalPagado, persona.totalVerificado, persona.saldoPendiente, persona.estadoCuota, persona.motivoExencion, persona.administradorExencion, fecha(persona.fechaExencion), persona.beneficioReferenciado, persona.estadoBeneficio, fecha(persona.ultimaActividad), persona.problemas.join("; "),
];

function Metrica({ titulo, valor, detalle }: { titulo: string; valor: string | number; detalle?: string }) {
  return <article className="rounded-xl border bg-white p-4"><p className="text-xs font-black uppercase text-slate-500">{titulo}</p><strong className="mt-1 block text-2xl text-[#74122A]">{valor}</strong>{detalle ? <p className="mt-1 text-xs text-slate-600">{detalle}</p> : null}</article>;
}

function Tabla({ personas }: { personas: PersonaAuditoriaParticipacion[] }) {
  return <div className="max-h-[560px] overflow-auto rounded-xl border bg-white"><table className="w-full min-w-[1900px] text-left text-xs"><thead className="sticky top-0 bg-[#74122A] text-white"><tr>{["Nombre / CI", "RU / Código", "Roles", "Bloque / Guías", "Participación", "Tallas", "Tipo / Beneficio", "Esperado", "Pagado", "Verificado", "Saldo", "Cuotas 1 / 2 / 3", "Exención", "Inconsistencias"].map((titulo) => <th key={titulo} className="p-3">{titulo}</th>)}</tr></thead><tbody>{personas.map((persona) => <tr key={persona.usuarioId} className="border-t align-top"><td className="p-3"><b>{persona.nombre}</b><br/>CI {persona.ci}<br/>{persona.celular}</td><td className="p-3">RU {persona.ru}<br/>{persona.codigoFraterno}</td><td className="p-3">{persona.rolActual}</td><td className="p-3"><b>{persona.bloque}</b><br/>{persona.guiasBloque.join(" / ") || "SIN GUÍAS"}</td><td className="p-3">{persona.estadoParticipacion}<br/><span className="text-slate-500">{persona.evidencias.join(" / ")}</span></td><td className="p-3">Polera: {persona.tallaPolera}<br/>Chamarra: {persona.tallaChamarra}<br/>{fecha(persona.fechaMedicion)}</td><td className="p-3"><b>{persona.tipoParticipante}</b><br/>{persona.estadoBeneficio}<br/>{persona.beneficioReferenciado}</td><td className="p-3">{bs(persona.montoEsperado)}</td><td className="p-3">{bs(persona.totalPagado)}</td><td className="p-3">{bs(persona.totalVerificado)}</td><td className="p-3 font-bold">{bs(persona.saldoPendiente)}</td><td className="p-3">{persona.primeraCuota.estado}<br/>{persona.segundaCuota.estado}<br/>{persona.terceraCuota.estado}</td><td className="p-3">{persona.motivoExencion}<br/>{persona.administradorExencion}<br/>{fecha(persona.fechaExencion)}</td><td className="p-3 font-bold text-amber-800">{persona.problemas.join("; ") || "—"}</td></tr>)}</tbody></table>{!personas.length ? <p className="p-6 text-center text-slate-500">No existen registros en esta categoría.</p> : null}</div>;
}

type Vista = "TODOS" | "CON_BLOQUE" | "SIN_BLOQUE_PAGO" | "SIN_BLOQUE_TALLA" | "EXENCIONES" | "DESCUENTOS" | "SIN_PAGO" | "INCONSISTENCIAS";

export default function AuditoriaParticipacion() {
  const [abierta, setAbierta] = useState(false);
  const [vista, setVista] = useState<Vista>("TODOS");
  const exportando = useRef(false);
  const consulta = useQuery({ queryKey: ["auditoria-participacion"], queryFn: obtenerAuditoriaParticipacion, enabled: abierta });
  const data = consulta.data;
  const detalle = useMemo(() => {
    if (!data) return [];
    if (vista === "CON_BLOQUE") return data.conBloque;
    if (vista === "SIN_BLOQUE_PAGO") return data.sinBloqueConPago;
    if (vista === "SIN_BLOQUE_TALLA") return data.sinBloqueConTalla;
    if (vista === "EXENCIONES") return data.controlExenciones;
    if (vista === "DESCUENTOS") return data.descuentos;
    if (vista === "SIN_PAGO") return data.sinPago;
    if (vista === "INCONSISTENCIAS") return data.inconsistencias;
    return data.personas;
  }, [data, vista]);

  const exportar = async (reporte: AuditoriaParticipacionDatos) => {
    if (exportando.current) return;
    exportando.current = true;
    try {
      const ExcelJS = (await import("exceljs")).default;
      const libro = new ExcelJS.Workbook();
      libro.creator = "Sistema Tinkus Puros y Naturales";
      libro.created = new Date(reporte.generadoEn);
      const estilo = (hoja: import("exceljs").Worksheet, ultimaColumna: string) => {
        hoja.views = [{ state: "frozen", ySplit: 1 }];
        hoja.autoFilter = { from: "A1", to: `${ultimaColumna}1` };
        hoja.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
        hoja.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF74122A" } };
        hoja.columns.forEach((columna, indice) => { columna.width = indice === 0 ? 34 : [8, 9, 10, 11, 39, 42].includes(indice) ? 28 : 17; });
      };
      const agregarPersonas = (nombre: string, personas: PersonaAuditoriaParticipacion[]) => {
        const hoja = libro.addWorksheet(nombre);
        hoja.addRow(encabezados);
        personas.forEach((persona) => hoja.addRow(fila(persona)));
        estilo(hoja, "AQ");
      };
      const resumen = libro.addWorksheet("01_RESUMEN_GENERAL");
      resumen.addRows([
        ["AUDITORÍA DE PARTICIPACIÓN, PAGOS Y EXENCIONES — SOLO LECTURA"],
        ["Gestión", reporte.gestion ? `${reporte.gestion.nombre} (${reporte.gestion.anio})` : "SIN GESTIÓN"],
        ["Universo", reporte.definicionUniverso],
        ["Generado", new Date(reporte.generadoEn).toLocaleString("es-BO")],
        [],
        ["INDICADOR", "VALOR"],
        ["Participantes únicos", reporte.resumen.participantes],
        ["Personas que forman el monto general", reporte.resumen.personasQueFormanMonto],
        ["Con bloque", reporte.resumen.conBloque], ["Con talla", reporte.resumen.conTalla], ["Con cuota", reporte.resumen.conCuota],
        ["Internos", reporte.resumen.internos], ["Externos", reporte.resumen.externos], ["Exentos", reporte.resumen.exentos], ["Free", reporte.resumen.free], ["Descuentos aplicados", reporte.resumen.descuentos], ["Descuentos aplicados o referenciados", reporte.resumen.descuentosReferenciados],
        ["Total general registrado", reporte.resumen.totalGeneralRegistrado], ["Monto internos", reporte.resumen.montoInternos], ["Monto externos", reporte.resumen.montoExternos], ["Monto sin clasificar", reporte.resumen.montoSinClasificar],
        ["Monto exento dentro del total registrado", reporte.resumen.montoExentoRegistrado], ["Monto real esperado auditado", reporte.resumen.montoRealEsperado], ["Total pagado", reporte.resumen.totalPagado], ["Total verificado", reporte.resumen.totalVerificado], ["Saldo pendiente", reporte.resumen.saldoPendiente],
        ["Monto explicado", reporte.resumen.montoExplicado], ["Monto sin explicación", reporte.resumen.montoSinExplicacion], ["Inconsistencias", reporte.resumen.inconsistencias],
        [], ["VALIDACIÓN", "RESULTADO"], ...Object.entries(reporte.validaciones).map(([nombre, valor]) => [nombre, valor ? "CORRECTA" : "REVISAR"]),
      ]);
      resumen.columns = [{ width: 52 }, { width: 90 }];
      agregarPersonas("02_TODOS_PARTICIPANTES", reporte.personas);
      agregarPersonas("03_CON_BLOQUE", reporte.conBloque);
      agregarPersonas("04_SIN_BLOQUE_CON_PAGO", reporte.sinBloqueConPago);
      agregarPersonas("05_SIN_BLOQUE_CON_TALLA", reporte.sinBloqueConTalla);
      agregarPersonas("06_EXENTOS", reporte.controlExenciones);
      agregarPersonas("07_DESCUENTOS", reporte.descuentos);
      agregarPersonas("08_SIN_PAGO", reporte.sinPago);
      agregarPersonas("09_INCONSISTENCIAS", reporte.inconsistencias);
      const contenido = await libro.xlsx.writeBuffer();
      const url = URL.createObjectURL(new Blob([contenido], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = `AUDITORIA_PARTICIPANTES_${new Date().toISOString().slice(0, 10)}.xlsx`;
      enlace.click();
      setTimeout(() => URL.revokeObjectURL(url), 1_000);
    } finally {
      exportando.current = false;
    }
  };

  if (!abierta) return <section className="rounded-3xl border-2 border-emerald-200 bg-emerald-50 p-5"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-widest text-emerald-700">Reporte adicional de solo lectura</p><h2 className="text-2xl font-black text-[#74122A]">Auditoría de participación, pagos y exenciones</h2><p className="max-w-4xl text-sm text-emerald-900">Une personas con bloque, talla o cuota; no modifica pagos, exenciones ni datos.</p></div><button type="button" onClick={() => setAbierta(true)} className="rounded-xl bg-[#74122A] px-5 py-3 font-black text-white">VER AUDITORÍA</button></div></section>;
  if (consulta.isLoading) return <section className="rounded-3xl border-2 border-emerald-200 bg-emerald-50 p-6">Calculando participantes, pagos, tallas y exenciones…</section>;
  if (consulta.isError || !data) return <section className="rounded-3xl border border-red-300 bg-red-50 p-6 text-red-800"><h2 className="font-black">No se pudo cargar la auditoría de participación</h2><p>{consulta.error instanceof Error ? consulta.error.message : "Intenta nuevamente."}</p><button type="button" onClick={() => setAbierta(false)} className="mt-3 font-bold underline">Cerrar</button></section>;

  return <section className="space-y-5 rounded-3xl border-2 border-emerald-200 bg-emerald-50 p-5">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-widest text-emerald-700">Universo bloque ∪ talla ∪ cuota</p><h2 className="text-2xl font-black text-[#74122A]">Auditoría de participación, pagos y exenciones</h2><p className="max-w-4xl text-sm text-emerald-900">{data.definicionUniverso}</p></div><div className="flex gap-2"><button type="button" onClick={() => void exportar(data)} className="rounded-xl bg-emerald-700 px-5 py-3 font-black text-white">EXPORTAR AUDITORÍA DE PARTICIPANTES</button><button type="button" onClick={() => setAbierta(false)} className="rounded-xl border px-4 py-3 font-black">OCULTAR</button></div></header>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6"><Metrica titulo="Participantes únicos" valor={data.resumen.participantes} detalle={`${data.resumen.personasQueFormanMonto} forman el total general`}/><Metrica titulo="Con bloque" valor={data.resumen.conBloque}/><Metrica titulo="Con talla" valor={data.resumen.conTalla}/><Metrica titulo="Con cuota" valor={data.resumen.conCuota}/><Metrica titulo="Exentos / free" valor={`${data.resumen.exentos} / ${data.resumen.free}`}/><Metrica titulo="Descuentos" valor={data.resumen.descuentos} detalle={`${data.resumen.descuentosReferenciados} aplicados o referenciados`}/></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6"><Metrica titulo="Total general registrado" valor={bs(data.resumen.totalGeneralRegistrado)}/><Metrica titulo="Internos" valor={bs(data.resumen.montoInternos)} detalle={`${data.resumen.internos} personas`}/><Metrica titulo="Externos" valor={bs(data.resumen.montoExternos)} detalle={`${data.resumen.externos} personas`}/><Metrica titulo="Exentos dentro del total" valor={bs(data.resumen.montoExentoRegistrado)}/><Metrica titulo="Esperado auditado" valor={bs(data.resumen.montoRealEsperado)}/><Metrica titulo="Sin explicación" valor={bs(data.resumen.montoSinExplicacion)} detalle={data.resumen.montoSinExplicacion === 0 ? "Conciliación correcta" : "Requiere revisión"}/></div>
    <div className="rounded-xl bg-white p-4 text-sm"><b>Dinero:</b> pagado {bs(data.resumen.totalPagado)} · verificado {bs(data.resumen.totalVerificado)} · saldo pendiente {bs(data.resumen.saldoPendiente)}. Tarifas vigentes usadas como referencia: interno {bs(data.tarifas.interno)} y externo {bs(data.tarifas.externo)}.</div>
    <div className="flex flex-wrap gap-2">{([['TODOS', `Todos (${data.personas.length})`], ['CON_BLOQUE', `Con bloque (${data.conBloque.length})`], ['SIN_BLOQUE_PAGO', `Sin bloque con pago (${data.sinBloqueConPago.length})`], ['SIN_BLOQUE_TALLA', `Sin bloque con talla (${data.sinBloqueConTalla.length})`], ['EXENCIONES', `Control de exenciones (${data.controlExenciones.length})`], ['DESCUENTOS', `Descuentos (${data.descuentos.length})`], ['SIN_PAGO', `Sin pago (${data.sinPago.length})`], ['INCONSISTENCIAS', `Inconsistencias (${data.inconsistencias.length})`]] as Array<[Vista, string]>).map(([codigo, texto]) => <button key={codigo} type="button" onClick={() => setVista(codigo)} className={`rounded-lg border px-3 py-2 text-sm font-bold ${vista === codigo ? "bg-[#74122A] text-white" : "bg-white text-[#74122A]"}`}>{texto}</button>)}</div>
    <Tabla personas={detalle}/>
    <details className="rounded-xl border border-amber-300 bg-amber-50 p-4"><summary className="cursor-pointer font-black text-amber-900">Referencias de beneficios conocidas ({data.referenciasBeneficio.length})</summary><p className="my-2 text-sm">Son referencias de auditoría; no modifican cuotas automáticamente.</p>{data.referenciasBeneficio.map((referencia) => <p key={`${referencia.tipo}-${referencia.etiqueta}`} className="mt-1 text-sm"><b>{referencia.tipo} · {referencia.etiqueta}:</b> {referencia.estado}{referencia.porcentaje ? ` · ${referencia.porcentaje}%` : ""}{referencia.candidatos.length ? ` — ${referencia.candidatos.map((candidato) => `${candidato.nombre} (CI ${candidato.ci})`).join(", ")}` : ""}</p>)}</details>
  </section>;
}
