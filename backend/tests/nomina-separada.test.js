const test = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const fs = require('node:fs');
const { resolverNominaSeparada, generarExcelNominaSeparada, validarListaNomina } = require('../dist/services/NominaSeparadaService');
const u = (id, nombres, apellidoPaterno, apellidoMaterno = '', extra = {}) => ({ _id: id, nombres, apellidoPaterno, apellidoMaterno, ci: id, telefono: '70000000', sexo: 'MUJER', estado: 'ACTIVO', roles: [{ codigo: 'FRATERNO' }], ...extra });

test('conserva nombres y apellidos compuestos originales, no los infiere', () => {
  const usuarios = [u('1', 'ABIGAIL MARCIA', 'GOYTIA', 'AQUISE'), u('2', 'Martín Ernesto', 'Huanca', 'Del Valle'), u('3', 'KENJI GROVER', 'SADAKATA', 'CONDE'), u('4', 'JUAN DE DIOS', 'DE LA CRUZ', 'DEL CARMEN'), u('5', 'VIDA DE FRANCÍS', 'CARRILLO', 'VARGAS')];
  const entradas = usuarios.map(x => [x.nombres, x.apellidoPaterno, x.apellidoMaterno].join(' '));
  entradas[1] = ' MARTIN  ERNESTO HUANCA DEL VALLE ';
  const r = resolverNominaSeparada(entradas, usuarios);
  assert.equal(r.resumen.encontrados, 5);
  assert.equal(r.filas[1].apellidoMaterno, 'Del Valle');
  assert.equal(r.filas[3].nombres, 'JUAN DE DIOS');
  assert.equal(r.filas[3].apellidoPaterno, 'DE LA CRUZ');
  assert.equal(r.filas[4].nombres, 'VIDA DE FRANCÍS');
});
test('busca CI y código, evita homónimos y deduplica nombre + CI de una persona', () => {
  const usuarios = [u('001', 'Ana', 'Pérez'), u('002', 'Ana', 'Pérez'), u('003', 'Luis', 'Poma')];
  const r = resolverNominaSeparada(['Ana Pérez', 'CI: 001', 'CODIGO: FRA-3', 'Luis Poma', 'Nadie Existe'], usuarios, [{ usuarioId: '003', numeroFraterno: 'FRA-3' }]);
  assert.equal(r.resumen.ambiguos, 1); assert.equal(r.resumen.encontrados, 2);
  assert.equal(r.resumen.repetidos, 1); assert.equal(r.resumen.noEncontrados, 1);
});
test('no filtra por rol ni actividad y no incluye eliminados', () => {
  const usuarios = [u('1', 'Admin', 'Uno', '', { estado: 'INACTIVO', roles: [{ codigo: 'ADMINISTRADOR' }, { codigo: 'FRATERNO' }, { codigo: 'ADMINISTRADOR' }] }), u('2', 'Borrado', 'Dos', '', { fechaEliminado: '2026-01-01' })];
  const r = resolverNominaSeparada(['1', '2'], usuarios);
  assert.equal(r.filas.length, 1); assert.equal(r.filas[0].roles, 'ADMINISTRADOR / FRATERNO');
  assert.equal(r.filas[0].estado, 'INACTIVO');
});
test('datos incompletos no generan apellidos inventados; RU es opcional', () => {
  const r = resolverNominaSeparada(['VALERIA DAKMAR -- MORALES'], [u('1', 'VALERIA DAKMAR', '--', 'MORALES')]);
  assert.equal(r.filas[0].apellidoPaterno, '--');
  assert.equal(r.resumen.incompletos, 1);
  assert.equal(r.filas[0].ru, '');
});
test('mismo nombre en otro orden se marca para revisar; similares no se eligen', () => {
  const r = resolverNominaSeparada(['QUISBERT QUISBERT GABRIEL', 'GABRIELA QUISBERT QUISBERT'], [u('1', 'GABRIEL', 'QUISBERT', 'QUISBERT')]);
  assert.equal(r.resumen.encontrados, 1); assert.equal(r.resumen.noEncontrados, 1);
  assert.ok(r.filas[0].observaciones.some(x => x.includes('OTRO ORDEN')));
});
test('CI repetido se advierte; huella cambia si se modifica un campo exportado', () => {
  const usuarios = [u('1', 'A', 'B', 'C', { ci: '123' }), u('2', 'D', 'E', 'F', { ci: '123' })];
  const r = resolverNominaSeparada(['A B C'], usuarios);
  assert.match(r.filas[0].observaciones.join(' '), /CI COMPARTIDO/);
  usuarios[0].telefono = '71111111';
  assert.notEqual(r.huella, resolverNominaSeparada(['A B C'], usuarios).huella);
});
test('límites de entrada y exportación real: columnas, metadatos, ceros y texto seguro', async () => {
  for (const lista of [[], [''], [null], Array(1001).fill('A'), ['x'.repeat(201)]]) assert.throws(() => validarListaNomina(lista));
  const r = resolverNominaSeparada(['00123'], [u('id', '=1+1', 'DEL VALLE', 'DE FRANCÍS', { ci: '00123', registroUniversitario: '00012' })]);
  const antes = JSON.stringify(r);
  const buffer = await generarExcelNominaSeparada(r, { id: 'admin', nombre: 'Administrador' });
  const libro = new ExcelJS.Workbook(); await libro.xlsx.load(buffer);
  assert.equal(libro.worksheets.length, 2);
  const hoja = libro.getWorksheet('Nómina usuarios'); assert.equal(hoja.columnCount, 12);
  assert.equal(hoja.getCell('B2').value, '=1+1'); assert.equal(hoja.getCell('F2').value, '00123');
  assert.equal(hoja.getCell('G2').value, '00012'); assert.equal(hoja.getCell('C2').value, 'DEL VALLE');
  assert.equal(libro.getWorksheet('Control de revisión').getCell('B2').value, 'Administrador');
  assert.equal(JSON.stringify(r), antes);
});

