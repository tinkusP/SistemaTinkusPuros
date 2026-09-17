const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

test('Excel real: ocho hojas, todas las personas, diferencias y datos seguros como texto', async () => {
  const frontendRequire = createRequire(path.resolve(__dirname, '../../frontend/package.json'));
  const ts = frontendRequire('typescript');
  const ExcelJS = frontendRequire('exceljs');
  const fuente = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/components/reportes/AuditoriaIntegral.tsx'), 'utf8');
  const funcion = fuente.slice(fuente.indexOf('async function exportarAuditoriaIntegral'));
  const codigo = ts.transpileModule(funcion + '\nexports.run = exportarAuditoriaIntegral;', { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  let blob, clicked = false;
  const sandbox = { exports: {}, require: frontendRequire, Blob, URL: { createObjectURL: b => { blob = b; return 'blob:test'; }, revokeObjectURL: () => {} }, document: { createElement: () => ({ click: () => { clicked = true; } }) }, setTimeout: fn => fn(), texto: v => v == null ? 'SIN REGISTRO' : typeof v === 'boolean' ? v ? 'SÍ' : 'NO' : String(v), titulo: s => s };
  // ExcelJS comprueba instanceof Array: ejecutar en el mismo realm que la biblioteca.
  new Function(...Object.keys(sandbox), codigo)(...Object.values(sandbox));
  await sandbox.exports.run({ generadoEn: '2026-09-17T00:00:00.000Z', gestion: { nombre: '2026' }, alcance: 'Solo lectura', resumen: { totalUsuarios: 2 }, porTipo: [], porBloque: [], personas: [{ usuarioId: '1', nombre: '=1+1', ci: '00123', tieneBloque: false, tieneTalla: true }, { usuarioId: '2', nombre: 'B', tieneBloque: true, tieneTalla: false }], pagosDetallados: [], entregasDetalladas: [], diferencias: [{ usuarioId: '1', motivo: 'CON TALLA SIN BLOQUE' }] });
  assert.equal(clicked, true);
  const libro = new ExcelJS.Workbook(); await libro.xlsx.load(await blob.arrayBuffer());
  assert.equal(libro.worksheets.length, 8);
  assert.equal(libro.getWorksheet('Todos los usuarios').rowCount, 3);
  assert.equal(libro.getWorksheet('Usuarios con talla sin bloque').rowCount, 2);
  assert.equal(libro.getWorksheet('Usuarios sin talla').rowCount, 2);
  assert.equal(libro.getWorksheet('Todos los usuarios').getCell('B2').value, '=1+1');
  assert.equal(libro.getWorksheet('Todos los usuarios').getCell('C2').value, '00123');
});
