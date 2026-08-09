import Cuota from "../models/Cuota";
import Fraterno from "../models/Fraterno";
import PerfilUsuario from "../models/PerfilUsuario";
import Preregistro from "../models/Preregistro";
import Rol from "../models/Rol";
import Asistencia from "../models/Asistencia";
import DetalleCuota from "../models/DetalleCuota";

export async function promoverAFraternoSiCorresponde(cuotaId: string, usuarioCreador?: unknown) {
  const cuota = await Cuota.findById(cuotaId);
  if (!cuota || cuota.cupoLiberado) return null;

  // La condición para adquirir la calidad de fraterno es contar con al menos
  // un pago revisado y verificado. La deuda restante continúa en la cuota.
  const tienePagoVerificado = await DetalleCuota.exists({
    cuotaId: cuota._id,
    estadoRevision: "VERIFICADO",
    fechaEliminado: null,
  });
  if (!tienePagoVerificado) return null;

  const existente = await Fraterno.findOne({ preregistroId: cuota.preregistroId });
  if (existente) return existente;

  const preregistro = await Preregistro.findOne({ _id: cuota.preregistroId, fechaEliminado: null });
  if (!preregistro) return null;

  const correlativo = String((await Fraterno.countDocuments({ gestionId: preregistro.gestionId })) + 1).padStart(4, "0");
  const numeroFraterno = `FRA-${new Date().getFullYear()}-${correlativo}`;
  const fraterno = await Fraterno.create({
    preregistroId: preregistro._id,
    usuarioId: preregistro.usuarioId,
    gestionId: preregistro.gestionId,
    numeroFraterno,
    usuarioCreador,
  });

  const rol = await Rol.findOne({ codigo: "FRATERNO", estado: true, fechaEliminado: null }).select("_id");
  const rolPostulante = await Rol.findOne({ codigo: "POSTULANTE", estado: true, fechaEliminado: null }).select("_id");
  if (rol) await PerfilUsuario.updateOne({ _id: preregistro.usuarioId }, { $addToSet: { roles: rol._id } });
  if (rolPostulante) await PerfilUsuario.updateOne({ _id: preregistro.usuarioId }, { $pull: { roles: rolPostulante._id } });
  preregistro.estado = "APROBADO";
  preregistro.aprobado = true;
  await preregistro.save();
  await Asistencia.updateMany(
    { usuarioId: preregistro.usuarioId, gestionId: preregistro.gestionId, fraternoId: { $exists: false } },
    { $set: { fraternoId: fraterno._id } },
  );
  return fraterno;
}
