'use strict';
/* Soles de Sebas: interfaz. Los cálculos de dinero viven en calc.js (probados con node --test). */
const {CATS, LIBRES, ESENCIALES, aC, aS, sumar, restar, mas, ymd, parseD, addDays, daysBetween, cicloDe, rangoCiclo, moverCiclo, clase, esConsumo, esLibre} = Calc;

const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const DOW = ['dom','lun','mar','mié','jue','vie','sáb'];
// Medio de pago → cuenta de donde sale la plata
const MEDIOS = [
  ['yape','Yape','bcp'], ['debito','Débito BCP','bcp'], ['debito_ib','Débito Interbank','interbank'], ['efectivo','Efectivo','efectivo'],
  ['plin','Plin','interbank'], ['adelanto','Adelanto de sueldo','bcp'], ['tc_bbva','Tarjeta BBVA','tc_bbva'], ['tc_bcp','Tarjeta BCP','tc_bcp'], ['credito','Crédito','tc']
];
const MEDIOS_NUEVOS = MEDIOS.filter(x => x[0] !== 'credito');
const isCred = k => k === 'credito' || String(k || '').startsWith('tc_');
const CUENTAS = [
  {k:'bcp', n:'BCP + Yape', h:'Tu semanal', icon:'wallet'}, {k:'interbank', n:'Interbank', h:'Pagos del mes', icon:'landmark'},
  {k:'bbva', n:'BBVA ahorro', h:'Metas de ahorro', icon:'piggy-bank'}, {k:'efectivo', n:'Efectivo', h:'Billetera', icon:'banknote'},
  {k:'tc_bbva', n:'Tarjeta BBVA', tipo:'tc', icon:'credit-card'}, {k:'tc_bcp', n:'Tarjeta BCP', tipo:'tc', icon:'credit-card'}
];
const LIQUIDAS = ['bcp', 'interbank', 'efectivo'];
const TIPOS = [
  ['gasto','Gasto','arrow-up-right'], ['ingreso','Ingreso','arrow-down-left'], ['transferencia','Transferencia','arrow-left-right'],
  ['prestamo','Préstamo','hand-coins'], ['devolucion','Devolución','undo-2'], ['ahorro','Meta','piggy-bank'], ['inversion','Inversión','trending-up']
];
const TIPO_N = {gasto:'Gasto', ingreso:'Ingreso', transferencia:'Transferencia', prestamo:'Préstamo', devolucion:'Devolución', pago:'Pago', ahorro:'Ahorro', inversion:'Inversión', otro:'Otro'};

/* ---------- estado ---------- */
const S = {cfg:null, movs:[], cierres:[], view:'inicio', dia:null, cOff:0, per:'7d', desde:'', hasta:'', q:'', tipoF:'todos', finTab:'resumen', scope:'ciclo', f:null, edit:null, sel:{tipo:'gasto', cat:'comida', medio:'yape'}};
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch(e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch(e) { return false; } }
};
try { const v = localStorage.getItem('soles.view2'); if (v) S.view = v; } catch(e) {}

/* ---------- utilidades de pantalla ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = n => 'S/ ' + aS(aC(n)).toLocaleString('es-PE', {minimumFractionDigits:2, maximumFractionDigits:2});
const money0 = n => 'S/ ' + Math.round(+n || 0).toLocaleString('es-PE');
const today = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
const short = d => `${d.getDate()} ${MESES[d.getMonth()].slice(0,3)}`;
const longD = d => `${DOW[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`;
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isFinite(n) ? n : 0; };
const ic = (n, cls) => `<i data-lucide="${n}"${cls ? ` class="${cls}"` : ''}></i>`;
const medioN = k => (MEDIOS.find(x => x[0] === k) || [k, k])[1];
const cuentaN = k => (CUENTAS.find(x => x.k === k) || {n: k}).n;
const pct = (a, b) => aC(b) > 0 ? Math.round(aC(a) / aC(b) * 100) : 0;
function bar(v, max, tick) {
  const p = aC(max) > 0 ? Math.min(100, aC(v) / aC(max) * 100) : (aC(v) > 0 ? 100 : 0);
  const cls = aC(max) > 0 ? (aC(v) > aC(max) ? 'bad' : aC(v) >= aC(max) * .85 ? 'warn' : '') : (aC(v) > 0 ? 'bad' : '');
  return `<div class="bar"><i class="${cls}" style="width:${p}%"></i>${tick != null ? `<span class="tick" style="left:${Math.min(100, tick)}%"></span>` : ''}</div>`;
}
let toastT;
function toast(msg){
  let el = $('.toast'); if (!el) { el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role','status'); document.body.appendChild(el); }
  el.textContent = msg; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => el.hidden = true, 2600);
}

/* ---------- datos ---------- */
const dia = () => (S.cfg && S.cfg.diaInicio) || 28;
const prefs = () => Object.assign({estricto: false, umbrales: {}}, LS.get('soles.prefs', {}));
const setPref = (k, v) => { const p = prefs(); p[k] = v; LS.set('soles.prefs', p); };
function cicloHoy(){ let id = cicloDe(today(), dia()); if (S.cfg && S.cfg.inicio && id < S.cfg.inicio) id = S.cfg.inicio; return id; }
const cicloVista = () => moverCiclo(cicloHoy(), S.cOff);
const nombreCiclo = id => { const r = rangoCiclo(id, dia()); return cap(MESES[r.end.getMonth()]) + ' ' + r.end.getFullYear(); };
const lastCierre = () => S.cierres.length ? [...S.cierres].sort((a,b) => a.fecha < b.fecha ? 1 : -1)[0] : null;
const lineas = () => Object.assign({tc_bbva: 500, tc_bcp: 500}, (S.cfg && S.cfg.lineas) || {});

function guardar(){
  const ok = LS.set('soles.config', S.cfg) && LS.set('soles.movs', S.movs);
  if (!ok) toast('No se pudo guardar. Revisa el espacio del teléfono.');
  return ok;
}
const newId = () => 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
function addMov(m){ S.movs = S.movs.concat({id: m.id || newId(), creado: Date.now(), ...m}); guardar(); }
function updMov(id, m){ S.movs = S.movs.map(x => x.id === id ? {...x, ...m, id} : x); guardar(); }
function delMov(id){ S.movs = S.movs.filter(x => x.id !== id); guardar(); }
function setPath(o, p, v){ const ks = p.split('.'); for (const k of ks.slice(0, -1)) { if (!o[k] || typeof o[k] !== 'object') o[k] = {}; o = o[k]; } o[ks[ks.length - 1]] = v; }
// Un cambio hecho a mano en el plan queda en "locales" para que las actualizaciones de Claude no lo pisen
function cambiarPlan(path, v){ setPath(S.cfg, path, v); S.cfg.locales = Object.assign({}, S.cfg.locales, {[path]: v}); guardar(); }

/* ---------- objetivos ---------- */
const BASE_OBJ = [['emergencia','emergencia'], ['brasil','viaje'], ['inversion','inversion']];
function objetivos(){
  const aj = LS.get('soles.objAjustes', {}), M = (S.cfg && S.cfg.metas) || {};
  const base = BASE_OBJ.map(([k, tipo]) => ({id: k, nombre: (aj[k] && aj[k].nombre) || CATS[k].n, meta: +((aj[k] && aj[k].meta != null) ? aj[k].meta : (M[k] && M[k].meta) || 0),
    inicial: +((M[k] && M[k].inicial) || 0), estado: (aj[k] && aj[k].estado) || 'activo', tipo, fechaMeta: (aj[k] && aj[k].fechaMeta) || '', builtin: true}));
  const propios = LS.get('soles.objetivos', []).map(o => ({inicial: 0, estado: 'activo', ...o, builtin: false}));
  const idPlan = cicloHoy(), pl = S.cfg ? Calc.plan(S.cfg, S.movs, idPlan) : null, plSig = S.cfg ? Calc.plan(S.cfg, S.movs, moverCiclo(idPlan, 1)) : null;
  return [...base, ...propios].map(o => {
    const aportes = S.movs.filter(m => clase(m) === 'ahorro' && m.cat === o.id).sort((a,b) => a.fecha < b.fecha ? 1 : -1);
    const saldo = mas(o.inicial, sumar(aportes)), falta = aS(Math.max(0, aC(o.meta) - aC(saldo)));
    let mensual = o.builtin ? +(plSig && plSig.montos[o.id] || pl && pl.montos[o.id] || 0) : 0, fuente = 'plan';
    if (o.fechaMeta) { const meses = Math.max(1, Math.ceil(daysBetween(today(), parseD(o.fechaMeta)) / 30)); mensual = aS(Math.ceil(aC(falta) / meses)); fuente = 'fecha'; }
    if (!mensual && aportes.length) { const ult = aportes.slice(0, 3); mensual = sumar(ult) / ult.length; fuente = 'historial'; }
    const meses = mensual > 0 && falta > 0 ? Math.ceil(falta / mensual) : null;
    const fechaEst = meses != null ? new Date(today().getFullYear(), today().getMonth() + meses, today().getDate()) : null;
    return {...o, aportes, saldo, falta, pct: pct(saldo, o.meta), mensual, fuenteMensual: fuente, meses, fechaEst};
  });
}
const objN = k => (CATS[k] && CATS[k].n) || ((objetivos().find(o => o.id === k) || {}).nombre) || k;
const catN = k => (CATS[k] && CATS[k].n) || objN(k);
const catIcon = k => (CATS[k] && CATS[k].icon) || 'circle-dot';

/* ---------- saldos reales: el último cierre + lo registrado después ---------- */
function saldoReal(id){
  const c = lastCierre(); if (!c) return null;
  const s = c.saldos || {};
  let liquidoC = LIQUIDAS.reduce((t, k) => t + aC(s[k]), 0);
  const tieneLiquido = LIQUIDAS.some(k => s[k] !== undefined && s[k] !== '');
  if (!tieneLiquido) return null;
  // Si el último cierre es de antes del cobro, el sueldo todavía no estaba en las cuentas
  const r = rangoCiclo(id, dia()), sueldoNuevo = c.fecha < ymd(r.start) && today() >= r.start;
  if (sueldoNuevo) liquidoC += aC(Calc.plan(S.cfg, S.movs, id).ingreso);
  for (const m of S.movs.filter(m => m.fecha > c.fecha)) {
    const cl = clase(m);
    if ((cl === 'gasto' || cl === 'prestamo') && !isCred(m.medio)) liquidoC -= aC(m.monto);
    else if (cl === 'pago' || cl === 'ahorro' || (cl === 'inversion' && m.op !== 'venta')) liquidoC -= aC(m.monto) + (cl === 'inversion' ? aC(m.comision) : 0);
    else if (cl === 'ingreso' || cl === 'devolucion' || (cl === 'inversion' && m.op === 'venta')) liquidoC += aC(m.monto) - (cl === 'inversion' ? aC(m.comision) : 0);
    else if (cl === 'transferencia') { const d = LIQUIDAS.includes(m.desde), h = LIQUIDAS.includes(m.hacia); if (d && !h) liquidoC -= aC(m.monto); if (!d && h) liquidoC += aC(m.monto); }
  }
  const pend = Calc.pagos(S.cfg, S.movs, id).filter(i => !i.hecho);
  const reservado = sumar(pend);
  const L = lineas();
  const deudaTC = CUENTAS.filter(x => x.tipo === 'tc' && s[x.k] !== undefined && s[x.k] !== '').reduce((t, x) => t + Math.max(0, aC(L[x.k]) - aC(s[x.k])), 0);
  const total = aS(liquidoC + aC(s.bbva));
  return {fecha: c.fecha, sueldoNuevo, liquido: aS(liquidoC), reservado, libre: restar(aS(liquidoC), reservado), total, bbva: +(s.bbva || 0), deudaTC: aS(deudaTC), dias: daysBetween(parseD(c.fecha), today())};
}

/* ---------- contexto del ciclo: todo lo que las pantallas necesitan ---------- */
function contexto(id, fechaDia){
  const cfg = S.cfg, hoy = today(), p = Calc.plan(cfg, S.movs, id), r = rangoCiclo(id, dia()), ms = Calc.movsCiclo(cfg, S.movs, id);
  const enCiclo = hoy >= r.start && hoy <= r.end, real = enCiclo ? saldoReal(id) : null;
  const pr = prefs();
  const pd = Calc.presupuestoDiario({p, r, hoy: fechaDia || hoy, ms, limiteReal: real ? real.libre : null, estricto: pr.estricto});
  const rt = Calc.ritmo(p, r, hoy);
  const res = Calc.resumen(cfg, S.movs, id, hoy);
  const sem = Calc.semaforo({gastado: res.libre, esperado: rt.esperado, presupuesto: p.grupos.libre, limiteReal: real ? real.libre : null, umbrales: pr.umbrales});
  const pagos = Calc.pagos(cfg, S.movs, id);
  return {id, p, r, ms, real, pd, rt, res, sem, pagos, hoy, enCiclo, antes: hoy < r.start, pr};
}

