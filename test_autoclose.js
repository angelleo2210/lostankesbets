// Auto-close of NEW wagers at the stored match start (server clock). Accepted tickets never voided/refunded by it.
const assert = require('node:assert/strict'); const { open } = require('./core');
let n = 0; const t = (name, fn) => { fn(); console.log('OK', name); n++; };
const S = Date.parse('2026-11-08T20:00:00Z');
const ev = (id, starts, home = 'Rangers', away = 'Bruins') => ({ id, title: `${home} vs ${away}`, home, away, unit: 'goles', sport: 'hockey', starts, markets: [
  { key: 'h2h', options: [{ label: home, odds: -150 }, { label: away, odds: 130 }] },
  { key: 'totals', options: [{ label: 'Over', point: 6.5, odds: 120 }, { label: 'Under', point: 6.5, odds: -140 }] }] });
const mk = () => { const D = open(':memory:'); D.setupAdmin('admin', '1234'); const adminId = D.db.prepare('SELECT id FROM users WHERE is_admin=1').get().id;
  const u = D.register(D.newInvite(), 'pepe', '1234'); D.db.prepare('UPDATE users SET coins=1000 WHERE id=?').run(u);
  const coins = () => D.db.prepare('SELECT coins FROM users WHERE id=?').get(u).coins;
  const opt = (lid, out) => D.lines().find(x => x.id === lid).options.find(o => o.outcome === out || o.label === out);
  const snap = () => JSON.stringify([D.db.prepare('SELECT * FROM bets').all(), D.db.prepare('SELECT * FROM parlays').all(), D.db.prepare('SELECT * FROM parlay_legs').all(), D.db.prepare('SELECT coins FROM users').all()]);
  return { D, adminId, u, coins, opt, snap }; };
t('exact boundary: 1 ms before accepted, at start and after rejected (single + parlay), no coins debited', () => {
  const { D, u, coins, opt, snap } = mk(); const [w, tot] = D.createEvent(ev('a', '2026-11-08T15:00:00-05:00'));
  assert.equal(D.lines().find(l => l.id === w).starts, '2026-11-08T20:00:00.000Z'); // NY input persisted as UTC
  D.placeBet(u, opt(w, 'Rangers').id, 10, S - 1); assert.equal(coins(), 990);
  const s = snap();
  for (const at of [S, S + 60000]) {
    assert.throws(() => D.placeBet(u, opt(w, 'Rangers').id, 10, at), /ya empezó/);
    assert.throws(() => D.placeParlay(u, [opt(w, 'Rangers').id, opt(tot, 'Over').id], 10, at), /ya empezó/);
  }
  assert.equal(snap(), s);
});
t('stale open slip: parlay mixing a started match with an open one is rejected entirely; independent match still bettable', () => {
  const { D, u, coins, opt, snap } = mk(); const [w1] = D.createEvent(ev('a', new Date(S).toISOString()));
  const [w2] = D.createEvent(ev('b', new Date(S + 3600e3).toISOString(), 'Leafs', 'Habs')); const s = snap();
  assert.throws(() => D.placeParlay(u, [opt(w1, 'Rangers').id, opt(w2, 'Leafs').id], 10, S + 1), /ya empezó/); assert.equal(snap(), s);
  D.placeBet(u, opt(w2, 'Leafs').id, 10, S + 1); assert.equal(coins(), 990);
});
t('markets added later inherit the start and close too; lines() exposes started', () => {
  const { D, u, opt } = mk(); const [w] = D.createEvent({ ...ev('a', new Date(S).toISOString()), markets: [ev('a').markets[0]] });
  const sp = D.addEventMarket(w, 'spreads', [{ label: 'Rangers', point: -1.5, odds: 150 }, { label: 'Bruins', point: 1.5, odds: -170 }], 'Rangers', 'Bruins');
  assert.throws(() => D.placeBet(u, opt(sp, 'Rangers').id, 5, S), /ya empezó/);
  assert.equal(D.lines().find(l => l.id === sp).starts, new Date(S).toISOString());
});
t('no stored start (legacy/unknown) => no timed lock', () => {
  const { D, u, opt } = mk(); const [w] = D.createEvent(ev('a', null)); D.placeBet(u, opt(w, 'Rangers').id, 5, S + 1e12);
  const legacy = D.createLine('A vs B', [{ label: 'A', odds: 110 }, { label: 'B', odds: -120 }]); D.placeBet(u, D.lines().find(l => l.id === legacy).options[0].id, 5, S + 1e12);
});
t('pause and start are independent; unpausing after start does not reopen; only explicit reschedule reopens', () => {
  const { D, adminId, u, opt } = mk(); const [w, tot] = D.createEvent(ev('a', new Date(S).toISOString()));
  D.setEventPaused(adminId, w, true); assert.throws(() => D.placeBet(u, opt(w, 'Rangers').id, 5, S - 10), /pausadas/);
  D.setEventPaused(adminId, w, false); assert.throws(() => D.placeBet(u, opt(w, 'Rangers').id, 5, S + 10), /ya empezó/);
  D.setEventStart(adminId, w, new Date(S + 7200e3).toISOString()); assert.equal(D.lines().find(l => l.id === tot).starts, new Date(S + 7200e3).toISOString());
  D.placeBet(u, opt(tot, 'Over').id, 5, S + 10);
  assert.throws(() => D.setEventStart(adminId, w, 'mañana'), /inválida/); assert.throws(() => D.setEventStart(u, w, null), /administrador/);
});
t('start does not void/refund accepted tickets; admin settles normally after start', () => {
  const { D, u, coins, opt } = mk(); const [w, tot] = D.createEvent(ev('a', new Date(S).toISOString()));
  D.placeBet(u, opt(w, 'Rangers').id, 100, S - 5); D.placeParlay(u, [opt(w, 'Rangers').id, opt(tot, 'Over').id], 50, S - 5); assert.equal(coins(), 850);
  assert.throws(() => D.placeBet(u, opt(w, 'Bruins').id, 5, S)); // closure attempt
  assert.equal(D.db.prepare("SELECT COUNT(*) c FROM bets WHERE status='open'").get().c, 1); assert.equal(D.db.prepare("SELECT status FROM parlays").get().status, 'open'); assert.equal(coins(), 850);
  D.settleLine(w, opt(w, 'Rangers').id); assert.ok(coins() > 850);
  assert.equal(D.db.prepare("SELECT status FROM parlays").get().status, 'open'); // waits for totals leg
});
t('bank header summary is read-only and reports last-loan / closed states', () => {
  const { D, u } = mk(); const before = D.db.prepare('SELECT COUNT(*) c FROM bank').get().c;
  assert.deepEqual(D.bankBrief(u), { debt: 0, loans: 0, loansLeft: 10, maxLoan: 100000, state: 'open' }); assert.equal(D.db.prepare('SELECT COUNT(*) c FROM bank').get().c, before);
  for (let i = 0; i < 4; i++) D.takeLoan(u, 1000); assert.equal(D.bankBrief(u).loansLeft, 6); assert.equal(D.bankBrief(u).debt, 4000);
  D.takeLoan(u, 1000); assert.equal(D.bankBrief(u).state, 'open'); assert.equal(D.bankBrief(u).loans, 5); D.takeLoan(u, 1);
  assert.throws(() => D.takeLoan(u, 100001));
});
console.log(n, 'auto-close/bank-header tests passed');
