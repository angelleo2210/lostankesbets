// Per-match admin pause + sport-aware same-match pricing (hockey).
const assert = require('node:assert/strict'); const { open } = require('./core'); const S = require('./public/sgp');
let n = 0; const t = (name, fn) => { fn(); console.log('OK', name); n++; };
const hockey = (id, sport = 'hockey') => ({ id, title: 'Rangers vs Bruins', home: 'Rangers', away: 'Bruins', unit: 'goles', sport, markets: [
  { key: 'h2h', options: [{ label: 'Rangers', odds: -150 }, { label: 'Bruins', odds: 130 }] },
  { key: 'totals', options: [{ label: 'Over', point: 6.5, odds: 120 }, { label: 'Under', point: 6.5, odds: -140 }] }] });
const mk = () => { const D = open(':memory:'); D.setupAdmin('admin', '1234'); const adminId = D.db.prepare('SELECT id FROM users WHERE is_admin=1').get().id;
  const u = D.register(D.newInvite(), 'pepe', '1234'); const coins = () => D.db.prepare('SELECT coins FROM users WHERE id=?').get(u).coins;
  const ol = (id, out) => D.lines().find(x => x.id === id).options.find(o => o.outcome === out || o.label === out);
  const snap = () => JSON.stringify([D.db.prepare('SELECT * FROM bets').all(), D.db.prepare('SELECT * FROM parlays').all(), D.db.prepare('SELECT * FROM parlay_legs').all(), D.db.prepare('SELECT coins FROM users').all()]);
  return { D, adminId, u, coins, ol, snap }; };
