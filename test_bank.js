// Banco + ranking points. Points = 3*wins - 7*loans since bankruptcy - 20 while bankruptcy mark active. Losses 0.
const assert = require('node:assert/strict'); const { open, BANK, addMonthNY } = require('./core');
let n = 0; const t = (name, fn) => { fn(); console.log('OK', name); n++; };
const mk = () => { const D = open(':memory:'); const admin = D.setupAdmin('admin', '1234'); const reg = nm => D.register(D.newInvite(), nm, '1234');
  const coins = u => D.db.prepare('SELECT coins FROM users WHERE id=?').get(u).coins; const debt = u => D.bankStatus(u).debt;
  const line = (odds = 100) => D.createLine('L' + Math.random(), [{ label: 'A', odds }, { label: 'B', odds: -110 }]);
  const opts = id => D.lines().find(l => l.id === id).options;
  const win = (u, stake = 10, odds = 100) => { const l = line(odds); const id = D.placeBet(u, opts(l)[0].id, stake); D.settleLine(l, opts(l)[0].id); return id; };
  const lose = (u) => { const l = line(); D.placeBet(u, opts(l)[0].id, 10); D.settleLine(l, opts(l)[1].id); };
  const row = u => D.leaderboard('temporada').find(r => r.id === u);
  const adminId = D.db.prepare('SELECT id FROM users WHERE is_admin=1').get().id;
  return { D, adminId, reg, coins, debt, line, opts, win, lose, row }; };
