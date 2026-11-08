// LosTankesBets: 13 avatares fijos (imagen). Sin capas ni colores.
(function (root) {
  const N = 13;
  const DEFAULT = { pick: 1 };
  const LAYERS = {}; // ropa por capas eliminada
  const SLOTS = [];
  const CAT = {};
  const src = (pick, head) => `img/avatars/${Math.min(N, Math.max(1, pick|0))}${head ? '_head' : ''}.webp`;
  /** Foto de racha W3/W5/L2/L3 para todos los picks (sin marco). */
  const streakKey = (st) => {
    if (!st || !st.kind) return null;
    if (st.kind === 'fuego') return st.intense ? 'w5' : 'w3';
    if (st.kind === 'hielo') return st.intense ? 'l3' : 'l2';
    return null;
  };
  const streakSrc = (pick, st, head) => {
    const p = Math.min(N, Math.max(1, pick|0));
    if (head) return null; // head crops: sin variantes aún
    const k = streakKey(st);
    return k ? `img/avatars/${p}_${k}.webp` : null;
  };
  const norm = c => {
    let p = 1;
    if (c && typeof c === 'object') {
      if (Number.isFinite(+c.pick)) p = Math.min(N, Math.max(1, +c.pick | 0));
      else if (Number.isFinite(+c.id)) p = Math.min(N, Math.max(1, +c.id | 0));
    }
    return { pick: p || 1 };
  };
  function validate(c) {
    if (c == null) return { cfg: { ...DEFAULT } };
    if (typeof c !== 'object' || Array.isArray(c)) return { error: 'Avatar inválido' };
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
    const url = (opts.streak && streakSrc(pick, opts.streak, head)) || src(pick, head);
    return `<img class="av-img ${cls}" src="${url}" width="${w}" height="${h}" alt="Avatar ${pick}" draggable="false" loading="lazy">`;
  };
  function render(cfg, opt = {}) {
    const c = norm(cfg);
    if (opt.svg === false || opt.html) return imgTag(c.pick, opt);
    // compat: tests antiguos esperan SVG — devolvemos img HTML envuelto
    return imgTag(c.pick, opt);
  }
  const api = { N, DEFAULT, LAYERS, SLOTS, CAT, FACES: {}, BODIES: {}, COLORS: [], HAIRC: [], SKIN: [], CNAMES: {},
    validate, norm, render, src, streakSrc, streakKey, imgTag, PICKS: Array.from({ length: N }, (_, i) => i + 1) };
  if (typeof module !== 'undefined') module.exports = api;
  root.Avatar = api;
})(typeof window !== 'undefined' ? window : globalThis);
