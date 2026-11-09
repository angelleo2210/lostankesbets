// Own same-match pricing model (poisson-v2; v1 snapshots kept) + snapshot settlement.
const assert = require('node:assert/strict'); const { open } = require('./core'); const S = require('./public/sgp');
let n = 0; const t = (name, fn) => { fn(); console.log('OK', name); n++; };
const LH = 1.8, LA = 1.0, m0 = S.matrix(LH, LA);
const P = f => { let p = 0; m0.forEach((r, h) => r.forEach((x, a) => { if (f(h, a)) p += x; })); return p; };
const am = p => { const d = 1 / (p * 1.05); return d >= 2 ? Math.round((d - 1) * 100) : Math.round(-100 / (d - 1)); };
const ev = id => ({ id, title: 'PSG vs Troyes', home: 'PSG', away: 'Troyes', unit: 'goles', markets: [
  { key: 'h2h', options: [{ label: 'PSG', odds: am(P((h, a) => h > a)) }, { label: 'Troyes', odds: am(P((h, a) => h < a)) }, { label: 'Draw', odds: am(P((h, a) => h === a)) }] },
  { key: 'spreads', options: [{ label: 'PSG', point: -1.5, odds: am(P((h, a) => h - a > 1.5)) }, { label: 'Troyes', point: 1.5, odds: am(P((h, a) => a - h > -1.5)) }] },
  { key: 'totals', options: [{ label: 'Over', point: 2.5, odds: am(P((h, a) => h + a > 2.5)) }, { label: 'Under', point: 2.5, odds: am(P((h, a) => h + a < 2.5)) }] }] });
