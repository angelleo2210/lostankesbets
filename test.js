const assert = require('node:assert'); const { open, profit } = require('./core');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('✔', name); };
t('cuotas', () => { assert.equal(profit(100, 880), 880); assert.equal(profit(250, -250), 100); assert.equal(profit(100, -100), 100); assert.equal(profit(100, 100), 100); assert.throws(() => profit(100, 50)); });
const C = open(':memory:');
const a = C.setupAdmin('angel', '1234'); assert.throws(() => C.setupAdmin('x', '1234'));
const code = C.newInvite(); const p = C.register(code, 'pepe', '5555'); assert.throws(() => C.register(code, 'otro', '5555'), /ya se usó/);
const coins = id => C.db.prepare('SELECT coins FROM users WHERE id=?').get(id).coins;
t('50000 iniciales y login', () => { assert.equal(coins(p), 50000); assert.ok(C.login('pepe', '5555')); assert.throws(() => C.login('pepe', '0000')); });
const L = C.createLine('Hoy como espaguetis', [{ label: 'Sí', odds: -250 }, { label: 'No', odds: 880 }]); const [si, no] = C.lines()[0].options;
t('validaciones', () => { assert.throws(() => C.placeBet(p, si.id, -5)); assert.throws(() => C.placeBet(p, si.id, 0)); assert.throws(() => C.placeBet(p, si.id, 50001)); assert.throws(() => C.createLine('x', [{ label: 'a', odds: 100 }])); });
C.placeBet(p, si.id, 250); C.placeBet(p, no.id, 100); C.placeBet(a, no.id, 1000);
t('saldo descontado', () => assert.equal(coins(p), 50000 - 350));
C.closeLine(L); t('no apostar en línea cerrada', () => assert.throws(() => C.placeBet(p, si.id, 10), /no acepta/));
C.settleLine(L, no.id);
t('liquidación +880', () => { assert.equal(coins(p), 50000 - 350 + 100 + 880); assert.equal(coins(a), 50000 - 1000 + 1000 + 8800); });
t('no doble liquidación', () => { assert.throws(() => C.settleLine(L, si.id)); assert.throws(() => C.cancelLine(L)); assert.equal(coins(p), 50630); });
const L2 = C.createLine('Gana el Real Madrid', [{ label: 'Sí', odds: -150 }, { label: 'No', odds: 130 }, { label: 'Empate', odds: 250 }]);
const o2 = C.lines()[0].options; C.placeBet(p, o2[0].id, 300); C.cancelLine(L2);
t('cancelar devuelve', () => assert.equal(coins(p), 50630));
const L3 = C.createLine('Prueba -250', [{ label: 'Sí', odds: -250 }, { label: 'No', odds: 880 }]); const o3 = C.lines()[0].options;
C.placeBet(p, o3[0].id, 250); C.settleLine(L3, o3[0].id); t('liquidación -250', () => assert.equal(coins(p), 50630 + 100));
// Parlays
const P = open(':memory:'); P.setupAdmin('angel', '1234'); const u = P.register(P.newInvite(), 'tank', '1111');
const pc = id => P.db.prepare('SELECT coins FROM users WHERE id=?').get(id).coins;
const mk = () => { const id = P.createLine('L', [{ label: 'A', odds: 100 }, { label: 'B', odds: -200 }]); return P.lines().find(l => l.id === id); };
let ls = [mk(), mk(), mk(), mk()];
t('parlay validaciones', () => {
  assert.throws(() => P.placeParlay(u, [ls[0].options[0].id], 100), /2 a 15/);
    assert.throws(() => P.placeParlay(u, [ls[0].options[0].id, ls[0].options[1].id, ls[1].options[0].id], 100), /una selección por línea/);
  assert.throws(() => P.placeParlay(u, [ls[0].options[0].id, ls[0].options[0].id, ls[1].options[0].id], 100), /repetidas/);
  assert.throws(() => P.placeParlay(u, [ls[0].options[0].id, ls[1].options[0].id, 9999], 100), /no existe/);
  assert.throws(() => P.placeParlay(u, [ls[0].options[0].id, ls[1].options[0].id, ls[2].options[0].id], 0), /entero/);
  assert.throws(() => P.placeParlay(u, [ls[0].options[0].id, ls[1].options[0].id, ls[2].options[0].id], 50001), /suficientes/);
  P.closeLine(ls[3].id); assert.throws(() => P.placeParlay(u, [ls[0].options[0].id, ls[1].options[0].id, ls[3].options[0].id], 10), /no acepta/);
  assert.equal(pc(u), 50000);
});
t('parlay 15 ok, 16 rechazado', () => {
  const Q = open(':memory:'); Q.setupAdmin('angel', '1234'); const q = Q.register(Q.newInvite(), 'xx', '1111');
  const ids = []; for (let i = 0; i < 16; i++) { const id = Q.createLine('L' + i, [{ label: 'A', odds: 100 }, { label: 'B', odds: -200 }]); ids.push(Q.lines().find(l => l.id === id).options[0].id); }
  assert.throws(() => Q.placeParlay(q, ids, 1), /2 a 15/); assert.ok(Q.placeParlay(q, ids.slice(0, 15), 1)); assert.equal(Q.myParlays(q)[0].legs.length, 15);
  for (const k of [2, 5, 6, 10]) { assert.ok(Q.placeParlay(q, ids.slice(0, k), 1)); assert.equal(Q.myParlays(q)[0].legs.length, k); }
});
t('parlay gana todas (+100,+100,-200 => x6)', () => {
  P.placeParlay(u, [ls[0].options[0].id, ls[1].options[0].id, ls[2].options[1].id], 100); assert.equal(pc(u), 49900);
  P.settleLine(ls[0].id, ls[0].options[0].id); P.settleLine(ls[1].id, ls[1].options[0].id); assert.equal(pc(u), 49900);
  P.settleLine(ls[2].id, ls[2].options[1].id); assert.equal(pc(u), 49900 + 600);
  const pp = P.myParlays(u)[0]; assert.equal(pp.status, 'won'); assert.equal(pp.payout, 600); assert.equal(pp.legs.length, 3);
});
ls = [mk(), mk(), mk(), mk()];
t('parlay una perdida => perdido, sin pago', () => {
  P.placeParlay(u, ls.map(l => l.options[0].id), 100);
  P.settleLine(ls[0].id, ls[0].options[1].id); assert.equal(P.myParlays(u)[0].status, 'lost');
  ls.slice(1).forEach(l => P.settleLine(l.id, l.options[0].id)); assert.equal(pc(u), 50400); assert.equal(P.myParlays(u)[0].payout, 0);
});
ls = [mk(), mk(), mk()];
t('parlay pata cancelada => paga resto', () => {
  P.placeParlay(u, ls.map(l => l.options[0].id), 100); P.cancelLine(ls[1].id);
  P.settleLine(ls[0].id, ls[0].options[0].id); P.settleLine(ls[2].id, ls[2].options[0].id);
  assert.equal(pc(u), 50300 + 400); assert.equal(P.myParlays(u)[0].status, 'won');
});
ls = [mk(), mk(), mk()];
t('parlay todo cancelado => devuelve', () => {
  P.placeParlay(u, ls.map(l => l.options[0].id), 100); ls.forEach(l => P.cancelLine(l.id));
  assert.equal(pc(u), 50700); assert.equal(P.myParlays(u)[0].status, 'refunded');
});
t('perfil: avatar y nombre', () => {
  const Q = open(':memory:'); Q.setupAdmin('angel', '1234'); const q = Q.register(Q.newInvite(), 'zz', '1111');
  assert.deepEqual(Q.setProfile(q, '🦁', ' El  Tanke '), { avatar: '🦁', display_name: 'El Tanke', facialHair: null });
  Q.setProfile(q, '👨‍👩‍👧', ''); Q.setProfile(q, '🇨🇴', 'x');
  for (const bad of ['ab', '🦁🐯', 'a', '🦁'.repeat(9)]) assert.throws(() => Q.setProfile(q, bad, ''), /un solo emoji/);
  assert.throws(() => Q.setProfile(q, '', 'x'.repeat(21)), /20/); assert.throws(() => Q.setProfile(q, '', '<b>hi</b>'), /no permitidos/);
  const row = Q.leaderboard().find(r => r.username === 'zz'); assert.equal(row.avatar, '🇨🇴'); assert.equal(row.display_name, 'x');
  Q.setProfile(q, '', ''); assert.equal(Q.leaderboard().find(r => r.username === 'zz').avatar, null);
});
t('perfil: vello facial', () => {
  const Q = open(':memory:'); Q.setupAdmin('angel', '1234'); const q = Q.register(Q.newInvite(), 'ww', '1111');
  assert.deepEqual(Q.setProfile(q, '😎', '', { style: 'barba_larga', color: '#5B3A1E' }).facialHair, { style: 'barba_larga', color: '#5b3a1e' });
  assert.deepEqual(Q.leaderboard().find(r => r.username === 'ww').facialHair, { style: 'barba_larga', color: '#5b3a1e' });
  assert.deepEqual(Q.setProfile(q, '', '', 'bigote').facialHair, { style: 'bigote', color: null });
  assert.equal(Q.setProfile(q, '', '', { style: 'ninguno' }).facialHair, null);
  assert.throws(() => Q.setProfile(q, '', '', { style: 'rasta' }), /Vello/); assert.throws(() => Q.setProfile(q, '', '', { style: 'bigote', color: 'red;x' }), /Color/);
});
t('recompensas top 3', () => {
  const Q = open(':memory:'); Q.setupAdmin('angel', '1234'); const ids = ['aa', 'bb', 'cc', 'dd'].map(n => Q.register(Q.newInvite(), n, '1111'));
  const mk = () => { const id = Q.createLine('X', [{ label: 'S', odds: 100 }, { label: 'N', odds: 100 }]); return [id, ...Q.lines().find(l => l.id === id).options]; };
  const [L, S, N] = mk();
  Q.placeBet(ids[0], S.id, 3000); Q.placeBet(ids[1], S.id, 2000); Q.placeBet(ids[2], S.id, 1000); Q.placeBet(ids[3], N.id, 100);
  Q.settleLine(L, S.id); // aa 53000, bb 52000, cc 51000, dd 49900; admin excluido
  const has = (u, it) => Q.unlocksOf(u).some(x => x.item_id === it);
  assert.ok(has(ids[0], 'corona') && has(ids[0], 'bronce')); assert.ok(!has(ids[1], 'corona') && has(ids[1], 'trofeo'));
  assert.ok(has(ids[2], 'medalla') && !has(ids[2], 'plata')); assert.equal(Q.unlocksOf(ids[3]).length, 0); assert.equal(Q.unlocksOf(1).length, 0);
  let lb = Q.leaderboard(); assert.equal(lb.find(r => r.username === 'aa').badge, '🥇'); assert.equal(lb.find(r => r.username === 'angel').badge, null);
  assert.throws(() => Q.setProfile(ids[1], '', '', null, { color: 'oro' }), /Bloqueado/);
  assert.throws(() => Q.setProfile(ids[3], '', '', null, { accessory: 'diamante' }), /Bloqueado/);
  assert.throws(() => Q.setProfile(ids[0], '', '', null, { color: 'corona' }), /inválido/);
  assert.deepEqual(Q.setProfile(ids[0], '', '', null, { color: 'oro', accessory: 'diamante' }, { pick: 3 }).cosmetics, { color: 'oro', accessory: 'diamante' });
  assert.deepEqual(Q.leaderboard().find(r => r.username === 'aa').avatarCfg, { pick: 3 });
  const [L2, S2, N2] = mk(); Q.placeBet(ids[0], N2.id, 10000); Q.placeBet(ids[3], S2.id, 5000); Q.settleLine(L2, S2.id); // aa 43000 cae; dd 54900 sube a 1
  lb = Q.leaderboard(); const aa = lb.find(r => r.username === 'aa');
  assert.equal(aa.badge, null); assert.deepEqual(aa.avatarCfg, { pick: 3 }); assert.ok(has(ids[0], 'corona')); // trofeo conservado
  assert.equal(lb.find(r => r.username === 'dd').badge, '🥇'); assert.ok(has(ids[3], 'corona'));
  assert.ok(Q.setProfile(ids[0], '', '', null, { color: 'oro' })); // color sigue desbloqueado
});
t('recarga admin', () => {
  const Q = open(':memory:'); const ad = Q.setupAdmin('angel', '1234'); const q = Q.register(Q.newInvite(), 'rr', '1111');
  const c = id => Q.db.prepare('SELECT coins FROM users WHERE id=?').get(id).coins;
  assert.equal(Q.topup(ad, q, 2500).coins, 52500); assert.equal(c(q), 52500);
  assert.throws(() => Q.topup(q, q, 100), /Solo el administrador/); assert.equal(c(q), 52500);
  for (const bad of [0, -5, 1.5, 'abc', 10000001]) assert.throws(() => Q.topup(ad, q, bad), /entero/);
  assert.throws(() => Q.topup(ad, 999, 10), /no existe/); assert.ok(Q.topup(ad, q, 10000000));
  const h = Q.topups(); assert.equal(h.length, 2); assert.equal(h[1].amount, 2500); assert.equal(h[1].username, 'rr'); assert.equal(h[1].admin, 'angel'); assert.ok(h[1].created);
});
t('avatar estático 1..12', () => {
  const AV = require('./public/avatar'), fs = require('fs'); const Q = open(':memory:'); Q.setupAdmin('angel', '1234');
  const d = Q.register(Q.newInvite(), 'def', '1111'); assert.deepEqual(Q.leaderboard().find(r => r.username === 'def').avatarCfg, AV.DEFAULT);
  const q = Q.register(Q.newInvite(), 'cfg', '1111', { pick: 7 }); assert.deepEqual(Q.leaderboard().find(r => r.username === 'cfg').avatarCfg, { pick: 7 });
  // configs viejas se normalizan a pick 1
  const q2 = Q.register(Q.newInvite(), 'old', '1111', { body: 'atletico', wear: { arriba: { id: 'top_hoodie', color: 'rojo' } } });
  assert.deepEqual(Q.leaderboard().find(r => r.username === 'old').avatarCfg, { pick: 1 });
  for (const bad of [{ pick: 0 }, { pick: 14 }, { pick: 'x' }, [1]]) assert.throws(() => Q.setProfile(q, '', '', null, undefined, bad), /Avatar|Elige/);
  Q.setProfile(q, '', '', null, undefined, { pick: 13 }); assert.equal(Q.leaderboard().find(r => r.username === 'cfg').avatarCfg.pick, 13);
  Q.setProfile(q, '🦁', 'Leo', { style: 'bigote' }, undefined, { pick: 4 }); const me = Q.leaderboard().find(r => r.username === 'cfg');
  assert.deepEqual(me.avatarCfg, { pick: 4 }); assert.equal(me.avatar, '🦁'); assert.equal(me.facialHair.style, 'bigote');
  const html = AV.render(me.avatarCfg); assert.ok(html.includes('img/avatars/4.webp') && !/<script|undefined/.test(html));
  assert.ok(AV.render(AV.DEFAULT, { head: true }).includes('img/avatars/1_head.webp'));
  assert.deepEqual(AV.PICKS, [1,2,3,4,5,6,7,8,9,10,11,12,13]);
  for (const n of AV.PICKS) {
    assert.ok(fs.existsSync(__dirname + '/public/img/avatars/' + n + '.webp'), n);
    assert.ok(fs.existsSync(__dirname + '/public/img/avatars/' + n + '_head.webp'), n + '_head');
  }
});
t('gorras legacy: fotos siguen en disco (ropa ya no se vende)', () => { const fs = require('fs'); const ST = require('./public/store'); const hs = ST.ITEMS.filter(i => i.sub === 'gorras'); assert.equal(hs.length, 9);
  assert.ok(!ST.CATS.some(c => c[0] === 'ropa'));
  for (const i of hs) { assert.deepEqual(i.colors, ['rojo', 'azul', 'verde', 'dorado', 'blanco', 'negro']);
    for (const c of i.colors) assert.ok(fs.statSync(__dirname + '/public/img/store/' + i.id + '_' + c + '.jpg').size > 5000, i.id + c); } });