test('exportación exige revisión vigente y confirmación de observaciones', async () => {
  const service = require('../dist/services/NominaSeparadaService');
  const controller = require('../dist/controllers/NominaSeparadaController');
  const original = service.consultarNominaSeparada;
  const reporte = resolverNominaSeparada(['1'], [u('1', 'Adrian', 'Garfias')]);
  service.consultarNominaSeparada = async () => reporte;
  const response = () => ({ code: 200, headers: {}, status(code) { this.code = code; return this; }, setHeader(k, v) { this.headers[k] = v; }, json(body) { this.body = body; return this; }, send(body) { this.body = body; return this; } });
  const req = { usuario: { _id: 'admin', nombres: 'Admin' }, body: { lista: ['1'], huella: 'antigua' } };
  try {
    let res = response(); await controller.exportarNominaSeparada(req, res); assert.equal(res.code, 409);
    req.body.huella = reporte.huella;
    res = response(); await controller.exportarNominaSeparada(req, res); assert.equal(res.code, 422);
    req.body.aceptarObservaciones = true;
    res = response(); await controller.exportarNominaSeparada(req, res); assert.equal(res.code, 200);
    assert.ok(Buffer.isBuffer(res.body));
    assert.match(res.headers['Content-Disposition'], /nomina_usuarios_separada.xlsx/);
    assert.equal(res.headers['Cache-Control'], 'no-store');
  } finally { service.consultarNominaSeparada = original; }
});

test('ambos endpoints exigen administrador y el servicio no contiene escrituras', () => {
  const rutas = fs.readFileSync('src/routes/ReporteRoutes.ts', 'utf8');
  assert.match(rutas, /"\/nomina-separada\/revisar", authenticate, soloAdministradorReal/);
  assert.match(rutas, /"\/nomina-separada\/exportar", authenticate, soloAdministradorReal/);
  assert.doesNotMatch(fs.readFileSync('src/services/NominaSeparadaService.ts', 'utf8'), /\.(save|create|updateOne|updateMany|deleteOne|deleteMany|bulkWrite)\(/);
});
