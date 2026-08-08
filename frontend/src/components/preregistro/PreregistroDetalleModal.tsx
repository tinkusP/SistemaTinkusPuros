import type { Preregistro } from "@/types/PreregistroType";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { habilitarGuia } from "@/api/GuiaApi";
import type { PostulanteGuia } from "@/types/GuiaType";
import { useNavigate } from "react-router-dom";

const urlFoto = (ruta?: string | null) => ruta ? (ruta.startsWith("http") ? ruta : `${String(import.meta.env.VITE_API_URL || "").replace(/\/api\/?$/, "")}${ruta}`) : null;
const fechaHoraBolivia = (fecha?: string | null) => {
  if (!fecha) return "No registrada";
  const valor = new Date(fecha);
  if (Number.isNaN(valor.getTime())) return "Fecha no válida";
  return valor.toLocaleString("es-BO", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/La_Paz",
  });
};

export default function PreregistroDetalleModal({ preregistro, postulanteGuia, cerrar }: { preregistro: Preregistro | null; postulanteGuia?: PostulanteGuia; cerrar: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const designar = useMutation({ mutationFn: habilitarGuia, onSuccess: async () => { toast.success("Designado como postulante a guía"); await queryClient.invalidateQueries({ queryKey: ["postulantes-guia"] }); }, onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo designar") });
  if (!preregistro) return null;
  const usuario = typeof preregistro.usuarioId === "object" ? preregistro.usuarioId : null;
  const gestion = typeof preregistro.gestionId === "object" ? preregistro.gestionId : null;
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-4" onMouseDown={cerrar}>
      <section className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-[#fffdf8] shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between bg-[#74122A] px-5 py-4 text-white"><div><p className="text-xs uppercase tracking-widest text-[#e9cf91]">Detalle de preregistro</p><h2 className="text-xl font-black">{preregistro.numeroPreRegistro}</h2></div><button onClick={cerrar} className="rounded-lg px-3 py-2 hover:bg-white/10">✕</button></header>
        <div className="p-5 pb-0">
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-[#ddd2c3] bg-white p-5 sm:flex-row">
            <div className="grid h-32 w-32 shrink-0 place-items-center overflow-hidden rounded-2xl border-4 border-[#C59A3A] bg-[#f3ead7] text-3xl font-black text-[#841534]">
              {urlFoto(usuario?.fotoPerfil) ? <img src={urlFoto(usuario?.fotoPerfil)!} alt={`Foto de ${usuario?.nombres ?? "postulante"}`} className="h-full w-full object-cover" /> : `${usuario?.nombres?.[0] ?? ""}${usuario?.apellidoPaterno?.[0] ?? ""}` || "SF"}
            </div>
            <div className="text-center sm:text-left"><p className="text-xs font-bold uppercase tracking-widest text-[#8a7469]">Fotografía del postulante</p><h3 className="mt-1 text-xl font-black text-[#262022]">{usuario ? `${usuario.nombres} ${usuario.apellidoPaterno} ${usuario.apellidoMaterno ?? ""}` : "Usuario"}</h3><p className="mt-1 text-sm text-slate-500">CI {usuario?.ci ?? "no registrado"}</p>{!usuario?.fotoPerfil && <p className="mt-2 text-xs font-bold text-amber-700">Este usuario no tiene fotografía de perfil.</p>}</div>
          </div>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Dato titulo="Postulante" valor={usuario ? `${usuario.nombres} ${usuario.apellidoPaterno}` : String(preregistro.usuarioId)} />
          <Dato titulo="CI" valor={usuario?.ci} />
          <Dato titulo="Gestión" valor={gestion ? `${gestion.nombre} (${gestion.anio})` : String(preregistro.gestionId)} />
          <Dato titulo="Estado" valor={preregistro.estado} />
          <Dato titulo="Promedio" valor={preregistro.promedioExamen} />
          <Dato titulo="Puntaje total" valor={preregistro.puntajeTotal} />
          <Dato titulo="Reglamento" valor={preregistro.aceptoReglamento ? "Aceptado" : "Pendiente"} />
          <Dato titulo="Cuenta registrada" valor={fechaHoraBolivia(usuario?.fechaCreado)} />
          <Dato titulo="Preregistro generado" valor={fechaHoraBolivia(preregistro.fechaRegistro)} />
          <div className="sm:col-span-2"><Dato titulo="Observación" valor={preregistro.observacion} /></div>
          {postulanteGuia ? <button type="button" onClick={() => navigate(`/postulantes-guia/${postulanteGuia._id}`)} className="rounded-xl bg-purple-700 px-5 py-3 text-sm font-bold text-white sm:col-span-2">✓ Ya es postulante a guía · Ver evaluación</button> : <button type="button" disabled={designar.isPending} onClick={() => designar.mutate(preregistro._id)} className="rounded-xl bg-purple-700 px-5 py-3 text-sm font-bold text-white sm:col-span-2 disabled:opacity-60">🪶 Designar como postulante a guía</button>}
        </div>
      </section>
    </div>
  );
}

function Dato({ titulo, valor }: { titulo: string; valor?: string | number }) {
  return <div className="rounded-xl border border-[#ddd2c3] bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-[#8a7469]">{titulo}</p><p className="mt-1 break-words text-sm font-bold text-[#262022]">{valor ?? "No registrado"}</p></div>;
}
