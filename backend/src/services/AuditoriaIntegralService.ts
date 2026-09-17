import PerfilUsuario from "../models/PerfilUsuario";
import Gestion from "../models/Gestion";
import Fraterno from "../models/Fraterno";
import Preregistro from "../models/Preregistro";
import Bloque from "../models/Bloque";
import Guia from "../models/Guia";
import DetalleBloque from "../models/DetalleBloque";
import TallaFraterno from "../models/TallaFraterno";
import Cuota from "../models/Cuota";
import DetalleCuota from "../models/DetalleCuota";
import EntregaIndumentaria from "../models/EntregaIndumentaria";
import ExencionPagoUsuario from "../models/ExencionPagoUsuario";
import "../models/Rol";
import "../models/PrendaIndumentaria";
import { calcularParticipacionFinanciera, obtenerAjustesGestion } from "./AjusteFinancieroService";
import { analizarCampoTalla, clasificarEstadoTalla } from "./ReporteTallasPrimeraCuotaService";
import { FILTRO_ASIGNACION_ACTIVA } from "./AsignacionBloqueService";

// Snapshot exclusivamente de lectura. Los documentos Mongoose se convierten con lean().
type Documento = Record<string, any>;
export type SnapshotIntegral = {
  gestion: Documento | null; usuarios: Documento[]; fraternos: Documento[];
  preregistros: Documento[]; bloques: Documento[]; guias: Documento[];
  asignaciones: Documento[]; tallas: Documento[]; cuotas: Documento[];
  pagos: Documento[]; entregas: Documento[]; exenciones: Documento[]; ajustes: Documento[];
};
const id = (v: any): string => String(v?._id ?? v ?? "");
const nombre = (u: Documento) => [u?.nombres, u?.apellidoPaterno, u?.apellidoMaterno].filter(Boolean).join(" ");
const dinero = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;
const suma = (rows: Documento[], campo: string) => dinero(rows.reduce((n, r) => n + (Number(r[campo]) || 0), 0));
const normalizar = (v: unknown) => String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
const vigente = (d: Documento) => !d.fechaEliminado && d.estado !== "ELIMINADO";
function agrupar(rows: Documento[], clave: (r: Documento) => string) {
  const mapa = new Map<string, Documento[]>();
  for (const r of rows) { const k = clave(r); mapa.set(k, [...(mapa.get(k) ?? []), r]); }
  return mapa;
}
const recientes = (rows: Documento[], campo: string) => [...rows].sort((a, b) =>
  new Date(b[campo] ?? 0).getTime() - new Date(a[campo] ?? 0).getTime() || id(b).localeCompare(id(a)));

