// LosTankesBets own same-match joint pricing model, version 'poisson-v4' (saved v1/v2/v3 tickets keep their frozen price).
// ASSUMPTION (not proven): home and away goals are independent Poisson variables. Rates are fitted
// to the event's own odds: Total plus Ganador (with or without draw) and/or Hándicap. The joint price
// is the model's FAIR probability of all picks winning (no added margin); it is NOT a Hard Rock price.
// Same-match combos only allow half-goal handicap/total lines (no push possible) in this version.
(function (root) {
  const VERSION = 'poisson-v4', MAXG = 20, MAX_RMSE = 0.02, MAX_ERR = 0.035, MIN_P = 0.001;
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
  // targets: [{type, legs, p}], all de-vigged proportionally. Ganador with draw = 3-way (level score is a draw).
  // Ganador WITHOUT draw: hockey/baseball/unspecified sport = winner always decided (see cells/tb, NHL-style: OT/shootout
  // winner credited +1 goal in the final score; 50/50 on level scores is a model assumption). Soccer = draws still
  // possible (overround approach below). No draw price is ever created.
  // Hándicap/Total compared conditional on no push. Needs Total (sum) + Ganador or Hándicap (difference).
  function targets(lines) {
    const t = [], ml = [], two = []; let hasTot = false, hasDiff = false, tb = false;
    const sport = (lines.find(l => l.sport) || {}).sport || null;
    for (const l of lines) {
      const os = (l.options || []).filter(o => Number.isFinite(o.odds) && Math.abs(o.odds) >= 100);
      if (!os.length || !['h2h', 'spreads', 'totals'].includes(l.market)) continue;
      const inv = os.map(o => 1 / dec(o.odds)), s = inv.reduce((x, y) => x + y, 0);
      if (l.market === 'h2h') {
        const hasDraw = os.some(o => outcomeOf('h2h', o) === 'Draw');
        const leg = o => [{ market: 'h2h', outcome: outcomeOf('h2h', o), home: l.home, away: l.away }];
        if (os.length === 3 && hasDraw) { hasDiff = true; os.forEach((o, i) => t.push({ type: 1, legs: leg(o), p: inv[i] / s })); }
        else if (!hasDraw && os.length === 2 && sport === 'soccer') { hasDiff = true; os.forEach((o, i) => ml.push({ legs: leg(o), raw: inv[i] })); } // soccer, draw odds not entered: draws still possible
        else if (!hasDraw && os.length === 2) { hasDiff = true; tb = true; os.forEach((o, i) => t.push({ type: 1, legs: leg(o), p: inv[i] / s })); }
      } else { if (os.length !== 2) continue; if (l.market === 'totals') hasTot = true; else hasDiff = true; two.push(s);
        const legs = os.map(o => ({ market: l.market, outcome: outcomeOf(l.market, o), point: o.point, home: l.home, away: l.away }));
        t.push({ type: 2, legs, p: inv[0] / s }); }
    }
    // Soccer 2-way without draw: each side's implied prob divided by the event's average 2-way overround (OWN ASSUMPTION).
    const ovr = two.length ? two.reduce((x, y) => x + y, 0) / two.length : 1;
    for (const m of ml) t.push({ type: 1, legs: m.legs, p: Math.min(0.999, m.raw / ovr) });
    // Hockey/baseball: final score always has a winner (OT/shootout/extra innings) -> tie-break states for every market.
    if (sport === 'hockey' || sport === 'baseball') tb = true; if (sport === 'soccer') tb = false;
    return { t, ok: hasTot && hasDiff, tb };
  }
  // Final-score states. tb (2-way Ganador without draw = winner decided even if level): a level score is
  // settled by one extra goal/run/point to either side with probability 1/2 each (OT/extra-innings style,
  // counted in the final score for Total/Hándicap too). OWN ASSUMPTION.
  function cells(m, tb) { const c = [];
    for (let h = 0; h <= MAXG; h++) for (let a = 0; a <= MAXG; a++) { const p = m[h][a]; if (!p) continue;
      if (tb && h === a) { c.push([h + 1, a, p / 2]); c.push([h, a + 1, p / 2]); } else c.push([h, a, p]); }
    return c; }
  function modelP(c, tg) {
    let w = 0, x = 0;
    for (const [h, a, p] of c) {
      const g = tg.legs.map(L => margin(L.market, L.outcome, L.point, L.home, L.away, h, a));
      if (tg.type === 1) { if (g[0] > 0) w += p; } else { if (g[0] > 0) w += p; if (g[1] > 0) x += p; }
    }
    return tg.type === 1 ? w : w / (w + x);
  }
  function loss(lh, la, t, tb) { const m = cells(matrix(lh, la), tb); let se = 0, mx = 0; for (const tg of t) { const e = Math.abs(modelP(m, tg) - tg.p); se += e * e; mx = Math.max(mx, e); } return { rmse: Math.sqrt(se / t.length), max: mx }; }
  const fitCache = new Map();
  function fit(lines) {
    const key = JSON.stringify(lines.map(l => [l.market, l.sport, l.home, l.away, (l.options || []).map(o => [o.outcome, o.label, o.point, o.odds])]));
    if (!fitCache.has(key)) { if (fitCache.size > 200) fitCache.clear(); fitCache.set(key, fitRaw(lines)); }
    return fitCache.get(key);
  }
  function fitRaw(lines) {
    const { t, ok, tb } = targets(lines);
    if (!ok) return { error: 'Para combinar selecciones del mismo partido necesitamos la cuota de Total de goles y además la de Ganador o la de Hándicap de ese partido. Este partido no las tiene, así que no se puede calcular una cuota conjunta.' };
    let best = null;
    const tryAt = (lh, la) => { if (lh < 0.05 || la < 0.05 || lh > 6 || la > 6) return; const r = loss(lh, la, t, tb); if (!best || r.rmse < best.rmse - 1e-12) best = { lh, la, ...r }; };
    for (let lh = 0.1; lh <= 6.0001; lh += 0.1) for (let la = 0.1; la <= 6.0001; la += 0.1) tryAt(+lh.toFixed(3), +la.toFixed(3));
    for (const step of [0.02, 0.005, 0.001]) { const c = best; for (let i = -5; i <= 5; i++) for (let j = -5; j <= 5; j++) tryAt(+(c.lh + i * step).toFixed(4), +(c.la + j * step).toFixed(4)); }
    if (best.rmse > MAX_RMSE || best.max > MAX_ERR) return { error: `Las cuotas de este partido no encajan bien con nuestro modelo de goles (desvío de hasta ${(best.max * 100).toFixed(1)} puntos de probabilidad), así que no calculamos una cuota conjunta. Puedes apostarlas por separado o combinarlas con otros partidos.`, fit: best };
    return { lh: best.lh, la: best.la, rmse: best.rmse, max: best.max, tb };
  }
  function jointP(f, legs) {
    let p = 0;
    for (const [h, a, q] of cells(matrix(f.lh, f.la), f.tb)) if (legs.every(L => margin(L.market, L.outcome, L.point, L.home, L.away, h, a) > 0)) p += q;
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
      // Any same-match group that includes props: plain product of American odds (no Poisson SGP).
      if (gs.some(g => g.market === 'props')) {
        let d = 1; for (const g of gs) d *= dec(g.odds); total *= d;
        out.push({ options: gs.map(g => g.option), dec: d, model: null }); continue;
      }
      const L = gs.map(g => ({ ...g, outcome: outcomeOf(g.market, g) }));
      const product = () => { let d = 1; for (const g of gs) d *= dec(g.odds); return d; };
      // Prefer SGP model for Ganador/Hándicap/Total; if it cannot price (e.g. high baseball totals), use plain product — never block.
      if (L.some(g => g.market !== 'h2h' && !Number.isInteger(g.point - 0.5))) {
        const d = product(); total *= d; out.push({ options: gs.map(g => g.option), dec: d, model: null }); continue;
      }
      const f = fit(eventLines[k] || []);
      if (f.error) { const d = product(); total *= d; out.push({ options: gs.map(g => g.option), dec: d, model: null }); continue; }
      const p = jointP(f, L);
      if (p === 0 || !(p >= MIN_P)) { const d = product(); total *= d; out.push({ options: gs.map(g => g.option), dec: d, model: null }); continue; }
      const d = 1 / p; total *= d;
      out.push({ options: gs.map(g => g.option), dec: d, model: { version: VERSION, lh: f.lh, la: f.la, p, rmse: f.rmse } });
    }
    return { dec: total, groups: out, modeled: out.some(g => g.model) };
  }
  const NOTE = 'Cuota del mismo partido calculada por el modelo propio de LosTankesBets (goles de cada equipo como Poisson independientes, ajustado a las cuotas de Total y Ganador/Hándicap de ese partido, sin margen). Es una estimación: no es una cuota oficial de Hard Rock. Si se anula una selección de ese partido, ese grupo se devuelve (cuenta como cuota 1.00).';
  const api = { VERSION, NOTE, margin, matrix, fit, jointP, quote, dec, MAXG };
  if (typeof module !== 'undefined') { var Markets = require('./markets'); module.exports = api; } else { var Markets = root.Markets; root.Sgp = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this);
