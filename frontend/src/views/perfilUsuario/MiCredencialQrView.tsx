import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import QRCode from "qrcode";
import { miCredencialQr } from "@/api/CredencialQrApi";

export default function MiCredencialQrView() {
  const q = useQuery({ queryKey: ["mi-credencial-qr"], queryFn: miCredencialQr, refetchInterval: 10000, refetchOnWindowFocus: true });
  const [imagen, setImagen] = useState("");
  useEffect(() => { if (q.data?.token) QRCode.toDataURL(q.data.token, { width: 900, margin: 3, errorCorrectionLevel: "H", color: { dark: "#21181b", light: "#ffffff" } }).then(setImagen); }, [q.data?.token]);
  const descargar = () => { if (!imagen) return; const a = document.createElement("a"); a.href = imagen; a.download = `CREDENCIAL_QR_${q.data?.ci}.png`; a.click(); };
  return <main className="min-h-screen bg-[#eee8dc] p-4 sm:p-8"><section className="mx-auto max-w-xl rounded-3xl bg-white p-6 text-center shadow"><p className="text-xs font-bold uppercase tracking-widest text-[#8F5F2A]">Credencial digital de un solo uso</p><h1 className="text-3xl font-black text-[#74122A]">Mi código QR</h1><p className="mt-2 text-sm text-slate-500">Preséntalo personalmente. Después de marcar asistencia este código se invalida y aquí aparecerá uno nuevo.</p>{q.isLoading ? <p className="p-10">Generando...</p> : q.isError ? <p className="mt-6 rounded-xl bg-red-50 p-4 text-red-700">{q.error.message}</p> : <><img src={imagen} alt="Mi credencial QR" className="mx-auto mt-5 w-full max-w-sm"/><h2 className="text-xl font-black">{q.data?.nombre}</h2><p>CI {q.data?.ci}</p><p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">QR vigente por 24 horas o hasta registrar asistencia. No lo compartas.</p><button onClick={descargar} className="mt-5 w-full rounded-xl bg-[#74122A] p-3 font-bold text-white">Descargar mi QR vigente</button><button onClick={() => q.refetch()} disabled={q.isFetching} className="mt-3 w-full rounded-xl border p-3 font-bold text-[#74122A]">{q.isFetching ? "Actualizando..." : "Actualizar código"}</button></>}<Link to="/comunicados" className="mt-4 inline-block font-bold text-[#74122A]">← Volver a Comunicados</Link></section></main>;
}