export function construirAuditoriaIntegral(s: SnapshotIntegral) {
  const gid = id(s.gestion);
  const usuarios = s.usuarios.filter(vigente);
  const um = new Map(usuarios.map(u => [id(u), u]));
  const fm = new Map(s.fraternos.map(f => [id(f), f]));
  const fraternos = agrupar(s.fraternos.filter(f => vigente(f) && gid && id(f.gestionId) === gid), f => id(f.usuarioId));
  const pre = new Map(s.preregistros.filter(p => vigente(p) && gid && id(p.gestionId) === gid).map(p => [id(p), p]));
  const cuotas = agrupar(s.cuotas.filter(c => vigente(c) && pre.has(id(c.preregistroId))), c => id(pre.get(id(c.preregistroId))?.usuarioId));
  const pagos = agrupar(s.pagos.filter(vigente), p => id(p.cuotaId));
  const bloques = new Map(s.bloques.filter(b => b.estado === "ACTIVO" && vigente(b) && gid && id(b.gestionId) === gid).map(b => [id(b), b]));
  const asignaciones = agrupar(s.asignaciones.filter(a => a.estado !== "INACTIVO" && !a.fechaEliminado && bloques.has(id(a.bloqueId))), a => id(a.fraternoId));
  const guias = new Map(s.guias.filter(g => g.estado === "ACTIVO" && id(g.gestionId) === gid).map(g => [id(g), nombre(um.get(id(g.usuarioId)))]));
  const diferencias: Documento[] = [];
  const avisar = (usuarioId: string, motivo: string, registroId = "", valor = "") => diferencias.push({ usuarioId, nombre: nombre(um.get(usuarioId)), ci: um.get(usuarioId)?.ci ?? "", motivo, registroId, valor });
  const tallas = new Map<string, Documento[]>();
  for (const t of s.tallas) {
    const directo = id(t.usuarioId), relacionado = id(fm.get(id(t.fraternoId))?.usuarioId);
    if (directo && relacionado && directo !== relacionado) {
      avisar(directo, "TALLA CON IDENTIDADES CONTRADICTORIAS; NO CONTABILIZADA", id(t), JSON.stringify({ usuarioId: directo, usuarioFraterno: relacionado, polera: t.tallaPolera, chamarra: t.tallaChamarra }));
      continue;
    }
    const owner = directo || relacionado;
    if (!um.has(owner)) { avisar(owner, "TALLA SIN USUARIO VIGENTE RESOLUBLE", id(t)); continue; }
    tallas.set(owner, [...(tallas.get(owner) ?? []), t]);
  }
  const entregas = agrupar(s.entregas.filter(e => !e.gestionId || id(e.gestionId) === gid), e => id(e.fraternoId));
  const ajustes = agrupar(recientes(s.ajustes, "fecha"), a => `${id(a.usuarioId)}:${id(a.cuotaId)}`);
  const exenciones = new Set(s.exenciones.filter(e => e.activa && id(e.gestionId) === gid).map(e => id(e.usuarioId)));
  const pagosDetallados: Documento[] = [], entregasDetalladas: Documento[] = [];
  const personas = usuarios.map(u => {
    const uid = id(u), fs = fraternos.get(uid) ?? [], cs = cuotas.get(uid) ?? [];
    const as = fs.flatMap(f => asignaciones.get(id(f)) ?? []);
    const bs = [...new Set(as.map(a => id(a.bloqueId)))].map(b => bloques.get(b));
    const ts = recientes(tallas.get(uid) ?? [], "fechaActualizado"), t = ts[0];
    if (ts.length > 1) avisar(uid, "VARIOS REGISTROS DE TALLA; SE MUESTRA EL MÁS RECIENTE", ts.map(id).join(" / "), JSON.stringify(ts.map(x => ({ id: id(x), polera: x.tallaPolera, chamarra: x.tallaChamarra }))));
    if (as.length > 1) avisar(uid, "MÚLTIPLES ASIGNACIONES ACTIVAS", as.map(id).join(" / "));
    if (fs.length > 1) avisar(uid, "MÚLTIPLES FRATERNOS EN GESTIÓN", fs.map(id).join(" / "));
    if (cs.length > 1) avisar(uid, "VARIAS CUOTAS; IMPORTES SUMADOS SIN DUPLICAR DOCUMENTOS", cs.map(id).join(" / "));
    const polera = analizarCampoTalla(t?.tallaPolera), chamarra = analizarCampoTalla(t?.tallaChamarra);
    const tieneTalla = polera.estado === "VALIDA" || chamarra.estado === "VALIDA";
    if ([polera.estado, chamarra.estado].includes("SIN DEFINIR")) avisar(uid, "TALLA NO RECONOCIDA; NO CUENTA COMO TALLA VÁLIDA", id(t), JSON.stringify({ polera: t?.tallaPolera, chamarra: t?.tallaChamarra }));
    const ms = cs.flatMap(c => pagos.get(id(c)) ?? []);
    const financias = cs.map(c => calcularParticipacionFinanciera({ montoEsperadoOriginal: Number(c.montoTotal) || 0, montoVerificado: suma((pagos.get(id(c)) ?? []).filter(p => p.estadoRevision === "VERIFICADO"), "monto"), exentoBase: Boolean(c.exentoPago) || exenciones.has(uid), ajuste: ajustes.get(`${uid}:${id(c)}`)?.[0] }));
    const origen = ["INTERNO", "INTERNO_UMSA"].includes(u.tipoOrigen) ? "INTERNO" : ["EXTERNO", "EXTERNO_UMSA", "EXTERNO_NO_UMSA"].includes(u.tipoOrigen) ? "EXTERNO" : "SIN CLASIFICAR";
    const tipo = financias.some(f => f.estado === "DESCUENTO") ? "DESCUENTO" : (financias.length ? financias.every(f => ["EXENTO", "EXENTO_CUOTA"].includes(f.estado)) : exenciones.has(uid)) ? "EXENTO" : origen;
    const esperado = suma(financias, "montoEsperadoAjustado"), verificado = suma(ms.filter(p => p.estadoRevision === "VERIFICADO"), "monto");
    const pagado = suma(ms.filter(p => p.estadoRevision !== "RECHAZADO"), "monto");
    const saldo = suma(financias, "saldoAjustado");
    const estadoPago = !cs.length ? "SIN CUOTA" : ms.some(p => !p.estadoRevision || p.estadoRevision === "PENDIENTE" || p.estadoRevision === "OBSERVADO") ? "PENDIENTE REVISIÓN" : verificado > 0 && saldo === 0 ? "PAGO COMPLETO VERIFICADO" : verificado > 0 ? "PAGO PARCIAL" : "SIN PAGO";
    const es = recientes(fs.flatMap(f => entregas.get(id(f)) ?? []), "fechaEntrega");
    const ep = es.find(e => e.estado === "ENTREGADO" && e.prendaId?.nombre === "POLERA");
    const ec = es.find(e => e.estado === "ENTREGADO" && e.prendaId?.nombre === "CHAMARRA");
    const base = { usuarioId: uid, nombre: nombre(u), ci: String(u.ci ?? "") };
    for (const c of cs) for (const p of pagos.get(id(c)) ?? []) pagosDetallados.push({ ...base, cuotaId: id(c), pagoId: id(p), numero: p.numeroPago, monto: p.monto, fecha: p.fechaPago ?? "", estado: p.estadoRevision ?? "PENDIENTE", metodo: p.metodoPago ?? "" });
    for (const e of es) entregasDetalladas.push({ ...base, entregaId: id(e), prenda: e.prendaId?.nombre ?? "SIN PRENDA", talla: e.talla ?? "", estado: e.estado, fecha: e.fechaEntrega ?? "", administrador: nombre(e.responsableEntrega) });
    if (tieneTalla && !bs.length) avisar(uid, "CON TALLA SIN BLOQUE");
    if (!tieneTalla && bs.length) avisar(uid, "CON BLOQUE SIN TALLA VÁLIDA");
    if (pagado > 0 && !bs.length) avisar(uid, "PAGO SIN ASIGNACIÓN ACTIVA; NO DEMUESTRA AUSENCIA DE PARTICIPACIÓN");
    const telefono = String(u.telefono ?? ""), digitos = telefono.replace(/\D/g, "");
    return { ...base, telefono, whatsapp: /^[67]\d{7}$/.test(digitos) ? `+591${digitos}` : /^591[67]\d{7}$/.test(digitos) ? `+${digitos}` : "", correo: u.email ?? "", sexo: u.sexo ?? "SIN REGISTRO", roles: (u.roles ?? []).map(r => r.codigo || r.nombre || id(r)).join(" / "), codigoFraterno: fs.map(f => f.numeroFraterno).filter(Boolean).join(" / "), ru: String(u.registroUniversitario ?? ""), tieneRu: Boolean(String(u.registroUniversitario ?? "").trim()), facultad: u.facultad ?? "", carrera: u.carrera ?? "", estado: u.estado ?? "SIN REGISTRO",
      tieneBloque: bs.length > 0, bloque: bs.map(b => b.nombre).join(" / ") || "SIN BLOQUE", bloqueIds: bs.map(id).join(" / "), guias: [...new Set(bs.flatMap(b => [...new Set([...(b.guiasIds ?? []).map(id), id(b.guiaId)].filter(Boolean))].map(g => guias.get(g) || "GUÍA NO VIGENTE")))].join(" / "), origen, tipo,
      tieneTalla, registrosTalla: ts.length, tallaPolera: polera.valorReal, estadoPolera: polera.estado, tallaChamarra: chamarra.valorReal, estadoChamarra: chamarra.estado, estadoTalla: clasificarEstadoTalla(t?.tallaPolera, t?.tallaChamarra),
      poleraEntregada: Boolean(ep), fechaPolera: ep?.fechaEntrega ?? "", administradorPolera: nombre(ep?.responsableEntrega), chamarraEntregada: Boolean(ec), fechaChamarra: ec?.fechaEntrega ?? "", administradorChamarra: nombre(ec?.responsableEntrega), estadoEntrega: ep && ec ? "ENTREGA COMPLETA" : ep ? "SOLO POLERA" : ec ? "SOLO CHAMARRA" : "NADA ENTREGADO",
      esperado, pagado, verificado, saldo, montoExcluido: suma(financias.filter(f => f.estado === "EXCLUIDO"), "montoDescontado"), montoExento: suma(financias.filter(f => ["EXENTO", "EXENTO_CUOTA"].includes(f.estado)), "montoDescontado"), montoDescuento: suma(financias.filter(f => f.estado === "DESCUENTO"), "montoDescontado"), afectaCalculo: esperado > 0, estadoPago,
      cantidadCuotas: cs.length === 1 ? Number(cs[0].numeroCuotasElegidas) || 0 : 0,
      ...Object.fromEntries([1, 2, 3].map(n => { const movimientos = ms.filter(p => Number(p.numeroPago) === n); return [`cuota${n}`, !cs.length ? "NO APLICA" : cs.length > 1 ? "REVISAR VARIAS CUOTAS" : n > Number(cs[0].numeroCuotasElegidas || 0) ? "NO APLICA / SIN PLAN" : movimientos.some(p => ["PENDIENTE", "OBSERVADO"].includes(p.estadoRevision ?? "PENDIENTE")) ? "ENVIADO / REVISAR" : movimientos.some(p => p.estadoRevision === "VERIFICADO") ? "VERIFICADO" : "PENDIENTE"]; })),
    };
  }).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  for (const [campo, key] of [["CI REPETIDO", (p: Documento) => normalizar(p.ci)], ["NOMBRE SIMILAR; REVISAR IDENTIDAD, NO FUSIONAR", (p: Documento) => normalizar(p.nombre).split(" ").sort().join(" ")]] as const) {
    for (const [valor, grupo] of agrupar(personas, key)) if (valor && grupo.length > 1) for (const p of grupo) avisar(p.usuarioId, campo, grupo.map(x => x.usuarioId).join(" / "));
  }
  const resumir = (grupo: Documento[]) => ({ cantidad: grupo.length, esperado: suma(grupo, "esperado"), verificado: suma(grupo, "verificado"), saldo: suma(grupo, "saldo"), montoExento: suma(grupo, "montoExento"), montoExcluido: suma(grupo, "montoExcluido"), montoDescuento: suma(grupo, "montoDescuento"), internos: grupo.filter(p => p.origen === "INTERNO").length, externos: grupo.filter(p => p.origen === "EXTERNO").length, exentos: grupo.filter(p => p.tipo === "EXENTO").length, completos: grupo.filter(p => p.estadoPago === "PAGO COMPLETO VERIFICADO").length, parciales: grupo.filter(p => p.verificado > 0 && p.saldo > 0).length, sinPago: grupo.filter(p => p.pagado === 0).length });
  const conBloque = personas.filter(p => p.tieneBloque).length, conTalla = personas.filter(p => p.tieneTalla).length;
  return { generadoEn: new Date().toISOString(), gestion: s.gestion ? { id: gid, nombre: s.gestion.nombre, anio: s.gestion.anio } : null,
    alcance: "Todas las cuentas no eliminadas (incluye inactivas). Bloques, pagos y entregas de la gestión activa. Tallas globales: el modelo no tiene gestión. Talla válida según catálogo; registros duplicados se muestran por última actualización. Pagado excluye rechazados; verificado solo VERIFICADO. Sin cuota no genera deuda. Consultas de solo lectura, no snapshot transaccional.",
    resumen: { totalUsuarios: personas.length, conBloque, sinBloque: personas.length - conBloque, conTalla, sinTalla: personas.length - conTalla, conRu: personas.filter(p => p.tieneRu).length, sinRu: personas.filter(p => !p.tieneRu).length, registrosTalla: s.tallas.length, conTallaSinBloque: personas.filter(p => p.tieneTalla && !p.tieneBloque).length, conBloqueSinTalla: personas.filter(p => p.tieneBloque && !p.tieneTalla).length, ambos: personas.filter(p => p.tieneBloque && p.tieneTalla).length, diferenciaNeta: conTalla - conBloque, ...resumir(personas) },
    porTipo: [...agrupar(personas, p => p.tipo)].map(([tipo, grupo]) => ({ tipo, ...resumir(grupo) })),
    porBloque: [...bloques].map(([bid, b]) => ({ bloque: b.nombre, ...resumir(personas.filter(p => p.bloqueIds.split(" / ").includes(bid))) })),
    personas, pagosDetallados, entregasDetalladas, diferencias };
}

