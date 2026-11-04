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
t('parlay multiplica: +100 y +200 => 6.0 (+500)', () => {
  const Q = open(':memory:'); Q.setupAdmin('angel', '1234'); const q = Q.register(Q.newInvite(), 'yy', '1111');
  const a1 = Q.createLine('A', [{ label: 'S', odds: 100 }, { label: 'N', odds: -110 }]), a2 = Q.createLine('B', [{ label: 'S', odds: 200 }, { label: 'N', odds: -110 }]);
  const o = id => Q.lines().find(l => l.id === id).options[0].id; Q.placeParlay(q, [o(a1), o(a2)], 100);
  const pp = Q.myParlays(q)[0]; assert.equal(pp.odds, 500); assert.equal(pp.potential, 600);
  Q.settleLine(a1, o(a1)); Q.settleLine(a2, o(a2)); assert.equal(Q.myParlays(q)[0].payout, 600); assert.equal(Q.db.prepare('SELECT coins FROM users WHERE id=?').get(q).coins, 50500);
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
console.log(`\n${n} pruebas OK`);
