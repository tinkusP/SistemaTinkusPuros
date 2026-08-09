import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArchiveRestore, CloudDownload, DatabaseBackup, FileArchive, FolderDown, ShieldAlert } from "lucide-react";
import { toast } from "react-toastify";
import { useAuth } from "@/hooks/useAuth";
import { descargarRespaldoCompleto, descargarRespaldoOrganizado, importarRespaldoCompleto } from "@/api/RespaldoApi";

const CORREO_PROPIETARIO = "devdjcod@gmail.com";

export default function RespaldoView() {
  const { data: usuario } = useAuth();
  const [archivo, setArchivo] = useState<File | null>(null);
  const [confirmacion, setConfirmacion] = useState("");
  const [progreso, setProgreso] = useState(0);
  const autorizado = String(usuario?.email ?? "").trim().toLowerCase() === CORREO_PROPIETARIO;

  const descargar = useMutation({
    mutationFn: descargarRespaldoCompleto,
    onSuccess: () => toast.success("Respaldo descargado correctamente"),
    onError: (error: Error) => toast.error(error.message),
  });
  const descargarOrganizado = useMutation({
    mutationFn: descargarRespaldoOrganizado,
    onSuccess: () => toast.success("ZIP organizado descargado correctamente"),
    onError: (error: Error) => toast.error(error.message),
  });
  const restaurar = useMutation({
    mutationFn: async () => {
      if (!archivo) throw new Error("Selecciona un respaldo .tinkus.gz");
      if (confirmacion !== "RESTAURAR") throw new Error("Escribe RESTAURAR para confirmar");
      setProgreso(0);
      return importarRespaldoCompleto(archivo, setProgreso);
    },
    onSuccess: (resultado) => {
      toast.success(`${resultado.message}: ${resultado.documentos} registros y ${resultado.archivos} archivos`);
      setArchivo(null);
      setConfirmacion("");
      setProgreso(0);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!autorizado) {
    return <section className="mx-auto max-w-2xl rounded-3xl border border-red-200 bg-white p-8 text-center shadow"><ShieldAlert className="mx-auto h-14 w-14 text-red-700"/><h1 className="mt-4 text-2xl font-black text-red-800">Acceso restringido</h1><p className="mt-2 text-slate-600">Solamente el administrador propietario puede descargar o restaurar toda la información.</p></section>;
  }

  return <main className="space-y-5">
    <header><p className="text-sm font-black uppercase tracking-widest text-[#C59A3A]">Acceso exclusivo del propietario</p><h1 className="text-3xl font-black text-[#74122A]">Respaldo completo y migración</h1><p className="mt-2 max-w-3xl text-slate-600">Descarga todas las colecciones, registros, imágenes, PDF y comprobantes. El mismo archivo permite pasar datos de la nube a local o de local a la nube.</p></header>
    <section className="grid gap-5 lg:grid-cols-3">
      <article className="rounded-3xl border bg-white p-6 shadow-sm"><CloudDownload className="h-12 w-12 text-emerald-700"/><h2 className="mt-4 text-xl font-black text-[#74122A]">Descargar todo</h2><p className="mt-2 text-sm leading-6 text-slate-600">Genera un archivo comprimido con la base de datos, sus índices y todos los objetos almacenados. Guárdalo en un disco seguro.</p><button type="button" disabled={descargar.isPending} onClick={() => descargar.mutate()} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white disabled:opacity-50"><DatabaseBackup className="h-5 w-5"/>{descargar.isPending ? "Preparando base y documentos..." : "Descargar respaldo completo"}</button></article>
      <article className="rounded-3xl border border-blue-200 bg-white p-6 shadow-sm"><FolderDown className="h-12 w-12 text-blue-700"/><h2 className="mt-4 text-xl font-black text-[#74122A]">Descargar carpetas visibles</h2><p className="mt-2 text-sm leading-6 text-slate-600">Descarga un ZIP que puedes abrir normalmente. Incluye fotos, carnets, matrículas, PDF, comprobantes y la base en JSON, respetando las carpetas por CI.</p><button type="button" disabled={descargarOrganizado.isPending} onClick={() => descargarOrganizado.mutate()} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 font-bold text-white disabled:opacity-50"><FolderDown className="h-5 w-5"/>{descargarOrganizado.isPending ? "Armando carpetas y documentos..." : "Descargar todo en ZIP"}</button></article>
      <article className="rounded-3xl border border-amber-300 bg-white p-6 shadow-sm"><ArchiveRestore className="h-12 w-12 text-amber-700"/><h2 className="mt-4 text-xl font-black text-[#74122A]">Restaurar o sincronizar</h2><p className="mt-2 text-sm leading-6 text-slate-600">Agrega los elementos que falten y actualiza los que tengan el mismo identificador. No elimina datos adicionales del destino.</p><label className="mt-4 block rounded-xl border-2 border-dashed p-4 text-sm font-bold"><FileArchive className="mb-2 h-6 w-6"/>Archivo .tinkus.gz<input type="file" accept=".gz,.tinkus.gz,application/gzip" className="mt-2 block w-full text-xs" onChange={(evento) => setArchivo(evento.target.files?.[0] ?? null)}/><span className="mt-2 block break-all font-normal text-slate-500">{archivo?.name ?? "Ningún respaldo seleccionado"}</span></label><label className="mt-4 block text-sm font-bold">Escribe RESTAURAR para confirmar<input value={confirmacion} onChange={(evento) => setConfirmacion(evento.target.value.toUpperCase())} className="mt-2 w-full rounded-xl border p-3" placeholder="RESTAURAR"/></label>{restaurar.isPending && <div className="mt-3"><div className="h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-[#74122A] transition-all" style={{width:`${progreso}%`}}/></div><p className="mt-1 text-center text-xs text-slate-500">Subiendo {progreso}% · después se restaurarán registros y archivos</p></div>}<button type="button" disabled={restaurar.isPending || !archivo || confirmacion !== "RESTAURAR"} onClick={() => restaurar.mutate()} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#74122A] px-5 py-3 font-bold text-white disabled:opacity-50"><ArchiveRestore className="h-5 w-5"/>{restaurar.isPending ? "Restaurando, no cierres esta página..." : "Restaurar respaldo"}</button></article>
    </section>
    <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950"><strong>Importante:</strong> el respaldo contiene información personal y contraseñas cifradas. No lo envíes por WhatsApp ni lo subas a un repositorio público.</section>
  </main>;
}
