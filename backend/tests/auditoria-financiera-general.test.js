const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { clasificarTipoPagoAuditoria } = require("../dist/services/AuditoriaFinancieraService");

const leerBackend = (ruta) => fs.readFileSync(path.join(__dirname, "..", ruta), "utf8");
const leerRaiz = (ruta) => fs.readFileSync(path.join(__dirname, "..", "..", ruta), "utf8");

test("clasificación financiera es informativa y distingue beneficios formalizados", () => {
  assert.deepEqual(clasificarTipoPagoAuditoria({ exento: true, montoPlan: 770, tarifaNormal: 770, referencia: "FREE" }), { tipoPago: "FREE", estadoBeneficio: "APLICADO EN CUOTA" });
  assert.deepEqual(clasificarTipoPagoAuditoria({ exento: true, montoPlan: 770, tarifaNormal: 770, referencia: "FREE", referenciaAmbigua: true }), { tipoPago: "EXENTO", estadoBeneficio: "APLICADO EN CUOTA" });
  assert.deepEqual(clasificarTipoPagoAuditoria({ exento: true, montoPlan: 770, tarifaNormal: 770 }), { tipoPago: "EXENTO", estadoBeneficio: "APLICADO EN CUOTA" });
  assert.deepEqual(clasificarTipoPagoAuditoria({ exento: false, montoPlan: 385, tarifaNormal: 770 }), { tipoPago: "DESCUENTO", estadoBeneficio: "APLICADO EN MONTO DE CUOTA" });
  assert.deepEqual(clasificarTipoPagoAuditoria({ exento: false, montoPlan: 770, tarifaNormal: 770, referencia: "DESCUENTO" }), { tipoPago: "DESCUENTO", estadoBeneficio: "POR FORMALIZAR; NO ALTERA EL CÁLCULO" });
  assert.deepEqual(clasificarTipoPagoAuditoria({ exento: false, montoPlan: 850, tarifaNormal: 850 }), { tipoPago: "NORMAL", estadoBeneficio: "TARIFA VIGENTE" });
  assert.equal(clasificarTipoPagoAuditoria({ exento: false, montoPlan: 850, tarifaNormal: 850, referencia: "REVISAR" }).tipoPago, "REVISAR");
});

test("auditoría nueva es de solo lectura y excluye eliminados", () => {
  const servicio = leerBackend("src/services/AuditoriaFinancieraService.ts");
  assert.match(servicio, /fechaEliminado: null/);
  assert.match(servicio, /usuarioActivo/);
  assert.match(servicio, /asignacionActiva/);
  assert.doesNotMatch(servicio, /updateOne|updateMany|deleteOne|deleteMany|findOneAndUpdate|findByIdAndUpdate|\.save\(/);
});

test("diferencia esperada usa montos ajustados y conserva exenciones como dato informativo", () => {
  const servicio = leerBackend("src/services/AuditoriaFinancieraService.ts");
  assert.match(servicio, /fueraDeBloque: esperadoFuera/);
  assert.match(servicio, /exencionesEnBloque: universoBloques\.montoExento/);
  assert.match(servicio, /noExplicada: dinero\(universoGeneral\.montoEsperado - universoBloques\.montoEsperado - esperadoFuera\)/);
  assert.match(servicio, /montoEsperadoAjustado/);
  assert.match(servicio, /estadoRevision === "VERIFICADO"/);
});

test("endpoint financiero requiere administrador real", () => {
  const rutas = leerBackend("src/routes/ReporteRoutes.ts");
  assert.match(rutas, /router\.get\("\/auditoria-financiera", authenticate, soloAdministradorReal, auditoriaFinancieraGeneral\)/);
});

test("Excel contiene exactamente las siete hojas administrativas requeridas", () => {
  const componente = leerRaiz("frontend/src/components/cuota/AuditoriaFinancieraGeneral.tsx");
  for (const hoja of ["01_RESUMEN", "02_TODOS_LOS_PAGOS", "03_CON_BLOQUE", "04_SIN_BLOQUE_CON_PAGO", "05_SIN_PAGO", "06_FREE_EXENTOS_DESCUENTOS", "07_INCONSISTENCIAS"]) assert.match(componente, new RegExp(hoja));
  assert.match(componente, /EXPORTAR AUDITORÍA FINANCIERA/);
});