/* ---------- análisis: recomendaciones a partir de datos reales ---------- */
function analisis(x){
  const out = [], hoy = x.hoy, add = (prio, cl, icon, texto) => out.push({prio, cl, icon, texto});
  if (!x.ms.length && !x.real) add(3, 'dato', 'info', 'Todavía hay pocos registros en este ciclo. Mientras más gastos anotes, más precisas serán las recomendaciones.');
  for (const i of x.pagos.filter(i => !i.hecho && i.fecha)) {
    const d = daysBetween(hoy, i.fecha);
    if (d < 0 && x.enCiclo) add(0, 'recomendacion', 'alert-triangle', `${catN(i.k)} (${money(i.monto)}) venció el ${longD(i.fecha)}. Págalo o márcalo como hecho en Presupuesto.`);
    else if (d >= 0 && d <= 3) add(1, 'recomendacion', i.ahorro ? 'piggy-bank' : 'calendar-clock', i.ahorro
      ? `Transfiere ${money(i.monto)} a ${catN(i.k)} ${d === 0 ? 'hoy' : 'el ' + longD(i.fecha)}, antes de hacer compras, para no gastarlo sin querer.`
      : `Prioriza el pago de ${catN(i.k)}: ${money(i.monto)} ${d === 0 ? 'hoy' : 'el ' + longD(i.fecha)}.`);
  }
  if (x.enCiclo) {
    if (x.pd.sinDinero) add(0, 'recomendacion', 'shield-alert', 'No tienes margen para gastos variables sin tocar dinero reservado. Hasta tu próximo cobro, limita tus gastos a lo esencial.');
    else if (aC(x.pd.puedesHoy) > 0) add(2, 'recomendacion', 'wallet', `Puedes gastar hasta ${money(x.pd.puedesHoy)} hoy sin comprometer tus pagos ni tu ahorro.`);
    else add(1, 'recomendacion', 'wallet', `Ya usaste tu presupuesto de hoy (${money(x.pd.base)}). Lo que gastes desde ahora reduce lo disponible de los próximos días.`);
    if (x.sem.nivel === 'rojo' || x.sem.nivel === 'amarillo') {
      const diario = x.rt.transcurridos ? aC(x.res.libre) / x.rt.transcurridos : 0;
      if (diario > 0) {
        const restan = aC(x.p.grupos.libre) - aC(x.res.libre), dias = Math.floor(restan / diario);
        const fin = addDays(hoy, dias);
        if (fin < x.r.end) add(1, 'proyeccion', 'trending-down', `Si mantienes este ritmo (${money(aS(diario))} al día), tu presupuesto se acaba ${dias <= 0 ? 'hoy' : 'alrededor del ' + longD(fin)}, antes de tu cobro.`);
      }
    }
    const diasQuedan = daysBetween(hoy, x.r.end) + 1;
    for (const k of LIBRES) {
      const lim = +x.p.montos[k] || 0, g = x.res.porCategoria[k] || 0;
      if (lim > 0 && aC(g) >= aC(lim) * .85 && diasQuedan >= 4) add(aC(g) > aC(lim) ? 1 : 2, 'recomendacion', CATS[k].icon || 'pie-chart', `Has usado el ${pct(g, lim)}% de ${CATS[k].n} y quedan ${diasQuedan} días del ciclo. Reduce los gastos no esenciales de esta categoría.`);
      if (!lim && aC(g) > 0) add(2, 'dato', CATS[k].icon || 'pie-chart', `Gastaste ${money(g)} en ${CATS[k].n}, que no tiene presupuesto este ciclo. Ajústalo en Finanzas → Ajustes si va a repetirse.`);
    }
    const cred = x.ms.filter(m => esConsumo(m) && isCred(m.medio));
    if (cred.length) add(1, 'recomendacion', 'credit-card', `Usaste tarjeta de crédito ${cred.length} ${cred.length === 1 ? 'vez' : 'veces'} (${money(sumar(cred))}). Con tasas de casi 100% al año, págala completa y evita usarla para el día a día.`);
    const c = lastCierre();
    if (!c || daysBetween(parseD(c.fecha), hoy) >= 2) add(2, 'recomendacion', 'clipboard-check', c ? `Tu último cierre fue el ${longD(parseD(c.fecha))}. Cierra el día para que tus saldos estén al día.` : 'Cierra el día anotando tus saldos. Así la app sabe cuánto tienes de verdad, no solo lo que dice el plan.');
  }
  const teDeben = restar(sumar(S.movs.filter(m => clase(m) === 'prestamo')), sumar(S.movs.filter(m => clase(m) === 'devolucion')));
  if (aC(teDeben) > 0) add(3, 'dato', 'hand-coins', `Te deben ${money(teDeben)} de préstamos. Cuando te paguen, regístralo como Devolución.`);
  // Comparación con el ciclo anterior en los mismos días transcurridos
  if (x.enCiclo && x.rt.transcurridos >= 3 && S.cfg.inicio && moverCiclo(x.id, -1) >= S.cfg.inicio) {
    const prevId = moverCiclo(x.id, -1), pr = rangoCiclo(prevId, dia()), corte = ymd(addDays(pr.start, x.rt.transcurridos - 1));
    const prevGasto = sumar(Calc.movsCiclo(S.cfg, S.movs, prevId).filter(m => esLibre(m) && m.fecha <= corte));
    if (aC(prevGasto) > 0) add(3, 'dato', aC(x.res.libre) <= aC(prevGasto) ? 'trending-down' : 'trending-up',
      aC(x.res.libre) <= aC(prevGasto) ? `Vas gastando ${money(restar(prevGasto, x.res.libre))} menos que el ciclo pasado a esta altura.` : `Vas gastando ${money(restar(x.res.libre, prevGasto))} más que el ciclo pasado a esta altura.`);
  }
  if (x.enCiclo && x.p.grupos.ahorro > 0) {
    const hechos = sumar(x.pagos.filter(i => i.ahorro && i.hecho), i => i.hecho.monto);
    if (aC(hechos) >= aC(x.p.grupos.ahorro)) add(3, 'dato', 'check-circle-2', `Tu ahorro del ciclo va según lo previsto: ya transferiste ${money(hechos)}.`);
  }
  return out.sort((a, b) => a.prio - b.prio);
}
const TAG_N = {dato:'Dato', estimacion:'Estimación', proyeccion:'Proyección', recomendacion:'Recomendación'};
const tipHTML = t => `<div class="tip ${t.prio <= 0 ? 'alta' : t.prio === 1 ? 'media' : ''}"><span class="ic">${ic(t.icon)}</span><div><span class="tag ${t.cl}">${TAG_N[t.cl]}</span><p>${esc(t.texto)}</p></div></div>`;

/* ---------- filas de movimiento ---------- */
function movInfo(m){
  const cl = clase(m);
  let titulo = catN(m.cat), icon = catIcon(m.cat), signo = '-', det = '';
  if (cl === 'ingreso') { titulo = m.nota || 'Ingreso extra'; icon = 'arrow-down-left'; signo = '+'; det = cuentaN(m.cuenta || 'bcp'); }
  else if (cl === 'devolucion') { titulo = 'Te devolvió ' + (m.persona || 'un préstamo'); icon = 'undo-2'; signo = '+'; }
  else if (cl === 'prestamo') { titulo = 'Préstamo a ' + (m.persona || (m.nota || 'alguien')); icon = 'hand-coins'; }
  else if (cl === 'transferencia') { titulo = `${cuentaN(m.desde)} → ${cuentaN(m.hacia)}`; icon = 'arrow-left-right'; signo = ''; }
  else if (cl === 'pago') { titulo = 'Pago: ' + catN(m.cat); icon = 'calendar-check'; }
  else if (cl === 'ahorro') { titulo = (aC(m.monto) < 0 ? 'Retiro de ' : 'Aporte a ') + objN(m.cat); icon = 'piggy-bank'; signo = aC(m.monto) < 0 ? '+' : '-'; }
  else if (cl === 'inversion') { titulo = `${m.op === 'venta' ? 'Venta' : 'Compra'} de ${m.activo || 'inversión'}`; icon = 'trending-up'; signo = m.op === 'venta' ? '+' : '-'; }
  if (!det) det = m.medio ? medioN(m.medio) : '';
  return {cl, titulo, icon, signo, det};
}
function movRow(m){
  const i = movInfo(m), hora = m.creado > 1e12 ? new Date(m.creado).toTimeString().slice(0,5) : '';
  const desc = [m.nota && i.cl !== 'ingreso' && i.cl !== 'prestamo' ? m.nota : '', i.det, hora].filter(Boolean).join(' · ');
  return `<button class="mov" data-act="editmov" data-id="${esc(m.id)}"><span class="ico">${ic(i.icon)}</span>
    <span class="t"><b>${esc(i.titulo)}</b><small>${esc(desc)}</small></span>
    <span class="a num ${i.signo === '+' ? 'in' : ''}">${i.signo}${money(Math.abs(m.monto))}<small>${TIPO_N[i.cl]}</small></span></button>`;
}
const empty = (icon, t, s) => `<div class="empty"><span class="ico">${ic(icon)}</span><b>${t}</b>${s ? `<span class="sub">${s}</span>` : ''}</div>`;

/* ================= INICIO ================= */
function vInicio(){
  const id = cicloHoy(), x = contexto(id), hoy = today();
  const sel = S.dia ? parseD(S.dia) : hoy, esHoy = ymd(sel) === ymd(hoy);
  const xs = esHoy ? x : contexto(cicloDe(sel, dia()) < (S.cfg.inicio || '') ? S.cfg.inicio : cicloDe(sel, dia()), sel);
  const proxCobro = x.r.siguiente, diasCobro = daysBetween(hoy, proxCobro);
  const dispPlan = x.pd.restanteCiclo, disp = x.real && aC(x.real.libre) < aC(dispPlan) ? x.real.libre : dispPlan;
  const proxIngreso = Calc.plan(S.cfg, S.movs, moverCiclo(id, 1)).ingreso;

  const hero = `<section class="card hero">
    <div class="row"><span class="label">Disponible para gastar</span><span class="label">${x.antes ? 'Empieza el ' + short(x.r.start) : nombreCiclo(id)}</span></div>
    <div class="big num">${money(Math.max(0, disp))}</div>
    ${x.enCiclo ? `<span class="today">${ic('sun')} Hoy puedes gastar <b class="num">${money(x.pd.puedesHoy)}</b></span>` : ''}
    <div class="rows">
      ${x.real ? `<div class="row"><span>Dinero en cuentas <small>(cierre ${short(parseD(x.real.fecha))}${x.real.sueldoNuevo ? ' + sueldo' : ''})</small></span><b class="num">${money(x.real.liquido)}</b></div>
      <div class="row"><span>Reservado para pagos y ahorro</span><b class="num">− ${money(x.real.reservado)}</b></div>
      <div class="row"><span>Libre según tus saldos</span><b class="num">${money(x.real.libre)}</b></div>` :
      `<div class="row"><span>Dinero en cuentas</span><b>Cierra el día para verlo</b></div>`}
      <div class="row"><span>Presupuesto del ciclo que te queda</span><b class="num">${money(dispPlan)}</b></div>
      <div class="row"><span>Próximo cobro</span><b class="num">${money(proxIngreso)} · ${diasCobro <= 0 ? 'hoy' : 'en ' + diasCobro + (diasCobro === 1 ? ' día' : ' días')}</b></div>
    </div>
    <details><summary>¿Cómo se calcula?</summary><div class="explain">
      <span>Es el menor entre dos números, para no confundir saldo bancario con dinero libre:</span>
      <span>• <b>Presupuesto que te queda:</b> ${money(x.pd.presupuesto)} de gastos del día a día menos ${money(x.res.libre)} ya gastados.</span>
      <span>• <b>Libre según saldos:</b> tus cuentas BCP, Interbank y efectivo del último cierre, ajustadas con lo registrado después, menos los pagos y aportes que faltan. No cuenta el ahorro de BBVA ni las tarjetas.</span>
      <span>Préstamos, devoluciones, transferencias entre tus cuentas y ahorro no se cuentan como gasto.</span></div></details>
  </section>`;

  const semH = `<section class="card tight"><div class="light ${x.sem.nivel}"><span class="dot">${ic(x.sem.nivel === 'verde' ? 'check' : x.sem.nivel === 'gris' ? 'minus' : 'alert-triangle')}</span>
    <div><h3>${x.sem.titulo}</h3><p>${esc(x.sem.texto)}</p><p class="num" style="font-size:12px">Gastado ${money(x.res.libre)} de ${money(x.p.grupos.libre)} · lo esperado a hoy era ${money(x.rt.esperado)}</p></div></div></section>`;

  // Ayer · Hoy · Mañana alrededor del día elegido
  const dAy = addDays(sel, -1), dMa = addDays(sel, 1);
  const gastoDia = d => sumar(S.movs.filter(m => esLibre(m) && m.fecha === ymd(d)));
  const gHoy = gastoDia(sel), gAy = gastoDia(dAy);
  const pdSel = xs.pd, difAy = restar(xs.pd.promedio, gAy);
  const pagosMa = Calc.pagos(S.cfg, S.movs, cicloDe(dMa, dia())).filter(i => !i.hecho && i.fecha && ymd(i.fecha) === ymd(dMa));
  const esFuturo = sel > hoy;
  const minis = `<div class="grid3">
    <button class="mini" data-act="dia" data-f="${ymd(dAy)}" style="text-align:left"><span class="k">${daysBetween(hoy, dAy) === -1 ? 'Ayer' : short(dAy)}</span><span class="v num">${money(gAy)}</span>
      <span class="s">${aC(difAy) >= 0 ? money(difAy) + ' bajo el promedio' : money(-difAy) + ' sobre el promedio'}</span></button>
    <div class="mini on"><span class="k">${esHoy ? 'Hoy' : short(sel)}</span>${esFuturo ? '<span class="proj">Proyección</span>' : ''}<span class="v num">${money(gHoy)}</span>
      <span class="s">${esHoy ? `Presupuesto ${money(pdSel.base)} · quedan ${money(pdSel.puedesHoy)}` : `Promedio diario ${money(pdSel.promedio)}`}</span></div>
    <button class="mini" data-act="dia" data-f="${ymd(dMa)}" style="text-align:left"><span class="k">${daysBetween(hoy, dMa) === 1 ? 'Mañana' : short(dMa)}</span>${dMa > hoy ? '<span class="proj">Proyección</span>' : ''}
      <span class="v num">${dMa > hoy ? money(pdSel.base) : money(gastoDia(dMa))}</span>
      <span class="s">${dMa > hoy ? (pagosMa.length ? pagosMa.map(i => catN(i.k) + ' ' + money0(i.monto)).join(', ') : 'Sin pagos programados') : 'Gastado'}</span></button></div>`;

  const movsDia = S.movs.filter(m => m.fecha === ymd(sel)).sort((a,b) => (b.creado||0) - (a.creado||0));
  const cierre = S.cierres.find(c => c.fecha === ymd(sel));
  const diaCard = `<section class="card">
    <div class="datebar"><button class="iconbtn" data-act="diamov" data-k="-1" aria-label="Día anterior">${ic('chevron-left')}</button>
      <label class="datepick">${ic('calendar-days')}<span>${esHoy ? 'Hoy, ' + longD(sel) : cap(longD(sel))}</span><input type="date" id="pick-dia" value="${ymd(sel)}" aria-label="Elegir fecha"></label>
      <button class="iconbtn" data-act="diamov" data-k="1" aria-label="Día siguiente">${ic('chevron-right')}</button></div>
    ${minis}
    ${movsDia.length ? `<div>${movsDia.map(movRow).join('')}</div>` : empty('receipt', esFuturo ? 'Día futuro' : 'Sin movimientos este día', esFuturo ? 'Los montos de este día son proyecciones.' : 'Toca + para registrar un gasto o ingreso.')}
    ${sel <= hoy ? `<button class="btn ${cierre ? 'ghost' : ''}" data-act="cierre" data-f="${ymd(sel)}">${ic(cierre ? 'pencil' : 'clipboard-check')} ${cierre ? 'Editar cierre del día' : esHoy ? 'Finalizar día' : 'Cerrar este día'}</button>` : ''}
    ${!esHoy ? `<button class="link" data-act="dia" data-f="">Volver a hoy</button>` : ''}
  </section>`;

  const tips = analisis(x).slice(0, 3);
  const tipsH = `<section class="card"><div class="row"><h2>¿Qué debo hacer hoy?</h2><button class="link" data-act="go" data-v="finanzas">Ver análisis</button></div>
    ${tips.length ? tips.map(tipHTML).join('') : empty('check-circle-2', 'Todo en orden', 'No hay nada urgente por ahora.')}</section>`;

  const estricto = x.pr.estricto ? `<section class="card tight" style="border-color:var(--amber)"><div class="row"><span>${ic('shield')} <b>Modo control estricto activo</b><br><span class="sub">Solo cuenta presupuesto para alimentación, transporte y salud.</span></span><button class="btn sm ghost" data-act="estricto">Quitar</button></div></section>` : '';

  return hero + estricto + semH + tipsH + diaCard;
}

