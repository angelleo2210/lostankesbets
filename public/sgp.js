// LosTankesBets own same-match (soccer) joint pricing model, version 'poisson-v1'.
// ASSUMPTION (not proven): home and away goals are independent Poisson variables. Rates are fitted
// to the event's own de-vigged Ganador (3-way) + Total (+ Hándicap if present) odds. The joint price
// is the model's FAIR probability of all picks winning (no added margin); it is NOT a Hard Rock price.
// Same-match combos only allow half-goal handicap/total lines (no push possible) in this version.
(function (root) {
  const VERSION = 'poisson-v1', MAXG = 20, MAX_RMSE = 0.02, MAX_ERR = 0.035, MIN_P = 0.001;
  const dec = o => o > 0 ? 1 + o / 100 : 1 + 100 / -o;
  const outcomeOf = (market, o) => o.outcome || (market === 'h2h' && (o.label === 'Empate' || o.label === 'Draw') ? 'Draw' : o.label);
  // >0 win, 0 push, <0 loss for final score h-a.
  function margin(market, outcome, point, home, away, h, a) {
    const d = h - a;
    if (market === 'h2h') return outcome === 'Draw' ? (d === 0 ? 1 : -1) : outcome === home ? (d > 0 ? 1 : -1) : outcome === away ? (d < 0 ? 1 : -1) : NaN;
    if (market === 'spreads') return outcome === home ? d + point : outcome === away ? -d + point : NaN;
    if (market === 'totals') return outcome === 'Over' ? h + a - point : outcome === 'Under' ? point - h - a : NaN;
    return NaN;
  }
  function pois(l) { const v = [Math.exp(-l)]; for (let k = 1; k <= MAXG; k++) v.push(v[k - 1] * l / k); return v; }
  function matrix(lh, la) {
    const ph = pois(lh), pa = pois(la); let s = 0; const m = [];
    for (let h = 0; h <= MAXG; h++) { m.push([]); for (let a = 0; a <= MAXG; a++) { m[h].push(ph[h] * pa[a]); s += ph[h] * pa[a]; } }
    for (const r of m) for (let a = 0; a <= MAXG; a++) r[a] /= s; // renormalise truncated tail (<1e-6 for rates <= 6)
    return m;
  }
  // targets: [{fn:(h,a)=>margin, devig prob}] ; for 2-way markets compare conditional on no push.
  function targets(lines) {
    const t = []; let has3 = false, hasTot = false;
    for (const l of lines) {
      const os = (l.options || []).filter(o => Number.isFinite(o.odds) && Math.abs(o.odds) >= 100);
      if (!os.length || !['h2h', 'spreads', 'totals'].includes(l.market)) continue;
      const inv = os.map(o => 1 / dec(o.odds)), s = inv.reduce((x, y) => x + y, 0);
      if (l.market === 'h2h') { if (os.length !== 3) continue; has3 = true; os.forEach((o, i) => t.push({ type: 1, legs: [{ market: 'h2h', outcome: outcomeOf('h2h', o), home: l.home, away: l.away }], p: inv[i] / s })); }
      else { if (os.length !== 2) continue; if (l.market === 'totals') hasTot = true;
        const legs = os.map(o => ({ market: l.market, outcome: outcomeOf(l.market, o), point: o.point, home: l.home, away: l.away }));
        t.push({ type: 2, legs, p: inv[0] / s }); }
    }
    return { t, ok: has3 && hasTot };
  }
  function modelP(m, tg) {
    let w = 0, x = 0;
    for (let h = 0; h <= MAXG; h++) for (let a = 0; a <= MAXG; a++) {
      const g = tg.legs.map(L => margin(L.market, L.outcome, L.point, L.home, L.away, h, a));
      if (tg.type === 1) { if (g[0] > 0) w += m[h][a]; } else { if (g[0] > 0) w += m[h][a]; if (g[1] > 0) x += m[h][a]; }
    }
    return tg.type === 1 ? w : w / (w + x);
  }
  function loss(lh, la, t) { const m = matrix(lh, la); let se = 0, mx = 0; for (const tg of t) { const e = Math.abs(modelP(m, tg) - tg.p); se += e * e; mx = Math.max(mx, e); } return { rmse: Math.sqrt(se / t.length), max: mx }; }
  const fitCache = new Map();
  function fit(lines) {
    const key = JSON.stringify(lines.map(l => [l.market, l.home, l.away, (l.options || []).map(o => [o.outcome, o.label, o.point, o.odds])]));
    if (!fitCache.has(key)) { if (fitCache.size > 200) fitCache.clear(); fitCache.set(key, fitRaw(lines)); }
    return fitCache.get(key);
  }
  function fitRaw(lines) {
    const { t, ok } = targets(lines);
    if (!ok) return { error: 'Para combinar selecciones del mismo partido necesitamos las cuotas de Ganador con empate (3 opciones) y de Total de goles de ese partido. Este partido no las tiene, así que no se puede calcular una cuota conjunta.' };
    let best = null;
    const tryAt = (lh, la) => { if (lh < 0.05 || la < 0.05 || lh > 6 || la > 6) return; const r = loss(lh, la, t); if (!best || r.rmse < best.rmse - 1e-12) best = { lh, la, ...r }; };
    for (let lh = 0.1; lh <= 6.0001; lh += 0.1) for (let la = 0.1; la <= 6.0001; la += 0.1) tryAt(+lh.toFixed(3), +la.toFixed(3));
    for (const step of [0.02, 0.005, 0.001]) { const c = best; for (let i = -5; i <= 5; i++) for (let j = -5; j <= 5; j++) tryAt(+(c.lh + i * step).toFixed(4), +(c.la + j * step).toFixed(4)); }
    if (best.rmse > MAX_RMSE || best.max > MAX_ERR) return { error: `Las cuotas de este partido no encajan bien con nuestro modelo de goles (desvío de hasta ${(best.max * 100).toFixed(1)} puntos de probabilidad), así que no calculamos una cuota conjunta. Puedes apostarlas por separado o combinarlas con otros partidos.`, fit: best };
    return { lh: best.lh, la: best.la, rmse: best.rmse, max: best.max };
  }
  function jointP(f, legs) {
    const m = matrix(f.lh, f.la); let p = 0;
    for (let h = 0; h <= MAXG; h++) for (let a = 0; a <= MAXG; a++) if (legs.every(L => margin(L.market, L.outcome, L.point, L.home, L.away, h, a) > 0)) p += m[h][a];
    return p;
  }
  // legs: [{option, line, event, market, home, away, outcome, label, point, odds}], eventLines: {event: [lines with options]}
  function quote(legs, eventLines) {
    const err = Markets.sameEventError(legs); if (err) return { error: err };
    const groups = new Map();
    legs.forEach(g => { const k = g.event || 'line:' + g.line; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(g); });
    let total = 1; const out = [];
    for (const [k, gs] of groups) {
      if (gs.length === 1) { const d = dec(gs[0].odds); total *= d; out.push({ options: [gs[0].option], dec: d, model: null }); continue; }
      const L = gs.map(g => ({ ...g, outcome: outcomeOf(g.market, g) }));
      if (L.some(g => g.market !== 'h2h' && !Number.isInteger(g.point - 0.5))) return { error: 'Por ahora, las combinaciones del mismo partido solo admiten Hándicap y Total de medio punto (por ejemplo 2.5), para que no haya devoluciones parciales (push). Las apuestas simples y los parlays con partidos distintos no cambian.' };
      const f = fit(eventLines[k] || []); if (f.error) return { error: f.error };
      const p = jointP(f, L); if (!(p >= MIN_P)) return { error: 'La probabilidad estimada de esta combinación es demasiado baja para ofrecer cuota.' };
      const d = 1 / p; total *= d;
      out.push({ options: gs.map(g => g.option), dec: d, model: { version: VERSION, lh: f.lh, la: f.la, p, rmse: f.rmse } });
    }
    return { dec: total, groups: out, modeled: out.some(g => g.model) };
  }
  const NOTE = 'Cuota del mismo partido calculada por el modelo propio de LosTankesBets (goles de cada equipo como Poisson independientes, ajustado a las cuotas de ese partido, sin margen). Es una estimación: no es una cuota oficial de Hard Rock. Si se anula una selección de ese partido, ese grupo se devuelve (cuenta como cuota 1.00).';
  const api = { VERSION, NOTE, margin, matrix, fit, jointP, quote, dec, MAXG };
  if (typeof module !== 'undefined') { var Markets = require('./markets'); module.exports = api; } else { var Markets = root.Markets; root.Sgp = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this);
