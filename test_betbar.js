// Floating bet bar: appears with selections, combined odds, payout for default $5000 stake, Apostar uses /bet and /parlay.
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
let n = 0; const pend = []; const t = (k, f) => { const r = f(); pend.push(Promise.resolve(r).then(() => { console.log('OK', k); n++; })); };
const src = fs.readFileSync(__dirname + '/public/app.js', 'utf8'), css = fs.readFileSync(__dirname + '/public/index.html', 'utf8');
const helpers = src.slice(src.indexOf('function slipQuote('), src.indexOf('function bindBets('));
const mk = me => { const ctx = { me, boleto: [], boletoStake: '5000', Sgp: require('./public/sgp'), vsTitle: (t) => t,
  dec: o => o > 0 ? 1 + o / 100 : 1 + 100 / -o, toAm: d => d >= 2 ? Math.round((d - 1) * 100) : Math.round(-100 / (d - 1)),
  esc: s => String(s ?? ''), od: o => (o > 0 ? '+' : '') + o };
  vm.runInNewContext(helpers + '\nthis.card=boletoCard;', ctx); return ctx; };
const leg = (id, odds) => ({ id, option: id, line: id, event: null, title: 'L' + id, label: 'A', odds });
t('default stake is 5000', () => { assert.match(src, /boletoStake = '5000'/); assert.match(src, /BET_DEFAULT = '5000'/); });
t('no selections: no bar', () => { const c = mk({ points: 0 }); assert.ok(!c.card().includes('betbar')); });
t('single: bar with odds, stake 5000, Apostar, Vaciar', () => { const c = mk({ points: 0 }); c.boleto = [leg(1, -110)];
  const h = c.card(); assert.match(h, /class="betbar"/); assert.match(h, /Simple · 1 selección/); assert.match(h, /id="bbodds">-110</);
  assert.match(h, /id="ps" value="5000"/); assert.match(h, /id="pgo">Apostar</); assert.match(h, /id="pclr"/); assert.ok(!h.includes('bb-rank')); });
t('parlay: combined odds = product, count, rank notice from 21 pts', () => { const c = mk({ points: 21 }); c.boleto = [leg(1, 100), leg(2, 100)];
  let h = c.card(); assert.match(h, /Parlay · 2 selecciones/); assert.match(h, /id="bbodds">\+300</); assert.match(h, /bb-rank ok/);
  c.boleto = [leg(1, -400), leg(2, -400)]; h = c.card(); assert.match(h, /id="bbodds">-178</); assert.match(h, /bb-rank no/); });
t('Apostar from bar posts /bet or /parlay with stake; payout shown for 5000', () => {
  const block = src.slice(src.indexOf('function bindBets('), src.indexOf('async function adminView('));
  const el = {}; const calls = []; const get = id => el[id] || (el[id] = { value: id === '#ps' ? '5000' : '', textContent: '', disabled: false });
  const ctx = { boleto: [leg(1, 100), leg(2, 100)], boletoStake: '5000', BET_DEFAULT: '5000', tab: 'lineas', A: { querySelector: () => null, querySelectorAll: () => [] }, $: get,
    window: {}, dec: o => o > 0 ? 1 + o / 100 : 1 + 100 / -o, fmt: n => Number(n).toLocaleString('en-US'), flash: m => { throw new Error(m); }, slipQuote: () => ({}), render: () => {},
    api: async (p, b) => { calls.push([p, b]); return {}; } };
  vm.runInNewContext(block + '\nthis.bind=bindBets;', ctx); ctx.bind([]);
  assert.equal(get('#pw').textContent, '$20,000');
  return get('#pgo').onclick().then(() => { assert.equal(JSON.stringify(calls), JSON.stringify([['/parlay', { optionIds: [1, 2], stake: 5000 }]])); assert.equal(ctx.boleto.length, 0); assert.equal(ctx.tab, 'mias'); });
});
t('css: fixed bottom bar with safe-area, content padding, toast above bar', () => {
  assert.match(css, /\.betbar\{position:fixed;[^}]*bottom:0/); assert.match(css, /\.betbar\{[^}]*env\(safe-area-inset-bottom\)/);
  assert.match(css, /main:has\(\.betbar\)\{padding-bottom/); assert.match(css, /body:has\(\.betbar\) \.toast/); });
Promise.all(pend).then(() => console.log(n, 'betbar tests passed'), e => { console.error(e); process.exit(1); });
