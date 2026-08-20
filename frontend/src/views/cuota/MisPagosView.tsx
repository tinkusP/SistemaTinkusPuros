import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { aceptarTerminosPago, miConfiguracionPago, type ConfigPago } from "@/api/ConfiguracionPagoApi";
import { elegirPlanCuotas, obtenerMiCuota, registrarPago, solicitarProrrogaPago, solicitarQrPago } from "@/api/CuotaApi";
import { fechaActualBoliviaParaInput, formatearFechaCivilCorta } from "@/utils/fechaCivil";

const API = String(import.meta.env.VITE_API_URL || "").replace(/\/api\/?$/, "");
type NumeroCuotas = 1 | 2 | 3;
type FormPago = { monto: number; metodoPago: "QR"; montoEfectivo: 0; montoQr: number; nombrePagador: string; fechaPago: string; baucher: File | null };
const formInicial = (): FormPago => ({ monto: 0, metodoPago: "QR", montoEfectivo: 0, montoQr: 0, nombrePagador: "", fechaPago: fechaActualBoliviaParaInput(), baucher: null });
const redondear = (valor: number) => Number(valor.toFixed(2));
const distribuirPlan = (total: number, numeroCuotas: NumeroCuotas) => {
  if (numeroCuotas === 1) return [redondear(total)];
  if (numeroCuotas === 2) { const primera = redondear(total / 2); return [primera, redondear(total - primera)]; }
  const primera = Math.min(300, total); const segunda = redondear((total - primera) / 2);
  return [primera, segunda, redondear(total - primera - segunda)];
};
const calcularMontoActual = (total: number, saldo: number, numeroCuotas: NumeroCuotas, pagosVerificados: number) => pagosVerificados === numeroCuotas - 1 ? redondear(saldo) : Math.min(distribuirPlan(total, numeroCuotas)[pagosVerificados] ?? redondear(saldo), redondear(saldo));

