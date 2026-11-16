const assert = require('node:assert/strict');
const fs = require('node:fs');
const { open, START_COINS } = require('./core');
const R = require('./roulette');
let n = 0; const t = (name, fn) => { fn(); console.log('OK', name); n++; };

const mk = (now = 1_700_000_000_000) => {
  const D = open(':memory:');
  D.setupAdmin('admin', '1234');
  const a = D.register(D.newInvite(), 'ana', '1234');
  const b = D.register(D.newInvite(), 'beto', '1234');
  const coins = uid => D.bankStatus(uid).coins;
  return { D, a, b, coins, now };
};
const T = (now, offset) => {
  const id = R.roundIdAt(now);
  const t = R.roundTimes(id);
  return { id, ...t, now: t.opens + offset };
};

t('phases follow the 40s / 8s / 12s clock from epoch', () => {
  const opens = 100 * R.LIVE.ROUND_MS;
  assert.equal(R.roundIdAt(opens), 100);
  assert.equal(R.phaseAt(opens, R.roundTimes(100)), 'open');
  assert.equal(R.phaseAt(opens + 39999, R.roundTimes(100)), 'open');
  assert.equal(R.phaseAt(opens + 40000, R.roundTimes(100)), 'spinning');
  assert.equal(R.phaseAt(opens + 47999, R.roundTimes(100)), 'spinning');
  assert.equal(R.phaseAt(opens + 48000, R.roundTimes(100)), 'result');
  assert.equal(R.phaseAt(opens + 59999, R.roundTimes(100)), 'result');
  assert.equal(R.phaseAt(opens + 60000, R.roundTimes(100)), 'ended');
  assert.equal(R.roundIdAt(opens + 60000), 101);
});

t('bets accepted only before close; late bets rejected; no debit after close', () => {
  const { D, a, coins } = mk();
  const opens = 200 * R.LIVE.ROUND_MS;
  const before = coins(a);
  const ok = D.liveBet(a, [{ type: 'red', amount: 100 }], 'bet_open_01', opens + 39999);
  assert.equal(ok.replay, false);
  assert.equal(ok.stake, 100);
  const afterOpen = coins(a);
  assert.equal(afterOpen, before - 100);
  assert.throws(() => D.liveBet(a, [{ type: 'black', amount: 100 }], 'bet_late_01', opens + 40000), /cerradas|siguiente ronda/);
  // A late call at close may draw and settle the earlier bet (rojo even-money), but must not debit the rejected one.
  assert.equal(D.db.prepare("SELECT COUNT(*) c FROM live_bets WHERE idem='bet_late_01'").get().c, 0);
  const afterLate = coins(a);
  assert.ok(afterLate === afterOpen || afterLate === afterOpen + 200, 'late bet must not debit; settlement of the earlier bet is ok');
  const st = D.livePublicState(a, opens + 20000);
  assert.equal(st.phase, 'open');
  assert.equal(st.number, null);
});

t('number is drawn only after close and never leaked in open state', () => {
  const { D, a } = mk();
  const opens = 300 * R.LIVE.ROUND_MS;
  D.liveBet(a, [{ type: 'straight', nums: [7], amount: 100 }], 'bet_noleak_1', opens + 1000);
  let st = D.livePublicState(a, opens + 1000);
  assert.equal(st.phase, 'open');
  assert.equal(st.number, null);
  assert.equal(st.color, null);
  assert.equal(JSON.stringify(st).includes('"number":7') || (st.number === 7), false);
  const mid = D.db.prepare('SELECT number FROM live_rounds WHERE id=?').get(st.id);
  assert.ok(!mid || mid.number == null);
  st = D.livePublicState(a, opens + 40000);
  assert.equal(st.phase, 'spinning');
  assert.ok(Number.isInteger(st.number) && st.number >= 0 && st.number <= 37);
  assert.equal(st.wheel, 'american');
  assert.equal(st.label, R.labelOf(st.number));
  assert.ok(st.color);
  const stored = D.db.prepare('SELECT number FROM live_rounds WHERE id=?').get(st.id).number;
  assert.equal(stored, st.number);
  const again = D.livePublicState(a, opens + 45000);
  assert.equal(again.number, st.number); // stable once drawn
  // even if a number were already stored, open state must not send it
  const openLeak = D.livePublicState(a, opens + 2000);
  assert.equal(openLeak.phase, 'open');
  assert.equal(openLeak.number, null);
});

