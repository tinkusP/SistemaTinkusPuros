import api from "@/lib/axios";
import { obtenerMensajeError } from "./apiError";

export type RolIdentidad = { nombre: string; codigo: string };
export type ResultadoBusquedaIdentidad = { _id: string; nombres: string; apellidoPaterno: string; apellidoMaterno?: string; ci: string; fotoPerfil?: string; roles: RolIdentidad[] };
export type IdentidadQr = { valida: boolean; metodoIdentificacion: "QR" | "BUSQUEDA_MANUAL"; bloque: string; usuario: { _id: string; nombres: string; apellidoPaterno: string; apellidoMaterno?: string; ci: string; fotoPerfil?: string; email: string; estado: string; roles: RolIdentidad[] }; fraterno: { _id: string; numeroFraterno: string; estado: string } | null; talla: { tallaPolera: string; tallaChamarra: string; fechaActualizado?: string } | null; pago: { tieneCuota: boolean; envioBaucher: boolean; primeraCuotaVerificada: boolean; estadoPrimeraCuota: "NO_ENVIADA" | "PENDIENTE" | "VERIFICADO" | "OBSERVADO" | "RECHAZADO"; primeraCuotaMonto: number | null; montoPagado: number; saldo: number | null; estadoCuota: string | null; numeroPreRegistro: string | null; numeroCuotas: number; cuotasPagadas: number; estadoGeneral: "SIN_PAGOS" | "PAGO_COMPLETO" | "PAGO_PARCIAL"; detalleCuotas: Array<{ numero: number; montoProgramado: number; montoRegistrado: number; estado: "PAGADO" | "EN_REVISION" | "OBSERVADO" | "RECHAZADO" | "PENDIENTE"; fechaPago: string | null }> } };

export async function miCredencialQr() {
  try { return (await api.get("/credenciales-qr/mia")).data as { token: string; nombre: string; ci: string; fotoPerfil?: string }; }
  catch (e) { throw new Error(obtenerMensajeError(e, "No se pudo generar la credencial")); }
}

export async function verificarCredencialQr(token: string) {
  try { return (await api.post("/credenciales-qr/verificar", { token })).data as IdentidadQr; }
  catch (e) { throw new Error(obtenerMensajeError(e, "No se pudo verificar el QR")); }
}

export async function buscarIdentidades(q: string) {
  try { return (await api.get("/credenciales-qr/buscar", { params: { q } })).data as { resultados: ResultadoBusquedaIdentidad[] }; }
  catch (e) { throw new Error(obtenerMensajeError(e, "No se pudo realizar la búsqueda")); }
}

export async function identificarManualmente(id: string) {
  try { return (await api.get(`/credenciales-qr/identidad/${id}`)).data as IdentidadQr & { token: string }; }
  catch (e) { throw new Error(obtenerMensajeError(e, "No se pudo identificar al usuario")); }
}

export async function marcarAsistenciaQr(token: string) {
  try { return (await api.post("/asistencias/entrada-qr", { token })).data as { message: string; asistencia: { horaEntrada: string } }; }
  catch (e) { throw new Error(obtenerMensajeError(e, "No se pudo marcar la asistencia")); }
}
