const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  clasificarParticipanteAuditoria,
  estadoMovimientoAuditoria,
  pagosDuplicadosAuditoria,
} = require("../dist/services/AuditoriaParticipacionService");

const leerBackend = (ruta) => fs.readFileSync(path.join(__dirname, "..", ruta), "utf8");
const leerRaiz = (ruta) => fs.readFileSync(path.join(__dirname, "..", "..", ruta), "utf8");

test("clasificación conserva origen y solo aplica beneficios formalizados", () => {
  assert.equal(clasificarParticipanteAuditoria({ origen: "INTERNO", exento: false, montoCuota: 770, tarifaNormal: 770 }), "INTERNO");
  assert.equal(clasificarParticipanteAuditoria({ origen: "EXTERNO", exento: false, montoCuota: 425, tarifaNormal: 850 }), "DESCUENTO");
  assert.equal(clasificarParticipanteAuditoria({ origen: "INTERNO", exento: true, montoCuota: 770, tarifaNormal: 770, referencia: "FREE", referenciaUnica: true }), "FREE");
  assert.equal(clasificarParticipanteAuditoria({ origen: "INTERNO", exento: true, montoCuota: 770, tarifaNormal: 770, referencia: "FREE", referenciaUnica: false }), "EXENTO");
  assert.equal(clasificarParticipanteAuditoria({ origen: "EXTERNO", exento: false, montoCuota: 850, tarifaNormal: 850, referencia: "DESCUENTO", referenciaUnica: true }), "EXTERNO");
});

test("cuotas ausentes y presentes conservan su estado real", () => {
  assert.deepEqual(estadoMovimientoAuditoria(), { estado: "SIN REGISTRO", monto: 0, fecha: null });
  assert.deepEqual(estadoMovimientoAuditoria({ estadoRevision: "VERIFICADO", monto: 300, fechaPago: "2026-09-01" }), { estado: "VERIFICADO", monto: 300, fecha: "2026-09-01" });
});

test("detecta posibles pagos y comprobantes duplicados sin modificar datos", () => {
  const duplicados = pagosDuplicadosAuditoria([
    { monto: 300, fechaPago: "2026-09-01T10:00:00Z", metodoPago: "QR", baucherImagen: "/uploads/a.webp" },
    { monto: 300, fechaPago: "2026-09-01T18:00:00Z", metodoPago: "QR", baucherImagen: "/uploads/a.webp" },
  ]);
  assert.equal(duplicados.huellas.length, 1);
  assert.equal(duplicados.comprobantes.length, 1);
});

test("no confunde cuotas distintas con duplicados aunque compartan monto y fecha", () => {
  const resultado = pagosDuplicadosAuditoria([
    { numeroPago: 1, monto: 275, fechaPago: "2026-09-12T10:00:00Z", metodoPago: "QR", baucherImagen: "/uploads/primera.webp" },
    { numeroPago: 2, monto: 275, fechaPago: "2026-09-12T18:00:00Z", metodoPago: "QR", baucherImagen: "/uploads/segunda.webp" },
  ]);
  assert.deepEqual(resultado.huellas, []);
  assert.deepEqual(resultado.comprobantes, []);
});

test("universo es unión de bloque, talla o cuota y la consulta es de solo lectura", () => {
  const servicio = leerBackend("src/services/AuditoriaParticipacionService.ts");
  assert.match(servicio, /tieneCuota \|\| tieneBloqueActivo \|\|/);
  assert.match(servicio, /asignacion\.estado === "ACTIVO"/);
  assert.match(servicio, /fechaEliminado: null/);
  assert.match(servicio, /estado: \{ \$nin: \["INACTIVO", "ELIMINADO"\] \}/);
  assert.doesNotMatch(servicio, /updateOne|updateMany|deleteOne|deleteMany|findOneAndUpdate|findByIdAndUpdate|\.save\(/);
});

test("endpoint exige administrador real y Excel contiene las nueve hojas requeridas", () => {
  const rutas = leerBackend("src/routes/ReporteRoutes.ts");
  assert.match(rutas, /router\.get\("\/auditoria-participacion", authenticate, soloAdministradorReal, auditoriaParticipacion\)/);
  const componente = leerRaiz("frontend/src/components/cuota/AuditoriaParticipacion.tsx");
  for (const hoja of ["01_RESUMEN_GENERAL", "02_TODOS_PARTICIPANTES", "03_CON_BLOQUE", "04_SIN_BLOQUE_CON_PAGO", "05_SIN_BLOQUE_CON_TALLA", "06_EXENTOS", "07_DESCUENTOS", "08_SIN_PAGO", "09_INCONSISTENCIAS"]) assert.match(componente, new RegExp(hoja));
  assert.match(componente, /EXPORTAR AUDITORÍA DE PARTICIPANTES/);
});
