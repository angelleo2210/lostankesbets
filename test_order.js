// Display order (owner nov 8): local arriba, visitante abajo. Canonical home/away and option ids unchanged.
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const src = fs.readFileSync(__dirname + '/public/app.js', 'utf8'); let n = 0; const t = (name, fn) => { fn(); console.log('OK', name); n++; };
const block = src.slice(src.indexOf('// Display-only'), src.indexOf('function lineCard('));
const ctx = { boleto: [{ id: 12 }], me: null, Markets: require('./public/markets'), esc: s => String(s ?? ''), od: o => (o > 0 ? '+' : '') + o };
vm.runInNewContext(src.slice(src.indexOf('// Mis apuestas:'), src.indexOf('function lineCard(')) + '\nthis.mc=marketCards;this.vs=vsTitle;this.nf=newestFirst;', ctx);
const { open } = require('./core'); const D = open(':memory:');
D.createEvent({ id: 'p1', title: 'PSG vs Troyes', home: 'PSG', away: 'Troyes', unit: 'goles', markets: [
  { key: 'h2h', options: [{ label: 'PSG', odds: -150 }, { label: 'Troyes', odds: 380 }, { label: 'Draw', odds: 290 }] },
  { key: 'spreads', options: [{ label: 'PSG', point: -1.5, odds: 140 }, { label: 'Troyes', point: 1.5, odds: -170 }] },
  { key: 'totals', options: [{ label: 'Over', point: 2.5, odds: -120 }, { label: 'Under', point: 2.5, odds: 100 }] }] }, 'real');
