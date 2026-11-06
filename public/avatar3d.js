// LosTankesBets: avatar semirrealista por capas alineadas (base por cuerpo×piel + capas por cuerpo).
// Las prendas se recolorean dentro de su máscara al color comprado. Si una pieza aún no tiene capa, se informa (nunca se sustituye por otra).
(function (root) {
  const R = '/img/av3d/', W = 576, H = 768, ORDER = ['cara', 'ojos', 'boca', 'abajo', 'medias', 'zapatos', 'arriba', 'cadenas', 'pulseras', 'mochila', 'aretes', 'pelo', 'lentes', 'cabeza'];
  const SKINS = { '#f1c27d': 'clara', '#c68642': 'media', '#6b4226': 'oscura' };
  const HEX = { rojo: '#dc2626', azul: '#1d4ed8', verde: '#16a34a', dorado: '#d4a017', blanco: '#f1f5f9', negro: '#1b1f27', oro: '#d4af37', plata: '#c0c0c0', rosa: '#e7a3a8', esmeralda: '#10b981', zafiro: '#1e40af' };
  let P; const data = () => P || (P = Promise.all([fetch(R + 'manifest.json').then(r => r.json()), fetch(R + 'scenes/scenes.json').then(r => r.json())]).then(([m, s]) => ({ m, s })));
  const IM = {}; const img = s => IM[s] || (IM[s] = new Promise((ok, ko) => { const i = new Image(); i.decoding = 'async'; i.onload = () => ok(i); i.onerror = () => ko(new Error('Falta ' + s)); i.src = R + s + '.webp'; }));
  const cv = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  // Recoloreado perceptual en CIELAB dentro de la máscara: conserva la luminancia relativa (relieve, pliegues, brillos)
  // y la saturación relativa de la pieza; sólo cambia tono/croma/nivel medio. Blancos y negros con margen para no quemar ni aplastar.
  const lin = v => (v /= 255) <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4), gam = v => 255 * (v <= .0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - .055);
  const fL = t => t > .008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116, iL = t => t > .2069 ? t * t * t : (t - 16 / 116) / 7.787;
  function lab(r, g, b) { r = lin(r); g = lin(g); b = lin(b); const x = fL((.4124 * r + .3576 * g + .1805 * b) / .95047), y = fL(.2126 * r + .7152 * g + .0722 * b), z = fL((.0193 * r + .1192 * g + .9505 * b) / 1.08883); return [116 * y - 16, 500 * (x - y), 200 * (y - z)]; }
  function rgbOf(L, A, B) { const y = (L + 16) / 116, x = iL(y + A / 500) * .95047, Y = iL(y), z = iL(y - B / 200) * 1.08883;
    return [gam(3.2406 * x - 1.5372 * Y - .4986 * z), gam(-.9689 * x + 1.8758 * Y + .0415 * z), gam(.0557 * x - .2040 * Y + 1.0570 * z)]; }
  const hue = ([r, g, b]) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (!d) return 0; const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return (h * 60 + 360) % 360; };
  const RC = {};
  async function recolor(src, from, to, lum, sel) { const k = src + '|' + to; if (RC[k]) return RC[k];
    return RC[k] = (async () => { const i = await img(src), pm = sel && sel.paint ? await img(sel.paint) : null; if (!to || to === from || (HEX[to] || to) === (HEX[from] || from)) return i; const c = cv(), x = c.getContext('2d'); x.drawImage(i, 0, 0);
      let pmd = null; if (pm) { const c2 = cv(), x2 = c2.getContext('2d'); x2.drawImage(pm, 0, 0); pmd = x2.getImageData(0, 0, W, H).data; }
      const d = x.getImageData(0, 0, W, H), p = d.data, n = p.length / 4, Ls = new Float32Array(n), As = new Float32Array(n), Bs = new Float32Array(n), Wt = new Float32Array(n);
      const fh = sel ? hue(rgb(HEX[from] || from)) : 0; let sw = 0, sL = 0, sC = 0;
      for (let q = 0, j = 0; q < n; q++, j += 4) { if (!p[j + 3]) continue; const [L, A, B] = lab(p[j], p[j + 1], p[j + 2]); Ls[q] = L; As[q] = A; Bs[q] = B; let w = 1;
        // objetos: máscara SOLO de pintura (tono del color de origen y saturada); cromados, llantas, cristales y faros quedan intactos
        if (sel) { const C = Math.hypot(A, B), dh = Math.abs(((hue([p[j], p[j + 1], p[j + 2]]) - fh + 540) % 360) - 180); w = Math.min(1, Math.max(0, (C - sel.c) / 12)) * Math.min(1, Math.max(0, (sel.h - dh) / 12)) * Math.min(1, Math.max(0, ((sel.l || 92) - L) / 8)); if (pmd) w = sel.only ? pmd[j + 3] / 255 : w * pmd[j + 3] / 255; }
        Wt[q] = w; const a = w * p[j + 3] / 255; sw += a; sL += a * L; sC += a * Math.hypot(A, B); }
      if (!sw) return i; const mL = sL / sw, mC = sC / sw, [tL0, tA, tB] = lab(...rgb(HEX[to] || to)), tC = Math.hypot(tA, tB), th = Math.atan2(tB, tA);
      const tL = Math.min(86, Math.max(16, tL0)), gain = tL0 < 25 ? .8 : (mC < 8 && mL > 70 ? 1.7 : mL < 30 ? 1.25 : 1.0), sat = sel ? .8 : .78; // margen para relieve en blancos/negros
      for (let q = 0, j = 0; q < n; q++, j += 4) { const w = Wt[q]; if (!w || !p[j + 3]) continue; let L = tL + (Ls[q] - mL) * gain;
        if (L > tL) { const hr = 99 - tL; L = tL + hr * (1 - Math.exp(-(L - tL) / Math.max(hr, 1))); } // rodilla suave: los brillos no se queman
        else { const dr = Math.max(8, tL * .45); L = tL - dr * (1 - Math.exp(-(tL - L) / dr)); } // sombras con rodilla: relieve sin rayas negras
        const cs = Math.hypot(As[q], Bs[q]), rel = mC > 8 ? Math.min(1.15, cs / mC) : 1, fall = Math.max(0, 1 - Math.pow((L - tL) / 55, 2));
        const C = tC * sat * rel * fall, o = rgbOf(L, C * Math.cos(th), C * Math.sin(th));
        for (let z = 0; z < 3; z++) { const v = p[j + z] + (o[z] - p[j + z]) * w; p[j + z] = v < 0 ? 0 : v > 255 ? 255 : v; } }
      x.putImageData(d, 0, 0); return c; })(); }
  // tono de piel: exacto o el más cercano de los 3 (nunca por defecto silencioso)
  function skinOf(h) { if (SKINS[h]) return SKINS[h]; if (!/^#[0-9a-f]{6}$/i.test(h || '')) return 'clara'; const v = x => [1, 3, 5].map(i => parseInt(x.substr(i, 2), 16)); const a = v(h); let best = 'clara', bd = 1e9; for (const [k, n] of Object.entries(SKINS)) { const b = v(k), d = a.reduce((s, x, i) => s + (x - b[i]) ** 2, 0); if (d < bd) { bd = d; best = n; } } return best; }
  function pick(cfg, M) { const body = cfg.body || 'promedio', skin = skinOf(cfg.skin), L = M.layers[body] || {}, use = [], missing = [];
    const want = []; for (const [slot, w] of Object.entries(cfg.wear || {})) if (w && w.id) want.push({ slot, id: w.id, color: w.color });
    const hair = cfg.hair || 'ondulado'; if (hair !== 'calvo') want.push({ slot: 'pelo', id: hair, color: cfg.hairColor || '#1f1300' });
    if (cfg.face && cfg.face !== 'ovalada') want.push({ slot: 'cara', id: 'cara_' + cfg.face, color: null }); // forma de cara: deformación propia de cada cuerpo y piel
    // opciones del constructor (no compradas) aún sin capa propia: se informan, no se ignoran
    const D = {};
    // ojos y boca: parche facial por cuerpo y piel (normales/sonrisa = rostro base)
    if (cfg.eyes && cfg.eyes !== 'normales') want.push({ slot: 'ojos', id: 'ojos_' + cfg.eyes, color: null });
    if (cfg.mouth && cfg.mouth !== 'sonrisa') want.push({ slot: 'boca', id: 'boca_' + cfg.mouth, color: null });
    // lentes, aretes y collar del constructor: capas propias transferidas a cada cuerpo
    for (const [k, pre, slot] of [['glasses', 'gl_', 'lentes'], ['earrings', 'er_', 'aretes'], ['necklace', 'nk_', 'cadenas']]) if (cfg[k] && cfg[k] !== 'ninguno' && !(slot === 'cadenas' && cfg.wear && cfg.wear.cadenas && cfg.wear.cadenas.id)) want.push({ slot, id: pre + cfg[k], color: null });
    // sombrero del constructor (si no lleva uno comprado puesto)
    if (cfg.hat && cfg.hat !== 'ninguno' && !(cfg.wear && cfg.wear.cabeza && cfg.wear.cabeza.id)) want.push({ slot: 'cabeza', id: 'hat_' + cfg.hat, color: cfg.hatColor || null });
    for (const [k, v] of Object.entries(D)) if (cfg[k] && cfg[k] !== v) missing.push(k + ' ' + cfg[k]);
    // ropa del constructor (no comprada): la base ya viste camiseta, pantalón largo y tenis; se recolorean dentro de su máscara al color elegido
    const wr = cfg.wear || {}, MET = { oro: '#d4af37', plata: '#c0c0c0', bronce: '#b87333' }, add = (k, c) => L[k] && use.push({ ...L[k], want: c });
    const BL = (id, c, what) => { if (L[id]) use.push({ ...L[id], want: c }); else missing.push(what); };
    if (!wr.arriba) { if (cfg.shirt === 'dorada') add('base_camiseta', '#d4a017'); else if (!cfg.shirt || cfg.shirt === 'camiseta') add('base_camiseta', cfg.shirtColor || null); else BL('bl_' + cfg.shirt, cfg.shirtColor || null, 'camiseta ' + cfg.shirt); }
    const corto = !wr.abajo && cfg.pants === 'chores';
    if (!wr.abajo) { if (cfg.pants === 'dorado') add('base_largo', '#d4a017'); else if (!cfg.pants || cfg.pants === 'largo') add('base_largo', cfg.pantsColor || null); else BL('bl_' + cfg.pants, cfg.pantsColor || null, 'pantalón ' + cfg.pants); }
    if (!wr.zapatos) { if (MET[cfg.shoes]) add('base_tenis', MET[cfg.shoes]); else if (!cfg.shoes || cfg.shoes === 'tenis') add('base_tenis', cfg.shoesColor || null); else BL(cfg.shoes === 'ninguno' ? 'bl_descalzo' : 'bl_' + cfg.shoes, cfg.shoesColor || null, 'zapatos ' + cfg.shoes); }
    // medias: se ven con chores; bajo pantalón largo quedan tapadas (como en la realidad) y se informa en hidden, no como faltante
    const hidden = [];
    if (!wr.medias && cfg.socks && cfg.socks !== 'ninguno') { const id = 'bl_' + (cfg.socks === 'doradas' ? 'largas' : cfg.socks), c = cfg.socks === 'doradas' ? '#d4a017' : (cfg.socksColor || null); if (!L[id]) missing.push('medias ' + cfg.socks); else if (corto) use.push({ ...L[id], want: c }); else hidden.push('medias ' + cfg.socks); }
    { const i = want.findIndex(w => w.slot === 'medias'); if (i >= 0 && !corto && L[want[i].id]) { hidden.push(want[i].id); want.splice(i, 1); } }
    for (const w of want) { const l = L[w.id] || (w.id === 'top_camiseta' && L.base_camiseta ? { ...L.base_camiseta, base: false } : null); if (l) use.push({ ...l, want: w.color }); else missing.push(w.id + (w.color ? ':' + w.color : '')); }
    use.sort((a, b) => ORDER.indexOf(a.slot) - ORDER.indexOf(b.slot));
    return { base: `bases/${body}_${skin}`, body, skin, use, missing, hidden }; }
  async function person(cfg) { const { m } = await data(), p = pick(cfg || {}, m), c = cv(), x = c.getContext('2d');
    const parts = await Promise.all([img(p.base), ...p.use.map(l => Promise.all([l.erase ? img(l.erase) : null, l.skins ? img(l.skins[p.skin]) : !l.src ? null : (l.color ? recolor(l.src, l.color, l.want, l.lum, l.sel) : img(l.src)), l.hands ? img(l.hands[p.skin]) : null]))]);
    x.drawImage(parts[0], 0, 0);
    parts.slice(1).forEach(([er, pa, hn]) => { if (er) { x.globalCompositeOperation = 'destination-out'; x.drawImage(er, 0, 0); x.globalCompositeOperation = 'source-over'; } if (pa) x.drawImage(pa, 0, 0); if (hn) x.drawImage(hn, 0, 0); });
    return { canvas: c, info: p }; }
  function shadow(x, cx, cy, rw, a = .55) { x.save(); x.translate(cx, cy); x.scale(1, .16); const g = x.createRadialGradient(0, 0, 2, 0, 0, rw); g.addColorStop(0, `rgba(10,5,0,${a})`); g.addColorStop(1, 'rgba(10,5,0,0)'); x.fillStyle = g; x.fillRect(-rw, -rw, rw * 2, rw * 2); x.restore(); }
  // opt.scene = { yate: {id,color}, moto: {id,color} }  → muelle con los objetos que tenga; sin ninguno: estudio.
  async function render(target, cfg, opt = {}) { const { s } = await data(), x = target.getContext('2d'), sc = opt.scene || {}, miss = [];
    const prop = k => { const o = sc[k]; if (!o) return null; const pr = s.props[o.id]; if (!pr) { miss.push(o.id + ':' + o.color); return null; } return { ...pr, want: o.color }; };
    const y = prop('yate'), mo = prop('moto'), dock = !!(sc.yate || sc.moto), [{ canvas: pc, info }, plate, yi, mi] = await Promise.all([person(cfg), dock ? img(s.plates.muelle.src) : null, y && recolor(y.src, y.color, y.want, y.lum, y.sel || { c: 18, h: 28 }), mo && recolor(mo.src, mo.color, mo.want, mo.lum, mo.sel || { c: 18, h: 28 })]);
    const TW = opt.w || W, TH = opt.h || H; target.width = TW; target.height = TH; const k = TW / W;
    if (dock) { x.drawImage(plate, 0, 0, TW, TH); if (yi) x.drawImage(yi, 0, 0, TW, TH);
      const pl = s.plates.muelle.person, ph = TH * pl.h, pw = ph * W / H, px = TW * pl.x, py = TH * pl.y - ph * .975;
      shadow(x, px + pw * .47, py + ph * .955, pw * .36); if (mi) { shadow(x, TW * .72, TH * .80, TW * .3, .45); }
      // luz cálida suave desde la izquierda, sin tapar la textura
      const t = cv(), tx = t.getContext('2d'); tx.drawImage(pc, 0, 0); tx.globalCompositeOperation = 'source-atop'; const lg = tx.createLinearGradient(0, 0, W, 0); lg.addColorStop(0, 'rgba(255,170,90,.12)'); lg.addColorStop(1, 'rgba(70,40,90,.10)'); tx.fillStyle = lg; tx.fillRect(0, 0, W, H);
      x.drawImage(t, px, py, pw, ph); if (mi) x.drawImage(mi, 0, 0, TW, TH);
    } else { const g = x.createRadialGradient(TW / 2, TH * .4, 20 * k, TW / 2, TH * .45, TH * .7); g.addColorStop(0, '#3a4257'); g.addColorStop(1, '#14171f'); x.fillStyle = g; x.fillRect(0, 0, TW, TH);
      shadow(x, TW * .46, TH * .925, TW * .3, .6); x.drawImage(pc, 0, 0, TW, TH); }
    return { ...info, missing: [...info.missing, ...miss] }; }
  // Monta todos los <canvas data-av3d='{"cfg":..,"scene":..}'> que aparezcan en la página
  function mount(rootEl = document) { rootEl.querySelectorAll('canvas[data-av3d]:not([data-done])').forEach(c => { c.dataset.done = 1; let o; try { o = JSON.parse(c.dataset.av3d); } catch { return; }
    render(c, o.cfg, o).then(i => { const n = c.parentElement && c.parentElement.querySelector('.av3dmiss'); if (n) n.textContent = i.missing.length ? `Piezas aún en producción (se muestran cuando estén listas): ${i.missing.join(', ')}` : ''; c.dataset.missing = i.missing.join(','); if (c.parentElement) c.parentElement.classList.toggle('pend', i.missing.length > 0); })
      .catch(e => { c.dataset.error = e.message; }); }); }
  if (typeof document !== 'undefined' && typeof MutationObserver !== 'undefined') { const ob = new MutationObserver(() => mount()); const st = () => { ob.observe(document.body, { childList: true, subtree: true }); mount(); }; document.body ? st() : addEventListener('DOMContentLoaded', st); }
  root.Avatar3D = { render, person, pick, mount, data, recolor, SKINS };
})(typeof window !== 'undefined' ? window : globalThis);
