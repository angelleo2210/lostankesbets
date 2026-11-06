// Avatares estáticos 1..9 (sin capas 3D)
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Av = require('./public/avatar');
const St = require('./public/store');
let n = 0; const t = (name, fn) => { try { fn(); n++; console.log('ok', name); } catch (e) { console.error('FAIL', name, e); process.exitCode = 1; } };

t('PICKS 1..9 y DEFAULT', () => { assert.deepEqual(Av.PICKS, [1,2,3,4,5,6,7,8,9]); assert.deepEqual(Av.DEFAULT, { pick: 1 }); assert.deepEqual(Av.LAYERS, {}); });
t('norm y validate', () => {
  assert.deepEqual(Av.norm(null), { pick: 1 });
  assert.deepEqual(Av.norm({ pick: 5 }), { pick: 5 });
  assert.deepEqual(Av.norm({ id: 8 }), { pick: 8 });
  assert.deepEqual(Av.norm({ body: 'x', wear: {} }), { pick: 1 });
  assert.deepEqual(Av.validate({ pick: 3 }).cfg, { pick: 3 });
  assert.ok(Av.validate({ pick: 99 }).error);
  assert.deepEqual(Av.validate({ hat: 'corona' }).cfg, { pick: 1 });
});
t('archivos webp existen', () => {
  for (const i of Av.PICKS) {
    assert.ok(fs.statSync(path.join(__dirname, 'public/img/avatars', i + '.webp')).size > 5000);
    assert.ok(fs.statSync(path.join(__dirname, 'public/img/avatars', i + '_head.webp')).size > 2000);
  }
});
t('render/imgTag', () => {
  assert.match(Av.render({ pick: 2 }), /img\/avatars\/2\.webp/);
  assert.match(Av.render({ pick: 2 }, { head: true }), /2_head\.webp/);
  assert.match(Av.imgTag(6, { w: 100, h: 133 }), /avatars\/6\.webp/);
});
t('Mis apuestas estilo Hard Rock (banner + Apostado/Cobrado)', () => {
  const src = fs.readFileSync(path.join(__dirname, 'public/app.js'), 'utf8');
  const i = src.indexOf("tab === 'mias'"), j = src.indexOf("tab === 'tabla'");
  const m = src.slice(i, j);
  assert.ok(m.includes('hrb-banner') && m.includes('GANASTE') && m.includes('hrb-money'));
  assert.ok(m.includes('Apostado') && m.includes('Cobrado') && m.includes('Ver selecciones'));
  assert.ok(!m.includes('head(me'));
  const css = fs.readFileSync(path.join(__dirname, 'public/index.html'), 'utf8');
  assert.ok(css.includes('.hrb.bet-won') && css.includes('.hrb-money'));
});
t('líneas: odds grid alineado y sin Monto por fila', () => {
  const src = fs.readFileSync(path.join(__dirname, 'public/app.js'), 'utf8');
  const i = src.indexOf('function lineCard'), j = src.indexOf('function boletoCard');
  const lc = src.slice(i, j);
  assert.ok(lc.includes('line-row') && lc.includes('class="odds') && lc.includes('data-add'));
  assert.ok(!lc.includes('placeholder="Monto"') && !lc.includes('>Apostar</button>'));
  const b = src.slice(src.indexOf('function boletoCard'), src.indexOf('function bindBets'));
  assert.ok(src.includes('boleto.length === 1') && src.includes("/bet"));
});
t('portada sin pertenencias/jetski', () => { const src = fs.readFileSync(path.join(__dirname, 'public/app.js'), 'utf8');
  const i = src.indexOf('const coverBanner'); const j = src.indexOf('const composite');
  const cov = src.slice(i, j);
  assert.ok(!cov.includes('cover-loot') && !cov.includes('owned') && !cov.includes('propThumb')); });
t('app sin pestaña Tienda', () => { const src = fs.readFileSync(path.join(__dirname, 'public/app.js'), 'utf8');
  assert.ok(!src.includes("[\'tienda\', \'Tienda\']") && !src.includes('storeView') && !src.includes('🛍️ Tienda')); });
t('tienda sin categoría ropa', () => { assert.ok(!St.CATS.some(c => c[0] === 'ropa')); assert.ok(St.CATS.some(c => c[0] === 'motos')); });

t('tabla: podium + feed + filtros + fila propia + glow 1º', () => {
  const src = fs.readFileSync(path.join(__dirname, 'public/app.js'), 'utf8');
  const i = src.indexOf("tab === 'tabla'"), j = src.indexOf("tab === 'perfil'");
  const block = src.slice(i, j === -1 ? i + 2500 : j);
  assert.ok(block.includes('tb-podium') && block.includes('tb-pod-') && block.includes('tb-feed'));
  assert.ok(block.includes('data-tp') && block.includes('hoy') && block.includes('semana') && block.includes('temporada'));
  assert.ok(block.includes('tb-row') && block.includes('winPct') && block.includes('streakEmoji') && block.includes('tb-you'));
  assert.ok(block.includes("/tabla?period="));
  assert.ok(src.includes('auraClass') && src.includes('auraWrap') && block.includes('auraWrap(') && src.includes('tb-aura-parts'));
  const css = fs.readFileSync(path.join(__dirname, 'public/index.html'), 'utf8');
  assert.ok(css.includes('pod1glow') && css.includes('tb-pod-1') && css.includes('tb-pod-2') && css.includes('tb-pod-3'));
  assert.ok(css.includes('tb-row.me'));
  assert.ok(css.includes('aura-fire-hi') && css.includes('aura-ice-hi') && css.includes('apRise') && css.includes('apSnow'));
  assert.ok(css.includes('/img/auras/flame') && css.includes('/img/auras/snow'));
});
console.log(n + ' tests avatares estáticos');
