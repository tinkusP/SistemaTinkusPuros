const test = require("node:test");
const assert = require("node:assert/strict");
const { esIndiceGuiaPrincipal } = require("../dist/services/IndiceBloqueService");

test("identifica el índice heredado de guía aunque tenga otro nombre", () => {
  assert.equal(esIndiceGuiaPrincipal({ key: { guiaId: 1 } }), true);
  assert.equal(esIndiceGuiaPrincipal({ key: { guiaId: 1, gestionId: 1 } }), false);
  assert.equal(esIndiceGuiaPrincipal({ key: { nombre: 1 } }), false);
});
