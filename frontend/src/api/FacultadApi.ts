import api from "@/lib/axios";
import { obtenerMensajeError } from "./apiError";
export type IntegranteFacultad = { _id: string; nombres: string; apellidoPaterno: string; apellidoMaterno?: string; fotoPerfil?: string; ci: string; email: string; telefono: string; estado: string; tipoOrigen: string; tipoFraterno: string; registroUniversitario?: string; facultadOriginal?: string | null; facultadNormalizada: string; carrera?: string };
export type ReporteFacultades = { total: number; facultades: { facultad: string; total: number }[]; integrantes: IntegranteFacultad[] };
export async function obtenerReporteFacultades() { try { return (await api.get<ReporteFacultades>("/facultades/reporte")).data; } catch (error) { throw new Error(obtenerMensajeError(error)); } }
