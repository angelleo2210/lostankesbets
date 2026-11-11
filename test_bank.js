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
  D.db.prepare('UPDATE users SET coins=50 WHERE id=?').run(u);
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
t('loans at any balance, 1..100000 on the first loan; 10 lifetime max; never netted against debt', () => {
  const { D, reg, coins, debt } = mk(); const u = reg('beto'); const c0 = coins(u); assert.ok(c0 > 0);
  for (const bad of [0, -1, 100001, 1.5, 'x']) assert.throws(() => D.takeLoan(u, bad), /entre 1 y 100.000/);
  for (let i = 1; i <= 5; i++) { D.takeLoan(u, 100000); assert.equal(coins(u), c0 + i * 100000); assert.equal(debt(u), i * 100000); }
  const s5 = D.bankStatus(u); assert.equal(s5.state, 'open'); assert.equal(s5.canLoan, true); assert.equal(s5.loans, 5); assert.equal(s5.maxLoan, 100000);
  D.takeLoan(u, 1); assert.equal(D.bankStatus(u).loans, 6);
  assert.equal(coins(u), c0 + 500000 + 1); assert.equal(debt(u), 500001);
  assert.equal(D.db.prepare("SELECT COUNT(*) c FROM bank_ledger WHERE user_id=? AND kind='loan'").get(u).c, 6);
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
  D.db.prepare('UPDATE users SET coins=0 WHERE id=?').run(u);
  const s = D.declareBankruptcy(u, t0); assert.equal(s.debt, 0); assert.equal(coins(u), 0); assert.equal(D.myBets(u).find(b => b.id === bid).status, 'open');
  assert.equal(s.markUntil, Date.parse('2026-02-28T15:00:00Z')); assert.equal(D.bankPenalty(u, t0 + 1), 20); assert.equal(D.bankPenalty(u, Date.parse('2026-02-28T15:00:01Z')), 0);
  assert.equal(addMonthNY(Date.parse('2026-11-07T23:00:00Z')), Date.parse('2026-12-07T23:00:00Z')); // 6pm EST -> 6pm EST (wall clock)
  assert.equal(addMonthNY(Date.parse('2026-02-15T17:00:00Z')), Date.parse('2026-03-15T16:00:00Z')); // DST: noon stays noon
  D.takeLoan(u, 10); D.db.prepare('UPDATE users SET coins=0 WHERE id=?').run(u); D.declareBankruptcy(u, t0 - 86400000 * 20); assert.equal(D.bankStatus(u, t0).markUntil, Date.parse('2026-02-28T15:00:00Z')); // not shortened
  assert.throws(() => D.declareBankruptcy(u), /No tienes deuda/);
  D.settleLine(l, opts(l)[0].id); assert.equal(D.myBets(u).find(b => b.id === bid).status, 'won');
});
t('5th bankruptcy closes bank permanently; admin fresh start once; player/self cannot; second cycle stays closed', () => {
  const { D, adminId, reg, coins, line, opts, win, lose } = mk(); const u = reg('fede'), other = reg('gil'); win(u); lose(u);
  for (let i = 1; i <= 5; i++) { D.takeLoan(u, 10); D.db.prepare('UPDATE users SET coins=0 WHERE id=?').run(u); D.declareBankruptcy(u); }
  let s = D.bankStatus(u); assert.equal(s.state, 'closed_permanent'); assert.equal(s.bankruptcies, 5); assert.equal(s.debt, 0); assert.equal(s.adminResetsLeft, 1);
  assert.throws(() => D.takeLoan(u, 1), /administrador puede aprobar/); assert.throws(() => D.declareBankruptcy(u), /cerrado permanentemente/);
  assert.throws(() => D.adminFreshStart(u, u, 'NUEVO COMIENZO'), /administrador|sí mismo/); assert.throws(() => D.adminFreshStart(other, u, 'NUEVO COMIENZO'), /Solo el administrador/);
  assert.throws(() => D.adminFreshStart(adminId, other, 'NUEVO COMIENZO'), /no tiene el banco cerrado/); assert.throws(() => D.adminFreshStart(adminId, u, 'si'), /NUEVO COMIENZO/);
  assert.throws(() => D.adminFreshStart(adminId, adminId, 'NUEVO COMIENZO'), /sí mismo/);
  D.db.prepare('UPDATE users SET coins=1000 WHERE id=?').run(u);
  const l = line(); const bid = D.placeBet(u, opts(l)[0].id, 100); assert.deepEqual(D.bankClosedUsers().map(x => [x.id, x.eligible]), [[u, 1]]);
  D.adminFreshStart(adminId, u, 'NUEVO COMIENZO'); s = D.bankStatus(u);
  assert.equal(coins(u), 0); assert.equal(s.state, 'open'); assert.equal(s.bankruptcies, 0); assert.equal(s.debt, 0); assert.equal(s.penalty, 0); assert.equal(s.adminResetsLeft, 0);
  assert.equal(D.myBets(u).find(b => b.id === bid).status, 'open'); const r = D.leaderboard('temporada').find(x => x.id === u); assert.equal(r.wins, 1); assert.equal(r.losses, 1);
  const audit = D.db.prepare("SELECT * FROM bank_ledger WHERE kind='fresh_start'").all(); assert.equal(audit.length, 1); assert.equal(audit[0].admin_id, adminId);
  for (let i = 1; i <= 5; i++) { D.takeLoan(u, 10); D.db.prepare('UPDATE users SET coins=0 WHERE id=?').run(u); D.declareBankruptcy(u); }
  assert.equal(D.bankStatus(u).adminResetsLeft, 0); assert.throws(() => D.adminFreshStart(adminId, u, 'NUEVO COMIENZO'), /único nuevo comienzo/); assert.throws(() => D.takeLoan(u, 1), /permanentemente/);
  assert.deepEqual(D.bankClosedUsers().map(x => [x.id, x.eligible]), [[u, 0]]);
});
t('server routes require auth/admin', () => { const src = require('node:fs').readFileSync(__dirname + '/server.js', 'utf8');
  assert.ok(src.includes("C.takeLoan(auth(r).id") && src.includes("C.declareBankruptcy(auth(r).id)") && src.includes("C.adminFreshStart(admin(r).id") && src.includes("admin(r); return C.bankClosedUsers()"));
  const app = require('node:fs').readFileSync(__dirname + '/public/app.js', 'utf8'); assert.ok(!/saldo (exactamente )?0/.test(app)); assert.equal(BANK.LOAN_PENALTY, 7); assert.equal(BANK.MARK_PENALTY, 20); });