export async function obtenerAuditoriaIntegral() {
  const gestion = await Gestion.findOne({ estado: { $in: ["ACTIVA", "INSCRIPCIONES"] }, fechaEliminado: null }).sort({ anio: -1 }).lean();
  const filtro = { gestionId: gestion?._id ?? null };
  const [usuarios, fraternos, preregistros, bloques, guias, tallas, exenciones, ajustes] = await Promise.all([
    PerfilUsuario.find({ fechaEliminado: null, estado: { $ne: "ELIMINADO" } }).select("nombres apellidoPaterno apellidoMaterno ci telefono email sexo roles registroUniversitario facultad carrera tipoOrigen estado").populate("roles", "codigo nombre").lean(),
    Fraterno.find({}).select("usuarioId gestionId numeroFraterno estado fechaEliminado").lean(),
    Preregistro.find({ ...filtro, fechaEliminado: null }).select("usuarioId gestionId estado fechaEliminado").lean(),
    Bloque.find(filtro).lean(), Guia.find(filtro).lean(), TallaFraterno.find({}).lean(),
    ExencionPagoUsuario.find({ ...filtro, activa: true }).lean(), gestion ? obtenerAjustesGestion(gestion._id) : Promise.resolve({ historial: [] }),
  ]);
  const actuales = fraternos.filter(f => id(f.gestionId) === id(gestion));
  const [cuotas, asignaciones, entregas] = await Promise.all([
    Cuota.find({ preregistroId: { $in: preregistros.map(p => p._id) }, fechaEliminado: null }).lean(),
    DetalleBloque.find({ fraternoId: { $in: actuales.map(f => f._id) }, ...FILTRO_ASIGNACION_ACTIVA }).lean(),
    EntregaIndumentaria.find({ fraternoId: { $in: actuales.map(f => f._id) } }).populate("prendaId", "nombre").populate("responsableEntrega", "nombres apellidoPaterno apellidoMaterno").lean(),
  ]);
  const pagos = await DetalleCuota.find({ cuotaId: { $in: cuotas.map(c => c._id) }, fechaEliminado: null }).lean();
  return construirAuditoriaIntegral({ gestion, usuarios, fraternos, preregistros, bloques, guias, tallas, exenciones, ajustes: ajustes.historial, cuotas, asignaciones, entregas, pagos });
}
