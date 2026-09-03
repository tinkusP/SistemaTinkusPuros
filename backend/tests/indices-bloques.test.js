const test = require("node:test");
const assert = require("node:assert/strict");
const { esIndiceGuiaPrincipal, esIndiceGuiasBloque, esIndicePostulanteGuia } = require("../dist/services/IndiceBloqueService");

test("identifica el índice heredado de guía aunque tenga otro nombre", () => {
  assert.equal(esIndiceGuiaPrincipal({ key: { guiaId: 1 } }), true);
  assert.equal(esIndiceGuiaPrincipal({ key: { guiaId: 1, gestionId: 1 } }), false);
  assert.equal(esIndiceGuiaPrincipal({ key: { nombre: 1 } }), false);
});

test("identifica el índice heredado de postulante aunque tenga otro nombre", () => {
  assert.equal(esIndicePostulanteGuia({ key: { postulanteGuiaId: 1 } }), true);
  assert.equal(esIndicePostulanteGuia({ key: { usuarioId: 1 } }), false);
});

test("identifica el índice heredado del arreglo de guías", () => {
  assert.equal(esIndiceGuiasBloque({ key: { guiasIds: 1 } }), true);
  assert.equal(esIndiceGuiasBloque({ key: { guiaId: 1 } }), false);
});
