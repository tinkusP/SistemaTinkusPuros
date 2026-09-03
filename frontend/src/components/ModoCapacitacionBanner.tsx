import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { EVENTO_CAPACITACION, obtenerVistaCapacitacion, salirVistaCapacitacion, type VistaCapacitacion } from "@/utils/modoCapacitacion";

export default function ModoCapacitacionBanner() {
  const [vista, setVista] = useState<VistaCapacitacion | null>(() => obtenerVistaCapacitacion());
  const cliente = useQueryClient();
  const navigate = useNavigate();
  useEffect(() => {
    const actualizar = () => setVista(obtenerVistaCapacitacion());
    window.addEventListener(EVENTO_CAPACITACION, actualizar);
    window.addEventListener("storage", actualizar);
    return () => { window.removeEventListener(EVENTO_CAPACITACION, actualizar); window.removeEventListener("storage", actualizar); };
  }, []);
  if (!vista) return null;
  const salir = async () => {
    salirVistaCapacitacion();
    await cliente.invalidateQueries({ queryKey: ["usuario"] });
    navigate("/modo-capacitacion", { replace: true });
  };
  return <aside className="sticky top-0 z-[300] border-b-4 border-amber-300 bg-slate-950 px-4 py-3 text-white shadow-xl"><div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 sm:flex-row"><div><p className="text-xs font-black uppercase tracking-[.18em] text-amber-300">Modo vista previa de {vista.tipo === "GUIA" ? "guía" : "fraterno"}</p><p className="font-bold">Estás viendo el sistema como: {vista.nombre}</p><p className="text-xs text-slate-300">Modo demostrativo: todas las modificaciones están bloqueadas.</p></div><button onClick={()=>void salir()} className="rounded-xl bg-amber-400 px-4 py-2 font-black text-slate-950">Salir de vista previa</button></div></aside>;
}
