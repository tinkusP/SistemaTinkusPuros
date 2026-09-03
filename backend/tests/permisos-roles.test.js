const test = require("node:test");
const assert = require("node:assert/strict");
const { rolAutorizaPermiso, rolEstaActivo } = require("../dist/middleware/authorizePermission");

test("acepta roles activos almacenados como booleanos", () => {
  assert.equal(rolEstaActivo(true), true);
  assert.equal(rolEstaActivo(false), false);
});

test("mantiene compatibilidad con roles antiguos de texto", () => {
  assert.equal(rolEstaActivo("ACTIVO"), true);
  assert.equal(rolEstaActivo("INACTIVO"), false);
  assert.equal(rolEstaActivo(undefined), true);
});

test("el rol guía conserva sus permisos operativos base aunque el registro sea antiguo", () => {
  const guiaAntiguo = { codigo: "GUIA", estado: true, permisos: [] };
  assert.equal(rolAutorizaPermiso(guiaAntiguo, "VISTA_MI_BLOQUE_GUIA"), true);
  assert.equal(rolAutorizaPermiso(guiaAntiguo, "VISTA_DIRECTORIO_BLOQUES"), true);
  assert.equal(rolAutorizaPermiso(guiaAntiguo, "BLOQUES_PROPIOS_GESTIONAR"), true);
  assert.equal(rolAutorizaPermiso(guiaAntiguo, "VISTA_USUARIOS"), false);
});