t('pause blocks singles and parlays on every market of the match (incl. added later), before any debit; other matches unaffected', () => {
  const { D, adminId, u, coins, ol, snap } = mk(); const [w, tot] = D.createEvent(hockey('a'), 'custom'); const [w2] = D.createEvent(hockey('b'), 'custom');
  const pend = D.placeBet(u, ol(w, 'Rangers').id, 50); D.placeParlay(u, [ol(w, 'Bruins').id, ol(w2, 'Rangers').id], 10);
  D.setEventPaused(adminId, tot, true); const before = snap();
  for (const id of [ol(w, 'Rangers').id, ol(tot, 'Over').id]) assert.throws(() => D.placeBet(u, id, 10), /pausadas/);
  assert.throws(() => D.placeParlay(u, [ol(w2, 'Bruins').id, ol(tot, 'Under').id], 10), /pausadas/);
  const sp = D.addEventMarket(w, 'spreads', [{ label: 'Rangers', point: -1.5, odds: 170 }, { label: 'Bruins', point: 1.5, odds: -200 }], 'Rangers', 'Bruins');
  assert.throws(() => D.placeBet(u, ol(sp, 'Bruins').id, 10), /pausadas/); assert.equal(snap(), before);
  assert.ok(D.lines().filter(l => [w, tot, sp].includes(l.id)).every(l => l.paused && l.status === 'open'));
  assert.ok(D.placeBet(u, ol(w2, 'Bruins').id, 10)); assert.equal(D.lines().find(l => l.id === w2).paused, false);
  D.settleLine(w, ol(w, 'Rangers').id); assert.equal(D.myBets(u).find(b => b.id === pend).status, 'won'); // pending settle normally while paused
  D.setEventPaused(adminId, tot, false); assert.ok(D.placeBet(u, ol(tot, 'Over').id, 10)); assert.ok(D.placeBet(u, ol(sp, 'Rangers').id, 10));
  assert.ok(coins() > 0);
});
t('admin-only; settled matches cannot be paused/reactivated; legacy line pauses alone', () => {
  const { D, adminId, u, ol } = mk(); const [w, tot] = D.createEvent(hockey('c'), 'custom');
  assert.throws(() => D.setEventPaused(u, w, true), /Solo el administrador/); assert.throws(() => D.setEventSport(u, w, 'soccer'), /Solo el administrador/);
  D.settleLine(w, ol(w, 'Rangers').id); D.settleLine(tot, ol(tot, 'Over').id);
  assert.throws(() => D.setEventPaused(adminId, w, true), /sin liquidar/); assert.throws(() => D.setEventPaused(adminId, w, false), /sin liquidar/);
  assert.equal(D.lines().find(l => l.id === w).status, 'settled');
  const a = D.createLine('Legacy A', [{ label: 'X', odds: 110 }, { label: 'Y', odds: -120 }]), b = D.createLine('Legacy B', [{ label: 'X', odds: 110 }, { label: 'Y', odds: -120 }]);
  D.setEventPaused(adminId, a, true); assert.throws(() => D.placeBet(u, ol(a, 'X').id, 5), /pausadas/); assert.ok(D.placeBet(u, ol(b, 'X').id, 5));
  const src = require('node:fs').readFileSync(__dirname + '/server.js', 'utf8'); assert.ok(src.includes("C.setEventPaused(admin(r).id") && src.includes("C.setEventSport(admin(r).id"));
  const app = require('node:fs').readFileSync(__dirname + '/public/app.js', 'utf8'); assert.ok(app.includes("l.status === 'open' && !paused ?") && app.includes('Apuestas pausadas'));
});
const ML = sp => [{ market: 'h2h', sport: sp, home: 'H', away: 'A', options: [{ outcome: 'H', odds: -150 }, { outcome: 'A', odds: 130 }] }, { market: 'totals', sport: sp, home: 'H', away: 'A', options: [{ outcome: 'Over', point: 6.5, odds: 120 }, { outcome: 'Under', point: 6.5, odds: -140 }] }];
const leg = (market, outcome, point, odds) => ({ event: 'e', line: market === 'h2h' ? 1 : market === 'totals' ? 2 : 3, option: outcome + market, market, home: 'H', away: 'A', outcome, point, odds });
t('hockey ML -150/+130 + O/U 6.5 +120/-140: all favourite/underdog x Over/Under priced; final score never level', () => {
  const f = S.fit(ML('hockey')); assert.ok(!f.error && f.tb && f.rmse < 0.001);
  let tot = 0; for (const s of ['H', 'A']) tot += S.jointP(f, [{ market: 'h2h', outcome: s, home: 'H', away: 'A' }]); assert.ok(Math.abs(tot - 1) < 1e-12);
  for (const s of ['H', 'A']) for (const ou of ['Over', 'Under']) { const q = S.quote([leg('h2h', s, null, s === 'H' ? -150 : 130), leg('totals', ou, 6.5, ou === 'Over' ? 120 : -140)], { e: ML('hockey') }); assert.ok(q.modeled && q.dec > 1, JSON.stringify(q)); }
  const pl = [{ market: 'spreads', sport: 'hockey', home: 'H', away: 'A', options: [{ outcome: 'H', point: -1.5, odds: 170 }, { outcome: 'A', point: 1.5, odds: -200 }] }, ML('hockey')[1]];
  const q = S.quote([leg('spreads', 'A', 1.5, -200), leg('totals', 'Under', 6.5, -140)], { e: pl }); assert.ok(q.modeled && q.dec > 1, JSON.stringify(q)); assert.equal(S.fit(pl).tb, true);
  // H +0.5 and A +0.5 together can only win on a level FINAL score: impossible in hockey -> explicit contradiction
  assert.equal(S.jointP(f, [{ market: 'spreads', outcome: 'H', point: 0.5, home: 'H', away: 'A' }, { market: 'spreads', outcome: 'A', point: 0.5, home: 'H', away: 'A' }]), 0);
  const q0 = S.quote([leg('totals', 'Under', 6.5, -140), { ...leg('spreads', 'H', 0.5, -110), line: 4 }, { ...leg('spreads', 'A', 0.5, -110), line: 5 }], { e: pl }); assert.ok(!q0.error && q0.dec > 1); // product fallback, never block
});
t('soccer stays regulation (no fake goal); unspecified sport 2-way defaults to decided winner', () => {
  assert.equal(S.fit(ML(null)).tb, true); assert.match(S.fit(ML('soccer')).error, /no encajan/);
  const lam = 1.6, mu = 1.1, m = S.matrix(lam, mu); const P = f => { let p = 0; m.forEach((r, h) => r.forEach((x, a) => { if (f(h, a)) p += x; })); return p; };
  const am = p => { const d = 1 / (p * 1.05); return d >= 2 ? Math.round((d - 1) * 100) : Math.round(-100 / (d - 1)); };
  const soc = [{ market: 'h2h', sport: 'soccer', home: 'H', away: 'A', options: [{ outcome: 'H', odds: am(P((h, a) => h > a)) }, { outcome: 'A', odds: am(P((h, a) => h < a)) }] }, { market: 'totals', sport: 'soccer', home: 'H', away: 'A', options: [{ outcome: 'Over', point: 2.5, odds: am(P((h, a) => h + a > 2.5)) }, { outcome: 'Under', point: 2.5, odds: am(P((h, a) => h + a < 2.5)) }] }];
  const f = S.fit(soc); assert.ok(!f.error, f.error); assert.equal(f.tb, false); assert.ok(Math.abs(f.lh - lam) < 0.1 && Math.abs(f.la - mu) < 0.1, JSON.stringify(f));
  assert.ok(S.jointP(f, [{ market: 'h2h', outcome: 'H', home: 'H', away: 'A' }]) + S.jointP(f, [{ market: 'h2h', outcome: 'A', home: 'H', away: 'A' }]) < 0.85);
});
t('server: hockey event sport stored, 2-way ML + Over 6.5 parlay accepted with v4 snapshot; sport change by admin', () => {
  const { D, adminId, u, ol } = mk(); const [w, tot] = D.createEvent(hockey('h'), 'custom'); assert.equal(D.lines().find(l => l.id === w).sport, 'hockey');
  D.placeParlay(u, [ol(w, 'Bruins').id, ol(tot, 'Over').id], 10); assert.equal(D.myParlays(u)[0].model, 'poisson-v4');
  D.setEventSport(adminId, w, 'soccer'); assert.ok(D.lines().filter(l => [w, tot].includes(l.id)).every(l => l.sport === 'soccer'));
  assert.ok(D.placeParlay(u, [ol(w, 'Rangers').id, ol(tot, 'Under').id], 10)); // soccer 2-way fit fails → product fallback
  assert.throws(() => D.setEventSport(adminId, w, 'tenis'), /inválido/);
  const [rw] = D.createEvent({ ...hockey('r'), sport: undefined, sport_key: 'icehockey_nhl' }, 'real'); assert.equal(D.lines().find(l => l.id === rw).sport, 'hockey');
});
console.log(n + ' pause/sport tests passed');
