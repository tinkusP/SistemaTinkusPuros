import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "react-toastify";
import {
  abrirDocumentoMatricula,
  auditarReporteMatriculas,
  descargarDocumentosMatriculasZip,
  descargarNominaOficial,
  obtenerNominaMatriculas,
  type PersonaNominaMatricula,
  type ReporteNominaMatriculas,
  type TipoOrigenNomina,
} from "@/api/ReporteApi";

type FiltroOrigen = "TODOS" | TipoOrigenNomina;
type FiltroRu = "TODOS" | "CON_RU" | "SIN_RU";
type FiltroEstado = "TODOS" | "LISTOS" | "REVISAR";
type Orden = "APELLIDOS" | "NOMBRES" | "CI" | "FECHA";

const textoBusqueda = (persona: PersonaNominaMatricula) => [persona.nombreCompleto, persona.ci, persona.telefono, persona.email, persona.registroUniversitario, persona.codigoFraterno].join(" ").toLocaleLowerCase("es");
const fecha = (valor: string | null) => valor ? new Date(valor).toLocaleString("es-BO") : "SIN REGISTRO";
const dinero = (valor: number) => `Bs ${valor.toFixed(2)}`;
const nombreArchivoFecha = () => new Date().toISOString().slice(0, 10);

export default function ControlMatriculas() {
  const consulta = useQuery({ queryKey: ["control-nomina-matriculas"], queryFn: obtenerNominaMatriculas, retry: 1 });
  const [buscar, setBuscar] = useState("");
  const [origen, setOrigen] = useState<FiltroOrigen>("TODOS");
  const [bloque, setBloque] = useState("TODOS");
  const [rol, setRol] = useState("TODOS");
  const [ru, setRu] = useState<FiltroRu>("TODOS");
  const [estado, setEstado] = useState<FiltroEstado>("TODOS");
  const [orden, setOrden] = useState<Orden>("APELLIDOS");
  const [detalle, setDetalle] = useState<PersonaNominaMatricula | null>(null);
  const [vistaPrevia, setVistaPrevia] = useState(false);
  const [procesando, setProcesando] = useState<string | null>(null);

  const personas = useMemo(() => {
    const termino = buscar.trim().toLocaleLowerCase("es");
    const filtradas = (consulta.data?.personas ?? []).filter((persona) =>
      (!termino || textoBusqueda(persona).includes(termino))
      && (origen === "TODOS" || persona.tipoOrigen === origen)
      && (bloque === "TODOS" || persona.bloque === bloque)
      && (rol === "TODOS" || persona.roles.includes(rol))
      && (ru === "TODOS" || (ru === "CON_RU" ? Boolean(persona.registroUniversitario) : !persona.registroUniversitario))
      && (estado === "TODOS" || (estado === "LISTOS" ? persona.listoNomina : !persona.listoNomina)),
    );
    return [...filtradas].sort((a, b) => {
      if (orden === "CI") return a.ci.localeCompare(b.ci, "es", { numeric: true });
      if (orden === "FECHA") return new Date(b.fechaCargaMatricula ?? 0).getTime() - new Date(a.fechaCargaMatricula ?? 0).getTime();
      if (orden === "NOMBRES") return a.nombreCompleto.localeCompare(b.nombreCompleto, "es", { sensitivity: "base" });
      return `${a.apellidoPaterno} ${a.apellidoMaterno} ${a.nombres}`.localeCompare(`${b.apellidoPaterno} ${b.apellidoMaterno} ${b.nombres}`, "es", { sensitivity: "base" });
    });
  }, [consulta.data, buscar, origen, bloque, rol, ru, estado, orden]);

  const listos = personas.filter((persona) => persona.listoNomina);
  const ejecutar = async (clave: string, accion: () => Promise<void>, mensaje: string) => {
    if (procesando) return;
    setProcesando(clave);
    try { await accion(); toast.success(mensaje); }
    catch (error) { toast.error(error instanceof Error ? error.message : "No se pudo completar la operación"); }
    finally { setProcesando(null); }
  };
  const exportarCompleto = () => ejecutar("excel", async () => {
    if (!consulta.data || !personas.length) throw new Error("No existen registros para los filtros seleccionados");
    await generarExcelAdministrativo(consulta.data, personas);
    await auditarReporteMatriculas(personas.length);
  }, "Reporte Excel generado correctamente");
  const exportarOficial = () => ejecutar("oficial", async () => {
    if (!listos.length) throw new Error("No existen personas con datos completos para la nómina oficial");
    if (listos.length > (consulta.data?.plantilla.capacidad ?? 80)) throw new Error(`La plantilla admite ${consulta.data?.plantilla.capacidad ?? 80} personas; aplica filtros para generar más de un archivo`);
    await descargarNominaOficial(listos.map((persona) => persona.usuarioId));
  }, "Nómina oficial descargada");
  const exportarZip = (todas = false) => ejecutar(todas ? "zip-todas" : "zip", async () => {
    const seleccion = todas ? consulta.data?.personas ?? [] : personas;
    if (!seleccion.length) throw new Error("No existen documentos para descargar");
    await descargarDocumentosMatriculasZip(seleccion.map((persona) => persona.usuarioId));
  }, "ZIP de matrículas generado");
  const documento = (persona: PersonaNominaMatricula, descargar: boolean) => ejecutar(`${descargar ? "descargar" : "ver"}-${persona.documentoId}`, () => abrirDocumentoMatricula(persona.documentoId, descargar), descargar ? "Documento descargado" : "Documento abierto");

  if (consulta.isLoading) return <section className="rounded-2xl border bg-white p-6"><p className="font-bold text-slate-600">Cargando control de matrículas…</p></section>;
  if (consulta.isError || !consulta.data) return <section className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800"><h2 className="font-black">No se pudo cargar el control de matrículas</h2><p className="text-sm">{consulta.error instanceof Error ? consulta.error.message : "Intenta nuevamente."}</p></section>;
  const { resumen } = consulta.data;

  return <section className="space-y-4 rounded-2xl border border-[#d8c9bc] bg-white p-5 print:hidden">
    <header className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
      <div><p className="text-xs font-black uppercase tracking-[.16em] text-[#8F5F2A]">Administración documental</p><h2 className="text-2xl font-black text-[#74122A]">Control de matrículas y nómina oficial</h2><p className="max-w-3xl text-sm text-slate-600">Incluye todas las cuentas con archivo real de matrícula. El RU es un dato separado y nunca se utiliza para simular un documento.</p></div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void exportarCompleto()} disabled={Boolean(procesando)} className="rounded-xl bg-emerald-700 px-4 py-3 text-sm font-black text-white disabled:opacity-50">{procesando === "excel" ? "GENERANDO…" : "EXCEL COMPLETO"}</button>
        <button type="button" onClick={() => setVistaPrevia(true)} disabled={!listos.length} className="rounded-xl border border-[#74122A] px-4 py-3 text-sm font-black text-[#74122A] disabled:opacity-50">VISTA PREVIA OFICIAL</button>
        <button type="button" onClick={() => void exportarOficial()} disabled={Boolean(procesando) || !listos.length} className="rounded-xl bg-[#74122A] px-4 py-3 text-sm font-black text-white disabled:opacity-50">{procesando === "oficial" ? "GENERANDO…" : `NÓMINA OFICIAL (${listos.length})`}</button>
        <button type="button" onClick={() => void exportarZip(false)} disabled={Boolean(procesando) || !personas.length} className="rounded-xl bg-blue-700 px-4 py-3 text-sm font-black text-white disabled:opacity-50">{procesando === "zip" ? "COMPRIMIENDO…" : `ZIP FILTRADO (${personas.length})`}</button>
        <button type="button" onClick={() => void exportarZip(true)} disabled={Boolean(procesando) || !consulta.data.personas.length} className="rounded-xl border border-blue-700 px-4 py-3 text-sm font-black text-blue-800 disabled:opacity-50">DESCARGAR TODOS</button>
      </div>
    </header>

    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
      <Metrica titulo="Con matrícula" valor={resumen.totalConMatricula}/><Metrica titulo="Internos" valor={resumen.internos}/><Metrica titulo="Externos" valor={resumen.externos}/><Metrica titulo="Sin clasificar" valor={resumen.sinClasificar} alerta={resumen.sinClasificar > 0}/><Metrica titulo="Hombres / mujeres" valor={`${resumen.hombres} / ${resumen.mujeres}`}/><Metrica titulo="Con / sin bloque" valor={`${resumen.conBloque} / ${resumen.sinBloque}`}/><Metrica titulo="Con / sin RU" valor={`${resumen.conRu} / ${resumen.sinRu}`}/><Metrica titulo="Listos nómina" valor={resumen.listosNomina}/><Metrica titulo="A revisar" valor={resumen.inconsistencias} alerta={resumen.inconsistencias > 0}/><Metrica titulo="Resultado filtrado" valor={personas.length}/><Metrica titulo="Capacidad plantilla" valor={consulta.data.plantilla.capacidad}/><Metrica titulo="Gestión relacionada" valor={consulta.data.gestion?.anio ?? "SIN ACTIVA"}/>
    </div>

    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-7">
      <input value={buscar} onChange={(evento) => setBuscar(evento.target.value)} placeholder="Buscar nombre, CI, celular, correo, RU o código" aria-label="Buscar en control de matrículas" className="rounded-xl border p-3 xl:col-span-2"/>
      <select value={origen} onChange={(evento) => setOrigen(evento.target.value as FiltroOrigen)} aria-label="Filtrar origen" className="rounded-xl border p-3"><option value="TODOS">Todos los orígenes</option><option value="INTERNO">Internos</option><option value="EXTERNO">Externos</option><option value="SIN CLASIFICAR">Sin clasificar</option></select>
      <select value={bloque} onChange={(evento) => setBloque(evento.target.value)} aria-label="Filtrar bloque" className="rounded-xl border p-3"><option value="TODOS">Todos los bloques</option>{consulta.data.bloques.map((valor) => <option key={valor}>{valor}</option>)}</select>
      <select value={rol} onChange={(evento) => setRol(evento.target.value)} aria-label="Filtrar rol" className="rounded-xl border p-3"><option value="TODOS">Todos los roles</option>{consulta.data.roles.map((valor) => <option key={valor}>{valor}</option>)}</select>
      <select value={ru} onChange={(evento) => setRu(evento.target.value as FiltroRu)} aria-label="Filtrar RU" className="rounded-xl border p-3"><option value="TODOS">Con y sin RU</option><option value="CON_RU">Con RU</option><option value="SIN_RU">Sin RU</option></select>
      <select value={estado} onChange={(evento) => setEstado(evento.target.value as FiltroEstado)} aria-label="Filtrar validación" className="rounded-xl border p-3"><option value="TODOS">Todos los estados</option><option value="LISTOS">Listos para nómina</option><option value="REVISAR">Requieren revisión</option></select>
      <select value={orden} onChange={(evento) => setOrden(evento.target.value as Orden)} aria-label="Ordenar registros" className="rounded-xl border p-3"><option value="APELLIDOS">Ordenar por apellidos</option><option value="NOMBRES">Ordenar por nombre</option><option value="CI">Ordenar por CI</option><option value="FECHA">Más recientes primero</option></select>
    </div>

    <div className="overflow-x-auto rounded-xl border">
      <table className="min-w-[1450px] w-full text-left text-xs"><thead className="bg-[#861832] text-white"><tr>{["Nombre completo","CI / celular","Sexo","Roles","Origen","Bloque","Código","RU","Documento","Fecha de carga","Tallas","Pago","Validación","Acciones"].map((titulo) => <th key={titulo} className="p-3">{titulo}</th>)}</tr></thead>
        <tbody>{personas.map((persona) => <tr key={persona.usuarioId} className="border-t align-top hover:bg-slate-50">
          <td className="p-3"><b>{persona.nombreCompleto}</b><small className="block text-slate-500">{persona.email}</small></td><td className="p-3">{persona.ci}<small className="block text-slate-500">Cel. {persona.telefono || "SIN TELÉFONO"}</small><small className="block text-slate-500">WhatsApp {persona.whatsapp || "NO VÁLIDO"}</small></td><td className="p-3">{persona.sexo}</td><td className="p-3">{persona.roles.join(" / ") || "SIN ROL"}</td><td className="p-3"><b>{persona.tipoOrigen}</b><small className="block text-slate-500">{persona.origenRegistrado}</small></td><td className="p-3">{persona.bloque}<small className="block text-slate-500">{persona.asignacion}</small></td><td className="p-3">{persona.codigoFraterno || persona.numeroPreregistro || "SIN CÓDIGO"}</td><td className="p-3 font-mono">{persona.registroUniversitario || "SIN RU"}</td><td className="p-3"><b>{persona.estadoDocumento}</b><small className="block max-w-40 truncate text-slate-500" title={persona.nombreArchivo}>{persona.nombreArchivo}</small></td><td className="p-3">{fecha(persona.fechaCargaMatricula)}</td><td className="p-3">Polera: {persona.tallaPolera || "—"}<br/>Chamarra: {persona.tallaChamarra || "—"}</td><td className="p-3">{persona.pago.estado}<br/><span className="text-slate-500">Registrado {dinero(persona.pago.montoRegistrado)}<br/>Verificado {dinero(persona.pago.montoVerificado)}<br/>Saldo {dinero(persona.pago.saldo)}</span></td><td className="p-3">{persona.listoNomina ? <span className="rounded-full bg-emerald-100 px-2 py-1 font-black text-emerald-800">LISTO</span> : <span className="rounded-full bg-amber-100 px-2 py-1 font-black text-amber-900" title={persona.inconsistencias.join(" · ")}>REVISAR ({persona.inconsistencias.length})</span>}</td>
          <td className="p-3"><div className="flex flex-wrap gap-1"><button type="button" onClick={() => setDetalle(persona)} className="rounded-lg border px-2 py-1 font-bold">Detalle</button><button type="button" onClick={() => void documento(persona, false)} disabled={Boolean(procesando)} className="rounded-lg bg-blue-100 px-2 py-1 font-bold text-blue-800">Ver</button><button type="button" onClick={() => void documento(persona, true)} disabled={Boolean(procesando)} className="rounded-lg bg-emerald-100 px-2 py-1 font-bold text-emerald-800">Descargar</button></div></td>
        </tr>)}</tbody></table>
      {!personas.length ? <p className="p-8 text-center text-slate-500">No existen registros para los filtros seleccionados.</p> : null}
    </div>
    {detalle ? <DetalleModal persona={detalle} cerrar={() => setDetalle(null)} ver={() => void documento(detalle, false)} descargar={() => void documento(detalle, true)}/> : null}
    {vistaPrevia ? <VistaPrevia personas={listos} capacidad={consulta.data.plantilla.capacidad} cerrar={() => setVistaPrevia(false)} exportar={() => void exportarOficial()}/> : null}
  </section>;
}