t('migración acc_gorra → head_gorra_casual sin perder nada', () => { const f = require('os').tmpdir() + '/ltb-gor-' + process.pid + '.db'; let Q = open(f); Q.setupAdmin('angel', '1234');
  Q.register(Q.newInvite(), 'g1', '1111'); Q.register(Q.newInvite(), 'g2', '1111'); const uid = n => Q.db.prepare('SELECT id FROM users WHERE username=?').get(n).id, a = uid('g1'), b = uid('g2'), c = id => Q.db.prepare('SELECT coins FROM users WHERE id=?').get(id).coins;
  Q.db.prepare("INSERT INTO purchases(user_id,item_id,price,color) VALUES(?,'acc_gorra',5000,'azul'),(?,'acc_gorra',5000,'rojo'),(?,'head_gorra_casual',5000,'negro')").run(a, b, b);
  const ca = c(a), cb = c(b); Q.db.close(); Q = open(f); open(f).db.close();
  const own = id => Q.db.prepare('SELECT item_id, color FROM purchases WHERE user_id=? ORDER BY item_id').all(id).map(r => r.item_id + ':' + r.color);
  assert.deepEqual(own(a), ['head_gorra_casual:azul']); assert.deepEqual(own(b), ['head_gorra_casual:negro']); assert.equal(c(a), ca); assert.equal(c(b), cb + 5000); Q.db.close(); require('fs').unlinkSync(f); });
