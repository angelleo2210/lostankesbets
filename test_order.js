// Display order: visitante arriba, local abajo. Canonical home/away and option ids unchanged.
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const src = fs.readFileSync(__dirname + '/public/app.js', 'utf8'); let n = 0; const t = (name, fn) => { fn(); console.log('OK', name); n++; };
const block = src.slice(src.indexOf('// Display-only'), src.indexOf('function lineCard('));
const ctx = { boleto: [{ id: 12 }], me: null, Markets: require('./public/markets'), esc: s => String(s ?? ''), od: o => (o > 0 ? '+' : '') + o };
vm.runInNewContext(block + '\nthis.mc=marketCards;this.vs=vsTitle;', ctx);
const { open } = require('./core'); const D = open(':memory:');
D.createEvent({ id: 'p1', title: 'PSG vs Troyes', home: 'PSG', away: 'Troyes', unit: 'goles', markets: [
  { key: 'h2h', options: [{ label: 'PSG', odds: -150 }, { label: 'Troyes', odds: 380 }, { label: 'Draw', odds: 290 }] },
  { key: 'spreads', options: [{ label: 'PSG', point: -1.5, odds: 140 }, { label: 'Troyes', point: 1.5, odds: -170 }] },
  { key: 'totals', options: [{ label: 'Over', point: 2.5, odds: -120 }, { label: 'Under', point: 2.5, odds: 100 }] }] }, 'real');
