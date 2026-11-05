// LosTankesBets: avatar de cuerpo completo estilo caricatura (SVG inline). Compartido navegador + servidor.
(function (root) {
  const COLORS = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#ffffff', '#1f2937'];
  const HAIRC = ['#1f1300', '#5b3a1e', '#a0522d', '#f5c542', '#9ca3af', '#e25822'];
  const SKIN = ['#f1c27d', '#c68642', '#6b4226'];
  // 10 caras (forma de cabeza): [rx, alto arriba, alto abajo, ancho de mandíbula, curva]
  const FACES = { redonda: [26, 26, 26, 14, .55], ovalada: [23, 27, 29, 10, .6], cuadrada: [26, 25, 25, 22, .85], corazon: [27, 26, 26, 5, .45], alargada: [22, 28, 31, 11, .65],
    ancha: [29, 24, 24, 18, .6], diamante: [23, 26, 28, 4, .3], pera: [24, 23, 27, 22, .85], triangular: [27, 26, 28, 7, .25], suave: [25, 25, 27, 16, .7] };
  // 10 cuerpos: sw hombro, ww cintura, belly barriga, lw ancho de pierna, aw grosor de brazo
  const BODIES = { promedio: { sw: 16, ww: 14, belly: 0, lw: 10, aw: 5 }, gordito: { sw: 18, ww: 21, belly: 7, lw: 12, aw: 6 }, flaquito: { sw: 12, ww: 10, belly: 0, lw: 7, aw: 3.5 },
    fuertecito: { sw: 19, ww: 15, belly: 1, lw: 11, aw: 6.5 }, atletico: { sw: 18, ww: 13, belly: 0, lw: 10, aw: 5.5 }, corpulento: { sw: 21, ww: 20, belly: 4, lw: 13, aw: 7 },
    delgado: { sw: 14, ww: 11, belly: 0, lw: 8, aw: 4 }, musculoso: { sw: 23, ww: 14, belly: 0, lw: 12, aw: 8 }, alto: { sw: 15, ww: 12, belly: 0, lw: 9, aw: 4.5 }, robusto: { sw: 20, ww: 18, belly: 3, lw: 12, aw: 6.5 } };
  // Capas de ropa compradas en la Tienda: id -> [ranura, línea, tipo]
  const LAYERS = { top_camiseta: ['arriba', 'casual', 'tee'], top_hoodie: ['arriba', 'sport', 'hoodie'], top_chaqueta: ['arriba', 'casual', 'jacket'], top_abrigo: ['arriba', 'lujo', 'coat'],
    bot_jeans: ['abajo', 'casual', 'jeans'], bot_joggers: ['abajo', 'sport', 'joggers'], bot_cargo: ['abajo', 'casual', 'cargo'], bot_vestir: ['abajo', 'lujo', 'dress'],
    zap_sport: ['zapatos', 'sport', 'sneaker'], zap_casual: ['zapatos', 'casual', 'loafer'], zap_vestir: ['zapatos', 'lujo', 'oxford'],
    med_deportivas: ['medias', 'sport', 'sock'], med_disenador: ['medias', 'casual', 'sock'], med_seda: ['medias', 'lujo', 'sock'],
    cad_plata: ['cadenas', 'sport', 'chain'], cad_oro: ['cadenas', 'casual', 'chain'], cad_diamantes: ['cadenas', 'lujo', 'chain'], joy_pulsera: ['pulseras', 'lujo', 'bracelet'], acc_mochila: ['mochila', 'lujo', 'bag'],
    head_gorra_sport: ['cabeza', 'sport', 'cap'], head_gorro_sport: ['cabeza', 'sport', 'beanie'], head_visera: ['cabeza', 'sport', 'visor'], head_gorra_casual: ['cabeza', 'casual', 'cap'], head_gorro_casual: ['cabeza', 'casual', 'beanie'],
    head_bucket: ['cabeza', 'casual', 'bucket'], head_gorra_lujo: ['cabeza', 'lujo', 'cap'], head_gorro_lujo: ['cabeza', 'lujo', 'beanie'], head_fedora: ['cabeza', 'lujo', 'fedora'] };
  const SLOTS = ['arriba', 'abajo', 'zapatos', 'medias', 'cadenas', 'pulseras', 'mochila', 'cabeza'];
  const CNAMES = { rojo: '#dc2626', azul: '#1d4ed8', verde: '#16a34a', dorado: '#d4a017', blanco: '#f1f5f9', negro: '#1f2937', oro: '#ffcc33', plata: '#d9dde3', rosa: '#e7a3a8', esmeralda: '#10b981', zafiro: '#1e40af' };
  const METAL = { oro: '#ffcc33', plata: '#d9dde3', bronce: '#d0874a' };
  // lock = id de recompensa (top 3) necesaria
  const CAT = {
    skin: { name: 'Piel', opts: SKIN, color: true },
    face: { name: 'Cara', opts: Object.keys(FACES) },
    body: { name: 'Cuerpo', opts: Object.keys(BODIES) },
    eyes: { name: 'Ojos', opts: ['normales', 'felices', 'guiño', 'sorprendidos', 'enojados', 'estrellas'] },
    mouth: { name: 'Boca', opts: ['sonrisa', 'carcajada', 'seria', 'lengua', 'sorpresa'] },
    hair: { name: 'Pelo', opts: ['calvo', 'corto', 'puntas', 'afro', 'largo', 'cresta', 'rapado', 'mohicano', 'coleta', 'moño', 'rizos', 'flequillo', 'raya_lado', 'hacia_atras', 'mullet', 'trenzas', 'rastas', 'ondulado', 'militar', 'emo'], colorKey: 'hairColor' },
    hairColor: { name: 'Color de pelo', opts: HAIRC, color: true },
    hat: { name: 'Sombrero', opts: ['ninguno', 'gorra', 'gorro', 'vaquero', 'corona', 'sombrero_dorado', 'gorra_campeon'], colorKey: 'hatColor', lock: { corona: 'corona', sombrero_dorado: 'sombrero_dorado', gorra_campeon: 'gorra_campeon' } },
    hatColor: { name: 'Color de sombrero', opts: COLORS, color: true },
    glasses: { name: 'Gafas', opts: ['ninguno', 'redondas', 'sol', 'nerd'] },
    earrings: { name: 'Aretes', opts: ['ninguno', 'bolita', 'aro'] },
    necklace: { name: 'Collar', opts: ['ninguno', 'cadena', 'perlas', 'medallon'] },
    shirt: { name: 'Camiseta', opts: ['camiseta', 'camisa', 'sin_mangas', 'dorada'], colorKey: 'shirtColor', lock: { dorada: 'camiseta_dorada' } },
    shirtColor: { name: 'Color camiseta', opts: COLORS, color: true },
    pants: { name: 'Pantalón', opts: ['largo', 'chores', 'dorado'], colorKey: 'pantsColor', lock: { dorado: 'pantalon_dorado' } },
    pantsColor: { name: 'Color pantalón', opts: COLORS, color: true },
    socks: { name: 'Medias', opts: ['ninguno', 'cortas', 'largas', 'doradas'], colorKey: 'socksColor', lock: { doradas: 'medias_doradas' } },
    socksColor: { name: 'Color medias', opts: COLORS, color: true },
    shoes: { name: 'Zapaticos', opts: ['ninguno', 'tenis', 'botas', 'oro', 'plata', 'bronce'], colorKey: 'shoesColor', lock: { oro: 'zapatos_oro', plata: 'zapatos_plata', bronce: 'zapatos_bronce' } },
    shoesColor: { name: 'Color zapaticos', opts: COLORS, color: true },
  };
  const DEFAULT = { skin: SKIN[0], face: 'redonda', body: 'promedio', eyes: 'normales', mouth: 'sonrisa', hair: 'corto', hairColor: HAIRC[0], hat: 'ninguno', hatColor: COLORS[0], glasses: 'ninguno', earrings: 'ninguno', necklace: 'ninguno',
    shirt: 'camiseta', shirtColor: COLORS[5], pants: 'largo', pantsColor: COLORS[9], socks: 'ninguno', socksColor: COLORS[8], shoes: 'tenis', shoesColor: COLORS[0] };
  const hexd = (a, b) => { const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16); return [16, 8, 0].reduce((s, k) => s + (((x >> k) & 255) - ((y >> k) & 255)) ** 2, 0); };
  const near = (v, list) => list.reduce((b, o) => hexd(v, o) < hexd(v, b) ? o : b, list[0]);
  // wear: { ranura: { id, color } } con colores por nombre. La propiedad se revisa en el servidor.
  const normWear = w => { const o = {}; if (w && typeof w === 'object' && !Array.isArray(w)) for (const sl of SLOTS) { const x = w[sl];
    if (x && typeof x === 'object' && LAYERS[x.id] && LAYERS[x.id][0] === sl && CNAMES[x.color]) o[sl] = { id: x.id, color: x.color }; } return o; };
  const norm = c => { const o = { ...DEFAULT, wear: {} }; if (c && typeof c === 'object') { for (const k in CAT) { if (CAT[k].opts.includes(c[k])) o[k] = c[k];
        else if ((k === 'skin' || k === 'hairColor') && /^#[0-9a-f]{6}$/i.test(c[k] || '')) o[k] = near(c[k].toLowerCase(), CAT[k].opts); } // compat: tonos antiguos -> el más cercano
      o.wear = normWear(c.wear); } return o; };
  // Valida; devuelve {cfg} o {error}. unlocked: Set de ids de recompensa
  function validate(c, unlocked = new Set()) {
    if (!c || typeof c !== 'object' || Array.isArray(c)) return { error: 'Avatar inválido' };
    for (const k of Object.keys(c)) if (!CAT[k] && k !== 'wear') return { error: 'Categoría desconocida: ' + k };
    if (c.wear !== undefined && (typeof c.wear !== 'object' || Array.isArray(c.wear) || !c.wear || Object.keys(c.wear).some(k => !SLOTS.includes(k)) || Object.keys(normWear(c.wear)).length !== Object.values(c.wear).filter(Boolean).length)) return { error: 'Ropa inválida' };
    for (const k in c) { if (k === 'wear') continue; if (!CAT[k].opts.includes(c[k])) return { error: `Valor inválido en ${CAT[k].name}` };
      const need = CAT[k].lock && CAT[k].lock[c[k]]; if (need && !unlocked.has(need)) return { error: `Bloqueado: ${CAT[k].name} ${c[k]} es exclusivo del top 3`, locked: need }; }
    return { cfg: { ...DEFAULT, wear: {}, ...c, wear: normWear(c.wear) } };
  }
  // Estilo "soft 3D": contornos suaves, degradados por pieza, brillos y sombra de contacto. IDs únicos por render.
  const S = 'stroke="#2a1e4d" stroke-opacity=".28" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"';
  const mix = (hex, t) => { const n = parseInt(hex.slice(1), 16), to = t > 0 ? 255 : 0, a = Math.abs(t);
    return '#' + [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(v + (to - v) * a).toString(16).padStart(2, '0')).join(''); };
  // Gorras y sombreros de la Tienda (diseños: corona en gorras, rombo+estrella en gorros, olas+estrellas en bucket)
  const headwear = ({ kind, line, col }) => { const G = '#ffcc33', dk = mix(col, -.3), lt = col === '#f1f5f9' ? '#1f2937' : line === 'lujo' ? G : '#ffffff';
    const crown = (x, y, k = 1) => `<path d="M${x - 6 * k} ${y + 3 * k} L${x - 6 * k} ${y - 3 * k} L${x - 3 * k} ${y} L${x} ${y - 5 * k} L${x + 3 * k} ${y} L${x + 6 * k} ${y - 3 * k} L${x + 6 * k} ${y + 3 * k}Z" fill="${line === 'sport' ? lt : G}"/>`;
    const star = (x, y, r = 3) => `<path d="M${x} ${y - r} l${r * .3} ${r * .65} ${r * .7} .1 -${r * .55} ${r * .45} .2 ${r * .7} -${r * .65} -${r * .4} -${r * .65} ${r * .4} .2 -${r * .7} -${r * .55} -${r * .45} ${r * .7} -.1z" fill="${line === 'lujo' ? G : lt}"/>`;
    switch (kind) {
      case 'cap': return `<path d="M24 26 Q26 4 50 4 Q74 4 76 26Z" fill="${col}" ${S}/><path d="M50 26 H88 Q88 20 76 20" fill="${dk}" ${S}/><circle cx="50" cy="5" r="2" fill="${dk}"/>` +
        (line === 'sport' ? `<path d="M51 9 L45 17 H50 L47 24 L55 14 H50 Z" fill="${lt}"/><path d="M30 20 Q34 12 40 9" stroke="${lt}" stroke-opacity=".5" stroke-dasharray="1 1.5" fill="none"/>` : crown(50, 15, line === 'lujo' ? .9 : 1.1)) +
        (line === 'lujo' ? `<rect x="24" y="22" width="52" height="3" fill="${dk}"/><rect x="47" y="21.5" width="6" height="4" rx="1" fill="${G}"/><path d="M34 8 Q44 4 58 6" stroke="#fff" stroke-opacity=".55" stroke-width="2" fill="none"/>` : '');
      case 'visor': return `<path d="M23 24 Q50 16 77 24 L77 28 Q50 21 23 28Z" fill="${col}" ${S}/><path d="M50 26 H88 Q88 20 76 20 L60 22" fill="${dk}" ${S}/><path d="M44 22 h10 l-3 -2.5 m3 2.5 l-3 2.5" stroke="${lt}" stroke-width="1.6" fill="none"/>`;
      case 'beanie': return `<path d="M24 28 Q24 0 50 0 Q76 0 76 28Z" fill="${col}" ${S}/><rect x="22" y="21" width="56" height="9" rx="4" fill="${dk}" ${S}/>` +
        (line === 'sport' ? `<path d="M28 12 q5 -4 10 0 t10 0 t10 0 t10 0 M27 17 q5 -4 10 0 t10 0 t10 0 t10 0" stroke="${lt}" stroke-opacity=".75" stroke-width="1.4" fill="none"/>`
          : line === 'casual' ? `${[34, 50, 66].map(x => `<path d="M${x} 6 l5 6 -5 6 -5 -6z" fill="none" stroke="${lt}" stroke-opacity=".8" stroke-width="1.3"/>`).join('')}<rect x="44" y="21.5" width="12" height="8" rx="2" fill="${col === '#f1f5f9' ? '#1f2937' : '#f1f5f9'}"/>${star(50, 25.5, 3.2).replace(`fill="${lt}"`, `fill="${col === '#f1f5f9' ? '#ffcc33' : col}"`)}`
          : `<path d="M30 10 L70 10 M28 15 L72 15" stroke="#fff" stroke-opacity=".18"/><rect x="45" y="22" width="10" height="7" rx="1.5" fill="${G}"/>`) + (line === 'sport' ? '' : `<circle cx="50" cy="-2" r="5" fill="${dk}" ${S}/>`);
      case 'bucket': return `<path d="M14 26 Q50 20 86 26 L80 32 Q50 27 20 32Z" fill="${dk}" ${S}/><path d="M28 26 Q30 0 50 0 Q70 0 72 26Z" fill="${col}" ${S}/><path d="M32 18 q4.5 -3 9 0 t9 0 t9 0 t9 0" stroke="${lt}" stroke-width="1.4" fill="none"/>${star(38, 9, 2.5)}${star(60, 8, 2.5)}${star(50, 13, 2)}`;
      case 'fedora': return `<path d="M10 24 Q50 34 90 24 Q84 31 50 31 Q16 31 10 24Z" fill="${dk}" ${S}/><path d="M30 25 Q30 0 50 4 Q70 0 70 25Z" fill="${col}" ${S}/><path d="M42 5 Q50 10 58 5" stroke="${dk}" stroke-width="2" fill="none"/><rect x="30" y="17" width="40" height="6" fill="#1e1b2e"/><path d="M30 18 H70" stroke="#fff" stroke-opacity=".35" stroke-width="1"/><circle cx="62" cy="20" r="2.2" fill="${G}" ${S.replace('3', '1')}/>`;
    } return ''; };
  let seq = 0;
  function render(c, opt = {}) {
    c = norm(c); const fh = opt.facialHair; const sk = c.skin;
    const gold = METAL.oro, shirtC = c.shirt === 'dorada' ? gold : c.shirtColor, pantsC = c.pants === 'dorado' ? gold : c.pantsColor;
    const sockC = c.socks === 'doradas' ? gold : c.socksColor, shoeC = METAL[c.shoes] || c.shoesColor, hatC = c.hat === 'sombrero_dorado' ? gold : c.hat === 'corona' ? gold : c.hatColor;
    let g = ''; const B = BODIES[c.body] || BODIES.promedio, W = c.wear || {}, CN = k => CNAMES[k] || '#888888', GOLD = '#ffcc33';
    const wk = sl => W[sl] && LAYERS[W[sl].id] ? { line: LAYERS[W[sl].id][1], kind: LAYERS[W[sl].id][2], col: CN(W[sl].color), id: W[sl].id } : null;
    const top = wk('arriba'), bot = wk('abajo'), zap = wk('zapatos'), med = wk('medias'), cad = wk('cadenas'), pul = wk('pulseras'), moch = wk('mochila');
    const sw = B.sw, ww = B.ww, by = B.belly, lw = B.lw, L1 = 48 - lw, R1 = 52, crossed = opt.pose === 'cruzado';
    const topC = top ? top.col : shirtC, botC = bot ? bot.col : pantsC;
    // mochila detrás del cuerpo
    if (moch) g += `<rect x="${50 - sw - 3}" y="68" width="${2 * sw + 6}" height="32" rx="8" fill="${moch.col}" ${S}/><rect x="${50 + sw - 1}" y="78" width="6" height="12" rx="2" fill="${mix(moch.col, -.25)}" ${S.replace('3', '1.5')}/>`;
    // piernas
    const legY = !bot && c.pants === 'chores' ? 112 : 128;
    g += `<rect x="${L1}" y="104" width="${lw}" height="30" rx="4" fill="${sk}" ${S}/><rect x="${R1}" y="104" width="${lw}" height="30" rx="4" fill="${sk}" ${S}/>`;
    if (med || c.socks !== 'ninguno') { const sy = med ? (med.line === 'lujo' ? 118 : 122) : c.socks === 'largas' ? 116 : 126, sc = med ? med.col : sockC;
      g += `<rect x="${L1}" y="${sy}" width="${lw}" height="${134 - sy}" rx="3" fill="${sc}" ${S}/><rect x="${R1}" y="${sy}" width="${lw}" height="${134 - sy}" rx="3" fill="${sc}" ${S}/>`;
      if (med && med.line === 'sport') g += `<path d="M${L1} ${sy + 3} h${lw} M${R1} ${sy + 3} h${lw}" stroke="#fff" stroke-width="1.6"/>`;
      if (med && med.line === 'casual') g += [L1, R1].map(x => `<circle cx="${x + lw / 2}" cy="${sy + 5}" r="1.3" fill="#fff" opacity=".8"/>`).join('');
      if (med && med.line === 'lujo') g += `<path d="M${L1 + 2} ${sy + 2} v10 M${R1 + 2} ${sy + 2} v10" stroke="#fff" stroke-opacity=".5" stroke-width="1.2"/>`; }
    g += `<path d="M${50 - ww - 1} 94 H${50 + ww + 1} L${R1 + lw + .5} ${legY} H${R1} L50 104 L${L1 + lw} ${legY} H${L1 - .5} Z" fill="${botC}" ${S}/>`;
    if (bot) g += ({ jeans: `<path d="M${L1 + 2} ${legY - 2} H${L1 + lw} M${R1} ${legY - 2} H${R1 + lw - 2} M${50 - ww + 3} 97 q3 4 7 0 M${50 + ww - 3} 97 q-3 4 -7 0" stroke="#f59e0b" stroke-width="1" fill="none" stroke-dasharray="1.5 1"/>`,
      joggers: `<path d="M${L1 - .3} 98 V${legY} M${R1 + lw + .3} 98 V${legY}" stroke="#fff" stroke-width="2"/><rect x="${L1 - .5}" y="${legY - 3}" width="${lw + 1}" height="3" fill="${mix(botC, -.3)}"/><rect x="${R1}" y="${legY - 3}" width="${lw + 1}" height="3" fill="${mix(botC, -.3)}"/>`,
      cargo: `<rect x="${L1 - 1}" y="108" width="${lw * .7}" height="8" rx="1.5" fill="${mix(botC, -.18)}" ${S.replace('3', '1.2')}/><rect x="${R1 + lw * .3 + 1}" y="108" width="${lw * .7}" height="8" rx="1.5" fill="${mix(botC, -.18)}" ${S.replace('3', '1.2')}/>`,
      dress: `<path d="M${L1 + lw / 2} 100 V${legY} M${R1 + lw / 2} 100 V${legY}" stroke="#fff" stroke-opacity=".35" stroke-width="1"/><rect x="${50 - ww - 1}" y="94" width="${2 * ww + 2}" height="4" fill="#1e1b2e"/><rect x="47" y="93.5" width="6" height="5" rx="1" fill="${GOLD}"/>` })[bot.kind];
    // zapatos
    if (zap) { const h = zap.kind === 'sneaker' ? 9 : 7;
      for (const x of [L1 - 4, R1 - 1]) { g += `<rect x="${x}" y="${140 - h}" width="${lw + 6}" height="${h}" rx="${zap.kind === 'oxford' ? 3 : 4}" fill="${zap.col}" ${S}/>`;
        g += ({ sneaker: `<rect x="${x}" y="137" width="${lw + 6}" height="3" rx="1.5" fill="#fff"/><path d="M${x + 3} ${134} l${lw / 2} -2" stroke="#fff" stroke-width="1.6"/>`,
          loafer: `<path d="M${x + 3} ${135} h${lw - 1}" stroke="${mix(zap.col, -.35)}" stroke-width="1.4"/><circle cx="${x + lw / 2 + 3}" cy="135" r="1" fill="${GOLD}"/>`,
          oxford: `<path d="M${x + 4} 134.5 l2 1.5 2 -1.5 2 1.5" stroke="#fff" stroke-opacity=".6" stroke-width=".8" fill="none"/><ellipse cx="${x + lw / 2 + 4}" cy="134.3" rx="3" ry="1" fill="#fff" opacity=".55"/>` })[zap.kind]; } }
    else if (c.shoes !== 'ninguno') { const h = c.shoes === 'botas' ? 12 : 8; g += `<rect x="${L1 - 4}" y="${140 - h}" width="${lw + 7}" height="${h}" rx="4" fill="${shoeC}" ${S}/><rect x="${R1 - 1}" y="${140 - h}" width="${lw + 7}" height="${h}" rx="4" fill="${shoeC}" ${S}/>`;
      if (c.shoes === 'tenis') g += `<path d="M${L1 - 2} 138 H${L1 + lw + 1} M${R1 + 1} 138 H${R1 + lw + 4}" stroke="#fff" stroke-width="2"/>`; }
    // brazos (abajo); con pose cruzada se dibujan encima del torso
    const sleeve = top ? true : c.shirt !== 'sin_mangas', aw = B.aw, SH = [50 - sw + 2, 50 + sw - 2];
    const armDown = (x, dx) => `<path d="M${x} 71 L${x + dx} 96" stroke="${mix(sk, -.35)}" stroke-width="${aw + 4}" stroke-linecap="round"/><path d="M${x} 71 L${x + dx} 96" stroke="${sk}" stroke-width="${aw}" stroke-linecap="round"/>`;
    if (!crossed) g += armDown(SH[0], -10) + armDown(SH[1], 10);
    const tb = top && top.kind === 'coat' ? 108 : 98;
    g += `<path d="M${50 - sw} 66 Q50 60 ${50 + sw} 66 L${50 + ww + by * .6} 84 Q${50 + ww + by} 92 ${50 + ww} ${tb} L${50 - ww} ${tb} Q${50 - ww - by} 92 ${50 - ww - by * .6} 84 Z" fill="${topC}" ${S}/>`;
    if (sleeve && !crossed) g += `<path d="M${50 - sw} 66 L${50 - sw - 8} 82 L${50 - sw - 1} 85 L${50 - sw + 3} 76 Z M${50 + sw} 66 L${50 + sw + 8} 82 L${50 + sw + 1} 85 L${50 + sw - 3} 76 Z" fill="${topC}" ${S}/>`;
    if (top) g += ({ tee: `<path d="M44 63 Q50 69 56 63" fill="none" stroke="${mix(topC, -.3)}" stroke-width="2"/><rect x="${50 + ww - 9}" y="74" width="6" height="6" rx="1" fill="${mix(topC, -.12)}" ${S.replace('3', '1')}/>`,
      hoodie: `<path d="M40 64 Q50 76 60 64 Q58 70 50 72 Q42 70 40 64Z" fill="${mix(topC, -.2)}" ${S.replace('3', '1.5')}/><path d="M47 70 v8 M53 70 v8" stroke="#fff" stroke-width="1.3"/><path d="M${50 - ww + 3} 90 H${50 + ww - 3} L${50 + ww - 6} 97 H${50 - ww + 6} Z" fill="${mix(topC, -.12)}" ${S.replace('3', '1')}/><path d="M${50 - sw + 2} 68 L${50 - ww} 96 M${50 + sw - 2} 68 L${50 + ww} 96" stroke="#fff" stroke-opacity=".7" stroke-width="1.6"/>`,
      jacket: `<path d="M50 66 V${tb}" stroke="#d9dde3" stroke-width="1.6"/><path d="M42 63 L48 74 L50 66 L52 74 L58 63" fill="${mix(topC, -.25)}" ${S.replace('3', '1.2')}/><path d="M${50 - ww + 2} 84 h6 M${50 + ww - 8} 84 h6" stroke="#d9dde3" stroke-width="1.2"/>`,
      coat: `<path d="M42 63 L49 84 L50 66 Z M58 63 L51 84 L50 66 Z" fill="${mix(topC, -.25)}" ${S.replace('3', '1.2')}/>${[88, 96].map(y => `<circle cx="45" cy="${y}" r="1.4" fill="${GOLD}"/><circle cx="55" cy="${y}" r="1.4" fill="${GOLD}"/>`).join('')}<path d="M50 84 V${tb}" stroke="#000" stroke-opacity=".25"/>` })[top.kind];
    else { if (c.shirt === 'camisa') g += `<path d="M44 64 L50 72 L56 64 M50 72 V96" fill="none" ${S}/><circle cx="50" cy="80" r="1.3" fill="#1e1b2e"/><circle cx="50" cy="88" r="1.3" fill="#1e1b2e"/>`;
      if (c.shirt === 'dorada') g += `<path d="M40 74 l3 -3 3 3 M54 84 l3 -3 3 3" stroke="#fff" stroke-width="2" fill="none"/>`; }
    if (c.body === 'musculoso' || c.body === 'fuertecito') g += `<path d="M42 78 Q46 81 50 78 Q54 81 58 78" stroke="#000" stroke-opacity=".16" stroke-width="1.4" fill="none"/>`;
    if (moch) g += `<path d="M${50 - sw + 4} 65 L${50 - ww + 2} 92 M${50 + sw - 4} 65 L${50 + ww - 2} 92" stroke="${mix(moch.col, -.2)}" stroke-width="3" stroke-linecap="round"/><circle cx="${50 - sw + 5.5}" cy="74" r="1.2" fill="${GOLD}"/><circle cx="${50 + sw - 5.5}" cy="74" r="1.2" fill="${GOLD}"/>`;
    // brazos cruzados al frente
    let hands = crossed ? [[57, 84], [43, 80]] : [[SH[0] - 10, 96], [SH[1] + 10, 96]];
    if (crossed) { const ac = sleeve ? topC : sk;
      g += `<path d="M${SH[0]} 70 Q${SH[0] - 6} 86 ${57} 84" stroke="${mix(ac, -.35)}" stroke-width="${aw + 5}" fill="none" stroke-linecap="round"/><path d="M${SH[0]} 70 Q${SH[0] - 6} 86 57 84" stroke="${ac}" stroke-width="${aw + 1}" fill="none" stroke-linecap="round"/>`;
      g += `<path d="M${SH[1]} 70 Q${SH[1] + 6} 84 43 80" stroke="${mix(ac, -.35)}" stroke-width="${aw + 5}" fill="none" stroke-linecap="round"/><path d="M${SH[1]} 70 Q${SH[1] + 6} 84 43 80" stroke="${ac}" stroke-width="${aw + 1}" fill="none" stroke-linecap="round"/>`;
      g += hands.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${aw / 2 + 1}" fill="${sk}" ${S.replace('3', '1.5')}/>`).join(''); }
    if (pul) g += hands.map(([x, y]) => `<circle cx="${x}" cy="${y - (crossed ? 0 : 4)}" r="${aw / 2 + 2.2}" fill="none" stroke="${pul.col}" stroke-width="2"/><circle cx="${x}" cy="${y - (crossed ? 2.2 : 6.2) - aw / 2}" r=".9" fill="#fff"/>`).join('');
    // collar / cadena
    if (cad) { const t = cad.line === 'sport' ? 1.8 : 2.6; g += `<path d="M42 64 Q50 ${cad.line === 'lujo' ? 80 : 76} 58 64" fill="none" stroke="${cad.col}" stroke-width="${t}" stroke-dasharray="2 1.4"/>`;
      if (cad.line === 'lujo') g += [[46, 74], [50, 78], [54, 74]].map(([x, y]) => `<path d="M${x} ${y - 2.2} l1.6 2.2 -1.6 2.2 -1.6 -2.2z" fill="#fff" stroke="#bae6fd" stroke-width=".6"/>`).join('');
      if (cad.line === 'casual') g += `<circle cx="50" cy="76.5" r="2.4" fill="${cad.col}" ${S.replace('3', '1')}/>`; }
    else { if (c.necklace === 'cadena') g += `<path d="M42 64 Q50 76 58 64" fill="none" stroke="${gold}" stroke-width="2.5" stroke-dasharray="2 1.5"/>`;
      if (c.necklace === 'perlas') g += [0, 1, 2, 3, 4].map(i => `<circle cx="${42 + i * 4}" cy="${66 + [0, 4, 6, 4, 0][i]}" r="2" fill="#fff" stroke="#1e1b2e" stroke-width="1"/>`).join('');
      if (c.necklace === 'medallon') g += `<path d="M43 64 L50 74 L57 64" fill="none" stroke="${gold}" stroke-width="2"/><circle cx="50" cy="77" r="4" fill="${gold}" ${S.replace('3', '1.5')}/>`; }
    // cabeza
    let hd = '';
    if (c.hair === 'largo' || c.hair === 'afro') hd += c.hair === 'afro' ? `<circle cx="50" cy="30" r="32" fill="${c.hairColor}" ${S}/>` : `<path d="M22 34 Q22 4 50 4 Q78 4 78 34 L80 62 L20 62 Z" fill="${c.hairColor}" ${S}/>`;
    if (c.earrings !== 'ninguno') hd += c.earrings === 'aro' ? `<circle cx="24" cy="46" r="4" fill="none" stroke="${gold}" stroke-width="2.5"/><circle cx="76" cy="46" r="4" fill="none" stroke="${gold}" stroke-width="2.5"/>` : `<circle cx="24" cy="44" r="2.6" fill="${gold}" stroke="#1e1b2e" stroke-width="1"/><circle cx="76" cy="44" r="2.6" fill="${gold}" stroke="#1e1b2e" stroke-width="1"/>`;
    const [frx, fr1, fr2, fj, fk] = FACES[c.face] || FACES.redonda;
    const faceEl = `<path d="M${50 - frx} 34 A${frx} ${fr1} 0 0 1 ${50 + frx} 34 C${50 + frx} ${34 + fr2 * fk} ${50 + fj} ${34 + fr2} 50 ${34 + fr2} C${50 - fj} ${34 + fr2} ${50 - frx} ${34 + fr2 * fk} ${50 - frx} 34Z" fill="${sk}" ${S}/>`;
    hd += `<circle cx="${51 - frx}" cy="36" r="5" fill="${sk}" ${S}/><circle cx="${49 + frx}" cy="36" r="5" fill="${sk}" ${S}/>` + faceEl;
    hd += `<ellipse cx="36" cy="44" rx="4" ry="2.5" fill="#f87171" opacity=".5"/><ellipse cx="64" cy="44" rx="4" ry="2.5" fill="#f87171" opacity=".5"/>`;
    const eye = (x, m) => ({ normales: `<ellipse cx="${x}" cy="33" rx="5" ry="6.5" fill="#fff" ${S.replace('3', '2')}/><circle cx="${x + 1}" cy="34" r="3.2" fill="#1e1b2e"/><circle cx="${x + 2.2}" cy="32.3" r="1.4" fill="#fff"/><circle cx="${x - .2}" cy="35.6" r=".6" fill="#fff" opacity=".8"/>`,
      felices: `<path d="M${x - 5} 35 Q${x} 27 ${x + 5} 35" fill="none" ${S}/>`,
      'guiño': m ? `<path d="M${x - 5} 33 H${x + 5}" ${S}/>` : `<ellipse cx="${x}" cy="33" rx="5" ry="6.5" fill="#fff" ${S.replace('3', '2')}/><circle cx="${x + 1}" cy="34" r="3.2" fill="#1e1b2e"/><circle cx="${x + 2.2}" cy="32.3" r="1.4" fill="#fff"/>`,
      sorprendidos: `<circle cx="${x}" cy="33" r="7" fill="#fff" ${S.replace('3', '2')}/><circle cx="${x}" cy="33" r="2.2" fill="#1e1b2e"/><circle cx="${x + 1}" cy="32" r=".8" fill="#fff"/>`,
      enojados: `<ellipse cx="${x}" cy="34" rx="5" ry="5" fill="#fff" ${S.replace('3', '2')}/><circle cx="${x}" cy="35" r="2.6" fill="#1e1b2e"/><circle cx="${x + 1}" cy="34" r=".9" fill="#fff"/><path d="M${x - 6} ${m ? 24 : 28} L${x + 6} ${m ? 28 : 24}" ${S}/>`,
      estrellas: `<path d="M${x} 26 l2 5 5 .5 -4 3.5 1.3 5 -4.3 -2.7 -4.3 2.7 1.3 -5 -4 -3.5 5 -.5z" fill="#facc15" ${S.replace('3', '1.5')}/>` })[c.eyes];
    hd += eye(40, 0) + eye(60, 1);
    hd += ({ sonrisa: `<path d="M41 45 Q50 54 59 45" fill="none" ${S}/>`, carcajada: `<path d="M40 44 Q50 60 60 44 Z" fill="#7f1d1d" ${S}/><path d="M44 52 Q50 56 56 52" fill="#f87171"/>`,
      seria: `<path d="M43 48 H57" ${S}/>`, lengua: `<path d="M41 45 Q50 53 59 45" fill="none" ${S}/><path d="M47 49 Q50 57 53 49" fill="#f472b6" ${S.replace('3', '2')}/>`, sorpresa: `<ellipse cx="50" cy="49" rx="4" ry="5" fill="#7f1d1d" ${S}/>` })[c.mouth];
    if (fh && fh.style) { const fc = /^#[0-9a-f]{6}$/i.test(fh.color || '') ? fh.color : c.hairColor;
      hd += ({ bigote: `<path d="M40 44 Q45 39 50 43 Q55 39 60 44 Q55 46 50 44 Q45 46 40 44Z" fill="${fc}" ${S.replace('3', '2')}/>`,
        barba_corta: `<path d="M26 38 Q28 62 50 62 Q72 62 74 38 Q70 54 50 54 Q30 54 26 38Z" fill="${fc}" ${S.replace('3', '2')}/>`,
        barba_larga: `<path d="M26 38 Q26 74 50 76 Q74 74 74 38 Q70 54 50 54 Q30 54 26 38Z" fill="${fc}" ${S.replace('3', '2')}/>`,
        candado: `<path d="M40 44 Q50 39 60 44 M44 54 Q50 62 56 54 L54 53 Q50 57 46 53Z" fill="${fc}" stroke="${fc}" stroke-width="3" stroke-linecap="round"/>`,
        perilla: `<path d="M45 54 Q50 64 55 54 Q50 57 45 54Z" fill="${fc}" ${S.replace('3', '2')}/>`,
        patillas: `<path d="M25 30 V46 L29 46 V30Z M75 30 V46 L71 46 V30Z" fill="${fc}" ${S.replace('3', '2')}/>` })[fh.style] || ''; }
    if (c.glasses !== 'ninguno') hd += c.glasses === 'sol' ? `<path d="M31 29 H69 V33 Q67 41 59 40 Q53 39 52 32 H48 Q47 39 41 40 Q33 41 31 33Z" fill="#111827" ${S.replace('3', '2')}/>`
      : `<circle cx="40" cy="33" r="${c.glasses === 'nerd' ? 9 : 7.5}" fill="#fff" fill-opacity=".15" ${S.replace('3', c.glasses === 'nerd' ? '3.5' : '2')}/><circle cx="60" cy="33" r="${c.glasses === 'nerd' ? 9 : 7.5}" fill="#fff" fill-opacity=".15" ${S.replace('3', c.glasses === 'nerd' ? '3.5' : '2')}/><path d="M47 33 H53" ${S.replace('3', '2')}/>`;
    const hw = wk('cabeza'), hatOn = c.hat !== 'ninguno' || !!(hw && hw.kind !== 'visor');
    if (!hatOn) hd += ({ corto: `<path d="M24 30 Q26 6 50 7 Q74 6 76 30 Q66 18 50 20 Q34 18 24 30Z" fill="${c.hairColor}" ${S}/>`,
      puntas: `<path d="M24 30 L26 12 L34 18 L38 4 L46 14 L52 2 L58 14 L66 4 L68 18 L76 12 L76 30 Q66 18 50 20 Q34 18 24 30Z" fill="${c.hairColor}" ${S}/>`,
      largo: `<path d="M24 30 Q26 6 50 7 Q74 6 76 30 Q60 16 40 22 Q30 24 24 30Z" fill="${c.hairColor}" ${S}/>`,
      afro: '', calvo: `<path d="M38 14 Q44 11 50 12" stroke="#fff" stroke-width="2" fill="none" opacity=".6"/>`,
      cresta: `<path d="M44 20 Q42 0 50 -2 Q58 0 56 20Z" fill="${c.hairColor}" ${S}/>`,
      rapado: `<path d="M25 28 Q27 9 50 9 Q73 9 75 28 Q64 20 50 21 Q36 20 25 28Z" fill="${c.hairColor}" opacity=".55"/>`,
      mohicano: `<path d="M45 22 L43 0 L50 6 L52 -4 L56 6 L58 22Z" fill="${c.hairColor}" ${S}/>`,
      coleta: `<path d="M24 30 Q26 6 50 7 Q74 6 76 30 Q66 16 50 18 Q34 16 24 30Z M74 22 Q90 30 84 54 Q80 40 72 34Z" fill="${c.hairColor}" ${S}/>`,
      'moño': `<circle cx="50" cy="2" r="9" fill="${c.hairColor}" ${S}/><path d="M24 30 Q26 8 50 8 Q74 8 76 30 Q66 18 50 20 Q34 18 24 30Z" fill="${c.hairColor}" ${S}/>`,
      rizos: `<circle cx="28" cy="24" r="7" fill="${c.hairColor}" ${S}/><circle cx="36" cy="14" r="7" fill="${c.hairColor}" ${S}/><circle cx="46" cy="9" r="7" fill="${c.hairColor}" ${S}/><circle cx="56" cy="9" r="7" fill="${c.hairColor}" ${S}/><circle cx="66" cy="14" r="7" fill="${c.hairColor}" ${S}/><circle cx="73" cy="24" r="7" fill="${c.hairColor}" ${S}/>`,
      flequillo: `<path d="M24 32 Q24 6 50 6 Q76 6 76 32 L68 22 L62 30 L56 21 L50 30 L44 21 L38 30 L32 22Z" fill="${c.hairColor}" ${S}/>`,
      raya_lado: `<path d="M24 32 Q24 6 50 6 Q76 6 76 30 Q70 20 40 18 Q30 22 24 32Z" fill="${c.hairColor}" ${S}/><path d="M40 8 Q38 14 40 18" stroke="#000" stroke-opacity=".25" fill="none"/>`,
      hacia_atras: `<path d="M25 26 Q28 4 50 4 Q72 4 75 26 Q62 12 50 12 Q38 12 25 26Z" fill="${c.hairColor}" ${S}/>`,
      mullet: `<path d="M24 30 Q26 6 50 7 Q74 6 76 30 L78 50 L70 44 Q66 18 50 20 Q34 18 30 44 L22 50Z" fill="${c.hairColor}" ${S}/>`,
      trenzas: `<path d="M24 30 Q26 6 50 7 Q74 6 76 30 Q66 18 50 20 Q34 18 24 30Z" fill="${c.hairColor}" ${S}/><circle cx="22" cy="40" r="3.5" fill="${c.hairColor}" ${S}/><circle cx="22" cy="47" r="3.5" fill="${c.hairColor}" ${S}/><circle cx="22" cy="54" r="3.5" fill="${c.hairColor}" ${S}/><circle cx="22" cy="61" r="3.5" fill="${c.hairColor}" ${S}/><circle cx="78" cy="40" r="3.5" fill="${c.hairColor}" ${S}/><circle cx="78" cy="47" r="3.5" fill="${c.hairColor}" ${S}/><circle cx="78" cy="54" r="3.5" fill="${c.hairColor}" ${S}/><circle cx="78" cy="61" r="3.5" fill="${c.hairColor}" ${S}/>`,
      rastas: `<path d="M24 30 Q26 6 50 7 Q74 6 76 30 Q66 18 50 20 Q34 18 24 30Z" fill="${c.hairColor}" ${S}/><path d="M24 28 V60 M29 24 V56 M71 24 V56 M76 28 V60" stroke="${c.hairColor}" stroke-width="4" stroke-linecap="round"/>`,
      ondulado: `<path d="M23 34 Q20 20 30 12 Q40 2 50 8 Q60 2 70 12 Q80 20 77 34 Q72 24 64 24 Q58 18 50 22 Q42 18 36 24 Q28 24 23 34Z" fill="${c.hairColor}" ${S}/>`,
      militar: `<path d="M26 26 Q28 10 50 10 Q72 10 74 26 Q62 18 50 18 Q38 18 26 26Z" fill="${c.hairColor}" ${S}/>`,
      emo: `<path d="M24 32 Q24 6 50 6 Q76 6 76 30 Q66 18 58 20 L46 46 L40 26 Q30 26 24 32Z" fill="${c.hairColor}" ${S}/>`, })[c.hair];
    else hd += ({ gorra: `<path d="M24 26 Q26 4 50 4 Q74 4 76 26Z" fill="${hatC}" ${S}/><path d="M50 26 H88 Q88 20 76 20" fill="${hatC}" ${S}/>`,
      gorro: `<path d="M24 26 Q24 0 50 0 Q76 0 76 26Z" fill="${hatC}" ${S}/><rect x="22" y="20" width="56" height="9" rx="4" fill="#fff" ${S}/><circle cx="50" cy="-2" r="6" fill="#fff" ${S}/>`,
      vaquero: `<path d="M12 22 Q50 34 88 22 Q80 30 50 30 Q20 30 12 22Z M32 22 Q32 0 50 2 Q68 0 68 22Z" fill="${hatC}" ${S}/>`,
      corona: `<path d="M28 22 L28 2 L38 12 L50 -4 L62 12 L72 2 L72 22Z" fill="${gold}" ${S}/><circle cx="50" cy="13" r="3" fill="#ef4444" stroke="#1e1b2e" stroke-width="1.5"/>`,
      sombrero_dorado: `<rect x="16" y="18" width="68" height="6" rx="3" fill="${gold}" ${S}/><rect x="32" y="-6" width="36" height="26" rx="3" fill="${gold}" ${S}/><rect x="32" y="12" width="36" height="5" fill="#1e1b2e"/>`,
      gorra_campeon: `<path d="M24 26 Q26 4 50 4 Q74 4 76 26Z" fill="${METAL.bronce}" ${S}/><path d="M50 26 H88 Q88 20 76 20" fill="${METAL.bronce}" ${S}/><path d="M45 16 l5 -8 5 8z" fill="#fff"/>` })[c.hat] || '';
    if (hw) hd += headwear(hw);
    // volumen: brillo de pelo, pliegues de ropa, sombra bajo la cabeza
    const hl = 'stroke="#fff" stroke-opacity=".38" fill="none" stroke-linecap="round"';
    const hairTop = !hatOn && c.hair !== 'calvo';
    if (hairTop) hd += ({ corto: `<path d="M34 13 Q44 8 58 10" ${hl} stroke-width="3"/>`, puntas: `<path d="M36 14 L39 8 M50 6 L52 12 M62 9 L63 15" ${hl} stroke-width="2"/>`,
      largo: `<path d="M33 14 Q44 8 60 10" ${hl} stroke-width="3"/><path d="M24 40 Q23 52 24 58" ${hl} stroke-width="2"/>`, afro: `<path d="M28 18 Q36 4 52 2" ${hl} stroke-width="4"/>`,
      cresta: `<path d="M48 16 Q47 4 50 1" ${hl} stroke-width="2"/>` })[c.hair] || '';
    if (hatOn) hd += `<path d="M34 10 Q44 4 58 6" ${hl} stroke-width="2.5"/>`;
    hd = `<ellipse cx="50" cy="60" rx="15" ry="4" fill="#000" opacity=".15"/>` + hd.replace(faceEl, faceEl + `<ellipse cx="42" cy="18" rx="11" ry="6" fill="#fff" opacity=".22"/>`);
    g += `<path d="M40 84 Q44 90 41 97 M60 82 Q56 90 59 97 M44 70 Q50 73 56 70" stroke="#000" stroke-opacity=".16" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M38 70 Q42 66 48 66" ${hl} stroke-width="2"/>`;
    g += `<path d="M44 106 V${legY - 2} M56 106 V${legY - 2}" stroke="#000" stroke-opacity=".14" stroke-width="1.4"/>`;
    // degradados: cada color sólido pasa a un degradado radial (luz arriba-izquierda)
    const u = 'av' + (++seq) + '_', gr = {}; let defs = '';
    const paint = str => str.replace(/fill="(#[0-9a-fA-F]{6})"/g, (m, col) => { const k = col.toLowerCase(); if (k === '#1e1b2e') return m;
      if (!gr[k]) { gr[k] = u + Object.keys(gr).length; const metal = Object.values(METAL).includes(k);
        defs += metal ? `<linearGradient id="${gr[k]}" x1="0" y1="0" x2=".6" y2="1"><stop offset="0" stop-color="${mix(k, .6)}"/><stop offset=".45" stop-color="${k}"/><stop offset=".6" stop-color="${mix(k, .35)}"/><stop offset="1" stop-color="${mix(k, -.4)}"/></linearGradient>`
          : `<radialGradient id="${gr[k]}" cx=".35" cy=".28" r=".85"><stop offset="0" stop-color="${mix(k, .42)}"/><stop offset=".55" stop-color="${k}"/><stop offset="1" stop-color="${mix(k, -.38)}"/></radialGradient>`; }
      return `fill="url(#${gr[k]})"`; });
    g = paint(g); hd = paint(hd);
    const size = opt.size || 48;
    if (opt.head) return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="16 -8 72 76" width="${size}" height="${size}" style="vertical-align:middle" aria-hidden="true"><defs>${defs}</defs>${hd}</svg>`;
    const studio = size >= 80 && opt.bg !== false;
    defs += `<radialGradient id="${u}sh"><stop offset="0" stop-color="#000" stop-opacity=".45"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>`;
    if (studio) defs += `<radialGradient id="${u}bg" cx=".5" cy=".38" r=".75"><stop offset="0" stop-color="#5b6b8f"/><stop offset=".6" stop-color="#2b3550"/><stop offset="1" stop-color="#151b2b"/></radialGradient>`;
    const bg = studio ? `<rect x="4" y="-8" width="92" height="152" rx="12" fill="url(#${u}bg)"/><ellipse cx="50" cy="141" rx="40" ry="6" fill="#fff" opacity=".06"/>` : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="4 -8 92 152" width="${size * 92 / 152}" height="${size}" style="vertical-align:middle" aria-hidden="true"><defs>${defs}</defs>${bg}<ellipse cx="50" cy="140.5" rx="25" ry="3.6" fill="url(#${u}sh)"/>${g}${hd}</svg>`;
  }
  const api = { CAT, DEFAULT, FACES, BODIES, LAYERS, SLOTS, CNAMES, COLORS, HAIRC, SKIN, validate, render, norm };
  if (typeof module !== 'undefined') module.exports = api; else root.Avatar = api;
})(this);
