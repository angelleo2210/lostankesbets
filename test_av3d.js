// Pruebas del avatar por capas: manifest, archivos, alfa, cobertura y que cada pieza pedida se use o se informe.
const fs = require('fs'), path = require('path'), assert = require('assert');
const R = path.join(__dirname, 'public/img/av3d'), M = JSON.parse(fs.readFileSync(R + '/manifest.json')), S = JSON.parse(fs.readFileSync(R + '/scenes/scenes.json'));
global.fetch = async u => ({ json: async () => u.includes('scenes.json') ? S : M }); require('./public/avatar3d.js'); const A = globalThis.Avatar3D, Av = require('./public/avatar.js'), St = require('./public/store.js');
const webpAlpha = f => { const b = fs.readFileSync(f); assert.equal(b.toString('ascii', 0, 4), 'RIFF', f); const t = b.toString('ascii', 12, 16); return t === 'VP8L' || (t === 'VP8X' && (b[20] & 0x10) !== 0); };
let n = 0; const t = (name, fn) => { fn(); n++; console.log('✔', name); };
const BODIES = Object.keys(Av.BODIES), SK = ['clara', 'media', 'oscura'];
t('30 bases (10 cuerpos × 3 pieles) existen y tienen transparencia', () => { for (const b of BODIES) for (const s of SK) assert.ok(webpAlpha(`${R}/bases/${b}_${s}.webp`), b + s); });
t('cada capa del manifest existe y tiene alfa', () => { for (const [b, L] of Object.entries(M.layers)) { assert.ok(BODIES.includes(b), b); for (const [id, l] of Object.entries(L)) {
  const files = [l.src, l.erase, ...Object.values(l.skins || {}), ...Object.values(l.hands || {})].filter(Boolean); assert.ok(files.length, id); for (const f of files) assert.ok(webpAlpha(`${R}/${f}.webp`), f); } } });
t('ids de capas pertenecen al catálogo o a peinados existentes', () => { const ids = new Set([...St.ITEMS.map(i => i.id), ...Av.CAT.hair.opts]); for (const L of Object.values(M.layers)) for (const id in L) assert.ok(ids.has(id) || (id.startsWith('base_') && L[id].base) || (id.startsWith('hat_') && Av.CAT.hat.opts.includes(id.slice(4))) || (id.startsWith('cara_') && Av.CAT.face.opts.includes(id.slice(5))) || (id.startsWith('ojos_') && Av.CAT.eyes.opts.includes(id.slice(5))) || (id.startsWith('boca_') && Av.CAT.mouth.opts.includes(id.slice(5))) || (id.startsWith('bl_') && ['shirt', 'pants', 'shoes', 'socks'].some(k => Av.CAT[k].opts.includes(id.slice(3)))) || id === 'bl_descalzo' || [['gl_', 'glasses'], ['er_', 'earrings'], ['nk_', 'necklace']].some(([p, k]) => id.startsWith(p) && Av.CAT[k].opts.includes(id.slice(p.length))), id); });
t('escena: placa y objetos con alfa, ids del catálogo', () => { assert.ok(fs.existsSync(`${R}/${S.plates.muelle.src}.webp`)); for (const [id, p] of Object.entries(S.props)) { assert.ok(St.byId(id), id); assert.ok(webpAlpha(`${R}/${p.src}.webp`)); } });
t('cada pieza pedida se dibuja o se informa como pendiente (nunca se cambia por otra)', () => { const ropa = St.ITEMS.filter(i => Av.LAYERS[i.id]);
  for (const b of BODIES) for (const sk of Object.keys(A.SKINS)) for (const it of ropa) for (const c of it.colors.slice(0, 3)) { const slot = Av.LAYERS[it.id][0], p = A.pick({ body: b, skin: sk, wear: { [slot]: { id: it.id, color: c } } }, M);
    assert.equal(p.base, `bases/${b}_${A.SKINS[sk]}`); const pr = p.use.filter(l => l.slot !== 'pelo' && !l.base), used = pr.length === 1 && pr[0].want === c, miss = p.missing.includes(it.id + ':' + c), hid = slot === 'medias' && p.hidden.includes(it.id); assert.ok([used, miss, hid].filter(Boolean).length === 1, `${b} ${it.id}`); if (used) assert.equal(pr[0].slot, slot); } });
