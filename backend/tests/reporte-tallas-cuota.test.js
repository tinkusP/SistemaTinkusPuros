const test = require("node:test");
const assert = require("node:assert/strict");
const { estadoTallaPago, estadoPrimeraCuota } = require("../dist/services/ReporteTallasPrimeraCuotaService");

test("considera talla completa solamente cuando existen polera y chamarra", () => {
  assert.deepEqual(estadoTallaPago("M", "XL", true), { tienePolera: true, tieneChamarra: true, conTalla: true, pendienteTalla: null, estadoTallaPolera: "REGISTRADA", estadoTallaChamarra: "REGISTRADA", estadoGeneral: "COMPLETO" });
  assert.equal(estadoTallaPago("M", "", true).pendienteTalla, "CHAMARRA");
  assert.equal(estadoTallaPago("", "L", true).pendienteTalla, "POLERA");
  assert.equal(estadoTallaPago(undefined, undefined, true).pendienteTalla, "AMBAS");
});

test("diferencia un usuario sin perfil fraterno de un fraterno pendiente", () => {
  const estado = estadoTallaPago(undefined, undefined, false, false);
  assert.equal(estado.estadoTallaPolera, "NO APLICA");
  assert.equal(estado.estadoTallaChamarra, "NO APLICA");
  assert.equal(estado.pendienteTalla, null);
  assert.equal(estado.estadoGeneral, "USUARIO SIN PERFIL FRATERNO");
});

test("combina correctamente falta de talla y primera cuota pendiente", () => {
  assert.equal(estadoTallaPago(undefined, undefined, false).estadoGeneral, "SIN TALLA + SIN PRIMERA CUOTA");
  assert.equal(estadoTallaPago("M", "L", false).estadoGeneral, "SIN PRIMERA CUOTA");
});

test("distingue pago registrado, verificado y saldo real de primera cuota", () => {
  assert.deepEqual(estadoPrimeraCuota(true, 300, null), { primeraCuota: "PENDIENTE", estadoPago: "SIN PAGO", verificacionPrimeraCuota: "SIN REGISTRO", montoRegistradoPrimeraCuota: 0, montoVerificadoPrimeraCuota: 0, saldoPrimeraCuota: 300, pagada: false });
  const pendiente = estadoPrimeraCuota(true, 300, { monto: 300, estadoRevision: "PENDIENTE" });
  assert.equal(pendiente.estadoPago, "PAGO REGISTRADO"); assert.equal(pendiente.saldoPrimeraCuota, 300);
  const verificado = estadoPrimeraCuota(true, 300, { monto: 300, estadoRevision: "VERIFICADO" });
  assert.equal(verificado.primeraCuota, "PAGADA"); assert.equal(verificado.saldoPrimeraCuota, 0);
});
