import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { configuracionPagoAdmin, guardarConfiguracionPago, type CampoQr, type OrigenPago, type PlanPago } from "@/api/ConfiguracionPagoApi";

const API = String(import.meta.env.VITE_API_URL || "").replace(/\/api\/?$/, "");
const planes = {
  INTERNO: { "1": [770], "2": [385, 385], "3": [300, 235, 235] },
  EXTERNO: { "1": [850], "2": [425, 425], "3": [300, 275, 275] },
} as const;
const campoQr = (origen: OrigenPago, plan: PlanPago, indice: number) => `qr${origen === "INTERNO" ? "Interno" : "Externo"}${plan}Cuota${indice + 1}` as CampoQr;

export default function ConfiguracionQrPago() {
  const cliente = useQueryClient();
  const consulta = useQuery({ queryKey: ["configuracion-pago-admin"], queryFn: configuracionPagoAdmin });
  const [terminos, setTerminos] = useState("Al realizar el pago declaro que los datos y el comprobante enviados son verdaderos. Comprendo que el pago será revisado por administración y que un comprobante inválido podrá ser observado o rechazado.");
  const [archivos, setArchivos] = useState<Partial<Record<CampoQr, File | null>>>({});
  useEffect(() => { if (consulta.data?.configuracion?.terminos) setTerminos(consulta.data.configuracion.terminos); }, [consulta.data?.configuracion?.terminos]);
  const guardar = useMutation({
    mutationFn: () => guardarConfiguracionPago({ gestionId: consulta.data!.gestion._id, terminos, archivos }),
    onSuccess: async (respuesta: { message: string }) => { toast.success(respuesta.message); setArchivos({}); await cliente.invalidateQueries({ queryKey: ["configuracion-pago-admin"] }); },
    onError: (error: Error) => toast.error(error.message),
  });
  const actual = consulta.data?.configuracion;
  return <section className="rounded-2xl border bg-white p-5 shadow-sm">
    <h2 className="text-xl font-black text-[#74122A]">QR por plan de cuotas</h2>
    <p className="mt-1 text-sm text-slate-500">Carga un QR distinto para cada importe. Puedes actualizar solo uno; los demás se conservan.</p>
    {(["INTERNO", "EXTERNO"] as OrigenPago[]).map((origen) => <div key={origen} className="mt-6">
      <h3 className="text-lg font-black text-[#74122A]">{origen === "INTERNO" ? "Internos FCPN · total Bs 770" : "Externos · total Bs 850"}</h3>
      <div className="mt-3 grid gap-4 xl:grid-cols-3">{(["1", "2", "3"] as PlanPago[]).map((plan) => <article key={plan} className="rounded-xl border bg-[#faf7f1] p-4">
        <h4 className="font-black">Plan de {plan} cuota{plan !== "1" ? "s" : ""}</h4>
        <div className="mt-3 space-y-3">{planes[origen][plan].map((monto, indice) => { const campo = campoQr(origen, plan, indice); const ruta = actual?.qrPlanes?.[origen]?.[plan]?.[indice]; return <label key={campo} className="block rounded-lg bg-white p-3">
          <span className="text-sm font-bold">Cuota {indice + 1} · Bs {monto}</span>
          {ruta ? <img src={`${API}${ruta}`} alt={`QR ${origen}, plan ${plan}, cuota ${indice + 1}`} className="mx-auto mt-2 h-28 w-28 object-contain" /> : null}
          <input type="file" accept="image/*" className="mt-2 block w-full text-xs" onChange={(evento) => setArchivos((previos) => ({ ...previos, [campo]: evento.target.files?.[0] ?? null }))} />
          <small className="mt-1 block text-slate-500">{archivos[campo]?.name ?? (ruta ? "QR configurado" : "Falta configurar")}</small>
        </label>; })}</div>
      </article>)}</div>
    </div>)}
    <label className="mt-6 block"><span className="mb-1 block text-sm font-black">Términos y condiciones</span><textarea value={terminos} onChange={(evento) => setTerminos(evento.target.value)} maxLength={5000} className="input-preregistro min-h-32" /></label>
    <button type="button" disabled={guardar.isPending || !consulta.data?.gestion} onClick={() => guardar.mutate()} className="mt-4 w-full rounded-xl bg-[#74122A] px-5 py-3 font-bold text-white disabled:opacity-50">{guardar.isPending ? "Guardando y comprimiendo QR..." : "Guardar QR por plan y términos"}</button>
  </section>;
}