export default function MisPagosView() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["mi-cuota"], queryFn: obtenerMiCuota, retry: false });
  const configQr = useQuery({ queryKey: ["mi-configuracion-pago"], queryFn: miConfiguracionPago, retry: false, enabled: Boolean(q.data) });
  const [modalTerminos, setModalTerminos] = useState(false);
  const [modalObservacion, setModalObservacion] = useState(true);
  const [habilitarSiguientePago, setHabilitarSiguientePago] = useState(false);
  const [form, setForm] = useState<FormPago>(formInicial);
  const cuota = q.data?.cuota;
  const aceptados = Boolean(configQr.data?.terminosAceptados);
  const pagosVerificados = q.data?.pagos.filter((pago) => pago.estadoRevision === "VERIFICADO").length ?? 0;
  const pagoPendiente = q.data?.pagos.some((pago) => pago.estadoRevision === "PENDIENTE") ?? false;
  const numeroCuotas = cuota?.numeroCuotasElegidas;
  const esQrEspecial = Boolean(cuota?.qrSaldoPersonal);
  const montoActual = cuota && numeroCuotas ? (cuota.qrSaldoPersonal ? Math.min(cuota.montoQrSaldoPersonal ?? cuota.saldo, cuota.saldo) : calcularMontoActual(cuota.montoTotal, cuota.saldo, numeroCuotas, pagosVerificados)) : 0;
  const numeroPagoActual = Math.min(pagosVerificados + 1, numeroCuotas ?? 1);
  const configuracion = configQr.data?.configuracion;
  const origen = cuota?.tipoOrigenTarifa ?? (cuota?.montoTotal === 850 ? "EXTERNO" : "INTERNO");
  const montoPlanActual = cuota && numeroCuotas ? distribuirPlan(cuota.montoTotal, numeroCuotas)[numeroPagoActual - 1] : undefined;
  const requiereQrSaldo = Boolean(cuota && numeroCuotas && pagosVerificados === numeroCuotas - 1 && montoPlanActual !== undefined && Math.abs(montoActual - montoPlanActual) >= 0.01 && !esQrEspecial);
  const rutaQr = numeroCuotas && !requiereQrSaldo ? configuracion?.qrPlanes?.[origen]?.[String(numeroCuotas) as "1" | "2" | "3"]?.[numeroPagoActual - 1] : undefined;

  useEffect(() => {
    setForm((actual) => ({ ...actual, monto: montoActual, montoQr: montoActual }));
  }, [montoActual]);
  useEffect(() => { setHabilitarSiguientePago(pagosVerificados === 0 || esQrEspecial); }, [esQrEspecial, pagosVerificados]);

  const plan = useMutation({
    mutationFn: (cantidad: NumeroCuotas) => elegirPlanCuotas(cuota!._id, cantidad),
    onSuccess: async (actualizada) => {
      toast.success(`Elegiste pagar en ${actualizada.numeroCuotasElegidas} cuota(s)`);
      await qc.invalidateQueries({ queryKey: ["mi-cuota"] });
      await qc.invalidateQueries({ queryKey: ["mi-configuracion-pago"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const aceptar = useMutation({
    mutationFn: () => {
      const gestion = configQr.data!.configuracion.gestionId;
      return aceptarTerminosPago(typeof gestion === "object" ? gestion._id : String(gestion));
    },
    onSuccess: async (respuesta: { message: string }) => {
      toast.success(respuesta.message);
      setModalTerminos(false);
      await qc.invalidateQueries({ queryKey: ["mi-configuracion-pago"] });
      await qc.invalidateQueries({ queryKey: ["mi-cuota"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const pagar = useMutation({
    mutationFn: () => registrarPago(cuota!._id, form),
    onSuccess: async () => {
      toast.success("Comprobante enviado. Administración revisará el pago.");
      setForm(formInicial());
      await qc.invalidateQueries({ queryKey: ["mi-cuota"] });
      await qc.invalidateQueries({ queryKey: ["mi-configuracion-pago"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const solicitarQr = useMutation({
    mutationFn: () => {
      if (!numeroCuotas) throw new Error("Primero elige si pagarás en 1, 2 o 3 cuotas");
      return solicitarQrPago(cuota!._id, numeroCuotas, numeroPagoActual);
    },
    onSuccess: (respuesta) => toast.success(respuesta.message),
    onError: (error: Error) => toast.error(error.message),
  });
  const solicitarProrroga = useMutation({ mutationFn: () => solicitarProrrogaPago(cuota!._id), onSuccess: (respuesta) => toast.success(respuesta.message), onError: (error: Error) => toast.error(error.message) });

  if (q.isLoading) return <div className="min-h-screen bg-[#eee8dc] p-8 text-center">Cargando tu cuota...</div>;
  if (!q.data || !cuota) {
    const mensaje = q.error instanceof Error ? q.error.message : "Tu preregistro debe estar aprobado y Administración debe configurar las tarifas de la gestión.";
    const observado = /observaci[oó]n|observado/i.test(mensaje);
    return <><Mensaje titulo={observado ? "Pagos temporalmente bloqueados" : "Todavía no tienes una cuota asignada"} texto={mensaje} />{observado && modalObservacion ? <ModalObservacion cerrar={() => setModalObservacion(false)} /> : null}</>;
  }
  if (q.data.listaEspera && !q.data.prorrogaActiva) return <Mensaje titulo="Estás en lista de espera" texto="El plazo para pagar tu primera cuota terminó sin un pago verificado. Tu cupo fue liberado; comunícate con administración para solicitar un nuevo plazo." espera />;

  const limite = cuota.fechaVencimiento ? new Date(cuota.fechaVencimiento) : null;
  const horasRestantes = limite ? Math.max(0, Math.ceil((limite.getTime() - Date.now()) / 3600000)) : null;
  const mostrarSeccionQr = !q.data.plazoVencido && (habilitarSiguientePago || cuota.saldo <= 0);

  return <main className="min-h-screen bg-[#eee8dc] p-4 sm:p-8"><div className="mx-auto max-w-5xl space-y-6">
    <header className="rounded-3xl bg-[#74122A] p-6 text-white"><p className="text-xs font-bold uppercase tracking-[.25em] text-[#e9cf91]">Tinkus Puros · Estado financiero</p><h1 className="mt-2 text-3xl font-black">Mi cuota</h1><div className="mt-5 grid gap-3 sm:grid-cols-3"><Resumen titulo="Total" valor={cuota.montoTotal}/><Resumen titulo="Pagado verificado" valor={cuota.montoPagado}/><Resumen titulo="Saldo" valor={cuota.saldo}/></div><Link to="/comunicados" className="mt-5 inline-block text-sm font-bold">← Volver a comunicados</Link></header>
    {q.data.listaEspera && q.data.prorrogaActiva ? <div className="rounded-xl border border-red-300 bg-red-50 p-4 font-bold text-red-800">Administración te dio un nuevo plazo para pagar, pero tu cupo ya fue liberado y permaneces en lista de espera. El pago no recupera automáticamente el cupo.</div> : null}
    {cuota.saldo > 0 ? <div className="rounded-xl border border-orange-300 bg-orange-50 p-4 text-orange-900"><strong>Indumentaria pendiente:</strong> debes completar el pago total para recibir la polera de preentrada y la chamarra. Saldo actual: Bs {cuota.saldo.toFixed(2)}.</div> : <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 font-bold text-emerald-800">Pago total completado. Ya cumples el requisito económico para recibir la polera y chamarra.</div>}
    {q.data.plazoVencido ? <section className="rounded-2xl border border-red-300 bg-red-50 p-5 text-center text-red-900"><h2 className="text-xl font-black">Tu plazo de pago terminó</h2><p className="mt-2">Por seguridad ya no puedes ver el QR ni subir un comprobante. No realices transferencias con capturas antiguas: solicita una habilitación o acércate a administración.</p><button type="button" onClick={() => solicitarProrroga.mutate()} disabled={solicitarProrroga.isPending} className="mt-4 rounded-xl bg-[#74122A] px-6 py-3 font-bold text-white disabled:opacity-50">{solicitarProrroga.isPending ? "Enviando solicitud..." : "Solicitar nuevo plazo"}</button></section> : null}
    <PagoLimite limite={limite} horas={horasRestantes} monto={montoActual} saldo={cuota.saldo}/>
    {numeroCuotas ? <section className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="text-xl font-black text-[#74122A]">{esQrEspecial ? "Pago especial habilitado por Administración" : `Plan confirmado: ${numeroCuotas} cuota${numeroCuotas > 1 ? "s" : ""}`}</h2><p className="mt-1 text-slate-600">{esQrEspecial ? `Tienes un QR personal por Bs ${montoActual.toFixed(2)} para completar tu saldo pendiente. Debes llenar el formulario y subir el comprobante.` : `Tu elección quedó guardada y ya no puede cambiarse. Corresponde la cuota ${numeroPagoActual} de ${numeroCuotas}; si necesitas corregir el plan, comunícate con administración.`}</p></section> : <PlanCuotas total={cuota.montoTotal} seleccionado={numeroCuotas} bloqueado={pagoPendiente} guardando={plan.isPending} elegir={(cantidad) => plan.mutate(cantidad)}/>}
    {!esQrEspecial && pagosVerificados > 0 && cuota.saldo > 0 && !habilitarSiguientePago ? <section className="rounded-2xl border border-blue-300 bg-blue-50 p-5 text-center"><h2 className="text-xl font-black text-[#74122A]">Tu siguiente cuota está disponible</h2><p className="mt-2 text-blue-900">Cuota {numeroPagoActual} de {numeroCuotas}. Cuando estés listo, habilita el QR correspondiente.</p><button type="button" onClick={() => setHabilitarSiguientePago(true)} className="mt-4 rounded-xl bg-[#74122A] px-6 py-3 font-bold text-white">Quiero pagar la siguiente cuota</button></section> : null}
    {requiereQrSaldo ? <section className="rounded-2xl border border-purple-300 bg-purple-50 p-5 text-center"><h2 className="text-xl font-black text-[#74122A]">QR de saldo por Bs {montoActual.toFixed(2)}</h2><p className="mt-2 text-purple-900">Tu pago anterior fue regularizado y el saldo final cambió. Administración debe asignarte un QR individual por el importe exacto antes de que registres el comprobante.</p><button type="button" onClick={() => solicitarQr.mutate()} disabled={solicitarQr.isPending} className="mt-4 rounded-xl bg-[#74122A] px-6 py-3 font-bold text-white disabled:opacity-50">{solicitarQr.isPending ? "Solicitando..." : "Solicitar QR por el saldo"}</button></section> : mostrarSeccionQr ? <QrPago configuracion={configuracion} aceptados={aceptados} ruta={rutaQr} numeroCuotas={numeroCuotas} numeroPago={numeroPagoActual} monto={montoActual} abrirTerminos={() => setModalTerminos(true)} modal={modalTerminos} cerrar={() => setModalTerminos(false)} aceptar={() => aceptar.mutate()} procesando={aceptar.isPending} solicitar={() => solicitarQr.mutate()} solicitando={solicitarQr.isPending}/> : null}
    {aceptados && !mostrarSeccionQr && configuracion ? <TerminosAceptados configuracion={configuracion} abierto={modalTerminos} abrir={() => setModalTerminos(true)} cerrar={() => setModalTerminos(false)}/> : null}
    {!aceptados && cuota.saldo > 0 && <p className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-center font-bold text-amber-900">Acepta los términos y condiciones para habilitar el QR y el formulario de pago.</p>}
    {aceptados && cuota.saldo > 0 && pagoPendiente && <p className="rounded-2xl border border-blue-300 bg-blue-50 p-5 text-center font-bold text-blue-900">Tu comprobante está en revisión. Podrás registrar el siguiente pago cuando administración lo revise.</p>}
    {!requiereQrSaldo && !q.data.plazoVencido && habilitarSiguientePago && aceptados && numeroCuotas && rutaQr && cuota.saldo > 0 && !pagoPendiente && <form onSubmit={(evento) => { evento.preventDefault(); pagar.mutate(); }} className="grid gap-4 rounded-2xl bg-white p-5 shadow-sm sm:grid-cols-2">
      <div className="sm:col-span-2"><h2 className="text-xl font-black text-[#74122A]">{esQrEspecial ? "Registrar pago especial" : "Registrar pago de la cuota"}</h2><p className="text-sm text-slate-500">{esQrEspecial ? `Sube el comprobante del QR personal de Bs ${montoActual.toFixed(2)} asignado por Administración.` : `Este pago corresponde a la cuota ${Math.min(pagosVerificados + 1, numeroCuotas)} de ${numeroCuotas}.`}</p></div>
      <label><Titulo>Monto calculado</Titulo><input readOnly value={`Bs ${form.monto.toFixed(2)}`} className="input-preregistro bg-slate-100"/></label>
      <label><Titulo>Medio de pago</Titulo><input readOnly value="QR o depósito" className="input-preregistro bg-slate-100"/></label>
      <label><Titulo>Nombre del titular del comprobante</Titulo><input required value={form.nombrePagador} onChange={(evento) => setForm({ ...form, nombrePagador: evento.target.value })} className="input-preregistro" placeholder="Ej.: Juan Pérez"/></label>
      <label><Titulo>Fecha del pago</Titulo><input required type="date" value={form.fechaPago} onChange={(evento) => setForm({ ...form, fechaPago: evento.target.value })} className="input-preregistro"/></label>
      <label className="sm:col-span-2"><Titulo>Comprobante QR o depósito</Titulo><input required type="file" accept="image/*,application/pdf,.pdf" onChange={(evento) => setForm({ ...form, baucher: evento.target.files?.[0] ?? null })} className="input-preregistro"/><small className="text-slate-500">Acepta imágenes o PDF de hasta 30 MB. Las imágenes se convierten a WebP y los PDF se comprimen.</small></label>
      <button disabled={pagar.isPending || form.monto <= 0 || !form.baucher} className="rounded-xl bg-[#74122A] px-5 py-3 font-bold text-white disabled:opacity-50 sm:col-span-2">{pagar.isPending ? "Enviando..." : "Enviar pago para revisión"}</button>
    </form>}
    <section><h2 className="mb-4 text-xl font-black text-[#74122A]">Historial de pagos</h2><div className="grid gap-4 md:grid-cols-2">{q.data.pagos.map((pago) => { const saldoMostrado = pago.estadoRevision === "PENDIENTE" ? Math.max(0, cuota.saldo - pago.monto) : cuota.saldo; const etiquetaSaldo = pago.estadoRevision === "PENDIENTE" ? "Saldo si se aprueba" : "Saldo pendiente actual"; return <article key={pago._id} className="rounded-2xl border bg-white p-5"><div className="flex justify-between gap-3"><div><p className="text-xs text-slate-500">Pago N.º {pago.numeroPago} · QR o depósito</p><strong className="text-xl">Bs {pago.monto.toFixed(2)}</strong></div><span className="text-xs font-bold text-[#74122A]">{pago.estadoRevision}</span></div><p className="mt-2 text-sm">Titular: {pago.nombrePagador}</p><p className="text-sm">Fecha: {formatearFechaCivilCorta(pago.fechaPago)}</p><p className="mt-3 rounded-lg bg-[#f5efe4] p-3 text-sm"><strong>{etiquetaSaldo}:</strong> Bs {saldoMostrado.toFixed(2)}</p>{pago.baucherImagen && <a href={`${API}${pago.baucherImagen}`} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-bold text-blue-700">Ver comprobante</a>}{pago.observacionRevision && <p className="mt-3 rounded-lg bg-amber-50 p-2 text-sm"><strong>Observación administrativa:</strong> {pago.observacionRevision}</p>}</article>; })}</div>{!q.data.pagos.length && <p className="rounded-2xl bg-white p-6 text-center text-slate-500">Aún no registraste pagos.</p>}</section>
  </div></main>;
}

function PlanCuotas({ total, seleccionado, bloqueado, guardando, elegir }: { total: number; seleccionado?: NumeroCuotas; bloqueado: boolean; guardando: boolean; elegir: (cantidad: NumeroCuotas) => void }) {
  return <section className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="text-xl font-black text-[#74122A]">¿En cuántas cuotas pagarás?</h2><p className="mt-1 text-sm text-slate-500">Importes definidos para tu tarifa total de Bs {total.toFixed(2)}.</p><div className="mt-4 grid gap-3 sm:grid-cols-3">{([1, 2, 3] as NumeroCuotas[]).map((cantidad) => <button type="button" key={cantidad} disabled={guardando || (bloqueado && seleccionado !== cantidad)} onClick={() => elegir(cantidad)} className={`rounded-xl border p-4 text-left disabled:cursor-not-allowed disabled:opacity-50 ${seleccionado === cantidad ? "border-[#74122A] bg-[#74122A] text-white" : "bg-[#faf7f1]"}`}><strong className="block text-lg">{cantidad} cuota{cantidad > 1 ? "s" : ""}</strong><span className="text-sm">{distribuirPlan(total, cantidad).map((monto) => `Bs ${monto.toFixed(2)}`).join(" · ")}</span></button>)}</div>{bloqueado && <p className="mt-3 text-xs font-semibold text-amber-700">El plan queda bloqueado cuando envías el primer comprobante.</p>}</section>;
}

function QrPago({ configuracion, aceptados, ruta, numeroCuotas, numeroPago, monto, abrirTerminos, modal, cerrar, aceptar, procesando, solicitar, solicitando }: { configuracion?: ConfigPago; aceptados: boolean; ruta?: string; numeroCuotas?: NumeroCuotas; numeroPago: number; monto: number; abrirTerminos: () => void; modal: boolean; cerrar: () => void; aceptar: () => void; procesando: boolean; solicitar: () => void; solicitando: boolean }) {
  const [marcado, setMarcado] = useState(false);
  const descargar = async () => { if (!ruta) return; try { const respuesta = await fetch(`${API}${ruta}`); if (!respuesta.ok) throw new Error(); const url = URL.createObjectURL(await respuesta.blob()); const enlace = document.createElement("a"); enlace.href = url; enlace.download = `QR_CUOTA_${numeroPago}_TINKUS.webp`; enlace.click(); URL.revokeObjectURL(url); } catch { toast.error("No se pudo descargar el QR"); } };
  if (!configuracion) return <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-center"><p className="font-bold text-amber-900">Administración todavía no configuró los QR de esta gestión.</p><p className="mt-1 text-sm text-amber-800">Envía una solicitud para que administración cargue el QR o los datos de depósito.</p><button type="button" onClick={solicitar} disabled={solicitando} className="mt-3 rounded-xl bg-[#74122A] px-5 py-3 font-bold text-white disabled:opacity-50">{solicitando ? "Notificando..." : "Solicitar QR a administración"}</button></section>;
  return <><section className="rounded-2xl bg-white p-5 shadow"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><h2 className="text-xl font-black text-[#74122A]">QR o depósito bancario</h2><p className="text-sm text-slate-500">Primero elige tu plan y acepta los términos para visualizar el código de pago.</p></div><button type="button" onClick={abrirTerminos} className={`rounded-xl px-5 py-3 font-bold ${aceptados ? "border border-[#74122A] bg-white text-[#74122A]" : "bg-[#74122A] text-white"}`}>{aceptados ? "Ver términos aceptados" : "Ver términos y habilitar QR"}</button></div>{aceptados && !numeroCuotas && <p className="mt-4 rounded-xl bg-blue-50 p-4 text-center font-bold text-blue-800">Elige arriba si pagarás en 1, 2 o 3 cuotas.</p>}{aceptados && numeroCuotas && (ruta ? <div className="mt-5 text-center"><p className="mb-3 font-bold text-[#74122A]">Importe de esta cuota: Bs {monto.toFixed(2)}</p><img src={`${API}${ruta}`} alt="QR o datos para depósito" className="mx-auto max-h-96 w-full max-w-sm object-contain"/><div className="mt-3 flex flex-wrap justify-center gap-2"><a href={`${API}${ruta}`} target="_blank" rel="noreferrer" className="rounded-xl border px-4 py-2 font-bold text-[#74122A]">Abrir QR</a><button type="button" onClick={descargar} className="rounded-xl bg-[#74122A] px-4 py-2 font-bold text-white">Descargar QR</button></div></div> : <div className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-5 text-center"><p className="font-bold text-amber-900">No hay un QR disponible para este pago.</p><p className="mt-1 text-sm text-amber-800">Puedes avisar ahora mismo a administración para que cargue el código correspondiente.</p><button type="button" onClick={solicitar} disabled={solicitando} className="mt-3 rounded-xl bg-[#74122A] px-5 py-3 font-bold text-white disabled:opacity-50">{solicitando ? "Notificando..." : "Solicitar QR a administración"}</button></div>)}</section>{modal && <div className="fixed inset-0 z-[120] grid place-items-center overflow-y-auto bg-black/65 p-3"><section className="max-h-[calc(100dvh-1.5rem)] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"><button type="button" onClick={cerrar} aria-label="Cerrar términos" className="float-right grid h-10 w-10 place-items-center rounded-full bg-slate-100 font-black">✕</button><h2 className="pr-12 text-2xl font-black text-[#74122A]">{aceptados ? "Términos y condiciones aceptados" : "Términos y condiciones de pago"}</h2>{aceptados && <p className="mt-2 text-sm font-semibold text-emerald-700">Estos términos ya fueron aceptados y se muestran únicamente para consulta.</p>}<div className="mt-4 max-h-[45dvh] overflow-y-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">{configuracion.terminos}</div>{aceptados ? <button type="button" onClick={cerrar} className="mt-5 w-full rounded-xl bg-[#74122A] px-4 py-3 font-bold text-white">Cerrar</button> : <><label className="mt-4 flex items-start gap-3 rounded-xl border p-4"><input type="checkbox" checked={marcado} onChange={(evento) => setMarcado(evento.target.checked)} className="mt-1"/><span className="text-sm font-semibold">He leído y acepto los términos y condiciones para visualizar los QR y registrar mi pago.</span></label><div className="mt-5 grid gap-3 sm:grid-cols-2"><button type="button" onClick={cerrar} className="rounded-xl border px-4 py-3 font-bold">Cancelar</button><button type="button" onClick={() => marcado ? aceptar() : toast.error("Debes aceptar los términos y condiciones")} disabled={procesando} className="rounded-xl bg-[#74122A] px-4 py-3 font-bold text-white disabled:opacity-50">{procesando ? "Guardando..." : "Aceptar y mostrar QR"}</button></div></>}</section></div>}</>;
}

function TerminosAceptados({ configuracion, abierto, abrir, cerrar }: { configuracion: ConfigPago; abierto: boolean; abrir: () => void; cerrar: () => void }) {
  return <><section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-black text-[#74122A]">Términos y condiciones</h2><p className="mt-1 text-sm text-emerald-700">Ya aceptaste los términos de esta gestión. Puedes consultarlos cuando quieras.</p><button type="button" onClick={abrir} className="mt-4 rounded-xl border border-[#74122A] px-5 py-3 font-bold text-[#74122A]">Ver términos aceptados</button></section>{abierto && <div className="fixed inset-0 z-[120] grid place-items-center overflow-y-auto bg-black/65 p-3"><section className="max-h-[calc(100dvh-1.5rem)] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"><button type="button" onClick={cerrar} aria-label="Cerrar términos" className="float-right grid h-10 w-10 place-items-center rounded-full bg-slate-100 font-black">✕</button><h2 className="pr-12 text-2xl font-black text-[#74122A]">Términos y condiciones aceptados</h2><p className="mt-2 text-sm font-semibold text-emerald-700">Contenido de solo lectura.</p><div className="mt-4 max-h-[55dvh] overflow-y-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">{configuracion.terminos}</div><button type="button" onClick={cerrar} className="mt-5 w-full rounded-xl bg-[#74122A] px-4 py-3 font-bold text-white">Cerrar</button></section></div>}</>;
}

function Mensaje({ titulo, texto, espera = false }: { titulo: string; texto: string; espera?: boolean }) { return <main className="grid min-h-screen place-items-center bg-[#eee8dc] p-5"><section className={`max-w-xl rounded-3xl bg-white p-8 text-center shadow-xl ${espera ? "border border-amber-300" : ""}`}><div className="text-5xl">{espera ? "⏳" : "💳"}</div><h1 className="mt-4 text-3xl font-black text-[#74122A]">{titulo}</h1><p className="mt-3 text-slate-600">{texto}</p><Link to="/comunicados" className="mt-5 inline-block font-bold text-[#74122A]">← Volver a comunicados</Link></section></main>; }
function Resumen({ titulo, valor }: { titulo: string; valor: number }) { return <div className="rounded-xl bg-white/10 p-4"><p className="text-xs text-white/70">{titulo}</p><strong className="text-2xl">Bs {valor.toFixed(2)}</strong></div>; }
function PagoLimite({ limite, horas, monto, saldo }: { limite: Date | null; horas: number | null; monto: number; saldo: number }) { if (!limite || saldo <= 0) return null; return <div className={`rounded-xl p-4 font-bold ${horas === 0 ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-900"}`}>{horas === 0 ? "El plazo de pago venció. Comunícate con administración." : `Tienes aproximadamente ${horas} horas para realizar tu próximo pago${monto > 0 ? ` de Bs ${monto.toFixed(2)}` : ""}. Fecha límite: ${limite.toLocaleString("es-BO")}`}</div>; }
function Titulo({ children }: { children: React.ReactNode }) { return <span className="mb-1 block text-xs font-bold uppercase text-[#735f55]">{children}</span>; }

function ModalObservacion({ cerrar }: { cerrar: () => void }) {
  return <div className="fixed inset-0 z-[150] grid place-items-center bg-[#24181c]/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="titulo-observacion"><section className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl"><div className="bg-[#74122A] px-6 py-5 text-white"><div className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-[#C59A3A] text-3xl" aria-hidden="true">!</div><h1 id="titulo-observacion" className="text-2xl font-black">Tienes una observación pendiente</h1></div><div className="p-6"><p className="leading-7 text-slate-700">Tu preregistro requiere una regularización. Comunícate con Administración para resolver la observación. Cuando tu preregistro sea aprobado, la opción de pagos se habilitará automáticamente.</p><div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">Mientras la observación continúe pendiente no podrás elegir un plan, ver el QR ni registrar comprobantes de pago.</div><div className="mt-6 grid gap-3 sm:grid-cols-2"><Link to="/mis-preregistros" className="rounded-xl bg-[#74122A] px-4 py-3 text-center font-bold text-white">Ver mi preregistro</Link><button type="button" onClick={cerrar} className="rounded-xl border border-slate-300 px-4 py-3 font-bold text-slate-700">Entendido</button></div></div></section></div>;
}
