const test = require("node:test");
const assert = require("node:assert/strict");
const { agregarClausulaPagosNoReembolsables, CLAUSULA_PAGOS_NO_REEMBOLSABLES } = require("../dist/constants/terminosParticipacion");

test("agrega la cláusula sin alterar ni duplicar el contenido existente", () => {
  const original = "Términos vigentes versión 2";
  const actualizado = agregarClausulaPagosNoReembolsables(original);
  assert.ok(actualizado.startsWith(original));
  assert.ok(actualizado.includes(CLAUSULA_PAGOS_NO_REEMBOLSABLES));
  assert.equal(agregarClausulaPagosNoReembolsables(actualizado), actualizado);
});
