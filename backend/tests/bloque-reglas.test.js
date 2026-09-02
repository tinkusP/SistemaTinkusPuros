const test = require("node:test");
const assert = require("node:assert/strict");
const { capacidadSector, LIMITES_BLOQUE, mensajeCupoCompleto, normalizarGeneroBloque, validarDimensionesBloque } = require("../dist/services/BloqueService");

test("normaliza los valores de género usados actualmente", () => {
  assert.equal(normalizarGeneroBloque("masculino"), "HOMBRE");
  assert.equal(normalizarGeneroBloque("Femenino"), "MUJER");
  assert.equal(normalizarGeneroBloque("sin registrar"), null);
});

test("aplica los límites duros de 40 hombres, 80 mujeres y 120 integrantes", () => {
  assert.equal(capacidadSector("HOMBRE", 50, 10), 40);
  assert.equal(capacidadSector("MUJER", 50, 10), 80);
  assert.equal(LIMITES_BLOQUE.TOTAL, 120);
});

test("rechaza dimensiones que superan la capacidad permitida", () => {
  assert.equal(validarDimensionesBloque({ filasHombres: 20, columnasHombres: 2, filasMujeres: 20, columnasMujeres: 4 }), null);
  assert.match(validarDimensionesBloque({ filasHombres: 21, columnasHombres: 2, filasMujeres: 20, columnasMujeres: 4 }), /40/);
  assert.match(validarDimensionesBloque({ filasHombres: 20, columnasHombres: 2, filasMujeres: 21, columnasMujeres: 4 }), /80/);
});

test("devuelve el mensaje exacto cuando un sector está lleno", () => {
  assert.equal(mensajeCupoCompleto("HOMBRE"), "Cupo de hombres completo: 40/40.");
  assert.equal(mensajeCupoCompleto("MUJER"), "Cupo de mujeres completo: 80/80.");
});
