import mongoose, { ClientSession, Types } from "mongoose";
import { connectDB } from "../config/db";

type Objetivo = { ci: string; complemento?: string; nombre: string; email?: string };
const OBJETIVOS: readonly Objetivo[] = [
  { ci: "1234567890", nombre: "CONDORI PPP MONTES", email: "aa@gmail.com" },
] as const;

const nombreCompleto = (u: any) => [u.nombres, u.apellidoPaterno, u.apellidoMaterno].filter(Boolean).join(" ").trim().toUpperCase();
const coleccion = (nombre: string) => mongoose.connection.db!.collection(nombre);
const docs = (nombre: string, filtro: object, session?: ClientSession) => coleccion(nombre).find(filtro, { session }).toArray();

async function contexto(objetivo: Objetivo, session?: ClientSession) {
  const usuario = await coleccion("perfil_usuarios").findOne({ ci: objetivo.ci, ...(objetivo.complemento ? { complementoCi: objetivo.complemento } : {}) }, { session });
  if (!usuario) throw new Error(`No existe el CI ${objetivo.ci}${objetivo.complemento ? `-${objetivo.complemento}` : ""}`);
  if (nombreCompleto(usuario) !== objetivo.nombre) throw new Error(`El nombre no coincide para CI ${objetivo.ci}: ${nombreCompleto(usuario)}`);
  if (objetivo.email && String(usuario.email ?? "").trim().toLowerCase() !== objetivo.email) throw new Error(`El correo no coincide para CI ${objetivo.ci}`);
  const preregistros = await docs("preregistros", { usuarioId: usuario._id }, session), preregistroIds = preregistros.map((x) => x._id);
  const fraternos = await docs("fraternos", { $or: [{ usuarioId: usuario._id }, { preregistroId: { $in: preregistroIds } }] }, session), fraternoIds = fraternos.map((x) => x._id);
  const guias = await docs("guias", { $or: [{ usuarioId: usuario._id }, { preregistroId: { $in: preregistroIds } }] }, session), guiaIds = guias.map((x) => x._id);
  const postulantes = await docs("postulantes_guia", { preregistroId: { $in: preregistroIds } }, session), postulanteIds = postulantes.map((x) => x._id);
  const cuotas = await docs("cuotas", { preregistroId: { $in: preregistroIds } }, session), cuotaIds = cuotas.map((x) => x._id);
  const filtros: Record<string, object> = {
    detalle_cuotas: { cuotaId: { $in: cuotaIds } }, tallas_fraterno: { $or: [{ usuarioId: usuario._id }, { fraternoId: { $in: fraternoIds } }] }, detalle_bloques: { fraternoId: { $in: fraternoIds } },
    asistencias: { $or: [{ usuarioId: usuario._id }, { preregistroId: { $in: preregistroIds } }, { fraternoId: { $in: fraternoIds } }, { postulanteGuiaId: { $in: postulanteIds } }] }, entregas_indumentaria: { fraternoId: { $in: fraternoIds } }, meritos_guia: { postulanteGuiaId: { $in: postulanteIds } },
    documentos_usuarios: { perfilUsuario: usuario._id }, notificaciones: { usuarioId: usuario._id }, aceptaciones_terminos_pago: { usuarioId: usuario._id }, autorizaciones_edicion_perfil: { perfilUsuarioId: usuario._id },
    tokens_registro: { $or: [{ utilizadoPor: usuario._id }, { preregistroId: { $in: preregistroIds } }, { cuotaId: { $in: cuotaIds } }, { fraternoId: { $in: fraternoIds } }] }, traspasos: { $or: [{ usuarioOrigenId: usuario._id }, { usuarioDestinoId: usuario._id }, { preregistroId: { $in: preregistroIds } }, { cuotaId: { $in: cuotaIds } }] }, pasos_videos: { usuarioAutorId: usuario._id }, auditoria: { $or: [{ usuarioId: usuario._id }, { entidadId: usuario._id }] },
  };
  const encontrados: Record<string, any[]> = { perfil_usuarios: [usuario], preregistros, fraternos, guias, postulantes_guia: postulantes, cuotas };
  for (const [nombre, filtro] of Object.entries(filtros)) encontrados[nombre] = await docs(nombre, filtro, session);
  const bloques = await docs("bloques", { $or: [{ guiaId: { $in: guiaIds } }, { guiasIds: { $in: guiaIds } }, { _id: { $in: encontrados.detalle_bloques.map((x) => x.bloqueId) } }] }, session);
  encontrados.bloques_afectados = bloques;
  return { objetivo, usuario, preregistroIds, fraternoIds, guiaIds, postulanteIds, cuotaIds, filtros, encontrados, bloques };
}

