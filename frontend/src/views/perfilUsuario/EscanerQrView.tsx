import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { toast } from "react-toastify";
import { buscarIdentidades, identificarManualmente, marcarAsistenciaQr, verificarCredencialQr, type IdentidadQr, type ResultadoBusquedaIdentidad } from "@/api/CredencialQrApi";
import { guardarTallaUsuario } from "@/api/IndumentariaApi";
import { useAuth } from "@/hooks/useAuth";

const API = String(import.meta.env.VITE_API_URL || "").replace(/\/api\/?$/, "");
const TALLAS = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];
const urlFoto = (ruta?: string) => !ruta ? "" : /^https?:\/\//i.test(ruta) ? ruta : `${API}${ruta}`;

export default function EscanerQrView() {
  const { data: usuario } = useAuth();
  const roles = Array.isArray(usuario?.roles) ? usuario.roles.filter((rol) => typeof rol === "object" && rol) : [];
  const esAdministrador = roles.some((rol) => [rol.codigo, rol.nombre].some((valor) => ["ADMIN", "ADMINISTRADOR", "SUPERADMIN", "SUPERADMINISTRADOR"].includes(String(valor ?? "").toUpperCase().replace(/[\s_-]/g, ""))));
  const permisos = new Set(roles.flatMap((rol) => rol.permisos ?? []));
  const puedeRegistrarTallas = esAdministrador || permisos.has("TALLAS_REGISTRAR") || permisos.has("INDUMENTARIA_GESTIONAR");
  const puedeMarcarAsistencia = esAdministrador || permisos.has("ASISTENCIAS_GESTIONAR");
  const lector = useRef<Html5Qrcode | null>(null);
  const tokenLeido = useRef("");
  const procesandoRef = useRef(false);
  const ultimoTokenRef = useRef("");
  const [resultado, setResultado] = useState<IdentidadQr | null>(null);
  const [activo, setActivo] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [marcando, setMarcando] = useState(false);
  const [horaMarcada, setHoraMarcada] = useState<string | null>(null);
  const [tallaPolera, setTallaPolera] = useState("");
  const [tallaChamarra, setTallaChamarra] = useState("");
  const [guardandoTalla, setGuardandoTalla] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [terminoBusqueda, setTerminoBusqueda] = useState("");
  const [resultadosBusqueda, setResultadosBusqueda] = useState<ResultadoBusquedaIdentidad[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [seleccionando, setSeleccionando] = useState("");

  const cargarIdentidad = (identidad: IdentidadQr, token: string) => {
    tokenLeido.current = token;
    setResultado(identidad);
    setTallaPolera(identidad.talla?.tallaPolera ?? "");
    setTallaChamarra(identidad.talla?.tallaChamarra ?? "");
    setHoraMarcada(null);
  };

  const verificar = async (token: string) => {
    if (procesandoRef.current || token === ultimoTokenRef.current) return;
    procesandoRef.current = true;
    ultimoTokenRef.current = token;
    setProcesando(true);
    try {
      const identidad = await verificarCredencialQr(token);
      cargarIdentidad(identidad, token);
      await lector.current?.stop().catch(() => undefined);
      setActivo(false);
    } catch (e) {
      await lector.current?.stop().catch(() => undefined);
      setActivo(false);
      toast.error(e instanceof Error ? e.message : "QR inválido");
    } finally { procesandoRef.current = false; setProcesando(false); }
  };

  const buscarAhora = () => setTerminoBusqueda(busqueda.trim());

  const seleccionarResultado = async (id: string) => {
    if (seleccionando) return;
    setSeleccionando(id);
    try {
      const identidad = await identificarManualmente(id);
      cargarIdentidad(identidad, identidad.token);
      await lector.current?.stop().catch(() => undefined);
      setActivo(false);
      setResultadosBusqueda([]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo identificar al usuario");
    } finally { setSeleccionando(""); }
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
    ultimoTokenRef.current = "";
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
    if (!resultado?.valida || !resultado.pago.primeraCuotaVerificada || !resultado.usuario || !tallaPolera || !tallaChamarra || guardandoTalla) return;
    setGuardandoTalla(true);
    try {
      const respuesta = await guardarTallaUsuario({ usuarioId: resultado.usuario._id, tallaPolera, tallaChamarra });
      setResultado((actual) => actual ? { ...actual, talla: respuesta.talla } : actual);
      toast.success("Tallas registradas por Administración");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron guardar las tallas");
    } finally { setGuardandoTalla(false); }
  };

  useEffect(() => {
    const temporizador = window.setTimeout(() => setTerminoBusqueda(busqueda.trim()), 400);
    return () => window.clearTimeout(temporizador);
  }, [busqueda]);

  useEffect(() => {
    let vigente = true;
    if (terminoBusqueda.length < 2) {
      setResultadosBusqueda([]);
      setBuscando(false);
      return () => { vigente = false; };
    }
    setBuscando(true);
    buscarIdentidades(terminoBusqueda)
      .then(({ resultados }) => { if (vigente) setResultadosBusqueda(resultados); })
      .catch((error) => { if (vigente) toast.error(error instanceof Error ? error.message : "No se pudo buscar"); })
      .finally(() => { if (vigente) setBuscando(false); });
    return () => { vigente = false; };
  }, [terminoBusqueda]);

  useEffect(() => () => { if (lector.current?.isScanning) lector.current.stop().catch(() => undefined); }, []);
  const u = resultado?.usuario;

  return <main className="space-y-6">
    <header>
      <p className="text-xs font-bold uppercase tracking-widest text-[#8F5F2A]">Control de identidad</p>
      <h1 className="text-3xl font-black text-[#74122A]">Escáner de credenciales QR</h1>
      <p className="text-sm text-slate-500">Escanea el QR, verifica la identidad y realiza únicamente las acciones autorizadas para tu rol.</p>
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
        <div className="my-5 flex items-center gap-3 text-xs font-black uppercase tracking-wider text-slate-400"><span className="h-px flex-1 bg-slate-200" />O buscar manualmente<span className="h-px flex-1 bg-slate-200" /></div>
        <form onSubmit={(evento) => { evento.preventDefault(); buscarAhora(); }} className="flex flex-col gap-2 sm:flex-row">
          <input value={busqueda} onChange={(evento) => setBusqueda(evento.target.value)} placeholder="CI, nombre, apellido o código de fraterno" className="input-preregistro flex-1" aria-label="Buscar usuario manualmente" />
          <button type="submit" disabled={busqueda.trim().length < 2 || buscando} className="rounded-xl bg-[#74122A] px-5 py-3 font-bold text-white disabled:opacity-50">{buscando ? "Buscando..." : "Buscar"}</button>
        </form>
        {terminoBusqueda.length >= 2 && !buscando && resultadosBusqueda.length === 0 && <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">No se encontraron usuarios con esos datos.</p>}
        {!!resultadosBusqueda.length && <div className="mt-3 max-h-80 space-y-2 overflow-y-auto" aria-label="Resultados de búsqueda">{resultadosBusqueda.map((persona) => <button key={persona._id} type="button" onClick={() => void seleccionarResultado(persona._id)} disabled={Boolean(seleccionando)} className="flex w-full items-center gap-3 rounded-xl border p-3 text-left transition hover:border-[#74122A] hover:bg-[#74122A]/5 disabled:opacity-50">
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full bg-slate-100">{persona.fotoPerfil ? <img src={urlFoto(persona.fotoPerfil)} alt="" className="h-full w-full object-cover" /> : <span className="grid h-full place-items-center text-xs">Sin foto</span>}</div>
          <div className="min-w-0 flex-1"><p className="font-black uppercase">{persona.nombres} {persona.apellidoPaterno} {persona.apellidoMaterno}</p><p className="text-sm text-slate-500">CI {persona.ci}</p><p className="truncate text-xs font-semibold text-[#74122A]">{persona.roles.map((rol) => rol.nombre).join(" / ") || "SIN ROL"}</p></div>
          <span className="text-sm font-bold text-[#74122A]">{seleccionando === persona._id ? "Cargando..." : "Ver ficha"}</span>
        </button>)}</div>}
        <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">La persona debe estar físicamente presente. Ya sea mediante QR o búsqueda manual, compara siempre su rostro con la fotografía antes de registrar información.</p>
        {!window.isSecureContext && <p className="mt-3 rounded-xl bg-blue-50 p-3 text-sm font-semibold text-blue-800">Estás usando HTTP: “Abrir cámara” está bloqueado por el navegador. Usa “Tomar foto del QR”, que abre la cámara nativa del celular.</p>}
      </div>
      <div className="rounded-2xl bg-white p-5 shadow">
        {!u ? <p className="grid min-h-64 place-items-center text-center text-slate-500">Aquí aparecerá la identidad después de escanear el QR o seleccionar un resultado de búsqueda.</p> : <div className="text-center">
          <p className="mb-3 text-xs font-black uppercase tracking-wider text-[#8F5F2A]">Identificado mediante {resultado.metodoIdentificacion === "QR" ? "QR" : "búsqueda manual"}</p>
          <span className={`inline-block rounded-full px-4 py-2 text-sm font-black ${resultado.valida ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700"}`}>{resultado.valida ? "IDENTIDAD ACTIVA" : "CUENTA NO ACTIVA"}</span>
          <div className="mx-auto mt-5 h-52 w-52 overflow-hidden rounded-2xl border-4 border-[#C59A3A] bg-slate-100">{u.fotoPerfil ? <img src={urlFoto(u.fotoPerfil)} alt={`Fotografía de ${u.nombres}`} className="h-full w-full object-cover" /> : <span className="grid h-full place-items-center">Sin fotografía</span>}</div>
          <h2 className="mt-4 text-2xl font-black">{u.nombres} {u.apellidoPaterno} {u.apellidoMaterno}</h2>
          <p className="mt-2 text-xl font-bold text-[#74122A]">CI {u.ci}</p>
          <p className="text-sm text-slate-500">{u.email}</p>
          <p className="mt-2 text-sm font-bold">Roles: {u.roles.map((rol) => rol.nombre).join(" / ") || "SIN ROL"}</p>
          <p className="text-sm font-bold">Bloque: {resultado.bloque}</p>
          <EstadoPagos pago={resultado.pago} />
          {puedeRegistrarTallas ? <section className="mt-5 rounded-2xl border border-[#C59A3A]/50 bg-[#C59A3A]/10 p-4 text-left"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-black uppercase tracking-wider text-[#8F5F2A]">Registro administrativo de tallas</p><h3 className="font-black">{resultado.fraterno ? `Fraterno ${resultado.fraterno.numeroFraterno}` : "Postulante identificado"}</h3></div>{resultado.talla ? <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800">TALLAS REGISTRADAS</span> : <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-900">FALTA REGISTRAR</span>}</div><div className="mt-4 grid gap-3 sm:grid-cols-2"><SelectorTalla etiqueta="Talla de polera" valor={tallaPolera} cambiar={setTallaPolera}/><SelectorTalla etiqueta="Talla de chamarra" valor={tallaChamarra} cambiar={setTallaChamarra}/></div><button type="button" onClick={guardarTallas} disabled={!resultado.valida || !resultado.pago.primeraCuotaVerificada || guardandoTalla || !tallaPolera || !tallaChamarra} className="mt-4 w-full rounded-xl bg-[#74122A] px-5 py-3 font-black text-white disabled:opacity-50">{!resultado.valida ? "Cuenta inactiva: no se puede registrar" : !resultado.pago.primeraCuotaVerificada ? "Primera cuota pendiente de verificación" : guardandoTalla ? "Guardando..." : resultado.talla ? "Actualizar tallas" : "Registrar tallas"}</button></section> : null}
          {puedeMarcarAsistencia ? (horaMarcada ? <div className="mt-5 rounded-xl bg-emerald-100 p-4 font-black text-emerald-800">ASISTENCIA MARCADA · {new Date(horaMarcada).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" })}</div> : <button onClick={marcar} disabled={!resultado.valida || !u.fotoPerfil || marcando} className="mt-5 w-full rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{marcando ? "Marcando..." : !u.fotoPerfil ? "No se puede validar: sin fotografía" : "Rostro verificado — Marcar asistencia"}</button>) : null}
          <button onClick={() => { setResultado(null); setHoraMarcada(null); tokenLeido.current = ""; ultimoTokenRef.current = ""; }} className="mt-3 rounded-xl border px-5 py-3 font-bold">Escanear otra persona</button>
        </div>}
      </div>
    </section>
  </main>;
}

function SelectorTalla({ etiqueta, valor, cambiar }: { etiqueta: string; valor: string; cambiar: (valor: string) => void }) { return <label className="text-sm font-bold">{etiqueta}<select value={valor} onChange={(evento) => cambiar(evento.target.value)} className="input-preregistro mt-1"><option value="">Seleccionar</option>{TALLAS.map((talla) => <option key={talla} value={talla}>{talla}</option>)}</select></label>; }

function EstadoPagos({ pago }: { pago: IdentidadQr["pago"] }) {
  const correcta = pago.primeraCuotaVerificada;
  return <section className={`mt-5 rounded-2xl border p-4 text-left ${correcta ? "border-emerald-300 bg-emerald-50 text-emerald-950" : "border-amber-300 bg-amber-50 text-amber-950"}`}>
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-black">Plan de pagos completo</h3><span className="rounded-full bg-white/80 px-3 py-1 text-xs font-black">{pago.estadoGeneral.replaceAll("_", " ")}</span></div>
    <p className="mt-2 text-sm font-black">{pago.cuotasPagadas ?? 0} de {pago.numeroCuotas ?? 0} cuotas pagadas</p>
    <p className="mt-2 text-sm font-semibold">{correcta ? "Puede registrar o actualizar sus tallas." : pago.envioBaucher ? "El comprobante fue enviado y todavía no está verificado. No se pueden registrar tallas." : pago.tieneCuota ? "Aún no envió el comprobante de su primera cuota." : "No tiene una cuota vinculada. Administración debe regularizarla antes de registrar tallas."}</p>
    {pago.tieneCuota && <p className="mt-2 text-xs">Pagado: Bs {pago.montoPagado.toFixed(2)}{pago.saldo !== null ? ` · Saldo: Bs ${pago.saldo.toFixed(2)}` : ""}</p>}
    {!!pago.detalleCuotas?.length && <div className="mt-3 grid gap-2 sm:grid-cols-2">{pago.detalleCuotas.map(cuota=><div key={cuota.numero} className="rounded-xl border border-black/10 bg-white/70 p-3"><div className="flex justify-between gap-2"><strong>Cuota {cuota.numero}</strong><span className="text-xs font-black">{cuota.estado.replaceAll("_", " ")}</span></div><p className="mt-1 text-xs">Programado: Bs {cuota.montoProgramado.toFixed(2)} · Registrado: Bs {cuota.montoRegistrado.toFixed(2)}</p>{cuota.fechaPago&&<p className="mt-1 text-[11px] text-slate-600">{new Date(cuota.fechaPago).toLocaleDateString("es-BO")}</p>}</div>)}</div>}
  </section>;
}
