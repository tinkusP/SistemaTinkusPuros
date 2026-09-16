const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { resumirControlFinanciero } = require("../dist/services/ControlFinancieroBloquesService");
const leer = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");

test("la pertenencia vigente exige detalle y bloque activos", () => {
  const s = leer("src/services/ControlFinancieroBloquesService.ts");
  assert.match(s, /a\.estado==="ACTIVO"&&bloqueMap\.get\(sid\(a\.bloqueId\)\)\?\.estado==="ACTIVO"/);
  assert.match(s, /fechaEliminado:null/);
});

test("exención es explícita, auditada y no cambia la historia de pagos", () => {
  const m = leer("src/models/Cuota.ts"), c = leer("src/controllers/CuotaController.ts"), r = leer("src/routes/CuotaRoutes.ts");
  assert.match(m, /exentoPago/);
  assert.match(c, /MARCAR_EXENTO/);
  assert.match(c, /RETIRAR_EXENCION/);
  assert.match(r, /soloAdministradorReal/);
  assert.doesNotMatch(c, /DetalleCuota\.delete/);
});

test("separa personas pendientes de registros de pago pendientes", () => {
  const filas = [
    { tipo: "INTERNO", montoTotal: 770, montoVerificado: 100, montoPendienteRevision: 200, pagosPendientes: 2, saldo: 670, estadoPago: "PAGO PARCIAL", exento: false },
    { tipo: "EXTERNO", montoTotal: 850, montoVerificado: 0, montoPendienteRevision: 50, pagosPendientes: 1, saldo: 850, estadoPago: "PENDIENTE DE VERIFICACIÓN", exento: false },
  ];
  const resumen = resumirControlFinanciero(filas, "PRUEBA");
  assert.equal(resumen.personasPendientes, 2);
  assert.equal(resumen.pagosPendientes, 3);
  assert.equal(resumen.montoPendienteRevision, 250);
});

test("exentos reducen el esperado sin borrar dinero verificado", () => {
  const filas = [
    { tipo: "INTERNO", montoTotal: 770, montoVerificado: 0, montoPendienteRevision: 0, pagosPendientes: 0, saldo: 0, estadoPago: "EXENTO", exento: true },
    { tipo: "EXTERNO", montoTotal: 850, montoVerificado: 850, montoPendienteRevision: 0, pagosPendientes: 0, saldo: 0, estadoPago: "PAGO COMPLETO", exento: false },
  ];
  const resumen = resumirControlFinanciero(filas, "PRUEBA");
  assert.equal(resumen.montoTeorico, 1620);
  assert.equal(resumen.montoExento, 770);
  assert.equal(resumen.montoRealEsperado, 850);
  assert.equal(resumen.montoVerificado, 850);
  assert.equal(resumen.diferencia, 0);
});

test("auditor completo es de solo lectura y expone reconciliación", () => {
  const s = leer("src/scripts/auditarIntegridadFinanciera.ts");
  assert.match(s, /obtenerControlFinancieroBloques/);
  assert.doesNotMatch(s, /updateOne|updateMany|deleteOne|deleteMany|findOneAndUpdate|save\(/);
  const servicio = leer("src/services/ControlFinancieroBloquesService.ts");
  assert.match(servicio, /noExplicada/);
  assert.match(servicio, /fueraBloques/);
});