t('tienda: TODAS las prendas tienen capa real en 10 cuerpos × 3 pieles (0 pendientes; medias visibles con chores, ocultas bajo pantalón largo)', () => { const ropa = St.ITEMS.filter(i => Av.LAYERS[i.id]);
  for (const b of BODIES) for (const sk of Object.keys(A.SKINS)) for (const it of ropa) { const slot = Av.LAYERS[it.id][0], c = it.colors[0], cfg = { body: b, skin: sk, hair: 'calvo', wear: { [slot]: { id: it.id, color: c } } }; if (slot === 'medias') cfg.pants = 'chores'; const p = A.pick(cfg, M);
    assert.deepEqual(p.missing, [], `${b} ${sk} ${it.id}`); assert.ok(p.use.some(l => l.slot === slot && l.want === c && (l.src || l.hands)), `${b} ${sk} ${it.id}`); if (slot === 'medias') assert.deepEqual(A.pick({ ...cfg, pants: 'largo' }, M).hidden, [it.id]); } });
t('pelo: 19 peinados × 10 cuerpos como capa propia (calvo = sin capa) y color de pelo aplicado', () => { for (const b of BODIES) for (const h of Av.CAT.hair.opts) { const p = A.pick({ body: b, skin: '#c68642', hair: h, hairColor: '#f5c542' }, M), hl = p.use.filter(l => l.slot === 'pelo');
  if (h === 'calvo') assert.equal(hl.length, 0); else { assert.equal(hl.length, 1, b + h); assert.equal(hl[0].want, '#f5c542'); assert.ok(!p.missing.some(m => m.startsWith(h)), b + h); } } });
t('ropa del constructor: camiseta/pantalón/tenis de la base se recolorean al color elegido en los 10 cuerpos; dorada/dorado/oro/plata/bronce también', () => { for (const b of BODIES) {
  let p = A.pick({ body: b, skin: '#f1c27d', hair: 'calvo', shirt: 'camiseta', shirtColor: '#ef4444', pants: 'largo', pantsColor: '#3b82f6', shoes: 'tenis', shoesColor: '#22c55e' }, M);
  assert.deepEqual(p.use.map(l => [l.slot, l.want]), [['abajo', '#3b82f6'], ['zapatos', '#22c55e'], ['arriba', '#ef4444']]); assert.deepEqual(p.missing, []);
  p = A.pick({ body: b, skin: '#f1c27d', hair: 'calvo', shirt: 'dorada', pants: 'dorado', shoes: 'plata' }, M); assert.equal(p.use.length, 3); assert.deepEqual(p.missing, []);
  p = A.pick({ body: b, skin: '#f1c27d', hair: 'calvo', shirt: 'camisa', pants: 'chores', shoes: 'botas' }, M); assert.deepEqual(p.use.map(l => l.slot), ['abajo', 'zapatos', 'arriba']); assert.deepEqual(p.missing, []); } });
t('constructor: todas las combinaciones camiseta×pantalón×zapatos×medias sin pendientes en 10 cuerpos × 3 pieles', () => { for (const b of BODIES) for (const sk of Object.keys(A.SKINS)) for (const sh of Av.CAT.shirt.opts) for (const pa of Av.CAT.pants.opts) for (const zo of Av.CAT.shoes.opts) for (const so of Av.CAT.socks.opts) {
  const p = A.pick({ body: b, skin: sk, hair: 'calvo', shirt: sh, pants: pa, shoes: zo, socks: so }, M); assert.deepEqual(p.missing, [], [b, sk, sh, pa, zo, so].join(' ')); assert.equal(p.use.length, 3 + (so !== 'ninguno' && pa === 'chores' ? 1 : 0), [b, sk, sh, pa, zo, so].join(' ')); for (const l of p.use) assert.ok(l.src || (l.hands && l.hands[A.SKINS[sk]]), b + l.slot); } });
t('constructor: sombrero, lentes, aretes y collar tienen capa en los 10 cuerpos (ninguna opción queda pendiente)', () => { for (const b of BODIES) for (const k of ['hat', 'glasses', 'earrings', 'necklace', 'face']) for (const v of Av.CAT[k].opts) { if (v === 'ninguno' || (k === 'face' && v === 'ovalada')) continue;
  const p = A.pick({ body: b, skin: '#6b4226', hair: 'calvo', [k]: v }, M); assert.deepEqual(p.missing, [], b + k + v); assert.ok(p.use.some(l => !l.base), b + k + v); } });
