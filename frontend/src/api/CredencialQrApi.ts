import api from "@/lib/axios";
import { obtenerMensajeError } from "./apiError";

export type IdentidadQr = { valida: boolean; usuario: { _id: string; nombres: string; apellidoPaterno: string; apellidoMaterno?: string; ci: string; fotoPerfil?: string; email: string; estado: string; roles: { nombre: string; codigo: string }[] }; fraterno: { _id: string; numeroFraterno: string; estado: string } | null; talla: { tallaPolera: string; tallaChamarra: string; fechaActualizado?: string } | null; pago: { tieneCuota: boolean; envioBaucher: boolean; primeraCuotaVerificada: boolean; estadoPrimeraCuota: "NO_ENVIADA" | "PENDIENTE" | "VERIFICADO" | "OBSERVADO" | "RECHAZADO"; primeraCuotaMonto: number | null; montoPagado: number; saldo: number | null; estadoCuota: string | null; numeroPreRegistro: string | null } };

export async function miCredencialQr() {
  try { return (await api.get("/credenciales-qr/mia")).data as { token: string; nombre: string; ci: string; fotoPerfil?: string }; }
  catch (e) { throw new Error(obtenerMensajeError(e, "No se pudo generar la credencial")); }
}

export async function verificarCredencialQr(token: string) {
  try { return (await api.post("/credenciales-qr/verificar", { token })).data as IdentidadQr; }
  catch (e) { throw new Error(obtenerMensajeError(e, "No se pudo verificar el QR")); }
}

export async function marcarAsistenciaQr(token: string) {
  try { return (await api.post("/asistencias/entrada-qr", { token })).data as { message: string; asistencia: { horaEntrada: string } }; }
  catch (e) { throw new Error(obtenerMensajeError(e, "No se pudo marcar la asistencia")); }
}