const L = (market, outcome, point) => ({ market, outcome, point, home: 'PSG', away: 'Troyes' });
const lines = e => e.markets.map(k => ({ market: k.key, home: e.home, away: e.away, options: k.options.map(o => ({ outcome: o.label, point: o.point, odds: o.odds })) }));
t('matrix normalised, tail negligible, symmetric for equal rates', () => {
  for (const [a, b] of [[0.3, 0.2], [1.8, 1], [5.5, 4]]) { let s = 0; S.matrix(a, b).forEach(r => r.forEach(x => s += x)); assert.ok(Math.abs(s - 1) < 1e-12); }
  const q = S.matrix(1.3, 1.3); for (let h = 0; h <= S.MAXG; h++) for (let a = 0; a <= S.MAXG; a++) assert.ok(Math.abs(q[h][a] - q[a][h]) < 1e-15);
});
const f = S.fit(lines(ev('x')));
t('fit recovers generating rates from de-vigged odds', () => { assert.ok(!f.error); assert.ok(Math.abs(f.lh - LH) < 0.03 && Math.abs(f.la - LA) < 0.03, JSON.stringify(f)); assert.ok(f.rmse < 0.005); });
t('joint <= marginals; redundant combo = marginal (no inflation); contradiction 0', () => {
  const win = S.jointP(f, [L('h2h', 'PSG')]), over = S.jointP(f, [L('totals', 'Over', 2.5)]), both = S.jointP(f, [L('h2h', 'PSG'), L('totals', 'Over', 2.5)]);
  assert.ok(both <= Math.min(win, over) + 1e-15 && both > win * over); // positively correlated, not product
  assert.ok(Math.abs(S.jointP(f, [L('h2h', 'PSG'), L('spreads', 'PSG', 2.5)]) - win) < 1e-12);
  assert.ok(Math.abs(S.jointP(f, [L('spreads', 'PSG', -1.5), L('h2h', 'PSG')]) - S.jointP(f, [L('spreads', 'PSG', -1.5)])) < 1e-12);
  assert.equal(S.jointP(f, [L('h2h', 'Draw'), L('spreads', 'PSG', -1.5)]), 0);
  let tot = 0; for (const o of ['PSG', 'Troyes', 'Draw']) tot += S.jointP(f, [L('h2h', o)]); assert.ok(Math.abs(tot - 1) < 1e-12);
});
t('missing data and poor fit explained, no multiplication fallback', () => {
  const e = lines(ev('x')); assert.match(S.fit([e[0]]).error, /Total de goles/); assert.match(S.fit([e[2]]).error, /Ganador o la de Hándicap/); assert.match(S.fit([e[0], e[1]]).error, /Total de goles/);
  const bad = structuredClone(e); bad[0].options[0].odds = 400; bad[0].options[2].odds = -300; assert.match(S.fit(bad).error, /no encajan/);
});
const D = open(':memory:'); D.setupAdmin('admin', '1234'); const u = D.register(D.newInvite(), 'pepe', '1234');
const coins = () => D.db.prepare('SELECT coins FROM users WHERE id=?').get(u).coins;
const op = (id, label) => D.lines().find(l => l.id === id).options.find(o => o.outcome === label || o.label === label);
const mkEv = id => D.createEvent(ev(id), 'real');
t('server quote equals client quote; snapshot frozen; settle win pays model price', () => {
  const [w, , tot] = mkEv('a'); const other = D.createLine('Otro', [{ label: 'A', odds: 110 }, { label: 'B', odds: -120 }]);
  const c0 = coins(); const ids = [op(w, 'PSG').id, op(tot, 'Over').id, op(other, 'A').id];
  // client-side quote built like app.js
  const ls = D.lines(); const legs = ids.map(id => { const l = ls.find(l => l.options.some(o => o.id === id)), o = l.options.find(o => o.id === id);
    return { option: id, line: l.id, event: l.event_id ? l.kind + ':' + l.event_id : null, market: l.market, home: l.home, away: l.away, outcome: o.outcome, point: o.point, label: o.label, odds: o.odds,
      lines: l.event_id ? ls.filter(x => x.event_id === l.event_id && x.kind === l.kind).map(x => ({ market: x.market, home: x.home, away: x.away, options: x.options.map(y => ({ label: y.label, odds: y.odds, point: y.point, outcome: y.outcome })) })) : [] }; });
  const evl = {}; legs.forEach(x => { if (x.event) evl[x.event] = x.lines; }); const cq = S.quote(legs, evl);
  D.placeParlay(u, ids, 100); const p = D.myParlays(u)[0]; assert.equal(p.model, 'poisson-v4'); assert.match(p.pricing_note, /modelo propio/);
  assert.ok(Math.abs(D.db.prepare('SELECT odds_dec FROM parlays WHERE id=?').get(p.id).odds_dec - cq.dec) < 1e-12);
  D.db.prepare('UPDATE options SET odds=999 WHERE line_id=?').run(w); // later odds change must not alter settlement
  D.settleLine(w, op(w, 'PSG').id); D.settleLine(tot, op(tot, 'Over').id); D.settleLine(other, op(other, 'A').id);
  const pay = Math.floor(100 * cq.dec); assert.equal(D.myParlays(u)[0].payout, pay); assert.equal(coins(), c0 - 100 + pay); assert.equal(D.myParlays(u)[0].status, 'won');
});
t('void in a modeled group voids the group; all void refunds; loss loses; no double pay', () => {
  let [w, , tot] = mkEv('b'); const other = D.createLine('Otro2', [{ label: 'A', odds: 110 }, { label: 'B', odds: -120 }]);
  let c0 = coins(); D.placeParlay(u, [op(w, 'PSG').id, op(tot, 'Over').id, op(other, 'A').id], 100);
  D.cancelLine(tot); D.settleLine(w, op(w, 'PSG').id); D.settleLine(other, op(other, 'A').id);
  assert.equal(D.myParlays(u)[0].payout, Math.floor(100 * 2.1)); assert.equal(coins(), c0 - 100 + 210);
  [w, , tot] = mkEv('c'); c0 = coins(); D.placeParlay(u, [op(w, 'Draw').id, op(tot, 'Under').id], 50); D.cancelLine(w); D.cancelLine(tot);
  assert.equal(D.myParlays(u)[0].status, 'refunded'); assert.equal(coins(), c0);
  [w, , tot] = mkEv('d'); c0 = coins(); D.placeParlay(u, [op(w, 'Draw').id, op(tot, 'Under').id], 50); D.settleLine(w, op(w, 'PSG').id); D.settleLine(tot, op(tot, 'Under').id);
  assert.equal(D.myParlays(u)[0].status, 'lost'); assert.equal(coins(), c0 - 50);
});
t('integer lines and hard combos fall back to product (never block); different events keep product', () => {
  const R = open(':memory:'); R.setupAdmin('admin', '1234'); const v = R.register(R.newInvite(), 'pepe', '1234');
  const e = ev('i'); e.markets[2].options.forEach(o => o.point = 3); const [w, , tot] = R.createEvent(e, 'real');
  const o2 = (id, l) => R.lines().find(x => x.id === id).options.find(o => o.outcome === l); const c = R.db.prepare('SELECT coins FROM users WHERE id=?').get(v).coins;
  assert.ok(R.placeParlay(v, [o2(w, 'PSG').id, o2(tot, 'Over').id], 10));
  assert.ok(R.placeParlay(v, [o2(w, 'Draw').id, R.lines().find(x => x.market === 'spreads').options[0].id], 10));
  assert.equal(R.db.prepare('SELECT coins FROM users WHERE id=?').get(v).coins, c - 20);
  const a = R.createLine('A1', [{ label: 'A', odds: 110 }, { label: 'B', odds: -120 }]), b = R.createLine('B1', [{ label: 'A', odds: -150 }, { label: 'B', odds: 130 }]);
  R.placeParlay(v, [R.lines().find(x => x.id === a).options[0].id, R.lines().find(x => x.id === b).options[0].id], 100); const p = R.myParlays(v)[0];
  assert.equal(p.model, undefined); assert.equal(p.pricing_note, undefined); assert.equal(p.potential, Math.floor(100 * (1 * S.dec(110) * S.dec(-150))));
});
t('legacy product tickets (pricing NULL, same_event=1) settle unchanged with push dropped', () => {
  const R = open(':memory:'); R.setupAdmin('admin', '1234'); const v = R.register(R.newInvite(), 'pepe', '1234');
  const e = ev('old'); e.markets[2].options.forEach(o => o.point = 3); const [w, , tot] = R.createEvent(e, 'real');
  const o2 = (id, l) => R.lines().find(x => x.id === id).options.find(o => o.outcome === l);
  R.db.prepare('UPDATE users SET coins=coins-100 WHERE id=?').run(v); const c0 = R.db.prepare('SELECT coins FROM users WHERE id=?').get(v).coins;
  const pid = Number(R.db.prepare('INSERT INTO parlays(user_id,stake,ts,same_event) VALUES(?,?,?,1)').run(v, 100, 1).lastInsertRowid);
  for (const o of [o2(w, 'PSG'), o2(tot, 'Over')]) R.db.prepare('INSERT INTO parlay_legs(parlay_id,line_id,option_id,odds) VALUES(?,?,?,?)').run(pid, o.line_id, o.id, o.odds);
  assert.match(R.myParlays(v)[0].pricing_note, /multiplicando/);
  R.pushLine(tot); R.settleLine(w, o2(w, 'PSG').id); const pay = Math.floor(100 * S.dec(o2(w, 'PSG').odds));
  assert.equal(R.myParlays(v)[0].payout, pay); assert.equal(R.db.prepare('SELECT coins FROM users WHERE id=?').get(v).coins, c0 + pay);
});
t('client app wires shared model', () => { const src = require('node:fs').readFileSync(__dirname + '/public/app.js', 'utf8'), html = require('node:fs').readFileSync(__dirname + '/public/index.html', 'utf8');
  assert.ok(src.includes('Sgp.quote') && !src.includes('Sgp.NOTE') && !src.includes('SAME_EVENT_NOTE') && src.includes('pricing_note') && html.includes('sgp.js') && !src.includes('Una selección por evento')); });
