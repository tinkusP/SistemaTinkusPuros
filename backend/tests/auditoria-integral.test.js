const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { construirAuditoriaIntegral } = require('../dist/services/AuditoriaIntegralService');

const usuario = (id, extra = {}) => ({ _id: id, nombres: id, estado: 'ACTIVO', roles: [], ...extra });
const fixture = () => ({ gestion: { _id: 'g', nombre: '2026' }, usuarios: [], fraternos: [], preregistros: [], bloques: [], guias: [], asignaciones: [], tallas: [], cuotas: [], pagos: [], entregas: [], exenciones: [], ajustes: [] });
function agregarBloque(s, uid) {
  s.fraternos.push({ _id: `f${uid}`, usuarioId: uid, gestionId: 'g', estado: 'ACTIVO' });
  s.bloques.push({ _id: `b${uid}`, nombre: `Bloque ${uid}`, gestionId: 'g', estado: 'ACTIVO' });
  s.asignaciones.push({ _id: `a${uid}`, fraternoId: `f${uid}`, bloqueId: `b${uid}`, estado: 'ACTIVO' });
}
function agregarCuota(s, uid, extra = {}) {
  s.preregistros.push({ _id: `p${uid}`, usuarioId: uid, gestionId: 'g' });
  s.cuotas.push({ _id: `c${uid}`, preregistroId: `p${uid}`, montoTotal: 850, numeroCuotasElegidas: 3, ...extra });
}

test('incluye todas las cuentas y roles sin relaciones; excluye eliminadas, conserva inactivas', () => {
  const s = fixture();
  s.usuarios = ['ADMINISTRADOR', 'GUIA', 'FRATERNO', 'POSTULANTE', 'AYUDANTE'].map(r => usuario(r, { roles: [{ codigo: r }] }));
  s.usuarios.push(usuario('inactivo', { estado: 'INACTIVO' }), usuario('borrado', { fechaEliminado: new Date() }), usuario('eliminado', { estado: 'ELIMINADO' }));
  const r = construirAuditoriaIntegral(s);
  assert.equal(r.resumen.totalUsuarios, 6);
  assert.equal(r.resumen.esperado, 0);
  assert.ok(r.personas.every(p => p.estadoPago === 'SIN CUOTA'));
  assert.equal(r.personas.find(p => p.usuarioId === 'GUIA').roles, 'GUIA');
});

test('diferencia neta no equivale a personas con talla sin bloque; cuenta personas únicas', () => {
  const s = fixture(); s.usuarios = ['A', 'B', 'C'].map(x => usuario(x));
  agregarBloque(s, 'A');
  s.tallas = [{ _id: 't1', usuarioId: 'B', tallaPolera: 'M' }, { _id: 't2', usuarioId: 'C', tallaChamarra: 'L' }];
  const r = construirAuditoriaIntegral(s);
  assert.equal(r.resumen.diferenciaNeta, 1);
  assert.equal(r.resumen.conTallaSinBloque, 2);
  assert.equal(r.resumen.conBloqueSinTalla, 1);
  assert.equal(r.resumen.conTalla - r.resumen.conBloque, r.resumen.conTallaSinBloque - r.resumen.conBloqueSinTalla);
});

test('respeta pertenencia activa heredada y descarta relaciones retiradas y bloques inactivos', () => {
  const s = fixture(); s.usuarios = ['A', 'B', 'C'].map(x => usuario(x));
  for (const u of s.usuarios) agregarBloque(s, u._id);
  delete s.asignaciones[0].estado;
  s.asignaciones[1].estado = 'INACTIVO'; s.bloques[2].estado = 'INACTIVO';
  assert.equal(construirAuditoriaIntegral(s).resumen.conBloque, 1);
});

test('resuelve tallas históricas por fraterno y reporta duplicados, huérfanos y conflictos', () => {
  const s = fixture(); s.usuarios = [usuario('A'), usuario('B')];
  s.fraternos = [{ _id: 'viejo', usuarioId: 'A', gestionId: 'otra' }];
  s.tallas = [
    { _id: '1', fraternoId: 'viejo', tallaPolera: 'S', fechaActualizado: '2025-01-01' },
    { _id: '2', usuarioId: 'A', tallaPolera: 'M', fechaActualizado: '2026-01-01' },
    { _id: '3', usuarioId: 'B', fraternoId: 'viejo', tallaPolera: 'L' },
    { _id: '4', usuarioId: 'no-existe', tallaPolera: 'L' },
  ];
  const r = construirAuditoriaIntegral(s);
  assert.equal(r.resumen.registrosTalla, 4);
  assert.equal(r.resumen.conTalla, 1);
  assert.equal(r.personas[0].tallaPolera, 'M');
  assert.ok(r.diferencias.some(d => d.motivo.includes('CONTRADICTORIAS')));
  assert.ok(r.diferencias.some(d => d.motivo.includes('SIN USUARIO')));
  assert.ok(r.diferencias.some(d => d.motivo.includes('VARIOS REGISTROS')));
});

