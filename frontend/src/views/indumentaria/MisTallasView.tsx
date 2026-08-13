import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { obtenerMiIndumentaria } from "@/api/IndumentariaApi";

export default function MisTallasView() {
  const consulta = useQuery({ queryKey: ["mi-indumentaria"], queryFn: obtenerMiIndumentaria });
  if (consulta.isLoading) return <p className="p-8 text-center">Consultando tus tallas...</p>;
  const talla = consulta.data?.talla;
  const pago = consulta.data?.pago;
  return <main className="min-h-screen bg-[#eee8dc] p-5 dark:bg-[#1f1a1c]">
    <section className="mx-auto max-w-xl rounded-3xl bg-white p-7 shadow dark:bg-[#332B2E]">
      <p className="text-xs font-black uppercase tracking-widest text-[#8F5F2A]">Consulta personal</p>
      <h1 className="mt-1 text-3xl font-black text-[#74122A] dark:text-[#e9cf91]">Mis tallas</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-300">Administración registra las tallas después de verificar tu identidad. Aquí puedes consultarlas, pero no modificarlas.</p>
      {talla ? <div className="mt-6 grid gap-4 sm:grid-cols-2"><Talla nombre="Polera" valor={talla.tallaPolera}/><Talla nombre="Chamarra" valor={talla.tallaChamarra}/></div> : <p className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 font-bold text-amber-900">{pago?.primeraCuotaVerificada ? "Tus tallas todavía no fueron registradas. Acércate a un administrador y presenta tu QR." : "Tus tallas todavía no fueron registradas. Acércate a un administrador o completa el pago verificado de tu primera cuota."}</p>}
      <p className="mt-5 rounded-xl bg-blue-50 p-4 text-sm font-semibold text-blue-900">Si alguna talla es incorrecta, solicita a un administrador que escanee nuevamente tu QR y realice la corrección.</p>
      <Link to="/comunicados" className="mt-5 block text-center font-bold text-[#74122A] dark:text-[#e9cf91]">← Volver</Link>
    </section>
  </main>;
}

function Talla({ nombre, valor }: { nombre: string; valor: string }) { return <article className="rounded-2xl border border-[#C59A3A]/50 bg-[#C59A3A]/10 p-5 text-center"><p className="text-xs font-black uppercase tracking-widest text-[#8F5F2A]">{nombre}</p><strong className="mt-2 block text-4xl text-[#74122A] dark:text-[#e9cf91]">{valor}</strong></article>; }
