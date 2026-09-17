import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import {
  obtenerAuditoriaFinancieraGeneral,
  type PersonaAuditoriaFinanciera,
  type PagoAuditoriaFinanciera,
} from "@/api/ReporteApi";
import { registrarAjusteFinanciero, type AccionAjusteFinanciero, type TipoExencionFinanciera } from "@/api/CuotaApi";

const bs = (valor: number) => `Bs ${Number(valor || 0).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fecha = (valor: string | null) => valor ? new Date(valor).toLocaleDateString("es-BO") : "SIN REGISTRO";

const encabezadosPersonas = ["Nombre", "CI", "Roles", "Bloque", "Participación", "Interno / Externo", "Tipo de pago", "Estado del beneficio", "Referencia", "Esperado registrado", "Esperado ajustado", "Ajuste vigente", "Tarifa normal", "Pagado / registrado", "Verificado", "Por verificar", "Observado", "Rechazado", "Saldo auditado", "Estado cuota", "Última actividad", "Motivo", "Inconsistencias"];
const filaPersona = (persona: PersonaAuditoriaFinanciera) => [persona.nombre, persona.ci, persona.roles.join(" / "), persona.bloque, persona.participacion, persona.tipo, persona.tipoPagoAuditoria, persona.estadoBeneficio, persona.referenciaBeneficio, persona.montoEsperadoRegistrado, persona.montoEsperadoAjustado, persona.estadoAjusteFinanciero, persona.montoTotal, persona.montoRegistrado, persona.montoVerificado, persona.montoPorVerificar, persona.montoObservado, persona.montoRechazado, persona.saldoCalculado, persona.estadoCuota, fecha(persona.ultimaActividad), persona.motivoFuera, persona.problemas.join("; ")];
const encabezadosPagos = ["Nombre", "CI", "Roles", "Bloque", "Participación", "Interno / Externo", "Tipo de pago", "N.º pago", "Monto", "Fecha pago", "Fecha revisión", "Estado revisión", "Método", "Tiene comprobante"];
const filaPago = (pago: PagoAuditoriaFinanciera) => [pago.nombre, pago.ci, pago.roles.join(" / "), pago.bloque, pago.participacion, pago.tipo, pago.tipoPagoAuditoria, pago.numeroPago, pago.monto, fecha(pago.fechaPago), fecha(pago.fechaRevision), pago.estado, pago.metodo, pago.tieneComprobante ? "SÍ" : "NO"];

function Metrica({ titulo, valor, detalle }: { titulo: string; valor: string | number; detalle?: string }) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-black uppercase text-slate-500">{titulo}</p><strong className="mt-1 block text-2xl text-[#74122A]">{valor}</strong>{detalle ? <p className="mt-1 text-xs text-slate-600">{detalle}</p> : null}</article>;
}

function TablaPersonas({ personas, onAjustar }: { personas: PersonaAuditoriaFinanciera[]; onAjustar: (persona: PersonaAuditoriaFinanciera) => void }) {
  return <div className="max-h-[520px] overflow-auto rounded-xl border bg-white"><table className="w-full min-w-[1800px] text-left text-xs"><thead className="sticky top-0 bg-[#74122A] text-white"><tr>{["Nombre", "CI", "Roles", "Bloque", "Origen", "Tipo pago", "Esperado original / ajustado", "Registrado", "Verificado", "Por verificar", "Saldo", "Estado", "Última actividad", "Motivo / inconsistencias", "Acciones"].map((titulo) => <th key={titulo} className="p-3">{titulo}</th>)}</tr></thead><tbody>{personas.map((persona) => <tr key={persona.usuarioId} className="border-t align-top"><td className="p-3 font-bold">{persona.nombre}</td><td className="p-3">{persona.ci}</td><td className="p-3">{persona.roles.join(" / ")}</td><td className="p-3">{persona.bloque}</td><td className="p-3">{persona.tipo}</td><td className="p-3"><b>{persona.tipoPagoAuditoria}</b><br/><span className="text-slate-500">{persona.estadoBeneficio}</span></td><td className="p-3">{bs(persona.montoEsperadoRegistrado)}<br/><b className="text-[#74122A]">{bs(persona.montoEsperadoAjustado)}</b><br/><span className="text-slate-500">{persona.estadoAjusteFinanciero.replaceAll("_", " ")}</span></td><td className="p-3">{bs(persona.montoRegistrado)}</td><td className="p-3">{bs(persona.montoVerificado)}</td><td className="p-3">{bs(persona.montoPorVerificar)}</td><td className="p-3 font-bold">{bs(persona.saldoCalculado)}</td><td className="p-3">{persona.estadoCuota}</td><td className="p-3">{fecha(persona.ultimaActividad)}</td><td className="p-3">{persona.ajusteFinanciero?.motivo || persona.motivoFuera || "—"}{persona.problemas.length ? <><br/><span className="font-bold text-amber-800">{persona.problemas.join("; ")}</span></> : null}</td><td className="p-3"><button type="button" onClick={() => onAjustar(persona)} className="rounded-lg bg-[#74122A] px-3 py-2 font-black text-white">GESTIONAR</button></td></tr>)}</tbody></table>{!personas.length ? <p className="p-6 text-center text-slate-500">No existen registros en esta categoría.</p> : null}</div>;
}

type VistaDetalle = "SIN_BLOQUE" | "SIN_PAGO" | "SIN_PARTICIPACION" | "BENEFICIOS" | "INCONSISTENCIAS";

export default function AuditoriaFinancieraGeneral() {
  const queryClient = useQueryClient();
  const consulta = useQuery({ queryKey: ["auditoria-financiera-general"], queryFn: obtenerAuditoriaFinancieraGeneral });
  const [vista, setVista] = useState<VistaDetalle>("SIN_BLOQUE");
  const [personaAjuste, setPersonaAjuste] = useState<PersonaAuditoriaFinanciera | null>(null);
  const [accion, setAccion] = useState<AccionAjusteFinanciero>("EXCLUIR_CALCULO");
  const [motivo, setMotivo] = useState("");
  const [tipoExencion, setTipoExencion] = useState<TipoExencionFinanciera>("DIRECTIVA");
  const [porcentaje, setPorcentaje] = useState(50);
  const [montoFinal, setMontoFinal] = useState(0);
  const exportando = useRef(false);
  const data = consulta.data;
  const beneficios = useMemo(() => data?.personas.filter((persona) => persona.tipoPagoAuditoria !== "NORMAL" || Boolean(persona.ajusteFinanciero)) ?? [], [data]);
  const detalle = useMemo(() => {
    if (!data) return [];
    if (vista === "SIN_PAGO") return data.personasSinPago;
    if (vista === "SIN_PARTICIPACION") return data.pagosSinParticipacion;
    if (vista === "BENEFICIOS") return beneficios;
    if (vista === "INCONSISTENCIAS") return data.inconsistencias;
    return data.pagosSinBloque;
  }, [beneficios, data, vista]);

  const ajuste = useMutation({
    mutationFn: () => {
      if (!personaAjuste) throw new Error("Selecciona una persona");
      if (motivo.trim().length < 3) throw new Error("El motivo es obligatorio y debe tener al menos 3 caracteres");
      return registrarAjusteFinanciero(personaAjuste.usuarioId, {
        accion,
        motivo: motivo.trim(),
        tipoExencion: accion === "MARCAR_EXENTO" ? tipoExencion : undefined,
        porcentajeDescuento: accion === "MARCAR_DESCUENTO" ? porcentaje : undefined,
        montoEsperadoFinal: accion === "MARCAR_DESCUENTO" ? montoFinal : undefined,
      });
    },
    onSuccess: async (respuesta) => {
      toast.success(respuesta.message);
      setPersonaAjuste(null);
      setMotivo("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["auditoria-financiera-general"] }),
        queryClient.invalidateQueries({ queryKey: ["auditoria-participacion"] }),
        queryClient.invalidateQueries({ queryKey: ["control-financiero-bloques"] }),
      ]);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "No se pudo guardar el ajuste"),
  });

  const abrirAjuste = (persona: PersonaAuditoriaFinanciera) => {
    const restaurar = !["SIN_AJUSTE", "RESTAURADO"].includes(persona.estadoAjusteFinanciero);
    setPersonaAjuste(persona);
    setAccion(restaurar ? "RESTAURAR_CALCULO" : "EXCLUIR_CALCULO");
    setMotivo("");
    setTipoExencion("DIRECTIVA");
    setPorcentaje(50);
    setMontoFinal(Number((persona.montoEsperadoRegistrado * 0.5).toFixed(2)));
  };

  const cambiarPorcentaje = (valor: number) => {
    setPorcentaje(valor);
    setMontoFinal(Number(((personaAjuste?.montoEsperadoRegistrado ?? 0) * (1 - valor / 100)).toFixed(2)));
  };

  const exportar = async () => {
    if (!data || exportando.current) return;
    exportando.current = true;
    try {
      const ExcelJS = (await import("exceljs")).default;
      const libro = new ExcelJS.Workbook();
      libro.creator = "Sistema Tinkus Puros y Naturales";
      libro.created = new Date(data.generadoEn);
      const estilo = (hoja: import("exceljs").Worksheet, ultimaColumna: string) => {
        hoja.views = [{ state: "frozen", ySplit: 1 }];
        hoja.autoFilter = { from: "A1", to: `${ultimaColumna}1` };
        hoja.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
        hoja.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF74122A" } };
        hoja.columns.forEach((columna, indice) => { columna.width = indice === 0 ? 34 : [2, 3, 7, 8, 19, 20].includes(indice) ? 25 : 17; });
      };
      const hojaPersonas = (nombre: string, personas: PersonaAuditoriaFinanciera[]) => { const hoja = libro.addWorksheet(nombre); hoja.addRow(encabezadosPersonas); personas.forEach((persona) => hoja.addRow(filaPersona(persona))); estilo(hoja, "W"); return hoja; };
      const resumen = libro.addWorksheet("01_RESUMEN");
      resumen.addRows([
        ["AUDITORÍA FINANCIERA GENERAL — AJUSTES ADMINISTRATIVOS SIN MODIFICAR PAGOS"],
        ["Gestión", data.gestion ? `${data.gestion.nombre} (${data.gestion.anio})` : "SIN GESTIÓN"],
        ["Generado", new Date(data.generadoEn).toLocaleString("es-BO")],
        [],
        ["UNIVERSO GENERAL", "VALOR"],
        ["Personas únicas", data.universoGeneral.cantidad], ["Monto gestión sin ajustes", data.resumenAjustes.totalGeneral], ["Total excluido", data.resumenAjustes.totalExcluido], ["Total exento", data.resumenAjustes.totalExento], ["Total descuento", data.resumenAjustes.totalDescuento], ["Total participación real", data.resumenAjustes.totalParticipacionReal], ["Monto pagado / registrado", data.universoGeneral.montoPagado], ["Monto verificado", data.universoGeneral.montoVerificado], ["Monto pendiente", data.universoGeneral.montoPendiente], ["Monto por verificar", data.universoGeneral.montoPorVerificar], ["Monto observado", data.universoGeneral.montoObservado], ["Monto rechazado", data.universoGeneral.montoRechazado],
        [], ["UNIVERSO BLOQUES", "VALOR"],
        ["Personas", data.universoBloques.cantidad], ["Internos", data.universoBloques.internos], ["Externos", data.universoBloques.externos], ["Exentos", data.universoBloques.exentos], ["Monto teórico", data.universoBloques.montoTeorico], ["Monto exento", data.universoBloques.montoExento], ["Monto real esperado", data.universoBloques.montoEsperado], ["Monto verificado", data.universoBloques.montoVerificado], ["Saldo", data.universoBloques.montoPendiente],
        [], ["DIFERENCIA", "GENERAL", "BLOQUES", "DIFERENCIA", "FUERA DE BLOQUE", "EXENCIONES EN BLOQUE", "NO EXPLICADA"],
        ["Esperado", data.diferencias.esperado.general, data.diferencias.esperado.bloques, data.diferencias.esperado.diferencia, data.diferencias.esperado.fueraDeBloque, data.diferencias.esperado.exencionesEnBloque, data.diferencias.esperado.noExplicada],
        ["Verificado", data.diferencias.verificado.general, data.diferencias.verificado.bloques, data.diferencias.verificado.diferencia, data.diferencias.verificado.fueraDeBloque, 0, data.diferencias.verificado.noExplicada],
        [], ["VALIDACIONES", "RESULTADO"], ...Object.entries(data.validaciones).map(([nombre, correcto]) => [nombre, correcto ? "CORRECTA" : "REVISAR"]),
        [], ["HISTORIAL DE AJUSTES FINANCIEROS"], ["Usuario", "CI", "Acción", "Motivo", "Administrador", "Fecha", "Monto original", "Monto final"],
        ...data.historialAjustes.map((item) => [item.nombre, item.ci, item.accion, item.motivo, item.administrador, fecha(item.fecha), item.montoEsperadoOriginal, item.montoEsperadoFinal]),
      ]);
      resumen.columns = [{ width: 38 }, { width: 20 }, { width: 20 }, { width: 20 }, { width: 20 }, { width: 22 }, { width: 20 }];
      const todosPagos = libro.addWorksheet("02_TODOS_LOS_PAGOS"); todosPagos.addRow(encabezadosPagos); data.pagos.forEach((pago) => todosPagos.addRow(filaPago(pago))); estilo(todosPagos, "N");
      hojaPersonas("03_CON_BLOQUE", data.conBloque);
      hojaPersonas("04_SIN_BLOQUE_CON_PAGO", data.pagosSinBloque);
      hojaPersonas("05_SIN_PAGO", data.personasSinPago);
      const hojaBeneficios = hojaPersonas("06_FREE_EXENTOS_DESCUENTOS", beneficios);
      hojaBeneficios.addRow([]); hojaBeneficios.addRow(["REFERENCIAS DECLARADAS", "TIPO", "ESTADO", "CANDIDATOS"]);
      data.referencias.forEach((referencia) => hojaBeneficios.addRow([referencia.alias, referencia.tipo, referencia.estado, referencia.candidatos.map((candidato) => `${candidato.nombre} (CI ${candidato.ci})`).join("; ")]));
      hojaPersonas("07_INCONSISTENCIAS", data.inconsistencias);
      const contenido = await libro.xlsx.writeBuffer();
      const url = URL.createObjectURL(new Blob([contenido], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const enlace = document.createElement("a"); enlace.href = url; enlace.download = `AUDITORIA_FINANCIERA_GENERAL_${new Date().toISOString().slice(0, 10)}.xlsx`; enlace.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally { exportando.current = false; }
  };

  if (consulta.isLoading) return <section className="rounded-2xl bg-white p-6">Calculando auditoría financiera general…</section>;
  if (consulta.isError || !data) return <section className="rounded-2xl border border-red-300 bg-red-50 p-6 text-red-800"><h2 className="font-black">No se pudo cargar la auditoría financiera</h2><p className="text-sm">{consulta.error instanceof Error ? consulta.error.message : "Intenta nuevamente."}</p></section>;
  const todoCorrecto = Object.values(data.validaciones).every(Boolean);

  return <section className="space-y-6 rounded-3xl border-2 border-blue-200 bg-blue-50 p-5">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-widest text-blue-700">Conciliación y control administrativo auditable</p><h2 className="text-2xl font-black text-[#74122A]">Auditoría financiera general</h2><p className="max-w-4xl text-sm text-blue-900">Los ajustes controlan cómo participa una persona en esta auditoría. Nunca eliminan ni modifican cuotas, pagos o comprobantes.</p></div><button type="button" onClick={() => void exportar()} className="rounded-xl bg-emerald-700 px-5 py-3 font-black text-white">EXPORTAR AUDITORÍA FINANCIERA</button></header>

    <div><h3 className="mb-2 text-lg font-black text-[#74122A]">Resumen de participación real</h3><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Metrica titulo="Total general" valor={bs(data.resumenAjustes.totalGeneral)} detalle="Esperado original registrado"/><Metrica titulo="Total excluido" valor={bs(data.resumenAjustes.totalExcluido)}/><Metrica titulo="Total exento" valor={bs(data.resumenAjustes.totalExento)}/><Metrica titulo="Total descuento" valor={bs(data.resumenAjustes.totalDescuento)}/><Metrica titulo="Total participación real" valor={bs(data.resumenAjustes.totalParticipacionReal)} detalle="Resultado después de ajustes"/></div></div>

    <div><h3 className="mb-2 text-lg font-black text-[#74122A]">A) Universo general</h3><p className="mb-3 text-sm text-slate-600">{data.definiciones.general}</p><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6"><Metrica titulo="Personas" valor={data.universoGeneral.cantidad}/><Metrica titulo="Monto esperado" valor={bs(data.universoGeneral.montoEsperado)}/><Metrica titulo="Pagado / registrado" valor={bs(data.universoGeneral.montoPagado)} detalle="Incluye todos los estados no eliminados"/><Metrica titulo="Monto verificado" valor={bs(data.universoGeneral.montoVerificado)}/><Metrica titulo="Monto pendiente" valor={bs(data.universoGeneral.montoPendiente)}/><Metrica titulo="Por verificar" valor={bs(data.universoGeneral.montoPorVerificar)} detalle={`${data.universoGeneral.registrosPorVerificar} registro(s)`}/></div></div>

    <div><h3 className="mb-2 text-lg font-black text-[#74122A]">B) Universo bloques</h3><p className="mb-3 text-sm text-slate-600">{data.definiciones.bloques}</p><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6"><Metrica titulo="Personas con bloque" valor={data.universoBloques.cantidad}/><Metrica titulo="Internos" valor={data.universoBloques.internos}/><Metrica titulo="Externos" valor={data.universoBloques.externos}/><Metrica titulo="Exentos" valor={data.universoBloques.exentos} detalle={`${bs(data.universoBloques.montoExento)} excluidos`}/><Metrica titulo="Monto real esperado" valor={bs(data.universoBloques.montoEsperado)}/><Metrica titulo="Verificado / saldo" valor={`${bs(data.universoBloques.montoVerificado)} / ${bs(data.universoBloques.montoPendiente)}`}/></div></div>

    <div className="rounded-2xl border border-blue-200 bg-white p-5"><h3 className="text-lg font-black text-[#74122A]">C) Diferencia entre universos</h3><p className="mt-2"><b>Esperado ajustado:</b> {bs(data.diferencias.esperado.general)} − {bs(data.diferencias.esperado.bloques)} = <b>{bs(data.diferencias.esperado.diferencia)}</b>. Se explica por {bs(data.diferencias.esperado.fueraDeBloque)} fuera de bloques. Exenciones registradas dentro de bloques: {bs(data.diferencias.esperado.exencionesEnBloque)} (ya fueron descontadas en ambos universos). Sin explicar: <b>{bs(data.diferencias.esperado.noExplicada)}</b>.</p><p className="mt-2"><b>Verificado:</b> {bs(data.diferencias.verificado.general)} − {bs(data.diferencias.verificado.bloques)} = <b>{bs(data.diferencias.verificado.diferencia)}</b>. Pagos verificados fuera de bloque: {bs(data.diferencias.verificado.fueraDeBloque)}. Sin explicar: <b>{bs(data.diferencias.verificado.noExplicada)}</b>.</p><p className={`mt-3 font-black ${todoCorrecto ? "text-emerald-700" : "text-red-700"}`}>{todoCorrecto ? "AUDITORÍA CUADRADA: no existe diferencia matemática sin explicar." : "REVISAR: existe una validación financiera pendiente."}</p></div>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><button type="button" onClick={() => setVista("SIN_BLOQUE")} className="rounded-xl border bg-white p-4 text-left"><b>Pagos sin bloque</b><span className="block">{data.pagosSinBloque.length} personas · {bs(data.diferencias.verificado.fueraDeBloque)}</span></button><button type="button" onClick={() => setVista("SIN_PAGO")} className="rounded-xl border bg-white p-4 text-left"><b>Personas sin pago</b><span className="block">{data.personasSinPago.length}</span></button><button type="button" onClick={() => setVista("SIN_PARTICIPACION")} className="rounded-xl border bg-white p-4 text-left"><b>Pagos sin participación activa</b><span className="block">{data.pagosSinParticipacion.length}</span></button><button type="button" onClick={() => setVista("BENEFICIOS")} className="rounded-xl border bg-white p-4 text-left"><b>Free / descuentos / exentos</b><span className="block">{beneficios.length}</span></button><button type="button" onClick={() => setVista("INCONSISTENCIAS")} className="rounded-xl border bg-white p-4 text-left"><b>Inconsistencias</b><span className="block">{data.inconsistencias.length}</span></button></div>
    <div><h3 className="mb-2 text-lg font-black text-[#74122A]">Detalle beneficios / inconsistencias: {vista.replaceAll("_", " ")} ({detalle.length})</h3><TablaPersonas personas={detalle} onAjustar={abrirAjuste}/></div>
    <details className="rounded-xl border border-slate-300 bg-white p-4"><summary className="cursor-pointer font-black text-[#74122A]">Historial de ajustes financieros ({data.historialAjustes.length})</summary><div className="mt-4 max-h-96 overflow-auto"><table className="w-full min-w-[1000px] text-left text-xs"><thead className="bg-slate-100"><tr>{["Usuario", "CI", "Acción", "Motivo", "Monto original", "Monto final", "Administrador", "Fecha"].map((item) => <th key={item} className="p-3">{item}</th>)}</tr></thead><tbody>{data.historialAjustes.map((item) => <tr key={item.ajusteId} className="border-t"><td className="p-3 font-bold">{item.nombre}</td><td className="p-3">{item.ci}</td><td className="p-3">{item.accion.replaceAll("_", " ")}</td><td className="p-3">{item.motivo}</td><td className="p-3">{bs(item.montoEsperadoOriginal)}</td><td className="p-3">{bs(item.montoEsperadoFinal)}</td><td className="p-3">{item.administrador}</td><td className="p-3">{fecha(item.fecha)}</td></tr>)}</tbody></table>{!data.historialAjustes.length ? <p className="p-5 text-center text-slate-500">Todavía no existen ajustes administrativos.</p> : null}</div></details>
    <details className="rounded-xl border border-amber-300 bg-amber-50 p-4"><summary className="cursor-pointer font-black text-amber-900">Referencias nominales pendientes de revisión</summary><p className="my-2 text-sm text-amber-900">Carlos y Diego pueden coincidir con más de una persona; Dylan conserva su descuento como pendiente mientras no se registre un ajuste explícito. Ninguna referencia cambia importes automáticamente. “YO” no puede identificarse sin nombre o CI.</p>{data.referencias.map((referencia) => <p key={`${referencia.tipo}-${referencia.alias}`} className="text-sm"><b>{referencia.tipo} · {referencia.alias}:</b> {referencia.estado}{referencia.candidatos.length ? ` — ${referencia.candidatos.map((candidato) => `${candidato.nombre} (CI ${candidato.ci})`).join(", ")}` : ""}</p>)}</details>

    {personaAjuste ? <div className="fixed inset-0 z-[150] grid place-items-center overflow-y-auto bg-black/65 p-4"><section className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl"><button type="button" onClick={() => setPersonaAjuste(null)} className="float-right rounded-full bg-slate-100 px-3 py-2 font-black">✕</button><h3 className="pr-12 text-xl font-black text-[#74122A]">Gestionar registro financiero</h3><p className="mt-1 font-bold">{personaAjuste.nombre} · CI {personaAjuste.ci}</p><p className="text-sm text-slate-600">Esperado original: {bs(personaAjuste.montoEsperadoRegistrado)} · Ajustado actual: {bs(personaAjuste.montoEsperadoAjustado)}</p><label className="mt-4 block text-sm font-bold">Acción<select value={accion} onChange={(evento) => setAccion(evento.target.value as AccionAjusteFinanciero)} className="mt-1 w-full rounded-xl border p-3"><option value="EXCLUIR_CALCULO">Excluir del cálculo</option><option value="RESTAURAR_CALCULO">Restaurar al cálculo</option><option value="MARCAR_EXENTO">Marcar como exento</option><option value="MARCAR_DESCUENTO">Marcar descuento</option></select></label>{accion === "EXCLUIR_CALCULO" ? <p className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 font-bold text-amber-900">Esta acción no elimina el pago. Solo cambiará la forma en que participa en los cálculos.</p> : null}{accion === "MARCAR_EXENTO" ? <label className="mt-3 block text-sm font-bold">Tipo de exención<select value={tipoExencion} onChange={(evento) => setTipoExencion(evento.target.value as TipoExencionFinanciera)} className="mt-1 w-full rounded-xl border p-3"><option value="DIRECTIVA">Directiva</option><option value="ADMINISTRADOR">Administrador</option><option value="GUIA">Guía</option><option value="INVITADO">Invitado</option><option value="OTRO">Otro</option></select></label> : null}{accion === "MARCAR_DESCUENTO" ? <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-sm font-bold">Porcentaje<input type="number" min="1" max="99" step="0.01" value={porcentaje} onChange={(evento) => cambiarPorcentaje(Number(evento.target.value))} className="mt-1 w-full rounded-xl border p-3"/></label><label className="text-sm font-bold">Monto final<input type="number" min="0" max={personaAjuste.montoEsperadoRegistrado} step="0.01" value={montoFinal} onChange={(evento) => setMontoFinal(Number(evento.target.value))} className="mt-1 w-full rounded-xl border p-3"/></label></div> : null}<label className="mt-3 block text-sm font-bold">Motivo obligatorio<textarea value={motivo} onChange={(evento) => setMotivo(evento.target.value)} maxLength={1000} rows={3} className="mt-1 w-full rounded-xl border p-3" placeholder="Explica la decisión administrativa"/></label><div className="mt-5 grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => setPersonaAjuste(null)} className="rounded-xl border px-4 py-3 font-bold">Cancelar</button><button type="button" onClick={() => ajuste.mutate()} disabled={ajuste.isPending} className="rounded-xl bg-[#74122A] px-4 py-3 font-black text-white disabled:opacity-50">{ajuste.isPending ? "Guardando…" : "Confirmar ajuste"}</button></div></section></div> : null}
  </section>;
}
