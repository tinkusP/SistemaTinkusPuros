import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { obtenerMisPreregistros } from "@/api/PreregistroApi";
import type { EstadoPreregistro } from "@/types/PreregistroType";

const mensajes: Record<EstadoPreregistro, string> = {
  PENDIENTE: "Tu preregistro todavía está pendiente de revisión administrativa.",
  OBSERVADO: "Debes revisar la observación y corregir o completar la información solicitada.",
  APROBADO: "Tu preregistro fue aprobado y puedes continuar con el proceso de admisión.",
  RECHAZADO: "Tu preregistro fue rechazado. Revisa el motivo indicado por administración.",
  LISTA_ESPERA: "Tu preregistro se encuentra en lista de espera por disponibilidad de cupos.",
  CANCELADO: "Este preregistro fue cancelado.",
};

export default function MisPreregistrosView() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["mis-preregistros"],
    queryFn: obtenerMisPreregistros,
  });

  return (
    <div className="min-h-screen bg-[#eee8dc] px-4 py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="overflow-hidden rounded-3xl bg-[#74122A] p-7 text-white shadow-lg">
          <p className="text-xs font-bold uppercase tracking-[.25em] text-[#e9cf91]">Tinkus Puros y Naturales</p>
          <h1 className="mt-2 text-3xl font-black">Mi preregistro</h1>
          <p className="mt-2 text-sm text-white/75">Consulta la decisión administrativa y cualquier observación que debas atender.</p>
          <Link to="/comunicados" className="mt-5 inline-block rounded-xl border border-white/30 px-4 py-2 text-sm font-bold">← Volver a comunicados</Link>
        </header>

        {isLoading ? (
          <p className="rounded-2xl bg-white p-8 text-center">Cargando preregistro...</p>
        ) : isError ? (
          <p className="rounded-2xl bg-red-50 p-8 text-red-700">No se pudo cargar tu preregistro.</p>
        ) : (
          <section className="grid gap-4 sm:grid-cols-2">
            {data?.preregistros.map((p) => {
              const gestion = typeof p.gestionId === "object" ? p.gestionId : null;
              const observado = p.estado === "OBSERVADO" || p.estado === "RECHAZADO";
              return (
                <article key={p._id} className="rounded-2xl border border-[#d3c9bb] border-t-4 border-t-[#74122A] bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div><p className="text-xs font-bold uppercase tracking-wider text-[#8F5F2A]">{p.numeroPreRegistro}</p><h2 className="mt-1 text-xl font-black">{gestion?.nombre ?? "Gestión"}</h2></div>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${p.estado === "APROBADO" ? "bg-emerald-100 text-emerald-800" : observado ? "bg-amber-100 text-amber-900" : "bg-[#74122A]/10 text-[#74122A]"}`}>{p.estado.replace("_", " ")}</span>
                  </div>
                  <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{mensajes[p.estado]}</p>
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-xs text-slate-500">Calificaciones</dt><dd className="font-bold">{p.promedioExamen ?? "Aún sin registrar"}</dd></div><div><dt className="text-xs text-slate-500">Fecha de registro</dt><dd className="font-bold">{new Date(p.fechaRegistro).toLocaleDateString("es-BO")}</dd></div></dl>
                  {p.observacion && <div className={`mt-4 rounded-xl border p-4 text-sm ${observado ? "border-amber-300 bg-amber-50 text-amber-950" : "border-blue-200 bg-blue-50 text-blue-900"}`}><strong className="block mb-1">Observación de administración</strong>{p.observacion}</div>}
                </article>
              );
            })}
            {data?.preregistros.length === 0 && <p className="col-span-full rounded-2xl bg-white p-10 text-center">Todavía no tienes un preregistro.</p>}
          </section>
        )}
      </div>
    </div>
  );
}
