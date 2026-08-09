import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import QRCode from "qrcode";
import { anularToken, crearToken, guardarConfiguracionTokens, obtenerConfiguracionTokens, obtenerTokens, type TokenRegistro } from "@/api/TokenRegistroApi";
import ConfiguracionQrPago from "@/components/cuota/ConfiguracionQrPago";

const nombre = (usuario: any) => [usuario?.nombres, usuario?.apellidoPaterno, usuario?.apellidoMaterno].filter(Boolean).join(" ") || "—";
const restante = (fecha: string) => { const ms = new Date(fecha).getTime() - Date.now(); if (ms <= 0) return "Vencido"; return `${Math.floor(ms / 3600000)} h ${Math.floor(ms % 3600000 / 60000)} min`; };

export default function TokenRegistroView() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["tokens-registro"], queryFn: obtenerTokens, refetchInterval: 60000 });
  const cfg = useQuery({ queryKey: ["configuracion-tokens"], queryFn: obtenerConfiguracionTokens });
  const [vigencia, setVigencia] = useState(24);
  const [plazo, setPlazo] = useState(72);
  const [observacion, setObservacion] = useState("");
  const [buscar, setBuscar] = useState("");
  const [filtro, setFiltro] = useState("TODOS");
  const [tokenAnular, setTokenAnular] = useState<TokenRegistro | null>(null);
  const [form, setForm] = useState<any>(null);

  useEffect(() => {
    if (!cfg.data || form) return;
    const configuracion = cfg.data.configuracion || {};
    setForm({
      gestionId: cfg.data.gestion._id,
      requerirTokenRegistro: configuracion.requerirTokenRegistro !== false,
      cupoMaximoHombres: cfg.data.gestion.cupoMaximoHombres,
      cupoMaximoMujeres: cfg.data.gestion.cupoMaximoMujeres,
      tarifaInterno: configuracion.tarifaInterno ?? 770,
      tarifaExterno: configuracion.tarifaExterno ?? 850,
      primeraCuota: configuracion.primeraCuota ?? 300,
      vigenciaTokenHoras: configuracion.vigenciaTokenHoras ?? 24,
      plazoPrimeraCuotaHoras: configuracion.plazoPrimeraCuotaHoras ?? 72,
      cantidadBloques: configuracion.cantidadBloques ?? 1,
    });
    setVigencia(configuracion.vigenciaTokenHoras ?? 24);
    setPlazo(configuracion.plazoPrimeraCuotaHoras ?? 72);
  }, [cfg.data, form]);

  const refrescar = () => Promise.all([qc.invalidateQueries({ queryKey: ["tokens-registro"] }), qc.invalidateQueries({ queryKey: ["configuracion-tokens"] })]);
  const crear = useMutation({ mutationFn: crearToken, onSuccess: async (respuesta) => { toast.success(`Token ${respuesta.token.codigo} generado`); setObservacion(""); await refrescar(); }, onError: (error: Error) => toast.error(error.message) });
  const guardar = useMutation({ mutationFn: guardarConfiguracionTokens, onSuccess: async (respuesta) => { toast.success(respuesta.message); await refrescar(); }, onError: (error: Error) => toast.error(error.message) });
  const anular = useMutation({ mutationFn: anularToken, onSuccess: async (respuesta) => { toast.success(respuesta.message); await refrescar(); }, onError: (error: Error) => toast.error(error.message) });
  const cupos = cfg.data?.cupos;
  const gestion = cfg.data?.gestion;
  const tokensVisibles = (q.data || []).filter((token) => token.estado !== "ANULADO" && (filtro === "TODOS" || token.estado === filtro) && `${token.codigo} ${nombre(token.utilizadoPor)} ${token.utilizadoPor?.ci || ""}`.toLowerCase().includes(buscar.toLowerCase()));

  return <main className="space-y-6">
    <header><p className="text-xs font-bold uppercase tracking-widest text-[#8F5F2A]">Acceso controlado</p><h1 className="text-3xl font-black text-[#74122A]">Tokens para nuevos fraternos</h1><p className="text-sm text-slate-600">Cada token puede escribirse o escanearse como QR y solo puede utilizarse una vez.</p></header>
    {form && <section className="rounded-2xl border bg-white p-5"><h2 className="text-xl font-black text-[#74122A]">Configuración de gestión</h2><label className="mt-4 flex items-start gap-3 rounded-xl border border-[#C59A3A] bg-amber-50 p-4"><input type="checkbox" checked={form.requerirTokenRegistro} onChange={(evento) => setForm({ ...form, requerirTokenRegistro: evento.target.checked })} className="mt-1 h-5 w-5"/><span><strong className="block text-[#74122A]">Exigir token de invitación para crear cuenta</strong><small className="text-slate-600">Desactívalo para registros presenciales o locales. El usuario abrirá directamente el formulario, pero su cuenta seguirá pendiente de alta administrativa.</small></span></label><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Campo titulo="Cupos hombres" valor={form.cupoMaximoHombres} cambiar={(valor) => setForm({ ...form, cupoMaximoHombres: valor })}/><Campo titulo="Cupos mujeres" valor={form.cupoMaximoMujeres} cambiar={(valor) => setForm({ ...form, cupoMaximoMujeres: valor })}/><Campo titulo="Tarifa internos FCPN (Bs)" valor={form.tarifaInterno} cambiar={(valor) => setForm({ ...form, tarifaInterno: valor })}/><Campo titulo="Tarifa externos (Bs)" valor={form.tarifaExterno} cambiar={(valor) => setForm({ ...form, tarifaExterno: valor })}/><Campo titulo="Primera cuota (Bs)" valor={form.primeraCuota} cambiar={(valor) => setForm({ ...form, primeraCuota: valor })}/><Campo titulo="Vigencia predeterminada (horas)" valor={form.vigenciaTokenHoras} cambiar={(valor) => setForm({ ...form, vigenciaTokenHoras: valor })}/><Campo titulo="Plazo primera cuota (horas)" valor={form.plazoPrimeraCuotaHoras} cambiar={(valor) => setForm({ ...form, plazoPrimeraCuotaHoras: valor })}/><Campo titulo="Cantidad de bloques" valor={form.cantidadBloques} cambiar={(valor) => setForm({ ...form, cantidadBloques: valor })}/></div><button onClick={() => guardar.mutate(form)} disabled={guardar.isPending} className="mt-4 rounded-xl bg-slate-800 px-5 py-3 font-bold text-white disabled:opacity-50">Guardar configuración</button></section>}
    <ConfiguracionQrPago/>
    <section className="grid gap-3 sm:grid-cols-3"><Cupo titulo="Totales" dato={cupos?.TOTAL}/><Cupo titulo="Hombres registrados" dato={cupos?.HOMBRE}/><Cupo titulo="Mujeres registradas" dato={cupos?.MUJER}/></section>
    <form onSubmit={(evento) => { evento.preventDefault(); if (gestion) crear.mutate({ gestionId: gestion._id, vigenciaHoras: vigencia, plazoPagoHoras: plazo, observacion }); }} className="grid gap-3 rounded-2xl bg-white p-5 shadow md:grid-cols-2 xl:grid-cols-4"><Campo titulo="Vigencia código (horas)" valor={vigencia} cambiar={setVigencia}/><Campo titulo="Plazo para pagar (horas)" valor={plazo} cambiar={setPlazo}/><label className="text-sm font-bold">Observación opcional<input value={observacion} onChange={(evento) => setObservacion(evento.target.value)} placeholder="Ej.: Invitación autorizada" className="mt-1 w-full rounded-xl border p-3"/></label><button disabled={!gestion || crear.isPending || !cupos?.TOTAL?.disponibles} className="self-end rounded-xl bg-[#74122A] p-3 font-bold text-white disabled:opacity-50">Generar token y QR</button></form>
    <section className="overflow-x-auto rounded-2xl bg-white p-5"><div className="mb-4 grid gap-3 sm:grid-cols-[1fr_240px]"><input value={buscar} onChange={(evento) => setBuscar(evento.target.value)} placeholder="Buscar token, nombre o CI" className="rounded-xl border p-3"/><select value={filtro} onChange={(evento) => setFiltro(evento.target.value)} className="rounded-xl border p-3"><option value="TODOS">Disponibles y utilizados</option><option value="DISPONIBLE">Solo disponibles</option><option value="UTILIZADO">Solo utilizados</option><option value="VENCIDO">Solo vencidos</option></select></div><table className="w-full min-w-[1200px] text-left text-sm"><thead className="bg-[#74122A] text-white"><tr>{["Token", "Cupo", "Estado", "Vence", "Pago límite", "Generado por", "Utilizado por", "Cuota", "Acción"].map((titulo) => <th className="p-3" key={titulo}>{titulo}</th>)}</tr></thead><tbody>{tokensVisibles.map((token) => <tr key={token._id} className="border-b"><td className="p-3"><b className="font-mono">{token.codigo}</b><div className="mt-2 flex gap-2"><button type="button" onClick={() => navigator.clipboard.writeText(token.codigo).then(() => toast.success("Token copiado"))} className="rounded bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">Copiar</button><BotonQrToken codigo={token.codigo}/></div></td><td>{token.sexoCupo || "Se define al registrarse"}</td><td><b>{token.estado}</b></td><td>{new Date(token.fechaExpiracion).toLocaleString("es-BO")}<small className="block font-bold text-amber-700">{token.estado === "DISPONIBLE" && restante(token.fechaExpiracion)}</small></td><td>{token.plazoPagoHoras} h después del registro</td><td>{nombre(token.generadoPor)}</td><td>{nombre(token.utilizadoPor)}</td><td>{token.cuotaId ? <Link className="font-bold text-[#74122A] underline" to={`/cuotas/${token.cuotaId._id || token.cuotaId}`}>Ver pagos</Link> : "—"}</td><td>{token.estado === "DISPONIBLE" && <button type="button" onClick={() => setTokenAnular(token)} className="text-red-700 underline">Anular</button>}</td></tr>)}</tbody></table></section>
    {tokenAnular && <ModalAnular token={tokenAnular} procesando={anular.isPending} cerrar={() => setTokenAnular(null)} confirmar={() => anular.mutate(tokenAnular._id, { onSuccess: () => setTokenAnular(null) })}/>}
  </main>;
}

