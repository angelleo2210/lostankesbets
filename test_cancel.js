const assert = require('node:assert/strict'); const { open } = require('./core');
let n = 0; const t = (name, fn) => { fn(); console.log('OK', name); n++; };
const mk = () => {
  const D = open(':memory:'); D.setupAdmin('admin', '1234');
  const a = D.register(D.newInvite(), 'angel', '1234'); const b = D.register(D.newInvite(), 'otro', '1234');
  D.db.prepare('UPDATE users SET coins=1000 WHERE id IN (?,?)').run(a, b);
  const coins = uid => D.db.prepare('SELECT coins FROM users WHERE id=?').get(uid).coins;
  const S = Date.parse('2026-11-10T20:00:00Z');
  const ev = (id, starts) => ({ id, title: 'A vs B', home: 'A', away: 'B', starts, markets: [
    { key: 'h2h', options: [{ label: 'A', odds: -110 }, { label: 'B', odds: -110 }] },
    { key: 'totals', options: [{ label: 'Over', point: 2.5, odds: 100 }, { label: 'Under', point: 2.5, odds: -120 }] }] });
  return { D, a, b, coins, S, ev, opt: (lid, out) => D.lines().find(x => x.id === lid).options.find(o => o.outcome === out) };
};
t('cancel before start refunds once; double cancel rejected; after start rejected', () => {
  const { D, a, coins, S, ev, opt } = mk(); const [w] = D.createEvent(ev('x', new Date(S).toISOString()));
  const id = D.placeBet(a, opt(w, 'A').id, 100, S - 1000); assert.equal(coins(a), 900);
  const r = D.cancelBet(a, id, S - 500); assert.equal(r.refunded, 100); assert.equal(coins(a), 1000);
  assert.equal(D.db.prepare('SELECT status, payout FROM bets WHERE id=?').get(id).status, 'cancelled');
  assert.throws(() => D.cancelBet(a, id, S - 400), /ya no se puede cancelar/); assert.equal(coins(a), 1000);
  const id2 = D.placeBet(a, opt(w, 'A').id, 50, S - 100); assert.throws(() => D.cancelBet(a, id2, S), /ya empezó/); assert.equal(coins(a), 950);
  assert.equal(D.myBets(a, S - 100).find(x => x.id === id2).cancellable, true);
  assert.equal(D.myBets(a, S).find(x => x.id === id2).cancellable, false);
});
t('parlay: cancel only if all legs before start; one started leg rejected', () => {
  const { D, a, coins, S, ev, opt } = mk();
  const [w1, t1] = D.createEvent(ev('p1', new Date(S).toISOString()));
  const [w2] = D.createEvent({ ...ev('p2', new Date(S + 3600e3).toISOString()), home: 'C', away: 'D', title: 'C vs D', markets: [{ key: 'h2h', options: [{ label: 'C', odds: 120 }, { label: 'D', odds: -140 }] }] });
  const pid = D.placeParlay(a, [opt(w1, 'A').id, opt(w2, 'C').id], 80, S - 10); assert.equal(coins(a), 920);
  assert.throws(() => D.cancelParlay(a, pid, S + 1), /ya empezó/); assert.equal(coins(a), 920);
  const pid2 = D.placeParlay(a, [opt(t1, 'Over').id, opt(w2, 'C').id], 40, S - 5);
  // both before first start — wait, t1 shares start with w1. Use only w2 legs? Need two future events.
  D.setEventStart(D.db.prepare('SELECT id FROM users WHERE is_admin=1').get().id, w1, new Date(S + 7200e3).toISOString());
  const r = D.cancelParlay(a, pid, S + 1); // w1 rescheduled future, w2 future
  assert.equal(r.refunded, 80); assert.equal(coins(a), 960);
  assert.equal(D.db.prepare('SELECT status FROM parlays WHERE id=?').get(pid).status, 'cancelled');
  assert.throws(() => D.cancelParlay(a, pid, S + 2), /ya no se puede/);
});
t('other user cannot cancel; cancelled ignored by rankings; can bet again', () => {
  const { D, a, b, coins, S, ev, opt } = mk(); const [w] = D.createEvent(ev('r', new Date(S).toISOString()));
  const id = D.placeBet(a, opt(w, 'A').id, 25, S - 1);
  assert.throws(() => D.cancelBet(b, id, S - 1), /no encontrada/); assert.equal(coins(a), 975);
  D.cancelBet(a, id, S - 1); assert.equal(coins(a), 1000);
  const board = D.leaderboard('temporada'); const row = board.find(u => u.id === a);
  assert.equal(row.wins + row.losses, 0); // cancelled not settled
  D.placeBet(a, opt(w, 'B').id, 10, S - 1); assert.equal(coins(a), 990);
});
t('routes exist and require auth shape', () => {
  const src = require('node:fs').readFileSync(__dirname + '/server.js', 'utf8');
  assert.ok(src.includes("app.post('/api/bet/cancel'") && src.includes("app.post('/api/parlay/cancel'"));
  const app = require('node:fs').readFileSync(__dirname + '/public/app.js', 'utf8');
  assert.ok(app.includes('Cancelar apuesta') && app.includes('CANCELADA') && app.includes('/bet/cancel'));
});
t('no starts: cancellable until settled; settled rejects', () => {
  const { D, a, coins, opt } = mk(); const [w] = D.createEvent({ id: 'n', title: 'X vs Y', home: 'X', away: 'Y', markets: [{ key: 'h2h', options: [{ label: 'X', odds: 100 }, { label: 'Y', odds: -120 }] }] });
  const id = D.placeBet(a, opt(w, 'X').id, 30); assert.equal(D.myBets(a).find(x => x.id === id).cancellable, true);
  D.cancelBet(a, id); assert.equal(coins(a), 1000);
  const id2 = D.placeBet(a, opt(w, 'X').id, 20); D.settleLine(w, opt(w, 'X').id);
  assert.throws(() => D.cancelBet(a, id2), /ya no se puede|liquidado/);
});
console.log(n, 'cancel tests passed');
