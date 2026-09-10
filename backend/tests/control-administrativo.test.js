const test = require("node:test");
const assert = require("node:assert/strict");
const { clasificarPorAnios } = require("../dist/services/CondicionFraternoService");
const { ARTICULOS_PACK, estadoPack, REQUISITOS_ENTREGA_DEFAULT } = require("../dist/services/EntregaPackService");
const { tieneAlgunaTallaValida } = require("../dist/services/PendientesBloqueService");

test("clasifica nuevo, antiguo y reincorporado sin modificar historiales", () => {
  assert.equal(clasificarPorAnios([], 2026), "SIN_HISTORIAL");
  assert.equal(clasificarPorAnios([2026], 2026), "NUEVO");
  assert.equal(clasificarPorAnios([2025, 2026], 2026), "ANTIGUO");
  assert.equal(clasificarPorAnios([2023, 2026], 2026), "REINCORPORADO");
});

test("el pack distingue pendiente, parcial y completo", () => {
  assert.deepEqual(ARTICULOS_PACK, ["POLERA", "CHAMARRA", "CHALINA", "ETIQUETA PUROS"]);
  assert.equal(estadoPack([]), "PENDIENTE");
  assert.equal(estadoPack(["POLERA"]), "ENTREGA_PARCIAL");
  assert.equal(estadoPack(ARTICULOS_PACK), "PACK_COMPLETO");
  assert.equal(REQUISITOS_ENTREGA_DEFAULT.POLERA, 2);
  assert.equal(REQUISITOS_ENTREGA_DEFAULT.CHALINA, 3);
});

test("la preparación de bloque acepta al menos una talla válida", () => {
  assert.equal(tieneAlgunaTallaValida({ tallaPolera: "M", tallaChamarra: null }), true);
  assert.equal(tieneAlgunaTallaValida({ tallaPolera: null, tallaChamarra: "XL" }), true);
  assert.equal(tieneAlgunaTallaValida({ tallaPolera: "Mediano", tallaChamarra: "" }), false);
  assert.equal(tieneAlgunaTallaValida(null), false);
});
