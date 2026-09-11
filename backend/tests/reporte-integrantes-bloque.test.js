const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { clasificarPagoReporte, normalizarMatriculaReporte, ordenarIntegrantesPorMatricula } = require("../dist/services/ReporteIntegrantesBloqueService");

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

test("clasifica plan y pagos verificados como conceptos independientes", () => {
  assert.equal(clasificarPagoReporte({ estado: "PAGO_PARCIAL", saldo: 470 }, [{ numeroPago: 1, estadoRevision: "VERIFICADO" }]), "SOLO_PRIMER_PAGO");
  assert.equal(clasificarPagoReporte({ estado: "PAGO_PARCIAL", saldo: 235 }, [{ numeroPago: 1, estadoRevision: "VERIFICADO" }, { numeroPago: 2, estadoRevision: "VERIFICADO" }]), "HASTA_SEGUNDO_PAGO");
  assert.equal(clasificarPagoReporte({ estado: "PAGO_PARCIAL", saldo: 10 }, [{ numeroPago: 1, estadoRevision: "VERIFICADO" }, { numeroPago: 2, estadoRevision: "VERIFICADO" }, { numeroPago: 3, estadoRevision: "VERIFICADO" }]), "TRES_PAGOS_VERIFICADOS");
});

test("un plan de uno o dos pagos se considera completo por estado y saldo, no por cantidad tres", () => {
  assert.equal(clasificarPagoReporte({ estado: "PAGADA", saldo: 0 }, [{ numeroPago: 1, estadoRevision: "VERIFICADO" }]), "PAGO_COMPLETO");
  assert.equal(clasificarPagoReporte({ estado: "PAGADA", saldo: 0 }, [{ numeroPago: 1, estadoRevision: "VERIFICADO" }, { numeroPago: 2, estadoRevision: "VERIFICADO" }]), "PAGO_COMPLETO");
});

test("pendiente, observado o rechazado no cuentan como pago verificado", () => {
  assert.equal(clasificarPagoReporte({ estado: "PENDIENTE", saldo: 770 }, [{ numeroPago: 1, estadoRevision: "PENDIENTE" }]), "SIN_PAGO");
  assert.equal(clasificarPagoReporte({ estado: "PENDIENTE", saldo: 770 }, [{ numeroPago: 1, estadoRevision: "OBSERVADO" }, { numeroPago: 2, estadoRevision: "RECHAZADO" }]), "SIN_PAGO");
});

test("el contrato GET está declarado, montado y coincide exactamente con el frontend", () => {
  const raiz = path.resolve(__dirname, "../..");
  const rutas = fs.readFileSync(path.join(raiz, "backend/src/routes/ReporteRoutes.ts"), "utf8");
  const servidor = fs.readFileSync(path.join(raiz, "backend/src/server.ts"), "utf8");
  const api = fs.readFileSync(path.join(raiz, "frontend/src/api/ReporteApi.ts"), "utf8");
  assert.match(rutas, /router\.get\("\/integrantes-matricula"/);
  assert.match(servidor, /app\.use\("\/api\/reportes", reporteRoutes\)/);
  assert.match(api, /api\.get<ReporteIntegrantesMatricula>\("\/reportes\/integrantes-matricula"\)/);
});
