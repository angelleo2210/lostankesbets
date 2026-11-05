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
  assert.throws(() => Q.setProfile(ids[1], '', '', null, undefined, { hat: 'corona' }), /Bloqueado/); assert.throws(() => Q.setProfile(ids[3], '', '', null, undefined, { hat: 'gorra_campeon' }), /Bloqueado/);
  assert.throws(() => Q.setProfile(ids[1], '', '', null, undefined, { shirt: 'dorada' }), /Bloqueado/); assert.ok(Q.setProfile(ids[1], '', '', null, undefined, { socks: 'doradas', shoes: 'plata' }));
  assert.throws(() => Q.setProfile(ids[2], '', '', null, undefined, { shoes: 'plata' }), /Bloqueado/); assert.ok(Q.setProfile(ids[2], '', '', null, undefined, { shoes: 'bronce' }));
  assert.throws(() => Q.setProfile(ids[0], '', '', null, { color: 'corona' }), /inválido/);
  assert.deepEqual(Q.setProfile(ids[0], '', '', null, { color: 'oro', accessory: 'diamante' }, { hat: 'corona', shirt: 'dorada', pants: 'dorado', shoes: 'oro' }).cosmetics, { color: 'oro', accessory: 'diamante' });
  const [L2, S2, N2] = mk(); Q.placeBet(ids[0], N2.id, 10000); Q.placeBet(ids[3], S2.id, 5000); Q.settleLine(L2, S2.id); // aa 43000 cae; dd 54900 sube a 1
  lb = Q.leaderboard(); const aa = lb.find(r => r.username === 'aa');
  assert.equal(aa.badge, null); assert.equal(aa.avatarCfg.hat, 'corona'); assert.equal(aa.avatarCfg.shirt, 'dorada'); assert.ok(has(ids[0], 'corona')); // trofeo conservado
  assert.equal(lb.find(r => r.username === 'dd').badge, '🥇'); assert.ok(has(ids[3], 'corona'));
  assert.ok(Q.setProfile(ids[0], '', '', null, undefined, { hat: 'corona' })); // aún puede usarlo
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
t('avatar cuerpo completo', () => {
  const AV = require('./public/avatar'); const Q = open(':memory:'); Q.setupAdmin('angel', '1234');
  const d = Q.register(Q.newInvite(), 'def', '1111'); assert.deepEqual(Q.leaderboard().find(r => r.username === 'def').avatarCfg, { ...AV.DEFAULT, wear: {} });
  const cfg = { skin: AV.SKIN[2], eyes: 'estrellas', mouth: 'lengua', hair: 'afro', hairColor: AV.HAIRC[4], hat: 'vaquero', hatColor: AV.COLORS[2], glasses: 'sol', earrings: 'aro', necklace: 'perlas', shirt: 'camisa', shirtColor: AV.COLORS[0], pants: 'chores', pantsColor: AV.COLORS[3], socks: 'largas', socksColor: AV.COLORS[8], shoes: 'botas', shoesColor: AV.COLORS[9] };
  const q = Q.register(Q.newInvite(), 'cfg', '1111', cfg); assert.deepEqual(Q.leaderboard().find(r => r.username === 'cfg').avatarCfg, { ...AV.DEFAULT, ...cfg, wear: {} });
  assert.throws(() => Q.register(Q.newInvite(), 'bad', '1111', { hat: 'corona' }), /Bloqueado/);
  for (const bad of [{ eyes: 'laser' }, { shirtColor: 'red' }, { foo: 1 }, { hairColor: '#123456' }, [1]]) assert.throws(() => Q.setProfile(q, '', '', null, undefined, bad), /inválid|desconocida/);
  Q.setProfile(q, '🦁', 'Leo', { style: 'bigote' }, undefined, { glasses: 'ninguno' }); const me = Q.leaderboard().find(r => r.username === 'cfg');
  assert.equal(me.avatarCfg.glasses, 'ninguno'); assert.equal(me.avatar, '🦁'); assert.equal(me.facialHair.style, 'bigote');
  const svg = AV.render(me.avatarCfg, { facialHair: me.facialHair }); assert.ok(svg.startsWith('<svg') && !/<script|undefined/.test(svg));
  for (const k in AV.CAT) for (const v of AV.CAT[k].opts) assert.ok(!/undefined/.test(AV.render({ [k]: v }, { facialHair: { style: 'perilla' } })), k + v);
  assert.ok(AV.render(AV.DEFAULT, { head: true }).includes('viewBox="16'));
});
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
  for (const i of ST.ITEMS) { assert.ok(ST.CATS.some(c => c[0] === i.cat), i.id); assert.ok(i.colors.includes(i.color), i.id); assert.equal(i.colors.length, 6);
    for (const c of i.colors) assert.ok(fs.existsSync(__dirname + '/public/' + ST.img(i.id, c)), i.id + c); }
  const ropa = ST.ITEMS.filter(i => i.cat === 'ropa'); assert.equal(ropa.length, 24); for (const i of ropa) { assert.ok(i.price <= 25000, i.id); assert.ok(ST.SUBS.some(s => s[0] === i.sub), i.id); }
  assert.deepEqual(['casa_familiar', 'casa_moderna', 'casa_residencia'].map(id => ST.byId(id).price), [300000, 600000, 1000000]);
  assert.equal(ST.norm('car_gt', '#1e40af'), 'azul'); assert.equal(ST.norm('cad_oro', '#c0c0c0'), 'plata'); });
