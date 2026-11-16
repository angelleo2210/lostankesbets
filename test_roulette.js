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
  assert.equal(R.WHEEL.length, 38); assert.equal(R.WHEEL[0], 0); assert.equal(R.ZERO00, 37);
  assert.deepEqual(R.WHEEL, [0, 28, 9, 26, 30, 11, 7, 20, 32, 17, 5, 22, 34, 15, 3, 24, 36, 13, 1, 37, 27, 10, 25, 29, 12, 8, 19, 31, 18, 6, 21, 33, 16, 4, 23, 35, 14, 2]);
  assert.equal(R.WHEEL_EU.length, 37);
  assert.deepEqual(R.WHEEL_EU, [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26]);
  // 00 (stored as 37): straight 35:1, label, even-money and dozen/column lose
  s = pay('straight', { nums: [37] }, 37); assert.equal(s.payout, 3600); assert.equal(s.color, 'green'); assert.equal(s.label, '00');
  for (const type of ['red', 'black', 'odd', 'even', 'low', 'high']) {
    s = pay(type, {}, 37); assert.equal(s.payout, 0, type + ' must lose on 00');
  }
  s = pay('dozen', { dozen: 1 }, 37); assert.equal(s.payout, 0);
  s = pay('column', { column: 1 }, 37); assert.equal(s.payout, 0);
  s = pay('split', { nums: [0, 37] }, 37); assert.equal(s.payout, 1800);
  s = pay('trio', { nums: [2, 3, 37] }, 37); assert.equal(s.payout, 1200);
  s = pay('trio', { nums: [0, 2, 37] }, 0); assert.equal(s.payout, 1200);
  s = pay('firstfive', { nums: [0, 1, 2, 3, 37] }, 37); assert.equal(s.payout, 700);
  s = pay('firstfive', { nums: [0, 1, 2, 3, 37] }, 8); assert.equal(s.payout, 0);
});

t('invalid shapes rejected (non-adjacent split, bad street/corner)', () => {
  assert.throws(() => R.normalizeBet({ type: 'split', nums: [1, 3], amount: 100 }), /adyacentes/);
  assert.throws(() => R.normalizeBet({ type: 'split', nums: [1, 5], amount: 100 }), /adyacentes/);
  assert.throws(() => R.normalizeBet({ type: 'street', nums: [1, 2, 4], amount: 100 }), /Transversal/);
  assert.throws(() => R.normalizeBet({ type: 'corner', nums: [1, 2, 3, 4], amount: 100 }), /Cuadro/);
  assert.doesNotThrow(() => R.normalizeBet({ type: 'straight', nums: [37], amount: 100 }));
  assert.throws(() => R.normalizeBet({ type: 'straight', nums: [38], amount: 100 }), /inválid/);
  assert.throws(() => R.normalizeBet({ type: 'straight', nums: [0], amount: 50 }), /mínima/);
  assert.throws(() => R.normalizeBets([]), /al menos/);
  assert.throws(() => R.normalizeBets([{ type: 'red', amount: 100 }, { type: 'black', amount: 50000 }]), /máxima|superar/);
});

