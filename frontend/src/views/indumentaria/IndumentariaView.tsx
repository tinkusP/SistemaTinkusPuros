import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "react-toastify";
import { listarFraternos } from "@/api/FraternoApi";
import { cambiarEntrega, crearEntrega, crearPrenda, guardarTalla, obtenerIndumentaria, type Entrega, type Prenda } from "@/api/IndumentariaApi";
import type { Fraterno } from "@/types/FraternoType";

type Seccion = "POLERA" | "CHAMARRA" | "INDUMENTARIA";
type TallasLocales = Record<string, { polera: string; chamarra: string }>;

const nombreFraterno = (fraterno: Fraterno) => {
  const usuario = typeof fraterno.usuarioId === "object" ? fraterno.usuarioId : null;
  return usuario ? `${usuario.nombres} ${usuario.apellidoPaterno} ${usuario.apellidoMaterno ?? ""}`.trim() : fraterno.numeroFraterno;
};
const idRelacionado = (valor: any) => typeof valor === "object" ? valor?._id : valor;

export default function IndumentariaView() {
  const queryClient = useQueryClient();
  const [seccion, setSeccion] = useState<Seccion>("POLERA");
  const [busqueda, setBusqueda] = useState("");
  const [tallasLocales, setTallasLocales] = useState<TallasLocales>({});
  const [nuevaPrenda, setNuevaPrenda] = useState("");

  const resumen = useQuery({ queryKey: ["indumentaria"], queryFn: obtenerIndumentaria });
  const consultaFraternos = useQuery({ queryKey: ["fraternos"], queryFn: listarFraternos });
  const mutacion = useMutation({
    mutationFn: (accion: () => Promise<any>) => accion(),
    onSuccess: async (respuesta) => {
      toast.success(respuesta.message);
      await queryClient.invalidateQueries({ queryKey: ["indumentaria"] });
    },
    onError: (error: any) => toast.error(error?.response?.data?.error ?? error?.message ?? "No se pudo guardar"),
  });

  const fraternos = useMemo(() => {
    const texto = busqueda.trim().toLocaleUpperCase("es-BO");
    return (consultaFraternos.data?.fraternos ?? []).filter((fraterno) => {
      const usuario = typeof fraterno.usuarioId === "object" ? fraterno.usuarioId : null;
      return !texto || [nombreFraterno(fraterno), usuario?.ci, fraterno.numeroFraterno]
        .some((valor) => String(valor ?? "").toLocaleUpperCase("es-BO").includes(texto));
    });
  }, [busqueda, consultaFraternos.data]);

  const prendas = resumen.data?.prendas ?? [];
  const prendasTraje = prendas.filter((prenda) => !["POLERA", "CHAMARRA"].includes(prenda.nombre));
  const buscarTalla = (fraternoId: string) => resumen.data?.tallas.find((talla) => idRelacionado(talla.fraternoId) === fraternoId);
  const tallaCampo = (fraternoId: string, tipo: "polera" | "chamarra") => tallasLocales[fraternoId]?.[tipo] ?? buscarTalla(fraternoId)?.[tipo === "polera" ? "tallaPolera" : "tallaChamarra"] ?? "";
  const entregaActual = (fraternoId: string, prendaId: string) => resumen.data?.entregas.find((entrega) => idRelacionado(entrega.fraternoId) === fraternoId && idRelacionado(entrega.prendaId) === prendaId && entrega.estado === "ENTREGADO");
  const cuotaFraterno = (fraterno: Fraterno) => resumen.data?.cuotas.find((cuota) => idRelacionado(cuota.preregistroId) === idRelacionado(fraterno.preregistroId));

  const actualizarTalla = (fraternoId: string, tipo: "polera" | "chamarra", valor: string) => {
    setTallasLocales((actual) => ({ ...actual, [fraternoId]: { polera: tallaCampo(fraternoId, "polera"), chamarra: tallaCampo(fraternoId, "chamarra"), ...actual[fraternoId], [tipo]: valor.toUpperCase() } }));
  };
  const guardarTallasFraterno = (fraternoId: string) => {
    const tallaPolera = tallaCampo(fraternoId, "polera").trim();
    const tallaChamarra = tallaCampo(fraternoId, "chamarra").trim();
    if (!tallaPolera || !tallaChamarra) return toast.info("Registra las tallas de polera y chamarra");
    mutacion.mutate(() => guardarTalla({ fraternoId, tallaPolera, tallaChamarra }));
  };
  const alternarEntrega = (fraternoId: string, prenda: Prenda, talla?: string) => {
    const actual = entregaActual(fraternoId, prenda._id);
    mutacion.mutate(() => actual ? cambiarEntrega(actual._id, "DEVUELTO") : crearEntrega({ fraternoId, prendaId: prenda._id, cantidad: 1, talla: talla || undefined }));
  };

  return <div className="space-y-6">
    <header>
      <h1 className="text-3xl font-black text-[#841534]">Tallas e indumentaria</h1>
      <p className="text-slate-500">Control de tallas y entrega de prendas a todos los fraternos.</p>
    </header>

    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {(["POLERA", "CHAMARRA", "INDUMENTARIA"] as Seccion[]).map((opcion) => <button key={opcion} type="button" onClick={() => setSeccion(opcion)} className={`rounded-xl px-5 py-3 text-sm font-black transition ${seccion === opcion ? "bg-[#841534] text-white shadow" : "border border-slate-200 bg-slate-50 text-slate-700 hover:border-[#841534]"}`}>{opcion === "INDUMENTARIA" ? "Indumentaria del traje" : opcion[0] + opcion.slice(1).toLowerCase()}</button>)}
        </div>
        <label className="relative block w-full lg:max-w-md"><span className="pointer-events-none absolute left-4 top-3 text-slate-400">⌕</span><input value={busqueda} onChange={(evento) => setBusqueda(evento.target.value)} placeholder="Buscar por nombre, CI o número de fraterno..." className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-4 outline-none focus:border-[#841534]" /></label>
      </div>
    </section>

    {seccion === "INDUMENTARIA" && <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={(evento) => { evento.preventDefault(); const nombre = nuevaPrenda.trim().toUpperCase(); if (!nombre) return; mutacion.mutate(() => crearPrenda({ nombre, requiereTalla: true }), { onSuccess: () => setNuevaPrenda("") }); }}>
        <label className="flex-1 text-sm font-bold text-slate-700">Agregar prenda al traje<input value={nuevaPrenda} onChange={(evento) => setNuevaPrenda(evento.target.value.toUpperCase())} placeholder="EJ.: MONTERA, CHALINA, PANTALÓN..." className="mt-1 w-full rounded-xl border border-amber-300 bg-white px-4 py-2.5 outline-none" /></label>
        <button disabled={mutacion.isPending} className="rounded-xl bg-[#841534] px-5 py-2.5 font-bold text-white disabled:opacity-50">+ Agregar prenda</button>
      </form>
    </section>}

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left">
        <thead className="bg-[#841534] text-white"><tr><th className="p-4">Fraterno</th><th className="p-4">CI / N.º</th>{seccion !== "INDUMENTARIA" && <><th className="p-4">Talla</th><th className="p-4">Estado</th><th className="p-4 text-right">Acción</th></>}{seccion === "INDUMENTARIA" && <th className="p-4">Prendas del traje y estado de entrega</th>}</tr></thead>
        <tbody>{fraternos.map((fraterno) => {
          const usuario = typeof fraterno.usuarioId === "object" ? fraterno.usuarioId : null;
          const tipo = seccion === "POLERA" ? "polera" : "chamarra";
          const prendaPrincipal = prendas.find((item) => item.nombre === seccion);
          const entregada = prendaPrincipal ? entregaActual(fraterno._id, prendaPrincipal._id) : undefined;
          const cuota = cuotaFraterno(fraterno);
          const pagoCompleto = Boolean(cuota && cuota.saldo <= 0 && cuota.estado === "PAGADA");
          return <tr key={fraterno._id} className="border-b border-slate-100 align-top hover:bg-slate-50/70">
            <td className="p-4"><p className="font-black text-slate-800">{nombreFraterno(fraterno)}</p><span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${fraterno.estado === "ACTIVO" ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}>{fraterno.estado}</span><span className={`ml-1 mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${pagoCompleto ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>{pagoCompleto ? "PAGO COMPLETO" : `SALDO Bs ${cuota?.saldo.toFixed(2) ?? "—"}`}</span></td>
            <td className="p-4 text-sm"><p>{usuario?.ci ?? "Sin CI"}</p><p className="text-slate-500">{fraterno.numeroFraterno}</p></td>
            {seccion !== "INDUMENTARIA" && <>
              <td className="p-4"><input value={tallaCampo(fraterno._id, tipo)} onChange={(evento) => actualizarTalla(fraterno._id, tipo, evento.target.value)} placeholder="Sin talla" className="w-28 rounded-lg border border-slate-300 px-3 py-2 uppercase outline-none focus:border-[#841534]" /><button type="button" onClick={() => guardarTallasFraterno(fraterno._id)} className="ml-2 rounded-lg border border-[#841534] px-3 py-2 text-xs font-bold text-[#841534]">Guardar talla</button></td>
              <td className="p-4"><EstadoEntrega entrega={entregada} /></td>
              <td className="p-4 text-right"><button type="button" disabled={!prendaPrincipal || mutacion.isPending || (!entregada && (!tallaCampo(fraterno._id, tipo) || !pagoCompleto))} onClick={() => prendaPrincipal && alternarEntrega(fraterno._id, prendaPrincipal, tallaCampo(fraterno._id, tipo))} className={`rounded-xl px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40 ${entregada ? "bg-slate-600" : "bg-emerald-600"}`}>{entregada ? "Marcar devuelto" : pagoCompleto ? "Marcar entregado" : "Pago pendiente"}</button></td>
            </>}
            {seccion === "INDUMENTARIA" && <td className="p-4"><div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{prendasTraje.map((prenda) => { const actual = entregaActual(fraterno._id, prenda._id); return <div key={prenda._id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3"><div><p className="text-xs font-black text-slate-800">{prenda.nombre}</p><EstadoEntrega entrega={actual} compacto /></div><button type="button" disabled={mutacion.isPending} onClick={() => alternarEntrega(fraterno._id, prenda)} className={`rounded-lg px-3 py-2 text-xs font-bold text-white ${actual ? "bg-slate-600" : "bg-emerald-600"}`}>{actual ? "Devolver" : "Entregar"}</button></div>; })}{!prendasTraje.length && <p className="col-span-full text-sm text-slate-500">Agrega las prendas que componen el traje.</p>}</div></td>}
          </tr>;
        })}</tbody>
      </table></div>
      {!consultaFraternos.isLoading && !fraternos.length && <div className="p-10 text-center text-slate-500">No se encontraron fraternos.</div>}
      {consultaFraternos.isLoading && <div className="p-10 text-center text-slate-500">Cargando fraternos...</div>}
    </section>
  </div>;
}

function EstadoEntrega({ entrega, compacto = false }: { entrega?: Entrega; compacto?: boolean }) {
  if (!entrega) return <span className={`${compacto ? "mt-1 " : ""}inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-black text-amber-800`}>NO ENTREGADO</span>;
  return <div><span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-black text-emerald-800">ENTREGADO</span>{!compacto && <p className="mt-1 text-xs text-slate-500">{new Date(entrega.fechaEntrega).toLocaleDateString("es-BO")}</p>}</div>;
}
