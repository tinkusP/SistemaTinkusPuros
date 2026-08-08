import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { crearPreregistro } from "@/api/PreregistroApi";
import PreregistroForm from "@/components/preregistro/PreregistroForm";
import type { PreregistroFormData } from "@/types/PreregistroType";

export default function CrearPreregistroView() {
  const navigate = useNavigate(); const queryClient = useQueryClient();
  const [datos, setDatos] = useState<PreregistroFormData>({ aceptoReglamento: false });
  const mutation = useMutation({ mutationFn: crearPreregistro, onSuccess: async () => { toast.success("Preregistro creado correctamente"); await queryClient.invalidateQueries({ queryKey: ["preregistros"] }); navigate("/preregistros"); }, onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo crear") });
  const guardar = (e: FormEvent) => { e.preventDefault(); mutation.mutate(datos); };
  return <div className="mx-auto max-w-4xl space-y-5"><header><button onClick={() => navigate(-1)} className="text-sm font-bold text-[#74122A]">← Volver</button><h1 className="mt-3 text-3xl font-black text-[#74122A]">Nuevo preregistro</h1><p className="text-sm text-[#735f55]">También se genera automáticamente al activar un postulante.</p></header><PreregistroForm datos={datos} setDatos={setDatos} onSubmit={guardar} cargando={mutation.isPending} /></div>;
}
