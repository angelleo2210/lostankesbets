const assert = require('node:assert/strict'); const { open } = require('./core'); const Markets = require('./public/markets');
let n = 0; const t = (name, fn) => { fn(); console.log('OK', name); n++; };
const base = (id, starts) => ({ id, title: 'Yankees vs Red Sox', home: 'Yankees', away: 'Red Sox', unit: 'carreras', sport: 'baseball', starts, markets: [
  { key: 'h2h', options: [{ label: 'Yankees', odds: -140 }, { label: 'Red Sox', odds: 120 }] },
  { key: 'totals', options: [{ label: 'Over', point: 8.5, odds: -110 }, { label: 'Under', point: 8.5, odds: -110 }] }] });
const mk = () => { const D = open(':memory:'); D.setupAdmin('admin', '1234'); const adminId = D.db.prepare('SELECT id FROM users WHERE is_admin=1').get().id;
  const u = D.register(D.newInvite(), 'pepe', '1234'); D.db.prepare('UPDATE users SET coins=5000 WHERE id=?').run(u);
  const coins = () => D.db.prepare('SELECT coins FROM users WHERE id=?').get(u).coins;
  const opt = (lid, out) => D.lines().find(x => x.id === lid).options.find(o => o.outcome === out || o.label === out || o.label.endsWith(' · ' + out));
  return { D, adminId, u, coins, opt }; };