t('migración idempotente users', () => { const f = require('os').tmpdir() + '/ltb-mig-' + process.pid + '.db';
  const { DatabaseSync } = require('node:sqlite'); const d = new DatabaseSync(f); d.exec('CREATE TABLE users(id INTEGER PRIMARY KEY, username TEXT UNIQUE COLLATE NOCASE, pin_hash TEXT, salt TEXT, coins INTEGER, is_admin INTEGER DEFAULT 0)'); d.close();
  open(f).db.close(); const Q = open(f); assert.ok(Q.db.prepare('PRAGMA table_info(users)').all().some(c => c.name === 'display_name') && Q.db.prepare('PRAGMA table_info(users)').all().some(c => c.name === 'facial_hair') && Q.db.prepare('PRAGMA table_info(users)').all().some(c => c.name === 'avatar_cfg')); Q.db.close(); require('fs').unlinkSync(f); });
t('tienda: compra, saldo, duplicado, color', () => { const S = open(':memory:'); S.setupAdmin('angel', '1234'); const s = S.register(S.newInvite(), 'compra', '1111'); const sc = () => S.db.prepare('SELECT coins FROM users WHERE id=?').get(s).coins;
  assert.throws(() => S.buyItem(s, 'nada'), /no existe/); assert.throws(() => S.buyItem(s, 'car_deportivo'), /suficientes/); assert.equal(sc(), 50000);
  assert.throws(() => S.buyItem(s, 'jet_basico', '#3b82f6'), /Color/); assert.throws(() => S.buyItem(s, 'jet_basico', 'oro'), /Color/);
  assert.equal(S.buyItem(s, 'jet_basico').coins, 38000); assert.equal(S.owned(s)[0].color, 'azul');
  S.db.prepare('UPDATE users SET coins=110000 WHERE id=?').run(s); assert.throws(() => S.buyItem(s, 'jet_basico'), /Ya es tuyo/); assert.equal(sc(), 110000);
  S.setItemColor(s, 'jet_basico', 'dorado'); assert.equal(S.owned(s)[0].color, 'dorado');
  for (const bad of ['#ABCDEF', 'morado', '', null, 'plata']) assert.throws(() => S.setItemColor(s, 'jet_basico', bad), /Color/);
  assert.throws(() => S.setItemColor(s, 'moto_naked', 'rojo'), /No es tuyo/);
  assert.equal(S.buyItem(s, 'moto_scooter', 'negro').coins, 90000); assert.equal(S.owned(s).length, 2);
  assert.equal(S.buyItem(s, 'cad_oro', 'esmeralda').coins, 72000); assert.throws(() => S.setItemColor(s, 'cad_oro', 'rojo'), /Color/);
  S.db.prepare("UPDATE purchases SET color='#ef4444' WHERE item_id='jet_basico'").run(); assert.equal(S.owned(s).find(o => o.item_id === 'jet_basico').color, 'rojo');
  S.db.prepare("UPDATE purchases SET color='xx' WHERE item_id='jet_basico'").run(); assert.equal(S.owned(s).find(o => o.item_id === 'jet_basico').color, 'azul');
  assert.ok(require('./public/store').render('yate_blanco', 'negro').includes('img/store/yate_blanco_negro.jpg')); });
t('tienda: catálogo, departamentos, fotos', () => { const ST = require('./public/store'), fs = require('fs');
  assert.equal(new Set(ST.ITEMS.map(i => i.id)).size, ST.ITEMS.length);
  assert.ok(!ST.CATS.some(c => c[0] === 'ropa'), 'ropa fuera de la tienda');
  for (const i of ST.ITEMS.filter(x => x.cat !== 'ropa')) { assert.ok(ST.CATS.some(c => c[0] === i.cat), i.id); assert.ok(i.colors.includes(i.color), i.id); assert.equal(i.colors.length, 6);
    for (const c of i.colors) assert.ok(fs.existsSync(__dirname + '/public/' + ST.img(i.id, c)), i.id + c); }
  const ropa = ST.ITEMS.filter(i => i.cat === 'ropa'); assert.equal(ropa.length, 32); assert.ok(!ST.byId('acc_gorra')); for (const i of ropa) { assert.ok(i.price <= 25000, i.id); assert.ok(ST.SUBS.some(s => s[0] === i.sub), i.id); }
  assert.deepEqual(['casa_familiar', 'casa_moderna', 'casa_residencia'].map(id => ST.byId(id).price), [300000, 600000, 1000000]);
  assert.equal(ST.norm('car_gt', '#1e40af'), 'azul'); assert.equal(ST.norm('cad_oro', '#c0c0c0'), 'plata'); });
t('monedas: bono diario idempotente 24h', () => { const Q = open(':memory:'); Q.setupAdmin('angel', '1234'); const q = Q.register(Q.newInvite(), 'bono', '1111'); const T = 1e12;
  assert.equal(Q.bonusStatus(q, T).available, true); const r = Q.claimBonus(q, T); assert.equal(r.claimed, true); assert.equal(r.coins, 55000);
  const r2 = Q.claimBonus(q, T + 1000); assert.equal(r2.claimed, false); assert.equal(r2.coins, 55000); assert.ok(r2.msLeft > 0 && r2.msLeft <= 86400000);
  assert.equal(Q.claimBonus(q, T + 86400000 - 1).claimed, false); assert.equal(Q.claimBonus(q, T + 86400000).coins, 60000); });
t('monedas: vender al 75% (redondeo hacia abajo)', () => { const Q = open(':memory:'); Q.setupAdmin('angel', '1234'); const q = Q.register(Q.newInvite(), 'vende', '1111'); const c = () => Q.db.prepare('SELECT coins FROM users WHERE id=?').get(q).coins;
  Q.buyItem(q, 'moto_naked'); assert.equal(c(), 20000); assert.throws(() => Q.sellItem(q, 'moto_pista'), /No es tuyo/);
  assert.deepEqual(Q.sellItem(q, 'moto_naked'), { refund: 22500, coins: 42500 }); assert.equal(Q.owned(q).length, 0); assert.throws(() => Q.sellItem(q, 'moto_naked'), /No es tuyo/);
  Q.buyItem(q, 'jet_turbo'); assert.equal(Q.sellItem(q, 'jet_turbo').refund, 10125); Q.db.prepare("UPDATE purchases SET price=? WHERE user_id=?").run(0, q); Q.buyItem(q, 'med_deportivas'); Q.db.prepare('UPDATE purchases SET price=1001 WHERE user_id=?').run(q); assert.equal(Q.sellItem(q, 'med_deportivas').refund, 750); assert.ok(c() >= 0); });
t('ranking: apuestas ganadas (parlay=1), desempate monedas, sin artículos', () => { const Q = open(':memory:'); Q.setupAdmin('angel', '1234'); const [a, b, c] = ['ra', 'rb', 'rc'].map(n => Q.register(Q.newInvite(), n, '1111'));
  const mk = () => { const id = Q.createLine('X', [{ label: 'S', odds: 100 }, { label: 'N', odds: 100 }]); return [id, ...Q.lines().find(l => l.id === id).options]; };
  const [L1, S1, N1] = mk(), [L2, S2] = mk(); Q.placeBet(a, S1.id, 100); Q.placeBet(a, S2.id, 100); Q.placeBet(b, N1.id, 9000); Q.placeParlay(c, [S1.id, S2.id], 100);
  Q.settleLine(L1, S1.id); Q.settleLine(L2, S2.id); Q.db.prepare('UPDATE users SET coins=9000000 WHERE id=?').run(b);
  const lb = Q.leaderboard().filter(r => r.username.startsWith('r')); assert.deepEqual(lb.map(r => [r.username, r.wins]), [['ra', 2], ['rc', 1], ['rb', 0]]);
  Q.db.prepare('UPDATE users SET coins=200000 WHERE id=?').run(c); Q.buyItem(c, 'car_deportivo'); assert.equal(Q.leaderboard().filter(r => r.username.startsWith('r'))[1].username, 'rc'); });