t('points: +3 per win, losses 0, -7 per loan, bankruptcy clears loans then -20 until mark expires', () => {
  const { D, reg, win, lose, row } = mk(); const u = reg('ana');
  win(u); win(u); win(u); assert.equal(row(u).points, 9); lose(u); lose(u); assert.equal(row(u).points, 9); assert.equal(row(u).losses, 2);
  D.takeLoan(u, 100); assert.equal(row(u).points, 2); D.takeLoan(u, 100); assert.equal(row(u).points, -5);
  D.declareBankruptcy(u); assert.equal(row(u).points, -11); assert.equal(row(u).wins, 3);
  D.db.prepare('UPDATE bank SET mark_until=? WHERE user_id=?').run(Date.now() - 1, u); assert.equal(row(u).points, 9);
  win(u); assert.equal(row(u).points, 12);
});
t('adjusted points order the table and podium; penalised player drops below fewer raw wins', () => {
  const { D, reg, win, lose, row } = mk(); const a = reg('alto'), b = reg('bajo');
  for (let i = 0; i < 4; i++) win(a); for (let i = 0; i < 3; i++) win(b); D.takeLoan(a, 1);
  const rows = D.leaderboard('temporada'); assert.ok(rows.findIndex(r => r.id === b) < rows.findIndex(r => r.id === a)); assert.equal(row(a).points, 5); assert.equal(row(b).points, 9);
  const tb = D.tabla('temporada'); assert.deepEqual(tb.podium.map(r => r.id), tb.rows.slice(0, 3).map(r => r.id)); assert.equal(tb.podium[0].id, b);
  assert.equal(D.ranks().get(b), 1);
});
t('loans at any balance, 1..100000 whole coins, 5 max then closed until bankruptcy; never netted against debt', () => {
  const { D, reg, coins, debt } = mk(); const u = reg('beto'); const c0 = coins(u); assert.ok(c0 > 0);
  for (const bad of [0, -1, 100001, 1.5, 'x']) assert.throws(() => D.takeLoan(u, bad), /entre 1 y 100.000/);
  for (let i = 1; i <= 5; i++) { D.takeLoan(u, 100000); assert.equal(coins(u), c0 + i * 100000); assert.equal(debt(u), i * 100000); }
  assert.throws(() => D.takeLoan(u, 1), /cerrado hasta que declares bancarrota/); assert.equal(D.bankStatus(u).state, 'closed_until_bankruptcy');
  assert.equal(coins(u), c0 + 500000); assert.equal(debt(u), 500000);
  assert.equal(D.db.prepare("SELECT COUNT(*) c FROM bank_ledger WHERE user_id=? AND kind='loan'").get(u).c, 5);
});
t('no automatic collection: winners get full payout (single, parlay, challenge); debt unchanged', () => {
  const { D, reg, coins, debt, win, line, opts } = mk(); const u = reg('caro'), o = reg('otro');
  D.takeLoan(u, 1000); let c = coins(u); win(u, 100, 100); assert.equal(debt(u), 1000); assert.equal(coins(u), c + 100);
  const a = line(100), b = line(100); D.placeParlay(u, [opts(a)[0].id, opts(b)[0].id], 100); c = coins(u);
  D.settleLine(a, opts(a)[0].id); D.settleLine(b, opts(b)[0].id); assert.equal(debt(u), 1000); assert.equal(coins(u), c + 400);
  const g = D.rpsChallenge(u, o, 1000).id; D.rpsRespond(o, g, true); D.rpsPick(u, g, 'piedra'); c = coins(u); D.rpsPick(o, g, 'tijera'); assert.equal(debt(u), 1000); assert.equal(coins(u), c + 2000);
  assert.equal(D.db.prepare("SELECT COUNT(*) c FROM bank_ledger WHERE kind LIKE 'repay%'").get().c, 0);
});
t('bankruptcy: wipes debt/loans/penalty only; pending bets, balance, history kept; calendar-month NY mark never shortened', () => {
  const { D, reg, coins, line, opts, win } = mk(); const u = reg('eva'); win(u); D.takeLoan(u, 5000);
  const l = line(); const bid = D.placeBet(u, opts(l)[0].id, 100); const c = coins(u); const t0 = Date.parse('2026-01-31T15:00:00Z');
  const s = D.declareBankruptcy(u, t0); assert.equal(s.debt, 0); assert.equal(s.loans, 0); assert.equal(coins(u), c); assert.equal(D.myBets(u).find(b => b.id === bid).status, 'open');
  assert.equal(s.markUntil, Date.parse('2026-02-28T15:00:00Z')); assert.equal(D.bankPenalty(u, t0 + 1), 20); assert.equal(D.bankPenalty(u, Date.parse('2026-02-28T15:00:01Z')), 0);
  assert.equal(addMonthNY(Date.parse('2026-11-07T23:00:00Z')), Date.parse('2026-12-07T23:00:00Z')); // 6pm EST -> 6pm EST (wall clock)
  assert.equal(addMonthNY(Date.parse('2026-02-15T17:00:00Z')), Date.parse('2026-03-15T16:00:00Z')); // DST: noon stays noon
  D.takeLoan(u, 10); D.declareBankruptcy(u, t0 - 86400000 * 20); assert.equal(D.bankStatus(u, t0).markUntil, Date.parse('2026-02-28T15:00:00Z')); // not shortened
  assert.throws(() => D.declareBankruptcy(u), /No tienes deuda/);
  D.settleLine(l, opts(l)[0].id); assert.equal(D.myBets(u).find(b => b.id === bid).status, 'won');
});
t('5th bankruptcy closes bank permanently; admin fresh start once; player/self cannot; second cycle stays closed', () => {
  const { D, adminId, reg, coins, line, opts, win, lose } = mk(); const u = reg('fede'), other = reg('gil'); win(u); lose(u);
  for (let i = 1; i <= 5; i++) { D.takeLoan(u, 10); D.declareBankruptcy(u); }
  let s = D.bankStatus(u); assert.equal(s.state, 'closed_permanent'); assert.equal(s.bankruptcies, 5); assert.equal(s.debt, 0); assert.equal(s.adminResetsLeft, 1);
  assert.throws(() => D.takeLoan(u, 1), /administrador puede aprobar/); assert.throws(() => D.declareBankruptcy(u), /cerrado permanentemente/);
  assert.throws(() => D.adminFreshStart(u, u, 'NUEVO COMIENZO'), /administrador|sí mismo/); assert.throws(() => D.adminFreshStart(other, u, 'NUEVO COMIENZO'), /Solo el administrador/);
  assert.throws(() => D.adminFreshStart(adminId, other, 'NUEVO COMIENZO'), /no tiene el banco cerrado/); assert.throws(() => D.adminFreshStart(adminId, u, 'si'), /NUEVO COMIENZO/);
  assert.throws(() => D.adminFreshStart(adminId, adminId, 'NUEVO COMIENZO'), /sí mismo/);
  const l = line(); const bid = D.placeBet(u, opts(l)[0].id, 100); assert.deepEqual(D.bankClosedUsers().map(x => [x.id, x.eligible]), [[u, 1]]);
  D.adminFreshStart(adminId, u, 'NUEVO COMIENZO'); s = D.bankStatus(u);
  assert.equal(coins(u), 0); assert.equal(s.state, 'open'); assert.equal(s.bankruptcies, 0); assert.equal(s.loans, 0); assert.equal(s.debt, 0); assert.equal(s.penalty, 0); assert.equal(s.adminResetsLeft, 0);
  assert.equal(D.myBets(u).find(b => b.id === bid).status, 'open'); const r = D.leaderboard('temporada').find(x => x.id === u); assert.equal(r.wins, 1); assert.equal(r.losses, 1);
  const audit = D.db.prepare("SELECT * FROM bank_ledger WHERE kind='fresh_start'").all(); assert.equal(audit.length, 1); assert.equal(audit[0].admin_id, adminId);
  for (let i = 1; i <= 5; i++) { D.takeLoan(u, 10); D.declareBankruptcy(u); }
  assert.equal(D.bankStatus(u).adminResetsLeft, 0); assert.throws(() => D.adminFreshStart(adminId, u, 'NUEVO COMIENZO'), /único nuevo comienzo/); assert.throws(() => D.takeLoan(u, 1), /permanentemente/);
  assert.deepEqual(D.bankClosedUsers().map(x => [x.id, x.eligible]), [[u, 0]]);
});
t('server routes require auth/admin', () => { const src = require('node:fs').readFileSync(__dirname + '/server.js', 'utf8');
  assert.ok(src.includes("C.takeLoan(auth(r).id") && src.includes("C.declareBankruptcy(auth(r).id)") && src.includes("C.adminFreshStart(admin(r).id") && src.includes("admin(r); return C.bankClosedUsers()"));
  const app = require('node:fs').readFileSync(__dirname + '/public/app.js', 'utf8'); assert.ok(!/saldo (exactamente )?0/.test(app)); assert.equal(BANK.LOAN_PENALTY, 7); assert.equal(BANK.MARK_PENALTY, 20); });
console.log(n + ' bank tests passed');
