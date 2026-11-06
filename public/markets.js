// Shared market validation/labels. Only whole/half thresholds: no split Asian lines.
(function(root) {
  const NAMES = { h2h: 'Ganador', spreads: 'Hándicap', totals: 'Total' };
  function validate(key, options, home, away) {
    if (!Object.hasOwn(NAMES, key)) throw new Error('Mercado inválido');
    if (!Array.isArray(options) || options.length < 2) throw new Error('Faltan opciones');
    for (const o of options) {
      if (!o.label || !Number.isInteger(o.odds) || Math.abs(o.odds) < 100) throw new Error('Cuota u opción inválida');
      if (key !== 'h2h' && (typeof o.point !== 'number' || !Number.isFinite(o.point) || !Number.isInteger(o.point * 2))) throw new Error('Umbral debe ser entero o medio punto');
    }
    const labels = options.map(o => o.label);
    if (new Set(labels).size !== labels.length) throw new Error('Opciones repetidas');
    if (key === 'totals') {
      if (options.length !== 2 || !labels.includes('Over') || !labels.includes('Under') || options[0].point !== options[1].point || options[0].point < 0) throw new Error('Total requiere Over/Under con el mismo umbral');
    } else {
      if (!home || !away || home === away || !labels.includes(home) || !labels.includes(away)) throw new Error('Faltan equipos del evento');
      if (key === 'spreads' && (options.length !== 2 || options[0].point !== -options[1].point)) throw new Error('Hándicap requiere umbrales opuestos');
      if (key === 'h2h' && (options.length > 3 || labels.some(l => ![home,away,'Draw'].includes(l)))) throw new Error('Ganador solo admite equipos y empate ofrecido');
    }
  }
  const threshold = (key, o) => key === 'totals' ? `${o.outcome === 'Over' || o.label === 'Over' ? 'O' : 'U'} ${o.point}` : key === 'spreads' ? `${o.point >= 0 ? '+' : ''}${o.point}` : '';
  const label = (key, o) => `${NAMES[key]} · ${o.label === 'Draw' ? 'Empate' : o.label}${key !== 'h2h' ? ' ' + threshold(key,o) : ''}`;
  const api = { NAMES, validate, threshold, label };
  if (typeof module !== 'undefined') module.exports = api; else root.Markets = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
