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
t('2 loans, first fully repaid returns 7 (not 14); count stays 2; partial does not refund', () => {
  const { D, u, bank, win } = mk(); D.takeLoan(u, 100); D.takeLoan(u, 100); assert.equal(bank().loan_penalty, 14);
  win(100, 100); // profit 100 -> repay 50 (partial)
  assert.equal(bank().debt, 150); assert.equal(bank().loan_penalty, 14);
  win(100, 100); // repay 50 -> loan 1 paid
  assert.equal(bank().debt, 100); assert.equal(bank().loan_penalty, 7); assert.equal(bank().loans, 2); assert.equal(D.bankPenalty(u), 7);
  assert.equal(D.db.prepare("SELECT COUNT(*) c FROM bank_ledger WHERE kind='penalty_refund'").get().c, 1);
});
t('repaying total debt clears all loan penalties; count still blocks 6th loan', () => {
  const { D, u, bank, win } = mk(); for (let i = 0; i < 5; i++) D.takeLoan(u, 10); assert.equal(bank().loan_penalty, 35);
  win(200, 100); // repay min(50,100) = 50
  assert.equal(bank().debt, 0); assert.equal(bank().loan_penalty, 0); assert.equal(bank().loans, 5); assert.throws(() => D.takeLoan(u, 1), /5 préstamos/);
});
t('bankruptcy forgives without +7 refunds; later loans start fresh; no double credit', () => {
  const { D, u, bank, win } = mk(); D.takeLoan(u, 100); D.takeLoan(u, 100); win(100, 100); D.declareBankruptcy(u);
  assert.equal(bank().loan_penalty, 0); assert.equal(D.db.prepare("SELECT COUNT(*) c FROM bank_ledger WHERE kind='penalty_refund'").get().c, 0);
  assert.equal(D.db.prepare("SELECT COUNT(*) c FROM bank_loans WHERE status='forgiven'").get().c, 2);
  D.takeLoan(u, 10); win(20, 100); // repay 10
  assert.equal(bank().loan_penalty, 0); assert.equal(D.bankPenalty(u), BANK.MARK_PENALTY);
});
t('settled winning cannot be replayed (no second repay / refund)', () => {
  const { D, u, bank, win } = mk(); D.takeLoan(u, 50); const l = win(100, 100); const snap = JSON.stringify([bank(), D.db.prepare('SELECT * FROM bank_ledger').all()]);
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
  const rep = JSON.parse(R.db.prepare("SELECT value FROM bank_meta WHERE key='loans_v1'").get().value); assert.equal(rep.find(r => r.user === ids[1]).mode, 'unchanged_unprovable');
  const ledgerN = R.db.prepare('SELECT COUNT(*) c FROM bank_ledger').get().c; const R3 = R2(); assert.equal(R3.db.prepare('SELECT COUNT(*) c FROM bank_ledger').get().c, ledgerN); fs.unlinkSync(f);
});
console.log(n, 'loan refund tests passed');