t('racha: fuego, hielo, nada, pendientes ignoradas', () => { const Q = open(':memory:'); Q.setupAdmin('angel', '1234'); const q = Q.register(Q.newInvite(), 'racha', '1111');
  const mk = () => { const id = Q.createLine('X', [{ label: 'S', odds: 100 }, { label: 'N', odds: 100 }]); return [id, ...Q.lines().find(l => l.id === id).options]; };
  const bet = win => { const [L, S, N] = mk(); Q.placeBet(q, S.id, 10); Q.settleLine(L, win ? S.id : N.id); };
  assert.equal(Q.streak(q), null); bet(1); bet(1); assert.equal(Q.streak(q), null);
  const [Lp, Sp] = mk(); Q.placeBet(q, Sp.id, 10); // pendiente: no cuenta
  const [Lc, Sc] = mk(); Q.placeBet(q, Sc.id, 10); Q.cancelLine(Lc); // anulada: no cuenta
  bet(1); assert.deepEqual(Q.streak(q), { kind: 'fuego', n: 3, intense: false });
  const [A, AS] = mk(), [B2, BS] = mk(); Q.placeParlay(q, [AS.id, BS.id], 10); Q.settleLine(A, AS.id); Q.settleLine(B2, BS.id); assert.deepEqual(Q.streak(q), { kind: 'fuego', n: 4, intense: false });
  bet(0); assert.equal(Q.streak(q), null); bet(0); assert.deepEqual(Q.streak(q), { kind: 'hielo', n: 2, intense: false });
  assert.deepEqual(Q.leaderboard().find(r => r.username === 'racha').streak, { kind: 'hielo', n: 2, intense: false });
  bet(0); assert.deepEqual(Q.streak(q), { kind: 'hielo', n: 3, intense: true });
  bet(0); assert.deepEqual(Q.streak(q), { kind: 'hielo', n: 4, intense: true });
  bet(1); bet(1); assert.equal(Q.streak(q), null);
  bet(1); assert.deepEqual(Q.streak(q), { kind: 'fuego', n: 3, intense: false });
  bet(1); assert.deepEqual(Q.streak(q), { kind: 'fuego', n: 4, intense: false });
  bet(1); assert.deepEqual(Q.streak(q), { kind: 'fuego', n: 5, intense: true });
  bet(1); assert.equal(Q.streak(q).intense, true);
  const vm = require('vm'), src = require('fs').readFileSync(__dirname + '/public/app.js', 'utf8'), pick = k => src.slice(src.indexOf('const ' + k + ' ='), src.indexOf('\n', src.indexOf('const ' + k + ' =')));
  const ctx = { sq: 0 }; vm.runInNewContext([pick('FIRE'), pick('ICE'), src.slice(src.indexOf('const streakTag ='), src.indexOf('`; };', src.indexOf('const streakTag =')) + 5), 'this.T = streakTag;'].join('\n'), ctx);
  assert.match(ctx.T({ kind: 'fuego', n: 3, intense: false }), /En racha x3/);
  assert.match(ctx.T({ kind: 'fuego', n: 5, intense: true }), /Imparable/);
  assert.match(ctx.T({ kind: 'fuego', n: 5, intense: true }, true), /Imparable/);
  assert.match(ctx.T({ kind: 'hielo', n: 2, intense: false }), /Frío x2/);
  assert.match(ctx.T({ kind: 'hielo', n: 3, intense: true }), /Congelado/);
  assert.match(ctx.T({ kind: 'hielo', n: 4, intense: true }), /intense/); });
t('piedra papel tijera', () => { const Q = open(':memory:'); Q.setupAdmin('angel', '1234'); const a = Q.register(Q.newInvite(), 'ana', '1111'), b = Q.register(Q.newInvite(), 'beto', '1111');
  const c = id => Q.db.prepare('SELECT coins FROM users WHERE id=?').get(id).coins, set = (id, v) => Q.db.prepare('UPDATE users SET coins=? WHERE id=?').run(v, id);
  set(a, 30000); set(b, 30000);
  for (const bad of [9, 25001, 1.5, 'x']) assert.throws(() => Q.rpsChallenge(a, b, bad), /entre 10/);
  const g1 = Q.rpsChallenge(a, b, 25000).id; assert.equal(c(a), 5000); Q.rpsRespond(b, g1, true); assert.equal(c(b), 5000);
  Q.rpsPick(a, g1, 'piedra'); const vb = Q.rpsView(b, g1); assert.equal(vb.rivalPick, null); assert.equal(vb.rivalPicked, true); assert.equal(Q.rpsList(b)[0].rivalPick, null);
  assert.throws(() => Q.rpsPick(a, g1, 'papel'), /Ya elegiste/); const r = Q.rpsPick(b, g1, 'tijera'); assert.equal(r.result, 'perdiste'); assert.equal(r.rivalPick, 'piedra');
  assert.equal(c(a), 55000); assert.equal(c(b), 5000); assert.throws(() => Q.rpsPick(b, g1, 'papel'), /no disponible/);
  const g2 = Q.rpsChallenge(a, b, 10).id; Q.rpsRespond(b, g2, true); Q.rpsPick(a, g2, 'papel'); assert.equal(Q.rpsPick(b, g2, 'papel').result, 'empate'); assert.equal(c(a), 55000); assert.equal(c(b), 5000);
  const g3 = Q.rpsChallenge(a, b, 100).id; Q.rpsRespond(b, g3, false); assert.equal(c(a), 55000); assert.throws(() => Q.rpsRespond(b, g3, true), /no disponible/);
  const t0 = Date.now(); const g4 = Q.rpsChallenge(a, b, 100, t0).id; assert.equal(c(a), 54900); Q.rpsExpire(t0 + 24 * 3600e3 + 1); Q.rpsExpire(t0 + 24 * 3600e3 + 2); assert.equal(c(a), 55000); assert.equal(Q.rpsView(a, g4).status, 'expired');
  set(b, 50); assert.throws(() => Q.rpsChallenge(b, a, 51), /suficientes/); assert.equal(c(b), 50);
  const g5 = Q.rpsChallenge(a, b, 100).id; assert.throws(() => Q.rpsRespond(b, g5, true), /suficientes/); assert.equal(c(b), 50);
  assert.throws(() => Q.rpsPick(a, g5, 'piedra'), /no disponible/); assert.equal(Q.rpsView(999, g5), null); });

// Admin: listar invitaciones (no debe tumbar la pestaña Admin / crear líneas)
{ const I = open(':memory:'); I.setupAdmin('angel', '1234'); const c1 = I.newInvite(); I.register(c1, 'invitado', '9999'); I.newInvite();
  t('listInvites no truena y no expone uid crudo', () => { const xs = I.listInvites(); assert.ok(xs.length >= 2); assert.ok(xs.some(x => x.used_by === 'invitado')); xs.forEach(x => assert.equal(x.uid, undefined)); }); }

t('avatar pick: guardar 1..9; comprar ropa legacy no toca avatarCfg', () => { const AV = require('./public/avatar'); const Q = open(':memory:'); Q.setupAdmin('angel', '1234'); const q = Q.register(Q.newInvite(), 'capas', '1111');
  const cfg = () => Q.leaderboard().find(r => r.username === 'capas').avatarCfg; Q.db.prepare('UPDATE users SET coins=100000 WHERE id=?').run(q);
  Q.buyItem(q, 'top_hoodie', 'rojo'); assert.deepEqual(cfg(), AV.DEFAULT); Q.setItemColor(q, 'top_hoodie', 'azul'); assert.deepEqual(cfg(), AV.DEFAULT);
  Q.setProfile(q, '', '', null, undefined, { pick: 5 }); assert.deepEqual(cfg(), { pick: 5 });
  Q.setProfile(q, '', '', null, undefined, { body: 'musculoso', wear: {} }); assert.deepEqual(cfg(), { pick: 1 }); // legacy → 1
  Q.setProfile(q, '', '', null, undefined, { pick: 9 }); assert.deepEqual(cfg(), { pick: 9 });
  Q.sellItem(q, 'top_hoodie'); assert.deepEqual(cfg(), { pick: 9 }); assert.equal(Q.owned(q).length, 0);
  for (const n of AV.PICKS) assert.ok(AV.imgTag(n).includes('avatars/' + n + '.webp')); });