t('monedas: bono diario idempotente 24h', () => { const Q = open(':memory:'); Q.setupAdmin('angel', '1234'); const q = Q.register(Q.newInvite(), 'bono', '1111'); const T = 1e12;
  assert.equal(Q.bonusStatus(q, T).available, true); const r = Q.claimBonus(q, T); assert.equal(r.claimed, true); assert.equal(r.coins, 55000);
  const r2 = Q.claimBonus(q, T + 1000); assert.equal(r2.claimed, false); assert.equal(r2.coins, 55000); assert.ok(r2.msLeft > 0 && r2.msLeft <= 86400000);
  assert.equal(Q.claimBonus(q, T + 86400000 - 1).claimed, false); assert.equal(Q.claimBonus(q, T + 86400000).coins, 60000); });
t('monedas: vender al 50%', () => { const Q = open(':memory:'); Q.setupAdmin('angel', '1234'); const q = Q.register(Q.newInvite(), 'vende', '1111'); const c = () => Q.db.prepare('SELECT coins FROM users WHERE id=?').get(q).coins;
  Q.buyItem(q, 'moto_naked'); assert.equal(c(), 20000); assert.throws(() => Q.sellItem(q, 'moto_pista'), /No es tuyo/);
  assert.deepEqual(Q.sellItem(q, 'moto_naked'), { refund: 15000, coins: 35000 }); assert.equal(Q.owned(q).length, 0); assert.throws(() => Q.sellItem(q, 'moto_naked'), /No es tuyo/);
  Q.buyItem(q, 'jet_turbo'); assert.equal(Q.sellItem(q, 'jet_turbo').refund, 6750); assert.ok(c() >= 0); });
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
  bet(1); assert.deepEqual(Q.streak(q), { kind: 'fuego', n: 3 });
  const [A, AS] = mk(), [B2, BS] = mk(); Q.placeParlay(q, [AS.id, BS.id], 10); Q.settleLine(A, AS.id); Q.settleLine(B2, BS.id); assert.deepEqual(Q.streak(q), { kind: 'fuego', n: 4 });
  bet(0); assert.equal(Q.streak(q), null); bet(0); assert.deepEqual(Q.streak(q), { kind: 'hielo', n: 2 });
  assert.deepEqual(Q.leaderboard().find(r => r.username === 'racha').streak, { kind: 'hielo', n: 2 }); });
console.log(`\n${n} pruebas OK`);
