const test = require("node:test");
const assert = require("node:assert/strict");
const { analizarCampoTalla, estadoTallaPago, estadoPrimeraCuota, resumirPagoReporte, clasificarEstadoTalla } = require("../dist/services/ReporteTallasPrimeraCuotaService");

test("considera talla completa solamente cuando existen polera y chamarra", () => {
  assert.deepEqual(estadoTallaPago("M", "XL", true), { tienePolera: true, tieneChamarra: true, conTalla: true, pendienteTalla: null, estadoCampoPolera: "VALIDA", estadoCampoChamarra: "VALIDA", estadoTallaPolera: "REGISTRADA", estadoTallaChamarra: "REGISTRADA", estadoGeneral: "COMPLETO" });
  assert.equal(estadoTallaPago("M", "", true).pendienteTalla, "CHAMARRA");
  assert.equal(estadoTallaPago("", "L", true).pendienteTalla, "POLERA");
  assert.equal(estadoTallaPago(undefined, undefined, true).pendienteTalla, "AMBAS");
});

test("clasifica las cuatro combinaciones de tallas", () => {
  assert.equal(clasificarEstadoTalla("M", "L"), "TALLAS COMPLETAS");
  assert.equal(clasificarEstadoTalla("M", ""), "SOLO POLERA");
  assert.equal(clasificarEstadoTalla("", "S"), "SOLO CHAMARRA");
  assert.equal(clasificarEstadoTalla(undefined, undefined), "SIN TALLA");
});

test("separa campos vacíos de valores no reconocidos sin normalizarlos", () => {
  assert.deepEqual(analizarCampoTalla(null), { estado: "SIN TALLA", valorReal: null });
  assert.deepEqual(analizarCampoTalla(""), { estado: "SIN TALLA", valorReal: "" });
  assert.deepEqual(analizarCampoTalla("M"), { estado: "VALIDA", valorReal: "M" });
  assert.deepEqual(analizarCampoTalla("M "), { estado: "SIN DEFINIR", valorReal: "M " });
  assert.deepEqual(analizarCampoTalla("Mediano"), { estado: "SIN DEFINIR", valorReal: "Mediano" });
  assert.equal(clasificarEstadoTalla("M", null), "SOLO POLERA");
  assert.equal(clasificarEstadoTalla(null, null), "SIN TALLA");
  assert.equal(clasificarEstadoTalla("SIN DEFINIR", "L"), "SIN DEFINIR");
  assert.equal(estadoTallaPago("SIN DEFINIR", "L").tienePolera, false);
});

test("clasifica pagos usando monto verificado, saldo y revisión reales", () => {
  assert.deepEqual(resumirPagoReporte(false, null, []), { estadoPagoReporte: "NO APLICA", estadoVerificacionPago: "NO APLICA" });
  assert.equal(resumirPagoReporte(true, { montoPagado: 0, saldo: 770 }, []).estadoPagoReporte, "SIN PAGO");
  assert.equal(resumirPagoReporte(true, { montoPagado: 0, saldo: 770 }, [{ monto: 300, estadoRevision: "PENDIENTE" }]).estadoPagoReporte, "PENDIENTE DE VERIFICACIÓN");
  assert.equal(resumirPagoReporte(true, { montoPagado: 300, saldo: 470 }, [{ monto: 300, estadoRevision: "VERIFICADO" }]).estadoPagoReporte, "PAGO PARCIAL");
  assert.equal(resumirPagoReporte(true, { montoPagado: 770, saldo: 0, estado: "PAGADA" }, [{ monto: 770, estadoRevision: "VERIFICADO" }]).estadoPagoReporte, "PAGO COMPLETO");
});

test("diferencia un usuario sin perfil fraterno de un fraterno pendiente", () => {
  const estado = estadoTallaPago(undefined, undefined, false, false);
  assert.equal(estado.estadoTallaPolera, "NO APLICA");
  assert.equal(estado.estadoTallaChamarra, "NO APLICA");
  assert.equal(estado.pendienteTalla, null);
  assert.equal(estado.estadoGeneral, "USUARIO SIN PERFIL FRATERNO");
});

test("combina correctamente falta de talla y primera cuota pendiente", () => {
  assert.equal(estadoTallaPago(undefined, undefined, false).estadoGeneral, "SIN TALLA + SIN PRIMERA CUOTA");
  assert.equal(estadoTallaPago("M", "L", false).estadoGeneral, "SIN PRIMERA CUOTA");
});

test("distingue pago registrado, verificado y saldo real de primera cuota", () => {
  assert.deepEqual(estadoPrimeraCuota(true, 300, null), { primeraCuota: "PENDIENTE", estadoPago: "SIN PAGO", verificacionPrimeraCuota: "SIN REGISTRO", montoRegistradoPrimeraCuota: 0, montoVerificadoPrimeraCuota: 0, saldoPrimeraCuota: 300, pagada: false });
  const pendiente = estadoPrimeraCuota(true, 300, { monto: 300, estadoRevision: "PENDIENTE" });
  assert.equal(pendiente.estadoPago, "PAGO REGISTRADO"); assert.equal(pendiente.saldoPrimeraCuota, 300);
  const verificado = estadoPrimeraCuota(true, 300, { monto: 300, estadoRevision: "VERIFICADO" });
  assert.equal(verificado.primeraCuota, "PAGADA"); assert.equal(verificado.saldoPrimeraCuota, 0);
});