t('RNG is crypto range 0–37 (American) and roughly uniform; European style stays 0–36', () => {
  const c = Array(38).fill(0);
  const N = 3800;
  for (let i = 0; i < N; i++) {
    const x = R.spinNumber();
    assert.ok(x >= 0 && x <= 37 && Number.isInteger(x));
    c[x]++;
  }
  for (let i = 0; i < 38; i++) assert.ok(c[i] >= 40 && c[i] <= 180, 'count ' + i + '=' + c[i]);
  const eu = Array(37).fill(0);
  for (let i = 0; i < 3700; i++) {
    const x = R.spinNumber('european');
    assert.ok(x >= 0 && x <= 36 && Number.isInteger(x));
    eu[x]++;
  }
  for (let i = 0; i < 37; i++) assert.ok(eu[i] >= 40 && eu[i] <= 180, 'eu count ' + i + '=' + eu[i]);
  const euroSettle = R.settle([R.normalizeBet({ type: 'straight', nums: [17], amount: 100 })], 17, 'european');
  assert.equal(euroSettle.payout, 3600);
  assert.throws(() => R.settle([R.normalizeBet({ type: 'straight', nums: [0], amount: 100 })], 37, 'european'), /inválido/);
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

t('new solo spins are rejected; existing history stays intact; no debit', () => {
  const { D, u, coinsOf } = mk();
  const before = coinsOf(u);
  D.db.prepare("INSERT INTO roulette_spins(user_id,idem,number,color,stake,payout,profit,bets,ts) VALUES(?,?,?,?,?,?,?,?,?)")
    .run(u, 'legacy_keep_1', 17, 'black', 100, 0, -100, '[]', Date.now());
  assert.throws(() => D.rouletteSpin(u, [{ type: 'red', amount: 100 }], 'rl_aaaaaaaa'), /solitario|mesa en vivo|Retos/);
  assert.throws(() => D.rouletteSpin(u, [{ type: 'straight', nums: [7], amount: 100 }], 'rl_samekey1'), /solitario|mesa en vivo|Retos/);
  assert.equal(coinsOf(u), before);
  const hist = D.rouletteHistory(u);
  assert.equal(hist.length, 1);
  assert.equal(hist[0].number, 17);
  assert.equal(D.db.prepare('SELECT COUNT(*) c FROM roulette_spins').get().c, 1);
});

t('UI hooks and American 0/00 wheel present; retos entry + no sports ranking mix', () => {
  const fs = require('node:fs');
  const app = fs.readFileSync(__dirname + '/public/app.js', 'utf8');
  const ui = fs.readFileSync(__dirname + '/public/roulette-ui.js', 'utf8');
  const css = fs.readFileSync(__dirname + '/public/index.html', 'utf8');
  const core = fs.readFileSync(__dirname + '/core.js', 'utf8');
  assert.ok(app.includes("gameSel === 'roulette'") && app.includes('data-gm="roulette"') && app.includes('Ruleta') && app.includes('/icons/roulette-icon.png') && !app.includes('🎡'));
  assert.ok(require('fs').existsSync(__dirname + '/public/icons/roulette-icon.png') && require('fs').existsSync(__dirname + '/public/icons/roulette-icon@2x.png'));
  assert.ok(css.includes('.rps-game-icon,.rl-game-icon,.reto-icon{display:block;width:88px;height:88px;object-fit:cover;object-position:center;border-radius:22%') && css.includes('repeat(2,minmax(0,1fr))') && !css.includes('width:min(220px,72vw)') && !css.includes('min(148px,42vw)'));
  assert.ok(ui.includes('Hagan sus apuestas') && ui.includes('No va más') && ui.includes("const WHEEL = [0, 28, 9, 26, 30, 11, 7, 20"));
  assert.ok(ui.includes('Ruleta en vivo') && ui.includes('LosTankesBets') && ui.includes('/roulette/live') && ui.includes('EventSource') && ui.includes('setInterval(poll, 2000)'));
  assert.ok(!ui.includes('Lucky Box') && !ui.includes('Playtech') && !ui.includes('Hard Rock'));
  assert.ok(!ui.includes('>Girar</button>') && ui.includes('>Apostar</button>'));
  assert.ok(ui.includes('rl-ball-track') && ui.includes('rl-vfelt') && ui.includes('rl-hfelt') && css.includes('.rl-felt') && (css.includes('.rl-dolly') || css.includes('dolly')));
  assert.ok(css.includes('rl-wheel-ring') && css.includes('rl-spin-stage') && css.includes('rl-mine'));
  assert.ok(core.includes('roulette_spins') && core.includes('live_rounds') && !/refreshRanks\(\).*roulette|roulette.*refreshRanks/.test(core));
  assert.ok(!app.includes('data-gm="live-roulette"') && app.includes('/icons/roulette-icon.png') && app.includes('roulette-icon@2x.png'));
});

console.log(n, 'roulette tests passed');
