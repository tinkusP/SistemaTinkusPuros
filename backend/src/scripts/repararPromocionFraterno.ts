import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../config/db";
import PerfilUsuario from "../models/PerfilUsuario";
import Preregistro from "../models/Preregistro";
import Cuota from "../models/Cuota";
import DetalleCuota from "../models/DetalleCuota";
import Fraterno from "../models/Fraterno";
import { promoverAFraternoSiCorresponde } from "../services/FraternoService";

async function ejecutar() {
  await connectDB();
  const ci = process.argv.find((argumento) => argumento.startsWith("--ci="))?.slice(5);
  const aplicar = process.argv.includes("--apply");
  if (!ci) throw new Error("Debes indicar --ci=<carnet>");
  const usuario = await PerfilUsuario.findOne({ ci, fechaEliminado: null }).select("_id ci estado roles").lean();
  if (!usuario) throw new Error("Usuario no encontrado");
  const preregistro = await Preregistro.findOne({ usuarioId: usuario._id, fechaEliminado: null }).sort({ fechaRegistro: -1 }).lean();
  const cuota = preregistro ? await Cuota.findOne({ preregistroId: preregistro._id, fechaEliminado: null }).lean() : null;
  const pagos = cuota ? await DetalleCuota.find({ cuotaId: cuota._id, fechaEliminado: null }).select("_id numeroPago monto estadoRevision").lean() : [];
  const fraternoAntes = preregistro ? await Fraterno.findOne({ $or: [{ preregistroId: preregistro._id }, { usuarioId: usuario._id, gestionId: preregistro.gestionId }] }).lean() : null;
  const puedePromover = Boolean(preregistro && cuota && pagos.some((pago) => pago.estadoRevision === "VERIFICADO") && !fraternoAntes);
  console.log(JSON.stringify({ modo: aplicar ? "APLICAR" : "DRY_RUN", ci, usuarioId: usuario._id, preregistroId: preregistro?._id ?? null, cuotaId: cuota?._id ?? null, pagos, fraternoAntes, puedePromover, cambiosPropuestos: puedePromover ? ["CREAR FRATERNO CON CÓDIGO DEFINITIVO ATÓMICO", "AGREGAR ROL FRATERNO", "RETIRAR ROL POSTULANTE", "CONSERVAR CUOTA Y PAGOS"] : [] }, null, 2));
  if (!aplicar) return;
  if (!cuota) throw new Error("No existe cuota relacionada");
  const fraterno = await promoverAFraternoSiCorresponde(String(cuota._id));
  if (!fraterno) throw new Error("La promoción no cumplió sus condiciones");
  console.log(JSON.stringify({ resultado: "REPARADO", ci, fraternoId: fraterno._id, codigo: fraterno.numeroFraterno }, null, 2));
}

ejecutar().then(() => mongoose.disconnect()).catch(async (error) => { console.error(error); await mongoose.disconnect(); process.exitCode = 1; });