function Campo({ titulo, valor, cambiar }: { titulo: string; valor: number; cambiar: (valor: number) => void }) { return <label className="text-sm font-bold">{titulo}<input required min="1" type="number" value={valor} onChange={(evento) => cambiar(Number(evento.target.value))} className="mt-1 w-full rounded-xl border p-3"/></label>; }
function Cupo({ titulo, dato }: { titulo: string; dato: any }) { return <article className="rounded-2xl bg-white p-5 shadow"><p className="font-bold text-slate-500">Cupos {titulo}</p><strong className="text-3xl text-[#74122A]">{dato?.disponibles ?? "—"} disponibles</strong><p className="mt-1 text-sm">{dato?.usados ?? 0} ocupados · {dato?.reservados ?? 0} reservados · máximo {dato?.maximo ?? 0}</p></article>; }

function BotonQrToken({ codigo }: { codigo: string }) {
  const [abierto, setAbierto] = useState(false);
  const [imagen, setImagen] = useState("");
  useEffect(() => { if (abierto) void QRCode.toDataURL(codigo, { width: 800, margin: 3, errorCorrectionLevel: "H" }).then(setImagen); }, [abierto, codigo]);
  return <><button type="button" onClick={() => setAbierto(true)} className="rounded bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">Ver QR</button>{abierto && <div className="fixed inset-0 z-[170] grid place-items-center bg-black/65 p-4" role="dialog" aria-modal="true" aria-labelledby="titulo-qr-token"><section className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl"><h2 id="titulo-qr-token" className="text-xl font-black text-[#74122A]">QR del token</h2><p className="mt-2 font-mono font-bold">{codigo}</p>{imagen ? <img src={imagen} alt={`QR del token ${codigo}`} className="mx-auto mt-4 w-full max-w-xs"/> : <p className="p-8">Generando QR...</p>}<p className="mt-3 text-sm text-slate-500">Contiene solamente el código de uso único.</p><div className="mt-4 grid grid-cols-2 gap-2"><a href={imagen} download={`TOKEN_${codigo}.png`} className="rounded-xl bg-[#74122A] px-3 py-3 font-bold text-white">Descargar</a><button type="button" onClick={() => setAbierto(false)} className="rounded-xl border px-3 py-3 font-bold">Cerrar</button></div></section></div>}</>;
}

function ModalAnular({ token, procesando, cerrar, confirmar }: { token: TokenRegistro; procesando: boolean; cerrar: () => void; confirmar: () => void }) { return <div className="fixed inset-0 z-[150] grid place-items-center bg-black/65 p-4" role="dialog" aria-modal="true" aria-labelledby="titulo-anular-token"><section className="w-full max-w-md rounded-3xl bg-white p-7 text-center shadow-2xl"><div className="text-4xl">⚠️</div><h2 id="titulo-anular-token" className="mt-4 text-2xl font-black text-[#74122A]">Anular token</h2><p className="mt-3">El token <strong className="font-mono">{token.codigo}</strong> dejará de funcionar y liberará el cupo reservado.</p><div className="mt-6 grid grid-cols-2 gap-3"><button type="button" onClick={cerrar} disabled={procesando} className="rounded-xl border px-4 py-3 font-bold">Cancelar</button><button type="button" onClick={confirmar} disabled={procesando} className="rounded-xl bg-red-700 px-4 py-3 font-bold text-white disabled:opacity-50">{procesando ? "Anulando..." : "Sí, anular"}</button></div></section></div>; }