/* ================= MOVIMIENTOS ================= */
function rangoPeriodo(){
  const hoy = today(), id = cicloHoy();
  switch (S.per) {
    case 'hoy': return {a: hoy, b: hoy, n: 'Hoy'};
    case 'ayer': { const d = addDays(hoy, -1); return {a: d, b: d, n: 'Ayer'}; }
    case '7d': return {a: addDays(hoy, -6), b: hoy, n: 'Últimos 7 días'};
    case 'ciclo': { const r = rangoCiclo(id, dia()); return {a: S.cfg.inicio === id ? parseD('2000-01-01') : r.start, b: r.end, n: 'Este mes (ciclo)', ciclo: id}; }
    case 'prev': { const pid = moverCiclo(id, -1), r = rangoCiclo(pid, dia()); return {a: r.start, b: r.end, n: 'Mes anterior', ciclo: pid}; }
    default: return {a: S.desde ? parseD(S.desde) : addDays(hoy, -30), b: S.hasta ? parseD(S.hasta) : hoy, n: 'Rango'};
  }
}
function vMovimientos(){
  const rp = rangoPeriodo(), a = ymd(rp.a), b = ymd(rp.b), q = S.q.trim().toLowerCase();
  let ms = S.movs.filter(m => m.fecha >= a && m.fecha <= b);
  if (S.tipoF !== 'todos') ms = ms.filter(m => S.tipoF === 'gasto' ? clase(m) === 'gasto' : S.tipoF === 'ingreso' ? ['ingreso','devolucion'].includes(clase(m)) : S.tipoF === 'otros' ? !['gasto','ingreso','devolucion'].includes(clase(m)) : true);
  if (q) ms = ms.filter(m => [movInfo(m).titulo, m.nota, catN(m.cat), medioN(m.medio), m.persona, m.activo].join(' ').toLowerCase().includes(q));
  ms.sort((x, y) => x.fecha === y.fecha ? (y.creado||0) - (x.creado||0) : x.fecha < y.fecha ? 1 : -1);
  const gastos = sumar(ms.filter(esConsumo)), ingresos = sumar(ms.filter(m => clase(m) === 'ingreso'));
  const neutros = ms.filter(m => ['transferencia','prestamo','devolucion','ahorro','inversion'].includes(clase(m))).length;
  const fin = rp.b > today() ? today() : rp.b, desdeG = rp.a < parseD('2020-01-01') ? (ms.length ? parseD(ms[ms.length-1].fecha) : fin) : rp.a;
  const dias = fin < desdeG ? 1 : Math.min(62, daysBetween(desdeG, fin) + 1);
  const ini = addDays(fin, -(dias - 1));
  const serie = [...Array(dias)].map((_, i) => { const d = addDays(ini, i); return {d, v: sumar(ms.filter(m => esConsumo(m) && m.fecha === ymd(d)))}; });
  const chart = dias > 1 ? barsChart(serie.map(s => ({label: dias <= 8 ? DOW[s.d.getDay()] : s.d.getDate() + '', full: longD(s.d), v: s.v})), {every: dias <= 8 ? 1 : Math.ceil(dias / 6)}) : '';
  const grupos = {}; for (const m of ms) (grupos[m.fecha] = grupos[m.fecha] || []).push(m);
  const pers = [['hoy','Hoy'],['ayer','Ayer'],['7d','7 días'],['ciclo','Este mes'],['prev','Mes anterior'],['rango','Rango']];
  return `<div class="chips">${pers.map(([k,n]) => `<button class="${S.per === k ? 'on' : ''}" data-act="per" data-k="${k}">${n}</button>`).join('')}</div>
    ${S.per === 'rango' ? `<div class="two"><label class="field"><span class="label">Desde</span><input type="date" id="rg-a" value="${esc(S.desde || ymd(addDays(today(), -30)))}"></label><label class="field"><span class="label">Hasta</span><input type="date" id="rg-b" value="${esc(S.hasta || ymd(today()))}"></label></div>` : ''}
    <label class="search">${ic('search')}<input id="mov-q" type="search" placeholder="Buscar: pollo, Yape, Halloween…" value="${esc(S.q)}"></label>
    <div class="seg">${[['todos','Todo'],['gasto','Gastos'],['ingreso','Ingresos'],['otros','Otros']].map(([k,n]) => `<button class="${S.tipoF === k ? 'on' : ''}" data-act="tipoF" data-k="${k}">${n}</button>`).join('')}</div>
    <section class="card"><div class="grid3">
      <div><span class="label">Gastos</span><div class="num" style="font-weight:700;font-size:17px">${money(gastos)}</div></div>
      <div><span class="label">Ingresos</span><div class="num" style="font-weight:700;font-size:17px;color:var(--green)">${money(ingresos)}</div></div>
      <div><span class="label">Neutros</span><div class="num" style="font-weight:700;font-size:17px">${neutros}</div><span class="sub" style="font-size:11px">transf., préstamos, ahorro</span></div></div>
      ${chart}</section>
    <section class="card">${ms.length ? Object.keys(grupos).map(f => { const d = parseD(f), g = grupos[f];
      return `<div class="daygrp"><span>${cap(longD(d))}</span><span class="num">${money(sumar(g.filter(esConsumo)))}</span></div><div>${g.map(movRow).join('')}</div>`; }).join('')
      : empty('search-x', 'No hay movimientos', q ? 'Prueba con otra palabra o periodo.' : 'En este periodo no registraste nada.')}</section>`;
}

