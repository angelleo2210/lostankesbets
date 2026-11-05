// Catálogo de la Tienda: solo cosméticos, sin marcas reales. Extiende ITEMS para agregar más.
(function (root) {
  const COLORS = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#14b8a6', '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#f8fafc', '#64748b', '#111827'];
  const CATS = [['carros', '🏎️ Carros'], ['motos', '🏍️ Motos'], ['yates', '🛥️ Yates'], ['jetskis', '🌊 Jet skis'], ['relojes', '⌚ Relojes'], ['mansiones', '🏰 Mansiones'], ['aviones', '✈️ Aviones']];
  const it = (id, cat, name, price, color) => ({ id, cat, name, price, color });
  const ITEMS = [
    it('car_deportivo', 'carros', 'Deportivo Rojo', 200000, '#ef4444'), it('car_gt', 'carros', 'Gran Turismo Azul', 500000, '#1d4ed8'), it('car_super', 'carros', 'Superdeportivo L', 600000, '#facc15'), it('car_hiper', 'carros', 'Hiperauto Galáctico', 1000000, '#a855f7'),
    it('moto_scooter', 'motos', 'Scooter Playero', 20000, '#14b8a6'), it('moto_naked', 'motos', 'Moto Callejera', 30000, '#f97316'), it('moto_pista', 'motos', 'Moto de Pista', 40000, '#22c55e'),
    it('yate_lancha', 'yates', 'Lancha Rápida', 700000, '#ef4444'), it('yate_velero', 'yates', 'Velero Clásico', 800000, '#1d4ed8'), it('yate_catamaran', 'yates', 'Catamarán Turquesa', 900000, '#14b8a6'), it('yate_blanco', 'yates', 'Yate Blanco', 1000000, '#f8fafc'), it('yate_mega', 'yates', 'Megayate Dorado', 1500000, '#facc15'),
    it('jet_basico', 'jetskis', 'Jet Ski Básico', 12000, '#3b82f6'), it('jet_turbo', 'jetskis', 'Jet Ski Turbo', 13500, '#ec4899'), it('jet_pro', 'jetskis', 'Jet Ski Pro', 15000, '#111827'),
    it('reloj_plata', 'relojes', 'Reloj de Plata', 75000, '#64748b'), it('reloj_oro', 'relojes', 'Reloj de Oro', 350000, '#111827'), it('reloj_diamante', 'relojes', 'Reloj de Diamantes', 1000000, '#0e7490'),
    it('casa_playa', 'mansiones', 'Casa de Playa', 700000, '#f97316'), it('casa_mansion', 'mansiones', 'Mansión en la Colina', 1400000, '#f8fafc'), it('casa_castillo', 'mansiones', 'Castillo Privado', 1900000, '#64748b'),
    it('avion_avioneta', 'aviones', 'Avioneta', 400000, '#f97316'), it('avion_jet', 'aviones', 'Jet privado', 2000000, '#f8fafc')
  ];
  const HEX = /^#[0-9a-fA-F]{6}$/;
  const byId = id => ITEMS.find(i => i.id === id);
  // --- Arte vectorial premium: degradados derivados del color elegido, IDs únicos por instancia ---
  let seq = 0;
  const mix = (hex, t) => { const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255], to = t > 0 ? 255 : 0, a = Math.abs(t);
    return '#' + c.map(v => Math.round(v + (to - v) * a).toString(16).padStart(2, '0')).join(''); };
  const BG = { carros: ['#1e293b', '#0f172a', '#334155'], motos: ['#27272a', '#09090b', '#3f3f46'], yates: ['#7dd3fc', '#e0f2fe', '#0369a1'], jetskis: ['#38bdf8', '#e0f2fe', '#0284c7'],
    relojes: ['#292524', '#0c0a09', '#44403c'], mansiones: ['#93c5fd', '#fde68a', '#16a34a'], aviones: ['#60a5fa', '#dbeafe', '#93c5fd'] };
  const svg = (cat, c, body) => { const u = 'st' + (++seq) + '_', g = id => `url(#${u}${id})`, [b1, b2, b3] = BG[cat];
    const lin = (id, stops, x2 = 0, y2 = 1) => `<linearGradient id="${u}${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map(([o, s]) => `<stop offset="${o}" stop-color="${s}"/>`).join('')}</linearGradient>`;
    const defs = `<defs>${lin('body', [[0, mix(c, .55)], [.35, mix(c, .12)], [.7, c], [1, mix(c, -.55)]])}${lin('bodyh', [[0, mix(c, -.35)], [.5, mix(c, .25)], [1, mix(c, -.45)]], 1, 0)}
${lin('glass', [[0, '#e0f2fe'], [.45, '#7dd3fc'], [1, '#0c4a6e']])}${lin('chrome', [[0, '#f8fafc'], [.45, '#94a3b8'], [.55, '#e2e8f0'], [1, '#475569']])}${lin('gold', [[0, '#fef3c7'], [.4, '#fbbf24'], [.6, '#fde68a'], [1, '#b45309']])}
${lin('bg', [[0, b1], [1, b2]])}${lin('sea', [[0, '#38bdf8'], [1, '#075985']])}${lin('shine', [[0, '#fff'], [1, '#fff0']])}
<radialGradient id="${u}spot" cx=".5" cy=".35" r=".7"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
<radialGradient id="${u}shadow"><stop offset="0" stop-color="#000" stop-opacity=".55"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
<radialGradient id="${u}tire" cx=".5" cy=".5" r=".5"><stop offset=".6" stop-color="#27272a"/><stop offset="1" stop-color="#09090b"/></radialGradient></defs>`;
    return `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg">${defs}<rect width="160" height="100" rx="10" fill="${g('bg')}"/><rect width="160" height="100" rx="10" fill="${g('spot')}"/>${body(g, b3)}</svg>`; };
  const wheel = (g, x, y, r = 11) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${g('tire')}"/><circle cx="${x}" cy="${y}" r="${r * .62}" fill="${g('chrome')}" stroke="#334155" stroke-width=".8"/>${[0, 72, 144, 216, 288].map(a => `<path d="M${x} ${y} L${x + r * .58 * Math.cos(a * Math.PI / 180)} ${y + r * .58 * Math.sin(a * Math.PI / 180)}" stroke="#475569" stroke-width="${r * .16}" stroke-linecap="round"/>`).join('')}<circle cx="${x}" cy="${y}" r="${r * .18}" fill="#1e293b"/><circle cx="${x}" cy="${y}" r="${r * .09}" fill="${g('gold')}"/>`;
  const floor = (g, y = 84) => `<rect y="${y}" width="160" height="${100 - y}" fill="#000" opacity=".25"/><path d="M0 ${y} H160" stroke="#fff3"/>`;
  const shadow = (g, x, y, rx, ry = 4) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${g('shadow')}"/>`;
  const sea = (g, y = 70) => `<path d="M0 ${y} Q20 ${y - 4} 40 ${y} T80 ${y} T120 ${y} T160 ${y} V100 H0Z" fill="${g('sea')}"/><path d="M8 ${y + 10} h18 M60 ${y + 16} h24 M112 ${y + 9} h20" stroke="#fff8" stroke-width="1.5" stroke-linecap="round"/>`;
  const wake = (x, y) => `<path d="M${x} ${y} q-14 -2 -26 4 q12 0 26 2z" fill="#fff" opacity=".8"/>`;
  const S = 'stroke="#0007" stroke-width="1.1"';
  const car = (g, v) => { const spoiler = v !== 'car_deportivo', low = v === 'car_hiper' ? 3 : 0;
    return floor(g) + shadow(g, 80, 85, 66, 5) +
      `<path d="M10 ${74 - low} Q8 ${62 - low} 24 ${58 - low} L52 ${50 - low} Q62 ${36 - low * 2} 84 ${36 - low * 2} Q104 ${37 - low} 116 ${52 - low} L140 ${58 - low} Q152 ${62 - low} 150 ${74 - low} Q148 80 138 80 H22 Q12 80 10 ${74 - low}Z" fill="${g('body')}" ${S}/>` +
      `<path d="M58 ${50 - low} Q66 ${40 - low * 2} 84 ${40 - low * 2} Q100 ${41 - low} 110 ${51 - low}Z" fill="${g('glass')}" stroke="#0f172a" stroke-width="1"/><path d="M84 ${40 - low * 2} V${51 - low}" stroke="#0f172a" stroke-width="2"/>` +
      `<path d="M64 ${48 - low} Q70 ${43 - low * 2} 80 ${42 - low * 2}" stroke="#fff" stroke-opacity=".8" stroke-width="2" fill="none" stroke-linecap="round"/>` +
      `<path d="M22 ${62 - low} Q80 ${54 - low} 140 ${62 - low}" stroke="#fff" stroke-opacity=".45" stroke-width="2.5" fill="none"/><path d="M28 71 H132" stroke="${g('chrome')}" stroke-width="1.6"/>` +
      (v === 'car_gt' ? `<path d="M30 ${60 - low} L130 ${60 - low}" stroke="#fff" stroke-width="4" opacity=".7"/>` : '') +
      (spoiler ? `<path d="M28 ${57 - low} L10 ${47 - low} H4 L12 ${60 - low}Z" fill="${g('bodyh')}" ${S}/><path d="M8 ${48 - low} V${56 - low}" stroke="${g('chrome')}" stroke-width="2"/>` : '') +
      `<ellipse cx="146" cy="${66 - low}" rx="4" ry="2.5" fill="#fef9c3"/><ellipse cx="13" cy="${67 - low}" rx="3" ry="2" fill="#ef4444"/>` +
      `<circle cx="80" cy="${64 - low}" r="6" fill="${g('chrome')}"/><text x="80" y="${67.2 - low}" font-family="Arial Black,Arial" font-size="8" text-anchor="middle" font-weight="900" fill="#1e293b">L</text>` +
      wheel(g, 40, 78) + wheel(g, 122, 78); };
  const moto = (g, v) => floor(g) + shadow(g, 80, 86, 56, 4) + wheel(g, 38, 74, 15) + wheel(g, 124, 74, 15) +
    `<path d="M38 74 L66 52 M124 74 L108 44" stroke="${g('chrome')}" stroke-width="4" stroke-linecap="round"/><rect x="62" y="56" width="30" height="16" rx="4" fill="#334155" stroke="#0f172a"/><path d="M64 60 h26 M64 64 h26 M64 68 h26" stroke="#64748b"/>` +
    (v === 'moto_scooter' ? `<path d="M50 70 Q48 56 66 54 H96 Q104 54 104 64 L114 44 L120 46 L112 70Z" fill="${g('body')}" ${S}/><path d="M56 52 Q66 46 84 50 L82 54 H58Z" fill="#1f2937"/>`
      : `<path d="M54 52 Q64 34 96 38 L112 42 L108 52 Q90 50 76 56 L58 58Z" fill="${g('body')}" ${S}/><path d="M50 50 Q58 44 70 46 L64 52Z" fill="#111827"/>` + (v === 'moto_pista' ? `<path d="M100 32 Q120 30 130 48 L114 54 Q110 40 98 40Z" fill="${g('body')}" ${S}/><path d="M104 34 Q116 34 122 42" stroke="${g('glass')}" stroke-width="4" fill="none"/>` : '')) +
    `<path d="M62 44 Q80 38 100 42" stroke="#fff" stroke-opacity=".7" stroke-width="2" fill="none"/><path d="M112 42 L122 34 L128 34" stroke="#111" stroke-width="3" stroke-linecap="round"/><path d="M58 70 L30 72" stroke="${g('chrome')}" stroke-width="5" stroke-linecap="round"/>`;
  const yate = (g, v) => { const hull = (d) => `<path d="${d}" fill="${g('body')}" ${S}/>`;
    const base = sea(g, 72) + shadow(g, 80, 76, 64, 3);
    if (v === 'yate_velero') return base + hull('M18 66 H142 L128 80 H34Z') + `<path d="M18 70 H142" stroke="${g('gold')}" stroke-width="1.5"/><path d="M80 64 V8" stroke="${g('chrome')}" stroke-width="2.5"/><path d="M82 10 Q118 34 124 62 H82Z" fill="#f8fafc" stroke="#cbd5e1"/><path d="M82 10 Q100 30 104 62" stroke="#e2e8f0" fill="none"/><path d="M78 16 Q56 38 46 62 H78Z" fill="#fef3c7" stroke="#e5e7eb"/><path d="M80 8 L92 12 L80 15Z" fill="#ef4444"/>` + wake(18, 76);
    if (v === 'yate_catamaran') return base + hull('M12 66 H70 L62 78 H22Z') + hull('M90 66 H148 L138 78 H98Z') + `<rect x="20" y="52" width="120" height="14" rx="4" fill="${g('body')}" ${S}/><path d="M44 52 L54 38 H104 L118 52Z" fill="#f8fafc" stroke="#0005"/><path d="M56 41 H102 L110 50 H50Z" fill="${g('glass')}"/><path d="M24 58 H136" stroke="#fff9" stroke-width="2"/>` + wake(12, 76) + wake(90, 76);
    if (v === 'yate_lancha') return base + hull('M8 62 H140 Q150 62 152 58 L148 70 Q132 80 100 80 H26Z') + `<path d="M58 62 L72 46 H98 L104 62Z" fill="${g('glass')}" stroke="#0f172a"/><path d="M12 68 H146" stroke="#fff" stroke-width="2.5" opacity=".85"/><path d="M14 72 H140" stroke="${g('chrome')}" stroke-width="1.2"/>` + wake(8, 76);
    const mega = v === 'yate_mega';
    return base + hull('M6 60 H150 Q156 60 156 56 L148 72 Q130 82 100 82 H30Z') + `<path d="M8 66 H150" stroke="${g(mega ? 'gold' : 'chrome')}" stroke-width="2"/>` +
      `<path d="M28 60 V46 H122 L136 60Z" fill="#f8fafc" stroke="#0005"/><path d="M34 50 H120 L128 57 H34Z" fill="${g('glass')}"/>` +
      `<path d="M48 46 V34 H108 L116 46Z" fill="#f1f5f9" stroke="#0005"/><path d="M54 37 H104 L110 43 H54Z" fill="${g('glass')}"/>` +
      (mega ? `<path d="M64 34 V24 H98 L102 34Z" fill="${g('gold')}" stroke="#92400e"/><path d="M80 24 V12" stroke="${g('chrome')}" stroke-width="2"/><circle cx="80" cy="12" r="3" fill="${g('gold')}"/>` : `<path d="M80 34 V22" stroke="${g('chrome')}" stroke-width="2"/>`) + wake(6, 78); };
  const jetski = (g, v) => sea(g, 70) + shadow(g, 80, 74, 52, 3) +
    `<path d="M20 64 Q26 50 62 50 L94 34 L108 38 L104 50 Q136 50 144 62 L136 72 H30Z" fill="${g('body')}" ${S}/><path d="M28 60 Q80 54 140 60" stroke="#fff" stroke-width="2.5" opacity=".7" fill="none"/>` +
    `<path d="M56 50 Q70 44 86 48 L82 54 H58Z" fill="#111827"/><path d="M94 34 L88 22 M84 22 H96" stroke="${g('chrome')}" stroke-width="3" stroke-linecap="round"/>` +
    (v !== 'jet_basico' ? `<path d="M30 66 H136" stroke="${g(v === 'jet_pro' ? 'gold' : 'chrome')}" stroke-width="2"/>` : '') + (v === 'jet_pro' ? `<path d="M100 40 L116 34 L110 46Z" fill="${g('glass')}"/>` : '') + wake(20, 72) + `<path d="M140 64 q10 -6 16 -2" stroke="#fff" stroke-width="2" fill="none"/>`;
  const reloj = (g, v) => { const metal = v === 'reloj_oro' ? 'gold' : 'chrome';
    return shadow(g, 80, 90, 34, 4) + `<rect x="64" y="2" width="32" height="96" rx="8" fill="${g('bodyh')}" ${S}/>${[12, 20, 78, 86].map(y => `<path d="M66 ${y} H94" stroke="#0004"/>`).join('')}` +
      `<circle cx="80" cy="50" r="32" fill="${g(metal)}" stroke="#0006"/><circle cx="80" cy="50" r="26" fill="${g('body')}"/><circle cx="80" cy="50" r="26" fill="none" stroke="#0005"/>` +
      Array.from({ length: 12 }, (_, i) => { const a = i * Math.PI / 6, x = 80 + 21 * Math.sin(a), y = 50 - 21 * Math.cos(a);
        return v === 'reloj_diamante' ? `<path d="M${x} ${y - 2.4} L${x + 2} ${y} L${x} ${y + 2.4} L${x - 2} ${y}Z" fill="#f0f9ff" stroke="#7dd3fc" stroke-width=".5"/>` : `<rect x="${x - 1}" y="${y - 2.5}" width="2" height="5" fill="${g(metal)}" transform="rotate(${i * 30} ${x} ${y})"/>`; }).join('') +
      `<path d="M80 50 L80 34" stroke="${g(metal)}" stroke-width="3" stroke-linecap="round"/><path d="M80 50 L92 56" stroke="${g(metal)}" stroke-width="2.4" stroke-linecap="round"/><path d="M80 50 L70 66" stroke="#ef4444" stroke-width="1"/><circle cx="80" cy="50" r="2.5" fill="${g('gold')}"/>` +
      `<rect x="111" y="45" width="6" height="10" rx="2" fill="${g(metal)}"/><path d="M58 30 Q70 20 88 22" stroke="#fff" stroke-opacity=".55" stroke-width="3" fill="none" stroke-linecap="round"/>`; };
  const casa = (g, v, grass) => { const win = (x, y, w = 9, h = 11) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1" fill="${g('glass')}" stroke="#fff" stroke-width="1"/>`;
    const lawn = `<path d="M0 82 Q80 74 160 82 V100 H0Z" fill="${grass}"/><circle cx="12" cy="74" r="9" fill="#15803d"/><circle cx="150" cy="72" r="10" fill="#15803d"/><path d="M70 100 L76 82 H84 L90 100Z" fill="#e7e5e4"/>`;
    if (v === 'casa_castillo') return lawn + `<rect x="34" y="40" width="92" height="42" fill="${g('body')}" ${S}/>${[24, 106].map(x => `<rect x="${x}" y="22" width="30" height="60" fill="${g('bodyh')}" ${S}/><path d="M${x - 3} 22 L${x + 15} 2 L${x + 33} 22Z" fill="#7f1d1d" stroke="#0006"/><circle cx="${x + 15}" cy="2" r="2" fill="${g('gold')}"/>`).join('')}` +
      Array.from({ length: 8 }, (_, i) => `<rect x="${36 + i * 11.5}" y="34" width="7" height="7" fill="${g('body')}" ${S}/>`).join('') + win(31, 34, 8, 12) + win(121, 34, 8, 12) + win(31, 56, 8, 12) + win(121, 56, 8, 12) +
      `<path d="M68 82 V62 Q80 50 92 62 V82Z" fill="#78350f" stroke="${g('gold')}" stroke-width="1.5"/>` + win(46, 54) + win(105, 54);
    if (v === 'casa_playa') return `<rect y="76" width="160" height="24" fill="#fde68a"/>` + sea(g, 86) + `<rect x="30" y="44" width="100" height="34" fill="${g('body')}" ${S}/><path d="M22 46 L80 22 L138 46Z" fill="#9a3412" stroke="#0006"/><rect x="24" y="64" width="112" height="3" fill="#fff"/>` + win(40, 50, 18, 12) + win(102, 50, 18, 12) + `<rect x="72" y="54" width="16" height="24" fill="#7c2d12"/><path d="M140 78 Q142 50 150 40 M150 40 q-12 -2 -16 6 M150 40 q10 -4 10 6 M150 40 q-4 -10 -12 -8" stroke="#166534" stroke-width="2.5" fill="none"/>`;
    return lawn + `<rect x="18" y="36" width="124" height="46" fill="${g('body')}" ${S}/><path d="M12 38 L80 12 L148 38Z" fill="#334155" stroke="#0006"/><rect x="58" y="44" width="44" height="38" fill="${g('bodyh')}" ${S}/>` +
      [64, 76, 88].map(x => `<rect x="${x - 1}" y="44" width="3" height="38" fill="#fff" opacity=".8"/>`).join('') + [26, 40, 110, 124].map(x => win(x, 44) + win(x, 62)).join('') + `<path d="M74 82 V64 Q80 58 86 64 V82Z" fill="#422006" stroke="${g('gold')}"/>`; };
  const avion = (g, v) => { const jet = v === 'avion_jet';
    return `<circle cx="132" cy="18" r="9" fill="#fef9c3" opacity=".8"/><path d="M10 26 q8 -6 16 0 q6 -4 12 0z M110 84 q8 -6 16 0 q6 -4 12 0z" fill="#fff" opacity=".85"/>` + shadow(g, 80, 92, 50, 3) +
      `<path d="M14 54 Q14 44 32 44 H124 Q150 46 154 54 Q150 62 124 62 H32 Q14 64 14 54Z" fill="${g('body')}" ${S}/>` +
      `<path d="M62 56 L92 56 L70 88 H58Z" fill="${g('bodyh')}" ${S}/><path d="M66 50 L86 50 L72 30 H64Z" fill="${g('bodyh')}" ${S} opacity=".9"/>` +
      `<path d="M18 46 L10 20 H22 L40 44Z" fill="${g('bodyh')}" ${S}/>` + (jet ? `<path d="M6 20 H28 L26 24 H8Z" fill="${g('bodyh')}" ${S}/><rect x="26" y="40" width="22" height="9" rx="4.5" fill="${g('chrome')}" stroke="#0006"/>` : `<circle cx="154" cy="54" r="3" fill="#334155"/><path d="M154 36 V72" stroke="#64748b" stroke-width="2.5" opacity=".7"/>`) +
      `<path d="M128 48 Q144 48 150 54 H130Z" fill="${g('glass')}"/>` + Array.from({ length: jet ? 7 : 4 }, (_, i) => `<rect x="${52 + i * 9}" y="49" width="5" height="5" rx="2" fill="${g('glass')}"/>`).join('') +
      `<path d="M22 52 Q80 44 146 50" stroke="#fff" stroke-opacity=".6" stroke-width="2" fill="none"/><path d="M24 58 H140" stroke="${g(jet ? 'gold' : 'chrome')}" stroke-width="1.5"/>`; };
  const DRAW = { carros: car, motos: moto, yates: yate, jetskis: jetski, relojes: reloj, mansiones: casa, aviones: avion };
  const render = (id, color) => { const i = byId(id); if (!i) return ''; const c = HEX.test(color || '') ? color : i.color; return svg(i.cat, c, (g, b3) => DRAW[i.cat](g, id, b3)); };
  const api = { COLORS, CATS, ITEMS, HEX, byId, render };
  if (typeof module !== 'undefined') module.exports = api; else root.Store = api;
})(this);
