import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  obtenerAlmacenamiento,
  obtenerReporteEjecutivo,
  obtenerReporteFormacion,
  obtenerReporteTallas,
  type PersonaReporte,
} from "@/api/ReporteApi";
import ReporteTallasPrimeraCuota from "@/components/reportes/ReporteTallasPrimeraCuota";
import ReportePagosCronologicos from "@/components/reportes/ReportePagosCronologicos";
import ReporteIntegrantesMatricula from "@/components/reportes/ReporteIntegrantesMatricula";

type Campo = { id: string; titulo: string; valor: (p: PersonaReporte, i: number) => string | number };
type SeccionReporte = "GENERAL" | "POLERAS" | "CHAMARRAS" | "POSTULANTES_GUIA" | "GUIAS";
type DatosNombre = { nombres?: string; apellidoPaterno?: string; apellidoMaterno?: string; nombre: string };
type RegistroTalla = DatosNombre & { fraternoId: string; ci: string; telefono?: string; genero?: string; bloque: string; tallaPolera?: string; tallaChamarra?: string };
type RegistroFormacion = DatosNombre & { id: string; ci: string; telefono?: string; email?: string; bloque?: string; estado: string; puntajeTotal?: number };

const campos: Campo[] = [
  { id: "nro", titulo: "N°", valor: (_, i) => i + 1 },
  { id: "nombre", titulo: "Nombre y apellidos", valor: (p) => p.nombre },
  { id: "ci", titulo: "CI", valor: (p) => p.ci },
  { id: "telefono", titulo: "Celular", valor: (p) => p.telefono || "" },
  { id: "genero", titulo: "Género", valor: (p) => p.genero },
  { id: "email", titulo: "Correo", valor: (p) => p.email },
  { id: "facultad", titulo: "Facultad", valor: (p) => p.facultad },
  { id: "carrera", titulo: "Carrera", valor: (p) => p.carrera },
  { id: "estado", titulo: "Estado", valor: (p) => p.estadoPreregistro },
  { id: "total", titulo: "Cuota total", valor: (p) => `Bs ${p.cuota.montoTotal.toFixed(2)}` },
  { id: "pagado", titulo: "Pagado", valor: (p) => `Bs ${p.cuota.montoPagado.toFixed(2)}` },
  { id: "saldo", titulo: "Saldo", valor: (p) => `Bs ${p.cuota.saldo.toFixed(2)}` },
  { id: "fecha", titulo: "Fecha", valor: () => "" },
  { id: "firma", titulo: "Firma", valor: () => "" },
];
const secciones: { id: SeccionReporte; etiqueta: string }[] = [
  { id: "GENERAL", etiqueta: "Lista de preregistros" },
  { id: "POSTULANTES_GUIA", etiqueta: "Postulantes a guía" },
  { id: "GUIAS", etiqueta: "Guías" },
  { id: "POLERAS", etiqueta: "Reporte de poleras" },
  { id: "CHAMARRAS", etiqueta: "Reporte de chamarras" },
];

const formato = (bytes: number) => bytes >= 1073741824 ? `${(bytes / 1073741824).toFixed(2)} GB` : bytes >= 1048576 ? `${(bytes / 1048576).toFixed(2)} MB` : `${(bytes / 1024).toFixed(1)} KB`;
const textoOrden = (persona: DatosNombre) => [persona.apellidoPaterno, persona.apellidoMaterno, persona.nombres].filter(Boolean).join(" ") || persona.nombre;
const ordenarPorApellidos = <T extends DatosNombre>(registros: T[]) => [...registros].sort((a, b) => textoOrden(a).localeCompare(textoOrden(b), "es", { sensitivity: "base" }));
const nombreArchivo = (titulo: string) => `${titulo.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "reporte"}.xlsx`;

