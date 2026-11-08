// +7 ranking points back once per loan fully repaid (FIFO). Loan count (max 5) unchanged by payment.
const assert = require('node:assert/strict'); const { open, BANK } = require('./core');
let n = 0; const t = (name, fn) => { fn(); console.log('OK', name); n++; };
const mk = () => { const D = open(':memory:'); D.setupAdmin('admin', '1234'); const adminId = D.db.prepare('SELECT id FROM users WHERE is_admin=1').get().id;
  const u = D.register(D.newInvite(), 'pepe', '1234'); const v = D.register(D.newInvite(), 'otro', '1234');
  const bank = () => D.db.prepare('SELECT * FROM bank WHERE user_id=?').get(u); const coins = () => D.db.prepare('SELECT coins FROM users WHERE id=?').get(u).coins;
  // win a custom line: profit p => repay floor(p/2)
  const win = (stake, odds) => { const l = D.createLine('X', [{ label: 'A', odds }, { label: 'B', odds: -110 }]); const o = D.lines().find(x => x.id === l).options[0];
    D.placeBet(u, o.id, stake); D.settleLine(l, o.id); return l; };
  return { D, adminId, u, v, bank, coins, win }; };
t('2 loans: manual full pay returns 14 once, count stays 2; second pay rejected (no double debit)', () => {
  const { D, u, bank, coins } = mk(); D.takeLoan(u, 100); D.takeLoan(u, 100); const c = coins();
  D.payDebtFull(u); assert.deepEqual([bank().debt, bank().loan_penalty, bank().loans, coins()], [0, 0, 2, c - 200]);
  assert.throws(() => D.payDebtFull(u), /No tienes deuda/); assert.equal(coins(), c - 200);
  assert.equal(D.db.prepare("SELECT COUNT(*) c FROM bank_ledger WHERE kind='penalty_refund'").get().c, 2);
});
t('full pay with 5 loans: bank closed for new loans but repayment allowed; 6th loan still blocked', () => {
  const { D, u, bank } = mk(); for (let i = 0; i < 5; i++) D.takeLoan(u, 10); D.payDebtFull(u);
  assert.deepEqual([bank().debt, bank().loan_penalty, bank().loans], [0, 0, 5]); assert.throws(() => D.takeLoan(u, 1), /5 préstamos/);
});
t('bankruptcy forgives without +7 refunds; later loans start fresh; no double credit', () => {
  const { D, u, bank } = mk(); D.takeLoan(u, 100); D.takeLoan(u, 100); D.declareBankruptcy(u);
  assert.equal(bank().loan_penalty, 0); assert.equal(D.db.prepare("SELECT COUNT(*) c FROM bank_ledger WHERE kind='penalty_refund'").get().c, 0);
  assert.equal(D.db.prepare("SELECT COUNT(*) c FROM bank_loans WHERE status='forgiven'").get().c, 2);
  D.takeLoan(u, 10); D.payDebtFull(u); assert.equal(bank().loan_penalty, 0); assert.equal(D.bankPenalty(u), BANK.MARK_PENALTY);
});
t('winning settlement never touches debt and cannot be replayed', () => {
  const { D, u, bank, win } = mk(); D.takeLoan(u, 50); const l = win(100, 100); assert.equal(bank().debt, 50);
  const snap = JSON.stringify([bank(), D.db.prepare('SELECT * FROM bank_ledger').all()]);
  assert.throws(() => D.settleLine(l, D.lines().find(x => x.id === l).options[0].id)); assert.equal(JSON.stringify([bank(), D.db.prepare('SELECT * FROM bank_ledger').all()]), snap);
});
t('migration: provable ledger => FIFO refunds; boundaries respected; unprovable debt>0 untouched; debt 0 cleared; idempotent; balances unchanged', () => {
  const D = open(':memory:'); D.setupAdmin('admin', '1234'); const ids = ['aa', 'bb', 'cc', 'dd'].map(x => D.register(D.newInvite(), x, '1234'));
  D.db.exec("DELETE FROM bank_loans; DELETE FROM bank_meta;"); const L = (u, k, amt, d) => D.db.prepare('INSERT INTO bank_ledger(user_id,kind,amount,debt_after,ts) VALUES(?,?,?,?,1)').run(u, k, amt, d);
  const B = (u, debt, loans, pen) => D.db.prepare('INSERT INTO bank(user_id,debt,loans,loan_penalty) VALUES(?,?,?,?)').run(u, debt, loans, pen);
  // a: old cycle then bankruptcy; new cycle 2 loans of 100, repaid 130 => loan1 paid
  L(ids[0], 'loan', 999, 999); L(ids[0], 'bankruptcy', 999, 0); L(ids[0], 'loan', 100, 100); L(ids[0], 'loan', 100, 200); L(ids[0], 'repay', 130, 70); B(ids[0], 70, 2, 14);
  L(ids[1], 'loan', 100, 100); B(ids[1], 40, 1, 7); // unprovable (no repay record but debt 40)
  L(ids[2], 'loan', 100, 100); B(ids[2], 0, 1, 7);  // debt 0 without matching repay record
  L(ids[3], 'loan', 100, 100); L(ids[3], 'repay', 30, 70); B(ids[3], 70, 1, 7);
  const coins = JSON.stringify(D.db.prepare('SELECT coins FROM users').all());
  D.db.close; const fs = require('node:fs'), f = '/tmp/mig-test.db'; try { fs.unlinkSync(f); } catch {}
  D.db.exec(`VACUUM INTO '${f}'`); const R = open(f), R2 = () => open(f); const pen = u => ({ ...R.db.prepare('SELECT loan_penalty, debt FROM bank WHERE user_id=?').get(u) });
  assert.deepEqual(pen(ids[0]), { loan_penalty: 7, debt: 70 }); assert.deepEqual(pen(ids[1]), { loan_penalty: 7, debt: 40 }); assert.deepEqual(pen(ids[2]), { loan_penalty: 0, debt: 0 }); assert.deepEqual(pen(ids[3]), { loan_penalty: 7, debt: 70 });
  assert.equal(R.db.prepare("SELECT remaining FROM bank_loans WHERE user_id=? AND status='open'").get(ids[0]).remaining, 70);
  assert.equal(R.db.prepare("SELECT remaining FROM bank_loans WHERE user_id=?").get(ids[3]).remaining, 70);
  assert.equal(JSON.stringify(R.db.prepare('SELECT coins FROM users').all()), coins);
  const rep = JSON.parse(R.db.prepare("SELECT value FROM bank_meta WHERE key='loans_v1'").get().value); assert.equal(rep.find(r => r.user === ids[1]).mode, 'legacy_bucket'); assert.equal(R.db.prepare('SELECT legacy_debt FROM bank WHERE user_id=?').get(ids[1]).legacy_debt, 40);
  const ledgerN = R.db.prepare('SELECT COUNT(*) c FROM bank_ledger').get().c; const R3 = R2(); assert.equal(R3.db.prepare('SELECT COUNT(*) c FROM bank_ledger').get().c, ledgerN); fs.unlinkSync(f);
});
t('screenshot fixture: saldo 680000, deuda 225000, 5/5 loans, -21 (legacy) -> 455000, deuda 0, penalty 0 once; mark/pending kept', () => {
  const { D, u, bank, coins } = mk(); const mark = Date.now() + 1e9;
  D.db.prepare('UPDATE users SET coins=680000 WHERE id=?').run(u);
  D.db.prepare('INSERT OR REPLACE INTO bank(user_id,debt,loans,loan_penalty,legacy_debt,legacy_penalty,mark_until) VALUES(?,?,?,?,?,?,?)').run(u, 225000, 5, 21, 225000, 21, mark);
  const l = D.createLine('P', [{ label: 'A', odds: 100 }, { label: 'B', odds: -110 }]); D.placeBet(u, D.lines().find(x => x.id === l).options[0].id, 1000);
  D.db.prepare('UPDATE users SET coins=680000 WHERE id=?').run(u);
  assert.equal(D.bankStatus(u).canPayFull, true); assert.equal(D.bankStatus(u).state, 'closed_until_bankruptcy');
  assert.throws(() => D.payDebtFull(u, 224999), /cambió/); assert.equal(coins(), 680000);
  const s = D.payDebtFull(u, 225000); assert.equal(coins(), 455000); assert.deepEqual([bank().debt, bank().loan_penalty, bank().loans, bank().mark_until], [0, 0, 5, mark]);
  assert.equal(s.state, 'closed_until_bankruptcy'); assert.throws(() => D.takeLoan(u, 1), /5 préstamos/);
  assert.equal(D.db.prepare("SELECT SUM(amount) s FROM bank_ledger WHERE kind='penalty_refund'").get().s, 21);
  assert.equal(D.db.prepare("SELECT status FROM bets WHERE user_id=?").get(u).status, 'open');
  assert.throws(() => D.payDebtFull(u, 225000), /No tienes deuda/); assert.equal(coins(), 455000); // double tap
});
t('insufficient balance rejected with nothing changed; bad expectedDebt rejected', () => {
  const { D, u, bank, coins } = mk(); D.takeLoan(u, 1000); D.db.prepare('UPDATE users SET coins=999 WHERE id=?').run(u);
  assert.equal(D.bankStatus(u).canPayFull, false); assert.throws(() => D.payDebtFull(u), /saldo suficiente/); assert.deepEqual([coins(), bank().debt, bank().loan_penalty], [999, 1000, 7]);
  assert.throws(() => D.payDebtFull(u, 'x'), /cambió/);
  const v = D.register(D.newInvite(), 'nodebt', '1234'); assert.throws(() => D.payDebtFull(v), /No tienes deuda/);
});
t('server: /api/bank/pay requires auth and sends no client amount', () => { const src = require('node:fs').readFileSync(__dirname + '/server.js', 'utf8');
  assert.ok(src.includes("app.post('/api/bank/pay', h(r => C.payDebtFull(auth(r).id, r.body.expectedDebt)));"));
  const app = require('node:fs').readFileSync(__dirname + '/public/app.js', 'utf8'); assert.ok(app.includes("api('/bank/pay', { expectedDebt: b.debt })") && !app.includes('el 50% de tu ganancia'));
});
console.log(n, 'loan refund tests passed');
