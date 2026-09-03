import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import api from "@/lib/axios";
import { activarVistaCapacitacion, salirVistaCapacitacion } from "@/utils/modoCapacitacion";

type Tipo = "ADMINISTRADOR" | "GUIA" | "FRATERNO";
type UsuarioDemo = { _id: string; nombres: string; apellidoPaterno?: string; apellidoMaterno?: string; ci: string; fotoPerfil?: string; codigo?: string | null; bloque?: string | null; tipo: "GUIA" | "FRATERNO" };
const nombre = (u: UsuarioDemo) => [u.nombres, u.apellidoPaterno, u.apellidoMaterno].filter(Boolean).join(" ");
const fotoUrl = (ruta?: string) => ruta ? (ruta.startsWith("http") ? ruta : `${String(import.meta.env.VITE_API_URL || "").replace(/\/api\/?$/, "")}${ruta}`) : "";

export default function ModoCapacitacionView() {
  const [tipo, setTipo] = useState<Tipo>("FRATERNO");
  const [buscar, setBuscar] = useState("");
  const navegar = useNavigate();
  const cliente = useQueryClient();
  const termino = buscar.trim();
  const consulta = useQuery({
    queryKey: ["usuarios-capacitacion", tipo, termino],
    queryFn: async () => (await api.get<{ usuarios: UsuarioDemo[] }>("/capacitacion/usuarios", { params: { tipo, buscar: termino } })).data.usuarios,
    enabled: tipo !== "ADMINISTRADOR" && termino.length >= 2,
  });
  const seleccionar = async (usuario: UsuarioDemo) => {
    activarVistaCapacitacion({ usuarioId: usuario._id, nombre: nombre(usuario), tipo: usuario.tipo });
    await cliente.invalidateQueries({ queryKey: ["usuario"] });
    navegar(usuario.tipo === "GUIA" ? "/mi-bloque-guia" : "/comunicados");
  };
  const administrar = async () => {
    salirVistaCapacitacion();
    await cliente.invalidateQueries({ queryKey: ["usuario"] });
    navegar("/dashboard");
  };
  return <main className="space-y-6">
    <header><p className="text-xs font-black uppercase tracking-widest text-[#8F5F2A]">Herramienta administrativa</p><h1 className="text-3xl font-black text-[#841534]">Modo capacitación</h1><p className="text-slate-500">Demuestra cada experiencia sin cambiar roles, crear usuarios falsos ni modificar datos reales.</p></header>
    <section className="rounded-2xl border bg-white p-5"><h2 className="font-black text-[#841534]">Ver como</h2><div className="mt-3 grid gap-3 sm:grid-cols-3">{(["ADMINISTRADOR", "GUIA", "FRATERNO"] as Tipo[]).map(opcion => <button key={opcion} onClick={() => { setTipo(opcion); setBuscar(""); if (opcion === "ADMINISTRADOR") void administrar(); }} className={`rounded-xl border p-4 font-black ${tipo === opcion ? "border-[#841534] bg-[#841534] text-white" : "bg-slate-50 text-slate-700"}`}>{opcion === "ADMINISTRADOR" ? "Administrador" : opcion === "GUIA" ? "Guía" : "Fraterno"}</button>)}</div></section>
    {tipo !== "ADMINISTRADOR" ? <section className="rounded-2xl border bg-white p-5"><h2 className="font-black text-[#841534]">Seleccionar {tipo === "GUIA" ? "guía" : "fraterno"}</h2><input value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="Buscar por CI, nombre o código..." className="mt-3 w-full rounded-xl border p-3"/><div className="mt-4 grid gap-3 lg:grid-cols-2">{consulta.data?.map(usuario => <article key={usuario._id} className="flex flex-col justify-between gap-3 rounded-xl border p-4 sm:flex-row"><div className="flex gap-3"><div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full bg-[#841534] font-black text-white">{usuario.fotoPerfil ? <img src={fotoUrl(usuario.fotoPerfil)} alt={`Foto de ${nombre(usuario)}`} className="h-full w-full object-cover"/> : nombre(usuario).charAt(0)}</div><div><p className="font-black">{nombre(usuario)}</p><p className="text-sm text-slate-500">CI {usuario.ci} {usuario.codigo ? `· ${usuario.codigo}` : ""}</p><p className="text-xs font-bold text-[#841534]">{usuario.tipo}{usuario.bloque ? ` · ${usuario.bloque}` : " · Sin bloque"}</p></div></div><button onClick={() => void seleccionar(usuario)} className="rounded-xl bg-emerald-700 px-4 py-2 font-black text-white">Ver como {usuario.tipo === "GUIA" ? "guía" : "fraterno"}</button></article>)}</div>{termino.length >= 2 && !consulta.isLoading && !consulta.data?.length ? <p className="py-8 text-center text-slate-500">No se encontraron usuarios activos.</p> : null}{consulta.isLoading ? <p className="py-6 text-center text-slate-500">Buscando...</p> : null}</section> : null}
    <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950"><b>Seguridad del modo capacitación:</b> todas las peticiones que modifican información son rechazadas por el servidor y la credencial QR generada no puede utilizarse para controles reales.</section>
  </main>;
}
