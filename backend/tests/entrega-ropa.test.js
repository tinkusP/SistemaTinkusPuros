const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { estadoEntregaRopa, resumirEntregaRopa } = require("../dist/services/EntregaRopaService");
const { puedeEntregarRopa } = require("../dist/services/EntregaPackService");
const Entrega = require("../dist/models/EntregaIndumentaria").default;

test("ninguna, solo polera, solo chamarra y ambas se derivan independientemente", () => {
  assert.equal(estadoEntregaRopa(false, false), "PENDIENTE");
  assert.equal(estadoEntregaRopa(true, false), "ENTREGA_PARCIAL");
  assert.equal(estadoEntregaRopa(false, true), "ENTREGA_PARCIAL");
  assert.equal(estadoEntregaRopa(true, true), "ENTREGA_COMPLETA");
});
test("planes 1, 2 o 3 completos no exigen artificialmente un segundo pago", () => {
  for (const verificadas of [1,2,3]) assert.equal(puedeEntregarRopa({estado:"PAGADA",saldo:0},verificadas,2),true);
});
test("pago parcial conserva el mínimo administrativo, no convierte dos pagos en completo", () => {
  assert.equal(puedeEntregarRopa({estado:"PAGO_PARCIAL",saldo:235},2,2),true);
  assert.equal(puedeEntregarRopa({estado:"PAGO_PARCIAL",saldo:470},1,2),false);
  assert.equal(puedeEntregarRopa({estado:"PENDIENTE",saldo:770},0,2),false);
});
test("reversión conserva historial, pero no cuenta como entregada", () => {
  const r=resumirEntregaRopa([{prendaId:{nombre:"POLERA"},estado:"DEVUELTO",fechaEntrega:new Date()}]);
  assert.equal(r.polera.estado,"PENDIENTE");
  assert.equal(r.estadoGeneral,"PENDIENTE");
});
test("salida personal excluye responsable, identificador interno y observaciones", () => {
  const registro={_id:"entrega",prendaId:{nombre:"POLERA"},estado:"ENTREGADO",fechaEntrega:"2026-09-12",responsableEntrega:{nombres:"ADMIN"},observacion:"privado"};
  const publico=resumirEntregaRopa([registro]);
  assert.deepEqual(Object.keys(publico.polera).sort(),["estado","fecha"]);
  assert.equal(resumirEntregaRopa([registro],true).polera.responsable,"ADMIN");
});
test("el índice existente restringe duplicados activos sin bloquear historial DEVUELTO", () => {
  const indice=Entrega.schema.indexes().find(([campos])=>campos.fraternoId===1&&campos.prendaId===1);
  assert.equal(indice[1].unique,true);
  assert.deepEqual(indice[1].partialFilterExpression,{estado:"ENTREGADO"});
});
test("reporte y mutaciones mantienen protección de backend y QR no cambia", () => {
  const raiz=path.resolve(__dirname,"../..");
  const rutas=fs.readFileSync(path.join(raiz,"backend/src/routes/IndumentariaRoutes.ts"),"utf8");
  assert.ok(rutas.indexOf('router.use(authenticate, soloAdministracion)') < rutas.indexOf('router.post("/entregas/ropa"'));
  const controller=fs.readFileSync(path.join(raiz,"backend/src/controllers/IndumentariaController.ts"),"utf8");
  assert.match(controller,/motivo.length < 5/);
  assert.match(controller,/estado: anterior.estado/);
  assert.match(controller,/datosAntes: \{ estado: anterior.estado/);
  const reporte=fs.readFileSync(path.join(raiz,"backend/src/routes/ReporteRoutes.ts"),"utf8");
  assert.match(reporte,/"\/entregas-ropa", authenticate, soloAdministracion/);
});