t('provider/manual event: Troyes (visitante) row above PSG (local); ids/odds/signs stay with their team', () => {
  const ls = D.lines(), html = ctx.mc(ls), o = (m, out) => ls.find(l => l.market === m).options.find(x => x.outcome === out);
  assert.ok(html.indexOf('>Troyes<') < html.indexOf('>PSG<') && html.indexOf('>PSG<') < html.indexOf('>Empate<'));
  assert.ok(html.includes('<h2>Troyes vs PSG</h2>'));
  const rowOf = name => html.slice(html.indexOf(`>${name}<`), html.indexOf('</div>', html.indexOf(`>${name}<`) + name.length + 2) + 2000).split('event-team')[0];
  const troy = html.slice(html.indexOf('>Troyes<'), html.indexOf('>PSG<')), psg = html.slice(html.indexOf('>PSG<'), html.indexOf('>Empate<'));
  assert.ok(troy.includes(`data-add="${o('spreads', 'Troyes').id}"`) && troy.includes('+1.5') && troy.includes(`data-add="${o('h2h', 'Troyes').id}"`) && troy.includes(`data-add="${o('totals', 'Over').id}"`) && troy.includes('+380') && troy.includes('-170') && !troy.includes('-150') && !troy.includes('-1.5'));
  assert.ok(psg.includes(`data-add="${o('spreads', 'PSG').id}"`) && psg.includes('-1.5') && psg.includes(`data-add="${o('h2h', 'PSG').id}"`) && psg.includes(`data-add="${o('totals', 'Under').id}"`) && psg.includes('-150') && psg.includes('+140') && !psg.includes('+380') && !psg.includes('+1.5'));
  const ids = [...html.matchAll(/data-add="(\d+)"/g)].map(m => +m[1]).sort((a, b) => a - b); assert.deepEqual(ids, ls.flatMap(l => l.options.map(x => x.id)).sort((a, b) => a - b));
  const l = ls.find(l => l.market === 'h2h'); assert.equal(l.home, 'PSG'); assert.equal(l.away, 'Troyes'); // canonical untouched
});
t('legacy lines without roles keep stored order; titles without roles unchanged', () => {
  const R = open(':memory:'); R.createLine('A vs B', [{ label: 'A', odds: 110 }, { label: 'B', odds: -120 }]);
  const html = ctx.mc(R.lines()); assert.ok(html.indexOf('>A<') < html.indexOf('>B<')); assert.ok(html.includes('<h2>A vs B</h2>'));
  assert.equal(ctx.vs('EPL: Home FC vs Away FC', 'Home FC', 'Away FC'), 'EPL: Away FC vs Home FC'); assert.equal(ctx.vs('X vs Y', null, null), 'X vs Y');
});
t('creation forms show Visitante before Local; payload still maps #eh=home, #ea=away with correct signs', () => {
  const a = src.indexOf('id="ea"'), h = src.indexOf('id="eh"'); assert.ok(a > 0 && a < h);
  assert.ok(src.indexOf('id="eao"') < src.indexOf('id="eho"') && src.indexOf('id="esao"') < src.indexOf('id="eso"'));
  assert.ok(src.indexOf('id="existingAway"') < src.indexOf('id="existingHome"'));
  assert.ok(src.includes("const home = $('#eh').value.trim(), away = $('#ea').value.trim()"));
  assert.ok(src.includes("{ label: home, point: num('esp'), odds: num('eso') }, { label: away, point: -num('esp'), odds: num('esao') }"));
  assert.ok(src.includes("[{ label: home, odds: num('eho') }, { label: away, odds: num('eao') }]"));
});
t('tickets/slip/admin titles use display helper; bets/parlays expose home/away', () => {
  for (const k of ['vsTitle(b.title, b.home, b.away)', 'vsTitle(g.title, g.home, g.away)', 'vsTitle(e.title, e.home, e.away)', 'vsTitle(l.title, l.home, l.away)']) assert.ok(src.includes(k), k);
  const core = fs.readFileSync(__dirname + '/core.js', 'utf8'); assert.ok(core.includes('l.title, l.kind, l.home, l.away, o.label FROM bets') && core.includes('l.title, l.home, l.away, o.label FROM parlay_legs'));
});
t('pre-existing published event + upgraded legacy line + pending bets render away-first; DB rows unchanged', () => {
  const R = open(':memory:'); R.setupAdmin('admin', '1234'); const u = R.register(R.newInvite(), 'pepe', '1234');
  const [w] = R.createEvent({ id: 'q', title: 'PSG vs Troyes', home: 'PSG', away: 'Troyes', markets: [
    { key: 'h2h', options: [{ label: 'PSG', odds: -150 }, { label: 'Troyes', odds: 380 }, { label: 'Draw', odds: 290 }] },
    { key: 'totals', options: [{ label: 'Over', point: 2.5, odds: -120 }, { label: 'Under', point: 2.5, odds: 100 }] }] }, 'real');
  const leg = R.createLine('Local vs Visita', [{ label: 'Local', odds: 120 }, { label: 'Visita', odds: -140 }, { label: 'Empate', odds: 230 }]);
  const other = R.createLine('A vs B', [{ label: 'A', odds: 110 }, { label: 'B', odds: -120 }]);
  const opt = (id, i) => R.lines().find(l => l.id === id).options[i];
  R.placeBet(u, opt(w, 0).id, 25); R.placeParlay(u, [opt(w, 1).id, opt(other, 0).id], 10); R.placeBet(u, opt(leg, 0).id, 5);
  R.addEventMarket(leg, 'spreads', [{ label: 'Local', point: -0.5, odds: 110 }, { label: 'Visita', point: 0.5, odds: -130 }], 'Local', 'Visita', 'goles');
  const dump = () => JSON.stringify([R.db.prepare('SELECT * FROM bets').all(), R.db.prepare('SELECT * FROM parlays').all(), R.db.prepare('SELECT * FROM parlay_legs').all(), R.db.prepare('SELECT * FROM options').all(), R.db.prepare('SELECT id,home,away,title FROM lines').all(), R.db.prepare('SELECT coins FROM users').all()]);
  const before = dump();
  const html = ctx.mc(R.lines());
  assert.ok(html.includes('<h2>Troyes vs PSG</h2>') && html.indexOf('>Troyes<') < html.indexOf('>PSG<'));
  assert.ok(html.includes('<h2>Visita vs Local</h2>') && html.indexOf('>Visita<') < html.indexOf('>Local<'));
  assert.ok(html.includes('<h2>A vs B</h2>'));
  const bs = R.myBets(u), b = bs.find(x => x.line_id === w), bl = bs.find(x => x.line_id === leg), p = R.myParlays(u)[0];
  assert.equal(ctx.vs(b.title, b.home, b.away), 'Troyes vs PSG'); assert.equal(b.label, 'Ganador · PSG'); assert.equal(b.odds, -150); assert.equal(b.stake, 25);
  assert.equal(ctx.vs(bl.title, bl.home, bl.away), 'Visita vs Local'); assert.equal(bl.label, 'Local'); assert.equal(bl.odds, 120);
  const g = p.legs.find(x => x.line_id === w); assert.equal(ctx.vs(g.title, g.home, g.away), 'Troyes vs PSG'); assert.equal(g.label, 'Ganador · Troyes'); assert.equal(g.odds, 380);
  const g2 = p.legs.find(x => x.line_id === other); assert.equal(ctx.vs(g2.title, g2.home, g2.away), 'A vs B');
  assert.equal(dump(), before);
});
t('Agregar mercados: Hándicap shows visitante odds first, Total keeps Over/Under; payload mapping canonical; type switch clears odds', () => {
  const code = src.slice(src.indexOf('  const layoutExisting'), src.indexOf("  act('#eventCreate'"));
  const el = {}; for (const id of ['existingMarket', 'existingPoint', 'existingOddsA', 'existingOddsB', 'existingHome', 'existingAway', 'existingUnit', 'existingEvent']) el[id] = { id, value: '', style: {}, placeholder: '' };
  let handler, sent; const c = { $: q => el[q.slice(1)], act: (_, f) => { handler = f; }, api: (url, body) => { sent = { url, body }; } };
  el.existingMarket.value = 'spreads'; vm.runInNewContext(code, c);
  const order = () => ['existingPoint', 'existingOddsA', 'existingOddsB'].sort((x, y) => el[x].style.order - el[y].style.order);
  assert.equal(order().join(), ['existingOddsB', 'existingPoint', 'existingOddsA'].join()); assert.match(el.existingOddsB.placeholder, /visitante/); assert.match(el.existingOddsA.placeholder, /local/);
  Object.assign(el.existingHome, { value: 'PSG' }); el.existingAway.value = 'Troyes'; el.existingEvent.value = '7'; el.existingPoint.value = '-1.5'; el.existingOddsA.value = '140'; el.existingOddsB.value = '-170';
  handler(); assert.equal(sent.url, '/admin/lines/7/markets'); assert.equal(sent.body.home, 'PSG'); assert.equal(sent.body.away, 'Troyes');
  assert.equal(JSON.stringify(sent.body.options), JSON.stringify([{ label: 'PSG', point: -1.5, odds: 140 }, { label: 'Troyes', point: 1.5, odds: -170 }]));
  el.existingMarket.value = 'totals'; el.existingMarket.onchange(); assert.equal(el.existingOddsA.value, ''); assert.equal(el.existingOddsB.value, '');
  assert.equal(order().join(), ['existingPoint', 'existingOddsA', 'existingOddsB'].join()); assert.match(el.existingOddsA.placeholder, /Over/); assert.match(el.existingOddsB.placeholder, /Under/);
  el.existingPoint.value = '2.5'; el.existingOddsA.value = '-120'; el.existingOddsB.value = '100'; handler();
  assert.equal(JSON.stringify(sent.body.options), JSON.stringify([{ label: 'Over', point: 2.5, odds: -120 }, { label: 'Under', point: 2.5, odds: 100 }]));
});
console.log(n + ' order tests passed');
