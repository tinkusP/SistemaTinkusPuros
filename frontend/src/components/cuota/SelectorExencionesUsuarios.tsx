import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import {
  actualizarExencionPago,
  actualizarExencionUsuarioSinCuota,
  obtenerUsuariosExencion,
  type CategoriaExencionUsuario,
  type UsuarioSelectorExencion,
} from "@/api/CuotaApi";

const CATEGORIAS: Array<{ codigo: CategoriaExencionUsuario; nombre: string }> = [
  { codigo: "DIRECTIVA", nombre: "Directiva" },
  { codigo: "ADMINISTRACION", nombre: "Administración" },
  { codigo: "GUIA", nombre: "Guía" },
  { codigo: "INVITADO", nombre: "Invitado" },
  { codigo: "OTRO", nombre: "Otro" },
];
const fecha = (valor: string | null) => valor ? new Date(valor).toLocaleDateString("es-BO") : "SIN REGISTRO";
const normalizar = (valor: unknown) => String(valor ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export default function SelectorExencionesUsuarios() {
  const queryClient = useQueryClient();
  const consulta = useQuery({ queryKey: ["usuarios-exencion"], queryFn: obtenerUsuariosExencion });
  const [buscar, setBuscar] = useState("");
  const [bloque, setBloque] = useState("TODOS");
  const [tipo, setTipo] = useState("TODOS");
  const [estadoPago, setEstadoPago] = useState("TODOS");
  const [seleccion, setSeleccion] = useState<UsuarioSelectorExencion | null>(null);
  const [categoria, setCategoria] = useState<CategoriaExencionUsuario>("DIRECTIVA");
  const [descripcion, setDescripcion] = useState("");

  const actualizar = useMutation({
    mutationFn: async ({ persona, exentoPago, categoriaExencion, detalle }: { persona: UsuarioSelectorExencion; exentoPago: boolean; categoriaExencion?: CategoriaExencionUsuario; detalle?: string }) => {
      if (persona.cuotaId) return actualizarExencionPago(persona.cuotaId, { exentoPago, motivoExencion: exentoPago ? String(categoriaExencion) : "Corrección administrativa", observacionExencion: detalle });
      return actualizarExencionUsuarioSinCuota(persona.usuarioId, { exentoPago, categoria: categoriaExencion, descripcion: detalle });
    },
    onSuccess: async (respuesta) => {
      toast.success(respuesta.message);
      setSeleccion(null);
      setDescripcion("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["usuarios-exencion"] }),
        queryClient.invalidateQueries({ queryKey: ["control-financiero-bloques"] }),
        queryClient.invalidateQueries({ queryKey: ["auditoria-financiera-general"] }),
        queryClient.invalidateQueries({ queryKey: ["auditoria-participacion"] }),
        queryClient.invalidateQueries({ queryKey: ["cuotas"] }),
      ]);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "No se pudo actualizar la exención"),
  });

  const usuarios = useMemo(() => consulta.data?.usuarios ?? [], [consulta.data?.usuarios]);
  const bloques = useMemo(() => [...new Set(usuarios.map((usuario) => usuario.bloque))].sort(), [usuarios]);
  const estados = useMemo(() => [...new Set(usuarios.map((usuario) => usuario.estadoPago))].sort(), [usuarios]);
  const filtrados = useMemo(() => {
    const termino = normalizar(buscar.trim());
    return usuarios.filter((usuario) => {
      const texto = normalizar([usuario.nombre, usuario.ci, usuario.telefono, usuario.codigoFraterno, usuario.correo].join(" "));
      return (!termino || texto.includes(termino))
        && (bloque === "TODOS" || usuario.bloque === bloque)
        && (tipo === "TODOS" || usuario.tipo === tipo)
        && (estadoPago === "TODOS" || usuario.estadoPago === estadoPago);
    });
  }, [usuarios, buscar, bloque, tipo, estadoPago]);

  const abrirFormulario = (persona: UsuarioSelectorExencion) => {
    setSeleccion(persona);
    setCategoria(CATEGORIAS.some((item) => item.codigo === persona.categoriaExencion) ? persona.categoriaExencion as CategoriaExencionUsuario : "DIRECTIVA");
    setDescripcion(persona.descripcionExencion || "");
  };
  const guardar = () => {
    if (!seleccion) return;
    if (categoria === "OTRO" && descripcion.trim().length < 3) return toast.error("Describe el motivo de la exención");
    actualizar.mutate({ persona: seleccion, exentoPago: true, categoriaExencion: categoria, detalle: descripcion.trim() });
  };
  const retirar = (persona: UsuarioSelectorExencion) => {
    if (!confirm(`¿Retirar la exención de ${persona.nombre}?`)) return;
    actualizar.mutate({ persona, exentoPago: false });
  };

  if (consulta.isLoading) return <section className="rounded-2xl border bg-white p-5">Cargando todos los usuarios activos para exenciones…</section>;
  if (consulta.isError || !consulta.data) return <section className="rounded-2xl border border-red-300 bg-red-50 p-5 text-red-800">No se pudo cargar el selector general de exenciones.</section>;
  const datos = consulta.data;

  return <section className="space-y-4 rounded-2xl border-2 border-blue-200 bg-blue-50 p-5">
    <div>
      <p className="text-xs font-black uppercase tracking-widest text-blue-700">Fuente: Gestión Integral</p>
      <h3 className="text-xl font-black text-[#74122A]">Selector general de usuarios para exenciones</h3>
      <p className="text-sm text-slate-700">Incluye todos los perfiles activos, aunque no tengan bloque, cuota o talla. Esta lista no modifica los totales financieros por bloque.</p>
    </div>
    <div className="grid gap-3 sm:grid-cols-4">
      <article className="rounded-xl bg-white p-4"><small className="font-bold">USUARIOS ACTIVOS</small><b className="block text-2xl text-[#74122A]">{datos.resumen.totalUsuariosActivos}</b></article>
      <article className="rounded-xl bg-white p-4"><small className="font-bold">DISPONIBLES PARA EXENCIÓN</small><b className="block text-2xl text-[#74122A]">{datos.resumen.disponiblesExencion}</b></article>
      <article className="rounded-xl bg-white p-4"><small className="font-bold">VISIBLES EN CONTROL ANTERIOR</small><b className="block text-2xl text-[#74122A]">{datos.resumen.visiblesControlFinanciero}</b></article>
      <article className="rounded-xl bg-white p-4"><small className="font-bold">ANTES NO VISIBLES</small><b className="block text-2xl text-amber-800">{datos.resumen.noVisiblesControlFinanciero}</b></article>
    </div>
    <p className={`rounded-xl p-3 text-sm font-black ${datos.validaciones.universoCompleto ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
      {datos.validaciones.universoCompleto ? "VALIDADO: usuarios activos de Gestión Integral = usuarios disponibles para exención." : "ERROR: el universo del selector no coincide con Gestión Integral."}
    </p>
    <div className="grid gap-2 lg:grid-cols-4">
      <input value={buscar} onChange={(evento) => setBuscar(evento.target.value)} placeholder="Nombre, apellido, CI, teléfono, código o correo" className="input-preregistro lg:col-span-1" />
      <select value={bloque} onChange={(evento) => setBloque(evento.target.value)} className="input-preregistro"><option>TODOS</option>{bloques.map((nombre) => <option key={nombre}>{nombre}</option>)}</select>
      <select value={tipo} onChange={(evento) => setTipo(evento.target.value)} className="input-preregistro"><option>TODOS</option><option>INTERNO</option><option>EXTERNO</option><option>SIN CLASIFICAR</option></select>
      <select value={estadoPago} onChange={(evento) => setEstadoPago(evento.target.value)} className="input-preregistro"><option>TODOS</option>{estados.map((estado) => <option key={estado}>{estado}</option>)}</select>
    </div>
    <div className="max-h-[560px] overflow-auto rounded-xl border bg-white">
      <table className="w-full min-w-[1650px] text-left text-xs">
        <thead className="sticky top-0 bg-[#74122A] text-white"><tr>{["Nombre", "CI / Teléfono", "Correo", "Roles", "Bloque", "Tipo", "Estado pago", "Tallas", "Estado exención", "Registro exención", "Acción"].map((titulo) => <th key={titulo} className="p-3">{titulo}</th>)}</tr></thead>
        <tbody>{filtrados.map((persona) => <tr key={persona.usuarioId} className="border-t align-top">
          <td className="p-3 font-bold">{persona.nombre}<br/><span className="font-normal text-slate-500">{persona.codigoFraterno}</span></td>
          <td className="p-3">{persona.ci}<br/>{persona.telefono}</td>
          <td className="p-3">{persona.correo}</td>
          <td className="p-3">{persona.roles.join(" / ")}</td>
          <td className="p-3 font-bold">{persona.bloque}</td>
          <td className="p-3">{persona.tipo}</td>
          <td className="p-3">{persona.estadoPago}</td>
          <td className="p-3">Polera: {persona.tallaPolera}<br/>Chamarra: {persona.tallaChamarra}</td>
          <td className="p-3 font-bold">{persona.exento ? `EXENTO · ${persona.categoriaExencion}` : "NO EXENTO"}</td>
          <td className="p-3">{persona.exento ? <>{persona.administradorExencion}<br/>{fecha(persona.fechaExencion)}<br/>{persona.descripcionExencion}</> : "—"}</td>
          <td className="p-3"><button type="button" disabled={actualizar.isPending} onClick={() => persona.exento ? retirar(persona) : abrirFormulario(persona)} className="rounded-lg border border-[#74122A] px-3 py-2 font-black text-[#74122A] disabled:opacity-50">{persona.exento ? "QUITAR EXENCIÓN" : "MARCAR EXENTO"}</button></td>
        </tr>)}</tbody>
      </table>
      {!filtrados.length ? <p className="p-6 text-center text-slate-500">No existen usuarios que coincidan con la búsqueda.</p> : null}
    </div>
    <details className="rounded-xl border border-amber-300 bg-amber-50 p-4">
      <summary className="cursor-pointer font-black text-amber-900">Usuarios no visibles en el control financiero anterior ({datos.noVisiblesControlFinanciero.length})</summary>
      <div className="mt-3 max-h-[420px] overflow-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead><tr>{["CI", "Nombre", "Rol", "Motivo por el cual no aparecía"].map((titulo) => <th key={titulo} className="p-2">{titulo}</th>)}</tr></thead><tbody>{datos.noVisiblesControlFinanciero.map((persona) => <tr key={persona.usuarioId} className="border-t"><td className="p-2">{persona.ci}</td><td>{persona.nombre}</td><td>{persona.roles.join(" / ")}</td><td>{persona.motivosNoVisible.join("; ")}</td></tr>)}</tbody></table></div>
    </details>
    <div className="grid gap-2 sm:grid-cols-2">{datos.casosValidacion.map((caso) => <p key={caso.caso} className={`rounded-xl p-3 text-sm ${caso.encontrado ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}><b>{caso.caso.replaceAll("_", " ")}:</b> {caso.encontrado ? caso.coincidencias.map((persona) => `${persona.nombre} · CI ${persona.ci} · ${persona.bloque} · ${persona.estadoPago}`).join("; ") : "NO ENCONTRADO ENTRE USUARIOS ACTIVOS"}</p>)}</div>

    {seleccion ? <div role="dialog" aria-modal="true" aria-label="Registrar exención" className="fixed inset-0 z-50 overflow-auto bg-black/60 p-4"><div className="mx-auto mt-20 max-w-xl rounded-2xl bg-white p-6">
      <h3 className="text-xl font-black text-[#74122A]">Marcar usuario como EXENTO</h3>
      <p className="mt-1 text-sm"><b>{seleccion.nombre}</b> · CI {seleccion.ci} · {seleccion.estadoPago}</p>
      <label className="mt-4 block text-sm font-bold">Motivo<select value={categoria} onChange={(evento) => setCategoria(evento.target.value as CategoriaExencionUsuario)} className="input-preregistro mt-1">{CATEGORIAS.map((item) => <option key={item.codigo} value={item.codigo}>{item.nombre}</option>)}</select></label>
      <label className="mt-3 block text-sm font-bold">Descripción<textarea value={descripcion} onChange={(evento) => setDescripcion(evento.target.value)} maxLength={1000} rows={4} className="input-preregistro mt-1" placeholder={categoria === "OTRO" ? "Descripción obligatoria" : "Detalle opcional"}/></label>
      <p className="mt-3 text-xs text-slate-600">El sistema registrará automáticamente al administrador y la fecha. Si no existe cuota, la exención administrativa no alterará ningún cálculo financiero.</p>
      <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setSeleccion(null)} className="rounded-xl border px-4 py-2 font-bold">CANCELAR</button><button type="button" disabled={actualizar.isPending} onClick={guardar} className="rounded-xl bg-[#74122A] px-4 py-2 font-bold text-white disabled:opacity-50">{actualizar.isPending ? "GUARDANDO…" : "GUARDAR EXENCIÓN"}</button></div>
    </div></div> : null}
  </section>;
}