t('tanda de penaltis', () => { const Q = open(':memory:'); Q.setupAdmin('angel', '1234'); Q._testAllowDisabled = true; const a = Q.register(Q.newInvite(), 'pa', '1111'), b = Q.register(Q.newInvite(), 'pb', '1111');
  const c = id => Q.db.prepare('SELECT coins FROM users WHERE id=?').get(id).coins, set = (id, v) => Q.db.prepare('UPDATE users SET coins=? WHERE id=?').run(v, id); set(a, 30000); set(b, 30000);
  for (const bad of [9, 25001, 1.5, 'x']) assert.throws(() => Q.penChallenge(a, b, bad), /entre 10/); assert.throws(() => Q.penChallenge(a, a, 100), /ti mismo/);
  set(a, 50); assert.throws(() => Q.penChallenge(a, b, 100), /suficientes/); set(a, 30000);
  // retar no mueve monedas; rechazo y vencimiento: saldos intactos
  const g0 = Q.penChallenge(a, b, 1000).id; assert.equal(c(a), 30000); Q.penRespond(b, g0, false); assert.equal(c(a), 30000); assert.equal(c(b), 30000); assert.equal(Q.penView(a, g0).status, 'declined');
  const t0 = Date.now(), g1 = Q.penChallenge(a, b, 1000, t0).id; Q.penExpire(t0 + 24 * 3600e3 + 1); assert.equal(Q.penView(a, g1).status, 'expired'); assert.equal(c(a), 30000); assert.equal(c(b), 30000);
  assert.throws(() => Q.penRespond(b, g1, true), /no disponible/);
  // al aceptar, si el retador ya no tiene saldo, falla sin mover nada
  const g2 = Q.penChallenge(a, b, 25000).id; set(a, 100); assert.throws(() => Q.penRespond(b, g2, true), /retador/); assert.equal(c(a), 100); assert.equal(c(b), 30000); set(a, 30000);
  Q.penRespond(b, g2, true); assert.equal(c(a), 5000); assert.equal(c(b), 5000);
  // elecciones ocultas y sin doble elección
  Q.penPlay(a, g2, 'izquierda', 'centro'); assert.throws(() => Q.penPlay(a, g2, 'derecha', 'derecha'), /Ya jugaste/);
  const vb = Q.penView(b, g2); assert.equal(vb.rivalPlayed, true); assert.deepEqual(vb.rounds, []); assert.ok(!JSON.stringify(vb).includes('izquierda'));
  Q.penPlay(b, g2, 'centro', 'izquierda'); let va = Q.penView(a, g2); assert.equal(va.myGoals, 0); assert.equal(va.rivalGoals, 0); assert.equal(va.round, 2); // a atajado, b atajado
  // rondas 2-5: ambos marcan → 4-4, muerte súbita
  for (let r = 2; r <= 5; r++) { Q.penPlay(a, g2, 'derecha', 'izquierda'); Q.penPlay(b, g2, 'centro', 'izquierda'); }
  va = Q.penView(a, g2); assert.equal(va.status, 'accepted'); assert.equal(va.myGoals, 4); assert.equal(va.round, 6);
  Q.penPlay(a, g2, 'derecha', 'centro'); Q.penPlay(b, g2, 'centro', 'izquierda'); // a gol, b atajado
  va = Q.penView(a, g2); assert.equal(va.status, 'done'); assert.equal(va.result, 'won'); assert.equal(c(a), 55000); assert.equal(c(b), 5000); assert.throws(() => Q.penPlay(a, g2, 'derecha', 'centro'), /no disponible/);
  // abandono tras aceptar: quien no juega en 24 h pierde la serie
  const t1 = Date.now(), g3 = Q.penChallenge(b, a, 500, t1).id; Q.penRespond(a, g3, true, t1); Q.penPlay(a, g3, 'centro', 'centro', t1 + 1000);
  Q.penExpire(t1 + 24 * 3600e3 - 1); assert.equal(Q.penView(a, g3).status, 'accepted'); Q.penExpire(t1 + 24 * 3600e3 + 5);
  const v3 = Q.penView(a, g3); assert.equal(v3.status, 'done'); assert.equal(v3.result, 'won'); assert.equal(v3.reason, 'abandono'); assert.equal(c(a), 55500); assert.equal(c(b), 4500);
  Q.penExpire(t1 + 99 * 3600e3); assert.equal(c(a), 55500); assert.ok(Q.penList(a).length >= 4); });
t('béisbol de una entrada: reglas por lanzamiento', () => { const H = (p, b) => C.bbHalf(p.split('').map(x => x === 'S' ? 'strike' : 'bola'), b.split('').map(x => x === 'W' ? 'swing' : 'no'));
  const pad = (x, f) => (x + f.repeat(15)).slice(0, 15);
  let r = H(pad('SSS', 'S'), pad('NNN', 'N')); assert.deepEqual(r.ev.map(e => [e.e, e.outs]), [['ponche', 1], ['ponche', 2], ['ponche', 3]]); assert.equal(r.runs, 0); // 3 outs terminan
  r = H(pad('SSSBSS', 'S'), pad('WNWWWN', 'N')); assert.deepEqual(r.ev.map(e => [e.e, e.outs, e.runs]), [['jonron', 0, 1], ['ponche', 1, 1], ['jonron', 1, 2], ['out', 2, 2], ['jonron', 2, 3], ['ponche', 3, 3]]); // outs se acumulan con jonrones intercalados
  r = H(pad('BBB', 'B'), pad('WWW', 'W')); assert.deepEqual(r.ev.map(e => e.e), ['out', 'out', 'out']); // bola+swing = out
  r = H(pad('BBBBB', 'S'), pad('NNNNN', 'N')); assert.deepEqual(r.ev.slice(0, 5).map(e => [e.e, e.balls]), [['bola', 1], ['bola', 2], ['bola', 3], ['base', 0], ['bola', 1]]); assert.equal(r.runs, 1); assert.equal(r.ev.length, 8); // 4 bolas = +1 y reinicio
  r = H('B'.repeat(15), 'N'.repeat(15)); assert.equal(r.runs, 3); assert.equal(r.ev.length, 15); assert.equal(r.ev[14].balls, 3); // se acaban los 15 lanzamientos
  r = H(pad('BBBSBBBB', 'B'), pad('NNNNNNNN', 'N')); assert.deepEqual(r.ev.map(e => [e.e, e.balls, e.outs]).slice(0, 8), [['bola', 1, 0], ['bola', 2, 0], ['bola', 3, 0], ['ponche', 0, 1], ['bola', 1, 1], ['bola', 2, 1], ['bola', 3, 1], ['base', 0, 1]]); assert.equal(r.ev[7].runs, 1); // el out limpia las bolas; 4 bolas sin out = carrera
  r = H(pad('BBW', 'B').replace('W', 'B'), pad('NNW', 'N')); assert.equal(r.ev[2].e, 'out'); assert.equal(r.ev[2].balls, 0); assert.equal(C.BB_OUTS, 3);
  r = H(pad('SBS', 'B'), pad('NWN', 'N')); assert.equal(r.ev.length, 3); assert.equal(r.ev[2].outs, 3); });
t('béisbol de una entrada: retos, extra, 24 h y plan secreto', () => { const Q = open(':memory:'); Q.setupAdmin('angel', '1234'); Q._testAllowDisabled = true; const a = Q.register(Q.newInvite(), 'ba', '1111'), b = Q.register(Q.newInvite(), 'bb', '1111');
  const c = id => Q.db.prepare('SELECT coins FROM users WHERE id=?').get(id).coins, set = (id, v) => Q.db.prepare('UPDATE users SET coins=? WHERE id=?').run(v, id); set(a, 30000); set(b, 30000);
  const P = (p, w) => ({ pitch: Array(15).fill(p), bat: Array(15).fill(w) });
  for (const bad of [9, 25001, 1.5]) assert.throws(() => Q.bbChallenge(a, b, bad), /entre 10/);
  const g0 = Q.bbChallenge(a, b, 1000).id; assert.equal(c(a), 30000); Q.bbRespond(b, g0, false); assert.equal(c(a), 30000); assert.equal(c(b), 30000);
  const t0 = Date.now(), g1 = Q.bbChallenge(a, b, 1000, t0).id; Q.bbExpire(t0 + 24 * 3600e3 + 1); assert.equal(Q.bbView(a, g1).status, 'expired'); assert.equal(c(a), 30000); assert.equal(c(b), 30000);
  const g2 = Q.bbChallenge(a, b, 25000).id; set(a, 10); assert.throws(() => Q.bbRespond(b, g2, true), /retador/); assert.equal(c(b), 30000); set(a, 30000); Q.bbRespond(b, g2, true); assert.equal(c(a), 5000); assert.equal(c(b), 5000);
  assert.throws(() => Q.bbPlan(a, g2, ['bola'], ['no']), /15/);
  // a lanza siempre strike, batea siempre swing => jonrón y luego... b lanza bola: a hace swing => strikes => out sin carreras. b batea no-swing a strikes de a => ponche.
  Q.bbPlan(a, g2, P('strike', 'swing').pitch, P('strike', 'swing').bat); assert.throws(() => Q.bbPlan(a, g2, P('bola', 'no').pitch, P('bola', 'no').bat), /no se puede cambiar/);
  const vb = Q.bbView(b, g2); assert.equal(vb.rivalSent, true); assert.equal(vb.game, null); assert.ok(!JSON.stringify(vb).includes('strike'));
  Q.bbPlan(b, g2, P('bola', 'no').pitch, P('bola', 'no').bat); const va = Q.bbView(a, g2); // alta: a batea swing vs bolas -> 3 strikes out (0). baja: b no-swing vs strikes -> ponche (0). empate todas -> devuelve
  assert.equal(va.status, 'done'); assert.equal(va.result, 'tie'); assert.equal(va.game.innings.length, 16); assert.equal(c(a), 30000); assert.equal(c(b), 30000);
  // victoria con entrada extra: plan con rotación
  const g3 = Q.bbChallenge(a, b, 1000).id; Q.bbRespond(b, g3, true); const ap = { pitch: ['strike', ...Array(14).fill('bola')], bat: Array(15).fill('no') }, bp = { pitch: Array(15).fill('bola'), bat: ['swing', ...Array(14).fill('no')] };
  const sim = C.bbGame(ap, bp); Q.bbPlan(a, g3, ap.pitch, ap.bat); Q.bbPlan(b, g3, bp.pitch, bp.bat); const v3 = Q.bbView(a, g3); assert.equal(v3.game.my, sim.c); assert.ok(sim.c !== sim.o);
  assert.equal(c(a) + c(b), 60000); assert.equal(c(sim.c > sim.o ? a : b), 30000 + 1000);
  // 24 h tras aceptar: quien no mandó plan pierde
  const t1 = Date.now(), g4 = Q.bbChallenge(b, a, 500, t1).id; Q.bbRespond(a, g4, true, t1); Q.bbPlan(a, g4, ap.pitch, ap.bat, t1 + 5); const before = c(a);
  Q.bbExpire(t1 + 24 * 3600e3 - 1); assert.equal(Q.bbView(a, g4).status, 'accepted'); Q.bbExpire(t1 + 24 * 3600e3 + 1); const v4 = Q.bbView(a, g4); assert.equal(v4.result, 'won'); assert.equal(v4.reason, 'abandono'); assert.equal(c(a), before + 1000); });
