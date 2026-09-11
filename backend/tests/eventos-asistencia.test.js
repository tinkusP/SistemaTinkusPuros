const test = require("node:test");
const assert = require("node:assert/strict");
const { duracionMinutosEvento, estadoAsistenciaEvento, formatearDuracionEvento, siguienteAccionEvento } = require("../dist/services/EventoAsistenciaService");

test("deriva el estado sin guardar información redundante", () => {
  assert.equal(estadoAsistenciaEvento(null), "SIN_REGISTRO");
  assert.equal(estadoAsistenciaEvento({ horaIngreso: new Date() }), "DENTRO_DEL_EVENTO");
  assert.equal(estadoAsistenciaEvento({ horaIngreso: new Date(), horaSalida: new Date() }), "ASISTENCIA_COMPLETA");
});

test("el mismo control avanza entrada, salida y luego bloquea una tercera marcación", () => {
  assert.equal(siguienteAccionEvento(null), "ENTRADA");
  assert.equal(siguienteAccionEvento({ horaIngreso: "2026-09-11T13:00:00Z" }), "SALIDA");
  assert.equal(siguienteAccionEvento({ horaIngreso: "2026-09-11T13:00:00Z", horaSalida: "2026-09-11T16:47:00Z" }), "COMPLETA");
});

test("calcula una duración válida y rechaza cronología negativa", () => {
  assert.equal(duracionMinutosEvento("2026-09-11T13:00:00Z", "2026-09-11T16:47:00Z"), 227);
  assert.equal(formatearDuracionEvento(227), "3 h 47 min");
  assert.equal(duracionMinutosEvento("2026-09-11T16:47:00Z", "2026-09-11T13:00:00Z"), null);
});
