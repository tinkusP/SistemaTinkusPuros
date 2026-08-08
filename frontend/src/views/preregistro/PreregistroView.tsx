import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { eliminarPreregistro, obtenerPreregistros } from "@/api/PreregistroApi";
import { habilitarGuia, listarGuias } from "@/api/GuiaApi";
import { ESTADOS_PREREGISTRO, type EstadoPreregistro, type Preregistro } from "@/types/PreregistroType";
import PreregistroDetalleModal from "@/components/preregistro/PreregistroDetalleModal";

const urlFoto = (ruta?: string | null) => ruta ? (ruta.startsWith("http") ? ruta : `${String(import.meta.env.VITE_API_URL || "").replace(/\/api\/?$/, "")}${ruta}`) : null;

const colorEstado: Record<EstadoPreregistro, string> = {
  PENDIENTE: "bg-amber-100 text-amber-800",
  OBSERVADO: "bg-orange-100 text-orange-800",
  APROBADO: "bg-emerald-100 text-emerald-800",
  RECHAZADO: "bg-red-100 text-red-700",
  LISTA_ESPERA: "bg-blue-100 text-blue-800",
  CANCELADO: "bg-slate-200 text-slate-700",
};

export default function PreregistroView() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [estado, setEstado] = useState<EstadoPreregistro | "">("");
  const [detalle, setDetalle] = useState<Preregistro | null>(null);
  const [buscar, setBuscar] = useState("");
  const [limite, setLimite] = useState(() => window.innerWidth < 640 ? 5 : window.innerWidth < 1280 ? 10 : 20);
  const [eliminarSeleccionado, setEliminarSeleccionado] = useState<Preregistro | null>(null);

  const consulta = useQuery({
    queryKey: ["preregistros", estado],
    queryFn: () => obtenerPreregistros({ estado, limite: 100 }),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const postulantesGuiaQuery = useQuery({ queryKey: ["postulantes-guia"], queryFn: listarGuias });

  const eliminar = useMutation({
    mutationFn: eliminarPreregistro,
    onSuccess: async () => {
      toast.success("Preregistro eliminado");
      await queryClient.invalidateQueries({ queryKey: ["preregistros"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "No se pudo eliminar"),
  });

  const asignarGuia = useMutation({
    mutationFn: habilitarGuia,
    onSuccess: async () => {
      toast.success("Postulante asignado correctamente como candidato a guía");
      await queryClient.invalidateQueries({ queryKey: ["postulantes-guia"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "No se pudo asignar como postulante guía"),
  });

  const registros = (consulta.data?.preregistros ?? [])
    .filter((item) => {
      const usuario = typeof item.usuarioId === "object" ? item.usuarioId : null;
      return `${item.numeroPreRegistro} ${usuario?.nombres ?? ""} ${usuario?.apellidoPaterno ?? ""} ${usuario?.ci ?? ""}`
        .toLowerCase()
        .includes(buscar.trim().toLowerCase());
    })
    .slice(0, limite);

  const resumen = consulta.data?.resumen ?? {};
  const cupos = consulta.data?.cupos;

  return <div className="space-y-6">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-xs font-bold uppercase tracking-[.2em] text-[#8F5F2A]">Proceso de admisión</p><h1 className="mt-1 text-3xl font-black text-[#74122A]">Preregistros</h1><p className="mt-1 text-sm text-[#735f55]">Revisión de postulantes, calificaciones y cupos.</p></div>
      <button onClick={() => navigate("/preregistros/crear")} className="rounded-xl bg-[#74122A] px-5 py-3 text-sm font-bold text-white">+ Nuevo preregistro</button>
    </header>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-2xl border bg-white p-5"><p className="text-sm text-slate-500">Total</p><strong className="mt-2 block text-3xl text-[#74122A]">{Object.values(resumen).reduce((total, cantidad) => total + (cantidad ?? 0), 0)}</strong></div>
      <div className="rounded-2xl border bg-white p-5"><p className="text-sm text-slate-500">Aprobados</p><strong className="mt-2 block text-3xl text-emerald-700">{resumen.APROBADO ?? 0}</strong></div>
      <div className="rounded-2xl border bg-white p-5"><p className="text-sm text-slate-500">Cupo hombres</p><strong className="mt-2 block text-2xl text-[#74122A]">{cupos ? `${cupos.hombres} / ${cupos.maximoHombres}` : "—"}</strong></div>
      <div className="rounded-2xl border bg-white p-5"><p className="text-sm text-slate-500">Cupo mujeres</p><strong className="mt-2 block text-2xl text-[#74122A]">{cupos ? `${cupos.mujeres} / ${cupos.maximoMujeres}` : "—"}</strong></div>
    </section>

    <section className="space-y-3 rounded-2xl border border-[#d3c9bb] bg-white p-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
      <input type="search" value={buscar} onChange={(e) => setBuscar(e.target.value)} className="input-preregistro" placeholder="Buscar por nombre, CI o número..." />
      <select value={limite} onChange={(e) => setLimite(Number(e.target.value))} className="input-preregistro" aria-label="Filas visibles">{[5, 10, 20, 50, 100].map((cantidad) => <option key={cantidad} value={cantidad}>{cantidad} filas</option>)}</select>
      </div>
      <div className="flex flex-wrap gap-2"><button onClick={() => setEstado("")} className={`rounded-xl px-4 py-2 text-xs font-bold ${estado === "" ? "bg-[#74122A] text-white" : "bg-[#eee8dc] text-[#5d4a42]"}`}>TODOS</button>{ESTADOS_PREREGISTRO.map((item) => <button key={item} onClick={() => setEstado(item)} className={`rounded-xl px-4 py-2 text-xs font-bold ${estado === item ? "bg-[#74122A] text-white" : "bg-[#eee8dc] text-[#5d4a42]"}`}>{item.replace("_", " ")} ({resumen[item] ?? 0})</button>)}</div>
    </section>

    {consulta.isLoading ? <div className="rounded-2xl bg-white p-8 text-center"><span className="mx-auto block h-9 w-9 animate-spin rounded-full border-4 border-[#eadde0] border-t-[#74122A]"/><p className="mt-3">Cargando preregistros...</p></div> : consulta.isError ? <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center text-red-700"><p className="font-bold">No se pudieron cargar los preregistros.</p><p className="mt-2 text-sm">{consulta.error instanceof Error ? consulta.error.message : "Verifica que el backend y MongoDB estén funcionando."}</p><button type="button" onClick={() => consulta.refetch()} className="mt-4 rounded-xl bg-[#74122A] px-5 py-3 font-bold text-white">Volver a intentar</button></div> :
      <div className="overflow-hidden rounded-2xl border border-[#d3c9bb] bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[1080px] text-left text-sm">
        <thead className="bg-[#74122A] text-white"><tr>{["N.º", "Postulante", "Gestión", "Estado", "Promedio", "Fecha", "Acciones"].map((titulo) => <th key={titulo} className="px-4 py-3">{titulo}</th>)}</tr></thead>
        <tbody>{registros.length === 0 ? <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-500">No hay preregistros para este filtro.</td></tr> : registros.map((item) => {
          const usuario = typeof item.usuarioId === "object" ? item.usuarioId : null;
          const gestion = typeof item.gestionId === "object" ? item.gestionId : null;
          const asignando = asignarGuia.isPending && asignarGuia.variables === item._id;
          const postulanteGuiaListado = postulantesGuiaQuery.data?.find((postulante) => postulante.preregistroId?._id === item._id);
          const postulanteGuia = item.postulanteGuia ?? postulanteGuiaListado;
          return <tr key={item._id} className="border-b border-[#e7dfd3] hover:bg-[#faf7f1]">
            <td className="px-4 py-4 font-bold text-[#74122A]">{item.numeroPreRegistro}</td>
            <td className="px-4 py-4"><div className="flex items-center gap-3"><div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-[#C59A3A] bg-[#f3ead7] font-black text-[#841534]">{urlFoto(usuario?.fotoPerfil) ? <img src={urlFoto(usuario?.fotoPerfil)!} alt={`Foto de ${usuario?.nombres ?? "postulante"}`} className="h-full w-full object-cover" /> : `${usuario?.nombres?.[0] ?? ""}${usuario?.apellidoPaterno?.[0] ?? ""}`}</div><div><p className="font-bold">{usuario ? `${usuario.nombres} ${usuario.apellidoPaterno}` : "Usuario"}</p><p className="text-xs text-slate-500">CI {usuario?.ci}</p></div></div></td>
            <td className="px-4 py-4">{gestion?.nombre ?? "—"}</td>
            <td className="px-4 py-4"><span className={`rounded-full px-3 py-1 text-xs font-bold ${colorEstado[item.estado]}`}>{item.estado.replace("_", " ")}</span></td>
            <td className="px-4 py-4">{item.promedioExamen ?? "—"}</td>
            <td className="px-4 py-4">{new Date(item.fechaRegistro).toLocaleDateString("es-BO")}</td>
            <td className="px-4 py-4"><div className="flex flex-wrap gap-2">
              <button onClick={() => setDetalle(item)} className="rounded-lg bg-blue-100 px-3 py-2 text-blue-700">Ver</button>
              <button onClick={() => navigate(`/preregistros/${item._id}/editar`)} className="rounded-lg bg-amber-100 px-3 py-2 text-amber-800">Editar</button>
              <button onClick={() => navigate(`/cuotas?preregistroId=${item._id}`)} className="rounded-lg bg-emerald-100 px-3 py-2 font-semibold text-emerald-800">💳 Crear cuota</button>
              {postulanteGuia ? <button onClick={() => navigate(`/postulantes-guia/${postulanteGuia._id}`)} className="rounded-lg bg-purple-700 px-3 py-2 font-semibold text-white">✓ Postulante a guía · {postulanteGuia.estado.replaceAll("_", " ")}</button> : <button disabled={asignando || postulantesGuiaQuery.isLoading} onClick={() => asignarGuia.mutate(item._id)} className="rounded-lg bg-purple-100 px-3 py-2 font-semibold text-purple-800 disabled:opacity-50">{asignando ? "Asignando..." : "🪶 Designar postulante a guía"}</button>}
              <button onClick={() => navigate(`/traspasos?preregistroId=${item._id}`)} className="rounded-lg bg-cyan-100 px-3 py-2 font-semibold text-cyan-800">🔄 Traspasar cupo</button>
              <button onClick={() => setEliminarSeleccionado(item)} className="rounded-lg bg-red-100 px-3 py-2 text-red-700">Eliminar</button>
            </div></td>
          </tr>;
        })}</tbody>
      </table></div></div>}
    <PreregistroDetalleModal preregistro={detalle} postulanteGuia={detalle ? postulantesGuiaQuery.data?.find((postulante) => postulante.preregistroId?._id === detalle._id) : undefined} cerrar={() => setDetalle(null)} />
    {eliminarSeleccionado && <div className="fixed inset-0 z-[80] grid place-items-center bg-[#21181b]/70 p-4"><section className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"><header className="bg-gradient-to-r from-[#841534] to-[#C59A3A] p-5 text-white"><p className="text-xs uppercase tracking-[.18em]">Confirmación</p><h2 className="text-xl font-black">Cancelar preregistro</h2></header><div className="space-y-5 p-6"><p>Se cancelará <strong>{eliminarSeleccionado.numeroPreRegistro}</strong>. Esta acción quedará registrada en el sistema.</p><div className="flex justify-end gap-3"><button onClick={() => setEliminarSeleccionado(null)} className="rounded-xl border px-5 py-3 font-bold">Volver</button><button disabled={eliminar.isPending} onClick={() => eliminar.mutate(eliminarSeleccionado._id, { onSuccess: () => setEliminarSeleccionado(null) })} className="rounded-xl bg-red-700 px-5 py-3 font-bold text-white disabled:opacity-50">{eliminar.isPending ? "Cancelando..." : "Confirmar"}</button></div></div></section></div>}
  </div>;
}
