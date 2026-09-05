const test = require("node:test");
const assert = require("node:assert/strict");
const { estadoTallaPago } = require("../dist/services/ReporteTallasPrimeraCuotaService");

test("considera talla completa solamente cuando existen polera y chamarra", () => {
  assert.deepEqual(estadoTallaPago("M", "XL", true), { tienePolera: true, tieneChamarra: true, conTalla: true, pendienteTalla: null, estadoGeneral: "COMPLETO" });
  assert.equal(estadoTallaPago("M", "", true).pendienteTalla, "CHAMARRA");
  assert.equal(estadoTallaPago("", "L", true).pendienteTalla, "POLERA");
  assert.equal(estadoTallaPago(undefined, undefined, true).pendienteTalla, "AMBAS");
});

test("combina correctamente falta de talla y primera cuota pendiente", () => {
  assert.equal(estadoTallaPago(undefined, undefined, false).estadoGeneral, "SIN TALLA + SIN PRIMERA CUOTA");
  assert.equal(estadoTallaPago("M", "L", false).estadoGeneral, "SIN PRIMERA CUOTA");
});
