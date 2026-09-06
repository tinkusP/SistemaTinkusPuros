import mongoose, { ClientSession, Types } from "mongoose";

const collection = (name: string) => mongoose.connection.db!.collection(name);
const ids = (items: any[]) => items.map((item) => item._id);
const find = (name: string, filter: object, session: ClientSession) => collection(name).find(filter, { session }).toArray();

export async function eliminarUsuarioDefinitivamente(perfilId: string, ciConfirmacion: string, administradorId?: Types.ObjectId) {
  const session = await mongoose.startSession();
  const loteId = new Types.ObjectId();
  const auditFields = ["usuarioCreador", "usuarioEditor", "usuarioAprobador", "usuarioRevisor", "usuarioEliminador", "usuarioHabilitador", "usuarioEvaluador", "usuarioVerificador", "responsableEntrega", "administradorId", "generadoPor", "createdBy", "updatedBy", "approvedBy", "verifiedBy"];
  const names = (await mongoose.connection.db!.listCollections({}, { nameOnly: true }).toArray()).map(({ name }) => name);
  try {
    return await session.withTransaction(async () => {
      const usuario = await collection("perfil_usuarios").findOne({ _id: new Types.ObjectId(perfilId) }, { session });
      if (!usuario) throw Object.assign(new Error("Usuario no encontrado"), { status: 404 });
      if (String(usuario.ci) !== String(ciConfirmacion).trim()) {
        throw Object.assign(new Error("El CI de confirmación no coincide"), { status: 400 });
      }

      const preregistros = await find("preregistros", { usuarioId: usuario._id }, session);
      const preregistroIds = ids(preregistros);
      const fraternos = await find("fraternos", { $or: [{ usuarioId: usuario._id }, { preregistroId: { $in: preregistroIds } }] }, session);
      const fraternoIds = ids(fraternos);
      const guias = await find("guias", { $or: [{ usuarioId: usuario._id }, { preregistroId: { $in: preregistroIds } }] }, session);
      const guiaIds = ids(guias);
      const postulantes = await find("postulantes_guia", { preregistroId: { $in: preregistroIds } }, session);
      const postulanteIds = ids(postulantes);
      const cuotas = await find("cuotas", { preregistroId: { $in: preregistroIds } }, session);
      const cuotaIds = ids(cuotas);
      const idsPropios = [usuario._id, ...preregistroIds, ...fraternoIds, ...guiaIds, ...postulanteIds, ...cuotaIds];
      const detallesBloque = await find("detalle_bloques", { fraternoId: { $in: fraternoIds } }, session);
      const bloques = await find("bloques", { $or: [{ _id: { $in: detallesBloque.map((item) => item.bloqueId) } }, { guiaId: { $in: guiaIds } }, { guiasIds: { $in: guiaIds } }] }, session);
      const filtros: Record<string, object> = {
        detalle_cuotas: { cuotaId: { $in: cuotaIds } },
        tallas_fraterno: { $or: [{ usuarioId: usuario._id }, { fraternoId: { $in: fraternoIds } }] },
        detalle_bloques: { fraternoId: { $in: fraternoIds } },
        asistencias: { $or: [{ usuarioId: usuario._id }, { preregistroId: { $in: preregistroIds } }, { fraternoId: { $in: fraternoIds } }, { postulanteGuiaId: { $in: postulanteIds } }] },
        entregas_indumentaria: { fraternoId: { $in: fraternoIds } },
        meritos_guia: { postulanteGuiaId: { $in: postulanteIds } },
        documentos_usuarios: { perfilUsuario: usuario._id },
        notificaciones: { usuarioId: usuario._id },
        aceptaciones_terminos_pago: { usuarioId: usuario._id },
        autorizaciones_edicion_perfil: { perfilUsuarioId: usuario._id },
        tokens_registro: { $or: [{ utilizadoPor: usuario._id }, { preregistroId: { $in: preregistroIds } }, { cuotaId: { $in: cuotaIds } }, { fraternoId: { $in: fraternoIds } }] },
        traspasos: { $or: [{ usuarioOrigenId: usuario._id }, { usuarioDestinoId: usuario._id }, { preregistroId: { $in: preregistroIds } }, { cuotaId: { $in: cuotaIds } }] },
        pasos_videos: { usuarioAutorId: usuario._id },
        auditoria: { $or: [{ usuarioId: usuario._id }, { entidadId: { $in: idsPropios } }] },
        usuarios_sin_talla: { $or: [{ usuarioId: usuario._id }, { ci: String(usuario.ci) }] },
      };
      const propios: Record<string, any[]> = { perfil_usuarios: [usuario], preregistros, fraternos, guias, postulantes_guia: postulantes, cuotas };
      for (const [name, filter] of Object.entries(filtros)) propios[name] = await find(name, filter, session);
      await collection("respaldos_eliminacion_usuarios").insertOne({ loteId, creadoEn: new Date(), motivo: "Eliminación definitiva desde Gestión Integral", administradorId, ciConfirmado: ciConfirmacion, colecciones: propios }, { session });
      for (const [name, filter] of Object.entries(filtros)) await collection(name).deleteMany(filter, { session });
      await collection("bloques").updateMany({ guiasIds: { $in: guiaIds } }, { $pull: { guiasIds: { $in: guiaIds } } } as any, { session });
      await collection("bloques").updateMany({ guiaId: { $in: guiaIds } }, { $unset: { guiaId: "" } }, { session });
      await collection("postulantes_guia").deleteMany({ _id: { $in: postulanteIds } }, { session });
      await collection("guias").deleteMany({ _id: { $in: guiaIds } }, { session });
      await collection("fraternos").deleteMany({ _id: { $in: fraternoIds } }, { session });
      await collection("cuotas").deleteMany({ _id: { $in: cuotaIds } }, { session });
      await collection("preregistros").deleteMany({ _id: { $in: preregistroIds } }, { session });

      for (const name of names) {
        if (name === "respaldos_eliminacion_usuarios") continue;
        await collection(name).updateMany({ $or: auditFields.map((field) => ({ [field]: usuario._id })) }, { $unset: Object.fromEntries(auditFields.map((field) => [field, ""])) }, { session });
      }
      await collection("perfil_usuarios").deleteOne({ _id: usuario._id }, { session });
      for (const bloque of bloques) {
        const integrantes = await find("detalle_bloques", { bloqueId: bloque._id, estado: "ACTIVO", fechaEliminado: null }, session);
        const guiasActivas = await find("guias", { _id: { $in: bloque.guiasIds ?? [] }, estado: "ACTIVO" }, session);
        const usuariosGuias = await find("perfil_usuarios", { _id: { $in: guiasActivas.map((guia) => guia.usuarioId) } }, session);
        const sexo = new Map(usuariosGuias.map((item) => [String(item._id), item.sexo]));
        await collection("bloques").updateOne({ _id: bloque._id }, { $set: {
          cantidadHombres: integrantes.filter((item) => item.genero === "HOMBRE").length,
          cantidadMujeres: integrantes.filter((item) => item.genero === "MUJER").length,
          cantidadGuiasHombres: guiasActivas.filter((guia) => sexo.get(String(guia.usuarioId)) === "HOMBRE").length,
          cantidadGuiasMujeres: guiasActivas.filter((guia) => sexo.get(String(guia.usuarioId)) === "MUJER").length,
        } }, { session });
      }
      return { message: "Usuario y sus relaciones fueron eliminados definitivamente", loteRespaldo: String(loteId) };
    });
  } finally {
    await session.endSession();
  }
}
