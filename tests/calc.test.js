// Pruebas de los cálculos críticos. Ejecutar con: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../calc.js');

const cfg = {
  diaInicio: 28, inicio: '2026-10',
  base: {ingreso: 3100, montos: {mama: 300, comida: 300, transporte: 100, emergencia: 200}},
  ciclos: {'2026-10': {ingreso: 2215.75, extras: [{n: 'Adelanto', monto: 500}], montos: {comida: 200, transporte: 100, emergencia: 0}}},
  dias: {mama: 28}
};

test('las sumas en céntimos no tienen errores de punto flotante', () => {
  assert.equal(C.sumar([{monto: 0.1}, {monto: 0.2}]), 0.3);
  assert.equal(C.restar(2215.75, 2003.82), 211.93);
  assert.equal(C.mas('6.9', 4, '4,00'), 14.9);
});

test('el ciclo va del día de cobro al día anterior del mes siguiente', () => {
  assert.equal(C.cicloDe(new Date(2026, 9, 27), 28), '2026-09');
  assert.equal(C.cicloDe(new Date(2026, 9, 28), 28), '2026-10');
  const r = C.rangoCiclo('2026-10', 28);
  assert.equal(C.ymd(r.start), '2026-10-28');
  assert.equal(C.ymd(r.end), '2026-11-27');
});

test('si el día de cobro no existe en el mes, usa el último día (febrero)', () => {
  const r = C.rangoCiclo('2027-01', 30);
  assert.equal(C.ymd(r.end), '2027-02-27');
  assert.equal(C.ymd(C.rangoCiclo('2027-02', 30).start), '2027-02-28');
  assert.equal(C.cicloDe(new Date(2027, 1, 28), 30), '2027-02');
});

test('el plan usa los montos propios del ciclo y suma extras e ingresos registrados una sola vez', () => {
  const movs = [{id: 'i1', tipo: 'ingreso', cat: 'ing_extra', monto: 200, fecha: '2026-10-27'},
                {id: 'd1', tipo: 'ingreso', cat: 'devolucion', monto: 75, fecha: '2026-10-29'}];
  const p = C.plan(cfg, movs, '2026-10');
  assert.equal(p.ingreso, 2215.75);
  assert.equal(p.ingMovs, 200, 'la devolución de un préstamo no es ingreso');
  assert.equal(p.totalIngreso, 2915.75);
  assert.equal(p.grupos.libre, 300);
  assert.equal(p.colchon, C.restar(2915.75, 600));
});

test('préstamos, transferencias, pagos y ahorro no cuentan como consumo', () => {
  const movs = [
    {id: 'g1', tipo: 'gasto', cat: 'comida', monto: 10.5, fecha: '2026-10-29'},
    {id: 'p1', tipo: 'gasto', cat: 'prestado', monto: 75, fecha: '2026-10-29'},
    {id: 'p2', tipo: 'prestamo', monto: 20, fecha: '2026-10-29'},
    {id: 't1', tipo: 'transferencia', monto: 300, desde: 'interbank', hacia: 'bcp', fecha: '2026-10-29'},
    {id: 'p-2026-10-mama', tipo: 'pago', cat: 'mama', monto: 300, fecha: '2026-10-28'},
    {id: 'a1', tipo: 'ahorro', cat: 'emergencia', monto: 100, fecha: '2026-10-28'}
  ];
  const s = C.resumen(cfg, movs, '2026-10', new Date(2026, 9, 30));
  assert.equal(s.consumo, 10.5);
  assert.equal(s.libre, 10.5);
  assert.equal(s.prestado, 95);
  assert.equal(s.transferido, 300);
  assert.equal(s.pagoDeuda, 300);
  assert.equal(s.ahorro, 100);
  assert.equal(s.balance, C.restar(s.ingresos, 310.5), 'el balance no resta ahorro ni transferencias');
});

