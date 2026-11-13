// Shared market validation/labels. Only whole/half thresholds: no split Asian lines.
(function(root) {
  const NAMES = { h2h: 'Ganador', spreads: 'Hándicap', totals: 'Total', props: 'Prop' };
  function validate(key, options, home, away, propTitle) {
    if (!Object.hasOwn(NAMES, key)) throw new Error('Mercado inválido');
    if (!Array.isArray(options) || options.length < 2) throw new Error('Faltan opciones');
    for (const o of options) {
      if (!o.label || !Number.isInteger(o.odds) || Math.abs(o.odds) < 100) throw new Error('Cuota u opción inválida');
      if (key !== 'h2h' && key !== 'props' && (typeof o.point !== 'number' || !Number.isFinite(o.point) || !Number.isInteger(o.point * 2))) throw new Error('Umbral debe ser entero o medio punto');
    }
    const labels = options.map(o => String(o.label).trim());
    if (labels.some(l => !l)) throw new Error('Opción sin nombre');
    if (new Set(labels).size !== labels.length) throw new Error('Opciones repetidas');
    if (key === 'props') {
      if (!String(propTitle || '').trim()) throw new Error('Falta el título del prop');
      if (String(propTitle).trim().length > 120) throw new Error('Título del prop demasiado largo');
      return;
    }
    if (key === 'totals') {
      if (options.length !== 2 || !labels.includes('Over') || !labels.includes('Under') || options[0].point !== options[1].point || options[0].point < 0) throw new Error('Total requiere Over/Under con el mismo umbral');
    } else {
      if (!home || !away || home === away || !labels.includes(home) || !labels.includes(away)) throw new Error('Faltan equipos del evento');
      if (key === 'spreads' && (options.length !== 2 || options[0].point !== -options[1].point)) throw new Error('Hándicap requiere umbrales opuestos');
      if (key === 'h2h' && (options.length > 3 || labels.some(l => ![home,away,'Draw'].includes(l)))) throw new Error('Ganador solo admite equipos y empate ofrecido');
    }
  }
  const threshold = (key, o) => key === 'totals' ? `${o.outcome === 'Over' || o.label === 'Over' ? 'O' : 'U'} ${o.point}` : key === 'spreads' ? `${o.point >= 0 ? '+' : ''}${o.point}` : '';
  const label = (key, o, propTitle) => key === 'props' ? `${String(propTitle || 'Prop').trim()} · ${String(o.label).trim()}` : `${NAMES[key]} · ${o.label === 'Draw' ? 'Empate' : o.label}${key !== 'h2h' ? ' ' + threshold(key,o) : ''}`;
  // Same-event parlay feasibility. leg: {event, line, market, home, away, outcome, point}.
  // Each leg must be able to win or push for some final score h-a (non-negative integers).
  // Thresholds are bounded, so scores up to 2*max|point|+6 cover every feasible case.
  function legOk(g, h, a) {
    const d = h - a;
    if (g.market === 'h2h') return g.outcome === 'Draw' ? d === 0 : g.outcome === g.home ? d > 0 : g.outcome === g.away ? d < 0 : null;
    if (g.market === 'spreads') return g.outcome === g.home ? d + g.point >= 0 : g.outcome === g.away ? -d + g.point >= 0 : null;
    if (g.market === 'totals') return g.outcome === 'Over' ? h + a >= g.point : g.outcome === 'Under' ? h + a <= g.point : null;
    return null;
  }
  function sameEventError(legs) {
    const groups = new Map();
    // Upgraded legacy winner lines keep raw labels (e.g. 'Empate') and no outcome.
    legs = legs.map(g => g.market === 'h2h' && !g.outcome ? { ...g, outcome: g.label === 'Empate' ? 'Draw' : g.label } : g);
    for (const g of legs) if (g.event) { if (!groups.has(g.event)) groups.set(g.event, []); groups.get(g.event).push(g); }
    for (const gs of groups.values()) {
      if (gs.length < 2) continue;
      // Only block two picks from the SAME line/market (e.g. Over+Under of one prop, or both sides of one handicap).
      // Different props share market type 'props' but have distinct line ids — those must be allowed.
      if (new Set(gs.map(g => g.line)).size !== gs.length) return 'Solo una selección por mercado del mismo partido';
    }
    return null;
  }
  const SAME_EVENT_NOTE = 'Cuota calculada por LosTankesBets multiplicando las cuotas de cada selección (regla de la app). Incluye selecciones del mismo partido: no es una cuota oficial de Hard Rock ni está ajustada por correlación.';
  const hasSameEvent = legs => { const ev = legs.map(g => g.event).filter(Boolean); return new Set(ev).size !== ev.length; };
  const BUCKETS = [['soccer', 'Fútbol'], ['mma', 'UFC'], ['hockey', 'NHL'], ['basketball', 'NBA'], ['baseball', 'MLB'], ['locales', 'Locales'], ['other', 'Otros']];
  function eventBucket(l) {
    if (!l || l.kind !== 'real') return 'locales';
    const s = String(l.sport || ''), k = String(l.sport_key || '');
    if (s === 'soccer' || /^soccer_/.test(k)) return 'soccer';
    if (s === 'mma' || /^mma_/.test(k) || /^boxing_/.test(k)) return 'mma';
    if (s === 'hockey' || /^icehockey_/.test(k)) return 'hockey';
    if (s === 'basketball' || /^basketball_/.test(k)) return 'basketball';
    if (s === 'baseball' || /^baseball_/.test(k)) return 'baseball';
    return 'other';
  }
  function eventBucketLabel(id) { return (BUCKETS.find(([k]) => k === id) || [id, 'Otros'])[1]; }
  function startMs(l) {
    if (!l || l.starts == null || l.starts === '') return null;
    const n = Date.parse(l.starts);
    return Number.isFinite(n) ? n : null;
  }
  function startRank(l, now) {
    const t = startMs(l);
    if (t == null) return 2;
    const started = !!(l && (l.started || t <= now || (l.status && l.status !== 'open')));
    return started ? 1 : 0;
  }
  function compareByStart(a, b, now) {
    now = now == null ? Date.now() : now;
    const ra = startRank(a, now), rb = startRank(b, now);
    if (ra !== rb) return ra - rb;
    const ta = startMs(a), tb = startMs(b);
    if (ta == null && tb == null) return (a && a.id || 0) - (b && b.id || 0);
    return (ta - tb) || ((a && a.id || 0) - (b && b.id || 0));
  }
  function groupStartMeta(group, now) {
    now = now == null ? Date.now() : now;
    const rows = group || [];
    const base = rows.find(l => l.home) || rows[0] || {};
    const timed = rows.find(l => startMs(l) != null) || base;
    const upcoming = rows.some(l => {
      const t = startMs(l);
      return t != null && t > now && !l.started && (!l.status || l.status === 'open');
    });
    const started = !upcoming && rows.some(l => l.started || (startMs(l) != null && startMs(l) <= now) || (l.status && l.status !== 'open'));
    let id = 0;
    for (const l of rows) { const n = Number(l.id); if (Number.isFinite(n) && (id === 0 || n < id)) id = n; }
    return { starts: timed.starts || null, started, status: upcoming ? 'open' : (started ? 'closed' : base.status), id };
  }
  function sortLinesByStart(ls, now) {
    return (ls || []).slice().sort((a, b) => compareByStart(a, b, now));
  }
  function sortGroupsByStart(groups, now) {
    now = now == null ? Date.now() : now;
    return (groups || []).slice().sort((a, b) => compareByStart(groupStartMeta(a, now), groupStartMeta(b, now), now));
  }
  // Admin settlement: earliest start first (already started before upcoming); no start time last.
  function compareBySoonestStart(a, b) {
    const ta = startMs(a), tb = startMs(b);
    if (ta == null && tb == null) return ((a && a.id) || 0) - ((b && b.id) || 0);
    if (ta == null) return 1;
    if (tb == null) return -1;
    return (ta - tb) || ((a && a.id) || 0) - ((b && b.id) || 0);
  }
  function sortGroupsBySoonestStart(groups, now) {
    now = now == null ? Date.now() : now;
    return (groups || []).slice().sort((a, b) => compareBySoonestStart(groupStartMeta(a, now), groupStartMeta(b, now)));
  }
  const api = { SAME_EVENT_NOTE, hasSameEvent, NAMES, validate, threshold, label, sameEventError, legOk, BUCKETS, eventBucket, eventBucketLabel, startMs, compareByStart, sortLinesByStart, sortGroupsByStart, compareBySoonestStart, sortGroupsBySoonestStart };
  if (typeof module !== 'undefined') module.exports = api; else root.Markets = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