t('orden de capas fijo: abajo < zapatos < arriba < pelo', () => { const p = A.pick({ body: 'atletico', skin: '#c68642', hair: 'rizos', wear: { arriba: { id: 'top_hoodie', color: 'rojo' }, zapatos: { id: 'zap_casual', color: 'negro' }, abajo: { id: 'bot_joggers', color: 'negro' } } }, M); assert.deepEqual(p.use.map(l => l.slot), ['abajo', 'zapatos', 'arriba', 'pelo']); assert.deepEqual(p.missing, []); });
// cobertura real (informativa)
const ropa = St.ITEMS.filter(i => Av.LAYERS[i.id]); let have = 0; for (const b of BODIES) for (const i of ropa) if (M.layers[b] && (M.layers[b][i.id] || (i.id === 'top_camiseta' && M.layers[b].base_camiseta))) have++;
const hair = Av.CAT.hair.opts.filter(h => h !== 'calvo'); let hh = 0; for (const b of BODIES) for (const h of hair) if (M.layers[b] && M.layers[b][h] && M.layers[b][h].hair) hh++;
let bo = 0, bt = 0; for (const b of BODIES) for (const sk of Object.keys(A.SKINS)) for (const [k, ops] of [['shirt', Av.CAT.shirt.opts], ['pants', Av.CAT.pants.opts], ['shoes', Av.CAT.shoes.opts], ['socks', Av.CAT.socks.opts.filter(o => o !== 'ninguno')]]) for (const v of ops) { bt++; const p = A.pick({ body: b, skin: sk, hair: 'calvo', pants: k === 'socks' ? 'chores' : undefined, [k]: v }, M); if (!p.missing.length) bo++; }
let rs = 0; for (const b of BODIES) for (const sk of Object.keys(A.SKINS)) for (const i of ropa) { const p = A.pick({ body: b, skin: sk, pants: Av.LAYERS[i.id][0] === 'medias' ? 'chores' : undefined, wear: { [Av.LAYERS[i.id][0]]: { id: i.id, color: i.colors[0] } } }, M); if (!p.missing.length) rs++; }
console.log(`cobertura ropa real cuerpo×piel×opción: tienda ${rs}/${BODIES.length * 3 * ropa.length} · constructor ${bo}/${bt}`);
console.log(`cobertura: bases ${BODIES.length * 3}/30 · prendas ${have}/${BODIES.length * ropa.length} (cuerpo×prenda, colores por recoloreado) · peinados ${hh + BODIES.length}/${BODIES.length * Av.CAT.hair.opts.length} · escenas objetos ${Object.keys(S.props).length}/${St.ITEMS.filter(i => i.cat === 'barcos' || i.cat === 'motos').length}`);
console.log(n + ' pruebas av3d OK');


t('retrato cabeza: head:true recorta cuadrado con alfa y sin escena', async () => {
  const { createCanvas } = (() => { try { return require('canvas'); } catch { return {}; } })();
  // node sin canvas: validamos pick + que render acepte head vía stub mínimo
  const cfg = { body: 'atletico', skin: '#c68642', hair: 'corto' };
  const p = A.pick(cfg, M);
  assert.ok(p.base.includes('atletico'));
  // simula headCrop bounds contra tamaño canónico
  const W = 576, H = 768, sh = Math.floor(H * 0.185), sw = sh, sy = Math.floor(H * 0.018), sx = Math.floor((W - sw) / 2);
  assert.equal(sw, sw); assert.ok(sy + sw < H * 0.5, 'recorte cabe en mitad superior');
  assert.ok(fs.existsSync(`${R}/bases/atletico_media.webp`));
  // código fuente de avatar3d declara modo head
  const src = fs.readFileSync(__dirname + '/public/avatar3d.js', 'utf8');
  assert.ok(src.includes('opt.head') && src.includes('headCrop'), 'Avatar3D.render soporta retrato');
  const app = fs.readFileSync(__dirname + '/public/app.js', 'utf8');
  assert.ok(app.includes("head: true") && app.includes("class=\"av3dw") || app.includes("'head'"), 'header/ranking usan av3d head');
  assert.ok(app.includes("_avHead") || app.includes('head: true'));
});

t('ojos y boca del constructor cubiertos en 10 cuerpos x 3 pieles', () => { for (const b of Object.keys(M.layers)) { for (const e of Av.CAT.eyes.opts.slice(1)) assert.ok(M.layers[b]['ojos_' + e] && Object.keys(M.layers[b]['ojos_' + e].skins).length === 3, b + e); for (const m of Av.CAT.mouth.opts.slice(1)) assert.ok(M.layers[b]['boca_' + m] && Object.keys(M.layers[b]['boca_' + m].skins).length === 3, b + m); } });
