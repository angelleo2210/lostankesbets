const assert = require('node:assert/strict');
const R = require('./roulette');
const { open, START_COINS } = require('./core');
let n = 0; const t = (name, fn) => { fn(); console.log('OK', name); n++; };

t('payouts: every inside/outside type including 0 (stake returned on win)', () => {
  const amt = 100;
  const pay = (type, extra, num) => R.settle([R.normalizeBet({ type, amount: amt, ...extra })], num);
  // straight
  let s = pay('straight', { nums: [17] }, 17); assert.equal(s.payout, 100 * 36); assert.equal(s.profit, 3500); assert.ok(s.settled[0].win);
  s = pay('straight', { nums: [17] }, 16); assert.equal(s.payout, 0); assert.equal(s.profit, -100);
  s = pay('straight', { nums: [0] }, 0); assert.equal(s.payout, 3600); assert.equal(s.color, 'green');
  // split
  s = pay('split', { nums: [1, 2] }, 1); assert.equal(s.payout, 1800);
  s = pay('split', { nums: [0, 2] }, 0); assert.equal(s.payout, 1800);
  s = pay('split', { nums: [1, 2] }, 0); assert.equal(s.payout, 0);
  // street / trio
  s = pay('street', { nums: [1, 2, 3] }, 3); assert.equal(s.payout, 1200);
  s = pay('trio', { nums: [0, 1, 2] }, 0); assert.equal(s.payout, 1200);
  s = pay('trio', { nums: [0, 2, 3] }, 3); assert.equal(s.payout, 1200);
  // corner / first four
  s = pay('corner', { nums: [1, 2, 4, 5] }, 5); assert.equal(s.payout, 900);
  s = pay('firstfour', { nums: [0, 1, 2, 3] }, 0); assert.equal(s.payout, 900);
  s = pay('firstfour', { nums: [0, 1, 2, 3] }, 8); assert.equal(s.payout, 0);
  // six line
  s = pay('sixline', { nums: [1, 2, 3, 4, 5, 6] }, 6); assert.equal(s.payout, 600);
  // dozen / column 2:1
  s = pay('dozen', { dozen: 2 }, 13); assert.equal(s.payout, 300);
  s = pay('dozen', { dozen: 2 }, 12); assert.equal(s.payout, 0);
  s = pay('column', { column: 1 }, 34); assert.equal(s.payout, 300);
  s = pay('column', { column: 1 }, 35); assert.equal(s.payout, 0);
  // even money: win
  s = pay('red', {}, 1); assert.equal(s.payout, 200); assert.equal(s.color, 'red');
  s = pay('black', {}, 2); assert.equal(s.payout, 200); assert.equal(s.color, 'black');
  s = pay('odd', {}, 1); assert.equal(s.payout, 200);
  s = pay('even', {}, 2); assert.equal(s.payout, 200);
  s = pay('low', {}, 18); assert.equal(s.payout, 200);
  s = pay('high', {}, 19); assert.equal(s.payout, 200);
  // 0: even-money lose (no la partage)
  for (const type of ['red', 'black', 'odd', 'even', 'low', 'high']) {
    s = pay(type, {}, 0); assert.equal(s.payout, 0, type + ' must lose on 0'); assert.equal(s.color, 'green');
  }
  // red set completeness
  const reds = [...R.RED].sort((a, b) => a - b);
  assert.deepEqual(reds, [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
  assert.equal(R.WHEEL.length, 37); assert.equal(R.WHEEL[0], 0);
  assert.deepEqual(R.WHEEL, [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26]);
});

t('invalid shapes rejected (non-adjacent split, bad street/corner)', () => {
  assert.throws(() => R.normalizeBet({ type: 'split', nums: [1, 3], amount: 100 }), /adyacentes/);
  assert.throws(() => R.normalizeBet({ type: 'split', nums: [1, 5], amount: 100 }), /adyacentes/);
  assert.throws(() => R.normalizeBet({ type: 'street', nums: [1, 2, 4], amount: 100 }), /Transversal/);
  assert.throws(() => R.normalizeBet({ type: 'corner', nums: [1, 2, 3, 4], amount: 100 }), /Cuadro/);
  assert.throws(() => R.normalizeBet({ type: 'straight', nums: [37], amount: 100 }), /inválid/);
  assert.throws(() => R.normalizeBet({ type: 'straight', nums: [0], amount: 50 }), /mínima/);
  assert.throws(() => R.normalizeBets([]), /al menos/);
  assert.throws(() => R.normalizeBets([{ type: 'red', amount: 100 }, { type: 'black', amount: 50000 }]), /máxima|superar/);
});

t('RNG is crypto range 0–36 and roughly uniform', () => {
  const c = Array(37).fill(0);
  const N = 3700;
  for (let i = 0; i < N; i++) {
    const x = R.spinNumber();
    assert.ok(x >= 0 && x <= 36 && Number.isInteger(x));
    c[x]++;
  }
  // expected ~100; allow 40–180 (~4 sigma-ish loose bound)
  for (let i = 0; i < 37; i++) assert.ok(c[i] >= 40 && c[i] <= 180, 'count ' + i + '=' + c[i]);
});

const mk = () => {
  const D = open(':memory:');
  D.setupAdmin('admin', '1234');
  const u = D.register(D.newInvite(), 'ana', '1234');
  const coins = () => D.userByToken ? null : null;
  const coinsOf = uid => {
    // userByToken needs a session; read via bankStatus
    return D.bankStatus(uid).coins;
  };
  return { D, u, coinsOf };
};

t('insufficient funds rejected; no debit', () => {
  const { D, u, coinsOf } = mk();
  D.db.prepare('UPDATE users SET coins=150 WHERE id=?').run(u);
  const before = coinsOf(u);
  assert.equal(before, 150);
  assert.throws(() => D.rouletteSpin(u, [{ type: 'red', amount: 100 }, { type: 'black', amount: 100 }], 'rl_aaaaaaaa'), /suficientes/);
  assert.equal(coinsOf(u), before);
});

t('atomic settle + idempotent retry does not double-pay', () => {
  const { D, u, coinsOf } = mk();
  const before = coinsOf(u);
  const r1 = D.rouletteSpin(u, [{ type: 'straight', nums: [7], amount: 100 }], 'rl_samekey1');
  assert.ok(r1.number >= 0 && r1.number <= 36);
  assert.equal(coinsOf(u), before - r1.stake + r1.payout);
  assert.equal(r1.replay, false);
  const mid = coinsOf(u);
  const r2 = D.rouletteSpin(u, [{ type: 'straight', nums: [7], amount: 100 }], 'rl_samekey1');
  assert.equal(r2.id, r1.id); assert.equal(r2.number, r1.number); assert.equal(r2.payout, r1.payout);
  assert.equal(r2.replay, true);
  assert.equal(coinsOf(u), mid);
  const hist = D.rouletteHistory(u);
  assert.equal(hist.length, 1);
  const board = D.rouletteBoard();
  assert.ok(board.recent.length >= 1 && board.limits.minBet === 100);
});

t('UI hooks and European wheel present; retos entry + no sports ranking mix', () => {
  const fs = require('node:fs');
  const app = fs.readFileSync(__dirname + '/public/app.js', 'utf8');
  const ui = fs.readFileSync(__dirname + '/public/roulette-ui.js', 'utf8');
  const css = fs.readFileSync(__dirname + '/public/index.html', 'utf8');
  const core = fs.readFileSync(__dirname + '/core.js', 'utf8');
  assert.ok(app.includes("gameSel === 'roulette'") && app.includes('data-gm="roulette"') && app.includes('Ruleta'));
  assert.ok(ui.includes('Hagan sus apuestas') && ui.includes('No va más') && ui.includes("const WHEEL = [0, 32, 15, 19, 4, 21, 2, 25"));
  assert.ok(ui.includes('rl-ball-track') && css.includes('.rl-felt{') && css.includes('.rl-dolly') || css.includes('dolly'));
  assert.ok(core.includes('roulette_spins') && !/refreshRanks\(\).*roulette|roulette.*refreshRanks/.test(core));
});

console.log(n, 'roulette tests passed');
