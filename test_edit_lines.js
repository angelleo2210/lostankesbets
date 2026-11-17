const assert = require('node:assert/strict');
const fs = require('node:fs');
const { open } = require('./core');
let n = 0; const t = (name, fn) => { fn(); console.log('OK', name); n++; };
const mk = () => {
  const D = open(':memory:');
  const admin = D.setupAdmin('admin', '1234');
  const u = D.register(D.newInvite(), 'ana', '1234');
  const ids = D.createEvent({ id: 'odds:abc', title: 'Denmark vs Norway', home: 'Denmark', away: 'Norway', unit: 'goles', starts: new Date(Date.now() + 864e5).toISOString(), sport_key: 'soccer_uefa_nations_league', markets: [
    { key: 'h2h', bookmaker: 'x', options: [{ label: 'Denmark', odds: 150 }, { label: 'Norway', odds: 190 }, { label: 'Draw', odds: 240 }] },
    { key: 'spreads', bookmaker: 'x', options: [{ label: 'Denmark', odds: -120, point: 0 }, { label: 'Norway', odds: 109, point: -0 }] },
    { key: 'totals', bookmaker: 'x', options: [{ label: 'Over', odds: 105, point: 3 }, { label: 'Under', odds: -115, point: 3 }] }
  ] }, 'real');
  const opts = lid => D.db.prepare('SELECT * FROM options WHERE line_id=? ORDER BY id').all(lid);
  return { D, admin, u, ids, opts };
};

t('admin edits odds and thresholds of an imported (real) event with no bets', () => {
  const { D, admin, ids, opts } = mk();
  const [h2h, spr, tot] = ids;
  assert.equal(D.db.prepare('SELECT kind FROM lines WHERE id=?').get(spr).kind, 'real');
  let o = opts(spr);
  let r = D.editLineMarket(admin, spr, [{ id: o[0].id, odds: -110, point: -0.5 }, { id: o[1].id, odds: -110, point: 0.5 }]);
  assert.equal(r.changed, true);
  o = opts(spr);
  assert.deepEqual(o.map(x => [x.odds, x.point]), [[-110, -0.5], [-110, 0.5]]);
  assert.ok(o[0].label.includes('-0.5') && o[1].label.includes('+0.5'), o.map(x => x.label).join('|'));
  const ot = opts(tot);
  D.editLineMarket(admin, tot, [{ id: ot[0].id, odds: -105, point: 2.5 }, { id: ot[1].id, odds: -115, point: 2.5 }]);
  assert.deepEqual(opts(tot).map(x => [x.odds, x.point]), [[-105, 2.5], [-115, 2.5]]);
  assert.ok(opts(tot)[0].label.includes('O 2.5'));
  const oh = opts(h2h);
  D.editLineMarket(admin, h2h, [{ id: oh[0].id, odds: 140 }, { id: oh[1].id, odds: 200 }, { id: oh[2].id, odds: 230 }]);
  assert.deepEqual(opts(h2h).map(x => x.odds), [140, 200, 230]);
  assert.deepEqual(opts(h2h).map(x => x.label), oh.map(x => x.label));
});

t('server validation: admin only, mismatched thresholds, bad odds, partial option list', () => {
  const { D, admin, u, ids, opts } = mk();
  const [, spr, tot] = ids; const o = opts(spr), ot = opts(tot);
  assert.throws(() => D.editLineMarket(u, spr, [{ id: o[0].id, odds: -110, point: -1 }, { id: o[1].id, odds: -110, point: 1 }]), /administrador/);
  assert.throws(() => D.editLineMarket(admin, spr, [{ id: o[0].id, odds: -110, point: -1 }, { id: o[1].id, odds: -110, point: 2 }]), /opuestos/);
  assert.throws(() => D.editLineMarket(admin, spr, [{ id: o[0].id, odds: -110, point: -0.3 }, { id: o[1].id, odds: -110, point: 0.3 }]), /Umbral/);
  assert.throws(() => D.editLineMarket(admin, tot, [{ id: ot[0].id, odds: 50, point: 2.5 }, { id: ot[1].id, odds: -110, point: 2.5 }]), /Cuota/);
  assert.throws(() => D.editLineMarket(admin, tot, [{ id: ot[0].id, odds: -110.5, point: 2.5 }, { id: ot[1].id, odds: -110, point: 2.5 }]), /enteros/);
  assert.throws(() => D.editLineMarket(admin, tot, [{ id: ot[0].id, odds: -110, point: 2.5 }]), /todas las opciones/);
  assert.throws(() => D.editLineMarket(admin, tot, [{ id: ot[0].id, odds: -110, point: 2.5 }, { id: o[0].id, odds: -110, point: 2.5 }]), /no pertenece/);
  assert.throws(() => D.editLineMarket(admin, tot, [{ id: ot[0].id, odds: -110, point: 2.5 }, { id: ot[1].id, odds: -110, point: 3 }]), /mismo umbral/);
  assert.deepEqual(opts(tot).map(x => [x.odds, x.point]), [[105, 3], [-115, 3]]);
});

