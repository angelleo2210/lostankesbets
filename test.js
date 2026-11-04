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
  assert.throws(() => Q.setProfile(ids[1], '', '', null, { hat: 'corona' }), /Bloqueado/); assert.throws(() => Q.setProfile(ids[3], '', '', null, { hat: 'gorra_campeon' }), /Bloqueado/);
  assert.throws(() => Q.setProfile(ids[0], '', '', null, { hat: 'oro' }), /inválido/);
  assert.deepEqual(Q.setProfile(ids[0], '', '', null, { hat: 'corona', color: 'oro', accessory: 'diamante' }).cosmetics, { hat: 'corona', color: 'oro', accessory: 'diamante' });
  const [L2, S2, N2] = mk(); Q.placeBet(ids[0], N2.id, 10000); Q.placeBet(ids[3], S2.id, 5000); Q.settleLine(L2, S2.id); // aa 43000 cae; dd 54900 sube a 1
  lb = Q.leaderboard(); const aa = lb.find(r => r.username === 'aa');
  assert.equal(aa.badge, null); assert.equal(aa.cosmetics.hat, 'corona'); assert.ok(has(ids[0], 'corona')); // trofeo conservado
  assert.equal(lb.find(r => r.username === 'dd').badge, '🥇'); assert.ok(has(ids[3], 'corona'));
  assert.ok(Q.setProfile(ids[0], '', '', null, { hat: 'corona' })); // aún puede usarlo
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
t('migración idempotente users', () => { const f = require('os').tmpdir() + '/ltb-mig-' + process.pid + '.db';
  const { DatabaseSync } = require('node:sqlite'); const d = new DatabaseSync(f); d.exec('CREATE TABLE users(id INTEGER PRIMARY KEY, username TEXT UNIQUE COLLATE NOCASE, pin_hash TEXT, salt TEXT, coins INTEGER, is_admin INTEGER DEFAULT 0)'); d.close();
  open(f).db.close(); const Q = open(f); assert.ok(Q.db.prepare('PRAGMA table_info(users)').all().some(c => c.name === 'display_name') && Q.db.prepare('PRAGMA table_info(users)').all().some(c => c.name === 'facial_hair')); Q.db.close(); require('fs').unlinkSync(f); });
console.log(`\n${n} pruebas OK`);
