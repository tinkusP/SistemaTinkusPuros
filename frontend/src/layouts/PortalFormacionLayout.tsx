import { Link, Navigate, Outlet, useLocation } from "react-router-dom";
import { BookOpenText, ChevronLeft, Footprints, Home, Music2 } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { useAuth } from "@/hooks/useAuth";
import { obtenerVistaCapacitacion } from "@/utils/modoCapacitacion";

export default function PortalFormacionLayout() {
  const { data: usuario, isLoading, isError } = useAuth();
  const location = useLocation();

  if (isLoading) return <div className="grid min-h-screen place-items-center bg-[#eee8dc] font-bold text-[#74122A]">Preparando tu biblioteca…</div>;
  if (isError || !usuario) return <Navigate to="/auth/login" replace />;
  if (usuario.requiereCambioPassword && !obtenerVistaCapacitacion()) return <Navigate to="/cambiar-password-obligatorio" replace />;

  const esCancionero = location.pathname === "/mi-cancionero";
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(197,154,58,.18),transparent_28%),linear-gradient(180deg,#f5f0e6_0%,#eee8dc_100%)] text-[#2b2023] dark:bg-[radial-gradient(circle_at_top_right,rgba(197,154,58,.12),transparent_25%),linear-gradient(180deg,#21191c_0%,#171214_100%)] dark:text-[#F6F0E3]">
      <header className="sticky top-0 z-40 border-t-4 border-[#C59A3A] bg-[#74122A]/95 text-white shadow-xl backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link to="/comunicados" className="flex items-center gap-3 font-black"><span className="grid h-10 w-10 place-items-center rounded-full bg-[#F6F0E3] text-[#74122A]"><Home size={19} /></span><span className="hidden sm:block">Mi portal Tinkus</span></Link>
          <nav aria-label="Biblioteca del postulante" className="flex rounded-2xl bg-black/15 p-1">
            <Link to="/mis-pasos" className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition ${!esCancionero ? "bg-[#C59A3A] text-[#24181c] shadow" : "hover:bg-white/10"}`}><Footprints size={17} /> Pasos</Link>
            <Link to="/mi-cancionero" className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition ${esCancionero ? "bg-[#C59A3A] text-[#24181c] shadow" : "hover:bg-white/10"}`}><Music2 size={17} /> Cancionero</Link>
          </nav>
          <ThemeToggle />
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#C59A3A]/35 bg-white/75 px-4 py-3 shadow-sm backdrop-blur dark:bg-[#2a2023]/80">
          <Link to="/comunicados" className="flex items-center gap-2 text-sm font-bold text-[#74122A] dark:text-[#e9cf91]"><ChevronLeft size={18} /> Volver a mi panel</Link>
          <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-[#8F5F2A]"><BookOpenText size={17} /> Espacio de aprendizaje</span>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
