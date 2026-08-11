import type { FormEvent, ReactNode } from "react";
import { ESTADOS_PREREGISTRO, type PreregistroFormData } from "@/types/PreregistroType";

type Props = {
  datos: PreregistroFormData;
  setDatos: (datos: PreregistroFormData) => void;
  onSubmit: (event: FormEvent) => void;
  cargando?: boolean;
  esEdicion?: boolean;
  accionesSecundarias?: ReactNode;
};

export default function PreregistroForm({ datos, setDatos, onSubmit, cargando, esEdicion, accionesSecundarias }: Props) {
  const cambiar = (campo: keyof PreregistroFormData, valor: string | number | boolean | undefined) => setDatos({ ...datos, [campo]: valor });
  return (
    <form onSubmit={onSubmit} className="space-y-6 rounded-2xl border border-[#d3c9bb] bg-white p-5 shadow-sm sm:p-7">
      {!esEdicion && (
        <div className="grid gap-4 md:grid-cols-2">
          <Campo titulo="ID del usuario"><input required value={datos.usuarioId ?? ""} onChange={(e) => cambiar("usuarioId", e.target.value)} className="input-preregistro" placeholder="ObjectId del postulante" /></Campo>
          <Campo titulo="ID de gestión (opcional)"><input value={datos.gestionId ?? ""} onChange={(e) => cambiar("gestionId", e.target.value || undefined)} className="input-preregistro" placeholder="Se usa la gestión disponible" /></Campo>
        </div>
      )}

      {esEdicion && (
        <>
          <Campo titulo="Estado"><select value={datos.estado ?? "PENDIENTE"} onChange={(e) => cambiar("estado", e.target.value)} className="input-preregistro">{ESTADOS_PREREGISTRO.map((estado) => <option key={estado}>{estado}</option>)}</select></Campo>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {[1, 2, 3, 4, 5, 6].map((numero) => {
              const campo = `examen${numero}` as keyof PreregistroFormData;
              return <Campo key={numero} titulo={`Examen ${numero}`}><input type="number" min="0" max="100" step="0.01" value={(datos[campo] as number | undefined) ?? ""} onChange={(e) => cambiar(campo, e.target.value === "" ? undefined : Number(e.target.value))} className="input-preregistro" /></Campo>;
            })}
          </div>
          <Campo titulo="Puntaje total"><input type="number" min="0" step="0.01" value={datos.puntajeTotal ?? ""} onChange={(e) => cambiar("puntajeTotal", e.target.value === "" ? undefined : Number(e.target.value))} className="input-preregistro" /></Campo>
          <Campo titulo="Observación"><textarea rows={4} maxLength={1000} value={datos.observacion ?? ""} onChange={(e) => cambiar("observacion", e.target.value)} className="input-preregistro resize-y" placeholder="Motivo de observación, rechazo o lista de espera" /></Campo>
        </>
      )}

      <label className="flex items-center gap-3 text-sm font-medium"><input type="checkbox" checked={datos.aceptoReglamento ?? false} onChange={(e) => cambiar("aceptoReglamento", e.target.checked)} className="h-4 w-4 accent-[#74122A]" /> Aceptó el reglamento</label>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center"><button disabled={cargando} className="rounded-xl bg-[#74122A] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#5E0E22] disabled:opacity-60">{cargando ? "Guardando..." : esEdicion ? "Guardar cambios" : "Crear preregistro"}</button>{accionesSecundarias}</div>
    </form>
  );
}

function Campo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#735f55]">{titulo}</span>{children}</label>;
}
