const test = require("node:test");
const assert = require("node:assert/strict");
const { numeroDelCodigo } = require("../dist/services/CodigoFraternoService");

test("extrae correlativos definitivos sin confundir códigos temporales", () => {
  assert.equal(numeroDelCodigo("FRA-2026-0313", 2026), 313);
  assert.equal(numeroDelCodigo("TOK-FRA-0FA066E3", 2026), 0);
  assert.equal(numeroDelCodigo("FRA-2025-0313", 2026), 0);
});

test("acepta correlativos mayores a cuatro dígitos", () => {
  assert.equal(numeroDelCodigo("FRA-2026-10000", 2026), 10000);
});
