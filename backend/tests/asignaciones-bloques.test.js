const test = require("node:test");
const assert = require("node:assert/strict");
const { esIndiceFraternoBloque, FILTRO_ASIGNACION_ACTIVA } = require("../dist/services/AsignacionBloqueService");

test("identifica el índice absoluto heredado de fraterno por bloque", () => {
  assert.equal(esIndiceFraternoBloque({ key: { fraternoId: 1 } }), true);
  assert.equal(esIndiceFraternoBloque({ key: { fraternoId: 1, estado: 1 } }), false);
});

test("una pertenencia exige una relación activa y no eliminada", () => {
  assert.deepEqual(FILTRO_ASIGNACION_ACTIVA, { estado: { $ne: "INACTIVO" }, fechaEliminado: null });
});