export default function ReportesView() {
  const q = useQuery({ queryKey: ["reporte-ejecutivo"], queryFn: obtenerReporteEjecutivo });
  const formacion = useQuery({ queryKey: ["reporte-formacion"], queryFn: obtenerReporteFormacion });
  const alm = useQuery({ queryKey: ["almacenamiento"], queryFn: obtenerAlmacenamiento, refetchInterval: 60000 });
  const tallas = useQuery({ queryKey: ["reporte-tallas"], queryFn: obtenerReporteTallas });
  const [seleccion, setSeleccion] = useState(["nro", "nombre", "ci", "telefono", "total", "pagado", "saldo", "firma"]);
  const [seccionesSeleccionadas, setSeccionesSeleccionadas] = useState<Set<SeccionReporte>>(() => new Set(["GENERAL"]));
  const [titulo, setTitulo] = useState("PLANILLA DE CONTROL DE FRATERNOS");
  const [buscar, setBuscar] = useState("");
  const [bloque, setBloque] = useState("TODOS");
  const [logoIzquierdo, setLogoIzquierdo] = useState(() => localStorage.getItem("LOGO_REPORTES") || "/imagenes/tinkus-puros.png");
  const [logoDerecho, setLogoDerecho] = useState(() => localStorage.getItem("LOGO_REPORTES_DERECHO") || "");

  const visibles = campos.filter((campo) => seleccion.includes(campo.id));
  const textoBusqueda = buscar.trim().toLowerCase();
  const personas = useMemo(() => ordenarPorApellidos((q.data?.personas || []).filter((persona) => `${persona.nombre} ${persona.ci} ${persona.telefono || ""} ${persona.email}`.toLowerCase().includes(textoBusqueda))), [q.data, textoBusqueda]);
  const filtrarFormacion = (registros: RegistroFormacion[]) => ordenarPorApellidos(registros.filter((registro) => `${registro.nombre} ${registro.ci} ${registro.telefono || ""} ${registro.email}`.toLowerCase().includes(textoBusqueda)));
  const registrosTalla = ordenarPorApellidos(((tallas.data?.registros || []) as RegistroTalla[]).filter((registro) => (bloque === "TODOS" || registro.bloque === bloque) && `${registro.nombre} ${registro.ci} ${registro.telefono || ""}`.toLowerCase().includes(textoBusqueda)));
  const postulantesFiltrados = filtrarFormacion((formacion.data?.postulantes || []) as RegistroFormacion[]);
  const guiasFiltrados = filtrarFormacion((formacion.data?.guias || []) as RegistroFormacion[]);
  const bloques = [...new Set(((tallas.data?.registros || []) as RegistroTalla[]).map((registro) => registro.bloque))];
  const todoSeleccionado = seccionesSeleccionadas.size === secciones.length;
  const resumenPrenda = (campo: "tallaPolera" | "tallaChamarra") => {
    const conteos = new Map<string, number>();
    registrosTalla.forEach((registro) => { const genero = registro.genero || "NO REGISTRADO"; const talla = registro[campo] || "SIN TALLA"; const clave = `${genero}|${talla}`; conteos.set(clave, (conteos.get(clave) ?? 0) + 1); });
    return [...conteos].map(([clave, cantidad]) => { const [genero, talla] = clave.split("|"); return { genero, talla, cantidad }; }).sort((a,b)=>`${a.genero} ${a.talla}`.localeCompare(`${b.genero} ${b.talla}`,"es"));
  };

  const alternarSeccion = (seccion: SeccionReporte) => setSeccionesSeleccionadas((actuales) => {
    const siguientes = new Set(actuales);
    if (siguientes.has(seccion)) siguientes.delete(seccion); else siguientes.add(seccion);
    return siguientes;
  });
  const alternarTodo = () => setSeccionesSeleccionadas(todoSeleccionado ? new Set() : new Set(secciones.map((seccion) => seccion.id)));
  const cargarLogo = (archivo: File | undefined, clave: "LOGO_REPORTES" | "LOGO_REPORTES_DERECHO", actualizar: (valor: string) => void) => {
    if (!archivo) return;
    const lector = new FileReader();
    lector.onload = () => {
      const valor = String(lector.result);
      localStorage.setItem(clave, valor);
      actualizar(valor);
    };
    lector.readAsDataURL(archivo);
  };
  const exportarExcel = async () => {
    const { default: ExcelJS } = await import("exceljs");
    const libro = new ExcelJS.Workbook();
    libro.creator = "Fraternidad Tinkus Puros";
    libro.created = new Date();
    const agregarHoja = (nombre: string, encabezados: string[], filas: (string | number)[][]) => {
      const hoja = libro.addWorksheet(nombre);
      hoja.addRow(encabezados);
      filas.forEach((fila) => hoja.addRow(fila));
      hoja.views = [{ state: "frozen", ySplit: 1 }];
      hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: encabezados.length } };
      const cabecera = hoja.getRow(1);
      cabecera.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cabecera.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF74122A" } };
      hoja.columns.forEach((columna) => { columna.width = Math.min(45, Math.max(12, ...filas.map((fila) => String(fila[columna.number - 1] ?? "").length + 2))); });
    };
    if (seccionesSeleccionadas.has("GENERAL")) agregarHoja("Preregistros", visibles.map((campo) => campo.titulo), personas.map((persona, indice) => visibles.map((campo) => campo.valor(persona, indice))));
    if (seccionesSeleccionadas.has("POSTULANTES_GUIA")) agregarHoja("Postulantes guia", ["N°", "Nombre y apellidos", "CI", "Celular", "Correo", "Estado", "Puntaje total", "Firma"], postulantesFiltrados.map((registro, indice) => [indice + 1, registro.nombre, registro.ci, registro.telefono || "", registro.email || "", registro.estado, registro.puntajeTotal ?? "", ""]));
    if (seccionesSeleccionadas.has("GUIAS")) agregarHoja("Guias", ["N°", "Nombre y apellidos", "CI", "Celular", "Correo", "Bloque", "Estado", "Firma"], guiasFiltrados.map((registro, indice) => [indice + 1, registro.nombre, registro.ci, registro.telefono || "", registro.email || "", registro.bloque || "", registro.estado, ""]));
    const filasTallas = (tipo: "POLERAS" | "CHAMARRAS") => registrosTalla.map((registro, indice) => [indice + 1, registro.nombre, registro.ci, registro.telefono || "", registro.bloque, tipo === "POLERAS" ? registro.tallaPolera || "" : registro.tallaChamarra || "", ""]);
    if (seccionesSeleccionadas.has("POLERAS")) { agregarHoja("Poleras", ["N°", "Nombre y apellidos", "CI", "Celular", "Bloque", "Talla polera", "Firma"], filasTallas("POLERAS")); agregarHoja("Resumen poleras", ["Género", "Talla", "Cantidad"], resumenPrenda("tallaPolera").map(item=>[item.genero,item.talla,item.cantidad])); }
    if (seccionesSeleccionadas.has("CHAMARRAS")) { agregarHoja("Chamarras", ["N°", "Nombre y apellidos", "CI", "Celular", "Bloque", "Talla chamarra", "Firma"], filasTallas("CHAMARRAS")); agregarHoja("Resumen chamarras", ["Género", "Talla", "Cantidad"], resumenPrenda("tallaChamarra").map(item=>[item.genero,item.talla,item.cantidad])); }
    const contenido = await libro.xlsx.writeBuffer();
    const enlace = document.createElement("a");
    enlace.href = URL.createObjectURL(new Blob([contenido], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    enlace.download = nombreArchivo(titulo);
    enlace.click();
    URL.revokeObjectURL(enlace.href);
  };

  if (q.isLoading) return <p className="p-8 text-center">Generando reporte...</p>;
  if (!q.data) return <p className="p-6 text-red-700">{q.error?.message}</p>;
  const almacenamiento = alm.data;

  return <main className="space-y-5">
    <ReporteIntegrantesMatricula />
    <ReporteTallasPrimeraCuota />
    <ReportePagosCronologicos />
    <section className="print:hidden">
      <h1 className="text-3xl font-black text-[#74122A]">Constructor de reportes</h1>
      <p className="text-sm text-slate-600">Marca únicamente las listas que deseas revisar o imprimir. “Todos” incluye cada reporte.</p>
      {almacenamiento && <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Metrica t="Archivos subidos" v={almacenamiento.archivos.total}/><Metrica t="Espacio de archivos" v={formato(almacenamiento.archivos.bytes)}/><Metrica t="Comprobantes" v={almacenamiento.comprobantes.total}/><Metrica t="Promedio comprobante" v={formato(almacenamiento.comprobantes.promedioBytes)}/><Metrica t="Disco disponible" v={formato(almacenamiento.disco.disponibleBytes)} alerta={almacenamiento.alerta}/>
      </div>}
      <div className="mt-4 rounded-2xl bg-white p-5">
        <div className="grid gap-3 md:grid-cols-2">
          <input value={titulo} onChange={(evento) => setTitulo(evento.target.value)} className="rounded-xl border p-3 font-bold" aria-label="Título del reporte"/>
          <label className="rounded-xl border p-3 text-sm font-bold">Logo izquierdo<input type="file" accept="image/*" onChange={(evento) => cargarLogo(evento.target.files?.[0], "LOGO_REPORTES", setLogoIzquierdo)} className="mt-2 block w-full text-xs"/></label>
          <label className="rounded-xl border p-3 text-sm font-bold">Logo derecho (reemplaza “UMSA LA MEJOR”)<input type="file" accept="image/*" onChange={(evento) => cargarLogo(evento.target.files?.[0], "LOGO_REPORTES_DERECHO", setLogoDerecho)} className="mt-2 block w-full text-xs"/></label>
          <input value={buscar} onChange={(evento) => setBuscar(evento.target.value)} className="rounded-xl border p-3" placeholder="Filtrar por nombre, CI, celular o correo"/>
          <select value={bloque} onChange={(evento) => setBloque(evento.target.value)} className="rounded-xl border p-3"><option>TODOS</option>{bloques.map((nombre) => <option key={nombre}>{nombre}</option>)}</select>
        </div>
        <p className="mt-4 text-xs font-black uppercase tracking-wider text-[#735f55]">Columnas de la lista de preregistros</p>
        <div className="mt-2 flex flex-wrap gap-2">{campos.map((campo) => <label key={campo.id} className={`rounded-xl border px-3 py-2 text-sm ${seleccion.includes(campo.id) ? "bg-[#74122A] text-white" : ""}`}><input className="mr-2" type="checkbox" checked={seleccion.includes(campo.id)} onChange={() => setSeleccion((actual) => actual.includes(campo.id) ? actual.filter((id) => id !== campo.id) : [...actual, campo.id])}/>{campo.titulo}</label>)}</div>
        <p className="mt-4 text-xs font-black uppercase tracking-wider text-[#735f55]">Listas que se mostrarán e imprimirán</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <label className={`rounded-xl border px-4 py-2 font-bold ${todoSeleccionado ? "bg-[#74122A] text-white" : ""}`}><input type="checkbox" className="mr-2" checked={todoSeleccionado} onChange={alternarTodo}/>Todos</label>
          {secciones.map((seccion) => <label key={seccion.id} className={`rounded-xl border px-4 py-2 font-bold ${seccionesSeleccionadas.has(seccion.id) ? "bg-[#74122A] text-white" : ""}`}><input type="checkbox" className="mr-2" checked={seccionesSeleccionadas.has(seccion.id)} onChange={() => alternarSeccion(seccion.id)}/>{seccion.etiqueta}</label>)}
          <button type="button" onClick={() => window.print()} disabled={!seccionesSeleccionadas.size} className="rounded-xl bg-emerald-700 px-5 py-2 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">Imprimir selección</button>
          <button type="button" onClick={() => void exportarExcel()} disabled={!seccionesSeleccionadas.size} className="rounded-xl bg-blue-700 px-5 py-2 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">Exportar a Excel</button>
        </div>
      </div>
    </section>

    {!seccionesSeleccionadas.size ? <section className="rounded-xl bg-white p-10 text-center text-slate-500">Selecciona al menos una lista para mostrarla.</section> : <section className="rounded-xl bg-white p-6 shadow print:p-0 print:shadow-none">
      <header className="grid grid-cols-[90px_1fr_90px] items-center border-b-2 border-[#74122A] pb-4 text-center">
        <img src={logoIzquierdo} alt="Logo izquierdo del reporte" className="h-20 w-20 object-contain"/><div><b className="text-[#74122A]">FRATERNIDAD TINKUS PUROS</b><h2 className="text-xl font-black">{titulo}</h2><p className="text-xs">{q.data.gestion.nombre} · {bloque} · {new Date().toLocaleDateString("es-BO")}</p></div>{logoDerecho ? <img src={logoDerecho} alt="Logo derecho del reporte" className="h-20 w-20 object-contain"/> : <div className="grid h-20 w-20 place-items-center rounded-full border-4 border-[#163a70] text-xs font-black text-[#163a70]">UMSA<br/>LA MEJOR</div>}
      </header>
      <div className="space-y-8">
        {seccionesSeleccionadas.has("GENERAL") && <Seccion titulo="Lista de preregistros" cantidad={personas.length}><TablaGeneral personas={personas} visibles={visibles}/></Seccion>}
        {seccionesSeleccionadas.has("POSTULANTES_GUIA") && <Seccion titulo="Postulantes a guía" cantidad={postulantesFiltrados.length}><TablaFormacion registros={postulantesFiltrados} tipo="POSTULANTES"/></Seccion>}
        {seccionesSeleccionadas.has("GUIAS") && <Seccion titulo="Guías" cantidad={guiasFiltrados.length}><TablaFormacion registros={guiasFiltrados} tipo="GUIAS"/></Seccion>}
        {seccionesSeleccionadas.has("POLERAS") && <Seccion titulo="Reporte de poleras" cantidad={registrosTalla.length}><ResumenPrenda items={resumenPrenda("tallaPolera")}/><TablaTallas registros={registrosTalla} tipo="POLERAS"/></Seccion>}
        {seccionesSeleccionadas.has("CHAMARRAS") && <Seccion titulo="Reporte de chamarras" cantidad={registrosTalla.length}><ResumenPrenda items={resumenPrenda("tallaChamarra")}/><TablaTallas registros={registrosTalla} tipo="CHAMARRAS"/></Seccion>}
      </div>
    </section>}
  </main>;
}