/* ---------- gráfico de barras simple, con toque para ver el valor ---------- */
function barsChart(data, o = {}){
  const W = 340, H = o.h || 140, top = 16, bot = 20, n = data.length, slot = W / n, bw = Math.max(4, Math.min(28, slot - 4));
  const max = Math.max(o.ref || 0, ...data.map(d => Math.max(d.v, d.v2 || 0))) * 1.15 || 1, y = v => top + (H - top - bot) * (1 - v / max);
  const uid = 'c' + Math.random().toString(36).slice(2, 7);
  return `<div class="chart" data-chart="${uid}"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.aria || 'Gráfico')}">
    ${o.ref ? `<line x1="0" x2="${W}" y1="${y(o.ref)}" y2="${y(o.ref)}" stroke="#94A3B8" stroke-dasharray="4 4"/><text x="${W}" y="${y(o.ref) - 4}" text-anchor="end" font-size="10" fill="#64748B">${esc(o.refLabel || '')}</text>` : ''}
    ${data.map((d, i) => { const x = i * slot + (slot - bw) / 2; const two = d.v2 != null; const w = two ? bw / 2 - 1 : bw;
      return `<g data-tip="${esc((d.full || d.label) + ': ' + (two ? (o.n1 || '') + ' ' + money(d.v) + ' · ' + (o.n2 || '') + ' ' + money(d.v2) : money(d.v)))}" style="cursor:pointer">
        <rect x="${x - 2}" y="${top}" width="${bw + 4}" height="${H - top - bot}" fill="transparent"/>
        <rect x="${x}" y="${y(d.v)}" width="${w}" height="${Math.max(0, H - bot - y(d.v))}" rx="3" fill="${o.color ? o.color(d) : (o.ref && d.v > o.ref ? '#F59E0B' : '#2563EB')}"/>
        ${two ? `<rect x="${x + w + 2}" y="${y(d.v2)}" width="${w}" height="${Math.max(0, H - bot - y(d.v2))}" rx="3" fill="#94A3B8"/>` : ''}
        ${i % (o.every || 1) === 0 ? `<text x="${x + bw / 2}" y="${H - 5}" text-anchor="middle" font-size="10" fill="#64748B">${esc(d.label)}</text>` : ''}</g>`; }).join('')}
  </svg><div class="tipline" data-tipline>${o.legend || 'Toca una barra para ver el monto.'}</div></div>`;
}
function lineChart(points, o = {}){
  if (points.length < 2) return empty('line-chart', 'Aún no hay suficientes datos', o.vacio || 'Se completa a medida que cierras días.');
  const W = 340, H = 140, top = 14, bot = 20, l = 4, vs = points.map(p => p.v), min = Math.min(0, ...vs), max = Math.max(...vs, 1) * 1.1;
  const x = i => l + (W - l * 2) * i / (points.length - 1), y = v => top + (H - top - bot) * (1 - (v - min) / (max - min || 1));
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.aria || 'Gráfico de línea')}">
    ${min < 0 ? `<line x1="0" x2="${W}" y1="${y(0)}" y2="${y(0)}" stroke="#DC2626" stroke-dasharray="3 3" stroke-width="1"/>` : ''}
    <path d="${d} L${x(points.length - 1)},${H - bot} L${x(0)},${H - bot} Z" fill="${o.fill || 'rgba(37,99,235,.08)'}"/>
    <path d="${d}" fill="none" stroke="${o.color || '#2563EB'}" stroke-width="2.2" ${o.dash ? 'stroke-dasharray="5 4"' : ''} stroke-linejoin="round"/>
    ${points.map((p, i) => `<g data-tip="${esc(p.label + ': ' + money(p.v))}" style="cursor:pointer"><rect x="${x(i) - 8}" y="${top}" width="16" height="${H - top - bot}" fill="transparent"/>${i === points.length - 1 || p.dot ? `<circle cx="${x(i)}" cy="${y(p.v)}" r="3.5" fill="${o.color || '#2563EB'}"/>` : ''}</g>`).join('')}
    <text x="${l}" y="${H - 5}" font-size="10" fill="#64748B">${esc(points[0].label)}</text><text x="${W - l}" y="${H - 5}" text-anchor="end" font-size="10" fill="#64748B">${esc(points[points.length - 1].label)}</text>
  </svg><div class="tipline" data-tipline>${o.legend || 'Toca la línea para ver el monto.'}</div></div>`;
}

/* ================= PRESUPUESTO ================= */
function vPresupuesto(){
  const id = cicloVista(), x = contexto(id), p = x.p;
  const libre = p.grupos.libre, gastado = x.res.libre, disp = restar(libre, gastado), tick = x.rt.totalDias ? x.rt.transcurridos / x.rt.totalDias * 100 : 0;
  const nav = `<div class="datebar"><button class="iconbtn" data-act="ciclo" data-k="-1" aria-label="Mes anterior">${ic('chevron-left')}</button>
    <div class="datepick" style="flex-direction:column;gap:0;height:auto;padding:4px"><span>${nombreCiclo(id)}</span><span class="sub" style="font-size:11.5px;font-weight:500">${short(x.r.start)} – ${short(x.r.end)}${p.nota ? ' · ' + esc(p.nota) : ''}</span></div>
    <button class="iconbtn" data-act="ciclo" data-k="1" aria-label="Mes siguiente">${ic('chevron-right')}</button></div>`;
  const total = `<section class="card"><div class="row"><span class="label">Presupuesto del día a día</span><span class="pill ${x.sem.nivel === 'verde' ? 'ok' : x.sem.nivel === 'amarillo' ? 'warn' : x.sem.nivel === 'rojo' ? 'bad' : ''}">${pct(gastado, libre)}% usado</span></div>
    <div class="grid3"><div><span class="sub">Total</span><div class="num" style="font-weight:700;font-size:18px">${money(libre)}</div></div>
      <div><span class="sub">Gastado</span><div class="num" style="font-weight:700;font-size:18px">${money(gastado)}</div></div>
      <div><span class="sub">Disponible</span><div class="num" style="font-weight:700;font-size:18px;color:${aC(disp) < 0 ? 'var(--red)' : 'var(--green)'}">${money(disp)}</div></div></div>
    ${bar(gastado, libre, x.enCiclo ? tick : null)}<span class="sub" style="font-size:12px">La rayita marca cuánto del ciclo ya pasó (${x.rt.transcurridos} de ${x.rt.totalDias} días).</span></section>`;

  const pd = x.pd;
  const diario = x.enCiclo ? `<section class="card"><div class="row"><h2>Hoy puedes gastar</h2><span class="pill ${pd.sinDinero ? 'bad' : 'blue'}">${pd.fuente === 'saldos' ? 'según tus saldos' : 'según tu plan'}</span></div>
    <div class="num" style="font-size:32px;font-weight:800;letter-spacing:-.02em;color:${pd.sinDinero ? 'var(--red)' : 'var(--ink)'}">${money(pd.puedesHoy)}</div>
    ${pd.sinDinero ? `<p class="sub" style="margin:0">No queda dinero libre para gastos variables sin tocar lo reservado. No te sugerimos gastar más hasta tu cobro.</p>` : ''}
    <details><summary>Cómo se obtuvo esta cifra</summary><div class="explain">
      <div class="row"><span>${x.pr.estricto ? 'Presupuesto esencial del ciclo' : 'Presupuesto del día a día'}</span><b class="num">${money(pd.presupuesto)}</b></div>
      <div class="row"><span>Gastado antes de hoy</span><b class="num">− ${money(restar(pd.presupuesto, pd.segunPlan))}</b></div>
      <div class="row"><span>Queda según el plan</span><b class="num">${money(pd.segunPlan)}</b></div>
      ${x.real ? `<div class="row"><span>Libre según tus saldos (cuentas − pagos y ahorro pendientes)</span><b class="num">${money(x.real.libre)}</b></div>` : '<div class="row"><span>Sin cierre reciente: se usa solo el plan</span></div>'}
      <div class="row"><span>Se toma el menor y se divide entre ${pd.diasRestantes} ${pd.diasRestantes === 1 ? 'día' : 'días'} restantes</span><b class="num">${money(pd.base)} / día</b></div>
      <div class="row"><span>Ya gastaste hoy</span><b class="num">− ${money(pd.gastadoHoy)}</b></div></div></details>
    <div class="toggle"><span><b>Modo control estricto</b><br><span class="sub">Solo cuenta alimentación, transporte y salud.</span></span><label class="switch"><input type="checkbox" id="sw-estricto" ${x.pr.estricto ? 'checked' : ''} aria-label="Modo control estricto"><span></span></label></div></section>` : '';

  const keys = LIBRES.filter(k => +p.montos[k] > 0 || x.res.porCategoria[k]).concat(['gasolina'].filter(k => +p.montos[k] > 0 || x.res.porCategoria[k]));
  const diasQ = x.enCiclo ? daysBetween(x.hoy, x.r.end) + 1 : 0;
  const cats = `<div class="sec-h"><h2>Por categoría</h2><span class="sub">${keys.length} categorías</span></div>
    <div class="grid2 grid-cats" style="grid-template-columns:1fr">${keys.map(k => { const lim = +p.montos[k] || 0, g = x.res.porCategoria[k] || 0, d = restar(lim, g), u = pct(g, lim);
      const est = !lim ? ['bad','Sin presupuesto'] : aC(g) > aC(lim) ? ['bad','Excedido'] : u >= 85 ? ['warn','Atención'] : ['ok','En control'];
      return `<section class="card tight cat"><div class="h"><span class="ico">${ic(CATS[k].icon || 'circle-dot')}</span><div style="flex:1;min-width:0"><h3>${CATS[k].n}</h3><span class="sub" style="font-size:12px">${esc(CATS[k].h || '')}</span></div><span class="pill ${est[0]}">${est[1]}</span></div>
        ${bar(g, lim)}<div class="nums num"><span>Gastado <b>${money(g)}</b></span><span>Límite <b>${money(lim)}</b></span><span>Queda <b style="color:${aC(d) < 0 ? 'var(--red)' : 'inherit'}">${money(d)}</b></span></div></section>`; }).join('') || empty('pie-chart', 'Sin categorías con presupuesto', '')}</div>`;

  const recs = [];
  for (const k of keys) { const lim = +p.montos[k] || 0, g = x.res.porCategoria[k] || 0, u = pct(g, lim);
    if (lim && aC(g) > aC(lim)) recs.push(['alta', `${CATS[k].n} superó su límite por ${money(restar(g, lim))}. Lo que gastes aquí sale de otra categoría o de tu colchón.`]);
    else if (lim && u >= 85 && diasQ >= 4) recs.push(['media', `Has utilizado el ${u}% del presupuesto de ${CATS[k].n} y todavía quedan ${diasQ} días del periodo.`]);
    else if (lim && u > 0 && u <= Math.round(x.rt.transcurridos / x.rt.totalDias * 100)) recs.push(['', `Tu gasto en ${CATS[k].n} está dentro de lo planificado (${u}%).`]); }
  const recH = recs.length ? `<section class="card"><h2>Recomendaciones</h2>${recs.slice(0, 4).map(([n, t]) => `<div class="tip ${n}"><span class="ic">${ic(n === 'alta' ? 'alert-triangle' : n === 'media' ? 'alert-circle' : 'check')}</span><div><span class="tag recomendacion">Recomendación</span><p>${esc(t)}</p></div></div>`).join('')}</section>` : '';

  const pagos = x.pagos, hechos = sumar(pagos.filter(i => i.hecho), i => i.hecho.monto), totalP = sumar(pagos);
  const pagosH = `<section class="card"><div class="row"><h2>Pagos y aportes del ciclo</h2><span class="pill ${aC(hechos) >= aC(totalP) ? 'ok' : ''} num">${money0(hechos)} de ${money0(totalP)}</span></div>
    <div>${pagos.map(i => `<div class="line"><span><b style="${i.hecho ? 'text-decoration:line-through;color:var(--muted)' : ''}">${catN(i.k)}</b><small>${i.fecha ? cap(longD(i.fecha)) : 'Fecha por confirmar'} · ${i.ahorro ? 'Transferir a BBVA' : (CATS[i.k] && CATS[i.k].h) || 'Desde Interbank'}</small></span>
      <span style="display:flex;gap:6px;align-items:center"><input id="pg-${i.k}" inputmode="decimal" value="${(+(i.hecho ? i.hecho.monto : i.monto)).toFixed(2)}" ${i.hecho ? 'disabled' : ''} aria-label="Monto ${catN(i.k)}" style="width:92px">
      <button class="iconbtn" data-act="pago" data-k="${i.k}" aria-label="${i.hecho ? 'Desmarcar' : 'Marcar como hecho'}" style="${i.hecho ? 'background:var(--green);border-color:var(--green);color:#fff' : ''}">${ic('check')}</button></span></div>`).join('') || empty('calendar-check', 'Sin pagos este ciclo', '')}</div>
    <details><summary>Rutina del día de cobro</summary><div class="explain">
      <span>1. Pasa ${money(p.montos.mama || 0)} a tu mamá.</span><span>2. Pasa ${money(mas(p.grupos.ahorro, p.montos.moto_fondo || 0))} a BBVA ahorro.</span>
      <span>3. Pasa la primera semanal (${money0(aS(Math.round(aC(p.grupos.libre) * 7 / x.rt.totalDias)))}) a BCP.</span><span>4. Lo demás se queda en Interbank para los pagos.</span>
      <span>Registra estas transferencias con + → Transferencia; no cuentan como gasto.</span></div></details></section>`;

  return nav + total + diario + recH + cats + pagosH;
}

/* ================= OBJETIVOS ================= */
function deudas(){
  const M = (S.cfg && S.cfg.metas) || {}, out = [], id = cicloHoy(), pl = Calc.plan(S.cfg, S.movs, id);
  const pagado = (k, desde) => sumar(S.movs.filter(m => clase(m) === 'pago' && m.cat === k && (!desde || m.fecha >= desde)));
  for (const [k, quien] of [['mama', 'Tu mamá'], ['caja', 'Caja Arequipa']]) {
    if (!M[k] || !M[k].deuda) continue;
    const total = +M[k].deuda, pag = pagado(k, M[k].desde), falta = restar(total, pag);
    let cuota = +pl.montos[k] || +Calc.plan(S.cfg, S.movs, moverCiclo(id, 1)).montos[k] || 0;
    const prox = Calc.pagos(S.cfg, S.movs, id).find(i => i.k === k && !i.hecho);
    const meses = cuota > 0 ? Math.ceil(aC(falta) / aC(cuota)) : null;
    out.push({k, quien, total, pagado: pag, falta, cuota, prox: prox ? prox.fecha : rangoCiclo(moverCiclo(id, 1), dia()).start, meses,
      fin: meses != null ? rangoCiclo(moverCiclo(id, Math.max(0, meses - (prox ? 1 : 0))), dia()).start : null, nota: M[k].nota});
  }
  // Deudas de un solo pago programadas en algún ciclo (por ejemplo el adelanto de sueldo)
  for (const [cid, c] of Object.entries(S.cfg.ciclos || {})) {
    const monto = c.montos && +c.montos.adelanto; if (!monto) continue;
    const pag = sumar(S.movs.filter(m => clase(m) === 'pago' && m.cat === 'adelanto'));
    const item = Calc.pagos(S.cfg, S.movs, cid).find(i => i.k === 'adelanto');
    out.push({k: 'adelanto', quien: 'BCP (adelanto de sueldo)', total: monto, pagado: pag, falta: aS(Math.max(0, aC(monto) - aC(pag))), cuota: monto, prox: item && item.fecha, meses: aC(pag) >= aC(monto) ? 0 : 1, fin: item && item.fecha});
  }
  return out;
}
function vObjetivos(){
  const obj = objetivos(), id = cicloHoy(), ms = Calc.movsCiclo(S.cfg, S.movs, id);
  const ahorroMes = sumar(ms.filter(m => clase(m) === 'ahorro')), totalAhorro = sumar(obj, o => o.saldo);
  const resumenH = `<section class="card"><div class="grid2">
    <div class="kpi" style="border:none;padding:0"><span class="k">Ahorrado este ciclo</span><span class="v num">${money(ahorroMes)}</span></div>
    <div class="kpi" style="border:none;padding:0"><span class="k">Total en tus metas</span><span class="v num">${money(totalAhorro)}</span></div></div></section>`;
  const card = o => {
    const est = o.estado === 'completado' || (o.meta && aC(o.saldo) >= aC(o.meta)) ? ['ok', 'Completado'] : o.estado === 'pausado' ? ['', 'Pausado'] : ['blue', o.pct + '%'];
    return `<section class="card tight" style="${o.estado === 'pausado' ? 'opacity:.7' : ''}">
      <div class="row"><span style="display:flex;gap:10px;align-items:center;min-width:0"><span class="ico" style="width:36px;height:36px;border-radius:10px;background:var(--blue-soft);color:var(--blue);display:flex;align-items:center;justify-content:center;flex:none">${ic(o.tipo === 'viaje' ? 'plane' : o.tipo === 'emergencia' ? 'shield' : o.tipo === 'inversion' ? 'trending-up' : o.tipo === 'deuda' ? 'receipt' : 'target')}</span>
        <span style="min-width:0"><h3>${esc(o.nombre)}</h3><span class="sub" style="font-size:12px">${money(o.saldo)} de ${money(o.meta)}</span></span></span><span class="pill ${est[0]}">${est[1]}</span></div>
      ${bar(o.saldo, o.meta).replace('<i class="', '<i class="ok ')}
      <div class="nums sub num" style="display:flex;justify-content:space-between;font-size:12px"><span>Falta <b style="color:var(--ink)">${money(o.falta)}</b></span>
        <span>${o.falta > 0 ? (o.mensual > 0 ? `Aporte ${o.fuenteMensual === 'historial' ? 'promedio' : 'recomendado'} <b style="color:var(--ink)">${money(o.mensual)}</b>/mes` : 'Sin aporte mensual') : '¡Lograda!'}</span></div>
      ${o.fechaEst && o.falta > 0 ? `<span class="sub" style="font-size:12px"><span class="tag estimacion">Estimación</span> La completas hacia ${MESES[o.fechaEst.getMonth()]} de ${o.fechaEst.getFullYear()}${o.fechaMeta ? ' (meta: ' + short(parseD(o.fechaMeta)) + ')' : ''}.</span>` : ''}
      <div class="row" style="gap:6px;flex-wrap:wrap;justify-content:flex-start">
        <button class="btn sm" data-act="aportar" data-id="${esc(o.id)}">${ic('plus')} Aportar</button>
        <button class="btn sm ghost" data-act="editobj" data-id="${esc(o.id)}">${ic('pencil')} Editar</button>
        <button class="btn sm ghost" data-act="estadoobj" data-id="${esc(o.id)}" data-e="${o.estado === 'pausado' ? 'activo' : 'pausado'}">${ic(o.estado === 'pausado' ? 'play' : 'pause')} ${o.estado === 'pausado' ? 'Reanudar' : 'Pausar'}</button>
        ${o.estado !== 'completado' ? `<button class="btn sm ghost" data-act="estadoobj" data-id="${esc(o.id)}" data-e="completado">${ic('check-circle-2')} Completar</button>` : ''}
        ${!o.builtin ? `<button class="btn sm ghost" data-act="delobj" data-id="${esc(o.id)}" aria-label="Eliminar">${ic('trash-2')}</button>` : ''}</div>
      ${o.aportes.length ? `<details><summary>Historial de aportes (${o.aportes.length})</summary><div style="margin-top:6px">${o.aportes.slice(0, 12).map(movRow).join('')}</div></details>` : ''}
    </section>`;
  };
  const ds = deudas(), cierre = lastCierre(), L = lineas();
  const tarjetas = cierre ? CUENTAS.filter(c => c.tipo === 'tc' && cierre.saldos && cierre.saldos[c.k] !== undefined && cierre.saldos[c.k] !== '').map(c => ({n: c.n, usado: aS(Math.max(0, aC(L[c.k]) - aC(cierre.saldos[c.k]))), linea: L[c.k]})) : [];
  const prest = S.movs.filter(m => clase(m) === 'prestamo'), devs = S.movs.filter(m => clase(m) === 'devolucion');
  const porPersona = {};
  for (const m of prest) { const k = m.persona || (m.nota || 'Sin nombre'); porPersona[k] = mas(porPersona[k] || 0, m.monto); }
  for (const m of devs) { const k = m.persona || 'Sin nombre'; porPersona[k] = restar(porPersona[k] || 0, m.monto); }
  const teDeben = restar(sumar(prest), sumar(devs));
  const deudasH = `<div class="sec-h"><h2>Deudas</h2><span class="sub">${money(sumar(ds, d => d.falta))} pendientes</span></div>
    ${ds.map(d => `<section class="card tight"><div class="row"><span><h3>${esc(d.quien)}</h3><span class="sub" style="font-size:12px">Pagado ${money(d.pagado)} de ${money(d.total)}</span></span><span class="pill ${aC(d.falta) <= 0 ? 'ok' : ''}">${aC(d.falta) <= 0 ? 'Pagada' : 'Falta ' + money(d.falta)}</span></div>
      ${bar(d.pagado, d.total).replace('<i class="', '<i class="ok ')}
      <span class="sub" style="font-size:12.5px">${aC(d.falta) > 0 ? `Próxima cuota: <b style="color:var(--ink)">${money(Math.min(d.cuota || d.falta, d.falta))}</b>${d.prox ? ' el ' + longD(d.prox) : ''}${d.meses > 1 && d.fin ? ` · <span class="tag proyeccion">Proyección</span> terminas hacia ${MESES[d.fin.getMonth()]} ${d.fin.getFullYear()} (${d.meses} cuotas)` : ''}` : 'Sin saldo pendiente.'}</span>
      ${d.nota ? `<span class="sub" style="font-size:12px">${esc(d.nota)}</span>` : ''}</section>`).join('')}
    ${tarjetas.length ? `<section class="card tight"><h3>Tarjetas de crédito <span class="sub" style="font-weight:500">· cierre del ${short(parseD(cierre.fecha))}</span></h3>${tarjetas.map(t => `<div class="cat"><div class="nums num"><span><b>${t.n}</b></span><span>Usado <b>${money(t.usado)}</b> de ${money0(t.linea)}</span></div>${bar(t.usado, t.linea)}</div>`).join('')}</section>` : ''}
    ${aC(teDeben) > 0 || prest.length ? `<section class="card tight"><div class="row"><h3>Te deben</h3><span class="pill ${aC(teDeben) > 0 ? 'warn' : 'ok'}">${money(teDeben)}</span></div>
      ${Object.entries(porPersona).filter(([, v]) => aC(v) > 0).map(([k, v]) => `<div class="row sub"><span>${esc(k)}</span><b class="num" style="color:var(--ink)">${money(v)}</b></div>`).join('') || '<span class="sub">Todo devuelto.</span>'}
      <span class="sub" style="font-size:12px">Cuando te paguen, regístralo con + → Devolución. No cuenta como ingreso.</span></section>` : ''}`;
  return resumenH + `<div class="sec-h"><h2>Metas de ahorro</h2><button class="btn sm" data-act="nuevoobj">${ic('plus')} Nueva meta</button></div>` + obj.map(card).join('') + deudasH;
}

/* ================= FINANZAS ================= */
function ciclosHasta(id, n){ const out = []; let c = id; for (let i = 0; i < n; i++) { if (S.cfg.inicio && c < S.cfg.inicio) break; out.unshift(c); c = moverCiclo(c, -1); } return out; }
function vFinanzas(){
  const seg = `<div class="seg">${[['resumen','Resumen'],['inversiones','Inversiones'],['ajustes','Ajustes']].map(([k,n]) => `<button class="${S.finTab === k ? 'on' : ''}" data-act="fintab" data-k="${k}">${n}</button>`).join('')}</div>`;
  if (S.finTab === 'inversiones') return seg + vInversiones();
  if (S.finTab === 'ajustes') return seg + vAjustes();
  const id = cicloVista(), x = contexto(id), res = x.res, hoy = today();
  const ds = deudas(), deudaPend = mas(sumar(ds, d => d.falta), x.real ? x.real.deudaTC : 0);
  const inv = Calc.inversiones(S.movs, LS.get('soles.precios', {})), invCosto = sumar(inv, a => a.costo);
  const salidas = mas(res.consumo, res.pagoDeuda, res.pagoFijo);
  const patrimonio = x.real ? restar(mas(x.real.total, invCosto), deudaPend) : null;
  const nav = `<div class="datebar"><button class="iconbtn" data-act="ciclo" data-k="-1" aria-label="Mes anterior">${ic('chevron-left')}</button>
    <div class="datepick" style="flex-direction:column;gap:0;height:auto;padding:4px"><span>${nombreCiclo(id)}</span><span class="sub" style="font-size:11.5px;font-weight:500">${short(x.r.start)} – ${short(x.r.end)}</span></div>
    <button class="iconbtn" data-act="ciclo" data-k="1" aria-label="Mes siguiente">${ic('chevron-right')}</button></div>`;
  const kpis = `<div class="grid2">
    <div class="kpi"><span class="k">Ingresos del ciclo</span><span class="v num">${money(res.ingresos)}</span></div>
    <div class="kpi"><span class="k">Salidas (consumo + pagos)</span><span class="v num">${money(salidas)}</span></div>
    <div class="kpi"><span class="k">Balance neto</span><span class="v num ${aC(res.balance) >= 0 ? 'pos' : 'neg'}">${money(res.balance)}</span></div>
    <div class="kpi"><span class="k">Ahorro neto</span><span class="v num">${money(res.ahorro)}</span></div>
    <div class="kpi"><span class="k">Deudas pendientes</span><span class="v num ${aC(deudaPend) > 0 ? 'neg' : ''}">${money(deudaPend)}</span></div>
    <div class="kpi"><span class="k">Patrimonio estimado</span><span class="v num">${patrimonio == null ? '—' : money(patrimonio)}</span>${patrimonio == null ? '<span class="sub" style="font-size:11px">Cierra un día para calcularlo</span>' : ''}</div></div>
    <section class="card tight"><div class="row sub" style="font-size:12.5px"><span>Consumo</span><b class="num" style="color:var(--ink)">${money(res.consumo)}</b></div>
      <div class="row sub" style="font-size:12.5px"><span>Pagos de deudas</span><b class="num" style="color:var(--ink)">${money(res.pagoDeuda)}</b></div>
      <div class="row sub" style="font-size:12.5px"><span>Pagos fijos (servicios, casa)</span><b class="num" style="color:var(--ink)">${money(res.pagoFijo)}</b></div>
      <div class="row sub" style="font-size:12.5px"><span>No cuentan: transferencias ${money(res.transferido)}, préstamos ${money(res.prestado)}, devoluciones ${money(res.devuelto)}</span></div></section>`;

  const cics = ciclosHasta(id, 6);
  const ivg = barsChart(cics.map(c => { const r = Calc.resumen(S.cfg, S.movs, c, hoy); return {label: nombreCiclo(c).slice(0, 3), full: nombreCiclo(c), v: r.ingresos, v2: mas(r.consumo, r.pagoDeuda, r.pagoFijo)}; }),
    {n1: 'Ingresos', n2: 'Salidas', color: () => '#16A34A', legend: '<span style="color:#16A34A">■</span> Ingresos · <span style="color:#94A3B8">■</span> Salidas', aria: 'Ingresos frente a salidas por mes'});
  const cs = [...S.cierres].sort((a, b) => a.fecha < b.fecha ? -1 : 1).slice(-30);
  const saldoLine = lineChart(cs.map(c => ({label: short(parseD(c.fecha)), v: aS(LIQUIDAS.reduce((t, k) => t + aC((c.saldos || {})[k]), 0))})), {aria: 'Evolución del saldo disponible'});
  const patLine = lineChart(cs.map(c => { const s = c.saldos || {}, L = lineas(); const tc = CUENTAS.filter(k => k.tipo === 'tc' && s[k.k] !== undefined && s[k.k] !== '').reduce((t, k) => t + Math.max(0, aC(L[k.k]) - aC(s[k.k])), 0);
    return {label: short(parseD(c.fecha)), v: aS(LIQUIDAS.concat('bbva').reduce((t, k) => t + aC(s[k]), 0) - tc)}; }), {aria: 'Evolución del patrimonio', color: '#16A34A', fill: 'rgba(22,163,74,.08)', vacio: 'Se arma con tus cierres del día: cuentas más ahorro menos tarjetas.'});
  const porCat = Object.entries(res.porCategoria).sort((a, b) => b[1] - a[1]);
  const totCat = sumar(porCat, e => e[1]);
  const distrib = porCat.length ? porCat.map(([k, v]) => `<div class="cat"><div class="nums num"><span><b>${esc(catN(k))}</b></span><span><b>${money(v)}</b> · ${pct(v, totCat)}%</span></div>${bar(v, totCat).replace('class=""', 'class="ok"')}</div>`).join('') : empty('pie-chart', 'Sin gastos en este ciclo', '');
  let acum = 0;
  const ahorroBars = barsChart(cics.map(c => { acum = mas(acum, Calc.resumen(S.cfg, S.movs, c, hoy).ahorro); return {label: nombreCiclo(c).slice(0, 3), full: nombreCiclo(c) + ' (acumulado)', v: acum}; }), {color: () => '#16A34A', aria: 'Evolución del ahorro', legend: 'Ahorro acumulado por mes. Toca una barra.'});
  // Proyección hasta el próximo sueldo: parte de lo libre y resta el presupuesto diario
  let proy = '';
  if (x.enCiclo) {
    const inicio = x.real ? x.real.libre : x.pd.restanteCiclo, dRest = x.pd.diasRestantes, pts = [];
    for (let i = 0; i <= dRest; i++) pts.push({label: i === 0 ? 'Hoy' : short(addDays(hoy, i)), v: aS(aC(inicio) - aC(x.pd.base) * i)});
    proy = `<section class="card"><div class="row"><h2>Proyección hasta tu cobro</h2><span class="tag proyeccion">Proyección</span></div>
      <span class="sub" style="font-size:12.5px">Si gastas ${money(x.pd.base)} al día, llegarías al ${short(x.r.siguiente)} con unos ${money(pts[pts.length - 1].v)} libres.</span>${lineChart(pts, {dash: true, aria: 'Proyección del dinero libre hasta el cobro'})}</section>`;
  }
  const prevId = moverCiclo(id, -1), prev = S.cfg.inicio && prevId >= S.cfg.inicio ? Calc.resumen(S.cfg, S.movs, prevId, hoy) : null;
  const comp = prev ? `<section class="card"><h2>Comparación con ${nombreCiclo(prevId).split(' ')[0]}</h2>
    ${[['Gastos del día a día', res.libre, prev.libre, true], ['Ahorro', res.ahorro, prev.ahorro, false], ['Ingresos', res.ingresos, prev.ingresos, false]].map(([n, a, b, menosMejor]) => { const d = restar(a, b), mejor = menosMejor ? aC(d) <= 0 : aC(d) >= 0;
      return `<div class="row"><span>${n}</span><span class="num"><b>${money(a)}</b> <span class="pill ${aC(d) === 0 ? '' : mejor ? 'ok' : 'bad'}">${aC(d) >= 0 ? '+' : ''}${money(d)}</span></span></div>`; }).join('')}</section>` : '';
  const flujo = x.pagos.filter(i => !i.hecho).slice(0, 6);
  const flujoH = `<section class="card"><h2>Flujo de caja previsto</h2>${flujo.length ? flujo.map(i => `<div class="row"><span>${i.fecha ? short(i.fecha) : '—'} · ${catN(i.k)}</span><b class="num">− ${money(i.monto)}</b></div>`).join('') : '<span class="sub">No quedan pagos en este ciclo.</span>'}
    <div class="row" style="border-top:1px solid var(--line);padding-top:8px"><span>${short(x.r.siguiente)} · Próximo sueldo <span class="tag estimacion">Estimación</span></span><b class="num" style="color:var(--green)">+ ${money(Calc.plan(S.cfg, S.movs, moverCiclo(id, 1)).ingreso)}</b></div></section>`;
  const tips = analisis(x);
  const analisisH = `<section class="card"><h2>Tu análisis financiero</h2><span class="sub" style="font-size:12px">Basado en tus registros y tu plan. Cada mensaje dice si es un dato, una estimación, una proyección o una recomendación.</span>
    ${tips.length ? tips.slice(0, 5).map(tipHTML).join('') : '<span class="sub">No hay información suficiente todavía.</span>'}
    ${tips.length > 5 ? `<details><summary>Ver ${tips.length - 5} más</summary><div style="margin-top:8px">${tips.slice(5).map(tipHTML).join('')}</div></details>` : ''}</section>`;
  return seg + nav + kpis + analisisH +
    `<section class="card"><h2>Ingresos frente a salidas</h2>${ivg}</section>` + proy +
    `<section class="card"><h2>Distribución de gastos</h2>${distrib}</section>` + comp + flujoH +
    `<section class="card"><h2>Saldo disponible en cuentas</h2>${saldoLine}</section>` +
    `<section class="card"><h2>Evolución del patrimonio</h2>${patLine}</section>` +
    `<section class="card"><h2>Evolución del ahorro</h2>${ahorroBars}</section>`;
}

function vInversiones(){
  const precios = LS.get('soles.precios', {}), inv = Calc.inversiones(S.movs, precios);
  const costo = sumar(inv, a => a.costo), valor = inv.every(a => a.valor != null || a.cantidad === 0) ? sumar(inv, a => a.valor || 0) : null, realizado = sumar(inv, a => a.realizado);
  const noReal = valor == null ? null : restar(valor, costo);
  return `<section class="card"><div class="row"><h2>Tu cartera</h2><button class="btn sm" data-act="nuevo" data-t="inversion">${ic('plus')} Operación</button></div>
    <div class="grid2"><div class="kpi"><span class="k">Capital invertido (costo)</span><span class="v num">${money(costo)}</span></div>
      <div class="kpi"><span class="k">Valor actual</span><span class="v num">${valor == null ? '—' : money(valor)}</span>${valor == null && inv.length ? '<span class="sub" style="font-size:11px">Falta registrar el precio</span>' : ''}</div>
      <div class="kpi"><span class="k">Ganancia no realizada</span><span class="v num ${noReal == null ? '' : aC(noReal) >= 0 ? 'pos' : 'neg'}">${noReal == null ? '—' : money(noReal)}</span></div>
      <div class="kpi"><span class="k">Ganancia realizada</span><span class="v num ${aC(realizado) >= 0 ? 'pos' : 'neg'}">${money(realizado)}</span></div></div>
    <span class="sub" style="font-size:12px">${ic('info')} Lo invertido no cuenta como dinero disponible para gastar, y las ganancias no realizadas tampoco. No hay cotizaciones automáticas: el valor usa el precio que tú registras y muestra su fecha. La app no da recomendaciones de compra o venta.</span></section>
    ${inv.length ? inv.map(a => `<section class="card tight"><div class="row"><h3>${esc(a.activo)}</h3><span class="sub num">${a.cantidad} unidades</span></div>
      <div class="row sub" style="font-size:12.5px"><span>Costo (con comisiones)</span><b class="num" style="color:var(--ink)">${money(a.costo)}</b></div>
      <div class="row sub" style="font-size:12.5px"><span>Costo promedio por unidad</span><b class="num" style="color:var(--ink)">${money(a.costoPromedio)}</b></div>
      <div class="row sub" style="font-size:12.5px"><span>Comisiones pagadas</span><b class="num" style="color:var(--ink)">${money(a.comisiones)}</b></div>
      <div class="row sub" style="font-size:12.5px"><span>Valor actual ${a.precioFecha ? '(precio del ' + short(parseD(a.precioFecha)) + ')' : ''}</span><b class="num" style="color:var(--ink)">${a.valor == null ? 'Sin precio' : money(a.valor)}</b></div>
      ${a.noRealizado != null ? `<div class="row sub" style="font-size:12.5px"><span>No realizado</span><b class="num" style="color:${aC(a.noRealizado) >= 0 ? 'var(--green)' : 'var(--red)'}">${money(a.noRealizado)}</b></div>` : ''}
      ${costo > 0 && a.costo > 0 ? `<div class="cat"><div class="nums"><span>Peso en la cartera</span><b>${pct(a.costo, costo)}%</b></div>${bar(a.costo, costo).replace('class=""', 'class="ok"')}</div>` : ''}
      <div class="two"><input class="input" id="pr-${esc(a.activo)}" inputmode="decimal" placeholder="Precio por unidad (S/)" value="${precios[a.activo] ? precios[a.activo].precio : ''}"><button class="btn sm ghost" data-act="precio" data-a="${esc(a.activo)}">Guardar precio</button></div></section>`).join('')
      : `<section class="card">${empty('trending-up', 'Aún no registras inversiones', 'Registra aportes, compras o ventas (por ejemplo de criptomonedas) con el botón Operación.')}</section>`}`;
}

function vAjustes(){
  const id = cicloVista(), base = S.scope === 'base', p = Calc.plan(S.cfg, S.movs, id, base), c = S.cfg, pr = prefs(), u = Object.assign({}, Calc.UMBRALES, pr.umbrales);
  const GR = [['fijo','Pagos fijos'], ['moto','Moto'], ['ahorro','Ahorro'], ['libre','Gastos del día a día']];
  const lines = GR.map(([g, n]) => { const ks = Object.keys(CATS).filter(k => CATS[k].g === g);
    return `<div class="stack" style="gap:0"><div class="row" style="padding-top:8px"><span class="label">${n}</span><span class="sub num">${money(p.grupos[g])}</span></div>
      ${ks.map(k => `<label class="line"><span>${CATS[k].n}${!base && k in p.propios ? '<small>Monto propio de este mes</small>' : ''}</span><input id="pl-${k}" data-plan="${k}" inputmode="decimal" value="${(+p.montos[k] || 0).toFixed(2)}"></label>`).join('')}</div>`; }).join('');
  const extras = base ? '' : p.extras.map((e, i) => `<label class="line"><span>${esc(e.n)}${e.pendiente && !+e.monto ? '<small>Escribe el monto cuando llegue</small>' : ''}</span><input id="ex-${i}" data-extra="${i}" inputmode="decimal" value="${(+e.monto || 0).toFixed(2)}"></label>`).join('');
  const pend = c.pendientes || [];
  return `<section class="card"><h2>Ciclo financiero</h2>
      <label class="line"><span>Día de cobro<small>El ciclo va de este día al día anterior del mes siguiente</small></span><input id="aj-dia" type="number" min="1" max="31" inputmode="numeric" value="${dia()}"></label>
      <div class="line"><span>Ciclo actual<small>${short(rangoCiclo(cicloHoy(), dia()).start)} – ${short(rangoCiclo(cicloHoy(), dia()).end)}</small></span><b>${nombreCiclo(cicloHoy())}</b></div></section>
    <section class="card"><h2>Semáforo</h2><span class="sub" style="font-size:12.5px">Compara lo gastado con lo que deberías llevar gastado a hoy. 100% = justo en el ritmo.</span>
      <label class="line"><span>Amarillo desde<small>% del ritmo esperado</small></span><input id="aj-am" type="number" inputmode="numeric" value="${Math.round(u.amarillo * 100)}"></label>
      <label class="line"><span>Rojo desde<small>% del ritmo esperado</small></span><input id="aj-ro" type="number" inputmode="numeric" value="${Math.round(u.rojo * 100)}"></label>
      <div class="toggle"><span><b>Modo control estricto</b><br><span class="sub">Solo presupuesto esencial: alimentación, transporte y salud.</span></span><label class="switch"><input type="checkbox" id="sw-estricto" ${pr.estricto ? 'checked' : ''} aria-label="Modo control estricto"><span></span></label></div></section>
    <section class="card"><h2>Reparto del sueldo</h2>
      <div class="seg"><button class="${base ? '' : 'on'}" data-act="scope" data-k="ciclo">Solo ${nombreCiclo(id).split(' ')[0].toLowerCase()}</button><button class="${base ? 'on' : ''}" data-act="scope" data-k="base">Todos los meses</button></div>
      ${!base ? `<div class="datebar"><button class="iconbtn" data-act="ciclo" data-k="-1" aria-label="Mes anterior">${ic('chevron-left')}</button><div class="datepick">${nombreCiclo(id)}</div><button class="iconbtn" data-act="ciclo" data-k="1" aria-label="Mes siguiente">${ic('chevron-right')}</button></div>` : ''}
      <div class="stack" style="gap:0"><span class="label">Ingresos</span>
        <label class="line"><span>Sueldo neto<small>${base ? 'Base para todos los meses' : 'Recibido en Interbank'}</small></span><input id="pl-ingreso" data-ingreso="1" inputmode="decimal" value="${(+(base ? c.base.ingreso : p.ingreso) || 0).toFixed(2)}"></label>
        ${extras}${!base && p.ingMovs ? `<div class="line"><span>Ingresos extra registrados</span><b class="num">${money(p.ingMovs)}</b></div>` : ''}
        <div class="tot num"><span>Entra</span><span>${money(base ? c.base.ingreso : p.totalIngreso)}</span></div></div>
      ${lines}
      <div class="tot num"><span>${aC(p.colchon) >= 0 ? 'Colchón sin asignar' : 'Falta cubrir'}</span><span style="color:${aC(p.colchon) >= 0 ? 'var(--green)' : 'var(--red)'}">${money(p.colchon)}</span></div>
      ${!base && p.repartir && aC(p.colchon) > 100 ? (() => { const br = Math.min(300, Math.round(p.colchon / 2)), em = restar(p.colchon, br); return `<div class="tip"><span class="ic">${ic('lightbulb')}</span><div><span class="tag recomendacion">Recomendación</span><p>Te sobran ${money(p.colchon)}. Puedes enviar ${money(br)} a Brasil y ${money(em)} a Emergencia.</p><button class="btn sm" data-act="repartir" data-b="${br}" data-e="${em}">Aplicar reparto</button></div></div>`; })() : ''}</section>
    <section class="card"><h2>Tarjetas de crédito</h2>${CUENTAS.filter(x => x.tipo === 'tc').map(x => `<label class="line"><span>Línea ${x.n}</span><input id="ln-${x.k}" data-linea="${x.k}" inputmode="decimal" value="${(+lineas()[x.k]).toFixed(2)}"></label>`).join('')}</section>
    <section class="card"><h2>Tus cuentas</h2>${CUENTAS.filter(x => x.tipo !== 'tc').map(x => `<div class="row"><span style="display:flex;gap:10px;align-items:center">${ic(x.icon)} <span><b>${x.n}</b><br><span class="sub" style="font-size:12px">${x.h}</span></span></span></div>`).join('')}
      <span class="sub" style="font-size:12.5px">Mover plata entre estas cuentas es una transferencia: no cuenta como gasto ni ingreso.</span></section>
    ${pend.length ? `<section class="card"><h2>Datos por confirmar</h2>${pend.map((x, i) => `<label class="toggle" style="justify-content:flex-start;gap:10px;padding:4px 0"><input type="checkbox" data-pend="${i}" ${x.ok ? 'checked' : ''} style="width:20px;height:20px;accent-color:var(--blue)"><span style="${x.ok ? 'text-decoration:line-through;color:var(--muted)' : ''}">${esc(x.t)}</span></label>`).join('')}</section>` : ''}
    <section class="card"><h2>Respaldo y conexión</h2><span class="sub" style="font-size:12.5px">Tus datos se guardan solo en este celular. Descarga un respaldo cada fin de mes.</span>
      <div class="two"><button class="btn ghost" data-act="backup">${ic('download')} Respaldo</button><label class="btn ghost">${ic('upload')} Restaurar<input type="file" data-act="restore" accept="application/json,.json" hidden></label></div>
      <button class="btn ghost" data-act="copyjson">${ic('copy')} Copiar datos para Claude</button>
      <details><summary>Conectar o cambiar de llave</summary><div class="stack" style="margin-top:8px"><textarea id="cfg1" rows="3" class="input" placeholder="https://sguzmanfigueroa.github.io/soles-de-sebas/#k=…"></textarea><button class="btn" data-act="loadcfg">Conectar</button></div></details></section>`;
}

/* ================= HOJAS ================= */
let lockY = 0;
function lockScroll(on){
  const b = document.body, abierta = ['sheet','cierre','dlg'].some(id => !$('#' + id).hidden);
  if (on && !b.classList.contains('locked')) { lockY = window.scrollY; b.style.top = -lockY + 'px'; b.classList.add('locked'); }
  else if (!on && !abierta && b.classList.contains('locked')) { b.classList.remove('locked'); b.style.top = ''; window.scrollTo(0, lockY); }
}
function showSheet(id){ const bg = $('#' + id), sh = bg.querySelector('.sheet'); bg.hidden = false; sh.style.transform = ''; sh.scrollTop = 0; lockScroll(true); iconos(); }
function hideSheet(id){ $('#' + id).hidden = true; lockScroll(false); }
for (const id of ['sheet', 'cierre', 'dlg']) {
  const bg = $('#' + id), sh = bg.querySelector('.sheet'); let y0 = null, dy = 0;
  sh.addEventListener('touchstart', e => { y0 = sh.scrollTop <= 0 ? e.touches[0].clientY : null; dy = 0; sh.style.transition = 'none'; }, {passive: true});
  sh.addEventListener('touchmove', e => { if (y0 === null) return; dy = e.touches[0].clientY - y0; if (dy > 0) { sh.style.transform = `translateY(${dy}px)`; if (e.cancelable) e.preventDefault(); } else { sh.style.transform = ''; y0 = null; } }, {passive: false});
  sh.addEventListener('touchend', () => { sh.style.transition = ''; if (y0 !== null && dy > 90) hideSheet(id); else sh.style.transform = ''; y0 = null; dy = 0; });
  bg.addEventListener('touchmove', e => { if (e.target === bg && e.cancelable) e.preventDefault(); }, {passive: false});
  bg.addEventListener('click', e => { if (e.target === bg) hideSheet(id); });
}
// Confirmación dentro de la página (los navegadores de app no siempre muestran confirm())
function confirmar(texto, ok = 'Eliminar'){
  return new Promise(res => {
    $('#dlg-body').innerHTML = `<h2>${esc(texto)}</h2><span class="sub">Esta acción no se puede deshacer.</span><div class="two"><button type="button" class="btn ghost" data-r="0">Cancelar</button><button type="button" class="btn danger" data-r="1">${esc(ok)}</button></div>`;
    showSheet('dlg');
    $('#dlg-body').onclick = e => { const b = e.target.closest('[data-r]'); if (!b) return; hideSheet('dlg'); res(b.dataset.r === '1'); };
  });
}

/* ---------- registro rápido ---------- */
const CHIP_CATS = ['comida','transporte','novia','salidas','entretenimiento','salud','ropa','personal','regalos','gasolina','varios'];
function abrirRegistro(tipo, mov){
  S.edit = mov ? mov.id : null;
  const cl = mov ? clase(mov) : null;
  S.f = mov ? {tipo: cl === 'gasto' ? 'gasto' : cl === 'ingreso' ? 'ingreso' : cl === 'devolucion' ? 'devolucion' : cl === 'prestamo' ? 'prestamo' : cl === 'transferencia' ? 'transferencia' : cl === 'ahorro' ? 'ahorro' : cl === 'inversion' ? 'inversion' : cl,
      monto: Math.abs(mov.monto), cat: mov.cat, medio: mov.medio, fecha: mov.fecha, nota: mov.nota || '', desde: mov.desde, hacia: mov.hacia, persona: mov.persona || (cl === 'prestamo' ? mov.nota : '') || '',
      cuenta: mov.cuenta || 'bcp', signo: aC(mov.monto) < 0 ? -1 : 1, op: mov.op || 'compra', activo: mov.activo || '', cantidad: mov.cantidad || '', comision: mov.comision || ''}
    : {tipo: tipo || 'gasto', monto: '', cat: S.sel.cat || 'comida', medio: S.sel.medio || 'yape', fecha: S.dia && S.dia <= ymd(today()) ? S.dia : ymd(today()), nota: '', desde: 'interbank', hacia: 'bcp', persona: '', cuenta: 'bcp', signo: 1, op: 'compra', activo: '', cantidad: '', comision: ''};
  if (S.f.tipo === 'ahorro' && !S.f.cat) S.f.cat = 'emergencia';
  dibujarRegistro(); showSheet('sheet'); setTimeout(() => { const i = $('#f-monto'); if (i && !mov) i.focus(); }, 80);
}
function leerRegistro(){
  const g = id => { const el = $('#' + id); return el ? el.value : undefined; };
  for (const [k, id] of [['monto','f-monto'],['fecha','f-fecha'],['nota','f-nota'],['persona','f-persona'],['activo','f-activo'],['cantidad','f-cantidad'],['comision','f-comision'],['precioU','f-precio']]) { const v = g(id); if (v !== undefined) S.f[k] = v; }
}
function dibujarRegistro(){
  const f = S.f, t = f.tipo, cuentas = CUENTAS.filter(c => c.tipo !== 'tc');
  const chips = (arr, key, sel, cls) => `<div class="chips wrap">${arr.map(([k, n, icon]) => `<button type="button" data-f="${key}" data-v="${esc(k)}" class="${sel === k ? 'on' : ''} ${cls ? cls(k) : ''}">${icon ? ic(icon) : ''}${esc(n)}</button>`).join('')}</div>`;
  const medios = chips(MEDIOS_NUEVOS.filter(m => t === 'gasto' || t === 'prestamo' || !(isCred(m[0]) || m[0] === 'adelanto')).map(m => [m[0], m[1]]), 'medio', f.medio, k => isCred(k) ? 'danger' : '');
  const cuentasCh = key => chips(cuentas.map(c => [c.k, c.n]), key, f[key]);
  const objs = objetivos().filter(o => o.estado !== 'completado');
  let cuerpo = '';
  if (t === 'gasto') cuerpo = `<div class="field"><span class="label">Categoría</span>${chips(CHIP_CATS.map(k => [k, CATS[k].n, CATS[k].icon]), 'cat', f.cat)}</div>
    <div class="field"><span class="label">¿Con qué pagaste?</span>${medios}</div>
    ${isCred(f.medio) ? `<div class="tip alta"><span class="ic">${ic('credit-card')}</span><p class="sub">Tu regla es no usar tarjeta de crédito para el día a día. Si la usaste, regístralo igual para que no se escape.</p></div>` : ''}`;
  else if (t === 'ingreso') cuerpo = `<div class="field"><span class="label">¿A qué cuenta llegó?</span>${cuentasCh('cuenta')}</div>`;
  else if (t === 'transferencia') cuerpo = `<div class="field"><span class="label">Desde</span>${cuentasCh('desde')}</div><div class="field"><span class="label">Hacia</span>${cuentasCh('hacia')}</div>
    <span class="sub" style="font-size:12.5px">Mover plata entre tus cuentas no es gasto ni ingreso.</span>`;
  else if (t === 'prestamo') cuerpo = `<label class="field"><span class="label">¿A quién le prestaste?</span><input id="f-persona" value="${esc(f.persona)}" placeholder="Nombre"></label><div class="field"><span class="label">¿De dónde salió?</span>${medios}</div>
    <span class="sub" style="font-size:12.5px">Un préstamo no es gasto: queda en "Te deben" hasta que te devuelvan.</span>`;
  else if (t === 'devolucion') { const nombres = [...new Set(S.movs.filter(m => clase(m) === 'prestamo').map(m => m.persona || m.nota).filter(Boolean))];
    cuerpo = `<label class="field"><span class="label">¿Quién te devolvió?</span><input id="f-persona" value="${esc(f.persona)}" placeholder="Nombre" list="dl-pers"><datalist id="dl-pers">${nombres.map(n => `<option value="${esc(n)}">`).join('')}</datalist></label><div class="field"><span class="label">¿A qué cuenta llegó?</span>${cuentasCh('cuenta')}</div>`; }
  else if (t === 'ahorro') cuerpo = `<div class="seg"><button type="button" data-f="signo" data-v="1" class="${f.signo > 0 ? 'on' : ''}">Aporte</button><button type="button" data-f="signo" data-v="-1" class="${f.signo < 0 ? 'on' : ''}">Retiro</button></div>
    <div class="field"><span class="label">Meta</span>${chips(objs.map(o => [o.id, o.nombre]), 'cat', f.cat)}</div>`;
  else if (t === 'inversion') cuerpo = `<div class="seg"><button type="button" data-f="op" data-v="compra" class="${f.op !== 'venta' ? 'on' : ''}">Compra / aporte</button><button type="button" data-f="op" data-v="venta" class="${f.op === 'venta' ? 'on' : ''}">Venta</button></div>
    <div class="two"><label class="field"><span class="label">Activo</span><input id="f-activo" value="${esc(f.activo)}" placeholder="BTC, ETH, fondo…" autocapitalize="characters"></label><label class="field"><span class="label">Cantidad</span><input id="f-cantidad" inputmode="decimal" value="${esc(f.cantidad)}" placeholder="0.001"></label></div>
    <label class="field"><span class="label">Comisión (S/)</span><input id="f-comision" inputmode="decimal" value="${esc(f.comision)}" placeholder="0.00"></label>
    <span class="sub" style="font-size:12.5px">El monto es el total de la operación en soles, sin la comisión.</span>`;
  $('#sheet-body').innerHTML = `<div class="row"><h2>${S.edit ? 'Editar movimiento' : 'Registrar'}</h2><button type="button" class="link" data-close>Cerrar</button></div>
    ${S.edit ? '' : `<div class="chips">${TIPOS.map(([k, n, icon]) => `<button type="button" data-f="tipo" data-v="${k}" class="${t === k ? 'on' : ''}">${ic(icon)}${n}</button>`).join('')}</div>`}
    <label class="amt"><span>S/</span><input id="f-monto" inputmode="decimal" placeholder="0.00" value="${esc(f.monto)}" aria-label="Monto"></label>
    ${cuerpo}
    <div class="two"><label class="field"><span class="label">Fecha</span><input type="date" id="f-fecha" value="${esc(f.fecha)}"></label>
      <label class="field"><span class="label">${t === 'ingreso' ? 'De qué' : 'Nota'}</span><input id="f-nota" value="${esc(f.nota)}" placeholder="${t === 'ingreso' ? 'Venta, trabajo…' : 'Opcional'}"></label></div>
    <button class="btn" type="submit">${ic('check')} ${S.edit ? 'Guardar cambios' : 'Guardar'}</button>
    ${S.edit ? `<button type="button" class="btn ghost" data-delmov style="color:var(--red)">${ic('trash-2')} Eliminar movimiento</button>` : ''}`;
  iconos();
}
$('#sheet-body').addEventListener('click', async e => {
  if (e.target.closest('[data-close]')) { hideSheet('sheet'); return; }
  if (e.target.closest('[data-delmov]')) { if (await confirmar('¿Eliminar este movimiento?')) { delMov(S.edit); hideSheet('sheet'); render(); toast('Movimiento eliminado'); } return; }
  const b = e.target.closest('[data-f]'); if (!b) return;
  leerRegistro();
  const k = b.dataset.f, v = b.dataset.v;
  S.f[k] = k === 'signo' ? +v : v;
  if (k === 'tipo') { if (v === 'ahorro') S.f.cat = 'emergencia'; else if (v === 'gasto' && !CHIP_CATS.includes(S.f.cat)) S.f.cat = 'comida'; if (v !== 'gasto' && v !== 'prestamo' && (isCred(S.f.medio) || S.f.medio === 'adelanto')) S.f.medio = 'yape'; }
  dibujarRegistro();
});
$('#sheet-form').addEventListener('submit', e => {
  e.preventDefault(); leerRegistro();
  const f = S.f, monto = num(f.monto);
  if (monto <= 0) { toast('Escribe el monto.'); $('#f-monto') && $('#f-monto').focus(); return; }
  const base = {fecha: f.fecha || ymd(today()), nota: String(f.nota || '').trim().slice(0, 80)};
  let m;
  if (f.tipo === 'gasto') { m = {tipo: 'gasto', cat: f.cat, monto, medio: f.medio, ...base}; S.sel.cat = f.cat; S.sel.medio = f.medio; }
  else if (f.tipo === 'ingreso') m = {tipo: 'ingreso', cat: 'ing_extra', monto, cuenta: f.cuenta, medio: f.cuenta, ...base};
  else if (f.tipo === 'devolucion') m = {tipo: 'ingreso', cat: 'devolucion', monto, persona: String(f.persona || '').trim(), cuenta: f.cuenta, medio: f.cuenta, ...base};
  else if (f.tipo === 'prestamo') { if (!String(f.persona || '').trim()) { toast('Escribe a quién le prestaste.'); return; } m = {tipo: 'prestamo', cat: 'prestado', monto, persona: String(f.persona).trim(), medio: f.medio, ...base}; }
  else if (f.tipo === 'transferencia') { if (f.desde === f.hacia) { toast('Elige dos cuentas distintas.'); return; } m = {tipo: 'transferencia', monto, desde: f.desde, hacia: f.hacia, ...base}; }
  else if (f.tipo === 'ahorro') m = {tipo: 'ahorro', cat: f.cat, monto: f.signo < 0 ? -monto : monto, medio: 'transferencia', ...base};
  else if (f.tipo === 'inversion') { if (!String(f.activo || '').trim()) { toast('Escribe el activo, por ejemplo BTC.'); return; } m = {tipo: 'inversion', op: f.op === 'venta' ? 'venta' : 'compra', activo: String(f.activo).trim().toUpperCase(), cantidad: num(f.cantidad), comision: num(f.comision), monto, ...base}; }
  else { const orig = S.movs.find(x => x.id === S.edit) || {}; m = {...orig, monto: orig.monto < 0 ? -monto : monto, ...base}; }
  if (S.edit) {
    const orig = S.movs.find(x => x.id === S.edit) || {};
    // Al editar se conserva lo que el formulario no muestra (ciclo de un pago, creado…)
    updMov(S.edit, {...orig, ...m, tipo: m.tipo === 'gasto' && orig.tipo === 'gasto' ? 'gasto' : m.tipo});
    toast('Cambios guardados');
  } else { addMov(m); toast(`${movInfo(m).signo === '+' ? '+' : ''}${money(monto)} guardado`); }
  hideSheet('sheet'); render();
});

/* ---------- cierre del día ---------- */
function abrirCierre(fecha){
  const hoyS = ymd(today()), t = fecha && fecha <= hoyS ? fecha : hoyS, esHoy = t === hoyS; S.cierreFecha = t;
  const gastos = S.movs.filter(m => m.fecha === t && (esConsumo(m) || clase(m) === 'prestamo')).sort((a, b) => (a.creado || 0) - (b.creado || 0));
  const prev = S.cierres.find(x => x.fecha === t) || [...S.cierres].filter(x => x.fecha < t).sort((a, b) => a.fecha < b.fecha ? 1 : -1)[0] || lastCierre();
  const s = (prev && prev.saldos) || {}, L = lineas();
  $('#cierre-body').innerHTML = `<div class="row"><h2>${esHoy ? 'Finalizar día' : 'Cerrar ' + longD(parseD(t))}</h2><button type="button" class="link" data-close>Cerrar</button></div>
    <div class="chips">${[...Array(7)].map((_, i) => { const d = addDays(today(), -i), f = ymd(d), ok = S.cierres.some(x => x.fecha === f);
      return `<button type="button" data-cf="${f}" class="${f === t ? 'on' : ''}">${i === 0 ? 'Hoy' : i === 1 ? 'Ayer' : cap(DOW[d.getDay()]) + ' ' + d.getDate()}${ok ? ' ✓' : ''}</button>`; }).join('')}</div>
    <label class="line"><span>Otra fecha</span><input type="date" id="ci-fecha" value="${t}" max="${hoyS}" style="width:auto"></label>
    <div class="row"><span class="sub">${gastos.length ? 'Gastaste ' + (esHoy ? 'hoy' : 'ese día') : 'Sin gastos registrados ' + (esHoy ? 'hoy' : 'ese día')}</span><b class="num" style="font-size:20px">${money(sumar(gastos.filter(esConsumo)))}</b></div>
    ${gastos.length ? `<div class="field"><span class="label">¿De dónde salió cada gasto?</span>${gastos.map(m => `<div class="row" style="border-top:1px solid var(--line);padding-top:8px"><span>${esc(movInfo(m).titulo)}<br><small class="sub num">${money(m.monto)}${m.nota ? ' · ' + esc(m.nota) : ''}</small></span>
      <select class="input" data-mid="${esc(m.id)}" style="width:auto;max-width:170px;min-height:38px;padding:6px 8px">${(MEDIOS_NUEVOS.some(x => x[0] === m.medio) ? MEDIOS_NUEVOS : MEDIOS).map(([k, n]) => `<option value="${k}" ${m.medio === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div>`).join('')}</div>` : ''}
    <button type="button" class="btn ghost" data-olvide>${ic('plus')} Me olvidé de anotar algo</button>
    <div class="field"><span class="label">¿Cuánto te queda ${esHoy ? 'ahora' : 'ese día'}?</span><span class="sub" style="font-size:12.5px">Mira cada app. En las tarjetas escribe el <b>disponible</b>.</span>
      ${CUENTAS.map(x => `<label class="line"><span>${x.n}<small>${x.tipo === 'tc' ? 'Disponible de una línea de ' + money0(L[x.k]) : x.h}</small></span><input id="ci-${x.k}" inputmode="decimal" placeholder="0.00" value="${s[x.k] !== undefined && s[x.k] !== '' ? (+s[x.k]).toFixed(2) : ''}"></label>`).join('')}
      ${prev && prev.fecha !== t ? `<span class="sub" style="font-size:12px">Te dejé los saldos del ${short(parseD(prev.fecha))}. Cámbialos si se movieron.</span>` : ''}</div>
    <button class="btn" type="submit">${ic('check')} Guardar cierre</button>`;
  showSheet('cierre');
}
$('#cierre-body').addEventListener('click', e => {
  if (e.target.closest('[data-close]')) { hideSheet('cierre'); return; }
  if (e.target.closest('[data-olvide]')) { hideSheet('cierre'); S.dia = S.cierreFecha; abrirRegistro('gasto'); return; }
  const cf = e.target.closest('[data-cf]'); if (cf) abrirCierre(cf.dataset.cf);
});
$('#cierre-body').addEventListener('change', e => { if (e.target.id === 'ci-fecha' && e.target.value) abrirCierre(e.target.value); });
$('#cierre-form').addEventListener('submit', e => {
  e.preventDefault();
  const t = S.cierreFecha || ymd(today());
  for (const sel of document.querySelectorAll('#cierre-body select[data-mid]')) { const m = S.movs.find(x => x.id === sel.dataset.mid); if (m && m.medio !== sel.value) updMov(m.id, {medio: sel.value}); }
  const saldos = {}; for (const x of CUENTAS) { const v = $('#ci-' + x.k).value.trim(); if (v !== '') saldos[x.k] = num(v); }
  const cierre = {fecha: t, saldos, gastoHoy: sumar(S.movs.filter(m => m.fecha === t && esConsumo(m))), creado: Date.now()};
  S.cierres = S.cierres.filter(x => x.fecha !== t).concat(cierre).sort((a, b) => a.fecha < b.fecha ? -1 : 1).slice(-400);
  if (!LS.set('soles.cierres', S.cierres)) { toast('No se pudo guardar el cierre.'); return; }
  hideSheet('cierre'); S.view = 'inicio'; render(); window.scrollTo(0, 0);
  toast(t === ymd(today()) ? 'Día cerrado. Buen trabajo 💪' : 'Cerraste el ' + longD(parseD(t)));
});