t('with bets: odds can change, existing tickets keep their odds, threshold is locked, counts reported', () => {
  const { D, admin, u, ids, opts } = mk();
  const [, spr, tot] = ids; const ot = opts(tot);
  D.db.prepare('UPDATE users SET coins=100000 WHERE id=?').run(u);
  D.placeBet(u, ot[0].id, 1000);
  const before = D.db.prepare('SELECT odds FROM bets').get().odds;
  assert.equal(before, 105);
  assert.equal(D.lineBetCounts()[tot], 1);
  assert.throws(() => D.editLineMarket(admin, tot, [{ id: ot[0].id, odds: -110, point: 2.5 }, { id: ot[1].id, odds: -110, point: 2.5 }]), /1 apuesta.*umbral/);
  const r = D.editLineMarket(admin, tot, [{ id: ot[0].id, odds: -130, point: 3 }, { id: ot[1].id, odds: 110, point: 3 }]);
  assert.equal(r.bets, 1);
  assert.equal(D.db.prepare('SELECT odds FROM bets').get().odds, 105);
  assert.deepEqual(opts(tot).map(x => x.odds), [-130, 110]);
  // new bet uses the new odds; parlay legs too
  D.placeBet(u, ot[1].id, 500);
  assert.deepEqual(D.db.prepare('SELECT odds FROM bets ORDER BY id').all().map(x => x.odds), [105, 110]);
  const os = opts(spr);
  D.placeParlay(u, [ot[0].id, os[0].id], 100);
  assert.equal(D.lineBetCounts()[tot], 3);
  assert.equal(D.db.prepare('SELECT odds FROM parlay_legs WHERE option_id=?').get(ot[0].id).odds, -130);
  D.editLineMarket(admin, tot, [{ id: ot[0].id, odds: 100, point: 3 }, { id: ot[1].id, odds: -140, point: 3 }]);
  assert.equal(D.db.prepare('SELECT odds FROM parlay_legs WHERE option_id=?').get(ot[0].id).odds, -130);
  // settlement still pays at original ticket odds
  const c0 = D.bankStatus(u).coins;
  D.settleLine(tot, ot[0].id);
  assert.equal(D.db.prepare('SELECT status,payout FROM bets WHERE odds=105').get().payout, 2050);
  assert.ok(D.bankStatus(u).coins >= c0 + 2050);
});

t('settled/cancelled lines cannot be edited; routes and UI wired; SW v33; "No disponible" only when a market is missing', () => {
  const { D, admin, ids, opts } = mk();
  const o = opts(ids[2]);
  D.cancelLine(ids[2]);
  assert.throws(() => D.editLineMarket(admin, ids[2], [{ id: o[0].id, odds: -110, point: 3 }, { id: o[1].id, odds: -110, point: 3 }]), /liquidada o cancelada/);
  const srv = fs.readFileSync(__dirname + '/server.js', 'utf8'), app = fs.readFileSync(__dirname + '/public/app.js', 'utf8');
  assert.ok(srv.includes("/api/admin/lines/:id/edit") && srv.includes("/api/admin/line-bets"));
  assert.ok(app.includes('Editar cuotas y umbrales') && app.includes('Guardar cuotas') && app.includes('data-edit-save'));
  assert.ok(!app.includes('<div class="market-note small">— No disponible</div>') && app.includes('(!by.spreads || !by.totals || !winner)'));
  assert.ok(fs.readFileSync(__dirname + '/public/sw.js', 'utf8').includes('ltb-shell-v33'));
});