t('béisbol: empate en la primera entrada va a entrada extra', () => { const ap = { pitch: Array(15).fill('bola'), bat: ['no', 'no', 'no', 'no', ...Array(11).fill('swing')] }, bp = { pitch: Array(15).fill('bola'), bat: ['no', 'no', 'no', 'no', 'swing', 'swing', 'swing', 'no', 'no', 'no', 'no', 'no', 'no', 'no', 'no'] };
  const g = C.bbGame(ap, bp); assert.equal(g.innings[0].top.runs, g.innings[0].bot.runs); assert.ok(g.innings.length >= 2); });
t('mensajes dentro de retos', () => { const Q = open(':memory:'); Q.setupAdmin('angel', '1234'); Q._testAllowDisabled = true; const a = Q.register(Q.newInvite(), 'ca', '1111'), b = Q.register(Q.newInvite(), 'cb', '1111'), x = Q.register(Q.newInvite(), 'cx', '1111');
  const g = Q.penChallenge(a, b, 100).id; assert.throws(() => Q.chatSend(a, 'pen', g, 'hola'), /aceptado/); Q.penRespond(b, g, true);
  const t0 = 1e12; Q.chatSend(a, 'pen', g, 'hola <b>x</b>', t0); assert.throws(() => Q.chatSend(a, 'pen', g, 'otra', t0 + 500), /rápido/); Q.chatSend(b, 'pen', g, 'qué tal', t0 + 600);
  const L = Q.chatList(b, 'pen', g); assert.equal(L.length, 2); assert.equal(L[0].text, 'hola &lt;b&gt;x&lt;/b&gt;'); assert.equal(L[0].mine, false); assert.equal(L[1].mine, true);
  assert.throws(() => Q.chatList(x, 'pen', g), /No participas/); assert.throws(() => Q.chatSend(x, 'pen', g, 'hey'), /No participas/); assert.throws(() => Q.chatList(a, 'xx', g), /no válido/);
  assert.throws(() => Q.chatSend(a, 'pen', g, 'a'.repeat(141), t0 + 5000), /140/); assert.throws(() => Q.chatSend(a, 'pen', g, '   ', t0 + 5000), /Escribe/);
  for (let i = 0; i < 28; i++) Q.chatSend(i % 2 ? a : b, 'pen', g, 'm' + i, t0 + 10000 + i * 1000); assert.throws(() => Q.chatSend(a, 'pen', g, 'extra', t0 + 99999), /30/);
  for (let r = 0; r < 5; r++) { Q.penPlay(a, g, 'izquierda', 'centro'); Q.penPlay(b, g, 'centro', 'derecha'); } assert.equal(Q.penView(a, g).status, 'done');
  assert.throws(() => Q.chatList(a, 'pen', g), /aceptado/); assert.throws(() => Q.chatSend(a, 'pen', g, 'tarde'), /aceptado/);
  // reto de béisbol: rechazo cierra; aceptado y luego vencido borra
  const h = Q.bbChallenge(a, b, 100, 1000).id; Q.bbRespond(b, h, true, 2000); Q.chatSend(a, 'bb', h, 'suerte', 3000); assert.equal(Q.chatList(b, 'bb', h).length, 1);
  Q.bbExpire(2000 + 24 * 3600e3 + 1); assert.throws(() => Q.chatList(b, 'bb', h), /aceptado/); });
