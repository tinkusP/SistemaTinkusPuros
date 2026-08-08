import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { actualizarPreregistro, obtenerPreregistroPorId } from "@/api/PreregistroApi";
import PreregistroForm from "@/components/preregistro/PreregistroForm";
import type { PreregistroFormData } from "@/types/PreregistroType";

export default function EditarPreregistroView() {
  const { preregistroId = "" } = useParams(); const navigate = useNavigate(); const queryClient = useQueryClient();
  const [datos, setDatos] = useState<PreregistroFormData>({});
  const consulta = useQuery({ queryKey: ["preregistro", preregistroId], queryFn: () => obtenerPreregistroPorId(preregistroId), enabled: Boolean(preregistroId) });
  useEffect(() => { if (consulta.data) { const p = consulta.data; setDatos({ estado: p.estado, aceptoReglamento: p.aceptoReglamento, examen1: p.examen1, examen2: p.examen2, examen3: p.examen3, examen4: p.examen4, examen5: p.examen5, examen6: p.examen6, puntajeTotal: p.puntajeTotal, observacion: p.observacion }); } }, [consulta.data]);
  const mutation = useMutation({ mutationFn: (form: PreregistroFormData) => actualizarPreregistro({ id: preregistroId, datos: form }), onSuccess: async () => { toast.success("Preregistro actualizado"); await queryClient.invalidateQueries({ queryKey: ["preregistros"] }); navigate("/preregistros"); }, onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo actualizar") });
  if (consulta.isLoading) return <p>Cargando preregistro...</p>;
  if (consulta.isError) return <p className="text-red-700">No se pudo cargar el preregistro.</p>;
  return <div className="mx-auto max-w-4xl space-y-5"><header><button onClick={() => navigate(-1)} className="text-sm font-bold text-[#74122A]">← Volver</button><h1 className="mt-3 text-3xl font-black text-[#74122A]">Revisar preregistro</h1><p className="text-sm text-[#735f55]">{consulta.data?.numeroPreRegistro}</p></header><PreregistroForm datos={datos} setDatos={setDatos} onSubmit={(e: FormEvent) => { e.preventDefault(); mutation.mutate(datos); }} cargando={mutation.isPending} esEdicion /></div>;
}
