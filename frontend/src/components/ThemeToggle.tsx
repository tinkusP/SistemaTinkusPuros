import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const CLAVE_TEMA = "TINKUS_TEMA";

function obtenerTemaInicial() {
  const guardado = localStorage.getItem(CLAVE_TEMA);
  if (guardado === "oscuro") return true;
  if (guardado === "claro") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export default function ThemeToggle({ className = "" }: { className?: string }) {
  const [oscuro, setOscuro] = useState(obtenerTemaInicial);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", oscuro);
    localStorage.setItem(CLAVE_TEMA, oscuro ? "oscuro" : "claro");
  }, [oscuro]);

  return (
    <button
      type="button"
      aria-label={oscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      title={oscuro ? "Modo claro" : "Modo oscuro"}
      aria-pressed={oscuro}
      onClick={() => setOscuro((actual) => !actual)}
      className={`inline-flex h-11 items-center gap-2 rounded-xl border border-[#B7A7A0] bg-[#F6F0E3] px-3 text-sm font-bold text-[#262022] shadow-sm transition hover:border-[#C59A3A] hover:bg-white dark:border-white/20 dark:bg-[#352d30] dark:text-[#F6F0E3] dark:hover:bg-[#44383c] ${className}`}
    >
      {oscuro ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
      <span className="hidden xl:inline">{oscuro ? "Claro" : "Oscuro"}</span>
    </button>
  );
}
