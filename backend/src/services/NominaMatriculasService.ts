import archiver from "archiver";
import path from "node:path";
import { promises as fs } from "node:fs";
import { PassThrough } from "node:stream";
import unzipper from "unzipper";
import Bloque from "../models/Bloque";
import Cuota from "../models/Cuota";
import DetalleBloque from "../models/DetalleBloque";
import DetalleCuota from "../models/DetalleCuota";
import DocumentoUsuario from "../models/DocumentoUsuario";
import Fraterno from "../models/Fraterno";
import Gestion from "../models/Gestion";
import Guia from "../models/Guia";
import PerfilUsuario from "../models/PerfilUsuario";
import PostulanteGuia from "../models/PostulanteGuia";
import Preregistro from "../models/Preregistro";
import TallaFraterno from "../models/TallaFraterno";
import { FILTRO_ASIGNACION_ACTIVA } from "./AsignacionBloqueService";
import { listarArchivosAlmacenados } from "./AlmacenamientoService";

export type TipoOrigenNomina = "INTERNO" | "EXTERNO" | "SIN CLASIFICAR";

export type FilaNominaOficial = {
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  ci: string;
  telefono: string;
  registroUniversitario: string;
};

const PLANTILLA_NOMBRE = "Plantilla_Nomina_TINKUS_PUROS_Y_NATURALES.xlsx";
const MAXIMO_FILAS_PLANTILLA = 80;

const texto = (valor: unknown) => String(valor ?? "").trim();
const id = (valor: unknown) => texto(valor);
const nombreCompleto = (usuario: any) => [usuario?.nombres, usuario?.apellidoPaterno, usuario?.apellidoMaterno].map(texto).filter(Boolean).join(" ");
const redondear = (valor: unknown) => Number(Number(valor ?? 0).toFixed(2));
const normalizarTelefonoLocal = (valor: unknown) => {
  let digitos = texto(valor).replace(/\D/g, "");
  if (digitos.startsWith("591") && digitos.length > 8) digitos = digitos.slice(3);
  return digitos;
};
const whatsapp = (telefono: string) => /^[67]\d{7}$/.test(telefono) ? `+591${telefono}` : "";
const normalizarRol = (rol: any) => texto(rol?.codigo ?? rol?.nombre).toLocaleUpperCase("es");
const agregarRol = (roles: string[], rol: string, condicion = true) => {
  if (condicion && !roles.includes(rol)) roles.push(rol);
};

export function clasificarOrigenNomina(valor: unknown): TipoOrigenNomina {
  const origen = texto(valor).toUpperCase();
  if (["INTERNO", "INTERNO_UMSA"].includes(origen)) return "INTERNO";
  if (["EXTERNO", "EXTERNO_UMSA", "EXTERNO_NO_UMSA"].includes(origen)) return "EXTERNO";
  return "SIN CLASIFICAR";
}

export function validarFilaNomina(fila: FilaNominaOficial) {
  const problemas = [
    !texto(fila.nombres) && "NOMBRES VACÍOS",
    !texto(fila.apellidoPaterno) && "PRIMER APELLIDO VACÍO",
    !/^\d+$/.test(texto(fila.ci)) && "CI DEBE CONTENER SOLO DÍGITOS",
    !/^\d+$/.test(texto(fila.telefono)) && "TELÉFONO DEBE CONTENER SOLO DÍGITOS",
    !texto(fila.registroUniversitario) && "SIN REGISTRO UNIVERSITARIO",
  ].filter(Boolean) as string[];
  return { valida: problemas.length === 0, problemas };
}

function plantillaRuta() {
  const candidatos = [
    path.resolve(__dirname, "../../templates", PLANTILLA_NOMBRE),
    path.resolve(process.cwd(), "backend/templates", PLANTILLA_NOMBRE),
    path.resolve(process.cwd(), "templates", PLANTILLA_NOMBRE),
  ];
  return candidatos;
}