function Metrica({ titulo, valor, alerta = false }: { titulo: string; valor: string | number; alerta?: boolean }) {
  return <div className={`rounded-xl border p-3 ${alerta ? "border-amber-300 bg-amber-50" : "bg-slate-50"}`}><p className="text-[10px] font-black uppercase tracking-wide text-slate-500">{titulo}</p><p className="mt-1 text-xl font-black text-[#74122A]">{valor}</p></div>;
}

function DetalleModal({ persona, cerrar, ver, descargar }: { persona: PersonaNominaMatricula; cerrar: () => void; ver: () => void; descargar: () => void }) {
  const campos = [["Nombre", persona.nombreCompleto],["Nombres", persona.nombres],["Primer apellido", persona.apellidoPaterno],["Segundo apellido", persona.apellidoMaterno || "SIN REGISTRO"],["CI", persona.ci],["Celular almacenado", persona.telefonoRegistrado],["Celular para nómina", persona.telefono],["WhatsApp", persona.whatsapp || "NO VÁLIDO"],["Correo", persona.email],["Sexo", persona.sexo],["Roles", persona.roles.join(" / ") || "SIN ROL"],["Origen", `${persona.tipoOrigen} (${persona.origenRegistrado})`],["Bloque", persona.bloque],["Asignación", persona.asignacion],["Código fraterno", persona.codigoFraterno || "SIN REGISTRO"],["RU", persona.registroUniversitario || "SIN REGISTRO"],["Número de matrícula independiente", "NO EXISTE CAMPO INDEPENDIENTE EN EL SISTEMA"],["Documento", `${persona.nombreArchivo} · ${persona.estadoDocumento}`],["Archivo físico", persona.archivoDisponible === null ? "NO VERIFICADO" : persona.archivoDisponible ? "DISPONIBLE" : "NO ENCONTRADO"],["Fecha carga", fecha(persona.fechaCargaMatricula)],["Pago", `${persona.pago.estado} · registrado ${dinero(persona.pago.montoRegistrado)} · verificado ${dinero(persona.pago.montoVerificado)} · saldo ${dinero(persona.pago.saldo)}`],["Tallas", `Polera ${persona.tallaPolera || "—"} · Chamarra ${persona.tallaChamarra || "—"}`]];
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="detalle-matricula-titulo"><div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-3"><div><h3 id="detalle-matricula-titulo" className="text-xl font-black text-[#74122A]">Detalle de matrícula</h3><p className="text-sm text-slate-500">Información relacionada sin confundir documento y RU.</p></div><button type="button" onClick={cerrar} aria-label="Cerrar detalle" className="rounded-lg border px-3 py-2 font-black">×</button></div><dl className="mt-5 grid gap-3 sm:grid-cols-2">{campos.map(([titulo, valor]) => <div key={titulo} className="rounded-xl bg-slate-50 p-3"><dt className="text-[10px] font-black uppercase text-slate-500">{titulo}</dt><dd className="mt-1 break-words text-sm font-semibold">{valor}</dd></div>)}</dl>{persona.inconsistencias.length ? <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4"><b className="text-amber-900">Requiere revisión</b><ul className="mt-2 list-disc pl-5 text-sm">{persona.inconsistencias.map((problema) => <li key={problema}>{problema}</li>)}</ul></div> : <p className="mt-4 rounded-xl bg-emerald-50 p-4 font-bold text-emerald-800">Datos listos para la nómina oficial.</p>}<div className="mt-5 flex justify-end gap-2"><button type="button" onClick={ver} className="rounded-xl bg-blue-700 px-4 py-2 font-bold text-white">Ver documento</button><button type="button" onClick={descargar} className="rounded-xl bg-emerald-700 px-4 py-2 font-bold text-white">Descargar documento</button></div></div></div>;
}

function VistaPrevia({ personas, capacidad, cerrar, exportar }: { personas: PersonaNominaMatricula[]; capacidad: number; cerrar: () => void; exportar: () => void }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="vista-nomina-titulo"><div className="max-h-[92vh] w-full max-w-6xl overflow-auto rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><h3 id="vista-nomina-titulo" className="text-xl font-black text-[#74122A]">Vista previa de la nómina oficial</h3><p className="text-sm text-slate-500">Solo las seis columnas de la plantilla. {personas.length}/{capacidad} filas.</p></div><button type="button" onClick={cerrar} aria-label="Cerrar vista previa" className="rounded-lg border px-3 py-2 font-black">×</button></div>{personas.length > capacidad ? <p className="mt-4 rounded-xl bg-red-50 p-4 font-bold text-red-800">La selección supera la capacidad de la plantilla. Aplica filtros para crear archivos separados.</p> : null}<div className="mt-4 overflow-x-auto"><table className="min-w-[850px] w-full text-left text-sm"><thead className="bg-[#861832] text-white"><tr>{["Nombre","Primer Apellido","Segundo Apellido","CI","Número de celular","Registro Universitario"].map((titulo) => <th className="p-3" key={titulo}>{titulo}</th>)}</tr></thead><tbody>{personas.map((persona) => <tr className="border-t" key={persona.usuarioId}><td className="p-3">{persona.nombres}</td><td className="p-3">{persona.apellidoPaterno}</td><td className="p-3">{persona.apellidoMaterno}</td><td className="p-3 font-mono">{persona.ci}</td><td className="p-3 font-mono">{persona.telefono}</td><td className="p-3 font-mono">{persona.registroUniversitario}</td></tr>)}</tbody></table></div><div className="mt-5 flex justify-end"><button type="button" onClick={exportar} disabled={!personas.length || personas.length > capacidad} className="rounded-xl bg-[#74122A] px-5 py-3 font-black text-white disabled:opacity-50">Descargar plantilla oficial</button></div></div></div>;
}

async function generarExcelAdministrativo(reporte: ReporteNominaMatriculas, personas: PersonaNominaMatricula[]) {
  const { default: ExcelJS } = await import("exceljs");
  const libro = new ExcelJS.Workbook();
  libro.creator = "Sistema Tinkus Puros y Naturales";
  libro.created = new Date();
  const encabezados = ["N.º","Nombre completo","Nombres","Primer apellido","Segundo apellido","CI","Sexo","Celular","WhatsApp","Correo","Roles","Origen clasificado","Origen almacenado","Bloque","Asignación","Código fraterno","N.º preregistro","RU","Número matrícula independiente","Estado documento","Archivo matrícula","Archivo físico","Fecha carga","Talla polera","Talla chamarra","Estado pago","Plan","Monto total","Monto registrado","Monto verificado","Pendiente revisión","Saldo","Listo nómina","Inconsistencias"];
  const valores = (persona: PersonaNominaMatricula, indice: number) => [indice + 1,persona.nombreCompleto,persona.nombres,persona.apellidoPaterno,persona.apellidoMaterno,persona.ci,persona.sexo,persona.telefono,persona.whatsapp,persona.email,persona.roles.join(" / "),persona.tipoOrigen,persona.origenRegistrado,persona.bloque,persona.asignacion,persona.codigoFraterno,persona.numeroPreregistro,persona.registroUniversitario,"NO EXISTE CAMPO INDEPENDIENTE",persona.estadoDocumento,persona.nombreArchivo,persona.archivoDisponible === null ? "NO VERIFICADO" : persona.archivoDisponible ? "DISPONIBLE" : "NO ENCONTRADO",persona.fechaCargaMatricula ? new Date(persona.fechaCargaMatricula) : "",persona.tallaPolera,persona.tallaChamarra,persona.pago.estado,persona.pago.plan ?? "SIN PLAN",persona.pago.montoTotal,persona.pago.montoRegistrado,persona.pago.montoVerificado,persona.pago.montoPendienteRevision,persona.pago.saldo,persona.listoNomina ? "SÍ" : "NO",persona.inconsistencias.join(" | ")];
  const agregar = (nombre: string, registros: PersonaNominaMatricula[]) => { const hoja = libro.addWorksheet(nombre); hoja.addRow(encabezados); registros.forEach((persona, indice) => hoja.addRow(valores(persona, indice))); estilizarHoja(hoja, encabezados.length, [6, 8, 9, 16, 17, 18, 19, 21]); return hoja; };
  const resumen = libro.addWorksheet("01_RESUMEN");
  resumen.addRows([["CONTROL GENERAL DE MATRÍCULAS"],["Generado",new Date().toLocaleString("es-BO")],["Gestión relacionada",reporte.gestion ? `${reporte.gestion.nombre} (${reporte.gestion.anio})` : "SIN GESTIÓN ACTIVA"],["Registros filtrados",personas.length],[],["INDICADOR","TOTAL"],["Con matrícula",personas.length],["Internos",personas.filter((p) => p.tipoOrigen === "INTERNO").length],["Externos",personas.filter((p) => p.tipoOrigen === "EXTERNO").length],["Sin clasificar",personas.filter((p) => p.tipoOrigen === "SIN CLASIFICAR").length],["Hombres",personas.filter((p) => p.sexo === "HOMBRE").length],["Mujeres",personas.filter((p) => p.sexo === "MUJER").length],["Con bloque",personas.filter((p) => p.bloque !== "SIN BLOQUE").length],["Sin bloque",personas.filter((p) => p.bloque === "SIN BLOQUE").length],["Con RU",personas.filter((p) => p.registroUniversitario).length],["Sin RU",personas.filter((p) => !p.registroUniversitario).length],["Listos para nómina oficial",personas.filter((p) => p.listoNomina).length],["Con inconsistencias",personas.filter((p) => p.inconsistencias.length).length]]);
  resumen.getRow(1).font = { bold: true, size: 16, color: { argb: "FF74122A" } }; resumen.getRow(6).font = { bold: true, color: { argb: "FFFFFFFF" } }; resumen.getRow(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF861832" } }; resumen.columns = [{ width: 35 }, { width: 25 }];
  agregar("02_TODOS_CON_MATRICULA", personas);
  agregar("03_INTERNOS", personas.filter((p) => p.tipoOrigen === "INTERNO"));
  agregar("04_EXTERNOS", personas.filter((p) => p.tipoOrigen === "EXTERNO"));
  agregar("05_SIN_CLASIFICAR", personas.filter((p) => p.tipoOrigen === "SIN CLASIFICAR"));
  agregar("06_CON_BLOQUE", personas.filter((p) => p.bloque !== "SIN BLOQUE"));
  agregar("07_SIN_BLOQUE", personas.filter((p) => p.bloque === "SIN BLOQUE"));
  agregar("08_SIN_RU", personas.filter((p) => !p.registroUniversitario));
  agregar("09_INCONSISTENCIAS", personas.filter((p) => p.inconsistencias.length));
  const contenido = await libro.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([contenido], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const enlace = document.createElement("a"); enlace.href = url; enlace.download = `Reporte_Completo_Matriculas_${nombreArchivoFecha()}.xlsx`; enlace.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function estilizarHoja(hoja: import("exceljs").Worksheet, columnas: number, textoColumnas: number[]) {
  hoja.views = [{ state: "frozen", ySplit: 1 }]; hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columnas } };
  const cabecera = hoja.getRow(1); cabecera.font = { bold: true, color: { argb: "FFFFFFFF" } }; cabecera.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF861832" } }; cabecera.alignment = { vertical: "middle", wrapText: true };
  hoja.columns.forEach((columna, indice) => { columna.width = indice === 1 ? 34 : indice === columnas - 1 ? 45 : 18; });
  textoColumnas.forEach((numero) => { hoja.getColumn(numero).numFmt = "@"; });
  hoja.eachRow((fila, numero) => { if (numero > 1) fila.alignment = { vertical: "top", wrapText: true }; });
}