t('Three Contest', () => { const Q = open(':memory:'); Q.setupAdmin('angel', '1234'); Q._testAllowDisabled = true; const a = Q.register(Q.newInvite(), 'ta', '1111'), b = Q.register(Q.newInvite(), 'tb', '1111');
  const coins = u => Q.users().find(x => x.id === u).coins, A0 = coins(a), B0 = coins(b); let seq = []; Q.tcRand = () => seq.length ? seq.shift() : 0.99;
  assert.deepEqual(Q.TC_POS, ['Esquina izquierda', 'Centro', 'Esquina derecha']); assert.equal(Q.TC.total, 15); assert.equal(Q.TC.ms, 75000);
  assert.throws(() => Q.tcChallenge(a, b, 5), /entre/); const d = Q.tcChallenge(a, b, 100, 0).id; Q.tcRespond(b, d, false, 1); assert.equal(coins(a), A0); assert.equal(Q.tcView(a, d).status, 'declined');
  const e = Q.tcChallenge(a, b, 100, 0).id; Q.tcExpire(24 * 3600e3 + 1); assert.equal(Q.tcView(a, e).status, 'expired'); assert.equal(coins(a), A0); assert.equal(coins(b), B0);
  const g = Q.tcChallenge(a, b, 100, 0).id; assert.throws(() => Q.tcStart(a, g, 1), /en juego/); Q.tcRespond(b, g, true, 10); assert.equal(coins(a), A0 - 100); assert.equal(coins(b), B0 - 100);
  Q.tcStart(a, g, 100); assert.throws(() => Q.tcStart(a, g, 101), /una vez/);
  seq = Array(Q.TC.total).fill(0.01); let T = 100; for (let p = 0; p < 3; p++) { for (let k = 0; k < 5; k++) { const r = Q.tcShoot(a, g, ++T); assert.equal(r.shot.pos, p); assert.equal(r.shot.pts, 3); assert.equal(r.shot.money, k === Q.TC.per - 1); }
    assert.throws(() => Q.tcShoot(a, g, ++T), p < 2 ? /siguiente/ : /15/); if (p < 2) assert.equal(Q.tcNext(a, g, ++T).pos, p + 1); }
  assert.throws(() => Q.tcNext(a, g, ++T), /última|15/); const va = Q.tcView(a, g, T); assert.equal(Q.TC.max, 45); assert.equal(Q.TC.max, Q.TC.total * Q.TC.ppm); assert.equal(va.me.points, Q.TC.max); assert.equal(va.me.finished, true);
  const vb = Q.tcView(b, g, T); assert.equal(vb.rivalFinished, true); assert.equal(vb.rivalPoints, null); assert.equal(vb.rivalShots, null); // secreto
  // reloj del servidor: B empieza y a los 75 s ya no puede tirar
  Q.tcStart(b, g, 1000); Q.tcShoot(b, g, 2000); assert.throws(() => Q.tcShoot(b, g, 1000 + 75001), /tiempo|en juego/); assert.equal(Q.tcView(b, g, 80000).me.shots.length, 1); const vr = Q.tcView(a, g, 80000); assert.equal(vr.status, 'done'); assert.equal(vr.result, 'won'); assert.equal(coins(a), A0 + 100); assert.equal(vr.rivalPoints, 0);
  // barra de potencia medida por el servidor
  assert.equal(Q.TC.bar, 2500); assert.equal(Q.tcBar(0), 0); assert.equal(Q.tcBar(1250), 50); assert.equal(Q.tcBar(2500), 100); assert.equal(Q.tcBar(9000), 100); assert.equal(Q.tcZone(80, 80).k, 'perfecto'); assert.equal(Q.tcProb(84, 80), 0.85); assert.equal(Q.tcProb(92, 80), 0.5); assert.equal(Q.tcProb(70, 80), 0.5); assert.equal(Q.tcZone(50, 80).k, 'temprano'); assert.equal(Q.tcZone(97, 80).k, 'tarde'); assert.equal(Q.tcZone(100, 95).k, 'tarde'); assert.equal(Q.tcProb(100, 95), 0.1);
  Q.tcZoneRand = () => 0; const z0 = Q.tcChallenge(a, b, 10, 0).id; Q.tcRespond(b, z0, true, 0); Q.tcStart(a, z0, 0); assert.equal(Q.tcAim(a, z0, 0).green, 68); Q.tcZoneRand = () => 0.999; assert.equal(Q.tcAim(a, z0, 0).green, 90); Q.tcZoneRand = () => 0.5;
  // empate → desempate de 1 tiro; ambos aciertan/fallan repite; secreto; uno acierta gana
  const tie = () => { const h = Q.tcChallenge(a, b, 50, 0).id; Q.tcRespond(b, h, true, 0); Q.tcStart(a, h, 0); Q.tcStart(b, h, 0); Q.tcExpire(80000); return h; };
  const h = tie(); let vh = Q.tcView(a, h, 80000); assert.equal(vh.status, 'accepted'); assert.equal(vh.tiebreak.round, 1);
  assert.throws(() => Q.tcNext(a, h, 80001), /tiempo|última/);
  Q.tcAim(a, h, 160000); seq = [0.01]; assert.equal(Q.tcShoot(a, h, 160000 + 2500 * 0.79).shot.zone, 'perfecto'); assert.throws(() => Q.tcShoot(a, h, 160300), /desempate/); vh = Q.tcView(b, h, 160300); assert.equal(vh.tiebreak.rivalShot, true); assert.equal(vh.tiebreak.hist.length, 0); assert.equal(vh.rivalPoints, null);
  Q.tcAim(b, h, 161000); seq = [0.01]; Q.tcShoot(b, h, 161000 + 1250); vh = Q.tcView(a, h, 161300); assert.equal(vh.status, 'accepted'); assert.equal(vh.tiebreak.round, 2); assert.deepEqual(vh.tiebreak.hist[0], { my: true, rival: true, myBar: 79, rivalBar: 50 });
  seq = [0.99]; Q.tcShoot(a, h, 162000); seq = [0.99]; Q.tcShoot(b, h, 162000); assert.equal(Q.tcView(a, h, 162000).tiebreak.round, 3);
  const cB0 = coins(b); seq = [0.99]; Q.tcShoot(a, h, 163000); seq = [0.01]; Q.tcAim(b, h, 163000); Q.tcShoot(b, h, 164975); vh = Q.tcView(b, h); assert.equal(vh.result, 'won'); assert.equal(vh.reason, 'desempate'); assert.equal(coins(b), cB0 + 100);
  // 24 h sin tirar en el desempate = pierde
  const k = tie(); seq = [0.99]; Q.tcShoot(a, k, 160000); const cA = coins(a); Q.tcExpire(80000 + 24 * 3600e3 + 1); assert.equal(Q.tcView(a, k).result, 'won'); assert.equal(Q.tcView(b, k).reason, 'abandono'); assert.equal(coins(a), cA + 100 + 20) // +20 del reto z0 que b tampoco jugó;
  // aceptado sin concurso en 24 h
  const m = Q.tcChallenge(a, b, 50, 0).id; Q.tcRespond(b, m, true, 0); Q.tcStart(a, m, 0); const cB = coins(b); Q.tcExpire(24 * 3600e3 + 1); assert.equal(Q.tcView(b, m).result, 'lost'); assert.equal(Q.tcView(b, m).reason, 'abandono'); assert.equal(coins(b), cB);
  const o = Q.tcChallenge(a, b, 50, 0).id; Q.tcRespond(b, o, true, 0); const c2 = coins(a); Q.tcExpire(24 * 3600e3 + 1); assert.equal(Q.tcView(a, o).status, 'expired'); assert.equal(coins(a), c2 + 50);
  // atómico: el retador sin monedas → no se cobra a nadie
  const z = Q.tcChallenge(a, b, 25000, 0).id; Q.db.prepare('UPDATE users SET coins=10 WHERE id=?').run(a); const bz = coins(b); assert.throws(() => Q.tcRespond(b, z, true, 1), /retador/); assert.equal(coins(b), bz); assert.equal(Q.tcView(b, z).status, 'pending'); });
t('tabla: podium stats, period filter, activity, losses+pct', () => {
  const Q = open(':memory:'); Q.setupAdmin('angel', '1234');
  const a = Q.register(Q.newInvite(), 'pedro', '1111');
  const b = Q.register(Q.newInvite(), 'maria', '1111');
  const c = Q.register(Q.newInvite(), 'luis', '1111');
  const mk = (uid, win) => { const id = Q.createLine('x', [{ label: 'A', odds: -110 }, { label: 'B', odds: -110 }]); const opts = Q.db.prepare('SELECT id FROM options WHERE line_id=? ORDER BY id').all(id); Q.placeBet(uid, opts[0].id, 10); Q.settleLine(id, win ? opts[0].id : opts[1].id); };
  mk(a, true); mk(a, true); mk(a, true); mk(a, false);
  mk(b, true); mk(b, true); mk(b, false);
  mk(c, true);
  const all = Q.tabla('temporada');
  assert.equal(all.period, 'temporada');
  assert.equal(all.rows[0].username, 'pedro');
  assert.equal(all.rows[0].wins, 3); assert.equal(all.rows[0].losses, 1);
  assert.equal(all.rows[0].winPct, 75);
  assert.ok(all.activity.length >= 1);
  assert.ok(all.activity[0].status === 'won' || all.activity[0].status === 'lost');
  // hoy should include just-settled (ts stamped on settle)
  const hoy = Q.tabla('hoy');
  assert.equal(hoy.rows.find(r => r.username === 'pedro').wins, 3);
  // future cutoff empty: force cutoff beyond now via periodCutoff mock? semana also includes
  const lb = Q.leaderboard('temporada');
  assert.ok(lb.find(r => r.username === 'pedro').losses === 1);
  assert.ok('winPct' in lb[0]);
});

