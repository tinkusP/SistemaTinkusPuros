import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "@/hooks/useAuth";
import { updatePasswordPerfilUsuario } from "@/api/PerfilUsuarioApi";

export default function CambiarPasswordObligatorioView() {
  const { data: usuario, isLoading } = useAuth(); const navigate=useNavigate(); const qc=useQueryClient();
  const [actual,setActual]=useState(""); const [nueva,setNueva]=useState(""); const [confirmar,setConfirmar]=useState("");
  const mutation=useMutation({mutationFn:()=>updatePasswordPerfilUsuario({id:usuario!._id,passwordActual:actual,passwordNueva:nueva}),onSuccess:async r=>{toast.success(r.message);await qc.invalidateQueries({queryKey:["usuario"]});navigate("/comunicados",{replace:true});},onError:e=>toast.error(e instanceof Error?e.message:"No se pudo cambiar la contraseña")});
  if(isLoading||!usuario)return <div className="grid min-h-screen place-items-center">Cargando...</div>;
  return <main className="grid min-h-screen place-items-center bg-[#eee8dc] p-4"><form onSubmit={e=>{e.preventDefault();if(nueva!==confirmar)return toast.error("Las contraseñas nuevas no coinciden");mutation.mutate();}} className="w-full max-w-md space-y-4 rounded-3xl bg-white p-7 shadow-xl"><div><p className="text-xs font-bold uppercase tracking-widest text-[#C59A3A]">Seguridad obligatoria</p><h1 className="mt-2 text-2xl font-black text-[#841534]">Cambia tu contraseña temporal</h1><p className="mt-2 text-sm text-slate-500">Antes de continuar debes crear una contraseña personal de al menos 8 caracteres.</p></div><label className="block text-sm font-bold">Contraseña temporal<input type="password" required value={actual} onChange={e=>setActual(e.target.value)} className="mt-1 w-full rounded-xl border p-3" /></label><label className="block text-sm font-bold">Nueva contraseña<input type="password" required minLength={8} value={nueva} onChange={e=>setNueva(e.target.value)} className="mt-1 w-full rounded-xl border p-3" /></label><label className="block text-sm font-bold">Confirmar nueva contraseña<input type="password" required minLength={8} value={confirmar} onChange={e=>setConfirmar(e.target.value)} className="mt-1 w-full rounded-xl border p-3" /></label><button disabled={mutation.isPending} className="w-full rounded-xl bg-[#841534] p-3 font-bold text-white disabled:opacity-50">{mutation.isPending?"Actualizando...":"Guardar nueva contraseña"}</button></form></main>;
}