t('cancelled handicap/total do not block re-adding; anchor may be a cancelled line; new market shows in lines() and works in bets and parlays', () => {
  const { D, admin, u, ids, opts } = mk();
  const [h2h, spr, tot] = ids;
  D.db.prepare('UPDATE users SET coins=100000 WHERE id=?').run(u);
  D.placeBet(u, opts(spr)[0].id, 100);
  D.cancelLine(spr); D.cancelLine(tot);
  assert.deepEqual(D.lines(['open', 'closed']).filter(l => l.event_id === 'odds:abc').map(l => l.market), ['h2h']);
  const home = 'Denmark', away = 'Norway';
  // anchor = the cancelled handicap line (what the old UI could send)
  const ns = D.addEventMarket(spr, 'spreads', [{ label: home, point: -0.5, odds: -120 }, { label: away, point: 0.5, odds: 100 }], home, away, 'goles');
  const nt = D.addEventMarket(h2h, 'totals', [{ label: 'Over', point: 2.5, odds: -110 }, { label: 'Under', point: 2.5, odds: -110 }], home, away, 'goles');
  const live = D.lines(['open', 'closed']).filter(l => l.event_id === 'odds:abc');
  assert.deepEqual(live.map(l => l.market).sort(), ['h2h', 'spreads', 'totals']);
  assert.ok(live.find(l => l.id === ns).options.every(o => o.point != null) && live.find(l => l.id === ns).kind === 'real');
  assert.throws(() => D.addEventMarket(h2h, 'spreads', [{ label: home, point: -1, odds: -110 }, { label: away, point: 1, odds: -110 }], home, away), /ya existe/);
  const so = D.db.prepare('SELECT id FROM options WHERE line_id=? ORDER BY id').all(ns), to = D.db.prepare('SELECT id FROM options WHERE line_id=? ORDER BY id').all(nt);
  assert.ok(D.placeBet(u, so[0].id, 100));
  assert.ok(D.placeParlay(u, [so[0].id, to[0].id], 100));
  // cancelled handicap kept its refunded bet untouched
  assert.equal(D.db.prepare("SELECT status FROM bets WHERE line_id=?").get(spr).status, 'refunded');
  // new lines editable
  assert.equal(D.editLineMarket(admin, ns, [{ id: so[0].id, odds: -105, point: -0.5 }, { id: so[1].id, odds: -105, point: 0.5 }]).changed, true);
});

t('UI: errors show as a visible toast; edit form can add a missing Hándicap/Total', () => {
  const app = fs.readFileSync(__dirname + '/public/app.js', 'utf8'), css = fs.readFileSync(__dirname + '/public/index.html', 'utf8');
  assert.ok(app.includes("t.id = 'toast'") && css.includes('.toast.show') && app.includes('data-add-mkt') && app.includes('Agregar hándicap') && app.includes('Agregar total'));
});

t('"already exists" uses the grid definition (open/closed only); error names the line; admin can list every stored line', () => {
  const { D, admin, u, ids, opts } = mk();
  const [h2h, spr] = ids;
  assert.throws(() => D.addEventMarket(h2h, 'spreads', [{ label: 'Denmark', point: -1, odds: -110 }, { label: 'Norway', point: 1, odds: -110 }], 'Denmark', 'Norway'), new RegExp('ya existe en la línea #' + spr + ' \\(abierta\\)'));
  D.closeLine(spr);
  assert.throws(() => D.addEventMarket(h2h, 'spreads', [{ label: 'Denmark', point: -1, odds: -110 }, { label: 'Norway', point: 1, odds: -110 }], 'Denmark', 'Norway'), /cerrada/);
  // a settled (hidden by the grid) handicap no longer blocks a new one
  D.settleLine(spr, opts(spr)[0].id);
  const grid = D.lines(['open', 'closed']).filter(l => l.event_id === 'odds:abc').map(l => l.market);
  assert.ok(!grid.includes('spreads'));
  const ns = D.addEventMarket(h2h, 'spreads', [{ label: 'Denmark', point: -1, odds: -110 }, { label: 'Norway', point: 1, odds: -110 }], 'Denmark', 'Norway');
  const all = D.eventLinesAll(admin, h2h);
  assert.deepEqual(all.map(r => [r.id, r.market, r.status]).filter(r => r[1] === 'spreads'), [[spr, 'spreads', 'settled'], [ns, 'spreads', 'open']]);
  assert.ok(all.every(r => Array.isArray(r.options) && typeof r.bets === 'number'));
  assert.throws(() => D.eventLinesAll(u, h2h), /administrador/);
});

t('UI: Editar mercados button on each admin card, jump button from the Admin error, hidden-market note', () => {
  const app = fs.readFileSync(__dirname + '/public/app.js', 'utf8'), srv = fs.readFileSync(__dirname + '/server.js', 'utf8');
  assert.ok(app.includes('data-edit-open') && app.includes('✏️ Editar mercados') && app.includes('Ir a editar este partido en Líneas') && app.includes('applyJump') && app.includes('data-show-all') && app.includes('no coinciden con los equipos'));
  assert.ok(srv.includes('/api/admin/lines/:id/event-lines'));
});
console.log(n, 'edit-lines tests passed');
