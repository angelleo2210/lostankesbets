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
    it('reloj_plata', 'relojes', 'Reloj de Plata', 75000, '#64748b'), it('reloj_oro', 'relojes', 'Reloj de Oro', 350000, '#facc15'), it('reloj_diamante', 'relojes', 'Reloj de Diamantes', 1000000, '#a5f3fc'),
    it('casa_playa', 'mansiones', 'Casa de Playa', 700000, '#f97316'), it('casa_mansion', 'mansiones', 'Mansión en la Colina', 1400000, '#f8fafc'), it('casa_castillo', 'mansiones', 'Castillo Privado', 1900000, '#64748b'),
    it('avion_avioneta', 'aviones', 'Avioneta', 400000, '#f97316'), it('avion_jet', 'aviones', 'Jet privado', 2000000, '#f8fafc')
  ];
  const HEX = /^#[0-9a-fA-F]{6}$/;
  const byId = id => ITEMS.find(i => i.id === id);
  const W = (c, ...p) => `<svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg">${p.join('')}</svg>`;
  const wheel = (x, y, r = 9) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#111"/><circle cx="${x}" cy="${y}" r="${r / 2.2}" fill="#cbd5e1"/>`;
  const water = '<path d="M0 58 Q15 52 30 58 T60 58 T90 58 T120 58 V70 H0Z" fill="#38bdf8" opacity=".7"/>';
  const DRAW = {
    carros: (c, i) => W(c, `<path d="M6 50 Q8 38 28 35 L46 24 Q62 19 80 24 L98 35 Q114 37 114 50 Z" fill="${c}" stroke="#0008" stroke-width="2"/>`, `<path d="M48 23 Q60 18 74 23 L84 32 H40 Z" fill="#bae6fd"/>`, `<path d="M96 30 L114 24 L114 30Z" fill="${c}" stroke="#0008"/>`, `<text x="60" y="45" font-size="10" text-anchor="middle" font-weight="900" fill="#0009">L</text>`, wheel(30, 52), wheel(90, 52)),
    motos: c => W(c, wheel(28, 52, 12), wheel(92, 52, 12), `<path d="M28 52 L50 34 H78 L92 52" stroke="#334155" stroke-width="4" fill="none"/><path d="M44 36 Q60 22 82 30 L80 40 H48Z" fill="${c}" stroke="#0008" stroke-width="2"/><path d="M82 28 L92 20" stroke="#111" stroke-width="4"/>`),
    yates: (c, i) => i === 'yate_velero' ? W(c, `<path d="M14 48 H106 L94 60 H26Z" fill="${c}" stroke="#0008" stroke-width="2"/><path d="M60 46 V6" stroke="#78350f" stroke-width="3"/><path d="M62 8 L96 44 H62Z" fill="#f8fafc" stroke="#0006"/><path d="M58 14 L32 44 H58Z" fill="#fde68a" stroke="#0006"/>`, water)
      : i === 'yate_catamaran' ? W(c, `<path d="M10 50 H54 L48 58 H16Z M66 50 H110 L104 58 H72Z" fill="${c}" stroke="#0008" stroke-width="2"/><rect x="18" y="38" width="84" height="12" rx="3" fill="${c}" stroke="#0008" stroke-width="2"/><path d="M40 38 V26 H76 L84 38Z" fill="#f8fafc" stroke="#0008"/><rect x="46" y="29" width="28" height="5" fill="#0ea5e9"/>`, water)
      : i === 'yate_lancha' ? W(c, `<path d="M8 44 H112 Q108 56 92 60 H22Z" fill="${c}" stroke="#0008" stroke-width="2"/><path d="M44 44 L56 32 H74 L70 44Z" fill="#bae6fd" stroke="#0008"/><path d="M8 50 H112" stroke="#f8fafc" stroke-width="3"/>`, water)
      : W(c, `<path d="M6 46 H114 L100 60 H16Z" fill="${c}" stroke="#0008" stroke-width="2"/><path d="M30 46 V32 H80 L92 46Z" fill="${c}" stroke="#0008" stroke-width="2"/><rect x="36" y="36" width="40" height="5" fill="#0ea5e9"/><path d="M44 32 V20 H70 L74 32Z" fill="${c}" stroke="#0008"/>`, water),
    jetskis: c => W(c, `<path d="M14 50 Q20 38 50 38 L74 26 L84 30 L80 40 Q104 40 108 50 L100 56 H20Z" fill="${c}" stroke="#0008" stroke-width="2"/><path d="M74 26 L70 16" stroke="#111" stroke-width="4"/>`, water),
    relojes: c => W(c, `<rect x="48" y="2" width="24" height="66" rx="6" fill="#334155"/><circle cx="60" cy="35" r="22" fill="${c}" stroke="#0008" stroke-width="3"/><circle cx="60" cy="35" r="16" fill="#f8fafc"/><path d="M60 35 V24 M60 35 L68 39" stroke="#111" stroke-width="2.5"/>`),
    mansiones: c => W(c, `<rect x="0" y="62" width="120" height="8" fill="#22c55e"/><rect x="16" y="30" width="88" height="32" fill="${c}" stroke="#0008" stroke-width="2"/><path d="M10 32 L60 8 L110 32Z" fill="#b91c1c"/>`, [24, 40, 72, 88].map(x => `<rect x="${x}" y="38" width="9" height="9" fill="#bae6fd"/>`).join(''), `<rect x="54" y="44" width="12" height="18" fill="#78350f"/>`)
    ,aviones: c => W(c, `<path d="M10 40 Q12 30 30 30 H96 Q114 32 116 38 Q114 44 96 44 H30 Q12 46 10 40Z" fill="${c}" stroke="#0008" stroke-width="2"/><path d="M50 36 L70 36 L56 62 H46Z" fill="${c}" stroke="#0008" stroke-width="2"/><path d="M14 32 L8 12 H18 L30 30Z" fill="${c}" stroke="#0008" stroke-width="2"/>`, [40, 50, 60, 70, 80].map(x => `<circle cx="${x}" cy="36" r="2.5" fill="#0ea5e9"/>`).join(''), `<path d="M98 33 Q108 34 110 38 H98Z" fill="#0ea5e9"/>`)
  };
  const render = (id, color) => { const i = byId(id); if (!i) return ''; return DRAW[i.cat](HEX.test(color || '') ? color : i.color, id); };
  const api = { COLORS, CATS, ITEMS, HEX, byId, render };
  if (typeof module !== 'undefined') module.exports = api; else root.Store = api;
})(this);