t('repaying all loans unblocks new borrowing; bankruptcy is only for unpaid debt you cannot pay', () => {
  const { D, reg, coins } = mk(); const u = reg('hugo');
  for (let i = 0; i < 5; i++) D.takeLoan(u, 1000);
  assert.equal(D.bankStatus(u).canLoan, true);
  assert.equal(D.bankStatus(u).canBankrupt, false); // has enough coins to pay
  assert.throws(() => D.declareBankruptcy(u), /saldo suficiente/);
  D.payDebtFull(u);
  const s = D.bankStatus(u);
  assert.equal(s.debt, 0); assert.equal(s.canLoan, true); assert.equal(s.state, 'open'); assert.equal(s.loans, 5);
  assert.equal(s.canBankrupt, false);
  const c = coins(u);
  D.takeLoan(u, 1000); assert.equal(D.bankStatus(u).loans, 6); assert.equal(coins(u), c + 1000);
});

t('on-time repayment doubles the max; late repayment stays; 10th loan is last and can reach 51.200.000', () => {
  const { D, reg, coins } = mk(); const u = reg('iris'); const { BANK, addMonthNY } = require('./core');
  assert.equal(BANK.MAX_LOANS, 10); assert.equal(BANK.LOAN_BASE, 100000);
  assert.equal(D.bankStatus(u).maxLoan, 100000);
  D.takeLoan(u, 100000); D.payDebtFull(u);
  assert.equal(D.bankStatus(u).onTime, 1); assert.equal(D.bankStatus(u).maxLoan, 200000);
  D.takeLoan(u, 200000);
  const id = D.db.prepare('SELECT id, ts FROM bank_loans WHERE user_id=? ORDER BY id DESC LIMIT 1').get(u);
  D.db.prepare('UPDATE bank_loans SET ts=? WHERE id=?').run(id.ts - 1000 * 60 * 60 * 24 * 40, id.id); // backdate so due already passed
  // repay late: set ts further so addMonthNY(ts) < now. 40 days may or may not pass a calendar month; use addMonthNY.
  const lateTs = addMonthNY(Date.now()) - 1000 * 60 * 60 * 24 * 60; // ~2 months before a month-from-now? messy.
  // Set loan.ts so due is yesterday: ts such that addMonthNY(ts) < now.
  const past = Date.parse('2026-01-01T12:00:00Z');
  D.db.prepare('UPDATE bank_loans SET ts=? WHERE id=?').run(past, id.id);
  D.payDebtFull(u);
  const paid = D.db.prepare('SELECT ts, closed_ts, status FROM bank_loans WHERE id=?').get(id.id);
  assert.equal(paid.status, 'paid');
  assert.ok(paid.closed_ts > addMonthNY(paid.ts), 'expected late repayment');
  assert.equal(D.bankStatus(u).onTime, 1); assert.equal(D.bankStatus(u).maxLoan, 200000); // late, no advance
  // 8 more on-time loans (3..10) after the late one: onTime 1+8=9, max 51.2M, then blocked
  for (let i = 0; i < 8; i++) {
    const max = D.bankStatus(u).maxLoan;
    D.takeLoan(u, 1); D.payDebtFull(u);
    assert.equal(D.bankStatus(u).onTime, 2 + i);
    assert.equal(D.bankStatus(u).maxLoan, 100000 * 2 ** (2 + i));
  }
  assert.equal(D.bankStatus(u).loans, 10);
  assert.equal(D.bankStatus(u).maxLoan, 51200000);
  assert.equal(D.bankStatus(u).state, 'loan_limit');
  assert.equal(D.bankStatus(u).canLoan, false);
  assert.throws(() => D.takeLoan(u, 1), /10 préstamos/);
});

t('audit lists repaid users as unblocked and reports current max', () => {
  const { D, reg } = mk(); const u = reg('juli');
  for (let i = 0; i < 5; i++) D.takeLoan(u, 100);
  D.payDebtFull(u);
  const row = D.auditLoanCycles().find(r => r.userId === u);
  assert.equal(row.wasBlocked, true); assert.equal(row.unblocked, true);
  assert.equal(row.lifetimeLoans, 5); assert.equal(row.maxLoan, 100000 * 2 ** 5); assert.equal(row.canLoan, true);
});

console.log(n + ' bank tests passed');
