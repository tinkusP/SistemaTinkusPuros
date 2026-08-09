import { useEffect, useRef, useState } from "react";
import type { Html5Qrcode } from "html5-qrcode";
import { toast } from "react-toastify";

const normalizarToken = (valor: string) => {
  const texto = valor.trim();
  const coincidencia = texto.toUpperCase().match(/FRA-[A-F0-9]{8}/);
  return coincidencia?.[0] ?? texto.toUpperCase();
};

export default function EscanerTokenRegistro({ alLeer }: { alLeer: (token: string) => void | Promise<void> }) {
  const lector = useRef<Html5Qrcode | null>(null);
  const procesando = useRef(false);
  const [activo, setActivo] = useState(false);
  const obtenerLector = async () => {
    if (lector.current) return lector.current;
    const { Html5Qrcode: Constructor } = await import("html5-qrcode");
    lector.current = new Constructor("lector-token-registro");
    return lector.current;
  };

  const entregar = async (contenido: string) => {
    if (procesando.current) return;
    procesando.current = true;
    try {
      const token = normalizarToken(contenido);
      await lector.current?.stop().catch(() => undefined);
      setActivo(false);
      await alLeer(token);
    } finally {
      procesando.current = false;
    }
  };

  const iniciar = async () => {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      toast.error("La cámara en vivo requiere HTTPS. También puedes tomar o elegir una foto del QR.");
      return;
    }
    try {
      const instancia = await obtenerLector();
      await instancia.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 230, height: 230 } }, (texto) => void entregar(texto), () => undefined);
      setActivo(true);
    } catch {
      toast.error("No se pudo abrir la cámara. Revisa el permiso del navegador.");
    }
  };

  const escanearImagen = async (archivo?: File) => {
    if (!archivo) return;
    try { const instancia = await obtenerLector(); await entregar(await instancia.scanFile(archivo, true)); }
    catch { toast.error("No se encontró un token QR legible en la imagen."); }
  };

  useEffect(() => () => { if (lector.current?.isScanning) lector.current.stop().catch(() => undefined); }, []);

  return <div className="space-y-3">
    <div id="lector-token-registro" className="overflow-hidden rounded-xl" />
    <button type="button" onClick={() => void iniciar()} disabled={activo} className="w-full rounded-xl border-2 border-[#841534] px-4 py-3 font-bold text-[#841534] disabled:opacity-50">{activo ? "Cámara activa" : "Escanear token con cámara"}</button>
    <label className="block cursor-pointer rounded-xl bg-slate-100 px-4 py-3 text-center text-sm font-bold text-slate-700">Tomar o elegir foto del QR<input type="file" accept="image/*" capture="environment" className="hidden" onChange={(evento) => { void escanearImagen(evento.target.files?.[0]); evento.currentTarget.value = ""; }}/></label>
  </div>;
}
