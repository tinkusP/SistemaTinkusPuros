const test = require("node:test");
const assert = require("node:assert/strict");
const { esDuplicadoAsignacionActiva, esIndiceAsignacionActivaCorrecto, esIndiceCompuestoHistoricoIncompatible, esIndiceFraternoBloque, esIndicePosicionFisica, FILTRO_ASIGNACION_ACTIVA, resumirAsignacion } = require("../dist/services/AsignacionBloqueService");

test("identifica el índice absoluto heredado de fraterno por bloque", () => {
  assert.equal(esIndiceFraternoBloque({ key: { fraternoId: 1 } }), true);
  assert.equal(esIndiceFraternoBloque({ key: { fraternoId: 1, estado: 1 } }), false);
});

test("identifica índices heredados de la matriz física", () => {
  assert.equal(esIndicePosicionFisica({ key: { bloqueId: 1, fila: 1, columna: 1 } }), true);
  assert.equal(esIndicePosicionFisica({ key: { fila: 1 } }), true);
  assert.equal(esIndicePosicionFisica({ key: { bloqueId: 1, genero: 1 } }), false);
});

test("distingue el índice parcial correcto de índices únicos antiguos", () => {
  assert.equal(esIndiceAsignacionActivaCorrecto({ key: { fraternoId: 1 }, unique: true, partialFilterExpression: { estado: "ACTIVO", fechaEliminado: null } }), true);
  assert.equal(esIndiceAsignacionActivaCorrecto({ key: { fraternoId: 1 }, unique: true }), false);
});

test("reproduce el índice único histórico que bloquea una reasignación al mismo bloque", () => {
  assert.equal(esIndiceCompuestoHistoricoIncompatible({ key: { bloqueId: 1, fraternoId: 1 }, unique: true }), true);
  assert.equal(esIndiceCompuestoHistoricoIncompatible({ key: { bloqueId: 1, fraternoId: 1 }, unique: false }), false);
});

test("solo un duplicado del índice activo representa concurrencia real", () => {
  assert.equal(esDuplicadoAsignacionActiva({ code: 11000, keyPattern: { fraternoId: 1 } }), true);
  assert.equal(esDuplicadoAsignacionActiva({ code: 11000, keyPattern: { bloqueId: 1, fraternoId: 1 } }), false);
  assert.equal(esDuplicadoAsignacionActiva({ code: 11000, keyPattern: { otroCampo: 1 } }), false);
});

test("una pertenencia exige una relación activa y no eliminada", () => {
  assert.deepEqual(FILTRO_ASIGNACION_ACTIVA, { estado: { $ne: "INACTIVO" }, fechaEliminado: null });
});

test("la respuesta de conflicto identifica bloque, estado, fecha y guías", () => {
  const resumen = resumirAsignacion({ estado: "ACTIVO", fechaAsignacion: new Date("2026-09-03"), bloqueId: { _id: "bloque-1", nombre: "LOS MALCRIADOS", guiasIds: [{ _id: "guia-1", usuarioId: { nombres: "Ana" } }] } });
  assert.equal(resumen.bloqueNombre, "LOS MALCRIADOS");
  assert.equal(resumen.estado, "ACTIVO");
  assert.equal(resumen.guias[0].usuarioId.nombres, "Ana");
});