async function recalcularBloques(ids: Types.ObjectId[], session: ClientSession) {
  for (const id of ids) {
    const [integrantes, bloque] = await Promise.all([docs("detalle_bloques", { bloqueId: id, estado: "ACTIVO", fechaEliminado: null }, session), coleccion("bloques").findOne({ _id: id }, { session })]);
    if (!bloque) continue;
    const guias = await docs("guias", { _id: { $in: bloque.guiasIds ?? [] }, estado: "ACTIVO" }, session);
    const usuarios = await docs("perfil_usuarios", { _id: { $in: guias.map((g) => g.usuarioId) } }, session);
    const sexoPorUsuario = new Map(usuarios.map((u) => [String(u._id), u.sexo]));
    await coleccion("bloques").updateOne({ _id: id }, { $set: { cantidadHombres: integrantes.filter((x) => x.genero === "HOMBRE").length, cantidadMujeres: integrantes.filter((x) => x.genero === "MUJER").length, cantidadGuiasHombres: guias.filter((g) => sexoPorUsuario.get(String(g.usuarioId)) === "HOMBRE").length, cantidadGuiasMujeres: guias.filter((g) => sexoPorUsuario.get(String(g.usuarioId)) === "MUJER").length } }, { session });
  }
}

async function ejecutar() {
  await connectDB();
  const ejecutarBorrado = process.argv.includes("--execute");
  const auditoria = [];
  for (const objetivo of OBJETIVOS) {
    const ctx = await contexto(objetivo);
    auditoria.push({ ci: `${objetivo.ci}${objetivo.complemento ? `-${objetivo.complemento}` : ""}`, nombre: objetivo.nombre, registros: Object.fromEntries(Object.entries(ctx.encontrados).map(([k, v]) => [k, v.length])) });
  }
  console.log(JSON.stringify({ modo: ejecutarBorrado ? "EJECUCION" : "DRY_RUN", auditoria }, null, 2));
  if (!ejecutarBorrado) return;

  const session = await mongoose.startSession();
  const idRespaldo = new Types.ObjectId();
  try {
    const nombresColecciones = (await mongoose.connection.db!.listCollections({}, { nameOnly: true }).toArray()).map((item) => item.name);
    const referenciasAuditoria = ["usuarioCreador", "usuarioEditor", "usuarioAprobador", "usuarioRevisor", "usuarioEliminador", "usuarioHabilitador", "usuarioEvaluador", "usuarioVerificador", "responsableEntrega", "administradorId", "generadoPor", "createdBy", "updatedBy", "approvedBy", "verifiedBy"];
    await session.withTransaction(async () => {
      const usuariosObjetivo: Types.ObjectId[] = [];
      for (const objetivo of OBJETIVOS) {
        const ctx = await contexto(objetivo, session);
        usuariosObjetivo.push(ctx.usuario._id);
        await coleccion("respaldos_eliminacion_usuarios").insertOne({ loteId: idRespaldo, creadoEn: new Date(), motivo: "Eliminación definitiva adicional autorizada", objetivo, colecciones: ctx.encontrados }, { session });
        for (const [nombre, filtro] of Object.entries(ctx.filtros)) await coleccion(nombre).deleteMany(filtro, { session });
        await coleccion("meritos_guia").deleteMany({ postulanteGuiaId: { $in: ctx.postulanteIds } }, { session });
        await coleccion("bloques").updateMany({ guiasIds: { $in: ctx.guiaIds } }, { $pull: { guiasIds: { $in: ctx.guiaIds } } } as any, { session });
        await coleccion("bloques").updateMany({ guiaId: { $in: ctx.guiaIds } }, { $unset: { guiaId: "" } }, { session });
        await coleccion("postulantes_guia").deleteMany({ _id: { $in: ctx.postulanteIds } }, { session });
        await coleccion("guias").deleteMany({ _id: { $in: ctx.guiaIds } }, { session });
        await coleccion("fraternos").deleteMany({ _id: { $in: ctx.fraternoIds } }, { session });
        await coleccion("cuotas").deleteMany({ _id: { $in: ctx.cuotaIds } }, { session });
        await coleccion("preregistros").deleteMany({ _id: { $in: ctx.preregistroIds } }, { session });
        await coleccion("perfil_usuarios").deleteOne({ _id: ctx.usuario._id }, { session });
        await recalcularBloques(ctx.bloques.map((b) => b._id), session);
      }
      const filtroReferencias = { $or: referenciasAuditoria.map((campo) => ({ [campo]: { $in: usuariosObjetivo } })) };
      const limpiarReferencias = { $unset: Object.fromEntries(referenciasAuditoria.map((campo) => [campo, ""])) };
      for (const nombreColeccion of nombresColecciones) {
        if (nombreColeccion === "respaldos_eliminacion_usuarios") continue;
        await coleccion(nombreColeccion).updateMany(filtroReferencias, limpiarReferencias, { session });
      }
    });
  } finally { await session.endSession(); }
  const restantes = [];
  for (const objetivo of OBJETIVOS) restantes.push(await coleccion("perfil_usuarios").countDocuments({ ci: objetivo.ci, ...(objetivo.complemento ? { complementoCi: objetivo.complemento } : {}) }));
  console.log(JSON.stringify({ loteRespaldo: String(idRespaldo), usuariosRestantes: restantes, correcto: restantes.every((n) => n === 0) }));
}

ejecutar().then(() => mongoose.disconnect()).catch(async (error) => { console.error(error); await mongoose.disconnect(); process.exit(1); });