t('add multiple props to event; appear linked; unique titles', () => {
  const { D, adminId, u, opt } = mk(); const [w] = D.createEvent(base('bb1'));
  const p1 = D.addEventMarket(w, 'props', [{ label: 'Más de 1.5', odds: -120 }, { label: 'Menos de 1.5', odds: 100 }], 'Yankees', 'Red Sox', '', 'Aaron Judge 1.5+ hits');
  const p2 = D.addEventMarket(w, 'props', [{ label: 'Más de 6.5', odds: 110 }, { label: 'Menos de 6.5', odds: -130 }], 'Yankees', 'Red Sox', '', 'Gerrit Cole strikeouts');
  assert.throws(() => D.addEventMarket(w, 'props', [{ label: 'A', odds: 100 }, { label: 'B', odds: -110 }], 'Yankees', 'Red Sox', '', 'Aaron Judge 1.5+ hits'), /ese título/);
  const ls = D.lines(); assert.equal(ls.filter(l => l.market === 'props').length, 2);
  assert.equal(ls.find(l => l.id === p1).prop_title, 'Aaron Judge 1.5+ hits');
  assert.equal(ls.find(l => l.id === p1).starts, ls.find(l => l.id === w).starts);
  assert.ok(opt(p1, 'Más de 1.5').label.includes('Aaron Judge'));
});
t('bet + settle win/lose/void; inherits pause and start lock', () => {
  const { D, adminId, u, coins, opt } = mk(); const S = Date.parse('2026-11-10T20:00:00Z');
  const [w] = D.createEvent({ ...base('bb2', new Date(S).toISOString()) });
  const p = D.addEventMarket(w, 'props', [{ label: 'Sí', odds: -150 }, { label: 'No', odds: 130 }], 'Yankees', 'Red Sox', '', 'Soto HR');
  D.placeBet(u, opt(p, 'Sí').id, 100, S - 1); assert.equal(coins(), 4900);
  assert.throws(() => D.placeBet(u, opt(p, 'No').id, 10, S), /ya empezó/);
  D.setEventPaused(adminId, w, true); assert.throws(() => D.placeBet(u, opt(p, 'No').id, 10, S - 10), /pausadas/);
  D.setEventPaused(adminId, w, false); D.setEventStart(adminId, w, new Date(S + 3600e3).toISOString());
  D.placeBet(u, opt(p, 'No').id, 50, S + 10);
  D.settleLine(p, opt(p, 'Sí').id); // first bet wins, second loses
  assert.ok(coins() > 4900);
  const p2 = D.addEventMarket(w, 'props', [{ label: 'A', odds: 100 }, { label: 'B', odds: -120 }], 'Yankees', 'Red Sox', '', 'Void prop');
  D.placeBet(u, opt(p2, 'A').id, 20, S + 10); const c = coins(); D.cancelLine(p2); assert.equal(coins(), c + 20);
});
t('parlay: props combine with same-match markets and other events; odds = plain product; same line still blocked', () => {
  const { D, u, opt, coins } = mk();
  const [w1, tot] = D.createEvent(base('a')); const [w2] = D.createEvent({ ...base('b'), home: 'Dodgers', away: 'Giants', title: 'Dodgers vs Giants', markets: [{ key: 'h2h', options: [{ label: 'Dodgers', odds: -110 }, { label: 'Giants', odds: -110 }] }] });
  const p = D.addEventMarket(w1, 'props', [{ label: 'Over', odds: 100 }, { label: 'Under', odds: -120 }], 'Yankees', 'Red Sox', '', 'Judge hits');
  const p2 = D.addEventMarket(w1, 'props', [{ label: 'Sí', odds: -150 }, { label: 'No', odds: 130 }], 'Yankees', 'Red Sox', '', 'Soto HR');
  // other event
  D.placeParlay(u, [opt(p, 'Over').id, opt(w2, 'Dodgers').id], 50);
  // same match: prop + moneyline + another prop (product of odds, not SGP model)
  const c0 = coins(); const pid = D.placeParlay(u, [opt(p, 'Over').id, opt(w1, 'Yankees').id, opt(p2, 'Sí').id], 100);
  assert.equal(coins(), c0 - 100);
  const row = D.db.prepare('SELECT * FROM parlays WHERE id=?').get(pid);
  assert.equal(row.pricing, null); // plain product, no Poisson model saved
  // product: +100 => 2.0, -140 => ~1.714, -150 => ~1.667 → ~5.714
  const Sgp = require('./public/sgp');
  const legs = [
    { option: 1, line: p, event: 'custom:a', market: 'props', home: 'Yankees', away: 'Red Sox', outcome: 'Over', label: 'x', point: null, odds: 100 },
    { option: 2, line: w1, event: 'custom:a', market: 'h2h', home: 'Yankees', away: 'Red Sox', outcome: 'Yankees', label: 'y', point: null, odds: -140 },
    { option: 3, line: p2, event: 'custom:a', market: 'props', home: 'Yankees', away: 'Red Sox', outcome: 'Sí', label: 'z', point: null, odds: -150 },
  ];
  const q = Sgp.quote(legs, {}); assert.ok(!q.error); assert.ok(!q.modeled);
  assert.ok(Math.abs(q.dec - (2 * (1 + 100/140) * (1 + 100/150))) < 1e-9);
  assert.equal(Markets.sameEventError(legs), null);
  // cannot pick both sides of the same prop
  assert.throws(() => D.placeParlay(u, [opt(p, 'Over').id, opt(p, 'Under').id], 10), /Solo una selección por/);
  // settlement: win all props/ml legs
  D.settleLine(p, opt(p, 'Over').id); D.settleLine(p2, opt(p2, 'Sí').id); D.settleLine(w1, opt(w1, 'Yankees').id);
  assert.equal(D.db.prepare('SELECT status FROM parlays WHERE id=?').get(pid).status, 'won');
});
t('remove prop only without bets; createEvent can include props', () => {
  const { D, adminId, u, opt } = mk();
  const ids = D.createEvent({ ...base('c'), markets: [...base('c').markets, { key: 'props', prop_title: 'Cole Ks', options: [{ label: 'Más de 6.5', odds: 100 }, { label: 'Menos de 6.5', odds: -120 }] }] });
  const prop = D.lines().find(l => l.market === 'props' && l.prop_title === 'Cole Ks');
  assert.ok(prop); D.removeProp(adminId, prop.id); assert.ok(!D.lines().find(l => l.id === prop.id));
  const [w] = D.createEvent(base('d')); const p = D.addEventMarket(w, 'props', [{ label: 'A', odds: 100 }, { label: 'B', odds: -110 }], 'Yankees', 'Red Sox', '', 'Keep');
  D.placeBet(u, opt(p, 'A').id, 10); assert.throws(() => D.removeProp(adminId, p), /ya tiene apuestas/);
});
t('UI: Más mercados disclosure + admin prop form present', () => {
  const src = require('node:fs').readFileSync(__dirname + '/public/app.js', 'utf8');
  assert.ok(src.includes('Más mercados (') && src.includes('event-props') && src.includes('value="props"') && src.includes('prop_title'));
  assert.ok(src.includes('remove-prop') && src.includes('Agregar hándicap / total / prop'));
});
console.log(n, 'props tests passed');
