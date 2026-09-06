import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { cambiarBloqueoTalla, cambiarEntrega, configurarRegistroTallas, crearEntrega, crearPrenda, guardarTallaUsuario, obtenerIndumentaria, type Entrega, type Prenda, type UsuarioIndumentaria } from "@/api/IndumentariaApi";

type Seccion = "POLERA" | "CHAMARRA" | "INDUMENTARIA";
type TallasLocales = Record<string, { polera: string; chamarra: string }>;

const nombreUsuario = (usuario: UsuarioIndumentaria) => `${usuario.nombres} ${usuario.apellidoPaterno} ${usuario.apellidoMaterno ?? ""}`.trim();
const idRelacionado = (valor: any) => typeof valor === "object" ? valor?._id : valor;

export default function IndumentariaView() {
  const queryClient = useQueryClient();
  const [seccion, setSeccion] = useState<Seccion>("POLERA");
  const [busqueda, setBusqueda] = useState("");
  const [tallasLocales, setTallasLocales] = useState<TallasLocales>({});
  const [nuevaPrenda, setNuevaPrenda] = useState("");
  const [configTallas, setConfigTallas] = useState<{ habilitado: boolean; sinFechaLimite: boolean; fechaLimite: string }>({ habilitado: false, sinFechaLimite: true, fechaLimite: "" });

  const resumen = useQuery({ queryKey: ["indumentaria"], queryFn: obtenerIndumentaria });
  const mutacion = useMutation({
    mutationFn: (accion: () => Promise<any>) => accion(),
    onSuccess: async (respuesta) => {
      toast.success(respuesta.message);
      await queryClient.invalidateQueries({ queryKey: ["indumentaria"] });
    },
    onError: (error: any) => toast.error(error?.response?.data?.error ?? error?.message ?? "No se pudo guardar"),
  });
  const guardarConfiguracionTallas = useMutation({
    mutationFn: () => configurarRegistroTallas({ habilitado: configTallas.habilitado, sinFechaLimite: configTallas.sinFechaLimite, fechaLimite: configTallas.sinFechaLimite ? null : configTallas.fechaLimite || null }),
    onSuccess: async (respuesta) => { toast.success(respuesta.message); await queryClient.invalidateQueries({ queryKey: ["indumentaria"] }); },
    onError: (error: any) => toast.error(error?.response?.data?.error ?? error?.message ?? "No se pudo configurar el registro de tallas"),
  });

  const configuracionServidor = resumen.data?.configuracionTallas;
  useEffect(() => {
    if (!configuracionServidor) return;
    const fecha = configuracionServidor.fechaLimite ? new Date(configuracionServidor.fechaLimite) : null;
    setConfigTallas({ habilitado: configuracionServidor.habilitado, sinFechaLimite: !fecha, fechaLimite: fecha ? new Date(fecha.getTime() - fecha.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "" });
  }, [configuracionServidor]);

  const usuarios = useMemo(() => {
    const texto = busqueda.trim().toLocaleUpperCase("es-BO");
    return (resumen.data?.usuarios ?? []).filter((usuario) => {
      return !texto || [nombreUsuario(usuario), usuario.ci, usuario.fraterno?.numero, usuario.preregistro?.numero]
        .some((valor) => String(valor ?? "").toLocaleUpperCase("es-BO").includes(texto));
    });
  }, [busqueda, resumen.data?.usuarios]);

  const prendas = resumen.data?.prendas ?? [];
  const prendasTraje = prendas.filter((prenda) => !["POLERA", "CHAMARRA"].includes(prenda.nombre));
  const buscarTalla = (usuario: UsuarioIndumentaria) => usuario.talla;
  const tallaCampo = (usuario: UsuarioIndumentaria, tipo: "polera" | "chamarra") => tallasLocales[usuario._id]?.[tipo] ?? buscarTalla(usuario)?.[tipo === "polera" ? "tallaPolera" : "tallaChamarra"] ?? "";
  const entregaActual = (fraternoId: string, prendaId: string) => resumen.data?.entregas.find((entrega) => idRelacionado(entrega.fraternoId) === fraternoId && idRelacionado(entrega.prendaId) === prendaId && entrega.estado === "ENTREGADO");
  const actualizarTalla = (usuario: UsuarioIndumentaria, tipo: "polera" | "chamarra", valor: string) => {
    setTallasLocales((actual) => ({ ...actual, [usuario._id]: { polera: tallaCampo(usuario, "polera"), chamarra: tallaCampo(usuario, "chamarra"), ...actual[usuario._id], [tipo]: valor.toUpperCase() } }));
  };
  const guardarTallasUsuario = (usuario: UsuarioIndumentaria) => {
    const tipo = seccion === "POLERA" ? "polera" : "chamarra";
    const valor = tallaCampo(usuario, tipo).trim();
    if (!valor) return toast.info(`Registra la talla de ${tipo}`);
    mutacion.mutate(() => guardarTallaUsuario({ usuarioId: usuario._id, ...(tipo === "polera" ? { tallaPolera: valor } : { tallaChamarra: valor }) }));
  };
  const alternarEntrega = (fraternoId: string, prenda: Prenda, talla?: string) => {
    const actual = entregaActual(fraternoId, prenda._id);
    mutacion.mutate(() => actual ? cambiarEntrega(actual._id, "DEVUELTO") : crearEntrega({ fraternoId, prendaId: prenda._id, cantidad: 1, talla: talla || undefined }));
  };

  return <div className="space-y-6">
    <header>
      <h1 className="text-3xl font-black text-[#841534]">Tallas e indumentaria</h1>
      <p className="text-slate-500">Busca todas las cuentas de Gestión Integral y aplica por separado la habilitación de tallas.</p>
    </header>

    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {(["POLERA", "CHAMARRA", "INDUMENTARIA"] as Seccion[]).map((opcion) => <button key={opcion} type="button" onClick={() => setSeccion(opcion)} className={`rounded-xl px-5 py-3 text-sm font-black transition ${seccion === opcion ? "bg-[#841534] text-white shadow" : "border border-slate-200 bg-slate-50 text-slate-700 hover:border-[#841534]"}`}>{opcion === "INDUMENTARIA" ? "Indumentaria del traje" : opcion[0] + opcion.slice(1).toLowerCase()}</button>)}
        </div>
        <label className="relative block w-full lg:max-w-md"><span className="pointer-events-none absolute left-4 top-3 text-slate-400">⌕</span><input value={busqueda} onChange={(evento) => setBusqueda(evento.target.value)} placeholder="Buscar por nombre, CI o número de fraterno..." className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-4 outline-none focus:border-[#841534]" /></label>
      </div>
    </section>

    {resumen.data?.resumenTallas && <section className="rounded-2xl border bg-white p-5 shadow-sm"><div><p className="text-xs font-bold uppercase tracking-widest text-[#8F5F2A]">Resumen dinámico</p><h2 className="text-xl font-black text-[#841534]">Prendas requeridas por género y talla</h2></div><div className="mt-4 grid gap-4 lg:grid-cols-2">{(["POLERA","CHAMARRA"] as const).map(prenda=><article key={prenda} className="rounded-xl border p-4"><h3 className="font-black text-[#841534]">{prenda}</h3><div className="mt-3 grid gap-3 sm:grid-cols-2">{(["HOMBRE","MUJER"] as const).map(genero=>{const grupo=resumen.data!.resumenTallas[prenda][genero];return <div key={genero} className="rounded-xl bg-slate-50 p-3"><div className="flex justify-between"><strong>{genero}</strong><span className="font-black">{grupo.total}</span></div><div className="mt-2 flex flex-wrap gap-2">{grupo.tallas.map(item=><span key={item.talla} className="rounded-full bg-white px-2.5 py-1 text-xs font-bold shadow-sm">{item.talla}: {item.cantidad}</span>)}{!grupo.tallas.length&&<span className="text-xs text-slate-500">Sin tallas registradas</span>}</div></div>})}</div></article>)}</div></section>}

    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between"><div><p className="text-xs font-bold uppercase tracking-widest text-amber-700">Periodo de registro</p><h2 className="text-xl font-black text-[#841534]">Habilitar registro de tallas</h2><p className="mt-1 text-sm text-slate-600">Decide cuándo los fraternos pueden registrar o modificar su polera y chamarra.</p></div><div className="grid flex-1 gap-3 sm:grid-cols-2 xl:max-w-3xl xl:grid-cols-[auto_auto_1fr_auto]"><label className="flex items-center gap-2 rounded-xl border bg-white px-4 py-3 font-bold"><input type="checkbox" checked={configTallas.habilitado} onChange={(e)=>setConfigTallas({...configTallas,habilitado:e.target.checked})}/> Habilitado</label><label className="flex items-center gap-2 rounded-xl border bg-white px-4 py-3 font-bold"><input type="checkbox" checked={configTallas.sinFechaLimite} onChange={(e)=>setConfigTallas({...configTallas,sinFechaLimite:e.target.checked})}/> Sin fecha límite</label><label className="text-sm font-bold text-slate-700">Fecha límite<input type="datetime-local" disabled={!configTallas.habilitado||configTallas.sinFechaLimite} value={configTallas.fechaLimite} onChange={(e)=>setConfigTallas({...configTallas,fechaLimite:e.target.value})} className="mt-1 w-full rounded-xl border bg-white px-4 py-2.5 disabled:bg-slate-100"/></label><button type="button" disabled={guardarConfiguracionTallas.isPending||(!configTallas.sinFechaLimite&&!configTallas.fechaLimite)} onClick={()=>guardarConfiguracionTallas.mutate()} className="rounded-xl bg-[#841534] px-5 py-3 font-black text-white disabled:opacity-50">{guardarConfiguracionTallas.isPending?"Guardando...":"Guardar periodo"}</button></div></div>
      <p className={`mt-4 rounded-xl p-3 text-sm font-bold ${configTallas.habilitado?"bg-emerald-100 text-emerald-900":"bg-slate-200 text-slate-700"}`}>{configTallas.habilitado ? configTallas.sinFechaLimite ? "Los fraternos pueden registrar sus tallas de forma indefinida." : `El registro estará disponible hasta ${configTallas.fechaLimite ? new Date(configTallas.fechaLimite).toLocaleString("es-BO") : "definir fecha"}.` : "El registro de tallas está cerrado para los usuarios."}</p>
    </section>

    {seccion === "INDUMENTARIA" && <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={(evento) => { evento.preventDefault(); const nombre = nuevaPrenda.trim().toUpperCase(); if (!nombre) return; mutacion.mutate(() => crearPrenda({ nombre, requiereTalla: true }), { onSuccess: () => setNuevaPrenda("") }); }}>
        <label className="flex-1 text-sm font-bold text-slate-700">Agregar prenda al traje<input value={nuevaPrenda} onChange={(evento) => setNuevaPrenda(evento.target.value.toUpperCase())} placeholder="EJ.: MONTERA, CHALINA, PANTALÓN..." className="mt-1 w-full rounded-xl border border-amber-300 bg-white px-4 py-2.5 outline-none" /></label>
        <button disabled={mutacion.isPending} className="rounded-xl bg-[#841534] px-5 py-2.5 font-bold text-white disabled:opacity-50">+ Agregar prenda</button>
      </form>
    </section>}

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left">
        <thead className="bg-[#841534] text-white"><tr><th className="p-4">Usuario</th><th className="p-4">CI / Código</th>{seccion !== "INDUMENTARIA" && <><th className="p-4">Talla</th><th className="p-4">Habilitación</th><th className="p-4 text-right">Entrega</th></>}{seccion === "INDUMENTARIA" && <th className="p-4">Prendas del traje y estado de entrega</th>}</tr></thead>
        <tbody>{usuarios.map((usuario) => {
          const tipo = seccion === "POLERA" ? "polera" : "chamarra";
          const prendaPrincipal = prendas.find((item) => item.nombre === seccion);
          const fraternoId = usuario.fraterno?._id;
          const entregada = prendaPrincipal && fraternoId ? entregaActual(fraternoId, prendaPrincipal._id) : undefined;
          const pagoCompleto = Boolean(usuario.cuota && usuario.cuota.saldo <= 0 && usuario.cuota.estado === "PAGADA");
          const tallaRegistrada = buscarTalla(usuario);
          const edicionBloqueada = tallaRegistrada?.edicionBloqueada === true;
          return <tr key={usuario._id} className="border-b border-slate-100 align-top hover:bg-slate-50/70">
            <td className="p-4"><p className="font-black text-slate-800">{nombreUsuario(usuario)}</p><p className="mt-1 text-xs text-slate-500">{usuario.roles.join(" / ") || "SIN ROL"}{usuario.bloque ? ` · ${usuario.guia ? "GUÍA DEL " : ""}${usuario.bloque}` : ""}</p></td>
            <td className="p-4 text-sm"><p>{usuario.ci}</p><p className="text-slate-500">{usuario.fraterno?.numero ?? usuario.preregistro?.numero ?? "Sin código"}</p></td>
            {seccion !== "INDUMENTARIA" && <>
              <td className="p-4"><input disabled={!usuario.habilitado} value={tallaCampo(usuario, tipo)==="SIN DEFINIR"?"":tallaCampo(usuario, tipo)} onChange={(evento) => actualizarTalla(usuario, tipo, evento.target.value)} placeholder="Sin talla" className="w-28 rounded-lg border border-slate-300 px-3 py-2 uppercase outline-none focus:border-[#841534] disabled:bg-slate-100" /><button type="button" disabled={!usuario.habilitado || mutacion.isPending} onClick={() => guardarTallasUsuario(usuario)} className="ml-2 rounded-lg border border-[#841534] px-3 py-2 text-xs font-bold text-[#841534] disabled:opacity-40">Guardar talla</button>{fraternoId && <button type="button" disabled={mutacion.isPending} onClick={() => mutacion.mutate(() => cambiarBloqueoTalla(fraternoId, !edicionBloqueada))} className={`ml-2 rounded-lg px-3 py-2 text-xs font-bold text-white ${edicionBloqueada?"bg-emerald-700":"bg-slate-700"}`}>{edicionBloqueada?"Habilitar edición":"Bloquear edición"}</button>}</td>
              <td className="p-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black ${usuario.habilitado ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>{usuario.estadoHabilitacion === "HABILITADO" ? "HABILITADO PARA TALLA" : usuario.estadoHabilitacion.replace("_", " ")}</span><p className="mt-1 max-w-xs text-xs text-slate-500">{usuario.motivo}</p></td>
              <td className="p-4 text-right">{fraternoId ? <button type="button" disabled={!prendaPrincipal || mutacion.isPending || (!entregada && (!tallaCampo(usuario, tipo) || !pagoCompleto))} onClick={() => prendaPrincipal && alternarEntrega(fraternoId, prendaPrincipal, tallaCampo(usuario, tipo))} className={`rounded-xl px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40 ${entregada ? "bg-slate-600" : "bg-emerald-600"}`}>{entregada ? "Marcar devuelto" : pagoCompleto ? "Marcar entregado" : "Pago pendiente"}</button> : <span className="text-xs text-slate-400">Sin perfil fraterno</span>}</td>
            </>}
            {seccion === "INDUMENTARIA" && <td className="p-4">{fraternoId ? <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{prendasTraje.map((prenda) => { const actual = entregaActual(fraternoId, prenda._id); return <div key={prenda._id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3"><div><p className="text-xs font-black text-slate-800">{prenda.nombre}</p><EstadoEntrega entrega={actual} compacto /></div><button type="button" disabled={mutacion.isPending} onClick={() => alternarEntrega(fraternoId, prenda)} className={`rounded-lg px-3 py-2 text-xs font-bold text-white ${actual ? "bg-slate-600" : "bg-emerald-600"}`}>{actual ? "Devolver" : "Entregar"}</button></div>; })}{!prendasTraje.length && <p className="col-span-full text-sm text-slate-500">Agrega las prendas que componen el traje.</p>}</div> : <p className="text-sm text-slate-500">No habilitado para entrega: no tiene perfil fraterno.</p>}</td>}
          </tr>;
        })}</tbody>
      </table></div>
      {!resumen.isLoading && !usuarios.length && <div className="p-10 text-center text-slate-500">SIN RESULTADOS. No hay usuarios que coincidan con la búsqueda.</div>}
      {resumen.isLoading && <div className="p-10 text-center text-slate-500">BUSCANDO...</div>}
    </section>
  </div>;
}

function EstadoEntrega({ entrega, compacto = false }: { entrega?: Entrega; compacto?: boolean }) {
  if (!entrega) return <span className={`${compacto ? "mt-1 " : ""}inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-black text-amber-800`}>NO ENTREGADO</span>;
  return <div><span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-black text-emerald-800">ENTREGADO</span>{!compacto && <p className="mt-1 text-xs text-slate-500">{new Date(entrega.fechaEntrega).toLocaleDateString("es-BO")}</p>}</div>;
}
