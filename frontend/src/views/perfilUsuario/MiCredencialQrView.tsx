import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import QRCode from "qrcode";
import { miCredencialQr } from "@/api/CredencialQrApi";

export default function MiCredencialQrView() {
  const q = useQuery({ queryKey: ["mi-credencial-qr"], queryFn: miCredencialQr, staleTime: Infinity, refetchOnWindowFocus: false });
  const [imagen, setImagen] = useState("");
  useEffect(() => { if (q.data?.token) QRCode.toDataURL(q.data.token, { width: 900, margin: 3, errorCorrectionLevel: "H", color: { dark: "#21181b", light: "#ffffff" } }).then(setImagen); }, [q.data?.token]);
  const descargar = () => { if (!imagen) return; const a = document.createElement("a"); a.href = imagen; a.download = `CREDENCIAL_QR_${q.data?.ci}.png`; a.click(); };
  return <main className="min-h-screen bg-[#eee8dc] p-4 sm:p-8"><section className="mx-auto max-w-xl rounded-3xl bg-white p-6 text-center shadow"><p className="text-xs font-bold uppercase tracking-widest text-[#8F5F2A]">Credencial digital personal</p><h1 className="text-3xl font-black text-[#74122A]">Mi código QR</h1><p className="mt-2 text-sm text-slate-500">Este código te identifica y permanece igual para tus controles de asistencia e indumentaria.</p>{q.isLoading ? <p className="p-10">Generando...</p> : q.isError ? <p className="mt-6 rounded-xl bg-red-50 p-4 text-red-700">{q.error.message}</p> : <><img src={imagen} alt="Mi credencial QR personal" className="mx-auto mt-5 w-full max-w-sm"/><h2 className="text-xl font-black">{q.data?.nombre}</h2><p>CI {q.data?.ci}</p><p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">Tu QR es personal y no cambia después de usarlo. No lo compartas.</p><button onClick={descargar} className="mt-5 w-full rounded-xl bg-[#74122A] p-3 font-bold text-white">Descargar mi QR personal</button></>}<Link to="/comunicados" className="mt-4 inline-block font-bold text-[#74122A]">← Volver a Comunicados</Link></section></main>;
}
