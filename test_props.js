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
  const css = require('node:fs').readFileSync(__dirname + '/public/index.html', 'utf8');
  assert.ok(src.includes('Más mercados (') && src.includes('event-props') && src.includes('value="props"') && src.includes('prop_title'));
  assert.ok(src.includes('remove-prop') && src.includes('Agregar hándicap / total / prop'));
  assert.ok(src.includes('prop-board') && src.includes('propTitleParts') && src.includes('isPropOu') && css.includes('.prop-board{') && css.includes('.prop-row{'));
});
t('UI: Over/Under props board shows name left + O/U columns; custom props keep title + option buttons', () => {
  const src = require('node:fs').readFileSync(__dirname + '/public/app.js', 'utf8');
  const vm = require('node:vm');
  const ctx = { boleto: [], me: null, Markets: require('./public/markets'), esc: s => String(s ?? ''), od: o => (o > 0 ? '+' : '') + o };
  vm.runInNewContext(src.slice(src.indexOf('// Display-only'), src.indexOf('function boletoCard(')) + '\nthis.cards=marketCards;this.vs=vsTitle;this.ptp=propTitleParts;this.isOu=isPropOu;', ctx);
  assert.equal(JSON.stringify(ctx.ptp('Livan 2.5 Hits')), JSON.stringify({ name: 'Livan', line: '2.5', rest: 'Hits' }));
  assert.equal(ctx.ptp('Soto HR').line, null);
  assert.ok(ctx.isOu([{ label: 'Over' }, { label: 'Under' }]));
  assert.ok(!ctx.isOu([{ label: 'Sí' }, { label: 'No' }]));
  const html = ctx.cards([
    { id: 1, event_id: 'e', kind: 'real', title: 'A vs B', home: 'A', away: 'B', market: 'h2h', status: 'open', options: [{ id: 10, label: 'A', outcome: 'A', odds: -110 }, { id: 11, label: 'B', outcome: 'B', odds: -110 }] },
    { id: 2, event_id: 'e', kind: 'real', title: 'A vs B', home: 'A', away: 'B', market: 'props', prop_title: 'Livan 2.5 Hits', status: 'open', options: [{ id: 20, label: 'x', outcome: 'Over', odds: 100 }, { id: 21, label: 'y', outcome: 'Under', odds: -480 }] },
    { id: 3, event_id: 'e', kind: 'real', title: 'A vs B', home: 'A', away: 'B', market: 'props', prop_title: 'Soto HR', status: 'open', options: [{ id: 30, label: 'Sí', outcome: 'Sí', odds: -150 }, { id: 31, label: 'No', outcome: 'No', odds: 130 }] },
  ]);
  assert.ok(html.includes('Más mercados (2)') && html.includes('prop-board') && html.includes('>OVER<') && html.includes('>UNDER<'));
  assert.ok(html.includes('>Livan<') && html.includes('O 2.5') && html.includes('U 2.5') && html.includes('data-add="20"') && html.includes('data-add="21"'));
  assert.ok(html.includes('>Soto HR<') && html.includes('prop-row-x') && html.includes('data-add="30"') && html.includes('Sí'));
  assert.ok(!html.includes('prop-card'));
});

t('Ángel fixture: handicap +8.5 + two different props (Under+Over) + handicap+match Under; client+server; same prop both sides still blocked', () => {
  const { D, u, opt, coins } = mk();
  const ev = { id: 'chapa', title: 'La Chapa Cubana', home: 'Los Largers', away: 'Visitante', unit: 'carreras', sport: 'baseball', markets: [
    { key: 'h2h', options: [{ label: 'Los Largers', odds: -150 }, { label: 'Visitante', odds: 130 }] },
    { key: 'spreads', options: [{ label: 'Los Largers', point: 8.5, odds: -130 }, { label: 'Visitante', point: -8.5, odds: 110 }] },
    { key: 'totals', options: [{ label: 'Over', point: 24.5, odds: -110 }, { label: 'Under', point: 24.5, odds: -110 }] }] };
  const [w, sp, tot] = D.createEvent(ev);
  const livan = D.addEventMarket(w, 'props', [{ label: 'Over', odds: 100 }, { label: 'Under', odds: -480 }], 'Los Largers', 'Visitante', '', 'Livan 2.5 Hits');
  const fabian = D.addEventMarket(w, 'props', [{ label: 'Over', odds: 280 }, { label: 'Under', odds: -340 }], 'Los Largers', 'Visitante', '', 'Fabián 1.5 Hits');
  const legs3 = [
    { option: opt(sp, 'Los Largers').id, line: sp, event: 'custom:chapa', market: 'spreads', home: 'Los Largers', away: 'Visitante', outcome: 'Los Largers', point: 8.5, odds: -130 },
    { option: opt(livan, 'Under').id, line: livan, event: 'custom:chapa', market: 'props', home: 'Los Largers', away: 'Visitante', outcome: 'Under', point: null, odds: -480 },
    { option: opt(fabian, 'Over').id, line: fabian, event: 'custom:chapa', market: 'props', home: 'Los Largers', away: 'Visitante', outcome: 'Over', point: null, odds: 280 },
  ];
  assert.equal(Markets.sameEventError(legs3), null);
  const Sgp = require('./public/sgp'); const q = Sgp.quote(legs3, {}); assert.ok(!q.error && !q.modeled); assert.ok(Math.abs(q.dec - (Sgp.dec(-130)*Sgp.dec(-480)*Sgp.dec(280))) < 1e-9);
  // two props both Under — previously false "Selección repetida"
  const bothUnder = [legs3[0], legs3[1], { ...legs3[2], option: opt(fabian, 'Under').id, outcome: 'Under', odds: -340, line: fabian }];
  assert.equal(Markets.sameEventError(bothUnder), null);
  assert.ok(!Sgp.quote(bothUnder, {}).error);
  // handicap + match Under
  const hu = [
    { option: opt(sp, 'Los Largers').id, line: sp, event: 'custom:chapa', market: 'spreads', home: 'Los Largers', away: 'Visitante', outcome: 'Los Largers', point: 8.5, odds: -130 },
    { option: opt(tot, 'Under').id, line: tot, event: 'custom:chapa', market: 'totals', home: 'Los Largers', away: 'Visitante', outcome: 'Under', point: 24.5, odds: -110 },
  ];
  assert.equal(Markets.sameEventError(hu), null); assert.ok(!Sgp.quote(hu, { 'custom:chapa': D.lines().filter(l => l.event_id === 'chapa') }).error);
  const c0 = coins();
  D.placeParlay(u, [opt(sp, 'Los Largers').id, opt(livan, 'Under').id, opt(fabian, 'Over').id], 100);
  D.placeParlay(u, [opt(sp, 'Los Largers').id, opt(tot, 'Under').id], 50);
  assert.equal(coins(), c0 - 150);
  assert.throws(() => D.placeParlay(u, [opt(livan, 'Over').id, opt(livan, 'Under').id], 10), /Solo una selección/);
});
console.log(n, 'props tests passed');