test('no normaliza datos: separa valor no reconocido, ausente y talla parcial', () => {
  const s = fixture(); s.usuarios = ['A', 'B', 'C'].map(x => usuario(x));
  s.tallas = [{ usuarioId: 'A', tallaPolera: ' M ' }, { usuarioId: 'B', tallaPolera: 'M', tallaChamarra: null }];
  const r = construirAuditoriaIntegral(s);
  assert.equal(r.personas[0].tallaPolera, ' M ');
  assert.equal(r.personas[0].estadoTalla, 'SIN DEFINIR');
  assert.equal(r.personas[1].estadoTalla, 'SOLO POLERA');
  assert.equal(r.personas[2].estadoTalla, 'SIN TALLA');
});

test('pagos válidos, ajustes y cuotas no se modifican; rechazados y eliminados no inflan pagado', () => {
  const s = fixture(); s.usuarios = [usuario('A')]; agregarCuota(s, 'A');
  s.pagos = [{ _id: '1', cuotaId: 'cA', monto: 100, numeroPago: 1, estadoRevision: 'VERIFICADO' }, { _id: '2', cuotaId: 'cA', monto: 50, numeroPago: 2, estadoRevision: 'PENDIENTE' }, { _id: '3', cuotaId: 'cA', monto: 200, estadoRevision: 'RECHAZADO' }, { _id: '4', cuotaId: 'cA', monto: 400, estadoRevision: 'VERIFICADO', fechaEliminado: '2026-01-01' }];
  s.ajustes = [{ usuarioId: 'A', cuotaId: 'cA', accion: 'MARCAR_DESCUENTO', montoEsperadoFinal: 425 }];
  const antes = JSON.stringify(s), r = construirAuditoriaIntegral(s), p = r.personas[0];
  assert.equal(p.esperado, 425); assert.equal(p.verificado, 100); assert.equal(p.pagado, 150); assert.equal(p.saldo, 325);
  assert.equal(p.cuota1, 'VERIFICADO'); assert.equal(p.cuota2, 'ENVIADO / REVISAR'); assert.equal(p.cuota3, 'PENDIENTE');
  assert.equal(p.tipo, 'DESCUENTO'); assert.equal(p.estadoPago, 'PENDIENTE REVISIÓN');
  assert.equal(r.pagosDetallados.length, 3); assert.equal(JSON.stringify(s), antes);
});

test('exenciones sin cuota no inventan deuda y restaurar prevalece sobre exención', () => {
  const s = fixture(); s.usuarios = [usuario('A'), usuario('B')]; agregarCuota(s, 'A', { exentoPago: true });
  s.exenciones = [{ usuarioId: 'B', gestionId: 'g', activa: true }];
  s.ajustes = [{ usuarioId: 'A', cuotaId: 'cA', accion: 'RESTAURAR_CALCULO', fecha: '2026-01-02' }, { usuarioId: 'A', cuotaId: 'cA', accion: 'EXCLUIR_CALCULO', fecha: '2026-01-01' }];
  const r = construirAuditoriaIntegral(s);
  assert.equal(r.personas[0].esperado, 850); assert.equal(r.personas[1].tipo, 'EXENTO'); assert.equal(r.personas[1].esperado, 0);
});

test('entrega devuelta no es entrega activa y conserva historial del responsable', () => {
  const s = fixture(); s.usuarios = [usuario('A')]; agregarBloque(s, 'A');
  s.entregas = [{ _id: 'e1', fraternoId: 'fA', prendaId: { nombre: 'POLERA' }, estado: 'DEVUELTO' }, { _id: 'e2', fraternoId: 'fA', prendaId: { nombre: 'CHAMARRA' }, estado: 'ENTREGADO', responsableEntrega: { nombres: 'Admin' } }];
  const r = construirAuditoriaIntegral(s);
  assert.equal(r.personas[0].estadoEntrega, 'SOLO CHAMARRA');
  assert.equal(r.personas[0].administradorChamarra, 'Admin');
  assert.equal(r.entregasDetalladas.length, 2);
});

test('CI repetido y nombres equivalentes generan alertas, nunca fusionan identidades', () => {
  const s = fixture(); s.usuarios = [usuario('A', { nombres: 'José Pérez', ci: '12' }), usuario('B', { nombres: 'Perez Jose', ci: '12' })];
  const r = construirAuditoriaIntegral(s);
  assert.equal(r.personas.length, 2);
  assert.equal(r.diferencias.filter(d => d.motivo === 'CI REPETIDO').length, 2);
  assert.equal(r.diferencias.filter(d => d.motivo.includes('NOMBRE SIMILAR')).length, 2);
});

test('sin gestión conserva universo y endpoint es de administrador, sin escrituras', () => {
  const s = fixture(); s.gestion = null; s.usuarios = [usuario('A')];
  assert.equal(construirAuditoriaIntegral(s).personas.length, 1);
  const source = fs.readFileSync('src/services/AuditoriaIntegralService.ts', 'utf8');
  assert.doesNotMatch(source, /\.(save|create|updateOne|updateMany|deleteOne|deleteMany|bulkWrite)\(/);
  assert.match(fs.readFileSync('src/routes/ReporteRoutes.ts', 'utf8'), /"\/auditoria-integral", authenticate, soloAdministradorReal/);
});
