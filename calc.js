/* Cálculos de Soles de Sebas.
   Todo el dinero se suma en céntimos enteros para evitar errores de punto flotante.
   No toca la pantalla ni el almacenamiento: recibe datos y devuelve resultados, así se puede probar con node. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else root.Calc = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // g: grupo del plan. libre = presupuesto del día a día; fijo/moto = obligaciones; ahorro = metas
  const CATS = {
    mama: {n: 'Mamá (deuda)', g: 'fijo', deuda: true}, telefono: {n: 'Teléfono', g: 'fijo'},
    tc_bbva: {n: 'Tarjeta BBVA', g: 'fijo', deuda: true}, tc_bcp: {n: 'Tarjeta BCP', g: 'fijo', deuda: true},
    caja: {n: 'Caja Arequipa', g: 'fijo', deuda: true}, adelanto: {n: 'Adelanto de sueldo', g: 'fijo', deuda: true, h: 'S/ 500 + S/ 20 de comisión'},
    suscripciones: {n: 'Suscripciones', g: 'fijo', h: 'Spotify, Claude, Workspace'}, casa: {n: 'Aporte casa', g: 'fijo'}, soat: {n: 'SOAT moto', g: 'fijo'},
    gasolina: {n: 'Gasolina', g: 'moto', icon: 'fuel'}, moto_fondo: {n: 'Fondo moto', g: 'moto', h: 'Mantenimiento y SOAT del próximo año'},
    emergencia: {n: 'Fondo de emergencia', g: 'ahorro'}, brasil: {n: 'Viaje a Brasil', g: 'ahorro'}, inversion: {n: 'Inversión', g: 'ahorro'},
    comida: {n: 'Alimentación', g: 'libre', icon: 'utensils', h: 'Comida fuera, snacks, agua'},
    transporte: {n: 'Transporte', g: 'libre', icon: 'bus', h: 'Bus, combi, taxi, apps'},
    novia: {n: 'Pareja', g: 'libre', icon: 'heart', h: 'Cafés, cenas y planes con ella'},
    salidas: {n: 'Salidas', g: 'libre', icon: 'party-popper', h: 'Fiestas, eventos, hotel, paseos'},
    entretenimiento: {n: 'Entretenimiento', g: 'libre', icon: 'gamepad-2', h: 'Cine, juegos, apps'},
    salud: {n: 'Salud', g: 'libre', icon: 'pill', h: 'Farmacia, consultas'},
    ropa: {n: 'Compras', g: 'libre', icon: 'shopping-bag', h: 'Ropa, tecnología, cosas para ti'},
    personal: {n: 'Gastos personales', g: 'libre', icon: 'sparkles', h: 'Barbería, cuidado personal'},
    regalos: {n: 'Fechas especiales', g: 'libre', icon: 'gift', h: 'Cumpleaños, Navidad, regalos'},
    varios: {n: 'Otros', g: 'libre', icon: 'circle-ellipsis', h: 'Lo que no entra en otra'},
    prestado: {n: 'Préstamo que diste', g: 'prestado'},
    ing_extra: {n: 'Ingreso extra', g: 'ingreso'}, devolucion: {n: 'Me devolvieron', g: 'ingreso'}
  };
  const LIBRES = Object.keys(CATS).filter(k => CATS[k].g === 'libre');
  const ESENCIALES = ['comida', 'transporte', 'salud', 'gasolina'];

  /* ---------- dinero en céntimos ---------- */
  const aC = v => { const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : +v; return isFinite(n) ? Math.round(n * 100) : 0; };
  const aS = c => Math.round(c) / 100;
  const sumar = (arr, f) => aS(arr.reduce((t, x) => t + aC(f ? f(x) : x.monto), 0));
  const restar = (a, b) => aS(aC(a) - aC(b));
  const mas = (...xs) => aS(xs.reduce((t, x) => t + aC(x), 0));

  /* ---------- fechas ---------- */
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseD = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const daysBetween = (a, b) => Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 864e5);
  const diasMes = (y, m) => new Date(y, m + 1, 0).getDate();
  // Día de cobro en un mes; si el mes es más corto (febrero y el 30), usa el último día
  const inicioEnMes = (y, m, dia) => { const d = new Date(y, m, 1); return new Date(d.getFullYear(), d.getMonth(), Math.min(dia, diasMes(d.getFullYear(), d.getMonth()))); };

  /* ---------- ciclo de cobro: id "AAAA-MM" = mes en que empieza ---------- */
  function cicloDe(d, dia) {
    let y = d.getFullYear(), m = d.getMonth();
    if (d < inicioEnMes(y, m, dia)) { m--; if (m < 0) { m = 11; y--; } }
    return `${y}-${pad(m + 1)}`;
  }
  function rangoCiclo(id, dia) {
    const [y, m] = id.split('-').map(Number);
    const start = inicioEnMes(y, m - 1, dia), sig = inicioEnMes(y, m, dia);
    return {start, end: addDays(sig, -1), siguiente: sig};
  }
  const moverCiclo = (id, k) => { const [y, m] = id.split('-').map(Number); const d = new Date(y, m - 1 + k, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };

  /* ---------- qué es cada movimiento ---------- */
  // Cada movimiento pertenece a una sola clase, así nada se cuenta dos veces
  function clase(m) {
    if (!m) return 'otro';
    if (m.tipo === 'transferencia') return 'transferencia';
    if (m.tipo === 'prestamo' || (m.tipo === 'gasto' && m.cat === 'prestado')) return 'prestamo';
    if (m.tipo === 'ingreso' && m.cat === 'devolucion') return 'devolucion';
    if (m.tipo === 'ingreso') return 'ingreso';
    if (m.tipo === 'gasto') return 'gasto';
    if (m.tipo === 'pago') return 'pago';
    if (m.tipo === 'ahorro') return 'ahorro';
    if (m.tipo === 'inversion') return 'inversion';
    return 'otro';
  }
  const esConsumo = m => clase(m) === 'gasto';
  const esLibre = m => esConsumo(m) && !!CATS[m.cat] && CATS[m.cat].g === 'libre';

  // Lo registrado antes de que arranque el plan cuenta en el primer ciclo
  function movsCiclo(cfg, movs, id) {
    const r = rangoCiclo(id, cfg.diaInicio || 28);
    const a = cfg.inicio && id === cfg.inicio ? '0000-00-00' : ymd(r.start), b = ymd(r.end);
    return movs.filter(m => m.fecha >= a && m.fecha <= b);
  }

  /* ---------- plan del ciclo ---------- */
  function plan(cfg, movs, id, soloBase) {
    const ov = soloBase ? {} : (cfg.ciclos || {})[id] || {};
    const montos = Object.assign({}, (cfg.base && cfg.base.montos) || {}, ov.montos || {});
    for (const t of (cfg.traslados || [])) if (id > t.hasta && aC(montos[t.cat])) { montos[t.a] = mas(montos[t.a], montos[t.cat]); montos[t.cat] = 0; }
    const ingreso = ov.ingreso != null ? +ov.ingreso : +((cfg.base && cfg.base.ingreso) || 0);
    const extras = ov.extras || [];
    const ingMovs = soloBase ? 0 : sumar(movsCiclo(cfg, movs, id).filter(m => clase(m) === 'ingreso'));
    const totalIngreso = mas(ingreso, sumar(extras), ingMovs);
    const grupos = {fijo: 0, moto: 0, ahorro: 0, libre: 0};
    for (const k in montos) { const g = CATS[k] && CATS[k].g; if (g in grupos) grupos[g] = mas(grupos[g], montos[k]); }
    const asignado = mas(grupos.fijo, grupos.moto, grupos.ahorro, grupos.libre);
    return {id, montos, ingreso, extras, ingMovs, totalIngreso, grupos, asignado, colchon: restar(totalIngreso, asignado),
      nota: ov.nota || '', repartir: !!ov.repartirSobrante, propios: ov.montos || {}};
  }

  // Pagos y transferencias programadas del ciclo (obligaciones + aportes a metas)
  function pagos(cfg, movs, id) {
    const p = plan(cfg, movs, id), dia = cfg.diaInicio || 28, r = rangoCiclo(id, dia), dias = cfg.dias || {};
    return Object.keys(p.montos)
      .filter(k => CATS[k] && (CATS[k].g === 'fijo' || CATS[k].g === 'ahorro' || k === 'moto_fondo') && aC(p.montos[k]) > 0)
      .map(k => {
        const esAhorro = CATS[k].g === 'ahorro' || k === 'moto_fondo';
        const dd = esAhorro ? dia : dias[k];
        let fecha = null;
        if (dd) fecha = dd >= r.start.getDate() ? new Date(r.start.getFullYear(), r.start.getMonth(), Math.min(dd, diasMes(r.start.getFullYear(), r.start.getMonth())))
                                              : new Date(r.end.getFullYear(), r.end.getMonth(), Math.min(dd, diasMes(r.end.getFullYear(), r.end.getMonth())));
        const mid = `p-${id}-${k}`;
        return {k, monto: +p.montos[k], fecha, mid, ahorro: esAhorro, hecho: movs.find(m => m.id === mid) || null};
      })
      .sort((a, b) => (a.fecha ? a.fecha.getTime() : 9e15) - (b.fecha ? b.fecha.getTime() : 9e15));
  }

  /* ---------- resumen del ciclo: separa consumo, deudas, ahorro y movimientos neutros ---------- */
  function resumen(cfg, movs, id, hoy) {
    const p = plan(cfg, movs, id), r = rangoCiclo(id, cfg.diaInicio || 28), ms = movsCiclo(cfg, movs, id);
    const por = c => ms.filter(m => clase(m) === c);
    const pagosMs = por('pago');
    const pagoDeuda = sumar(pagosMs.filter(m => CATS[m.cat] && CATS[m.cat].deuda));
    const pagoFijo = restar(sumar(pagosMs), pagoDeuda);
    const consumo = sumar(ms.filter(esConsumo)), libre = sumar(ms.filter(esLibre));
    const ahorro = sumar(por('ahorro'));
    const recibido = hoy && hoy < r.start ? 0 : p.totalIngreso;
    return {
      plan: p, rango: r, movs: ms, consumo, libre, pagoDeuda, pagoFijo, ahorro,
      prestado: sumar(por('prestamo')), devuelto: sumar(por('devolucion')), transferido: sumar(por('transferencia')),
      ingresos: recibido,
      // Balance: lo que entró menos lo que salió de verdad (ahorro y transferencias no son gasto)
      balance: restar(recibido, mas(consumo, sumar(pagosMs))),
      porCategoria: ms.filter(esConsumo).reduce((o, m) => { o[m.cat] = mas(o[m.cat] || 0, m.monto); return o; }, {})
    };
  }

  /* ---------- presupuesto diario dinámico ---------- */
  // limiteReal: plata libre según tus saldos (null si no hay cierre); se usa si es menor que lo que dice el plan
  function presupuestoDiario({p, r, hoy, ms, limiteReal, estricto}) {
    const t = hoy < r.start ? r.start : hoy > r.end ? r.end : hoy, f = ymd(t);
    const totalDias = daysBetween(r.start, r.end) + 1, diasRestantes = daysBetween(t, r.end) + 1;
    const libres = ms.filter(esLibre);
    const gastadoLibre = sumar(libres), gastadoHoy = sumar(libres.filter(m => m.fecha === f));
    const gastadoAntes = restar(gastadoLibre, gastadoHoy);
    const presupuesto = estricto ? sumar(ESENCIALES.filter(k => CATS[k].g === 'libre'), k => p.montos[k]) : p.grupos.libre;
    const gastadoBase = estricto ? sumar(libres.filter(m => ESENCIALES.includes(m.cat) && m.fecha !== f)) : gastadoAntes;
    const segunPlan = restar(presupuesto, gastadoBase); // lo que quedaba al empezar el día
    let limite = segunPlan, fuente = 'plan';
    if (limiteReal != null && aC(limiteReal) < aC(segunPlan)) { limite = limiteReal; fuente = 'saldos'; }
    const base = aC(limite) > 0 ? aS(Math.floor(aC(limite) / diasRestantes)) : 0;
    const puedesHoy = aS(Math.max(0, aC(base) - aC(gastadoHoy)));
    const promedio = totalDias ? aS(Math.floor(aC(p.grupos.libre) / totalDias)) : 0;
    return {totalDias, diasRestantes, gastadoLibre, gastadoHoy, presupuesto, segunPlan, limite, fuente, base, puedesHoy, promedio,
      sinDinero: aC(limite) <= 0, restanteCiclo: restar(presupuesto, gastadoLibre)};
  }

  // Cuánto deberías llevar gastado hasta hoy si gastas parejo
  function ritmo(p, r, hoy) {
    const totalDias = daysBetween(r.start, r.end) + 1;
    const transcurridos = hoy < r.start ? 0 : Math.min(totalDias, daysBetween(r.start, hoy) + 1);
    return {totalDias, transcurridos, esperado: aS(Math.round(aC(p.grupos.libre) * transcurridos / totalDias))};
  }

  /* ---------- semáforo ---------- */
  const UMBRALES = {amarillo: 0.9, rojo: 1.05};
  function semaforo({gastado, esperado, presupuesto, limiteReal, umbrales}) {
    const u = Object.assign({}, UMBRALES, umbrales || {});
    if (limiteReal != null && aC(limiteReal) < 0) return {nivel: 'rojo', titulo: 'Debes controlarte',
      texto: 'Según tus saldos, ya estás usando dinero que tenías reservado para pagos o ahorro. Evita gastos que no sean esenciales hasta tu próximo cobro.'};
    if (aC(presupuesto) <= 0) return {nivel: 'gris', titulo: 'Sin presupuesto', texto: 'Este ciclo no tiene presupuesto para gastos del día a día.'};
    if (aC(gastado) >= aC(presupuesto)) return {nivel: 'rojo', titulo: 'Debes controlarte',
      texto: 'Ya usaste todo el presupuesto de gastos del ciclo. Lo que gastes desde ahora sale de dinero reservado.'};
    const ratio = aC(esperado) > 0 ? aC(gastado) / aC(esperado) : (aC(gastado) > 0 ? 2 : 0);
    if (ratio >= u.rojo) return {nivel: 'rojo', titulo: 'Debes controlarte', ratio,
      texto: 'Estás gastando más rápido de lo previsto. Si sigues así, el presupuesto se te acaba antes del cobro. Limita los gastos variables los próximos días.'};
    if (ratio >= u.amarillo) return {nivel: 'amarillo', titulo: 'Ten cuidado', ratio,
      texto: 'Vas muy cerca del ritmo máximo. Para llegar bien al cobro, evita salidas y compras que no necesites esta semana.'};
    return {nivel: 'verde', titulo: 'Vas bien', ratio, texto: 'Estás gastando por debajo del ritmo previsto. Si sigues así, llegas al cobro con margen.'};
  }

  /* ---------- inversiones: costo promedio ---------- */
  function inversiones(movs, precios) {
    const out = {};
    const ops = movs.filter(m => clase(m) === 'inversion').slice().sort((a, b) => (a.fecha + (a.creado || 0)) < (b.fecha + (b.creado || 0)) ? -1 : 1);
    for (const m of ops) {
      const k = String(m.activo || '?').toUpperCase();
      const a = out[k] || (out[k] = {activo: k, cantidad: 0, costoC: 0, invertidoC: 0, realizadoC: 0, comisionesC: 0, ops: 0});
      const cant = +m.cantidad || 0, totalC = aC(m.monto), feeC = aC(m.comision);
      a.ops++; a.comisionesC += feeC;
      if (m.op === 'venta') {
        if (a.cantidad <= 0) continue;
        const parte = Math.min(1, cant / a.cantidad), costoVendidoC = Math.round(a.costoC * parte);
        a.realizadoC += totalC - feeC - costoVendidoC;
        a.costoC -= costoVendidoC; a.cantidad = Math.max(0, a.cantidad - cant);
      } else {
        a.cantidad += cant; a.costoC += totalC + feeC; a.invertidoC += totalC + feeC;
      }
    }
    return Object.values(out).map(a => {
      const pr = precios && precios[a.activo];
      const valorC = pr && pr.precio != null ? Math.round(a.cantidad * aC(pr.precio)) : null;
      return {activo: a.activo, cantidad: +a.cantidad.toFixed(8), costo: aS(a.costoC), invertido: aS(a.invertidoC), realizado: aS(a.realizadoC),
        comisiones: aS(a.comisionesC), costoPromedio: a.cantidad > 0 ? aS(Math.round(a.costoC / a.cantidad)) : 0,
        valor: valorC == null ? null : aS(valorC), noRealizado: valorC == null ? null : aS(valorC - a.costoC), precioFecha: pr ? pr.fecha : null};
    });
  }

  return {CATS, LIBRES, ESENCIALES, UMBRALES, aC, aS, sumar, restar, mas, pad, ymd, parseD, addDays, daysBetween, diasMes,
    cicloDe, rangoCiclo, moverCiclo, clase, esConsumo, esLibre, movsCiclo, plan, pagos, resumen, presupuestoDiario, ritmo, semaforo, inversiones};
});
