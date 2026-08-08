import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { actualizarPreregistro, crearPreregistro } from "@/api/PreregistroApi";
import { ESTADOS_PREREGISTRO, type EstadoPreregistro } from "@/types/PreregistroType";

export default function AsignarEstadoPreregistroModal({ usuarioId, nombre, telefono, cerrar, completado }: { usuarioId: string; nombre: string; telefono?: string | null; cerrar: () => void; completado?: (estado: EstadoPreregistro) => void }) {
  const queryClient = useQueryClient();
  const [estado, setEstado] = useState<EstadoPreregistro>("APROBADO");
  const [observacion, setObservacion] = useState("");
  const [resultado, setResultado] = useState<{ tipo: "ok" | "error"; mensaje: string; estado?: EstadoPreregistro } | null>(null);
  const numeroWhatsApp = (() => {
    const digitos = String(telefono ?? "").replace(/\D/g, "");
    if (!digitos) return "";
    if (digitos.startsWith("591")) return digitos;
    return digitos.length === 8 ? `591${digitos}` : digitos;
  })();
  const abrirWhatsApp = () => {
    if (!numeroWhatsApp || !observacion.trim()) return;
    const mensaje = [
      `Hola ${nombre},`,
      "Tu registro en el sistema Tinkus fue observado por administración.",
      `Observación: ${observacion.trim()}`,
      "Por favor, regulariza o corrige tus datos con un administrador para continuar con el proceso.",
    ].join("\n\n");
    window.open(`https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent(mensaje)}`, "_blank", "noopener,noreferrer");
  };
  const finalizar = () => {
    if (resultado?.tipo === "ok" && resultado.estado) completado?.(resultado.estado);
    cerrar();
  };
  const guardar = useMutation({
    mutationFn: async () => {
      if (["OBSERVADO", "RECHAZADO", "LISTA_ESPERA", "CANCELADO"].includes(estado) && !observacion.trim()) {
        throw new Error("Debe escribir una observación o el motivo de la decisión");
      }
      const preregistro = await crearPreregistro({ usuarioId });
      return actualizarPreregistro({ id: preregistro._id, datos: { estado, observacion: observacion.trim() } });
    },
    onSuccess: async () => { setResultado({ tipo: "ok", estado, mensaje: `El preregistro fue asignado como ${estado.replace("_", " ")}. El postulante verá esta decisión y su observación.` }); await Promise.all([queryClient.invalidateQueries({ queryKey: ["preregistros"] }), queryClient.invalidateQueries({ queryKey: ["mis-preregistros"] })]); },
    onError: (error) => setResultado({ tipo: "error", mensaje: error.message }),
  });
  return <div className="fixed inset-0 z-[130] grid place-items-center bg-[#21181b]/70 p-4" role="dialog" aria-modal="true"><section className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl"><header className="flex items-center justify-between bg-gradient-to-r from-[#841534] to-[#C59A3A] p-5 text-white"><div><p className="text-xs uppercase tracking-[.18em]">Perfil activado</p><h2 className="text-xl font-black">Asignar estado del preregistro</h2></div>{resultado?.tipo === "ok" && <button onClick={finalizar} className="text-2xl" aria-label="Cerrar">×</button>}</header><div className="space-y-5 p-6"><p className="text-sm text-slate-600">Seleccione cómo continuará <strong>{nombre}</strong> en el proceso de admisión. La cuenta ya puede ingresar, pero esta decisión define el estado que verá.</p>{resultado && <div className={`rounded-xl p-4 text-sm font-semibold ${resultado.tipo === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{resultado.mensaje}</div>}<div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{ESTADOS_PREREGISTRO.map((opcion) => <button type="button" key={opcion} onClick={() => setEstado(opcion)} className={`rounded-xl border px-3 py-3 text-xs font-bold ${estado === opcion ? "border-[#841534] bg-[#841534] text-white" : "border-[#d8cbbb] bg-[#faf7f1] text-[#5d4a42]"}`}>{opcion.replace("_", " ")}</button>)}</div><textarea value={observacion} onChange={(e) => setObservacion(e.target.value)} maxLength={1000} className="input-preregistro min-h-28 w-full" placeholder={["OBSERVADO","RECHAZADO","LISTA_ESPERA","CANCELADO"].includes(estado) ? "Motivo obligatorio. Ej.: el CI no coincide con el documento..." : "Observación opcional para el postulante..."}/>{resultado?.tipo === "ok" && resultado.estado === "OBSERVADO" && (numeroWhatsApp ? <button type="button" onClick={abrirWhatsApp} className="w-full rounded-xl bg-[#25D366] px-5 py-3 font-black text-white">Enviar observación por WhatsApp · {telefono}</button> : <p className="rounded-xl bg-amber-50 p-4 text-sm font-semibold text-amber-800">No se puede abrir WhatsApp porque este usuario no tiene un teléfono registrado.</p>)}<div className="flex justify-end gap-3">{resultado?.tipo === "ok" ? <button onClick={finalizar} className="rounded-xl border px-5 py-3 font-bold">Continuar</button> : <button disabled={guardar.isPending} onClick={() => guardar.mutate()} className="rounded-xl bg-[#841534] px-5 py-3 font-bold text-white disabled:opacity-50">{guardar.isPending ? "Guardando..." : "Guardar decisión"}</button>}</div></div></section></div>;
}
