export const redondearMonto = (valor: number) => Number(valor.toFixed(2));

/** Misma distribución utilizada al registrar y solicitar los pagos. */
export function distribuirPlanPagos(total: number, numeroCuotas: number) {
  const montoTotal = redondearMonto(total);
  if (numeroCuotas === 1) return [montoTotal];
  if (numeroCuotas === 2) {
    const primera = redondearMonto(montoTotal / 2);
    return [primera, redondearMonto(montoTotal - primera)];
  }
  const primera = Math.min(300, montoTotal);
  const segunda = redondearMonto((montoTotal - primera) / 2);
  return [primera, segunda, redondearMonto(montoTotal - primera - segunda)];
}

export function montoCuotaActual(total: number, saldo: number, numeroCuotas: number, pagosVerificados: number) {
  return pagosVerificados === numeroCuotas - 1
    ? redondearMonto(saldo)
    : Math.min(distribuirPlanPagos(total, numeroCuotas)[pagosVerificados] ?? redondearMonto(saldo), redondearMonto(saldo));
}