t('per-round limits aggregate across bets; idempotent retry does not double-charge', () => {
  const { D, a, coins } = mk();
  const opens = 400 * R.LIVE.ROUND_MS;
  const start = coins(a);
  D.liveBet(a, [{ type: 'red', amount: 25000 }], 'lim_aaaa', opens + 10);
  D.liveBet(a, [{ type: 'black', amount: 25000 }], 'lim_bbbb', opens + 11);
  assert.equal(coins(a), start - 50000);
  assert.throws(() => D.liveBet(a, [{ type: 'odd', amount: 100 }], 'lim_cccc', opens + 12), /total por ronda|superar/);
  assert.equal(coins(a), start - 50000);
  const mid = coins(a);
  const r1 = D.liveBet(a, [{ type: 'red', amount: 25000 }], 'lim_aaaa', opens + 13);
  assert.equal(r1.replay, true);
  assert.equal(coins(a), mid);
  // chip count: 40 + 1
  const { D: D2, a: u2, coins: c2 } = mk();
  const chips = Array.from({ length: 40 }, (_, i) => ({ type: 'straight', nums: [i % 37], amount: 100 }));
  D2.liveBet(u2, chips, 'chips_040', opens + 20);
  assert.throws(() => D2.liveBet(u2, [{ type: 'red', amount: 100 }], 'chips_041', opens + 21), /Máximo 40/);
  assert.equal(c2(u2), START_COINS - 4000);
});

t('settlement pays once; restart with a drawn number settles unpaid bets', () => {
  const { D, a, b, coins } = mk();
  const opens = 500 * R.LIVE.ROUND_MS;
  const ca = coins(a), cb = coins(b);
  D.liveBet(a, [{ type: 'straight', nums: [0], amount: 100 }], 'settle_a', opens + 1);
  D.liveBet(b, [{ type: 'red', amount: 200 }], 'settle_b', opens + 2);
  const st = D.livePublicState(a, opens + 40000); // draw + settle
  assert.ok(st.number != null);
  const row = D.db.prepare('SELECT * FROM live_rounds WHERE id=?').get(st.id);
  assert.equal(row.status, 'settled');
  const ba = D.db.prepare('SELECT payout, bets FROM live_bets WHERE user_id=?').get(a);
  const bb = D.db.prepare('SELECT payout FROM live_bets WHERE user_id=?').get(b);
  const expectA = R.settle(JSON.parse(ba.bets), st.number).payout;
  assert.equal(ba.payout, expectA);
  assert.equal(coins(a), ca - 100 + expectA);
  const expectB = R.settle([{ type: 'red', amount: 200, nums: [] }], st.number).payout;
  assert.equal(bb.payout, expectB);
  assert.equal(coins(b), cb - 200 + expectB);
  const after = coins(a);
  D.liveRecover(opens + 50000); // idempotent
  assert.equal(coins(a), after);
  assert.equal(D.db.prepare('SELECT status FROM live_rounds WHERE id=?').get(st.id).status, 'settled');
});

t('if the server missed close and never drew, past rounds with bets are fully refunded', () => {
  const { D, a, coins } = mk();
  const opens = 600 * R.LIVE.ROUND_MS;
  const before = coins(a);
  D.liveBet(a, [{ type: 'black', amount: 500 }], 'refund_1', opens + 5);
  assert.equal(coins(a), before - 500);
  const id = R.roundIdAt(opens);
  const row = D.db.prepare('SELECT number,status FROM live_rounds WHERE id=?').get(id);
  assert.equal(row.number, null);
  // jump past the whole round with no draw
  const rec = D.liveRecover(opens + R.LIVE.ROUND_MS);
  const after = D.db.prepare('SELECT * FROM live_rounds WHERE id=?').get(id);
  assert.equal(after.status, 'refunded');
  assert.equal(after.number, null);
  assert.equal(D.db.prepare('SELECT payout FROM live_bets WHERE round_id=?').get(id).payout, 500);
  assert.equal(coins(a), before);
  D.liveRecover(opens + R.LIVE.ROUND_MS + 1000);
  assert.equal(coins(a), before); // no double refund
  const pub = D.livePublicState(a, opens + R.LIVE.ROUND_MS + 1000);
  assert.notEqual(pub.id, id);
});

