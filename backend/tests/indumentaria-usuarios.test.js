const test = require("node:test");
const assert = require("node:assert/strict");
const { estadoHabilitacionTalla } = require("../dist/services/IndumentariaUsuariosService");
const { normalizarTallaAdministrativa } = require("../dist/constants/tallas");
const { indiceFraternoOpcionalEsSeguro } = require("../dist/services/IndiceTallaService");

test("un usuario visible solo se habilita con primera cuota verificada", () => {
  assert.equal(estadoHabilitacionTalla({ usuarioActivo: true, tieneCuota: true, primeraCuotaVerificada: true }).habilitado, true);
  assert.equal(estadoHabilitacionTalla({ usuarioActivo: true, tieneCuota: true, primeraCuotaVerificada: false }).estadoHabilitacion, "PAGO_PENDIENTE");
  assert.match(estadoHabilitacionTalla({ usuarioActivo: true, tieneCuota: false, primeraCuotaVerificada: false }).motivo, /cuota/i);
});

test("el índice de fraterno opcional solo es seguro con filtro parcial ObjectId", () => {
  assert.equal(indiceFraternoOpcionalEsSeguro({ name: "fraternoId_1", key: { fraternoId: 1 }, unique: true }), false);
  assert.equal(indiceFraternoOpcionalEsSeguro({ name: "fraternoId_1", key: { fraternoId: 1 }, unique: true, sparse: true }), false);
  assert.equal(indiceFraternoOpcionalEsSeguro({ name: "fraternoId_1", key: { fraternoId: 1 }, unique: true, partialFilterExpression: { fraternoId: { $type: "objectId" } } }), true);
});

test("la gestión administrativa acepta el catálogo y permite dejar una prenda sin registrar", () => {
  assert.equal(normalizarTallaAdministrativa(" xl "), "XL");
  assert.equal(normalizarTallaAdministrativa("SIN DEFINIR"), "SIN DEFINIR");
  assert.equal(normalizarTallaAdministrativa("TALLA INVENTADA"), null);
});

test("una cuenta inactiva sigue siendo explicable pero no habilitada", () => {
  const resultado = estadoHabilitacionTalla({ usuarioActivo: false, tieneCuota: true, primeraCuotaVerificada: true });
  assert.equal(resultado.estadoHabilitacion, "NO_HABILITADO");
  assert.match(resultado.motivo, /activa/i);
});