// 2-way Ganador (no draw option) = winner always decided; a level score goes to either side 50/50 (+1 to winner).
const tie = P((h, a) => h === a);
const noDraw = e => { const c = structuredClone(e); c.markets[0].options = [{ label: 'PSG', odds: am(P((h, a) => h > a) + tie / 2) }, { label: 'Troyes', odds: am(P((h, a) => h < a) + tie / 2) }];
  const tot = c.markets.find(m => m.key === 'totals'); if (tot) { // totals include the decisive extra goal on level scores
    const over = P((h, a) => h !== a && h + a > 2.5) + P((h, a) => h === a && h + a + 1 > 2.5); tot.options = [{ label: 'Over', point: 2.5, odds: am(over) }, { label: 'Under', point: 2.5, odds: am(1 - over) }]; }
  return c; };
const only = (e, keys) => { const c = structuredClone(e); c.markets = c.markets.filter(m => keys.includes(m.key)); return c; };
t('fit with 2-way Ganador (no draw) + Total and with Hándicap + Total (no Ganador) recovers rates; no draw odds invented', () => {
  for (const e of [noDraw(only(ev('x'), ['h2h', 'totals'])), only(ev('x'), ['spreads', 'totals'])]) {
    const g = S.fit(lines(e)); assert.ok(!g.error, g.error); assert.ok(Math.abs(g.lh - LH) < 0.05 && Math.abs(g.la - LA) < 0.05, JSON.stringify(g)); }
  const g = S.fit(lines(noDraw(only(ev('x'), ['h2h', 'totals'])))); assert.equal(g.tb, true);
  assert.ok(Math.abs(S.jointP(g, [L('h2h', 'PSG')]) + S.jointP(g, [L('h2h', 'Troyes')]) - 1) < 1e-12); // 2-way: one side always wins
  assert.equal(S.fit(lines(only(ev('x'), ['spreads', 'totals']))).tb, false);
});
t('real-shape hockey/baseball-style line: 2-way moneyline + Over/Under 6.5 fits; favourite or underdog + Over/Under priced; old v1 error text gone', () => {
  const Lh = [{ market: 'h2h', home: 'H', away: 'A', options: [{ outcome: 'H', odds: -150 }, { outcome: 'A', odds: 130 }] }, { market: 'totals', home: 'H', away: 'A', options: [{ outcome: 'Over', point: 6.5, odds: 120 }, { outcome: 'Under', point: 6.5, odds: -140 }] }];
  const f = S.fit(Lh); assert.ok(!f.error, f.error); assert.ok(f.rmse < 0.001);
  for (const side of ['H', 'A']) for (const ou of ['Over', 'Under']) { const q = S.quote([{ event: 'e', line: 1, market: 'h2h', home: 'H', away: 'A', outcome: side, odds: side === 'H' ? -150 : 130, option: 1 }, { event: 'e', line: 2, market: 'totals', home: 'H', away: 'A', outcome: ou, point: 6.5, odds: ou === 'Over' ? 120 : -140, option: 2 }], { e: Lh });
    assert.ok(!q.error && q.dec > 1 && q.modeled, JSON.stringify(q)); }
  const src = require('node:fs').readFileSync(__dirname + '/public/sgp.js', 'utf8'); assert.ok(!/con empate \(3 opciones\)|empate registrad/i.test(src));
});
t('published events without draw / without Ganador accept 2-leg combos at server; snapshots unchanged; no Empate created', () => {
  const R = open(':memory:'); R.setupAdmin('admin', '1234'); const v = R.register(R.newInvite(), 'pepe', '1234');
  const coinsR = () => R.db.prepare('SELECT coins FROM users WHERE id=?').get(v).coins;
  const [w, tot] = R.createEvent(noDraw(only(ev('nd'), ['h2h', 'totals'])), 'real');
  const ol = (id, out) => R.lines().find(x => x.id === id).options.find(o => o.outcome === out);
  assert.equal(R.lines().find(x => x.id === w).options.length, 2);
  const c0 = coinsR(); R.placeParlay(v, [ol(w, 'Troyes').id, ol(tot, 'Under').id], 20); // underdog + Under
  R.placeParlay(v, [ol(w, 'PSG').id, ol(tot, 'Over').id], 20); // favourite + Over
  assert.equal(R.lines().find(x => x.id === w).options.length, 2); assert.equal(coinsR(), c0 - 40);
  const [sp, tot2] = R.createEvent(only(ev('st'), ['spreads', 'totals']), 'real');
  R.placeParlay(v, [ol(sp, 'Troyes').id, ol(tot2, 'Under').id], 10); // +1.5 + Under: compatible
  R.placeParlay(v, [ol(sp, 'PSG').id, ol(tot2, 'Over').id], 10);
  const e3 = only(ev('c'), ['spreads', 'totals']); e3.markets[0].options = [{ label: 'PSG', point: -2.5, odds: 250 }, { label: 'Troyes', point: 2.5, odds: -330 }];
  const [sp3, t3] = R.createEvent(e3, 'real'); const c1 = coinsR();
  assert.ok(R.placeParlay(v, [ol(sp3, 'PSG').id, ol(t3, 'Under').id], 10)); assert.equal(coinsR(), c1 - 10);
  // tie loses Ganador (not draw-no-bet): Troyes win is impossible with 0-0 etc.; settle draw-like result as Troyes leg lost
  const p = R.myParlays(v).find(x => x.legs.some(g => g.option_id === ol(w, 'Troyes').id)); R.settleLine(w, ol(w, 'PSG').id);
  assert.equal(R.myParlays(v).find(x => x.id === p.id).status, 'lost');
  // Modeled only when SGP succeeded; product fallbacks have no model
  assert.ok(R.myParlays(v).some(q => q.model === 'poisson-v4'));
});
t('old v1 snapshot settles at frozen price after model upgrade', () => {
  const R = open(':memory:'); R.setupAdmin('admin', '1234'); const v = R.register(R.newInvite(), 'pepe', '1234');
  const [w, , tot] = R.createEvent(ev('v1'), 'real'); const ol = (id, out) => R.lines().find(x => x.id === id).options.find(o => o.outcome === out);
  R.db.prepare('UPDATE users SET coins=coins-100 WHERE id=?').run(v); const c0 = R.db.prepare('SELECT coins FROM users WHERE id=?').get(v).coins;
  const a = ol(w, 'PSG'), b = ol(tot, 'Over');
  const pid = Number(R.db.prepare('INSERT INTO parlays(user_id,stake,ts,same_event,pricing,odds_dec) VALUES(?,?,?,1,?,?)').run(v, 100, 1, JSON.stringify({ version: 'poisson-v1', groups: [{ options: [a.id, b.id], dec: 2.777, model: { version: 'poisson-v1' } }] }), 2.777).lastInsertRowid);
  for (const o of [a, b]) R.db.prepare('INSERT INTO parlay_legs(parlay_id,line_id,option_id,odds) VALUES(?,?,?,?)').run(pid, o.line_id, o.id, o.odds);
  assert.equal(R.myParlays(v)[0].model, 'poisson-v1'); R.settleLine(w, a.id); R.settleLine(tot, b.id);
  assert.equal(R.myParlays(v)[0].payout, 277); assert.equal(R.db.prepare('SELECT coins FROM users WHERE id=?').get(v).coins, c0 + 277);
});
console.log(n + ' sgp model tests passed');
{ const src = require('node:fs').readFileSync(__dirname + '/public/app.js', 'utf8');
  require('node:assert/strict').ok(src.includes('<details class="odds-info small"><summary>Cuota estimada · Sobre la cuota</summary><div>${esc(p.pricing_note)}</div></details>') && !src.includes('⚠️ ${esc(p.pricing_note)}'));
  console.log('OK pricing note is a neutral collapsed "Cuota estimada" disclosure, no warning styling'); }
