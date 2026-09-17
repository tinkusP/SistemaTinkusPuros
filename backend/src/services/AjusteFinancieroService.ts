import AjusteFinanciero from "../models/AjusteFinanciero";

export type AccionAjusteFinanciero = "EXCLUIR_CALCULO" | "RESTAURAR_CALCULO" | "MARCAR_EXENTO" | "MARCAR_DESCUENTO";

const dinero = (valor: unknown) => Number((Number(valor) || 0).toFixed(2));

export function calcularParticipacionFinanciera(datos: {
  montoEsperadoOriginal: number;
  montoVerificado: number;
  exentoBase?: boolean;
  ajuste?: { accion?: string; montoEsperadoFinal?: number; porcentajeDescuento?: number; tipoExencion?: string } | null;
}) {
  const original = dinero(Math.max(0, datos.montoEsperadoOriginal));
  const verificado = dinero(Math.max(0, datos.montoVerificado));
  const accion = String(datos.ajuste?.accion ?? "");
  let esperado = datos.exentoBase ? 0 : original;
  let estado = datos.exentoBase ? "EXENTO_CUOTA" : "SIN_AJUSTE";

  if (accion === "EXCLUIR_CALCULO") { esperado = 0; estado = "EXCLUIDO"; }
  else if (accion === "MARCAR_EXENTO") { esperado = 0; estado = "EXENTO"; }
  else if (accion === "MARCAR_DESCUENTO") {
    esperado = dinero(Math.min(original, Math.max(0, Number(datos.ajuste?.montoEsperadoFinal) || 0)));
    estado = "DESCUENTO";
  } else if (accion === "RESTAURAR_CALCULO") { esperado = original; estado = "RESTAURADO"; }

  return {
    estado,
    incluidoCalculo: !["EXCLUIDO", "EXENTO"].includes(estado),
    montoEsperadoOriginal: original,
    montoEsperadoAjustado: esperado,
    montoDescontado: dinero(Math.max(0, original - esperado)),
    saldoAjustado: dinero(Math.max(0, esperado - verificado)),
  };
}

export async function obtenerAjustesGestion(gestionId: unknown) {
  const historial: any[] = await AjusteFinanciero.find({ gestionId })
    .populate("usuarioAdministrador", "nombres apellidoPaterno apellidoMaterno ci")
    .sort({ fecha: -1, _id: -1 })
    .lean();
  const ultimoPorUsuarioCuota = new Map<string, any>();
  for (const ajuste of historial) {
    const clave = `${String(ajuste.usuarioId)}:${String(ajuste.cuotaId)}`;
    if (!ultimoPorUsuarioCuota.has(clave)) ultimoPorUsuarioCuota.set(clave, ajuste);
  }
  return { historial, ultimoPorUsuarioCuota };
}
