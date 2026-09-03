const test = require("node:test");
const assert = require("node:assert/strict");
const { LIMITES_BLOQUE, mensajeCupoCompleto, normalizarGeneroBloque, normalizarNombreBloque, validarCupoGuia, validarCupoIntegrante, validarNombreBloque } = require("../dist/services/BloqueService");
const { distribuirPlanPagos, montoCuotaActual } = require("../dist/services/PlanPagosService");

test("normaliza los valores de género usados actualmente", () => {
  assert.equal(normalizarGeneroBloque("masculino"), "HOMBRE");
  assert.equal(normalizarGeneroBloque("Femenino"), "MUJER");
  assert.equal(normalizarGeneroBloque("sin registrar"), null);
});

test("normaliza y valida el nombre antes de actualizar únicamente ese campo", () => {
  assert.equal(normalizarNombreBloque("  Los   guerreros "), "LOS GUERREROS");
  assert.equal(validarNombreBloque(" ").error, "El nombre debe tener entre 2 y 100 caracteres");
  assert.equal(validarNombreBloque("BLOQUE DE PRUEBA").error, null);
  assert.notEqual(validarNombreBloque("X".repeat(101)).error, null);
});

test("aplica los límites duros de 40 hombres, 80 mujeres y 120 integrantes", () => {
  assert.equal(LIMITES_BLOQUE.HOMBRE, 40);
  assert.equal(LIMITES_BLOQUE.MUJER, 80);
  assert.equal(LIMITES_BLOQUE.TOTAL, 120);
  assert.equal(LIMITES_BLOQUE.GUIAS_POR_GENERO, 2);
});

test("reutiliza los importes reales de los planes de una, dos y tres cuotas", () => {
  assert.deepEqual(distribuirPlanPagos(770, 1), [770]);
  assert.deepEqual(distribuirPlanPagos(770, 2), [385, 385]);
  assert.deepEqual(distribuirPlanPagos(770, 3), [300, 235, 235]);
  assert.deepEqual(distribuirPlanPagos(850, 3), [300, 275, 275]);
  assert.equal(montoCuotaActual(770, 200, 3, 2), 200);
});

test("devuelve el mensaje exacto cuando un sector está lleno", () => {
  assert.equal(mensajeCupoCompleto("HOMBRE"), "Cupo de hombres completo: 40/40.");
  assert.equal(mensajeCupoCompleto("MUJER"), "Cupo de mujeres completo: 80/80.");
});

test("admite dos guías por género y bloquea al tercero", () => {
  assert.equal(validarCupoGuia("HOMBRE", 1), null);
  assert.match(validarCupoGuia("HOMBRE", 2), /2 guías hombres/);
  assert.equal(validarCupoGuia("MUJER", 1), null);
  assert.match(validarCupoGuia("MUJER", 2), /2 guías mujeres/);
});

test("admite 40 hombres y 80 mujeres, pero bloquea el siguiente", () => {
  assert.equal(validarCupoIntegrante("HOMBRE", 39), null);
  assert.equal(validarCupoIntegrante("HOMBRE", 40), "Cupo de hombres completo: 40/40.");
  assert.equal(validarCupoIntegrante("MUJER", 79), null);
  assert.equal(validarCupoIntegrante("MUJER", 80), "Cupo de mujeres completo: 80/80.");
});
