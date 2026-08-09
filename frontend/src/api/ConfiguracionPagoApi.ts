import api from "@/lib/axios";
import { obtenerMensajeError } from "./apiError";

export type OrigenPago = "INTERNO" | "EXTERNO";
export type PlanPago = "1" | "2" | "3";
export type CampoQr =
  | "qrInterno1Cuota1" | "qrExterno1Cuota1"
  | "qrInterno2Cuota1" | "qrInterno2Cuota2" | "qrExterno2Cuota1" | "qrExterno2Cuota2"
  | "qrInterno3Cuota1" | "qrInterno3Cuota2" | "qrInterno3Cuota3"
  | "qrExterno3Cuota1" | "qrExterno3Cuota2" | "qrExterno3Cuota3";
export type QrPlanes = Partial<Record<OrigenPago, Partial<Record<PlanPago, string[]>>>>;
export type ConfigPago = {
  _id: string;
  gestionId: string | { _id: string; nombre: string; anio: number };
  qrPlanes?: QrPlanes;
  qrPagoTotal?: string;
  qrPrimeraCuota?: string;
  qrSegundaCuota?: string;
  terminos: string;
  versionTerminos: number;
  tarifaInterno?: number;
  tarifaExterno?: number;
  primeraCuota?: number;
};
const error = (e: unknown): never => { throw new Error(obtenerMensajeError(e, "No se pudo cargar la configuración de pagos")); };
export async function miConfiguracionPago() { try { return (await api.get<{ configuracion: ConfigPago; terminosAceptados: boolean }>("/configuracion-pagos/mia")).data; } catch (e) { return error(e); } }
export async function aceptarTerminosPago(gestionId: string) { try { return (await api.post("/configuracion-pagos/aceptar", { gestionId })).data; } catch (e) { return error(e); } }
export async function configuracionPagoAdmin() { try { return (await api.get("/configuracion-pagos/admin")).data as { gestion: { _id: string; nombre: string; anio: number }; configuracion: ConfigPago | null }; } catch (e) { return error(e); } }
export async function guardarConfiguracionPago(datos: { gestionId: string; terminos: string; archivos: Partial<Record<CampoQr, File | null>> }) {
  const form = new FormData();
  form.append("gestionId", datos.gestionId);
  form.append("terminos", datos.terminos);
  Object.entries(datos.archivos).forEach(([campo, archivo]) => { if (archivo) form.append(campo, archivo); });
  try { return (await api.put("/configuracion-pagos/admin", form)).data; } catch (e) { return error(e); }
}
