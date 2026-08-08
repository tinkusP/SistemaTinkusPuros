type Props = { usuario?: { nombres?: string; apellidoPaterno?: string; apellidoMaterno?: string | null; fotoPerfil?: string | null } | null; className?: string };
export default function UsuarioMiniatura({ usuario, className = "h-10 w-10" }: Props) {
  const nombre = [usuario?.nombres, usuario?.apellidoPaterno, usuario?.apellidoMaterno].filter(Boolean).join(" ").trim();
  const iniciales = nombre.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join("").toUpperCase() || "US";
  const ruta = usuario?.fotoPerfil;
  const src = ruta ? (ruta.startsWith("http") ? ruta : `${String(import.meta.env.VITE_API_URL || "").replace(/\/api\/?$/, "")}${ruta}`) : "";
  return <span className={`grid shrink-0 place-items-center overflow-hidden rounded-full border-2 border-[#C59A3A] bg-[#f3ead7] text-xs font-black text-[#841534] ${className}`}>{src ? <img src={src} alt={`Foto de ${nombre || "usuario"}`} loading="lazy" className="h-full w-full object-cover" /> : iniciales}</span>;
}
