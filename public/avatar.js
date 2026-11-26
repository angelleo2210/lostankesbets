// LosTankesBets: 13 avatares fijos (imagen). Sin capas ni colores.
(function (root) {
  const N = 13;
  const DEFAULT = { pick: 1 };
  const LAYERS = {}; // ropa por capas eliminada
  const SLOTS = [];
  const CAT = {};
  // Bundled extra avatars (tools/gen_avatars.py): string ids such as 'face-3', 'flag-mx', 'brand-nike', 'ini-azul'.
  const CATALOG = (typeof module !== 'undefined' && typeof require === 'function') ? require('./avatar-catalog') : (root.AvatarCatalog || {});
  const GROUPS = [['caricaturas', 'Caricaturas'], ['deportes', 'Deportes'], ['animales', 'Animales'], ['iniciales', 'Iniciales'], ['banderas', 'Banderas'], ['marcas', 'Marcas'], ['lujo', 'Marcas de lujo']];
  const GEN = {};
  for (const [g] of GROUPS) for (const [id, label, color] of (CATALOG[g] || [])) GEN[id] = { id, group: g, label, color };
  const isGen = p => typeof p === 'string' && Object.prototype.hasOwnProperty.call(GEN, p);
  const xmlEsc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
  const initialOf = name => { const m = String(name || '').trim().match(/[\p{L}\p{N}]/u); return m ? m[0].toUpperCase() : '?'; };
  const initialSrc = (pick, head, name) => {
    const c = GEN[pick].color || '#2563eb', w = 240, h = head ? 240 : 320, cy = h / 2;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c}"/><stop offset="1" stop-color="#0b1220"/></linearGradient></defs><rect x="2" y="2" width="${w - 4}" height="${h - 4}" rx="14" fill="url(#g)" stroke="#ffffff33" stroke-width="3"/><text x="120" y="${cy}" dy=".35em" text-anchor="middle" font-family="Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif" font-weight="800" font-size="128" fill="#fff">${xmlEsc(initialOf(name))}</text></svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  };
  const src = (pick, head, name) => {
    if (isGen(pick)) return GEN[pick].group === 'iniciales' ? initialSrc(pick, head, name) : `img/avatars/gen/${pick}${head ? '_head' : ''}.svg`;
    return `img/avatars/${Math.min(N, Math.max(1, pick|0))}${head ? '_head' : ''}.webp`;
  };
  const groupOf = p => isGen(p) ? GEN[p].group : 'originales';
  const labelOf = p => isGen(p) ? GEN[p].label : 'Avatar ' + p;
  /** Foto de racha W3/W5/L2/L3 para todos los picks (sin marco). */
  const streakKey = (st) => {
    if (!st || !st.kind) return null;
    if (st.kind === 'fuego') return st.intense ? 'w5' : 'w3';
    if (st.kind === 'hielo') return st.intense ? 'l3' : 'l2';
    return null;
  };
  const streakSrc = (pick, st, head) => {
    if (isGen(pick)) return null;
    const p = Math.min(N, Math.max(1, pick|0));
    if (head) return null; // head crops: sin variantes aún
    const k = streakKey(st);
    return k ? `img/avatars/${p}_${k}.webp` : null;
  };
  const norm = c => {
    let p = 1;
    if (c && typeof c === 'object' && isGen(c.pick)) return { pick: c.pick };
    if (c && typeof c === 'object') {
      if (Number.isFinite(+c.pick)) p = Math.min(N, Math.max(1, +c.pick | 0));
      else if (Number.isFinite(+c.id)) p = Math.min(N, Math.max(1, +c.id | 0));
    }
    return { pick: p || 1 };
  };
  function validate(c) {
    if (c == null) return { cfg: { ...DEFAULT } };
    if (typeof c !== 'object' || Array.isArray(c)) return { error: 'Avatar inválido' };
    if (typeof c.pick === 'string' && !/^\d+$/.test(c.pick)) return isGen(c.pick) ? { cfg: { pick: c.pick } } : { error: 'Avatar inválido' };
    if (c.pick != null || c.id != null) {
      const p = c.pick != null ? +c.pick : +c.id;
      if (!Number.isFinite(p) || p < 1 || p > N) return { error: 'Elige un avatar del 1 al 13' };
      return { cfg: { pick: p | 0 } };
    }
    // configs viejas (body/wear/hat/shirt/…) → pick 1
    return { cfg: { pick: 1 } };
  }
  const imgTag = (pick, opts = {}) => {
    const head = !!opts.head;
    const w = opts.w || (head ? 64 : 180), h = opts.h || (head ? w : Math.round(w * 4 / 3));
    const cls = opts.cls || '';
    const url = (opts.streak && streakSrc(pick, opts.streak, head)) || src(pick, head, opts.name);
    return `<img class="av-img ${cls}${isGen(pick) ? ' av-gen' : ''}" src="${url}" width="${w}" height="${h}" alt="${xmlEsc(labelOf(pick))}" draggable="false" loading="lazy">`;
  };
  function render(cfg, opt = {}) {
    const c = norm(cfg);
    if (opt.svg === false || opt.html) return imgTag(c.pick, opt);
    // compat: tests antiguos esperan SVG — devolvemos img HTML envuelto
    return imgTag(c.pick, opt);
  }
  const api = { N, DEFAULT, LAYERS, SLOTS, CAT, FACES: {}, BODIES: {}, COLORS: [], HAIRC: [], SKIN: [], CNAMES: {},
    validate, norm, render, src, streakSrc, streakKey, imgTag, GROUPS, GEN, isGen, groupOf, labelOf, initialOf, PICKS: Array.from({ length: N }, (_, i) => i + 1) };
  if (typeof module !== 'undefined') module.exports = api;
  root.Avatar = api;
})(typeof window !== 'undefined' ? window : globalThis);
