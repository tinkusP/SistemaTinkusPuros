import { createHash } from "node:crypto";
import ExcelJS from "exceljs";
import PerfilUsuario from "../models/PerfilUsuario";
import Fraterno from "../models/Fraterno";
import "../models/Rol";

type Identificador = unknown;
export type UsuarioNomina = {
  _id: Identificador; nombres?: string; apellidoPaterno?: string; apellidoMaterno?: string;
  ci?: string; registroUniversitario?: string; telefono?: string; sexo?: string; estado?: string;
  fechaEliminado?: unknown; roles?: Array<{ codigo?: string; nombre?: string } | null>;
};
type CodigoNomina = { usuarioId: Identificador; numeroFraterno?: string; fechaEliminado?: unknown; estado?: string };
const id = (v: unknown) => String(v ?? "");
const texto = (v: unknown) => String(v ?? "");
export const normalizarNombreNomina = (v: unknown) => texto(v).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleUpperCase("es").replace(/\s+/g, " ").trim();
const nombreCompleto = (u: UsuarioNomina) => [u.nombres, u.apellidoPaterno, u.apellidoMaterno].filter(Boolean).join(" ");
const tokensNombre = (v: string) => normalizarNombreNomina(v).split(" ").sort().join(" ");
const ausente = (v: unknown) => !texto(v).trim() || /^(?:-+|SIN REGISTRO|SIN DATO|N\/A)$/i.test(texto(v).trim());

export function validarListaNomina(lista: unknown): asserts lista is string[] {
  if (!Array.isArray(lista) || lista.length < 1 || lista.length > 1000 || lista.some(v => typeof v !== "string" || !v.trim() || v.length > 200)) {
    throw new Error("Envía de 1 a 1000 nombres, CI o códigos; máximo 200 caracteres por línea.");
  }
}

export function resolverNominaSeparada(lista: string[], registros: UsuarioNomina[], codigos: CodigoNomina[] = []) {
  validarListaNomina(lista);
  const usuarios = registros.filter(u => !u.fechaEliminado && u.estado !== "ELIMINADO");
  const indices = { nombre: new Map<string, Set<string>>(), ci: new Map<string, Set<string>>(), codigo: new Map<string, Set<string>>(), tokens: new Map<string, Set<string>>() };
  const porId = new Map(usuarios.map(u => [id(u._id), u]));
  const agregar = (indice: Map<string, Set<string>>, clave: string, uid: string) => {
    if (!clave) return;
    const valores = indice.get(clave) ?? new Set<string>(); valores.add(uid); indice.set(clave, valores);
  };
  for (const u of usuarios) {
    agregar(indices.nombre, normalizarNombreNomina(nombreCompleto(u)), id(u._id));
    agregar(indices.tokens, tokensNombre(nombreCompleto(u)), id(u._id));
    if (!ausente(u.ci)) agregar(indices.ci, normalizarNombreNomina(u.ci), id(u._id));
  }
  for (const c of codigos) if (!c.fechaEliminado && c.estado !== "ELIMINADO" && porId.has(id(c.usuarioId))) agregar(indices.codigo, normalizarNombreNomina(c.numeroFraterno), id(c.usuarioId));
  const resultados: Array<{ entrada: string; estado: string; metodo: string; usuarioId: string; candidatos: Array<{ usuarioId: string; nombre: string; ci: string }> }> = [];
  const seleccionados = new Set<string>();
  const filas: Array<{ usuarioId: string; nombres: string; apellidoPaterno: string; apellidoMaterno: string; nombreCompletoOriginal: string; ci: string; ru: string; telefono: string; whatsapp: string; sexo: string; roles: string; estado: string; observaciones: string[] }> = [];
  for (const entrada of lista) {
    const clave = normalizarNombreNomina(entrada);
    const prefijo = /^(CI|CODIGO|CÓDIGO)\s*:\s*(.+)$/.exec(clave);
    const exactos = prefijo ? indices[prefijo[1] === "CI" ? "ci" : "codigo"].get(prefijo[2]) ?? new Set<string>()
      : new Set([...(indices.nombre.get(clave) ?? []), ...(indices.ci.get(clave) ?? []), ...(indices.codigo.get(clave) ?? [])]);
    const metodo = exactos.size ? "EXACTA NORMALIZADA" : "MISMAS PALABRAS EN OTRO ORDEN";
    const coincidencias = exactos.size || prefijo ? exactos : indices.tokens.get(tokensNombre(entrada)) ?? new Set<string>();
    const candidatos = [...coincidencias].sort().map(uid => ({ usuarioId: uid, nombre: nombreCompleto(porId.get(uid)!), ci: texto(porId.get(uid)!.ci) }));
    const usuarioId = candidatos.length === 1 ? candidatos[0].usuarioId : "";
    const estado = !candidatos.length ? "NO ENCONTRADO" : candidatos.length > 1 ? "AMBIGUO" : seleccionados.has(usuarioId) ? "REPETIDO EN LISTA" : "ENCONTRADO";
    resultados.push({ entrada, estado, metodo: candidatos.length ? metodo : "", usuarioId, candidatos });
    if (estado !== "ENCONTRADO") continue;
    seleccionados.add(usuarioId);
    const u = porId.get(usuarioId)!;
    const observaciones: string[] = [];
    for (const [etiqueta, valor] of [["NOMBRES", u.nombres], ["APELLIDO PATERNO", u.apellidoPaterno], ["APELLIDO MATERNO (PUEDE NO APLICAR)", u.apellidoMaterno], ["CI", u.ci], ["TELÉFONO", u.telefono], ["SEXO", u.sexo]]) if (ausente(valor)) observaciones.push(`${etiqueta}: SIN DATO VÁLIDO`);
    if ((indices.ci.get(normalizarNombreNomina(u.ci))?.size ?? 0) > 1) observaciones.push("CI COMPARTIDO CON OTRA CUENTA; REVISAR IDENTIDAD");
    if (!exactos.size) observaciones.push("COINCIDENCIA POR PALABRAS EN OTRO ORDEN; REVISAR");
    const roles = [...new Set((u.roles ?? []).filter(Boolean).map(r => r!.codigo || r!.nombre || "").filter(Boolean))].sort();
    if (!roles.length) observaciones.push("SIN ROL RESOLUBLE");
    const telefono = texto(u.telefono), digitos = telefono.replace(/\D/g, "");
    const whatsapp = /^[67]\d{7}$/.test(digitos) ? `+591${digitos}` : /^591[67]\d{7}$/.test(digitos) ? `+${digitos}` : "";
    filas.push({ usuarioId, nombres: texto(u.nombres), apellidoPaterno: texto(u.apellidoPaterno), apellidoMaterno: texto(u.apellidoMaterno), nombreCompletoOriginal: nombreCompleto(u), ci: texto(u.ci), ru: texto(u.registroUniversitario), telefono, whatsapp, sexo: texto(u.sexo), roles: roles.join(" / "), estado: texto(u.estado), observaciones });
  }
  const resumen = { solicitudes: lista.length, encontrados: filas.length, noEncontrados: resultados.filter(r => r.estado === "NO ENCONTRADO").length, ambiguos: resultados.filter(r => r.estado === "AMBIGUO").length, repetidos: resultados.filter(r => r.estado === "REPETIDO EN LISTA").length, incompletos: filas.filter(f => f.observaciones.some(o => o.includes("SIN DATO") || o === "SIN ROL RESOLUBLE")).length, requierenRevision: filas.filter(f => f.observaciones.length).length };
  const huella = createHash("sha256").update(JSON.stringify({ resultados, filas })).digest("hex");
  return { resumen, resultados, filas, huella };
}
export type NominaSeparada = ReturnType<typeof resolverNominaSeparada>;

