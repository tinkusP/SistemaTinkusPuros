const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { estadoPagoSelectorExenciones } = require("../dist/services/SelectorExencionesService");

const leerBackend = (ruta) => fs.readFileSync(path.join(__dirname, "..", ruta), "utf8");
const leerRaiz = (ruta) => fs.readFileSync(path.join(__dirname, "..", "..", ruta), "utf8");

test("estado de pago diferencia usuario sin cuota, pendiente, parcial, pagado y exento", () => {
  assert.equal(estadoPagoSelectorExenciones({ tieneCuota: false, exento: false, montoTotal: 0, montoVerificado: 0, pagosPendientes: 0 }), "SIN CUOTA");
  assert.equal(estadoPagoSelectorExenciones({ tieneCuota: true, exento: false, montoTotal: 770, montoVerificado: 0, pagosPendientes: 0 }), "PENDIENTE");
  assert.equal(estadoPagoSelectorExenciones({ tieneCuota: true, exento: false, montoTotal: 770, montoVerificado: 100, pagosPendientes: 0 }), "PAGO PARCIAL");
  assert.equal(estadoPagoSelectorExenciones({ tieneCuota: true, exento: false, montoTotal: 770, montoVerificado: 770, pagosPendientes: 0 }), "PAGÓ");
  assert.equal(estadoPagoSelectorExenciones({ tieneCuota: true, exento: true, montoTotal: 770, montoVerificado: 0, pagosPendientes: 0 }), "EXENTO");
});

test("selector parte de todos los perfiles activos y conserva relaciones opcionales", () => {
  const servicio = leerBackend("src/services/SelectorExencionesService.ts");
  assert.match(servicio, /PerfilUsuario\.find\(\{ estado: "ACTIVO", fechaEliminado: null \}\)/);
  assert.match(servicio, /const filas = usuarios\.map/);
  assert.match(servicio, /SIN BLOQUE/);
  assert.match(servicio, /SIN CUOTA/);
  assert.match(servicio, /SIN REGISTRO/);
  assert.match(servicio, /totalUsuariosActivos: usuarios\.length/);
  assert.match(servicio, /disponiblesExencion: filas\.length/);
  assert.match(servicio, /JONNY_HERRERA_CONDORI/);
  assert.match(servicio, /KENJI_GROVER_SADAKATA/);
});

test("endpoints de exención general exigen administrador real", () => {
  const rutas = leerBackend("src/routes/CuotaRoutes.ts");
  assert.match(rutas, /router\.get\("\/exenciones\/usuarios", authenticate, soloAdministradorReal, listarUsuariosExencion\)/);
  assert.match(rutas, /router\.patch\("\/exenciones\/usuarios\/:usuarioId", authenticate, soloAdministradorReal/);
});

test("exención sin cuota no crea cuota y registra motivo, administrador y fecha", () => {
  const controlador = leerBackend("src/controllers/ExencionPagoController.ts");
  assert.match(controlador, /if \(cuota\) return res\.status\(409\)/);
  assert.doesNotMatch(controlador, /Cuota\.create|new Cuota/);
  assert.match(controlador, /categoria, descripcion, usuarioAdministrador: req\.usuario\?\._id, fechaRegistro: new Date\(\)/);
  const modelo = leerBackend("src/models/ExencionPagoUsuario.ts");
  for (const categoria of ["DIRECTIVA", "ADMINISTRACION", "GUIA", "INVITADO", "OTRO"]) assert.match(modelo, new RegExp(categoria));
});

test("frontend busca por todos los campos solicitados y muestra el reporte de diferencias", () => {
  const componente = leerRaiz("frontend/src/components/cuota/SelectorExencionesUsuarios.tsx");
  for (const campo of ["usuario.nombre", "usuario.ci", "usuario.telefono", "usuario.codigoFraterno", "usuario.correo"]) assert.match(componente, new RegExp(campo.replace(".", "\\.")));
  assert.match(componente, /Usuarios no visibles en el control financiero anterior/);
  assert.match(componente, /usuarios activos de Gestión Integral = usuarios disponibles para exención/);
  assert.match(componente, /actualizarExencionUsuarioSinCuota/);
});

test("el cálculo financiero por bloques permanece separado del selector general", () => {
  const financiero = leerBackend("src/services/ControlFinancieroBloquesService.ts");
  assert.doesNotMatch(financiero, /SelectorExencionesService|ExencionPagoUsuario/);
  assert.match(financiero, /const personas=todas\.filter\(p=>p\.asignacionActiva\)/);
});

test("la eliminación definitiva incluye la nueva relación de exenciones", () => {
  const eliminacion = leerBackend("src/services/eliminacionUsuarioService.ts");
  assert.match(eliminacion, /exenciones_pago_usuario: \{ usuarioId: usuario\._id \}/);
  assert.match(eliminacion, /usuarioAdministrador/);
});
