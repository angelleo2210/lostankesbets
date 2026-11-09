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
      if (new Set(gs.map(g => g.line)).size !== gs.length) return 'Solo una selección por mercado del mismo partido';
      const sig = gs.map(g => `${g.market}|${g.outcome}|${g.point}`); if (new Set(sig).size !== sig.length) return 'Selección repetida en el mismo partido';
      // Props: allowed with anything; priced as plain product in Sgp.quote. Score feasibility only for Ganador/Hándicap/Total.
      const scored = gs.filter(g => g.market !== 'props');
      if (scored.some(g => !Object.hasOwn(NAMES, g.market || '') || legOk(g, 0, 0) === null)) return 'Este mercado no admite combinarse con otro del mismo partido';
      if (scored.length < 2) continue;
      const big = Math.max(0, ...scored.map(g => Math.abs(g.point || 0))); if (!(big <= 100)) return 'Umbral fuera de rango para combinar';
      const M = 2 * Math.ceil(Math.max(0, ...scored.map(g => Math.abs(g.point || 0)))) + 6;
      let ok = false;
      for (let h = 0; h <= M && !ok; h++) for (let a = 0; a <= M && !ok; a++) ok = scored.every(g => legOk(g, h, a));
      if (!ok) return `Selecciones contradictorias en ${gs[0].home || 'el mismo partido'} vs ${gs[0].away || ''}: no existe un marcador en que todas puedan cumplirse`.replace(/ vs $/, '');
    }
    return null;
  }
  const SAME_EVENT_NOTE = 'Cuota calculada por LosTankesBets multiplicando las cuotas de cada selección (regla de la app). Incluye selecciones del mismo partido: no es una cuota oficial de Hard Rock ni está ajustada por correlación.';
  const hasSameEvent = legs => { const ev = legs.map(g => g.event).filter(Boolean); return new Set(ev).size !== ev.length; };
  const api = { SAME_EVENT_NOTE, hasSameEvent, NAMES, validate, threshold, label, sameEventError, legOk };
  if (typeof module !== 'undefined') module.exports = api; else root.Markets = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
