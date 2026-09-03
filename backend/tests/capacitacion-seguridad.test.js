const test = require("node:test");
const assert = require("node:assert/strict");
const { esMetodoPermitidoEnCapacitacion, tipoCredencialQr } = require("../dist/services/CapacitacionService");

test("el modo capacitación permite únicamente operaciones de lectura", () => {
  assert.equal(esMetodoPermitidoEnCapacitacion("GET"), true);
  assert.equal(esMetodoPermitidoEnCapacitacion("HEAD"), true);
  for (const metodo of ["POST", "PUT", "PATCH", "DELETE"]) assert.equal(esMetodoPermitidoEnCapacitacion(metodo), false);
});

test("la credencial de capacitación no es una credencial operativa", () => {
  assert.equal(tipoCredencialQr(false), "CREDENCIAL_QR");
  assert.equal(tipoCredencialQr(true), "CREDENCIAL_QR_CAPACITACION");
});