t('podio: mín. 3 liquidadas; 0 elegibles = vacío; pendientes/anuladas no cuentan', () => {
  const Q = open(':memory:'); Q.setupAdmin('angel', '1234');
  assert.equal(Q.PODIUM_MIN_SETTLED, 3);
  const a = Q.register(Q.newInvite(), 'p0', '1111');
  const b = Q.register(Q.newInvite(), 'p1', '1111');
  const mk = (uid, win) => { const id = Q.createLine('x', [{ label: 'A', odds: -110 }, { label: 'B', odds: -110 }]); const opts = Q.db.prepare('SELECT id FROM options WHERE line_id=? ORDER BY id').all(id); Q.placeBet(uid, opts[0].id, 10); Q.settleLine(id, win ? opts[0].id : opts[1].id); };
  // 0 settled → empty podium; table still lists players
  let t0 = Q.tabla('temporada');
  assert.deepEqual(t0.podium, []);
  assert.ok(t0.rows.some(r => r.username === 'p0'));
  // 2 settled each: still ineligible
  mk(a, true); mk(a, true); mk(b, false); mk(b, true);
  t0 = Q.tabla('temporada');
  assert.deepEqual(t0.podium.map(r => r.username), []);
  assert.equal(t0.rows.find(r => r.username === 'p0').wins + t0.rows.find(r => r.username === 'p0').losses, 2);
  // pending + cancelled do not count toward the 3
  const idP = Q.createLine('pend', [{ label: 'A', odds: -110 }, { label: 'B', odds: -110 }]);
  const opP = Q.db.prepare('SELECT id FROM options WHERE line_id=? ORDER BY id').all(idP);
  Q.placeBet(a, opP[0].id, 10); // pending
  const idC = Q.createLine('canc', [{ label: 'A', odds: -110 }, { label: 'B', odds: -110 }]);
  const opC = Q.db.prepare('SELECT id FROM options WHERE line_id=? ORDER BY id').all(idC);
  Q.placeBet(a, opC[0].id, 10); Q.cancelLine(idC); // refunded
  t0 = Q.tabla('temporada');
  assert.deepEqual(t0.podium, []);
  assert.equal(t0.rows.find(r => r.username === 'p0').wins + t0.rows.find(r => r.username === 'p0').losses, 2);
  // 3rd settled → a alone on podium (1st), 2nd/3rd empty
  mk(a, true);
  t0 = Q.tabla('temporada');
  assert.deepEqual(t0.podium.map(r => r.username), ['p0']);
  assert.equal(t0.podium.length, 1);
  assert.equal(t0.rows.length >= 2, true);
});
t('podio: 2 elegibles ocupan 1º/2º; 3 elegibles respetan orden ranking', () => {
  const Q = open(':memory:'); Q.setupAdmin('angel', '1234');
  const a = Q.register(Q.newInvite(), 'alpha', '1111');
  const b = Q.register(Q.newInvite(), 'beta', '1111');
  const c = Q.register(Q.newInvite(), 'gamma', '1111');
  const d = Q.register(Q.newInvite(), 'delta', '1111'); // ineligible (<3)
  const mk = (uid, win) => { const id = Q.createLine('x', [{ label: 'A', odds: -110 }, { label: 'B', odds: -110 }]); const opts = Q.db.prepare('SELECT id FROM options WHERE line_id=? ORDER BY id').all(id); Q.placeBet(uid, opts[0].id, 10); Q.settleLine(id, win ? opts[0].id : opts[1].id); };
  // alpha: 3W, beta: 2W1L, gamma: 1W2L, delta: 1W only
  mk(a, true); mk(a, true); mk(a, true);
  mk(b, true); mk(b, true); mk(b, false);
  mk(c, true); mk(c, false); mk(c, false);
  mk(d, true);
  // also a parlay win for alpha counts as 1 settled
  const L1 = Q.createLine('p1', [{ label: 'A', odds: 100 }, { label: 'B', odds: 100 }]);
  const L2 = Q.createLine('p2', [{ label: 'A', odds: 100 }, { label: 'B', odds: 100 }]);
  const o1 = Q.db.prepare('SELECT id FROM options WHERE line_id=? ORDER BY id').all(L1)[0].id;
  const o2 = Q.db.prepare('SELECT id FROM options WHERE line_id=? ORDER BY id').all(L2)[0].id;
  Q.placeParlay(a, [o1, o2], 10); Q.settleLine(L1, o1); Q.settleLine(L2, o2);
  let t = Q.tabla('temporada');
  assert.deepEqual(t.podium.map(r => r.username), ['alpha', 'beta', 'gamma']);
  assert.ok(t.rows.some(r => r.username === 'delta')); // still in table
  assert.ok(!t.podium.some(r => r.username === 'delta'));
  // only 2 eligible if gamma drops below 3 via period hoy with no bets? instead remove gamma eligibility by checking with 2 players only after wiping? Simpler: new db with 2 eligible
  const Q2 = open(':memory:'); Q2.setupAdmin('angel', '1234');
  const x = Q2.register(Q2.newInvite(), 'uno', '1111');
  const y = Q2.register(Q2.newInvite(), 'dos', '1111');
  const z = Q2.register(Q2.newInvite(), 'tres', '1111');
  const mk2 = (uid, win) => { const id = Q2.createLine('x', [{ label: 'A', odds: -110 }, { label: 'B', odds: -110 }]); const opts = Q2.db.prepare('SELECT id FROM options WHERE line_id=? ORDER BY id').all(id); Q2.placeBet(uid, opts[0].id, 10); Q2.settleLine(id, win ? opts[0].id : opts[1].id); };
  mk2(x, true); mk2(x, true); mk2(x, false); // 3
  mk2(y, true); mk2(y, false); mk2(y, false); // 3
  mk2(z, true); mk2(z, true); // 2 ineligible
  t = Q2.tabla('temporada');
  assert.deepEqual(t.podium.map(r => r.username), ['uno', 'dos']);
  assert.equal(t.podium.length, 2);
  assert.ok(t.rows.some(r => r.username === 'tres'));
});
t('podio: filtro por periodo (hoy vs temporada)', () => {
  const Q = open(':memory:'); Q.setupAdmin('angel', '1234');
  const a = Q.register(Q.newInvite(), 'per', '1111');
  const mk = (uid, win) => { const id = Q.createLine('x', [{ label: 'A', odds: -110 }, { label: 'B', odds: -110 }]); const opts = Q.db.prepare('SELECT id FROM options WHERE line_id=? ORDER BY id').all(id); Q.placeBet(uid, opts[0].id, 10); Q.settleLine(id, win ? opts[0].id : opts[1].id); return id; };
  mk(a, true); mk(a, true); mk(a, true);
  assert.deepEqual(Q.tabla('temporada').podium.map(r => r.username), ['per']);
  assert.deepEqual(Q.tabla('hoy').podium.map(r => r.username), ['per']);
  // backdate all settles so hoy has 0
  Q.db.prepare('UPDATE bets SET ts=?').run(1); // ancient
  assert.deepEqual(Q.tabla('hoy').podium, []);
  assert.deepEqual(Q.tabla('temporada').podium.map(r => r.username), ['per']);
});


t('tabla: admin incluido en lista; 0 bets ok; admin elegible al podio', () => {
  const Q = open(':memory:'); const ad = Q.setupAdmin('angel', '1234');
  const f = Q.register(Q.newInvite(), 'amigo', '1111');
  // admin with zero settled still appears in lower table
  let t = Q.tabla('temporada');
  assert.ok(t.rows.some(r => r.username === 'angel'), 'admin must appear in rows');
  assert.ok(t.rows.some(r => r.username === 'amigo'));
  assert.deepEqual(t.podium, []);
  const adminRow = t.rows.find(r => r.username === 'angel');
  assert.equal(adminRow.wins + adminRow.losses, 0);
  // friend with 2 settled: in table, not podium; admin still in table
  const mk = (uid, win) => { const id = Q.createLine('x', [{ label: 'A', odds: -110 }, { label: 'B', odds: -110 }]); const opts = Q.db.prepare('SELECT id FROM options WHERE line_id=? ORDER BY id').all(id); Q.placeBet(uid, opts[0].id, 10); Q.settleLine(id, win ? opts[0].id : opts[1].id); };
  mk(f, true); mk(f, true);
  t = Q.tabla('temporada');
  assert.ok(t.rows.some(r => r.username === 'angel'));
  assert.ok(t.rows.some(r => r.username === 'amigo'));
  assert.deepEqual(t.podium, []);
  // admin reaches 3 settled → alone on podium; both still in rows
  mk(ad, true); mk(ad, true); mk(ad, false);
  t = Q.tabla('temporada');
  assert.deepEqual(t.podium.map(r => r.username), ['angel']);
  assert.ok(t.rows.some(r => r.username === 'angel'));
  assert.ok(t.rows.some(r => r.username === 'amigo'));
  assert.equal(t.rows.length, 2);
  // friend also qualifies → order by wins (admin 2W1L, friend needs 3rd)
  mk(f, true);
  t = Q.tabla('temporada');
  assert.deepEqual(t.podium.map(r => r.username), ['amigo', 'angel']); // amigo 3W0L vs angel 2W1L
  assert.equal(t.rows.length, 2);
});


t('minijuegos: nuevos retos pen/bb/tc bloqueados; RPS sigue; legacy resoluble', () => {
  const Q = open(':memory:'); Q.setupAdmin('angel', '1234');
  const a = Q.register(Q.newInvite(), 'na', '1111'), b = Q.register(Q.newInvite(), 'nb', '1111');
  assert.ok(Q.DISABLED_NEW_MINIGAMES.has('pen') && Q.DISABLED_NEW_MINIGAMES.has('bb') && Q.DISABLED_NEW_MINIGAMES.has('tc'));
  for (const fn of ['penChallenge', 'bbChallenge', 'tcChallenge']) assert.throws(() => Q[fn](a, b, 100), /ya no está disponible/);
  // RPS still works
  const g = Q.rpsChallenge(a, b, 100).id; Q.rpsRespond(b, g, true); Q.rpsPick(a, g, 'piedra'); assert.equal(Q.rpsPick(b, g, 'tijera').result, 'perdiste');
  // legacy resolve still works when game already exists (via test hook for insert path)
  Q._testAllowDisabled = true;
  const p = Q.penChallenge(a, b, 50).id; Q._testAllowDisabled = false;
  // cannot create another while disabled
  assert.throws(() => Q.penChallenge(a, b, 50), /ya no está disponible/);
  // but existing pending can still be declined / accepted and resolved
  Q.penRespond(b, p, false); assert.equal(Q.penView(a, p).status, 'declined');
  Q._testAllowDisabled = true; const p2 = Q.penChallenge(a, b, 100).id; Q._testAllowDisabled = false;
  Q.penRespond(b, p2, true);
  // a scores, b saved every round → decisive after 5
  for (let r = 0; r < 5; r++) { Q.penPlay(a, p2, 'derecha', 'centro'); Q.penPlay(b, p2, 'centro', 'izquierda'); }
  assert.equal(Q.penView(a, p2).status, 'done');
  Q._testAllowDisabled = true; const bb = Q.bbChallenge(a, b, 100).id; Q._testAllowDisabled = false;
  Q.bbRespond(b, bb, false); assert.equal(Q.bbView(a, bb).status, 'declined');
  Q._testAllowDisabled = true; const tc = Q.tcChallenge(a, b, 100, 0).id; Q._testAllowDisabled = false;
  Q.tcRespond(b, tc, false, 1); assert.equal(Q.tcView(a, tc).status, 'declined');
});

console.log(`\n${n} pruebas OK`);


