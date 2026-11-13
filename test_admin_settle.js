const assert = require('node:assert/strict');
const fs = require('node:fs');
const { open, START_COINS } = require('./core');
const M = require('./public/markets');
let n = 0; const t = (name, fn) => { fn(); console.log('OK', name); n++; };

t('admin settlement sort: earliest start first, already started before upcoming, no start last', () => {
  const now = Date.parse('2026-11-13T21:00:00Z');
  const later = { id: 3, starts: '2026-11-17T19:45:00Z', status: 'open', started: false };
  const today = { id: 8, starts: '2026-11-13T22:00:00Z', status: 'open', started: false };
  const started = { id: 9, starts: '2026-11-13T18:00:00Z', status: 'open', started: true };
  const closed = { id: 2, starts: '2026-11-13T16:00:00Z', status: 'closed', started: true };
  const none = { id: 5, starts: null, status: 'open', started: false };
  const none2 = { id: 1, starts: '', status: 'open' };
  const ordered = [later, none, started, today, none2, closed].slice().sort(M.compareBySoonestStart);
  assert.deepEqual(ordered.map(l => l.id), [2, 9, 8, 3, 1, 5]);
  const groups = [['later', later], ['today', today], ['started', started], ['none', none], ['closed', closed]].map(([, l]) => [l]);
  assert.deepEqual(M.sortGroupsBySoonestStart(groups, now).map(g => g[0].id), [2, 9, 8, 3, 5]);
});

t('admin UI groups by Líneas categories, pending marks, approve bar; never Ficticias; close keeps scroll helper', () => {
  const src = fs.readFileSync(__dirname + '/public/app.js', 'utf8');
  const i = src.indexOf('function adminView'), j = src.indexOf('function bindOddsAdmin');
  assert.ok(i > 0 && j > i);
  const chunk = src.slice(i, j);
  assert.ok(chunk.includes('settleSection(ls)') || chunk.includes('adminSettleCards'));
  assert.ok(src.includes('adminSettleChips') && src.includes('data-admin-sport'));
  assert.ok(src.includes("['all', 'Todos']") && src.includes('Markets.BUCKETS'));
  assert.ok(src.includes('sortGroupsBySoonestStart'));
  assert.ok(src.includes('Aprobar cambios'));
  assert.ok(src.includes('/admin/settle-batch'));
  assert.ok(src.includes('settlePending'));
  assert.ok(src.includes('keepAdminScroll'));
  assert.ok(src.includes('beforeunload'));
  assert.ok(src.includes('Quitar marca'));
  assert.ok(!chunk.includes('/admin/lines/${b.dataset.settle}/settle') && !src.includes("api(`/admin/lines/${b.dataset.settle}/settle`"));
  assert.ok(!src.includes('Ficticias'));
  assert.ok(src.includes("Tienes liquidaciones marcadas sin aprobar"));
  const html = fs.readFileSync(__dirname + '/public/index.html', 'utf8');
  assert.ok(html.includes('settle-bar') && html.includes('settle-pending'));
  const sw = fs.readFileSync(__dirname + '/public/sw.js', 'utf8');
  assert.ok(sw.includes('ltb-shell-v29'));
  const server = fs.readFileSync(__dirname + '/server.js', 'utf8');
  const line = server.split('\n').find(l => l.includes('/api/admin/settle-batch') && l.includes('app.post'));
  assert.ok(line && line.includes('admin(r)'), 'batch route is admin-only');
});

t('batchSettle applies settle, push and cancel via existing paths; partial errors; no double pay', () => {
  const D = open(':memory:');
  D.setupAdmin('admin', '1234');
  const u = D.register(D.newInvite(), 'ana', '1234');
  const ev = D.createEvent({
    id: 'nba-1', title: 'NBA: Lakers vs Celtics', sport: 'basketball', sport_key: 'basketball_nba',
    home: 'Lakers', away: 'Celtics', unit: 'puntos', starts: new Date(Date.now() - 4 * 3600e3).toISOString(),
    markets: [
      { key: 'h2h', options: [{ label: 'Lakers', odds: -150 }, { label: 'Celtics', odds: 130 }] },
      { key: 'spreads', options: [{ label: 'Lakers', point: -1, odds: -110 }, { label: 'Celtics', point: 1, odds: -110 }] },
      { key: 'totals', options: [{ label: 'Over', point: 220, odds: -110 }, { label: 'Under', point: 220, odds: -110 }] },
    ],
  }, 'real');
  const opt = (id, name) => D.lines().find(l => l.id === id).options.find(o => (o.outcome || o.label) === name);
  const ts = Date.now() - 5 * 3600e3;
  D.placeBet(u, opt(ev[0], 'Lakers').id, 100, ts);
  D.placeBet(u, opt(ev[1], 'Lakers').id, 100, ts); // -1 on a push later if 1-point win... we'll push
  D.placeBet(u, opt(ev[2], 'Over').id, 100, ts);
  const mid = D.createLine('Local extra', [{ label: 'Sí', odds: 100 }, { label: 'No', odds: -120 }]);
  D.placeBet(u, D.lines().find(l => l.id === mid).options[0].id, 50, ts);
  const start = D.db.prepare('SELECT coins FROM users WHERE id=?').get(u).coins;
  const missing = 99999;
  const r = D.batchSettle([
    { id: ev[0], action: 'settle', optionId: opt(ev[0], 'Lakers').id },
    { id: ev[1], action: 'push' },
    { id: ev[2], action: 'cancel' },
    { id: missing, action: 'settle', optionId: 1 },
    { id: mid, action: 'settle', optionId: D.lines().find(l => l.id === mid).options[0].id },
  ]);
  assert.equal(r.results.length, 5);
  assert.equal(r.results.filter(x => x.ok).length, 4);
  assert.equal(r.results.find(x => x.id === missing).ok, false);
  assert.equal(D.lines().find(l => l.id === ev[0]).status, 'settled');
  assert.equal(D.lines().find(l => l.id === ev[1]).status, 'pushed');
  assert.equal(D.lines().find(l => l.id === ev[2]).status, 'cancelled');
  assert.equal(D.lines().find(l => l.id === mid).status, 'settled');
  const coins = D.db.prepare('SELECT coins FROM users WHERE id=?').get(u).coins;
  // after stakes (350) were deducted: h2h win +166, push +100, cancel +100, local +100 (+50 profit)
  assert.equal(coins, start + 166 + 100 + 100 + 100);
  const bets = D.myBets(u);
  assert.equal(bets.find(b => b.option_id === opt(ev[0], 'Lakers').id).status, 'won');
  assert.ok(['refunded', 'cancelled'].includes(bets.find(b => b.option_id === opt(ev[1], 'Lakers').id).status));
  const again = D.batchSettle([
    { id: ev[0], action: 'settle', optionId: opt(ev[0], 'Lakers').id },
    { id: ev[1], action: 'push' },
  ]);
  assert.ok(again.results.every(x => x.ok === false));
  assert.equal(D.db.prepare('SELECT coins FROM users WHERE id=?').get(u).coins, coins);
  try { D.batchSettle([]); assert.fail('empty should throw'); } catch (e) { assert.ok(e.user); }
  const bad = D.batchSettle([{ id: ev[0], action: 'explode' }]);
  assert.equal(bad.results[0].ok, false);
});

console.log(n, 'admin settle tests passed');
