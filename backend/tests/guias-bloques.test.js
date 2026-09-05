const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { idsGuiasDelBloque } = require("../dist/services/GuiaBloqueService");

test("unifica guiaId heredado y guiasIds sin duplicar referencias", () => {
  const principal = new mongoose.Types.ObjectId();
  const segundo = new mongoose.Types.ObjectId();
  const ids = idsGuiasDelBloque({ guiaId: principal, guiasIds: [principal, segundo] });
  assert.deepEqual(ids.map(String), [String(principal), String(segundo)]);
});

test("conserva compatibilidad con bloques que solo poseen guiaId heredado", () => {
  const principal = new mongoose.Types.ObjectId();
  assert.deepEqual(idsGuiasDelBloque({ guiaId: principal }).map(String), [String(principal)]);
});
