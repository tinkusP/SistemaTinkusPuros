const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { calcularParticipacionFinanciera } = require("../dist/services/AjusteFinancieroService");

const backend = (ruta) => fs.readFileSync(path.join(__dirname, "..", ruta), "utf8");
const raiz = (ruta) => fs.readFileSync(path.join(__dirname, "..", "..", ruta), "utf8");

test("excluir conserva el pago pero lleva esperado y saldo a cero", () => {
  assert.deepEqual(calcularParticipacionFinanciera({ montoEsperadoOriginal: 850, montoVerificado: 300, ajuste: { accion: "EXCLUIR_CALCULO" } }), {
    estado: "EXCLUIDO", incluidoCalculo: false, montoEsperadoOriginal: 850, montoEsperadoAjustado: 0, montoDescontado: 850, saldoAjustado: 0,
  });
});

test("restaurar vuelve a incluir incluso una exención base sin cambiar la cuota", () => {
  const resultado = calcularParticipacionFinanciera({ montoEsperadoOriginal: 770, montoVerificado: 300, exentoBase: true, ajuste: { accion: "RESTAURAR_CALCULO" } });
  assert.equal(resultado.estado, "RESTAURADO");
  assert.equal(resultado.incluidoCalculo, true);
  assert.equal(resultado.montoEsperadoAjustado, 770);
  assert.equal(resultado.saldoAjustado, 470);
});

test("marcar exento deja esperado y saldo en cero", () => {
  const resultado = calcularParticipacionFinanciera({ montoEsperadoOriginal: 850, montoVerificado: 100, ajuste: { accion: "MARCAR_EXENTO", tipoExencion: "DIRECTIVA" } });
  assert.equal(resultado.estado, "EXENTO");
  assert.equal(resultado.incluidoCalculo, false);
  assert.equal(resultado.montoEsperadoAjustado, 0);
  assert.equal(resultado.saldoAjustado, 0);
});

test("descuento de 50 por ciento calcula monto final y saldo", () => {
  const resultado = calcularParticipacionFinanciera({ montoEsperadoOriginal: 850, montoVerificado: 100, ajuste: { accion: "MARCAR_DESCUENTO", porcentajeDescuento: 50, montoEsperadoFinal: 425 } });
  assert.equal(resultado.estado, "DESCUENTO");
  assert.equal(resultado.montoDescontado, 425);
  assert.equal(resultado.montoEsperadoAjustado, 425);
  assert.equal(resultado.saldoAjustado, 325);
});

test("los ajustes son eventos de historial y no modifican cuotas, pagos ni comprobantes", () => {
  const controlador = backend("src/controllers/AjusteFinancieroController.ts");
  const modelo = backend("src/models/AjusteFinanciero.ts");
  assert.match(controlador, /AjusteFinanciero\.create/);
  assert.doesNotMatch(controlador, /Cuota\.(update|findOneAndUpdate|delete)|DetalleCuota|\.save\(/);
  assert.match(modelo, /collection: "ajustes_financieros"/);
  assert.match(modelo, /usuarioAdministrador/);
  assert.match(modelo, /fecha: \{ type: Date, default: Date\.now, immutable: true/);
});

test("endpoint requiere administrador real, motivo y acción válida", () => {
  const rutas = backend("src/routes/CuotaRoutes.ts");
  assert.match(rutas, /router\.post\("\/ajustes-financieros\/:usuarioId", authenticate, soloAdministradorReal/);
  assert.match(rutas, /EXCLUIR_CALCULO/);
  assert.match(rutas, /RESTAURAR_CALCULO/);
  assert.match(rutas, /MARCAR_EXENTO/);
  assert.match(rutas, /MARCAR_DESCUENTO/);
  assert.match(rutas, /body\("motivo"\)\.trim\(\)\.isLength/);
});

test("frontend ofrece acciones, confirmación, métricas e historial", () => {
  const componente = raiz("frontend/src/components/cuota/AuditoriaFinancieraGeneral.tsx");
  for (const texto of ["Excluir del cálculo", "Restaurar al cálculo", "Marcar como exento", "Marcar descuento", "Esta acción no elimina el pago", "Historial de ajustes financieros", "Total participación real"]) assert.match(componente, new RegExp(texto, "i"));
});
