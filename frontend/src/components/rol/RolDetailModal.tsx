import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { obtenerRolPorId } from "@/api/RolApi";

type RolDetailModalProps = {
  rolId: string | null;
  abierto: boolean;
  onCerrar: () => void;
};

type PermisoVista = { _id?: string; nombre?: string; codigo?: string; modulo?: string | null };

export default function RolDetailModal({ rolId, abierto, onCerrar }: RolDetailModalProps) {
  const { data: rol, isLoading, isError, error } = useQuery({
    queryKey: ["rol", rolId],
    queryFn: () => obtenerRolPorId(rolId!),
    enabled: abierto && Boolean(rolId),
  });

  useEffect(() => {
    if (!abierto) return;
    const cerrar = (event: KeyboardEvent) => event.key === "Escape" && onCerrar();
    document.addEventListener("keydown", cerrar);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", cerrar);
      document.body.style.overflow = "";
    };
  }, [abierto, onCerrar]);

  if (!abierto || !rolId) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] grid place-items-center bg-[#262022]/70 p-4 backdrop-blur-sm">
      <button type="button" aria-label="Cerrar modal" onClick={onCerrar} className="absolute inset-0" />
      <section role="dialog" aria-modal="true" className="relative z-10 max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-[#B7A7A0] bg-[#F6F0E3] shadow-2xl dark:border-[#B7A7A0]/30 dark:bg-[#262022]">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[#B7A7A0]/40 bg-[#F6F0E3]/95 px-5 py-4 backdrop-blur dark:bg-[#262022]/95">
          <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#74122A] dark:text-[#C59A3A]">Detalle</p><h2 className="text-xl font-black">Información del rol</h2></div>
          <button type="button" onClick={onCerrar} className="grid h-10 w-10 place-items-center rounded-xl text-lg text-[#B7A7A0] hover:bg-[#74122A] hover:text-[#F6F0E3]">✕</button>
        </header>

        <div className="p-5 sm:p-6">
          {isLoading && <div className="rounded-2xl bg-[#B7A7A0]/15 p-6 text-center text-sm text-[#B7A7A0]">Cargando rol...</div>}
          {isError && <div className="rounded-2xl border border-[#74122A]/30 bg-[#74122A]/10 p-5 text-sm text-[#74122A]">{error instanceof Error ? error.message : "No se pudo cargar el rol"}</div>}
          {rol && (
            <div className="space-y-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div><h3 className="text-2xl font-black">{rol.nombre}</h3><p className="mt-1 font-mono text-sm font-bold text-[#74122A] dark:text-[#C59A3A]">{rol.codigo}</p></div>
                <div className="flex flex-wrap gap-2"><span className={`rounded-full px-3 py-1 text-xs font-bold ${rol.estado ? "bg-green-100 text-green-700" : "bg-[#B7A7A0]/20 text-[#262022]"}`}>{rol.estado ? "ACTIVO" : "INACTIVO"}</span>{rol.esRolSistema && <span className="rounded-full bg-[#C59A3A]/20 px-3 py-1 text-xs font-bold text-[#74122A]">ROL DEL SISTEMA</span>}</div>
              </div>

              <div className="rounded-2xl border border-[#B7A7A0]/60 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-[#B7A7A0]">Descripción</p><p className="mt-2 text-sm leading-6">{rol.descripcion || "Sin descripción registrada."}</p></div>

              <div>
                <div className="flex items-center justify-between"><h3 className="text-lg font-black">Permisos</h3><span className="rounded-full bg-[#74122A]/10 px-3 py-1 text-xs font-bold text-[#74122A] dark:text-[#C59A3A]">{(rol.permisos || []).length} asignados</span></div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {(rol.permisos || []).map((permiso, indice) => {
                    const objeto = typeof permiso === "object" && permiso !== null ? (permiso as PermisoVista) : null;
                    return <div key={objeto?._id || objeto?.codigo || String(permiso) || indice} className="rounded-2xl border border-[#B7A7A0]/60 p-4"><p className="text-sm font-bold">{objeto?.nombre || objeto?.codigo || String(permiso)}</p>{objeto?.codigo && <p className="mt-1 text-xs font-semibold text-[#74122A] dark:text-[#C59A3A]">{objeto.codigo}</p>}{objeto?.modulo && <p className="mt-2 text-xs text-[#B7A7A0]">Módulo: {objeto.modulo}</p>}</div>;
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>,
    document.body,
  );
}