export async function leerPlantillaNomina() {
  for (const candidato of plantillaRuta()) {
    try {
      return await fs.readFile(candidato);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  throw new Error(`No se encontró la plantilla oficial ${PLANTILLA_NOMBRE}`);
}

const escaparXml = (valor: unknown) => texto(valor)
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&apos;");

function escribirCelda(xml: string, referencia: string, valor: string) {
  const patron = new RegExp(`<c r="${referencia}" s="(\\d+)"\\s*/>`);
  if (!patron.test(xml)) throw new Error(`La plantilla oficial no contiene la celda ${referencia}`);
  return xml.replace(patron, (_celda, estilo) => `<c r="${referencia}" s="${estilo}" t="inlineStr"><is><t xml:space="preserve">${escaparXml(valor)}</t></is></c>`);
}

async function empaquetarArchivos(archivos: Array<{ nombre: string; contenido: Buffer }>) {
  const salida = new PassThrough();
  const partes: Buffer[] = [];
  salida.on("data", (parte) => partes.push(Buffer.from(parte)));
  const terminado = new Promise<Buffer>((resolve, reject) => {
    salida.on("end", () => resolve(Buffer.concat(partes)));
    salida.on("error", reject);
  });
  const zip = archiver("zip", { zlib: { level: 9 } });
  zip.on("error", (error) => salida.destroy(error));
  zip.pipe(salida);
  archivos.forEach((archivo) => zip.append(archivo.contenido, { name: archivo.nombre }));
  await zip.finalize();
  return terminado;
}

export async function rellenarPlantillaNomina(plantilla: Buffer, filas: FilaNominaOficial[]) {
  if (!filas.length) throw new Error("No existen personas listas para la nómina oficial");
  if (filas.length > MAXIMO_FILAS_PLANTILLA) {
    throw new Error(`La plantilla oficial admite un máximo de ${MAXIMO_FILAS_PLANTILLA} personas por archivo`);
  }
  filas.forEach((fila, indice) => {
    const validacion = validarFilaNomina(fila);
    if (!validacion.valida) throw new Error(`Fila ${indice + 1}: ${validacion.problemas.join("; ")}`);
  });

  const directorio = await unzipper.Open.buffer(plantilla);
  const archivos: Array<{ nombre: string; contenido: Buffer }> = [];
  for (const archivo of directorio.files) {
    let contenido = await archivo.buffer();
    if (archivo.path === "xl/worksheets/sheet2.xml") {
      let xml = contenido.toString("utf8");
      filas.forEach((fila, indice) => {
        const numeroFila = indice + 7;
        const valores = [fila.nombres, fila.apellidoPaterno, fila.apellidoMaterno, fila.ci, fila.telefono, fila.registroUniversitario];
        ["A", "B", "C", "D", "E", "F"].forEach((columna, columnaIndice) => {
          xml = escribirCelda(xml, `${columna}${numeroFila}`, valores[columnaIndice]);
        });
      });
      contenido = Buffer.from(xml, "utf8");
    }
    archivos.push({ nombre: archivo.path, contenido });
  }
  return empaquetarArchivos(archivos);
}

export async function generarNominaOficial(filas: FilaNominaOficial[]) {
  return rellenarPlantillaNomina(await leerPlantillaNomina(), filas);
}

export async function obtenerNominaMatriculas(gestionId?: string) {
  const gestion: any = gestionId
    ? await Gestion.findById(gestionId).lean()
    : await Gestion.findOne({ estado: { $in: ["ACTIVA", "INSCRIPCIONES"] }, fechaEliminado: null }).sort({ anio: -1 }).lean();

  const documentos: any[] = await DocumentoUsuario.find({
    tipoDocumento: "REGISTRO_UNIVERSITARIO",
    fechaEliminado: null,
    estado: { $ne: "ELIMINADO" },
    ruta: { $nin: [null, ""] },
  }).sort({ fechaCreado: -1, _id: -1 }).lean();
  let archivosDisponibles: Set<string> | null = null;
  try {
    archivosDisponibles = new Set((await listarArchivosAlmacenados()).map((archivo) => archivo.key.replace(/^\/+/, "")));
  } catch (error) {
    console.warn("No se pudo verificar físicamente el almacenamiento de matrículas", error instanceof Error ? error.message : error);
  }
  const usuarioIds = [...new Set(documentos.map((documento) => id(documento.perfilUsuario)))];
  const usuarios: any[] = usuarioIds.length
    ? await PerfilUsuario.find({ _id: { $in: usuarioIds }, fechaEliminado: null, estado: { $ne: "ELIMINADO" } })
      .select("nombres apellidoPaterno apellidoMaterno ci sexo telefono email roles tipoOrigen tipoFraterno registroUniversitario facultad carrera estado fechaCreado")
      .populate({ path: "roles", select: "codigo nombre estado fechaEliminado" }).lean()
    : [];

  const idsUsuariosValidos = usuarios.map((usuario) => usuario._id);
  const preregistros: any[] = gestion ? await Preregistro.find({ usuarioId: { $in: idsUsuariosValidos }, gestionId: gestion._id, fechaEliminado: null }).lean() : [];
  const preregistroIds = preregistros.map((preregistro) => preregistro._id);
  const [fraternos, guias, postulantes, cuotas]: any[][] = gestion ? await Promise.all([
    Fraterno.find({ usuarioId: { $in: idsUsuariosValidos }, gestionId: gestion._id, fechaEliminado: null }).lean(),
    Guia.find({ usuarioId: { $in: idsUsuariosValidos }, gestionId: gestion._id, estado: "ACTIVO" }).lean(),
    PostulanteGuia.find({ preregistroId: { $in: preregistroIds }, fechaEliminado: null, estado: { $nin: ["RETIRADO", "NO_ELEGIDO"] } }).lean(),
    Cuota.find({ preregistroId: { $in: preregistroIds }, fechaEliminado: null }).lean(),
  ]) : [[], [], [], []];
  const fraternoIds = fraternos.map((fraterno) => fraterno._id);
  const guiaIds = guias.map((guia) => guia._id);
  const [asignaciones, bloquesGuia, tallas, pagos]: any[][] = await Promise.all([
    fraternoIds.length ? DetalleBloque.find({ fraternoId: { $in: fraternoIds }, ...FILTRO_ASIGNACION_ACTIVA }).populate({ path: "bloqueId", match: { estado: "ACTIVO" }, select: "nombre" }).lean() : [],
    gestion && guiaIds.length ? Bloque.find({ gestionId: gestion._id, estado: "ACTIVO", $or: [{ guiaId: { $in: guiaIds } }, { guiasIds: { $in: guiaIds } }] }).select("nombre guiaId guiasIds").lean() : [],
    TallaFraterno.find({ $or: [{ usuarioId: { $in: idsUsuariosValidos } }, { fraternoId: { $in: fraternoIds } }] }).lean(),
    DetalleCuota.find({ cuotaId: { $in: cuotas.map((cuota) => cuota._id) }, fechaEliminado: null }).sort({ numeroPago: 1, fechaPago: 1 }).lean(),
  ]);

  const documentosPorUsuario = new Map<string, any[]>();
  documentos.forEach((documento) => documentosPorUsuario.set(id(documento.perfilUsuario), [...(documentosPorUsuario.get(id(documento.perfilUsuario)) ?? []), documento]));
  const preregistroPorUsuario = new Map(preregistros.map((registro) => [id(registro.usuarioId), registro]));
  const fraternoPorUsuario = new Map(fraternos.map((registro) => [id(registro.usuarioId), registro]));
  const guiaPorUsuario = new Map(guias.map((registro) => [id(registro.usuarioId), registro]));
  const postulantePorPreregistro = new Map(postulantes.map((registro) => [id(registro.preregistroId), registro]));
  const cuotaPorPreregistro = new Map(cuotas.map((registro) => [id(registro.preregistroId), registro]));
  const pagosPorCuota = new Map<string, any[]>();
  pagos.forEach((pago) => pagosPorCuota.set(id(pago.cuotaId), [...(pagosPorCuota.get(id(pago.cuotaId)) ?? []), pago]));
  const bloquePorFraterno = new Map(asignaciones.filter((asignacion) => asignacion.bloqueId).map((asignacion) => [id(asignacion.fraternoId), asignacion.bloqueId]));
  const bloquePorGuia = new Map<string, any>();
  bloquesGuia.forEach((bloque) => [...(bloque.guiasIds ?? []), bloque.guiaId].filter(Boolean).forEach((guiaId) => bloquePorGuia.set(id(guiaId), bloque)));
  const tallaPorUsuario = new Map(tallas.filter((talla) => talla.usuarioId).map((talla) => [id(talla.usuarioId), talla]));
  const tallaPorFraterno = new Map(tallas.filter((talla) => talla.fraternoId).map((talla) => [id(talla.fraternoId), talla]));

  const personas: any[] = usuarios.map((usuario) => {
    const documentosUsuario = documentosPorUsuario.get(id(usuario._id)) ?? [];
    const documento = documentosUsuario.find((registro) => registro.estado === "APROBADO") ?? documentosUsuario[0];
    const preregistro: any = preregistroPorUsuario.get(id(usuario._id));
    const fraterno: any = fraternoPorUsuario.get(id(usuario._id));
    const guia: any = guiaPorUsuario.get(id(usuario._id));
    const postulante: any = preregistro ? postulantePorPreregistro.get(id(preregistro._id)) : null;
    const cuota: any = preregistro ? cuotaPorPreregistro.get(id(preregistro._id)) : null;
    const pagosCuota = cuota ? pagosPorCuota.get(id(cuota._id)) ?? [] : [];
    const pagosVerificados = pagosCuota.filter((pago) => pago.estadoRevision === "VERIFICADO");
    const pagosPendientes = pagosCuota.filter((pago) => pago.estadoRevision === "PENDIENTE");
    const montoVerificado = redondear(pagosVerificados.reduce((total, pago) => total + Number(pago.monto ?? 0), 0));
    const montoRegistrado = redondear(pagosCuota.reduce((total, pago) => total + Number(pago.monto ?? 0), 0));
    const montoPendiente = redondear(pagosPendientes.reduce((total, pago) => total + Number(pago.monto ?? 0), 0));
    const talla: any = (fraterno && tallaPorFraterno.get(id(fraterno._id))) ?? tallaPorUsuario.get(id(usuario._id));
    const bloqueIntegrante: any = fraterno ? bloquePorFraterno.get(id(fraterno._id)) : null;
    const bloqueGuia: any = guia ? bloquePorGuia.get(id(guia._id)) : null;
    const bloque = bloqueGuia?.nombre ?? bloqueIntegrante?.nombre ?? "SIN BLOQUE";
    const asignacion = bloqueGuia ? `GUÍA DEL ${bloque}` : bloqueIntegrante ? `FRATERNO DEL ${bloque}` : postulante ? "POSTULANTE A GUÍA SIN BLOQUE" : "SIN ASIGNACIÓN";
    const roles = (usuario.roles ?? []).filter((rol: any) => rol && rol.estado !== false && !rol.fechaEliminado).map(normalizarRol).filter(Boolean);
    agregarRol(roles, "FRATERNO", Boolean(fraterno));
    agregarRol(roles, "GUIA", Boolean(guia));
    agregarRol(roles, "POSTULANTE_GUIA", Boolean(postulante));
    const telefono = normalizarTelefonoLocal(usuario.telefono);
    const filaOficial: FilaNominaOficial = {
      nombres: texto(usuario.nombres), apellidoPaterno: texto(usuario.apellidoPaterno), apellidoMaterno: texto(usuario.apellidoMaterno),
      ci: texto(usuario.ci), telefono, registroUniversitario: texto(usuario.registroUniversitario),
    };
    const validacion = validarFilaNomina(filaOficial);
    const rutaDocumento = texto(documento?.ruta).replace(/^\/+/, "");
    const archivoDisponible = archivosDisponibles ? archivosDisponibles.has(rutaDocumento) : null;
    const inconsistencias = [
      ...validacion.problemas,
      documentosUsuario.length > 1 && `${documentosUsuario.length} DOCUMENTOS ACTIVOS DE MATRÍCULA`,
      !texto(documento?.ruta) && "DOCUMENTO SIN RUTA",
      archivoDisponible === false && "ARCHIVO FÍSICO NO ENCONTRADO",
      clasificarOrigenNomina(usuario.tipoOrigen) === "SIN CLASIFICAR" && "ORIGEN SIN CLASIFICAR",
    ].filter(Boolean) as string[];
    return {
      usuarioId: id(usuario._id), documentoId: id(documento?._id), preregistroId: id(preregistro?._id), fraternoId: id(fraterno?._id),
      nombres: filaOficial.nombres, apellidoPaterno: filaOficial.apellidoPaterno, apellidoMaterno: filaOficial.apellidoMaterno,
      nombreCompleto: nombreCompleto(usuario), ci: filaOficial.ci, sexo: texto(usuario.sexo) || "SIN REGISTRO", telefono, whatsapp: whatsapp(telefono),
      telefonoRegistrado: texto(usuario.telefono), email: texto(usuario.email), roles: [...new Set(roles)].sort(),
      tipoOrigen: clasificarOrigenNomina(usuario.tipoOrigen), origenRegistrado: texto(usuario.tipoOrigen) || "SIN REGISTRO",
      tipoFraterno: texto(usuario.tipoFraterno) || "SIN REGISTRO", facultad: texto(usuario.facultad), carrera: texto(usuario.carrera),
      bloque: texto(bloque), asignacion, codigoFraterno: texto(fraterno?.numeroFraterno), numeroPreregistro: texto(preregistro?.numeroPreRegistro),
      registroUniversitario: filaOficial.registroUniversitario, numeroMatricula: null,
      estadoDocumento: texto(documento?.estado), observacionDocumento: texto(documento?.observacion),
      fechaCargaMatricula: documento?.fechaCreado ?? null, nombreArchivo: path.basename(texto(documento?.ruta)), extensionArchivo: path.extname(texto(documento?.ruta)).toLowerCase(), archivoDisponible,
      tallaPolera: texto(talla?.tallaPolera), tallaChamarra: texto(talla?.tallaChamarra),
      pago: { estado: texto(cuota?.estado) || "SIN REGISTRO", plan: cuota?.numeroCuotasElegidas ?? null, montoTotal: redondear(cuota?.montoTotal), montoRegistrado, montoVerificado, montoPendienteRevision: montoPendiente, saldo: redondear(cuota?.saldo), cuotasVerificadas: pagosVerificados.length, cuotasPendientesRevision: pagosPendientes.length },
      listoNomina: validacion.valida, inconsistencias,
    };
  });

  const contar = (campo: "ci" | "registroUniversitario") => {
    const conteo = new Map<string, number>();
    personas.forEach((persona) => { const valor = texto(persona[campo]).toUpperCase(); if (valor) conteo.set(valor, (conteo.get(valor) ?? 0) + 1); });
    return conteo;
  };
  const ciConteo = contar("ci"), ruConteo = contar("registroUniversitario");
  personas.forEach((persona) => {
    if ((ciConteo.get(texto(persona.ci).toUpperCase()) ?? 0) > 1) persona.inconsistencias.push("CI DUPLICADO");
    if (persona.registroUniversitario && (ruConteo.get(texto(persona.registroUniversitario).toUpperCase()) ?? 0) > 1) persona.inconsistencias.push("RU DUPLICADO");
    persona.listoNomina = persona.listoNomina && !persona.inconsistencias.some((problema: string) => problema.includes("DUPLICADO") || problema.includes("DOCUMENTOS ACTIVOS") || problema.includes("SIN RUTA") || problema.includes("ARCHIVO FÍSICO"));
  });
  personas.sort((a, b) => `${a.apellidoPaterno} ${a.apellidoMaterno} ${a.nombres}`.localeCompare(`${b.apellidoPaterno} ${b.apellidoMaterno} ${b.nombres}`, "es", { sensitivity: "base" }));

  return {
    generadoEn: new Date(),
    gestion: gestion ? { _id: id(gestion._id), nombre: gestion.nombre, anio: gestion.anio } : null,
    plantilla: { nombre: PLANTILLA_NOMBRE, capacidad: MAXIMO_FILAS_PLANTILLA },
    resumen: {
      totalConMatricula: personas.length,
      internos: personas.filter((p) => p.tipoOrigen === "INTERNO").length,
      externos: personas.filter((p) => p.tipoOrigen === "EXTERNO").length,
      sinClasificar: personas.filter((p) => p.tipoOrigen === "SIN CLASIFICAR").length,
      hombres: personas.filter((p) => p.sexo === "HOMBRE").length,
      mujeres: personas.filter((p) => p.sexo === "MUJER").length,
      conBloque: personas.filter((p) => p.bloque !== "SIN BLOQUE").length,
      sinBloque: personas.filter((p) => p.bloque === "SIN BLOQUE").length,
      conRu: personas.filter((p) => p.registroUniversitario).length,
      sinRu: personas.filter((p) => !p.registroUniversitario).length,
      listosNomina: personas.filter((p) => p.listoNomina).length,
      inconsistencias: personas.filter((p) => p.inconsistencias.length).length,
    },
    bloques: [...new Set(personas.map((persona) => persona.bloque))].sort(),
    roles: [...new Set(personas.flatMap((persona) => persona.roles))].sort(),
    personas,
  };
}

export function filasOficiales(personas: any[]): FilaNominaOficial[] {
  return personas.map((persona) => ({
    nombres: texto(persona.nombres), apellidoPaterno: texto(persona.apellidoPaterno), apellidoMaterno: texto(persona.apellidoMaterno),
    ci: texto(persona.ci), telefono: texto(persona.telefono), registroUniversitario: texto(persona.registroUniversitario),
  }));
}
