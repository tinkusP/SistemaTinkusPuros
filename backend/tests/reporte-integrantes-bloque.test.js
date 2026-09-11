const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizarMatriculaReporte, ordenarIntegrantesPorMatricula } = require("../dist/services/ReporteIntegrantesBloqueService");

test("conserva la matrícula real y solo limpia espacios exteriores", () => {
  assert.equal(normalizarMatriculaReporte(" 001-A "), "001-A");
  assert.equal(normalizarMatriculaReporte(null), "");
});

test("ordena matrículas naturalmente antes de las personas sin matrícula", () => {
  const filas = ordenarIntegrantesPorMatricula([
    { matricula: "10", nombreCompleto: "DIEZ" },
    { matricula: "", nombreCompleto: "ZETA" },
    { matricula: "2", nombreCompleto: "DOS" },
    { nombreCompleto: "ALFA" },
    { matricula: "1", nombreCompleto: "UNO" },
  ]);
  assert.deepEqual(filas.map((f) => f.nombreCompleto), ["UNO", "DOS", "DIEZ", "ALFA", "ZETA"]);
});
