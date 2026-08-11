import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { actualizarPreregistro, obtenerPreregistroPorId } from "@/api/PreregistroApi";
import PreregistroForm from "@/components/preregistro/PreregistroForm";
import type { PreregistroFormData } from "@/types/PreregistroType";

export default function EditarPreregistroView() {
  const { preregistroId = "" } = useParams(); const navigate = useNavigate(); const location = useLocation(); const queryClient = useQueryClient();
  const rutaRetorno = (location.state as { returnTo?: string } | null)?.returnTo ?? "/preregistros";
  const [datos, setDatos] = useState<PreregistroFormData>({});
  const consulta = useQuery({ queryKey: ["preregistro", preregistroId], queryFn: () => obtenerPreregistroPorId(preregistroId), enabled: Boolean(preregistroId) });
  useEffect(() => { if (consulta.data) { const p = consulta.data; setDatos({ estado: p.estado, aceptoReglamento: p.aceptoReglamento, examen1: p.examen1, examen2: p.examen2, examen3: p.examen3, examen4: p.examen4, examen5: p.examen5, examen6: p.examen6, puntajeTotal: p.puntajeTotal, observacion: p.observacion }); } }, [consulta.data]);
  const mutation = useMutation({ mutationFn: (form: PreregistroFormData) => actualizarPreregistro({ id: preregistroId, datos: form }), onSuccess: async () => { toast.success("Preregistro actualizado"); await queryClient.invalidateQueries({ queryKey: ["preregistros"] }); navigate(rutaRetorno); }, onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo actualizar") });
  if (consulta.isLoading) return <p>Cargando preregistro...</p>;
  if (consulta.isError) return <p className="text-red-700">No se pudo cargar el preregistro.</p>;
  const usuario = consulta.data && typeof consulta.data.usuarioId === "object" ? consulta.data.usuarioId : null;
  const enviarWhatsApp = () => {
    if (!datos.observacion?.trim()) return toast.error("Escribe una observación antes de preparar el mensaje");
    const telefonoLocal = String(usuario?.telefono ?? "").replace(/\D/g, "").replace(/^0+/, "");
    if (!telefonoLocal) return toast.error("Este postulante no tiene un número de teléfono registrado");
    const telefono = telefonoLocal.startsWith("591") ? telefonoLocal : `591${telefonoLocal}`;
    const nombre = `${usuario?.nombres ?? ""} ${usuario?.apellidoPaterno ?? ""}`.trim() || "postulante";
    const mensaje = `Hola ${nombre}. Administración de Tinkus Puros y Naturales revisó tu preregistro ${consulta.data?.numeroPreRegistro}. Estado: ${(datos.estado ?? "PENDIENTE").replaceAll("_", " ")}. Observación: ${datos.observacion.trim()}. Por favor realiza la corrección indicada y comunícate con administración si tienes alguna duda.`;
    window.open(`https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`, "_blank", "noopener,noreferrer");
  };
  return <div className="mx-auto max-w-5xl space-y-5">
    <button type="button" onClick={() => navigate(-1)} className="text-sm font-bold text-[#74122A]">← Volver</button>
    <header className="overflow-hidden rounded-3xl bg-gradient-to-r from-[#741229] via-[#841534] to-[#C59A3A] p-6 text-white shadow-lg">
      <p className="text-xs font-black uppercase tracking-[.2em] text-white/70">Revisión de admisión</p>
      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-3xl font-black">{usuario ? `${usuario.nombres} ${usuario.apellidoPaterno} ${usuario.apellidoMaterno ?? ""}` : "Revisar preregistro"}</h1><p className="mt-1 text-sm text-white/80">{consulta.data?.numeroPreRegistro} · CI {usuario?.ci ?? "—"}</p></div><span className="w-fit rounded-full bg-white/15 px-4 py-2 text-sm font-black">{(datos.estado ?? "PENDIENTE").replaceAll("_", " ")}</span></div>
      <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2"><p className="rounded-xl bg-white/10 p-3"><span className="block text-xs text-white/65">Teléfono</span>{usuario?.telefono ?? "No registrado"}</p><p className="rounded-xl bg-white/10 p-3"><span className="block text-xs text-white/65">Correo</span>{usuario?.email ?? "No registrado"}</p></div>
    </header>
    <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900"><strong>Flujo recomendado:</strong> selecciona el estado, escribe una observación clara, guarda los cambios y luego prepara el mensaje por WhatsApp.</section>
    <PreregistroForm datos={datos} setDatos={setDatos} onSubmit={(e: FormEvent) => { e.preventDefault(); mutation.mutate(datos); }} cargando={mutation.isPending} esEdicion accionesSecundarias={<button type="button" onClick={enviarWhatsApp} className="rounded-xl bg-[#25D366] px-6 py-3 text-sm font-black text-white transition hover:bg-[#1eaa52]">Enviar observación por WhatsApp</button>} />
  </div>;
}