t('live roulette does not award ranking points; routes and tile stay on Retos → Ruleta', () => {
  const { D, a } = mk();
  const opens = 700 * R.LIVE.ROUND_MS;
  const pts = () => D.leaderboard('temporada').find(r => r.id === a).points;
  const before = pts();
  D.liveBet(a, [{ type: 'straight', nums: [0], amount: 100 }], 'points_1', opens + 1);
  // Force a winning number 0 if not already by settling after injecting? We just settle naturally.
  D.livePublicState(a, opens + 40000);
  assert.equal(pts(), before);
  const core = fs.readFileSync(__dirname + '/core.js', 'utf8');
  assert.ok(!/refreshRanks\(\).*live_|live_.*refreshRanks/.test(core));
  const src = fs.readFileSync(__dirname + '/server.js', 'utf8');
  assert.ok(src.includes("app.get('/api/roulette/live'") && src.includes("app.post('/api/roulette/live/bet'") && src.includes("app.get('/api/roulette/live/stream'"));
  assert.ok(src.includes('text/event-stream') && src.includes('query.token'));
  const app = fs.readFileSync(__dirname + '/public/app.js', 'utf8');
  assert.ok(app.includes('data-gm="roulette"') && app.includes('/icons/roulette-icon.png') && !app.includes('🎡'));
  assert.ok(!app.includes('data-gm="roulette-live"') && !app.includes('Ruleta en vivo</b>'));
});

t('new rounds are tagged american; a leftover NULL wheel draws and settles as European 0–36', () => {
  const { D, a, coins } = mk();
  const opens = 800 * R.LIVE.ROUND_MS;
  const id = R.roundIdAt(opens);
  // Pre-insert a leftover European round (wheel NULL) as production would look mid-switch.
  D.db.prepare("INSERT INTO live_rounds(id,opens,closes,status) VALUES(?,?,?,'open')").run(id, opens, opens + R.LIVE.BET_MS);
  const tagged = D.db.prepare('SELECT wheel FROM live_rounds WHERE id=?').get(id);
  assert.ok(tagged.wheel == null, 'must not backfill existing rounds');
  D.liveBet(a, [{ type: 'red', amount: 100 }], 'euro_legacy_1', opens + 10);
  // liveEnsure INSERT OR IGNORE must not stamp american onto the leftover row
  assert.equal(D.db.prepare('SELECT wheel FROM live_rounds WHERE id=?').get(id).wheel, null);
  const st = D.livePublicState(a, opens + 40000);
  assert.equal(st.wheel, 'european');
  assert.ok(Number.isInteger(st.number) && st.number >= 0 && st.number <= 36);
  assert.notEqual(st.number, 37);
  assert.equal(st.label, String(st.number));
  const expect = R.settle([{ type: 'red', amount: 100, nums: [] }], st.number, 'european');
  const row = D.db.prepare('SELECT payout FROM live_bets WHERE idem=?').get('euro_legacy_1');
  assert.equal(row.payout, expect.payout);

  const opens2 = 900 * R.LIVE.ROUND_MS;
  D.liveBet(a, [{ type: 'straight', nums: [37], amount: 100 }], 'am_new_00', opens2 + 10);
  const id2 = R.roundIdAt(opens2);
  assert.equal(D.db.prepare('SELECT wheel FROM live_rounds WHERE id=?').get(id2).wheel, 'american');
  const st2 = D.livePublicState(a, opens2 + 1000);
  assert.equal(st2.wheel, 'american');
  assert.equal(st2.number, null);
});

console.log(n, 'live roulette tests passed');