export async function consultarNominaSeparada(lista: string[]) {
  validarListaNomina(lista);
  const [usuarios, codigos] = await Promise.all([
    PerfilUsuario.find({ fechaEliminado: null, estado: { $ne: "ELIMINADO" } }).select("nombres apellidoPaterno apellidoMaterno ci registroUniversitario telefono sexo estado roles").populate("roles", "codigo nombre").lean(),
    Fraterno.find({ fechaEliminado: null }).select("usuarioId numeroFraterno estado fechaEliminado").lean(),
  ]);
  return resolverNominaSeparada(lista, usuarios as unknown as UsuarioNomina[], codigos);
}

export async function generarExcelNominaSeparada(reporte: NominaSeparada, administrador: { id: string; nombre: string }, generadoEn = new Date()) {
  const libro = new ExcelJS.Workbook(); libro.creator = administrador.nombre; libro.created = generadoEn;
  const hoja = libro.addWorksheet("Nómina usuarios");
  hoja.addRow(["ID Usuario", "Nombre", "Apellido Paterno", "Apellido Materno", "Nombre Completo Original", "CI", "RU", "Teléfono", "WhatsApp", "Sexo", "Rol", "Estado Usuario"]);
  for (const f of reporte.filas) hoja.addRow([f.usuarioId, f.nombres, f.apellidoPaterno, f.apellidoMaterno, f.nombreCompletoOriginal, f.ci, f.ru, f.telefono, f.whatsapp, f.sexo, f.roles, f.estado]);
  hoja.views = [{ state: "frozen", ySplit: 1 }]; hoja.autoFilter = "A1:L1";
  hoja.columns.forEach((c, i) => { c.width = i === 4 ? 45 : 25; c.numFmt = "@"; });
  hoja.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  hoja.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF74122A" } };
  const control = libro.addWorksheet("Control de revisión");
  control.addRows([["Generado (UTC)", generadoEn.toISOString()], ["Administrador", administrador.nombre], ["ID administrador", administrador.id], ["Registros exportados", reporte.filas.length], ["Fuente", "Campos separados de PerfilUsuario, sin inferencia de apellidos"], ["WhatsApp", "Derivado del teléfono boliviano válido; vacío si no se reconoce"], ...Object.entries(reporte.resumen), [], ["Entrada", "Estado", "Método", "Candidatos / observaciones"]]);
  for (const r of reporte.resultados) control.addRow([r.entrada, r.estado, r.metodo, r.candidatos.map(c => `${c.nombre} | CI ${c.ci} | ID ${c.usuarioId}`).join(" / ")]);
  for (const f of reporte.filas.filter(f => f.observaciones.length)) control.addRow([f.nombreCompletoOriginal, "REVISAR", f.usuarioId, f.observaciones.join("; ")]);
  control.columns = [{ width: 45 }, { width: 35 }, { width: 35 }, { width: 85 }];
  return Buffer.from(await libro.xlsx.writeBuffer());
}
