import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { aceptarTerminosPago, miConfiguracionPago, type ConfigPago } from "@/api/ConfiguracionPagoApi";
import { obtenerMiCuota, registrarPago } from "@/api/CuotaApi";
import type { MetodoPago } from "@/types/CuotaType";

const API = String(import.meta.env.VITE_API_URL || "").replace(/\/api\/?$/, "");
type TipoQr = "TOTAL" | "PRIMERA" | "SEGUNDA";
type FormPago = { monto: number; metodoPago: MetodoPago; montoEfectivo: number; montoQr: number; nombrePagador: string; fechaPago: string; baucher: File | null };
const formInicial = (): FormPago => ({ monto: 0, metodoPago: "QR", montoEfectivo: 0, montoQr: 0, nombrePagador: "", fechaPago: new Date().toISOString().slice(0, 10), baucher: null });

export default function MisPagosView() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["mi-cuota"], queryFn: obtenerMiCuota, retry: false });
  const configQr = useQuery({ queryKey: ["mi-configuracion-pago"], queryFn: miConfiguracionPago, retry: false, enabled: Boolean(q.data) });
  const [modalTerminos, setModalTerminos] = useState(false);
  const [tipoQr, setTipoQr] = useState<TipoQr>("PRIMERA");
  const [form, setForm] = useState<FormPago>(formInicial);
  const aceptados = Boolean(configQr.data?.terminosAceptados);
  const cuota = q.data?.cuota;
  const primeraPendiente = Boolean(cuota && cuota.montoPagado <= 0);
  const montoPrimera = cuota ? Math.min(cuota.primeraCuotaMonto ?? 300, cuota.saldo) : 0;
  const pagoPendiente = q.data?.pagos.some((p) => p.estadoRevision === "PENDIENTE") ?? false;

  useEffect(() => {
    if (!cuota) return;
    const tipo: TipoQr = cuota.montoPagado > 0 ? "SEGUNDA" : "PRIMERA";
    const monto = tipo === "PRIMERA" ? montoPrimera : cuota.saldo;
    setTipoQr(tipo);
    setForm((actual) => ({ ...actual, monto, montoQr: actual.metodoPago === "QR" ? monto : 0, montoEfectivo: actual.metodoPago === "EFECTIVO" ? monto : 0 }));
  }, [cuota?._id, cuota?.montoPagado, cuota?.saldo, montoPrimera]);

  const aceptar = useMutation({
    mutationFn: () => { const gestion = configQr.data!.configuracion.gestionId; return aceptarTerminosPago(typeof gestion === "object" ? gestion._id : String(gestion)); },
    onSuccess: async (respuesta: { message: string }) => { toast.success(respuesta.message); setModalTerminos(false); await qc.invalidateQueries({ queryKey: ["mi-configuracion-pago"] }); },
    onError: (error: Error) => toast.error(error.message),
  });
  const pagar = useMutation({
    mutationFn: () => registrarPago(cuota!._id, form),
    onSuccess: async () => { toast.success("Pago enviado. La administración revisará la información."); setForm(formInicial()); await qc.invalidateQueries({ queryKey: ["mi-cuota"] }); },
    onError: (error) => toast.error(error instanceof Error ? error.message : "No se pudo registrar"),
  });

  const seleccionarPago = (tipo: TipoQr) => {
    if (!cuota) return;
    const monto = tipo === "PRIMERA" ? montoPrimera : cuota.saldo;
    setTipoQr(tipo);
    setForm((actual) => ({ ...actual, monto, montoQr: actual.metodoPago === "QR" ? monto : 0, montoEfectivo: actual.metodoPago === "EFECTIVO" ? monto : 0 }));
  };
  const actualizarMetodo = (metodoPago: MetodoPago) => setForm((actual) => ({ ...actual, metodoPago, montoEfectivo: metodoPago === "EFECTIVO" ? actual.monto : 0, montoQr: metodoPago === "QR" ? actual.monto : 0, baucher: metodoPago === "EFECTIVO" ? null : actual.baucher }));

  if (q.isLoading) return <div className="min-h-screen bg-[#eee8dc] p-8 text-center">Cargando tu cuota...</div>;
  if (!q.data || !cuota) return <Mensaje titulo="Todavía no tienes una cuota asignada" texto="Tu preregistro debe estar aprobado y administración debe configurar las tarifas de la gestión." />;
  if (q.data.listaEspera) return <Mensaje titulo="Estás en lista de espera" texto="El plazo para pagar tu primera cuota terminó sin un pago verificado. Tu cupo fue liberado; comunícate con administración para solicitar un nuevo plazo." espera />;

  const limite = cuota.fechaVencimiento ? new Date(cuota.fechaVencimiento) : null;
  const horasRestantes = limite ? Math.max(0, Math.ceil((limite.getTime() - Date.now()) / 3600000)) : null;
  const configuracion = configQr.data?.configuracion;
  const rutaQr = tipoQr === "TOTAL" ? configuracion?.qrPagoTotal : tipoQr === "PRIMERA" ? configuracion?.qrPrimeraCuota : configuracion?.qrSegundaCuota;

  return <main className="min-h-screen bg-[#eee8dc] p-4 sm:p-8"><div className="mx-auto max-w-5xl space-y-6">
    <header className="rounded-3xl bg-[#74122A] p-6 text-white"><p className="text-xs font-bold uppercase tracking-[.25em] text-[#e9cf91]">Tinkus Puros · Estado financiero</p><h1 className="mt-2 text-3xl font-black">Mi cuota</h1><div className="mt-5 grid gap-3 sm:grid-cols-3"><Resumen titulo="Total" valor={cuota.montoTotal}/><Resumen titulo="Pagado verificado" valor={cuota.montoPagado}/><Resumen titulo="Saldo" valor={cuota.saldo}/></div><Link to="/comunicados" className="mt-5 inline-block text-sm font-bold">← Volver a comunicados</Link></header>
    <PagoLimite limite={limite} horas={horasRestantes} primeraPendiente={primeraPendiente} primera={montoPrimera} saldo={cuota.saldo}/>
    <QrPago configuracion={configuracion} aceptados={aceptados} tipo={tipoQr} seleccionar={seleccionarPago} ruta={rutaQr} primeraPendiente={primeraPendiente} primera={montoPrimera} total={cuota.montoTotal} saldo={cuota.saldo} abrirTerminos={() => setModalTerminos(true)} modal={modalTerminos} cerrar={() => setModalTerminos(false)} aceptar={() => aceptar.mutate()} procesando={aceptar.isPending}/>
    {!aceptados && cuota.saldo > 0 && <p className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-center font-bold text-amber-900">Acepta los términos y condiciones para habilitar los QR y el formulario de pago.</p>}
    {aceptados && cuota.saldo > 0 && pagoPendiente && <p className="rounded-2xl border border-blue-300 bg-blue-50 p-5 text-center font-bold text-blue-900">Tu comprobante está en revisión. Podrás registrar otro pago cuando administración lo revise.</p>}
    {aceptados && cuota.saldo > 0 && !pagoPendiente && <form onSubmit={(evento) => { evento.preventDefault(); pagar.mutate(); }} className="grid gap-4 rounded-2xl bg-white p-5 shadow-sm sm:grid-cols-2"><div className="sm:col-span-2"><h2 className="text-xl font-black text-[#74122A]">Registrar pago seleccionado</h2><p className="text-sm text-slate-500">{primeraPendiente ? "Elige la primera cuota o el pago total en los botones del QR." : "Corresponde pagar el saldo pendiente completo."}</p></div><label><Titulo>Monto seleccionado</Titulo><input readOnly value={`Bs ${form.monto.toFixed(2)}`} className="input-preregistro bg-slate-100"/></label><label><Titulo>Medio de pago</Titulo><select value={form.metodoPago} onChange={(e) => actualizarMetodo(e.target.value as MetodoPago)} className="input-preregistro"><option value="QR">QR</option><option value="EFECTIVO">Efectivo</option><option value="MIXTO">Mixto</option></select></label>{form.metodoPago === "MIXTO" && <><label><Titulo>Monto en efectivo</Titulo><input required type="number" min="0" max={form.monto} step="0.01" value={form.montoEfectivo || ""} onChange={(e) => { const efectivo = Number(e.target.value); setForm({ ...form, montoEfectivo: efectivo, montoQr: Math.max(0, form.monto - efectivo) }); }} className="input-preregistro"/></label><label><Titulo>Monto por QR</Titulo><input readOnly value={form.montoQr.toFixed(2)} className="input-preregistro bg-slate-100"/></label></>}<label><Titulo>Quién realizó el pago</Titulo><input required value={form.nombrePagador} onChange={(e) => setForm({ ...form, nombrePagador: e.target.value })} className="input-preregistro"/></label><label><Titulo>Fecha del pago</Titulo><input required type="date" value={form.fechaPago} onChange={(e) => setForm({ ...form, fechaPago: e.target.value })} className="input-preregistro"/></label>{form.metodoPago !== "EFECTIVO" && <label className="sm:col-span-2"><Titulo>Imagen del comprobante QR</Titulo><input required type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setForm({ ...form, baucher: e.target.files?.[0] ?? null })} className="input-preregistro"/><small className="text-slate-500">Se convierte automáticamente a WebP para ahorrar espacio.</small></label>}<button disabled={pagar.isPending || form.monto <= 0 || (form.metodoPago === "MIXTO" && Math.abs(form.montoEfectivo + form.montoQr - form.monto) > 0.01)} className="rounded-xl bg-[#74122A] px-5 py-3 font-bold text-white disabled:opacity-50 sm:col-span-2">{pagar.isPending ? "Enviando..." : "Enviar pago para revisión"}</button></form>}
    <section><h2 className="mb-4 text-xl font-black text-[#74122A]">Historial de pagos</h2><div className="grid gap-4 md:grid-cols-2">{q.data.pagos.map((p) => <article key={p._id} className="rounded-2xl border bg-white p-5"><div className="flex justify-between gap-3"><div><p className="text-xs text-slate-500">Pago N.º {p.numeroPago} · {p.metodoPago}</p><strong className="text-xl">Bs {p.monto.toFixed(2)}</strong></div><span className="text-xs font-bold text-[#74122A]">{p.estadoRevision}</span></div><p className="mt-2 text-sm">Pagó: {p.nombrePagador}</p><p className="text-sm">Fecha: {new Date(p.fechaPago).toLocaleDateString("es-BO")}</p>{p.baucherImagen && <a href={`${API}${p.baucherImagen}`} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-bold text-blue-700">Ver comprobante</a>}{p.observacionRevision && <p className="mt-3 rounded-lg bg-amber-50 p-2 text-sm"><strong>Observación administrativa:</strong> {p.observacionRevision}</p>}</article>)}</div>{!q.data.pagos.length && <p className="rounded-2xl bg-white p-6 text-center text-slate-500">Aún no registraste pagos.</p>}</section>
  </div></main>;
}

function Mensaje({ titulo, texto, espera = false }: { titulo: string; texto: string; espera?: boolean }) { return <main className="grid min-h-screen place-items-center bg-[#eee8dc] p-5"><section className={`max-w-xl rounded-3xl bg-white p-8 text-center shadow-xl ${espera ? "border border-amber-300" : ""}`}><div className="text-5xl">{espera ? "⏳" : "💳"}</div><h1 className="mt-4 text-3xl font-black text-[#74122A]">{titulo}</h1><p className="mt-3 text-slate-600">{texto}</p><Link to="/comunicados" className="mt-5 inline-block font-bold text-[#74122A]">← Volver a comunicados</Link></section></main>; }
function Resumen({ titulo, valor }: { titulo: string; valor: number }) { return <div className="rounded-xl bg-white/10 p-4"><p className="text-xs text-white/70">{titulo}</p><strong className="text-2xl">Bs {valor.toFixed(2)}</strong></div>; }
function PagoLimite({ limite, horas, primeraPendiente, primera, saldo }: { limite: Date | null; horas: number | null; primeraPendiente: boolean; primera: number; saldo: number }) { if (!limite || saldo <= 0) return null; return <div className={`rounded-xl p-4 font-bold ${horas === 0 ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-900"}`}>{horas === 0 ? "El plazo de pago venció. Comunícate con administración." : `Tienes aproximadamente ${horas} horas para pagar ${primeraPendiente ? `la primera cuota de Bs ${primera.toFixed(2)} o la totalidad` : `el saldo de Bs ${saldo.toFixed(2)}`}. Fecha límite: ${limite.toLocaleString("es-BO")}`}</div>; }
function Titulo({ children }: { children: React.ReactNode }) { return <span className="mb-1 block text-xs font-bold uppercase text-[#735f55]">{children}</span>; }

function QrPago({ configuracion, aceptados, tipo, seleccionar, ruta, primeraPendiente, primera, total, saldo, abrirTerminos, modal, cerrar, aceptar, procesando }: { configuracion?: ConfigPago; aceptados: boolean; tipo: TipoQr; seleccionar: (tipo: TipoQr) => void; ruta?: string; primeraPendiente: boolean; primera: number; total: number; saldo: number; abrirTerminos: () => void; modal: boolean; cerrar: () => void; aceptar: () => void; procesando: boolean }) {
  const [marcado, setMarcado] = useState(false);
  const descargar = async () => { if (!ruta) return; try { const respuesta = await fetch(`${API}${ruta}`); if (!respuesta.ok) throw new Error(); const url = URL.createObjectURL(await respuesta.blob()); const enlace = document.createElement("a"); enlace.href = url; enlace.download = `QR_${tipo}_TINKUS.webp`; enlace.click(); URL.revokeObjectURL(url); } catch { toast.error("No se pudo descargar el QR"); } };
  if (!configuracion) return null;
  const opciones: { tipo: TipoQr; texto: string }[] = primeraPendiente ? [{ tipo: "PRIMERA", texto: `Primera cuota · Bs ${primera.toFixed(2)}` }, { tipo: "TOTAL", texto: `Pago total · Bs ${total.toFixed(2)}` }] : [{ tipo: "SEGUNDA", texto: `Saldo pendiente · Bs ${saldo.toFixed(2)}` }];
  return <><section className="rounded-2xl bg-white p-5 shadow"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><h2 className="text-xl font-black text-[#74122A]">QR para realizar el pago</h2><p className="text-sm text-slate-500">Acepta los términos antes de visualizar y descargar los códigos.</p></div>{!aceptados && <button onClick={abrirTerminos} className="rounded-xl bg-[#74122A] px-5 py-3 font-bold text-white">Ver términos y habilitar QR</button>}</div>{aceptados && <div className="mt-5"><div className={`grid grid-cols-1 gap-2 ${opciones.length > 1 ? "sm:grid-cols-2" : ""}`}>{opciones.map((opcion) => <button type="button" key={opcion.tipo} onClick={() => seleccionar(opcion.tipo)} className={`rounded-xl px-3 py-3 text-sm font-bold ${tipo === opcion.tipo ? "bg-[#841534] text-white" : "bg-[#eee8dc] text-[#5d4a42]"}`}>{opcion.texto}</button>)}</div>{ruta ? <div className="mt-4 text-center"><img src={`${API}${ruta}`} alt={`QR ${tipo.toLowerCase()}`} className="mx-auto max-h-96 w-full max-w-sm object-contain"/><div className="mt-3 flex flex-wrap justify-center gap-2"><a href={`${API}${ruta}`} target="_blank" rel="noreferrer" className="rounded-xl border px-4 py-2 font-bold text-[#74122A]">Abrir QR</a><button type="button" onClick={descargar} className="rounded-xl bg-[#74122A] px-4 py-2 font-bold text-white">Descargar QR</button></div></div> : <p className="mt-4 rounded-xl bg-amber-50 p-4 text-center font-bold text-amber-800">Administración todavía no cargó este QR.</p>}</div>}</section>{modal && <div className="fixed inset-0 z-[120] grid place-items-center overflow-y-auto bg-black/65 p-3"><section className="max-h-[calc(100dvh-1.5rem)] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"><button onClick={cerrar} className="float-right grid h-10 w-10 place-items-center rounded-full bg-slate-100 font-black">✕</button><h2 className="pr-12 text-2xl font-black text-[#74122A]">Términos y condiciones de pago</h2><div className="mt-4 max-h-[45dvh] overflow-y-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">{configuracion.terminos}</div><label className="mt-4 flex items-start gap-3 rounded-xl border p-4"><input type="checkbox" checked={marcado} onChange={(e) => setMarcado(e.target.checked)} className="mt-1"/><span className="text-sm font-semibold">He leído y acepto los términos y condiciones para visualizar los QR y registrar mi pago.</span></label><div className="mt-5 grid gap-3 sm:grid-cols-2"><button onClick={cerrar} className="rounded-xl border px-4 py-3 font-bold">Cancelar</button><button onClick={() => marcado ? aceptar() : toast.error("Debes aceptar los términos y condiciones")} disabled={procesando} className="rounded-xl bg-[#74122A] px-4 py-3 font-bold text-white disabled:opacity-50">{procesando ? "Guardando..." : "Aceptar y mostrar QR"}</button></div></section></div>}</>;
}