function Seccion({ titulo, cantidad, children }: { titulo: string; cantidad: number; children: ReactNode }) { return <section className="break-inside-avoid pt-5"><h3 className="text-lg font-black uppercase text-[#74122A]">{titulo} ({cantidad})</h3>{cantidad ? children : <p className="mt-3 rounded-lg bg-slate-50 p-4 text-sm text-slate-500">No existen registros para esta selección.</p>}</section>; }
function ResumenPrenda({items}:{items:Array<{genero:string;talla:string;cantidad:number}>}) { return <div className="mt-3 flex flex-wrap gap-2">{items.map(item=><span key={`${item.genero}-${item.talla}`} className="rounded-lg border bg-slate-50 px-3 py-2 text-xs font-bold">{item.genero} · {item.talla}: {item.cantidad}</span>)}</div>; }
function TablaGeneral({ personas, visibles }: { personas: PersonaReporte[]; visibles: Campo[] }) { return <table className="mt-3 w-full border-collapse text-[11px]"><thead><tr>{visibles.map((campo) => <th className="border p-2" key={campo.id}>{campo.titulo}</th>)}</tr></thead><tbody>{personas.map((persona, indice) => <tr key={persona.usuarioId}>{visibles.map((campo) => <td className={`border p-2 ${campo.id === "firma" ? "h-12" : ""}`} key={campo.id}>{campo.valor(persona, indice)}</td>)}</tr>)}</tbody></table>; }
function TablaTallas({ registros, tipo }: { registros: RegistroTalla[]; tipo: "POLERAS" | "CHAMARRAS" }) { const campo: "tallaPolera" | "tallaChamarra" = tipo === "POLERAS" ? "tallaPolera" : "tallaChamarra"; return <table className="mt-3 w-full border-collapse text-xs"><thead><tr>{["N°", "Nombre", "CI", "Celular", "Bloque", tipo === "POLERAS" ? "Talla polera" : "Talla chamarra", "Firma"].map((titulo) => <th className="border p-2" key={titulo}>{titulo}</th>)}</tr></thead><tbody>{registros.map((registro, indice) => <tr key={registro.fraternoId}><td className="border p-2">{indice + 1}</td><td className="border p-2">{registro.nombre}</td><td className="border p-2">{registro.ci}</td><td className="border p-2">{registro.telefono}</td><td className="border p-2">{registro.bloque}</td><td className="border p-2 font-bold">{registro[campo]}</td><td className="h-12 border p-2"/></tr>)}</tbody></table>; }
function TablaFormacion({ registros, tipo }: { registros: RegistroFormacion[]; tipo: "GUIAS" | "POSTULANTES" }) { return <table className="mt-3 w-full border-collapse text-xs"><thead><tr>{["N°", "Nombre y apellidos", "CI", "Celular", "Correo", tipo === "GUIAS" ? "Bloque" : "Estado", tipo === "GUIAS" ? "Estado" : "Puntaje total", "Firma"].map((titulo) => <th className="border p-2" key={titulo}>{titulo}</th>)}</tr></thead><tbody>{registros.map((registro, indice) => <tr key={registro.id}><td className="border p-2">{indice + 1}</td><td className="border p-2 font-bold">{registro.nombre}</td><td className="border p-2">{registro.ci}</td><td className="border p-2">{registro.telefono}</td><td className="border p-2">{registro.email}</td><td className="border p-2">{tipo === "GUIAS" ? registro.bloque : registro.estado}</td><td className="border p-2">{tipo === "GUIAS" ? registro.estado : registro.puntajeTotal}</td><td className="h-12 border p-2"/></tr>)}</tbody></table>; }
function Metrica({ t, v, alerta }: { t: string; v: string | number; alerta?: string }) { return <div className={`rounded-xl p-4 ${alerta === "CRITICA" ? "bg-red-100" : alerta === "ADVERTENCIA" ? "bg-amber-100" : "bg-white"}`}><p className="text-xs text-slate-500">{t}</p><b className="text-xl text-[#74122A]">{v}</b>{alerta && alerta !== "NORMAL" && <small className="block font-bold">Alerta {alerta}</small>}</div>; }