/* ---------- objetivos: crear y editar ---------- */
function abrirObjetivo(o){
  $('#dlg-body').innerHTML = `<div class="row"><h2>${o ? 'Editar meta' : 'Nueva meta'}</h2><button type="button" class="link" data-close>Cerrar</button></div>
    <label class="field"><span class="label">Nombre</span><input id="o-nombre" value="${esc(o ? o.nombre : '')}" placeholder="Celular nuevo, laptop…" required></label>
    <div class="two"><label class="field"><span class="label">Monto objetivo (S/)</span><input id="o-meta" inputmode="decimal" value="${o ? (+o.meta).toFixed(2) : ''}" required></label>
      <label class="field"><span class="label">Fecha meta (opcional)</span><input id="o-fecha" type="date" value="${esc(o ? o.fechaMeta || '' : '')}"></label></div>
    ${o && o.builtin ? '' : `<div class="field"><span class="label">Tipo</span><select id="o-tipo" class="input">${[['compra','Compra importante'],['viaje','Viaje'],['emergencia','Fondo de emergencia'],['inversion','Inversión'],['deuda','Pago de deuda'],['otro','Otro']].map(([k, n]) => `<option value="${k}" ${o && o.tipo === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div>`}
    <button class="btn" type="submit">${ic('check')} Guardar</button>`;
  $('#dlg-form').onsubmit = e => {
    e.preventDefault();
    const nombre = $('#o-nombre').value.trim(), meta = num($('#o-meta').value), fechaMeta = $('#o-fecha').value;
    if (!nombre || meta <= 0) { toast('Escribe el nombre y el monto.'); return; }
    if (o && o.builtin) { const aj = LS.get('soles.objAjustes', {}); aj[o.id] = Object.assign({}, aj[o.id], {nombre, meta, fechaMeta}); LS.set('soles.objAjustes', aj); }
    else { const list = LS.get('soles.objetivos', []), tipo = $('#o-tipo').value;
      if (o) LS.set('soles.objetivos', list.map(x => x.id === o.id ? {...x, nombre, meta, fechaMeta, tipo} : x));
      else LS.set('soles.objetivos', list.concat({id: 'obj_' + Date.now().toString(36), nombre, meta, fechaMeta, tipo, estado: 'activo', creado: Date.now()})); }
    hideSheet('dlg'); $('#dlg-form').onsubmit = null; render(); toast('Meta guardada');
  };
  $('#dlg-body').onclick = e => { if (e.target.closest('[data-close]')) hideSheet('dlg'); };
  showSheet('dlg');
}
function estadoObjetivo(idObj, estado){
  const list = LS.get('soles.objetivos', []);
  if (list.some(x => x.id === idObj)) LS.set('soles.objetivos', list.map(x => x.id === idObj ? {...x, estado} : x));
  else { const aj = LS.get('soles.objAjustes', {}); aj[idObj] = Object.assign({}, aj[idObj], {estado}); LS.set('soles.objAjustes', aj); }
}

/* ================= RENDER E INTERACCIÓN ================= */
function iconos(){ try { if (window.lucide) lucide.createIcons({attrs: {'stroke-width': 2}}); } catch(e) {} }
function render(){
  const ae = document.activeElement;
  if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA') && $('#view').contains(ae) && ae.id !== 'mov-q') return;
  document.querySelectorAll('nav.tabs button').forEach(b => b.classList.toggle('on', b.dataset.v === S.view));
  const v = $('#view');
  if (!S.cfg) {
    $('#top').innerHTML = `<div><h1>Soles</h1></div>`;
    v.innerHTML = `<section class="card">${empty('link', 'Conecta tu plan', 'Pega aquí el link que te mandó Claude. Es una sola vez: después el plan se actualiza solo.')}
      <textarea id="cfg0" rows="3" class="input" placeholder="https://sguzmanfigueroa.github.io/soles-de-sebas/#k=…"></textarea><button class="btn" data-act="loadcfg" data-src="cfg0">Conectar</button>
      <label class="btn ghost">${ic('upload')} Restaurar respaldo<input type="file" data-act="restore" accept="application/json,.json" hidden></label></section>`;
    iconos(); return;
  }
  const id = cicloHoy(), r = rangoCiclo(id, dia()), hoy = today();
  const titulos = {inicio: 'Hola, Sebas', movimientos: 'Movimientos', presupuesto: 'Presupuesto', objetivos: 'Objetivos', finanzas: 'Finanzas'};
  $('#top').innerHTML = `<div><h1>${titulos[S.view] || 'Soles'}</h1><div class="sub">${hoy < r.start ? 'El plan arranca el ' + longD(r.start) : cap(longD(hoy)) + ' · día ' + (daysBetween(r.start, hoy) + 1) + ' de ' + (daysBetween(r.start, r.end) + 1)}</div></div>
    <span class="chip-cycle">${ic('calendar')} ${nombreCiclo(id)}</span>`;
  const fn = {inicio: vInicio, movimientos: vMovimientos, presupuesto: vPresupuesto, objetivos: vObjetivos, finanzas: vFinanzas}[S.view] || vInicio;
  let html; try { html = fn(); } catch(err) { console.error(err); html = `<section class="card">${empty('alert-triangle', 'Algo falló al mostrar esta sección', esc(err.message))}</section>`; }
  v.innerHTML = `<div class="stack view-in" style="gap:12px">${html}</div>`;
  iconos();
}
document.querySelector('nav.tabs').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  S.view = b.dataset.v; S.cOff = 0; try { localStorage.setItem('soles.view2', S.view); } catch(e) {}
  render(); window.scrollTo(0, 0);
});
$('#fab').addEventListener('click', () => { if (!S.cfg) { toast('Primero conecta tu plan.'); return; } abrirRegistro(S.view === 'objetivos' ? 'ahorro' : 'gasto'); });

$('#view').addEventListener('click', async e => {
  const tip = e.target.closest('[data-tip]');
  if (tip) { const line = tip.closest('.chart') && tip.closest('.chart').querySelector('[data-tipline]'); if (line) line.textContent = tip.dataset.tip; }
  const b = e.target.closest('[data-act]'); if (!b || b.tagName === 'INPUT') return;
  const act = b.dataset.act, k = b.dataset.k;
  if (act === 'go') { S.view = b.dataset.v; render(); window.scrollTo(0, 0); }
  else if (act === 'dia') { S.dia = b.dataset.f || null; render(); }
  else if (act === 'diamov') { const d = addDays(S.dia ? parseD(S.dia) : today(), +k); S.dia = ymd(d) === ymd(today()) ? null : ymd(d); render(); }
  else if (act === 'cierre') abrirCierre(b.dataset.f);
  else if (act === 'editmov') { const m = S.movs.find(x => x.id === b.dataset.id); if (m) abrirRegistro(null, m); }
  else if (act === 'per') { S.per = k; render(); }
  else if (act === 'tipoF') { S.tipoF = k; render(); }
  else if (act === 'ciclo') { S.cOff += +k; render(); }
  else if (act === 'fintab') { S.finTab = k; S.cOff = 0; render(); }
  else if (act === 'scope') { S.scope = k; render(); }
  else if (act === 'estricto') { setPref('estricto', false); render(); }
  else if (act === 'nuevo') abrirRegistro(b.dataset.t);
  else if (act === 'pago') {
    const id = cicloVista(), it = Calc.pagos(S.cfg, S.movs, id).find(i => i.k === b.dataset.k); if (!it) return;
    if (it.hecho) { delMov(it.mid); toast('Desmarcado'); }
    else { const r = rangoCiclo(id, dia()), t = today(), f = t < r.start ? r.start : t > r.end ? r.end : t, inp = $('#pg-' + it.k);
      addMov({id: it.mid, tipo: it.ahorro ? 'ahorro' : 'pago', cat: it.k, monto: num(inp ? inp.value : it.monto), fecha: ymd(f), medio: 'transferencia', nota: '', ciclo: id}); toast(`${catN(it.k)} marcado`); }
    render();
  }
  else if (act === 'aportar') abrirRegistro('ahorro'), S.f.cat = b.dataset.id, dibujarRegistro();
  else if (act === 'nuevoobj') abrirObjetivo(null);
  else if (act === 'editobj') abrirObjetivo(objetivos().find(o => o.id === b.dataset.id));
  else if (act === 'estadoobj') { estadoObjetivo(b.dataset.id, b.dataset.e); render(); toast(b.dataset.e === 'completado' ? '¡Meta completada!' : b.dataset.e === 'pausado' ? 'Meta en pausa' : 'Meta reanudada'); }
  else if (act === 'delobj') { const o = objetivos().find(x => x.id === b.dataset.id); if (!o) return;
    if (await confirmar(`¿Eliminar la meta "${o.nombre}"?`)) { LS.set('soles.objetivos', LS.get('soles.objetivos', []).filter(x => x.id !== o.id)); render(); toast('Meta eliminada. Sus aportes siguen en Movimientos.'); } }
  else if (act === 'precio') { const a = b.dataset.a, v = num($('#pr-' + a) && $('#pr-' + a).value); const pr = LS.get('soles.precios', {}); if (v > 0) pr[a] = {precio: v, fecha: ymd(today())}; else delete pr[a]; LS.set('soles.precios', pr); render(); toast('Precio guardado'); }
  else if (act === 'repartir') { const id = cicloVista(); cambiarPlan(`ciclos.${id}.montos.brasil`, +b.dataset.b); cambiarPlan(`ciclos.${id}.montos.emergencia`, +b.dataset.e); render(); toast('Reparto aplicado'); }
  else if (act === 'backup') {
    const blob = new Blob([JSON.stringify({app: 'soles-de-sebas', v: 2, fecha: new Date().toISOString(), config: S.cfg, movs: S.movs, cierres: S.cierres, objetivos: LS.get('soles.objetivos', []), objAjustes: LS.get('soles.objAjustes', {}), precios: LS.get('soles.precios', {}), prefs: prefs()}, null, 2)], {type: 'application/json'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'soles-respaldo-' + ymd(today()) + '.json'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  else if (act === 'copyjson') {
    const txt = JSON.stringify({config: S.cfg, movs: S.movs, cierres: S.cierres, objetivos: LS.get('soles.objetivos', []), objAjustes: LS.get('soles.objAjustes', {}), precios: LS.get('soles.precios', {})});
    try { await navigator.clipboard.writeText(txt); toast('Datos copiados. Pégalos en tu chat con Claude.'); } catch(_) { toast('No se pudo copiar. Usa Respaldo.'); }
  }
  else if (act === 'loadcfg') { const ta = $('#' + (b.dataset.src || 'cfg1')); if (ta) ta.blur(); const had = !!S.cfg;
    if (await loadFromText(ta && ta.value)) { toast(had ? 'Plan actualizado' : 'Plan conectado'); render(); } else toast('Ese link no está completo. Cópialo otra vez entero.'); }
});
$('#view').addEventListener('change', e => {
  const el = e.target;
  if (el.id === 'pick-dia') { S.dia = el.value && el.value !== ymd(today()) ? el.value : null; el.blur(); render(); return; }
  if (el.id === 'rg-a' || el.id === 'rg-b') { S[el.id === 'rg-a' ? 'desde' : 'hasta'] = el.value; el.blur(); render(); return; }
  if (el.id === 'sw-estricto') { setPref('estricto', el.checked); render(); toast(el.checked ? 'Modo control estricto activado' : 'Modo estricto desactivado'); return; }
  if (el.id === 'aj-dia') { const d = Math.max(1, Math.min(31, Math.round(num(el.value)))); cambiarPlan('diaInicio', d); toast('Día de cobro: ' + d); return; }
  if (el.id === 'aj-am' || el.id === 'aj-ro') { const pr = prefs(), u = Object.assign({}, Calc.UMBRALES, pr.umbrales); u[el.id === 'aj-am' ? 'amarillo' : 'rojo'] = Math.max(0.1, num(el.value) / 100); setPref('umbrales', u); toast('Semáforo actualizado'); return; }
  if (el.dataset.plan) { const id = cicloVista(), base = S.scope === 'base'; cambiarPlan(base ? `base.montos.${el.dataset.plan}` : `ciclos.${id}.montos.${el.dataset.plan}`, num(el.value)); toast('Monto guardado'); return; }
  if (el.dataset.ingreso) { const id = cicloVista(), base = S.scope === 'base'; cambiarPlan(base ? 'base.ingreso' : `ciclos.${id}.ingreso`, num(el.value)); toast('Ingreso guardado'); return; }
  if (el.dataset.extra != null) { const id = cicloVista(), arr = Calc.plan(S.cfg, S.movs, id).extras.map(x => ({...x})); arr[+el.dataset.extra].monto = num(el.value); setPath(S.cfg, `ciclos.${id}.extras`, arr); guardar(); toast('Guardado'); return; }
  if (el.dataset.linea) { cambiarPlan(`lineas.${el.dataset.linea}`, num(el.value)); toast('Línea guardada'); return; }
  if (el.dataset.pend != null) { const arr = (S.cfg.pendientes || []).map(x => ({...x})); arr[+el.dataset.pend].ok = el.checked; S.cfg.pendientes = arr; guardar(); render(); return; }
  if (el.dataset.act === 'restore') {
    const f = el.files && el.files[0]; if (!f) return;
    f.text().then(t => { const d = JSON.parse(t); if (!d.config || !Array.isArray(d.movs)) throw 0;
      S.cfg = d.config; S.movs = d.movs; if (Array.isArray(d.cierres)) { S.cierres = d.cierres; LS.set('soles.cierres', S.cierres); }
      if (d.objetivos) LS.set('soles.objetivos', d.objetivos); if (d.objAjustes) LS.set('soles.objAjustes', d.objAjustes); if (d.precios) LS.set('soles.precios', d.precios);
      guardar(); render(); toast('Respaldo restaurado'); }).catch(() => toast('Ese archivo no es un respaldo de esta app.'));
  }
});
let qT;
$('#view').addEventListener('input', e => { if (e.target.id === 'mov-q') { clearTimeout(qT); const pos = e.target.selectionStart; qT = setTimeout(() => { S.q = e.target.value; render(); const i = $('#mov-q'); if (i) { i.focus(); try { i.setSelectionRange(pos, pos); } catch(_) {} } }, 220); } });
$('#view').addEventListener('focusout', () => setTimeout(() => { const ae = document.activeElement; if (!$('#view').contains(ae) || (ae.tagName !== 'INPUT' && ae.tagName !== 'TEXTAREA')) render(); }, 60));
document.addEventListener('keydown', e => { if (e.key === 'Escape') ['sheet','cierre','dlg'].forEach(hideSheet); });

/* ================= SINCRONIZACIÓN (igual que antes: plan cifrado + correcciones) ================= */
const b64urlToBytes = s => { const b = s.replace(/-/g, '+').replace(/_/g, '/'); return Uint8Array.from(atob(b + '==='.slice((b.length + 3) % 4)), c => c.charCodeAt(0)); };
function aplicarAjustes(cfg){
  if (!cfg) return;
  const hechos = new Set(LS.get('soles.ajustes', [])); let cambio = false;
  for (const a of (cfg.ajustesMovs || [])) {
    const key = [a.id, a.cat || '', a.medio || ''].join(':'); if (hechos.has(key)) continue;
    const m = S.movs.find(x => x.id === a.id); if (!m) continue;
    if (a.cat) m.cat = a.cat; if (a.medio) m.medio = a.medio; cambio = true; hechos.add(key);
  }
  if (cambio) LS.set('soles.movs', S.movs);
  LS.set('soles.ajustes', [...hechos]);
}
// Aplica un plan nuevo conservando lo que se anotó en el celular
function applyConfig(cfg){
  if (!cfg || !cfg.base || !cfg.base.montos) return false;
  const old = S.cfg;
  if (old) {
    for (const id in (old.ciclos || {})) {
      const oe = old.ciclos[id].extras || [], ne = cfg.ciclos && cfg.ciclos[id] && cfg.ciclos[id].extras;
      if (ne) for (const e of ne) { const o = oe.find(x => x.n === e.n); if (o && +o.monto && !+e.monto) e.monto = o.monto; }
    }
    const okT = new Set((old.pendientes || []).filter(p => p.ok).map(p => p.t));
    for (const p of (cfg.pendientes || [])) if (okT.has(p.t)) p.ok = true;
    if (old.locales && !cfg.borrarLocales) { for (const [p, v] of Object.entries(old.locales)) setPath(cfg, p, v); cfg.locales = {...old.locales}; }
  }
  delete cfg.borrarLocales;
  aplicarAjustes(cfg);
  S.cfg = cfg; LS.set('soles.config', S.cfg);
  return true;
}
let syncing = null;
function syncRemote(){
  if (syncing) return syncing;
  syncing = (async () => {
    const k = LS.get('soles.key', null);
    if (!k || !window.crypto || !crypto.subtle) return false;
    try {
      const r = await fetch('plan.enc.json?t=' + Date.now(), {cache: 'no-store'}); if (!r.ok) return false;
      const enc = await r.json();
      if (S.cfg && +enc.v <= +LS.get('soles.planv', 0)) return false;
      const key = await crypto.subtle.importKey('raw', b64urlToBytes(k), 'AES-GCM', false, ['decrypt']);
      const plain = await crypto.subtle.decrypt({name: 'AES-GCM', iv: b64urlToBytes(enc.iv)}, key, b64urlToBytes(enc.data));
      if (!applyConfig(JSON.parse(new TextDecoder().decode(plain)))) return false;
      LS.set('soles.planv', +enc.v); render(); return true;
    } catch(e) { return false; }
  })().finally(() => { syncing = null; });
  return syncing;
}
async function loadFromText(text){
  const s = String(text || ''), ki = s.indexOf('k=');
  if (ki >= 0 && s.indexOf('plan=') < 0) {
    const k = s.slice(ki + 2).replace(/[^A-Za-z0-9_-]/g, ''); if (k.length < 40) return false;
    const prevK = LS.get('soles.key', null), prevV = LS.get('soles.planv', 0);
    LS.set('soles.key', k); LS.set('soles.planv', 0);
    const ok = await syncRemote(); if (!ok) { LS.set('soles.key', prevK); LS.set('soles.planv', prevV); } return ok;
  }
  try { const i = s.indexOf('plan='), b64 = (i >= 0 ? s.slice(i + 5) : s).replace(/[^A-Za-z0-9_-]/g, ''); if (b64.length < 20) return false;
    return applyConfig(JSON.parse(new TextDecoder().decode(b64urlToBytes(b64)))); } catch(e) { return false; }
}
// Si hay una versión nueva publicada, recarga (el iPhone guarda la página vieja en caché)
async function checkUpdate(){
  try {
    const r = await fetch('version.json?t=' + Date.now(), {cache: 'no-store'}); if (!r.ok) return;
    const v = String((await r.json()).v); if (v === String(window.APP_VERSION)) return;
    let tried = null; try { tried = sessionStorage.getItem('soles.upd'); } catch(e) {}
    if (tried === v) return;
    try { sessionStorage.setItem('soles.upd', v); } catch(e) {}
    location.replace(location.pathname + '?v=' + v);
  } catch(e) {}
}

/* ================= ARRANQUE ================= */
(function boot(){
  let ok = true;
  try { localStorage.setItem('soles.test', '1'); localStorage.removeItem('soles.test'); } catch(e) { ok = false; }
  S.cfg = LS.get('soles.config', null); S.movs = LS.get('soles.movs', []); S.cierres = LS.get('soles.cierres', []);
  aplicarAjustes(S.cfg);
  if (!ok) { $('#view').innerHTML = `<section class="card">${empty('alert-triangle', 'Este navegador no deja guardar datos', 'Sal del modo privado de Safari e inténtalo otra vez.')}</section>`; iconos(); return; }
  if (/(^|[#&])(k|plan)=/.test(location.hash)) {
    const h = location.hash; history.replaceState(null, '', location.pathname);
    loadFromText(h).then(r => { toast(r ? 'Listo: tu plan quedó conectado' : 'El link está incompleto. Cópialo otra vez entero.'); render(); });
  } else { checkUpdate(); syncRemote().then(r => { if (r) toast('Claude actualizó tu plan'); }); }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { checkUpdate(); syncRemote().then(r => { if (r) toast('Claude actualizó tu plan'); }); } });
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch(e) {}
  render();
})();