t('provider/manual event: PSG (local) row above Troyes (visitante); ids/odds/signs stay with their team; Over top', () => {
  const ls = D.lines(), html = ctx.mc(ls), o = (m, out) => ls.find(l => l.market === m).options.find(x => x.outcome === out);
  assert.ok(html.indexOf('>PSG<') < html.indexOf('>Troyes<') && html.indexOf('>Troyes<') < html.indexOf('>Empate<'));
  assert.ok(html.includes('<h2>PSG vs Troyes</h2>'));
  const rowOf = name => html.slice(html.indexOf(`>${name}<`), html.indexOf('</div>', html.indexOf(`>${name}<`) + name.length + 2) + 2000).split('event-team')[0];
  const psg = html.slice(html.indexOf('>PSG<'), html.indexOf('>Troyes<')), troy = html.slice(html.indexOf('>Troyes<'), html.indexOf('>Empate<'));
  assert.ok(troy.includes(`data-add="${o('spreads', 'Troyes').id}"`) && troy.includes('+1.5') && troy.includes(`data-add="${o('h2h', 'Troyes').id}"`) && troy.includes(`data-add="${o('totals', 'Under').id}"`) && troy.includes('+380') && troy.includes('-170') && !troy.includes('-150') && !troy.includes('-1.5'));
  assert.ok(psg.includes(`data-add="${o('spreads', 'PSG').id}"`) && psg.includes('-1.5') && psg.includes(`data-add="${o('h2h', 'PSG').id}"`) && psg.includes(`data-add="${o('totals', 'Over').id}"`) && psg.includes('-150') && psg.includes('+140') && !psg.includes('+380') && !psg.includes('+1.5'));
  const ids = [...html.matchAll(/data-add="(\d+)"/g)].map(m => +m[1]).sort((a, b) => a - b); assert.deepEqual(ids, ls.flatMap(l => l.options.map(x => x.id)).sort((a, b) => a - b));
  const l = ls.find(l => l.market === 'h2h'); assert.equal(l.home, 'PSG'); assert.equal(l.away, 'Troyes'); // canonical untouched
});
t('legacy lines without roles keep stored order; titles without roles unchanged', () => {
  const R = open(':memory:'); R.createLine('A vs B', [{ label: 'A', odds: 110 }, { label: 'B', odds: -120 }]);
  const html = ctx.mc(R.lines()); assert.ok(html.indexOf('>A<') < html.indexOf('>B<')); assert.ok(html.includes('<h2>A vs B</h2>'));
  assert.equal(ctx.vs('EPL: Home FC vs Away FC', 'Home FC', 'Away FC'), 'EPL: Home FC vs Away FC'); assert.equal(ctx.vs('Away FC vs Home FC', 'Home FC', 'Away FC'), 'Home FC vs Away FC'); assert.equal(ctx.vs('X vs Y', null, null), 'X vs Y');
});
t('creation forms show Local before Visitante; payload still maps #eh=home, #ea=away with correct signs', () => {
  const a = src.indexOf('id="ea"'), h = src.indexOf('id="eh"'); assert.ok(h > 0 && h < a);
  assert.ok(src.indexOf('id="eho"') < src.indexOf('id="eao"') && src.indexOf('id="eso"') < src.indexOf('id="esp"') && src.indexOf('id="esp"') < src.indexOf('id="esao"'));
  assert.ok(src.indexOf('id="existingHome"') < src.indexOf('id="existingAway"'));
  assert.ok(src.includes("const home = $('#eh').value.trim(), away = $('#ea').value.trim()"));
  assert.ok(src.includes("{ label: home, point: num('esp'), odds: num('eso') }, { label: away, point: -num('esp'), odds: num('esao') }"));
  assert.ok(src.includes("[{ label: home, odds: num('eho') }, { label: away, odds: num('eao') }]"));
});
t('tickets/slip/admin titles use display helper; bets/parlays expose home/away', () => {
  for (const k of ['vsTitle(b.title, b.home, b.away)', 'vsTitle(g.title, g.home, g.away)', 'vsTitle(e.title, e.home, e.away)', 'vsTitle(l.title, l.home, l.away)']) assert.ok(src.includes(k), k);
  const core = fs.readFileSync(__dirname + '/core.js', 'utf8'); assert.ok(core.includes('FROM bets b JOIN lines') && core.includes('FROM parlay_legs') && core.includes('l.home, l.away'));
});
t('pre-existing published event + upgraded legacy line + pending bets render home-first; DB rows unchanged', () => {
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
  assert.ok(html.includes('<h2>PSG vs Troyes</h2>') && html.indexOf('>PSG<') < html.indexOf('>Troyes<'));
  assert.ok(html.includes('<h2>Local vs Visita</h2>') && html.indexOf('>Local<') < html.indexOf('>Visita<'));
  assert.ok(html.includes('<h2>A vs B</h2>'));
  const bs = R.myBets(u), b = bs.find(x => x.line_id === w), bl = bs.find(x => x.line_id === leg), p = R.myParlays(u)[0];
  assert.equal(ctx.vs(b.title, b.home, b.away), 'PSG vs Troyes'); assert.equal(b.label, 'Ganador · PSG'); assert.equal(b.odds, -150); assert.equal(b.stake, 25);
  assert.equal(ctx.vs(bl.title, bl.home, bl.away), 'Local vs Visita'); assert.equal(bl.label, 'Local'); assert.equal(bl.odds, 120);
  const g = p.legs.find(x => x.line_id === w); assert.equal(ctx.vs(g.title, g.home, g.away), 'PSG vs Troyes'); assert.equal(g.label, 'Ganador · Troyes'); assert.equal(g.odds, 380);
  const g2 = p.legs.find(x => x.line_id === other); assert.equal(ctx.vs(g2.title, g2.home, g2.away), 'A vs B');
  assert.equal(dump(), before);
});
t('Agregar mercados: Hándicap shows local odds first, Total keeps Over/Under; payload mapping canonical; type switch clears odds', () => {
  const code = src.slice(src.indexOf('  const addPropOpt'), src.indexOf("  act('#eventCreate'"));
  const el = {}; for (const id of ['existingMarket', 'existingPoint', 'existingOddsA', 'existingOddsB', 'existingHome', 'existingAway', 'existingUnit', 'existingEvent', 'existingInputs', 'propInputs', 'existingHelp', 'propTitle', 'propOpts', 'propAddOpt']) el[id] = { id, value: '', style: {}, placeholder: '', textContent: '', innerHTML: '', children: [], append: function(d){ this.children.push(d); }, onclick: null };
  let handler, sent; const c = { $: q => el[q.slice(1)], act: (sel, f) => { if (sel === '#existingAdd') handler = f; }, api: (url, body) => { sent = { url, body }; }, esc: x => x, document: { createElement: () => ({ className: '', innerHTML: '', children: [{ value: '' }, { value: '' }] }) } };
  el.existingMarket.value = 'spreads'; vm.runInNewContext(code, c);
  const order = () => ['existingPoint', 'existingOddsA', 'existingOddsB'].sort((x, y) => el[x].style.order - el[y].style.order);
  assert.equal(order().join(), ['existingOddsA', 'existingPoint', 'existingOddsB'].join()); assert.match(el.existingOddsB.placeholder, /visitante/); assert.match(el.existingOddsA.placeholder, /local/);
  Object.assign(el.existingHome, { value: 'PSG' }); el.existingAway.value = 'Troyes'; el.existingEvent.value = '7'; el.existingPoint.value = '-1.5'; el.existingOddsA.value = '140'; el.existingOddsB.value = '-170';
  handler(); assert.equal(sent.url, '/admin/lines/7/markets'); assert.equal(sent.body.home, 'PSG'); assert.equal(sent.body.away, 'Troyes');
  assert.equal(JSON.stringify(sent.body.options), JSON.stringify([{ label: 'PSG', point: -1.5, odds: 140 }, { label: 'Troyes', point: 1.5, odds: -170 }]));
  el.existingMarket.value = 'totals'; el.existingMarket.onchange(); assert.equal(el.existingOddsA.value, ''); assert.equal(el.existingOddsB.value, '');
  assert.equal(order().join(), ['existingPoint', 'existingOddsA', 'existingOddsB'].join()); assert.match(el.existingOddsA.placeholder, /Over/); assert.match(el.existingOddsB.placeholder, /Under/);
  el.existingPoint.value = '2.5'; el.existingOddsA.value = '-120'; el.existingOddsB.value = '100'; handler();
  assert.equal(JSON.stringify(sent.body.options), JSON.stringify([{ label: 'Over', point: 2.5, odds: -120 }, { label: 'Under', point: 2.5, odds: 100 }]));
});
t('Mis apuestas: pending first, then the rest; each newest first across singles and parlays', () => {
  const P = [{ id: 1, ts: 100, status: 'open' }, { id: 2, ts: 400, status: 'won' }, { id: 3, ts: 250, status: 'open' }];
  const Bt = [{ id: 1, ts: 300, status: 'open' }, { id: 2, ts: 500, status: 'lost' }, { id: 3, ts: 50, status: 'open' }, { id: 4, created: '1970-01-01 00:00:00', status: 'won' }];
  const before = JSON.stringify([P, Bt]); const r = ctx.nf(P, Bt).map(x => x.type + x.v.id).join();
  assert.equal(r, 'b1,p3,p1,b3,b2,p2,b4'); assert.equal(JSON.stringify([P, Bt]), before);
  assert.equal(ctx.nf([{ id: 5, ts: 9, status: 'open' }], [{ id: 5, ts: 9, status: 'open' }]).map(x => x.type).join(), 'p,b');
  assert.ok(src.includes('newestFirst(me.parlays, me.bets)'));
});
t('lost cards (single + parlay): red header only, transparent body; won/open/ref unchanged; won legs green', () => {
  const css = fs.readFileSync(__dirname + '/public/index.html', 'utf8');
  const tr = '.hrb.bet-lost{background:transparent;border-color:#991b1b}', base = '.hrb.bet-lost{background:#b91c1c;color:#fff}';
  assert.ok(css.includes(tr) && css.includes(base) && css.indexOf(tr) > css.indexOf(base), 'transparent rule overrides red body (later, same specificity)');
  assert.ok(!css.includes('.hrb.hrb-parlay.bet-lost'));
  assert.ok(css.includes('.hrb.bet-lost .hrb-banner{background-color:#991b1b}') && css.includes('.hrb-leg .leg-ok{color:#22c55e'));
  assert.ok(css.includes('.hrb-logo-badge{') && src.includes('ticketBanner') && src.includes('/icons/icon-192.png'));
  for (const r of ['.hrb.bet-won{background:#5fcd84;color:#fff;border-color:#4ea96c}', '.hrb.bet-won .hrb-banner{background-color:#4ea96c;background-image:none}', '.hrb.bet-open{background:#1d4ed8;color:#fff}', '.hrb.bet-ref{background:#475569;color:#fff}', '.hrb.bet-won .hrb-leg .leg-ok{color:inherit}']) assert.ok(css.includes(r), r);
  assert.ok(src.includes('<article class="hrb bet-${m.cls}"') && src.includes('<article class="hrb hrb-parlay bet-${m.cls}"') && src.includes(`<span\${g.status === 'won' ? ' class="leg-ok"' : ''}>`));
});
console.log(n + ' order tests passed');
