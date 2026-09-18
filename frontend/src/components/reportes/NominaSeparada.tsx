import { useState } from "react";
import { toast } from "react-toastify";
import { useAuth } from "@/hooks/useAuth";
import { obtenerMensajeError } from "@/api/apiError";
import { revisarNominaSeparada, descargarNominaSeparada, type RevisionNominaSeparada } from "@/api/NominaSeparadaApi";

const boton = "rounded-xl bg-[#74122A] px-4 py-3 font-bold text-white disabled:opacity-50";
export default function NominaSeparada() {
  const { data: usuario } = useAuth();
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [revision, setRevision] = useState<RevisionNominaSeparada | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [aceptar, setAceptar] = useState(false);
  const administrador = usuario?.roles?.some(r => typeof r !== "string" && ["ADMIN", "ADMINISTRADOR", "SUPERADMIN", "SUPERADMINISTRADOR"].includes(String(r.codigo || r.nombre).toUpperCase().replace(/[\s_-]/g, ""))) ?? false;
  const lista = texto.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const actual = revision?.administrador.id === String(usuario?._id) ? revision : null;
  const observaciones = actual && (actual.resumen.noEncontrados + actual.resumen.ambiguos + actual.resumen.repetidos + actual.resumen.requierenRevision > 0);
  const cambiar = (valor: string) => { setTexto(valor); setRevision(null); setAceptar(false); };
  async function cargar(archivo?: File) {
    if (!archivo) return;
    if (archivo.size > 250_000) { toast.error("La lista no debe superar 250 KB."); return; }
    setOcupado(true);
    try { cambiar(await archivo.text()); } catch { toast.error("No se pudo leer el archivo de texto."); }
    finally { setOcupado(false); }
  }
  async function revisar() {
    setOcupado(true); setRevision(null); setAceptar(false);
    try { setRevision(await revisarNominaSeparada(lista)); }
    catch (e) { toast.error(obtenerMensajeError(e)); }
    finally { setOcupado(false); }
  }
  async function exportar() {
    if (!actual) return;
    setOcupado(true);
    try { await descargarNominaSeparada(lista, actual.huella, aceptar); toast.success("Nómina separada descargada"); }
    catch (e) { toast.error(obtenerMensajeError(e)); setRevision(null); setAceptar(false); }
    finally { setOcupado(false); }
  }
  if (!administrador) return null;
  return <section className="space-y-4 rounded-2xl border bg-white p-5 text-slate-800">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-black text-[#74122A]">Nómina usuarios</h2><p>Reporte de Nómina Separada. Lee los campos originales sin modificar personas.</p></div><button type="button" className={boton} aria-expanded={abierto} onClick={() => setAbierto(v => !v)}>{abierto ? "Ocultar" : "Abrir nómina"}</button></header>
    {abierto ? <>
      <p className="text-sm">Pega un nombre completo, CI o código por línea. También puedes usar CI: 1234567 o CODIGO: FRA-2026-0001. No se adivinan apellidos faltantes ni se seleccionan homónimos automáticamente.</p>
      <label className="block">Cargar lista .txt<input type="file" accept=".txt,text/plain" disabled={ocupado} onChange={e => void cargar(e.target.files?.[0])} className="ml-3"/></label>
      <label className="block">Lista de usuarios<textarea className="mt-2 block w-full rounded-lg border p-3" rows={8} value={texto} disabled={ocupado} onChange={e => cambiar(e.target.value)} placeholder="Un usuario por línea"/></label>
      <p>{lista.length} líneas · máximo 1000.</p>
      <button type="button" className={boton} disabled={ocupado || !lista.length || lista.length > 1000} onClick={() => void revisar()}>{ocupado ? "Procesando…" : "Revisar coincidencias"}</button>
      {actual ? <>
        <p>Fecha de revisión: {new Date(actual.generadoEn).toLocaleString("es-BO")} · Administrador: {actual.administrador.nombre}</p>
        <div className="grid gap-2 sm:grid-cols-3">{[["Usuarios encontrados", actual.resumen.encontrados], ["No encontrados", actual.resumen.noEncontrados], ["Datos incompletos", actual.resumen.incompletos], ["Ambiguos", actual.resumen.ambiguos], ["Entradas repetidas", actual.resumen.repetidos], ["Usuarios a revisar", actual.resumen.requierenRevision]].map(([k, n]) => <p key={k} className="rounded-lg bg-slate-50 p-3">{k}: <strong>{n}</strong></p>)}</div>
        <h3 className="font-bold">Validación de la lista</h3>
        <div className="max-h-80 overflow-auto"><table className="w-full text-left text-sm"><thead><tr>{["Entrada", "Resultado", "Coincidencias / CI", "Método"].map(t => <th scope="col" key={t} className="p-2">{t}</th>)}</tr></thead><tbody>{actual.resultados.map((r, i) => <tr key={i} className="border-t"><td className="p-2">{r.entrada}</td><td className="p-2">{r.estado}</td><td className="p-2">{r.candidatos.map(c => `${c.nombre} · CI ${c.ci} · ID ${c.usuarioId}`).join(" / ") || "—"}</td><td className="p-2">{r.metodo}</td></tr>)}</tbody></table></div>
        <h3 className="font-bold">Vista previa: {actual.filas.length} usuarios únicos</h3>
        <div className="max-h-96 overflow-auto"><table className="w-full text-left text-sm"><thead><tr>{["Nombre", "Apellido paterno", "Apellido materno", "CI", "Roles", "Observaciones"].map(t => <th scope="col" className="p-2" key={t}>{t}</th>)}</tr></thead><tbody>{actual.filas.map(f => <tr key={f.usuarioId} className="border-t"><td className="p-2">{f.nombres}</td><td className="p-2">{f.apellidoPaterno}</td><td className="p-2">{f.apellidoMaterno}</td><td className="p-2">{f.ci}</td><td className="p-2">{f.roles}</td><td className="p-2">{f.observaciones.join("; ") || "Sin observaciones"}</td></tr>)}</tbody></table></div>
        {observaciones ? <label className="block rounded-lg bg-amber-50 p-3"><input type="checkbox" checked={aceptar} disabled={ocupado} onChange={e => setAceptar(e.target.checked)}/> Revisé las observaciones. Exportar solo los encontrados únicos, conservar los valores originales y excluir ambiguos/no encontrados. El Excel incluirá el control de revisión.</label> : null}
        <button type="button" className={boton} disabled={ocupado || !actual.filas.length || Boolean(observaciones && !aceptar)} onClick={() => void exportar()}>Exportar nómina separada Excel</button>
      </> : null}
    </> : null}
  </section>;
}
