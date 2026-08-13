import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { toast } from "react-toastify";
import { marcarAsistenciaQr, verificarCredencialQr, type IdentidadQr } from "@/api/CredencialQrApi";
import { guardarTallaUsuario } from "@/api/IndumentariaApi";

const API = String(import.meta.env.VITE_API_URL || "").replace(/\/api\/?$/, "");
const TALLAS = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];

export default function EscanerQrView() {
  const lector = useRef<Html5Qrcode | null>(null);
  const tokenLeido = useRef("");
  const [resultado, setResultado] = useState<IdentidadQr | null>(null);
  const [activo, setActivo] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [marcando, setMarcando] = useState(false);
  const [horaMarcada, setHoraMarcada] = useState<string | null>(null);
  const [tallaPolera, setTallaPolera] = useState("");
  const [tallaChamarra, setTallaChamarra] = useState("");
  const [guardandoTalla, setGuardandoTalla] = useState(false);

  const verificar = async (token: string) => {
    if (procesando) return;
    setProcesando(true);
    try {
      const identidad = await verificarCredencialQr(token);
      tokenLeido.current = token;
      setResultado(identidad);
      setTallaPolera(identidad.talla?.tallaPolera ?? "");
      setTallaChamarra(identidad.talla?.tallaChamarra ?? "");
      setHoraMarcada(null);
      await lector.current?.stop().catch(() => undefined);
      setActivo(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "QR inválido");
    } finally { setProcesando(false); }
  };

  const iniciar = async () => {
    if (!window.isSecureContext) {
      toast.error("La cámara requiere una conexión HTTPS segura. Abre la dirección https:// de la computadora e instala el certificado local en este celular.", { autoClose: 9000 });
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("Este navegador no permite usar la cámara. Prueba con Chrome en Android o Safari en iPhone.", { autoClose: 9000 });
      return;
    }
    setResultado(null);
    setHoraMarcada(null);
    tokenLeido.current = "";
    const qr = lector.current ?? new Html5Qrcode("lector-qr");
    lector.current = qr;
    try {
      await qr.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 240, height: 240 } }, verificar, () => undefined);
      setActivo(true);
    } catch (error) {
      const nombre = error instanceof DOMException ? error.name : "";
      if (nombre === "NotAllowedError" || nombre === "PermissionDeniedError") {
        toast.error("Permiso de cámara denegado. En los ajustes del navegador permite la cámara para este sitio y vuelve a intentarlo.", { autoClose: 9000 });
      } else if (nombre === "NotFoundError" || nombre === "DevicesNotFoundError") {
        toast.error("No se encontró una cámara disponible en este dispositivo.");
      } else {
        toast.error("No se pudo abrir la cámara. Verifica HTTPS, el certificado y el permiso de cámara.", { autoClose: 9000 });
      }
    }
  };

  const fotografiarQr = async (file?: File) => {
    if (!file || procesando) return;
    // Evita aceptar archivos antiguos seleccionados desde la galería como si
    // fueran una captura presencial recién tomada.
    if (Date.now() - file.lastModified > 2 * 60 * 1000) {
      toast.error("La imagen no es reciente. Toma una fotografía nueva del QR presentado por la persona.", { autoClose: 8000 });
      return;
    }
    const qr = lector.current ?? new Html5Qrcode("lector-qr");
    lector.current = qr;
    try {
      const token = await qr.scanFile(file, true);
      await verificar(token);
    } catch {
      toast.error("No se encontró un QR legible. Acerca el celular, evita reflejos y vuelve a tomar la foto.", { autoClose: 8000 });
    }
  };

  const marcar = async () => {
    if (!tokenLeido.current || !resultado?.valida || marcando) return;
    setMarcando(true);
    try {
      const respuesta = await marcarAsistenciaQr(tokenLeido.current);
      setHoraMarcada(respuesta.asistencia.horaEntrada);
      toast.success(respuesta.message);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo marcar la asistencia");
    } finally { setMarcando(false); }
  };

  const guardarTallas = async () => {
    if (!resultado?.valida || !resultado.usuario || !tallaPolera || !tallaChamarra || guardandoTalla) return;
    setGuardandoTalla(true);
    try {
      const respuesta = await guardarTallaUsuario({ usuarioId: resultado.usuario._id, tallaPolera, tallaChamarra });
      setResultado((actual) => actual ? { ...actual, talla: respuesta.talla } : actual);
      toast.success("Tallas registradas por Administración");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron guardar las tallas");
    } finally { setGuardandoTalla(false); }
  };

  useEffect(() => () => { if (lector.current?.isScanning) lector.current.stop().catch(() => undefined); }, []);
  const u = resultado?.usuario;

  return <main className="space-y-6">
    <header>
      <p className="text-xs font-bold uppercase tracking-widest text-[#8F5F2A]">Control de identidad y asistencia</p>
      <h1 className="text-3xl font-black text-[#74122A]">Escáner de credenciales QR</h1>
      <p className="text-sm text-slate-500">Escanea el QR en el teléfono de la persona, compara su rostro con la fotografía y confirma su asistencia.</p>
    </header>
    <section className="grid gap-5 lg:grid-cols-2">
      <div className="rounded-2xl bg-white p-5 shadow">
        <div id="lector-qr" className="mx-auto max-w-md overflow-hidden rounded-xl" />
        <button onClick={iniciar} disabled={activo || procesando} className="mt-4 w-full rounded-xl bg-[#74122A] p-3 font-bold text-white disabled:opacity-50">
          {activo ? "Cámara activa" : procesando ? "Verificando..." : "Abrir cámara"}
        </button>
        <label className="mt-3 block cursor-pointer rounded-xl border-2 border-[#74122A] bg-white p-3 text-center font-bold text-[#74122A]">
          📷 Tomar foto del QR
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => { void fotografiarQr(event.target.files?.[0]); event.currentTarget.value = ""; }} />
        </label>
        <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">La persona debe presentar su QR y estar físicamente presente. Compara siempre su rostro con la fotografía antes de marcar asistencia.</p>
        {!window.isSecureContext && <p className="mt-3 rounded-xl bg-blue-50 p-3 text-sm font-semibold text-blue-800">Estás usando HTTP: “Abrir cámara” está bloqueado por el navegador. Usa “Tomar foto del QR”, que abre la cámara nativa del celular.</p>}
      </div>
      <div className="rounded-2xl bg-white p-5 shadow">
        {!u ? <p className="grid min-h-64 place-items-center text-center text-slate-500">Aquí aparecerá la identidad después de escanear.</p> : <div className="text-center">
          <span className={`inline-block rounded-full px-4 py-2 text-sm font-black ${resultado.valida ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700"}`}>{resultado.valida ? "IDENTIDAD ACTIVA" : "CUENTA NO ACTIVA"}</span>
          <div className="mx-auto mt-5 h-52 w-52 overflow-hidden rounded-2xl border-4 border-[#C59A3A] bg-slate-100">{u.fotoPerfil ? <img src={`${API}${u.fotoPerfil}`} alt={`Fotografía de ${u.nombres}`} className="h-full w-full object-cover" /> : <span className="grid h-full place-items-center">Sin fotografía</span>}</div>
          <h2 className="mt-4 text-2xl font-black">{u.nombres} {u.apellidoPaterno} {u.apellidoMaterno}</h2>
          <p className="mt-2 text-xl font-bold text-[#74122A]">CI {u.ci}</p>
          <p className="text-sm text-slate-500">{u.email}</p>
          <section className="mt-5 rounded-2xl border border-[#C59A3A]/50 bg-[#C59A3A]/10 p-4 text-left"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-black uppercase tracking-wider text-[#8F5F2A]">Registro administrativo de tallas</p><h3 className="font-black">{resultado.fraterno ? `Fraterno ${resultado.fraterno.numeroFraterno}` : "Postulante identificado"}</h3></div>{resultado.talla ? <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800">TALLAS REGISTRADAS</span> : <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-900">FALTA REGISTRAR</span>}</div><div className="mt-4 grid gap-3 sm:grid-cols-2"><SelectorTalla etiqueta="Talla de polera" valor={tallaPolera} cambiar={setTallaPolera}/><SelectorTalla etiqueta="Talla de chamarra" valor={tallaChamarra} cambiar={setTallaChamarra}/></div><button type="button" onClick={guardarTallas} disabled={!resultado.valida || guardandoTalla || !tallaPolera || !tallaChamarra} className="mt-4 w-full rounded-xl bg-[#74122A] px-5 py-3 font-black text-white disabled:opacity-50">{!resultado.valida ? "Cuenta inactiva: no se puede registrar" : guardandoTalla ? "Guardando..." : resultado.talla ? "Actualizar tallas" : "Registrar tallas"}</button></section>
          {horaMarcada ? <div className="mt-5 rounded-xl bg-emerald-100 p-4 font-black text-emerald-800">ASISTENCIA MARCADA · {new Date(horaMarcada).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" })}</div> : <button onClick={marcar} disabled={!resultado.valida || !u.fotoPerfil || marcando} className="mt-5 w-full rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{marcando ? "Marcando..." : !u.fotoPerfil ? "No se puede validar: sin fotografía" : "Rostro verificado — Marcar asistencia"}</button>}
          <button onClick={() => { setResultado(null); setHoraMarcada(null); tokenLeido.current = ""; }} className="mt-3 rounded-xl border px-5 py-3 font-bold">Escanear otra persona</button>
        </div>}
      </div>
    </section>
  </main>;
}

function SelectorTalla({ etiqueta, valor, cambiar }: { etiqueta: string; valor: string; cambiar: (valor: string) => void }) { return <label className="text-sm font-bold">{etiqueta}<select value={valor} onChange={(evento) => cambiar(evento.target.value)} className="input-preregistro mt-1"><option value="">Seleccionar</option>{TALLAS.map((talla) => <option key={talla} value={talla}>{talla}</option>)}</select></label>; }
