// Extra bundled avatars: catalog, files, validation, persistence, picker tabs.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { open } = require('./core'); const Av = require('./public/avatar'), CAT = require('./public/avatar-catalog');
let n = 0; const t = (k, f) => { f(); console.log('OK', k); n++; };
const ids = g => CAT[g].map(x => x[0]);
t('groups and labels in order', () => {
  assert.deepEqual(Av.GROUPS.map(g => g[1]), ['Caricaturas', 'Deportes', 'Animales', 'Iniciales', 'Banderas', 'Marcas', 'Marcas de lujo']);
  for (const [g] of Av.GROUPS) assert.ok(CAT[g].length >= 10, g);
});
t('required flags, brands and luxury present', () => {
  for (const c of ['us', 'cu', 'pr', 'mx', 'do', 've', 'co', 'es', 'ar', 'br', 'pt', 'sa']) assert.ok(ids('banderas').includes('flag-' + c), c);
  for (const b of ['nike', 'adidas', 'apple', 'jordan', 'puma', 'underarmour', 'newbalance', 'ferrari', 'bmw', 'playstation']) assert.ok(ids('marcas').includes('brand-' + b), b);
  for (const b of ['louisvuitton', 'gucci', 'chanel', 'prada', 'versace', 'dior', 'hermes', 'balenciaga', 'fendi', 'rolex', 'cartier', 'lamborghini', 'rollsroyce', 'ferragamo']) assert.ok(ids('lujo').includes('lux-' + b), b);
});
t('every non-initial avatar has body + head SVG files, valid XML-ish, no external refs', () => {
  for (const id of Object.keys(Av.GEN)) { if (Av.GEN[id].group === 'iniciales') continue;
    for (const f of [id, id + '_head']) { const p = path.join(__dirname, 'public/img/avatars/gen', f + '.svg'); const s = fs.readFileSync(p, 'utf8');
      assert.match(s, /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/); assert.ok(s.endsWith('</svg>')); assert.ok(!/href=|<image|@import|url\(http/.test(s), f); } }
  assert.match(Av.imgTag('flag-mx'), /img\/avatars\/gen\/flag-mx\.svg/); assert.match(Av.imgTag('flag-mx', { head: true }), /flag-mx_head\.svg/);
});
t('initials avatar uses the user name, escaped', () => {
  const u = decodeURIComponent(Av.src('ini-rojo', false, 'ángel')); assert.match(u, />Á<\/text>/); assert.match(u, /#dc2626/);
  assert.match(decodeURIComponent(Av.src('ini-azul', true, '<x>')), />X<\/text>/); assert.match(decodeURIComponent(Av.src('ini-azul', true, '')), />\?<\/text>/);
});
t('validate/norm: new ids ok, unknown rejected, 1..13 unchanged, 14 still rejected, no streak photos for extras', () => {
  assert.deepEqual(Av.validate({ pick: 'brand-nike' }).cfg, { pick: 'brand-nike' }); assert.ok(Av.validate({ pick: 'brand-nope' }).error); assert.ok(Av.validate({ pick: '__proto__' }).error);
  assert.deepEqual(Av.validate({ pick: 7 }).cfg, { pick: 7 }); assert.ok(Av.validate({ pick: 14 }).error);
  assert.equal(Av.norm({ pick: 'lux-rolex' }).pick, 'lux-rolex'); assert.equal(Av.norm({ pick: 'zzz' }).pick, 1); assert.equal(Av.norm(null).pick, 1);
  assert.equal(Av.streakSrc('flag-us', { kind: 'fuego', n: 5, intense: true }), null);
});
t('register + profile persist string pick; others untouched', () => {
  const C = open(':memory:'); const a = C.setupAdmin('admin', '1234'); const old = C.register(C.newInvite(), 'viejo', '1234', { pick: 5 });
  const u = C.register(C.newInvite(), 'nuevo', '1234', { pick: 'flag-pr' });
  const cfg = id => JSON.parse(C.db.prepare('SELECT avatar_cfg FROM users WHERE id=?').get(id).avatar_cfg);
  assert.deepEqual(cfg(u), { pick: 'flag-pr' }); assert.throws(() => C.register(C.newInvite(), 'malo', '1234', { pick: 'flag-xx' }), /inválido/);
  C.setProfile(u, null, 'Nuevo', 'ninguno', {}, { pick: 'lux-ferragamo' }); assert.deepEqual(cfg(u), { pick: 'lux-ferragamo' });
  assert.deepEqual(cfg(old), { pick: 5 }); assert.equal(C.userByToken(C.login('nuevo', '1234')).avatarCfg.pick, 'lux-ferragamo');
  assert.throws(() => C.setProfile(u, null, 'Nuevo', 'ninguno', {}, { pick: 'brand-fake' }));
});
t('picker: chips in order, only active group shown, opens selected group, Originales only for existing bobblehead users', () => {
  const src = fs.readFileSync(path.join(__dirname, 'public/app.js'), 'utf8');
  const block = src.slice(src.indexOf('function avatarPicker('), src.indexOf('function bindAvatarPicker('));
  const ctx = { Avatar: Av, esc: s => String(s) }; vm.runInNewContext(block + '\nthis.P=avatarPicker;', ctx);
  const chips = h => [...h.matchAll(/data-avtab="([^"]+)">([^<]+)</g)].map(m => m[2]);
  let h = ctx.P(null, 'pepe'); assert.deepEqual(chips(h), ['Caricaturas', 'Deportes', 'Animales', 'Iniciales', 'Banderas', 'Marcas', 'Marcas de lujo']);
  assert.match(h, /data-avgroup="caricaturas"/); assert.ok(!h.includes('flag-')); assert.ok(!h.includes('avatars/1.webp'));
  h = ctx.P('flag-cu', 'pepe'); assert.match(h, /data-avgroup="banderas"/); assert.match(h, /class="av-opt on" data-avsel="flag-cu"/); assert.ok(!h.includes('face-1'));
  h = ctx.P(3, 'pepe', true); assert.deepEqual(chips(h).slice(-1), ['Originales']); assert.match(h, /data-avgroup="originales"/); assert.match(h, /data-avsel="3" aria-pressed="true"/);
  h = ctx.P('lux-gucci', 'pepe', false, 'iniciales'); assert.match(h, /data-avgroup="iniciales"/); assert.match(decodeURIComponent(h), />P<\/text>/);
});
t('brand logos are not used as app branding', () => {
  const html = fs.readFileSync(path.join(__dirname, 'public/index.html'), 'utf8'), man = fs.readFileSync(path.join(__dirname, 'public/manifest.webmanifest'), 'utf8');
  assert.ok(!/gen\/brand-|gen\/lux-|avatars\/gen/.test(html + man) && !/brand-|lux-/.test(man)); assert.match(html, /avatar-catalog\.js"><\/script><script src="avatar\.js"/);
});
console.log(n, 'avatar catalog tests passed');