test('los gastos anteriores al inicio del plan cuentan en el primer ciclo', () => {
  const movs = [{id: 'g', tipo: 'gasto', cat: 'comida', monto: 6.9, fecha: '2026-10-25'}];
  assert.equal(C.movsCiclo(cfg, movs, '2026-10').length, 1);
  assert.equal(C.movsCiclo(cfg, movs, '2026-11').length, 0);
});

test('presupuesto diario: reparte lo que queda entre los días restantes', () => {
  const p = C.plan(cfg, [], '2026-10'), r = C.rangoCiclo('2026-10', 28);
  const ms = [{tipo: 'gasto', cat: 'comida', monto: 60, fecha: '2026-11-01'}, {tipo: 'gasto', cat: 'comida', monto: 5, fecha: '2026-11-08'}];
  const d = C.presupuestoDiario({p, r, hoy: new Date(2026, 10, 8), ms, limiteReal: null});
  assert.equal(d.diasRestantes, 20);
  assert.equal(d.segunPlan, 240);
  assert.equal(d.base, 12);
  assert.equal(d.puedesHoy, 7);
  assert.equal(d.fuente, 'plan');
});

test('presupuesto diario: si tus saldos dicen que hay menos, manda el saldo real', () => {
  const p = C.plan(cfg, [], '2026-10'), r = C.rangoCiclo('2026-10', 28);
  const d = C.presupuestoDiario({p, r, hoy: new Date(2026, 10, 8), ms: [], limiteReal: 100});
  assert.equal(d.fuente, 'saldos');
  assert.equal(d.base, 5);
  const sin = C.presupuestoDiario({p, r, hoy: new Date(2026, 10, 8), ms: [], limiteReal: -50});
  assert.equal(sin.sinDinero, true);
  assert.equal(sin.puedesHoy, 0, 'sin dinero no sugiere gastar');
});

test('semáforo: verde, amarillo y rojo según el ritmo', () => {
  assert.equal(C.semaforo({gastado: 50, esperado: 100, presupuesto: 300}).nivel, 'verde');
  assert.equal(C.semaforo({gastado: 95, esperado: 100, presupuesto: 300}).nivel, 'amarillo');
  assert.equal(C.semaforo({gastado: 120, esperado: 100, presupuesto: 300}).nivel, 'rojo');
  assert.equal(C.semaforo({gastado: 10, esperado: 100, presupuesto: 300, limiteReal: -1}).nivel, 'rojo');
  assert.equal(C.semaforo({gastado: 95, esperado: 100, presupuesto: 300, umbrales: {amarillo: 0.96}}).nivel, 'verde');
});

test('pagos del ciclo: fecha según el día de cobro y marca de hecho', () => {
  const movs = [{id: 'p-2026-10-mama', tipo: 'pago', cat: 'mama', monto: 300, fecha: '2026-10-28'}];
  const items = C.pagos(cfg, movs, '2026-10');
  const mama = items.find(i => i.k === 'mama');
  assert.equal(C.ymd(mama.fecha), '2026-10-28');
  assert.ok(mama.hecho);
});

test('inversiones: costo promedio, ganancia realizada y no realizada', () => {
  const movs = [
    {tipo: 'inversion', op: 'compra', activo: 'btc', cantidad: 0.01, monto: 3000, comision: 10, fecha: '2026-11-01', creado: 1},
    {tipo: 'inversion', op: 'compra', activo: 'BTC', cantidad: 0.01, monto: 3200, comision: 10, fecha: '2026-11-05', creado: 2},
    {tipo: 'inversion', op: 'venta', activo: 'BTC', cantidad: 0.01, monto: 3500, comision: 10, fecha: '2026-11-10', creado: 3}
  ];
  const [btc] = C.inversiones(movs, {BTC: {precio: 340000, fecha: '2026-11-10'}});
  assert.equal(btc.cantidad, 0.01);
  assert.equal(btc.costo, 3110);
  assert.equal(btc.realizado, 380);
  assert.equal(btc.valor, 3400);
  assert.equal(btc.noRealizado, 290);
  const [sinPrecio] = C.inversiones(movs, {});
  assert.equal(sinPrecio.valor, null, 'sin cotización no inventa un valor');
});
