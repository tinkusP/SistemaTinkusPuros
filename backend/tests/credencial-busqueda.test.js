const test = require("node:test");
const assert = require("node:assert/strict");
const { construirFiltroBusquedaIdentidad } = require("../dist/controllers/CredencialQrController");

test("la búsqueda manual conserva la coincidencia exacta por CI", () => {
  const filtro = construirFiltroBusquedaIdentidad("12894284");
  assert.deepEqual(filtro.$or[0], { ci: "12894284" });
});

test("la búsqueda manual divide el nombre completo en términos obligatorios", () => {
  const filtro = construirFiltroBusquedaIdentidad("Luis Alberto Larico");
  const criterioNombre = filtro.$or.find((criterio) => criterio.$and);
  assert.equal(criterioNombre.$and.length, 3);
  assert.equal(criterioNombre.$and.every((termino) => termino.$or.length === 3), true);
});

test("los caracteres especiales no se interpretan como expresiones regulares", () => {
  const filtro = construirFiltroBusquedaIdentidad("Ana (Prueba)");
  const criterioNombre = filtro.$or.find((criterio) => criterio.$and);
  assert.equal(criterioNombre.$and[1].$or[0].nombres.source, "\\(Prueba\\)");
});

test("permite encontrar códigos de fraterno sin excluir otros roles", () => {
  const id = "64b000000000000000000001";
  const filtro = construirFiltroBusquedaIdentidad("FRA-2026-001", [id]);
  assert.deepEqual(filtro.$or.at(-1), { _id: { $in: [id] } });
  assert.equal(Object.prototype.hasOwnProperty.call(filtro, "roles"), false);
});
