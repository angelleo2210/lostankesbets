const { DatabaseSync } = require('node:sqlite');
const crypto = require('node:crypto');
const Markets = require('./public/markets');
const Sgp = require('./public/sgp');
const AV = require('./public/avatar'); const ST = require('./public/store');
const START_COINS = 50000; const BONUS = 5000, BONUS_MS = 24 * 3600 * 1000; const MAX_TOPUP = 10000000;
const PODIUM_MIN_SETTLED = 0; // owner t628: sin mínimo de apuestas para el top 3

function profit(stake, odds) {
  odds = Number(odds);
  if (!Number.isFinite(odds) || (odds > -100 && odds < 100)) throw new Error('Cuota inválida (use p.ej. -250 o +880)');
  return Math.floor(odds > 0 ? stake * odds / 100 : stake * 100 / -odds);
}

const dec = o => (o > 0 ? 1 + o / 100 : 1 + 100 / -o);
// Snapshot pricing: each group (one match) pays its frozen decimal; any voided leg in a group voids that group (1.00).
function modeledFactor(p, legs) {
  const st = new Map(legs.map(g => [g.option_id, g.status])); let d = 1, live = 0;
  for (const g of JSON.parse(p.pricing).groups) { if (g.options.some(o => st.get(o) === 'cancelled')) continue; d *= g.dec; live++; }
  return { d, live };
}
function toAmerican(d) { return d >= 2 ? Math.round((d - 1) * 100) : Math.round(-100 / (d - 1)); }

// Recompensas top 3 (sin admin). minRank: rango máximo requerido (1 = solo el primero).
// Política: un ítem desbloqueado se CONSERVA para siempre como trofeo (tabla unlocks);
// Para calificar hay que tener más de las 50.000 monedas iniciales (evita premios por empate inicial).
// la insignia 🥇🥈🥉 se calcula en vivo y solo se muestra mientras sigues en el top 3.
const REWARDS = [
  { id: 'corona', kind: 'hat', name: 'Corona', icon: '👑', minRank: 1 },
  { id: 'sombrero_dorado', kind: 'hat', name: 'Sombrero dorado', icon: '🎩', minRank: 2 },
  { id: 'gorra_campeon', kind: 'hat', name: 'Gorra de campeón', icon: '🧢', minRank: 3 },
  { id: 'oro', kind: 'color', name: 'Oro metálico', color: '#d4af37', minRank: 1 },
  { id: 'plata', kind: 'color', name: 'Plata metálica', color: '#c0c0c0', minRank: 2 },
  { id: 'bronce', kind: 'color', name: 'Bronce metálico', color: '#cd7f32', minRank: 3 },
  { id: 'diamante', kind: 'accessory', name: 'Diamante', icon: '💎', minRank: 1 },
  { id: 'trofeo', kind: 'accessory', name: 'Trofeo', icon: '🏆', minRank: 2 },
  { id: 'medalla', kind: 'accessory', name: 'Medalla', icon: '🎖️', minRank: 3 },
  { id: 'camiseta_dorada', kind: 'outfit', name: 'Camiseta dorada', icon: '👕', minRank: 1 },
  { id: 'pantalon_dorado', kind: 'outfit', name: 'Pantalón dorado', icon: '👖', minRank: 1 },
  { id: 'medias_doradas', kind: 'outfit', name: 'Medias doradas', icon: '🧦', minRank: 2 },
  { id: 'zapatos_oro', kind: 'outfit', name: 'Zapaticos de oro', icon: '👟', minRank: 1 },
  { id: 'zapatos_plata', kind: 'outfit', name: 'Zapaticos de plata', icon: '👟', minRank: 2 },
  { id: 'zapatos_bronce', kind: 'outfit', name: 'Zapaticos de bronce', icon: '👟', minRank: 3 },
];
const BADGES = { 1: '🥇', 2: '🥈', 3: '🥉' };
// Orden de ranking (owner): más puntos (pueden ser negativos), luego mejor % de victoria, luego más dinero; nombre solo si todo empata.
const winPct = (w, l) => (w + l) ? Math.round(w * 1000 / (w + l)) / 10 : 0;
const rankCmp = (a, b) => b.points - a.points || b.winPct - a.winPct || b.coins - a.coins || a.username.localeCompare(b.username);
const FACIAL = ['ninguno', 'bigote', 'barba_corta', 'barba_larga', 'candado', 'perilla', 'patillas'];
const deco = (r, id, rk) => { if (!r) return r; const { cosmetics, avatar_cfg, ...o } = fhOut(r); let c = {}, ac = null; try { c = cosmetics ? JSON.parse(cosmetics) : {}; } catch {} try { ac = avatar_cfg ? JSON.parse(avatar_cfg) : null; } catch {}
  const rank = rk && rk.get(id) || null; return { ...o, avatarCfg: AV.norm(ac), cosmetics: c, rank, badge: rank ? BADGES[rank] : null }; };
const fhOut = r => { if (!r) return r; const { facial_hair, ...o } = r; let f = null; try { f = facial_hair ? JSON.parse(facial_hair) : null; } catch {} return { ...o, facialHair: f }; };
function hash(pin, salt = crypto.randomBytes(16).toString('hex')) {
  return { salt, hash: crypto.scryptSync(String(pin), salt, 32).toString('hex') };
}

const PEN = ['izquierda', 'centro', 'derecha'], PEN_MS = 24 * 3600e3, PEN_ROUNDS = 5;
// Béisbol de una entrada: cada jugador manda una vez 15 lanzamientos (bola/strike) y 15 decisiones (swing/no).
const BB_N = 15, BB_EXTRA = 15;
const BB_OUTS = 3; // TRES outs terminan la media entrada; cada strike es un out (no hay cuenta de strikes aparte)
const BB_OUTS_SCOPE = 'jugador'; // 'jugador' = 3 outs por media entrada de cada uno. Único lugar a cambiar si se decide otra cosa.
const bbHalf = (pitch, bat, off = 0) => { let runs = 0, balls = 0, outs = 0; const ev = [];
  for (let i = 0; i < BB_N; i++) { const p = pitch[(i + off) % BB_N], b = bat[(i + off) % BB_N]; let e;
    if (p === 'strike' && b === 'swing') { runs++; e = 'jonron'; } // jonrón: +1, no es out
    else if (p === 'strike') { outs++; balls = 0; e = 'ponche'; } // strike sin swing = out
    else if (b === 'swing') { outs++; balls = 0; e = 'out'; } // el out reinicia las bolas // swing a bola = strike = out
    else { balls++; e = 'bola'; if (balls >= 4) { runs++; balls = 0; e = 'base'; } } // 4 bolas = +1, contador a 0
    ev.push({ p, b, e, runs, balls, outs }); if (outs >= BB_OUTS) break; }
  return { runs, ev }; };
const bbGame = (cp, op) => { const innings = []; let c = 0, o = 0;
  for (let k = 0; k <= BB_EXTRA; k++) { const top = bbHalf(op.pitch, cp.bat, k), bot = bbHalf(cp.pitch, op.bat, k); c += top.runs; o += bot.runs; innings.push({ n: k + 1, top, bot });
    if (c !== o) break; }
  return { c, o, innings }; };
const RPS = ['piedra', 'papel', 'tijera'], BEATS = { piedra: 'tijera', tijera: 'papel', papel: 'piedra' }, RPS_MIN = 10, RPS_MAX = 25000, RPS_MS = 24 * 3600e3;
// Nuevos retos bloqueados (pen/bb/tc); respond/play/expire siguen por monedas legacy.
const DISABLED_NEW_MINIGAMES = new Set(['pen', 'bb', 'tc']);
// Banco (monedas de juego). Owner-confirmed: -7 ranking points per loan, -20 while a bankruptcy mark is active (1 calendar month, New York).
const BANK = { MAX_LOAN: 100000, MAX_LOANS: 5, MAX_BANKRUPTCIES: 5, LOAN_PENALTY: 7, MARK_PENALTY: 20, MAX_ADMIN_RESETS: 1, TZ: 'America/New_York' };
// Same wall-clock time one calendar month later in America/New_York (day clamped to month end).
function addMonthNY(ms) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: BANK.TZ, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });
  const parts = t => Object.fromEntries(f.formatToParts(new Date(t)).filter(x => x.type !== 'literal').map(x => [x.type, Number(x.value)]));
  const p = parts(ms); let y = p.year, m = p.month + 1; if (m > 12) { m = 1; y++; }
  const d = Math.min(p.day, new Date(Date.UTC(y, m, 0)).getUTCDate());
  const want = Date.UTC(y, m - 1, d, p.hour, p.minute, p.second); let t = want;
  for (let i = 0; i < 3; i++) { const q = parts(t); t += want - Date.UTC(q.year, q.month - 1, q.day, q.hour, q.minute, q.second); }
  return t + (ms % 1000);
}
function open(file = 'data.db') {
  const db = new DatabaseSync(file);
  db.exec(`PRAGMA foreign_keys=ON;
  CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, username TEXT UNIQUE COLLATE NOCASE, pin_hash TEXT, salt TEXT, coins INTEGER, is_admin INTEGER DEFAULT 0);
  CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id INTEGER);
  CREATE TABLE IF NOT EXISTS invites(code TEXT PRIMARY KEY, used_by INTEGER);
  CREATE TABLE IF NOT EXISTS lines(id INTEGER PRIMARY KEY, title TEXT, kind TEXT DEFAULT 'custom', status TEXT DEFAULT 'open', winner INTEGER, event_id TEXT, starts TEXT, created TEXT DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS options(id INTEGER PRIMARY KEY, line_id INTEGER, label TEXT, odds INTEGER);
  CREATE TABLE IF NOT EXISTS bets(id INTEGER PRIMARY KEY, user_id INTEGER, line_id INTEGER, option_id INTEGER, stake INTEGER, odds INTEGER, status TEXT DEFAULT 'open', payout INTEGER DEFAULT 0, created TEXT DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS parlays(id INTEGER PRIMARY KEY, user_id INTEGER, stake INTEGER, status TEXT DEFAULT 'open', payout INTEGER DEFAULT 0, created TEXT DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS parlay_legs(id INTEGER PRIMARY KEY, parlay_id INTEGER, line_id INTEGER, option_id INTEGER, odds INTEGER, status TEXT DEFAULT 'open');`);
  db.exec('CREATE TABLE IF NOT EXISTS topups(id INTEGER PRIMARY KEY, user_id INTEGER, admin_id INTEGER, amount INTEGER, created TEXT DEFAULT CURRENT_TIMESTAMP)');
  db.exec('CREATE TABLE IF NOT EXISTS unlocks(user_id INTEGER, item_id TEXT, rank INTEGER, created TEXT DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(user_id, item_id))');
  db.exec('CREATE TABLE IF NOT EXISTS pen(id INTEGER PRIMARY KEY, challenger INTEGER, opponent INTEGER, stake INTEGER, status TEXT, created INTEGER, round_start INTEGER, winner INTEGER, reason TEXT, resolved INTEGER)');
  db.exec('CREATE TABLE IF NOT EXISTS pen_rounds(game_id INTEGER, n INTEGER, c_shot TEXT, c_save TEXT, o_shot TEXT, o_save TEXT, c_goal INTEGER, o_goal INTEGER, PRIMARY KEY(game_id, n))');
  db.exec('CREATE TABLE IF NOT EXISTS tc(id INTEGER PRIMARY KEY, challenger INTEGER, opponent INTEGER, stake INTEGER, status TEXT, created INTEGER, accepted_at INTEGER, c_st TEXT, o_st TEXT, winner INTEGER, reason TEXT, extra TEXT, resolved INTEGER)');
  db.exec('CREATE TABLE IF NOT EXISTS bb(id INTEGER PRIMARY KEY, challenger INTEGER, opponent INTEGER, stake INTEGER, status TEXT, created INTEGER, accepted_at INTEGER, c_plan TEXT, o_plan TEXT, winner INTEGER, reason TEXT, result TEXT, resolved INTEGER)');
  db.exec('CREATE TABLE IF NOT EXISTS rps(id INTEGER PRIMARY KEY, challenger INTEGER, opponent INTEGER, stake INTEGER, status TEXT, c_pick TEXT, o_pick TEXT, winner INTEGER, created INTEGER, resolved INTEGER)');
  const ucols = db.prepare('PRAGMA table_info(users)').all().map(c => c.name);
  if (!ucols.includes('avatar')) db.exec('ALTER TABLE users ADD COLUMN avatar TEXT');
  if (!ucols.includes('display_name')) db.exec('ALTER TABLE users ADD COLUMN display_name TEXT');
  if (!ucols.includes('avatar_cfg')) db.exec('ALTER TABLE users ADD COLUMN avatar_cfg TEXT');
  if (!ucols.includes('cosmetics')) db.exec('ALTER TABLE users ADD COLUMN cosmetics TEXT');
  for (const [c, t] of [['pricing', 'TEXT'], ['odds_dec', 'REAL']]) if (!db.prepare('PRAGMA table_info(parlays)').all().some(x => x.name === c)) db.exec(`ALTER TABLE parlays ADD COLUMN ${c} ${t}`);
  if (!db.prepare('PRAGMA table_info(parlays)').all().some(c => c.name === 'same_event')) db.exec('ALTER TABLE parlays ADD COLUMN same_event INTEGER DEFAULT 0');
  for (const t of ['bets', 'parlays']) if (!db.prepare(`PRAGMA table_info(${t})`).all().some(c => c.name === 'ts')) db.exec(`ALTER TABLE ${t} ADD COLUMN ts INTEGER`);
  let tick = 0; const now = () => Date.now() * 1000 + (tick++ % 1000);
  if (!ucols.includes('last_bonus')) db.exec('ALTER TABLE users ADD COLUMN last_bonus INTEGER');
  if (!ucols.includes('facial_hair')) db.exec('ALTER TABLE users ADD COLUMN facial_hair TEXT');
  db.exec('CREATE TABLE IF NOT EXISTS purchases(user_id INTEGER, item_id TEXT, price INTEGER, color TEXT, created TEXT DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(user_id, item_id))');
  if (!db.prepare('PRAGMA table_info(purchases)').all().some(c => c.name === 'color')) db.exec('ALTER TABLE purchases ADD COLUMN color TEXT');
  // Additive migration: legacy lines remain market=NULL.
  for (const [table, cols] of Object.entries({ lines: { market: 'TEXT', home: 'TEXT', away: 'TEXT', unit: 'TEXT', bookmaker: 'TEXT', sport: 'TEXT' }, options: { point: 'REAL', outcome: 'TEXT' } })) {
    const existing = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
    for (const [col, type] of Object.entries(cols)) if (!existing.includes(col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
  }
  let txN = 0; const tx = fn => { const sp = 'tx' + (++txN); db.exec(`SAVEPOINT ${sp}`); try { const r = fn(); db.exec(`RELEASE ${sp}`); return r; } catch (e) { db.exec(`ROLLBACK TO ${sp}; RELEASE ${sp}`); throw e; } };
  const err = m => { const e = new Error(m); e.user = true; throw e; };
  const getCfg = uid => { try { return AV.norm(JSON.parse(db.prepare('SELECT avatar_cfg FROM users WHERE id=?').get(uid)?.avatar_cfg || 'null')); } catch { return AV.norm(null); } };
  const editWear = () => {}; // avatar estático: ya no hay wear por capas
  // Migración: la Gorra antigua (acc_gorra) pasa a la Gorra Casual nueva; si ya la tenía, se devuelve lo pagado. Sin pérdidas.
  tx(() => { for (const o of db.prepare("SELECT user_id, price FROM purchases WHERE item_id='acc_gorra'").all()) {
    if (db.prepare("SELECT 1 FROM purchases WHERE user_id=? AND item_id='head_gorra_casual'").get(o.user_id)) { db.prepare("DELETE FROM purchases WHERE user_id=? AND item_id='acc_gorra'").run(o.user_id); db.prepare('UPDATE users SET coins=coins+? WHERE id=?').run(o.price || 0, o.user_id); }
    else db.prepare("UPDATE purchases SET item_id='head_gorra_casual' WHERE user_id=? AND item_id='acc_gorra'").run(o.user_id); } });
  db.exec(`CREATE TABLE IF NOT EXISTS bank(user_id INTEGER PRIMARY KEY, debt INTEGER NOT NULL DEFAULT 0, loans INTEGER NOT NULL DEFAULT 0, loan_penalty INTEGER NOT NULL DEFAULT 0, bankruptcies INTEGER NOT NULL DEFAULT 0, mark_until INTEGER, closed INTEGER NOT NULL DEFAULT 0, admin_resets INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS bank_ledger(id INTEGER PRIMARY KEY, user_id INTEGER, kind TEXT, amount INTEGER, debt_after INTEGER, ref TEXT, admin_id INTEGER, ts INTEGER);`);
  db.exec('CREATE TABLE IF NOT EXISTS paused_events(key TEXT PRIMARY KEY, admin_id INTEGER, ts INTEGER)');
  // Per-loan records: outstanding balance + whether its -7 ranking penalty is still active. Loan COUNT (max 5) stays in bank.loans.
  db.exec(`CREATE TABLE IF NOT EXISTS bank_loans(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, amount INTEGER NOT NULL, remaining INTEGER NOT NULL, penalty_active INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT 'open', ledger_id INTEGER UNIQUE, ts INTEGER, closed_ts INTEGER, closed_by TEXT);
    CREATE TABLE IF NOT EXISTS bank_meta(key TEXT PRIMARY KEY, value TEXT, ts INTEGER);`);
  // Unprovable pre-migration debt/penalty kept as one older "legacy" bucket (paid first, refunded only when fully paid).
  for (const c of ['legacy_debt', 'legacy_penalty']) { try { db.exec(`ALTER TABLE bank ADD COLUMN ${c} INTEGER NOT NULL DEFAULT 0`); } catch {} }
  // Match key: linked markets share kind:event_id; legacy unlinked lines pause individually.
  const eventKey = l => l.event_id ? `${l.kind}:${l.event_id}` : `line:${l.line_id ?? l.id}`;
  const PAUSED_MSG = 'Las apuestas para este partido están pausadas por el administrador.';
  const isPaused = l => !!db.prepare('SELECT 1 FROM paused_events WHERE key=?').get(eventKey(l));
  // Auto-close at the stored match start (server clock, checked on every wager request). Only blocks NEW wagers;
  // accepted bets/parlays are never voided or refunded by this. Lines without a stored start have no timed lock.
  const STARTED_MSG = 'El partido ya empezó; no se aceptan apuestas nuevas.';
  const startMs = l => { if (!l || !l.starts) return null; const t = Date.parse(l.starts); return Number.isFinite(t) ? t : null; };
  const hasStarted = (l, t = Date.now()) => { const s = startMs(l); return s != null && t >= s; };
  const SPORTS = ['soccer', 'hockey', 'baseball', 'other'];
  const sportOf = e => { const k = String(e.sport_key || ''); if (/^soccer_/.test(k)) return 'soccer'; if (/^icehockey_/.test(k)) return 'hockey'; if (/^baseball_/.test(k)) return 'baseball'; return SPORTS.includes(e.sport) ? e.sport : null; };
  const bankRow = uid => { db.prepare('INSERT OR IGNORE INTO bank(user_id) VALUES(?)').run(uid); return db.prepare('SELECT * FROM bank WHERE user_id=?').get(uid); };
  const ledger = (uid, kind, amount, debtAfter, ref, adminId = null) => Number(db.prepare('INSERT INTO bank_ledger(user_id,kind,amount,debt_after,ref,admin_id,ts) VALUES(?,?,?,?,?,?,?)').run(uid, kind, amount, debtAfter, ref, adminId, Date.now()).lastInsertRowid);
  // Winning credit (bets, parlays, challenges): full payout to the player. No automatic bank collection
  // (owner: repayment is manual only). Historic 'repay' ledger rows from the old automatic 50% stay as they were.
  const winCredit = (uid, payout) => { db.prepare('UPDATE users SET coins=coins+? WHERE id=?').run(payout, uid); };
  // FIFO: a repayment pays the oldest open loan first. A loan paid in full gives back its 7 points exactly once.
  const applyRepay = (uid, amount, ref) => { let left = amount;
    const bk = db.prepare('SELECT legacy_debt, legacy_penalty FROM bank WHERE user_id=?').get(uid);
    if (bk && bk.legacy_debt > 0) { const pay = Math.min(left, bk.legacy_debt); left -= pay; db.prepare('UPDATE bank SET legacy_debt=legacy_debt-? WHERE user_id=?').run(pay, uid);
      if (pay === bk.legacy_debt && bk.legacy_penalty > 0) { const p = Math.min(bk.legacy_penalty, db.prepare('SELECT loan_penalty FROM bank WHERE user_id=?').get(uid).loan_penalty);
        db.prepare('UPDATE bank SET loan_penalty=MAX(0, loan_penalty-?), legacy_penalty=0 WHERE user_id=?').run(p, uid);
        if (p) ledger(uid, 'penalty_refund', p, db.prepare('SELECT debt FROM bank WHERE user_id=?').get(uid).debt, 'préstamos anteriores pagados'); } }
    for (const L of db.prepare("SELECT * FROM bank_loans WHERE user_id=? AND status='open' ORDER BY id").all(uid)) { if (left <= 0) break;
      const pay = Math.min(left, L.remaining); left -= pay;
      if (pay < L.remaining) { db.prepare('UPDATE bank_loans SET remaining=remaining-? WHERE id=?').run(pay, L.id); continue; }
      db.prepare("UPDATE bank_loans SET remaining=0, status='paid', closed_ts=?, closed_by=?, penalty_active=0 WHERE id=? AND status='open'").run(Date.now(), String(ref || 'repay'), L.id);
      if (L.penalty_active) { db.prepare('UPDATE bank SET loan_penalty=MAX(0, loan_penalty-?) WHERE user_id=?').run(BANK.LOAN_PENALTY, uid);
        const d = db.prepare('SELECT debt FROM bank WHERE user_id=?').get(uid).debt; ledger(uid, 'penalty_refund', BANK.LOAN_PENALTY, d, `loan#${L.id}`); } }
    // Safety net: actual total debt 0 => no loan penalty may remain (mark and loan count untouched).
    const z = db.prepare('SELECT debt, loan_penalty FROM bank WHERE user_id=?').get(uid);
    if (z.debt === 0) { db.prepare("UPDATE bank_loans SET remaining=0, status='paid', penalty_active=0, closed_ts=?, closed_by='deuda total pagada' WHERE user_id=? AND status='open'").run(Date.now(), uid);
      db.prepare('UPDATE bank SET legacy_debt=0, legacy_penalty=0, loan_penalty=0 WHERE user_id=?').run(uid);
      if (z.loan_penalty > 0) ledger(uid, 'penalty_refund', z.loan_penalty, 0, 'deuda total pagada'); } };
  // Bankruptcy / admin fresh start: open loans forgiven, penalty dropped WITHOUT any +7 refund (the reset already clears loan_penalty).
  const forgiveLoans = (uid, why) => db.prepare('UPDATE bank SET legacy_debt=0, legacy_penalty=0 WHERE user_id=?').run(uid) && db.prepare("UPDATE bank_loans SET status='forgiven', penalty_active=0, closed_ts=?, closed_by=? WHERE user_id=? AND status='open'").run(Date.now(), why, uid);
  // One-time, idempotent migration from the existing ledger. Per user, only entries after the last bankruptcy/fresh start count.
  // Per-loan FIFO only when the ledger provably matches the current debt; otherwise: debt 0 => clear loan penalty; debt > 0 => untouched (reported).
  const migrateLoans = () => { if (db.prepare("SELECT 1 FROM bank_meta WHERE key='loans_v1'").get()) return; const report = [];
    tx(() => { for (const b of db.prepare('SELECT * FROM bank').all()) {
      if (db.prepare('SELECT 1 FROM bank_loans WHERE user_id=?').get(b.user_id)) continue;
      const all = db.prepare('SELECT * FROM bank_ledger WHERE user_id=? ORDER BY id').all(b.user_id); let start = 0;
      all.forEach((e, i) => { if (e.kind === 'bankruptcy' || e.kind === 'fresh_start') start = i + 1; });
      const cyc = all.slice(start), loans = cyc.filter(e => e.kind === 'loan'), repaid = cyc.filter(e => e.kind === 'repay').reduce((s, e) => s + e.amount, 0);
      if (!loans.length) continue; const owed = loans.reduce((s, e) => s + e.amount, 0);
      if (loans.length === b.loans && owed - repaid === b.debt && b.loan_penalty === loans.length * BANK.LOAN_PENALTY) {
        let left = repaid, refunds = 0;
        for (const e of loans) { const pay = Math.min(left, e.amount); left -= pay; const done = pay === e.amount;
          const id = Number(db.prepare('INSERT INTO bank_loans(user_id,amount,remaining,penalty_active,status,ledger_id,ts,closed_ts,closed_by) VALUES(?,?,?,?,?,?,?,?,?)').run(b.user_id, e.amount, e.amount - pay, done ? 0 : 1, done ? 'paid' : 'open', e.id, e.ts, done ? Date.now() : null, done ? 'migration' : null).lastInsertRowid);
          if (done) { refunds++; ledger(b.user_id, 'penalty_refund', BANK.LOAN_PENALTY, b.debt, `loan#${id} (migración)`); } }
        if (refunds) db.prepare('UPDATE bank SET loan_penalty=loan_penalty-? WHERE user_id=?').run(refunds * BANK.LOAN_PENALTY, b.user_id);
        report.push({ user: b.user_id, mode: 'per_loan', refunds });
      } else if (b.debt === 0 && b.loan_penalty > 0) {
        db.prepare('UPDATE bank SET loan_penalty=0 WHERE user_id=?').run(b.user_id); ledger(b.user_id, 'penalty_refund', b.loan_penalty, 0, 'deuda total pagada (migración)');
        for (const e of loans) db.prepare("INSERT OR IGNORE INTO bank_loans(user_id,amount,remaining,penalty_active,status,ledger_id,ts,closed_ts,closed_by) VALUES(?,?,0,0,'paid',?,?,?,'migration-total')").run(b.user_id, e.amount, e.id, e.ts, Date.now());
        report.push({ user: b.user_id, mode: 'debt_zero_clear', cleared: b.loan_penalty });
      } else { db.prepare('UPDATE bank SET legacy_debt=debt, legacy_penalty=loan_penalty WHERE user_id=?').run(b.user_id); report.push({ user: b.user_id, mode: 'legacy_bucket', debt: b.debt, loans: b.loans }); }
    }
    db.prepare("INSERT INTO bank_meta(key,value,ts) VALUES('loans_v1',?,?)").run(JSON.stringify(report), Date.now()); }); };
  migrateLoans();
  // v2 (idempotent): users left unprovable by v1 (no per-loan rows, still owing) get the legacy bucket.
  if (!db.prepare("SELECT 1 FROM bank_meta WHERE key='loans_v2'").get()) tx(() => { const done = [];
    for (const b of db.prepare('SELECT * FROM bank WHERE debt>0 AND legacy_debt=0 AND loan_penalty>0').all())
      if (!db.prepare('SELECT 1 FROM bank_loans WHERE user_id=?').get(b.user_id)) { db.prepare('UPDATE bank SET legacy_debt=debt, legacy_penalty=loan_penalty WHERE user_id=?').run(b.user_id); done.push(b.user_id); }
    db.prepare("INSERT INTO bank_meta(key,value,ts) VALUES('loans_v2',?,?)").run(JSON.stringify(done), Date.now()); });
  const bankPenalty = (uid, t = Date.now()) => { const b = db.prepare('SELECT * FROM bank WHERE user_id=?').get(uid); if (!b) return 0; return b.loan_penalty + (b.mark_until && b.mark_until > t ? BANK.MARK_PENALTY : 0); };
  const bankApi = {
    bankStatus(uid, t = Date.now()) { const b = bankRow(uid), coins = db.prepare('SELECT coins FROM users WHERE id=?').get(uid).coins;
      const state = b.closed ? 'closed_permanent' : b.loans >= BANK.MAX_LOANS ? 'closed_until_bankruptcy' : 'open';
      return { coins, debt: b.debt, loans: b.loans, loansLeft: Math.max(0, BANK.MAX_LOANS - b.loans), bankruptcies: b.bankruptcies, bankruptciesLeft: Math.max(0, BANK.MAX_BANKRUPTCIES - b.bankruptcies), markUntil: b.mark_until && b.mark_until > t ? b.mark_until : null, penalty: bankPenalty(uid, t), state, canLoan: state === 'open', canPayFull: b.debt > 0 && coins >= b.debt, canBankrupt: !b.closed && (b.debt > 0 || b.loans > 0), maxLoan: BANK.MAX_LOAN, adminResetsLeft: Math.max(0, BANK.MAX_ADMIN_RESETS - b.admin_resets), loanPenalty: BANK.LOAN_PENALTY, markPenalty: BANK.MARK_PENALTY,
        ledger: db.prepare('SELECT kind,amount,debt_after,ref,ts FROM bank_ledger WHERE user_id=? ORDER BY id DESC LIMIT 30').all(uid) }; },
    takeLoan(uid, amount) { amount = Number(amount);
      if (!Number.isInteger(amount) || amount < 1 || amount > BANK.MAX_LOAN) err('El préstamo debe ser un número entero entre 1 y 100.000');
      return tx(() => { const b = bankRow(uid);
        if (b.closed) err(b.admin_resets >= BANK.MAX_ADMIN_RESETS ? 'El banco está cerrado permanentemente para ti (5 bancarrotas y ya usaste tu único nuevo comienzo).' : 'El banco está cerrado por 5 bancarrotas. Solo el administrador puede aprobar tu único nuevo comienzo.');
        if (b.loans >= BANK.MAX_LOANS) err('Ya usaste tus 5 préstamos. El banco está cerrado hasta que declares bancarrota.');
        db.prepare('UPDATE users SET coins=coins+? WHERE id=?').run(amount, uid);
        db.prepare('UPDATE bank SET debt=debt+?, loans=loans+1, loan_penalty=loan_penalty+? WHERE user_id=?').run(amount, BANK.LOAN_PENALTY, uid);
        const lid = ledger(uid, 'loan', amount, b.debt + amount, null); db.prepare('INSERT INTO bank_loans(user_id,amount,remaining,ledger_id,ts) VALUES(?,?,?,?,?)').run(uid, amount, amount, lid, Date.now()); return bankApi.bankStatus(uid); }); },
    // Manual full repayment. Amount = server-side current debt; optional expectedDebt guards stale screens. Atomic: no double debit.
    payDebtFull(uid, expectedDebt) {
      return tx(() => { const b = db.prepare('SELECT * FROM bank WHERE user_id=?').get(uid);
        if (!b || b.debt <= 0) err('No tienes deuda pendiente');
        if (expectedDebt != null && Number(expectedDebt) !== b.debt) err('Tu deuda cambió. Revisa el monto actualizado e inténtalo de nuevo.');
        const amount = b.debt, r = db.prepare('UPDATE users SET coins=coins-? WHERE id=? AND coins>=?').run(amount, uid, amount);
        if (!r.changes) err('No tienes saldo suficiente para pagar toda la deuda');
        db.prepare('UPDATE bank SET debt=0 WHERE user_id=? AND debt=?').run(uid, amount);
        ledger(uid, 'repay_manual', amount, 0, 'pago completo'); applyRepay(uid, amount, 'pago completo'); return bankApi.bankStatus(uid); }); },
    declareBankruptcy(uid, t = Date.now()) {
      return tx(() => { const b = bankRow(uid);
        if (b.closed) err('El banco está cerrado permanentemente; ya no puedes declarar bancarrota.');
        if (!(b.debt > 0 || b.loans > 0)) err('No tienes deuda ni préstamos que borrar');
        const n = b.bankruptcies + 1, mark = Math.max(b.mark_until || 0, addMonthNY(t));
        db.prepare('UPDATE bank SET debt=0, loans=0, loan_penalty=0, bankruptcies=?, mark_until=?, closed=? WHERE user_id=?').run(n, mark, n >= BANK.MAX_BANKRUPTCIES ? 1 : 0, uid);
        ledger(uid, 'bankruptcy', b.debt, 0, `#${n}`); forgiveLoans(uid, `bankruptcy#${n}`); return bankApi.bankStatus(uid, t); }); },
    bankClosedUsers() { return db.prepare('SELECT u.id, u.username, u.display_name, u.coins, b.bankruptcies, b.mark_until, b.admin_resets, (b.admin_resets < 1) eligible FROM bank b JOIN users u ON u.id=b.user_id WHERE b.closed=1 ORDER BY u.username').all(); },
    // Human admin decision only. Balance -> 0; debt, loans, penalties, mark and bankruptcy count reset. Bets/history untouched.
    adminFreshStart(adminId, uid, confirm) {
      if (confirm !== 'NUEVO COMIENZO') err('Escribe NUEVO COMIENZO para confirmar');
      return tx(() => { const a = db.prepare('SELECT is_admin FROM users WHERE id=?').get(adminId); if (!a || !a.is_admin) err('Solo el administrador');
        if (Number(uid) === adminId) err('El administrador no puede aprobarse a sí mismo');
        const b = db.prepare('SELECT * FROM bank WHERE user_id=?').get(Number(uid)); if (!b || !b.closed) err('Este jugador no tiene el banco cerrado por 5 bancarrotas');
        if (b.admin_resets >= BANK.MAX_ADMIN_RESETS) err('Este jugador ya usó su único nuevo comienzo; el banco queda cerrado permanentemente');
        const coins = db.prepare('SELECT coins FROM users WHERE id=?').get(b.user_id).coins;
        db.prepare('UPDATE users SET coins=0 WHERE id=?').run(b.user_id);
        db.prepare('UPDATE bank SET debt=0, loans=0, loan_penalty=0, bankruptcies=0, mark_until=NULL, closed=0, admin_resets=admin_resets+1 WHERE user_id=?').run(b.user_id);
        forgiveLoans(b.user_id, 'fresh_start'); ledger(b.user_id, 'fresh_start', coins, 0, `debt ${b.debt}; bankruptcies ${b.bankruptcies}`, adminId); return { ok: true }; }); },
    // Read-only header summary (no row insert).
    bankBrief(uid) { const b = db.prepare('SELECT debt, loans, closed FROM bank WHERE user_id=?').get(uid) || { debt: 0, loans: 0, closed: 0 };
      return { debt: b.debt, loans: b.loans, loansLeft: Math.max(0, BANK.MAX_LOANS - b.loans), state: b.closed ? 'closed_permanent' : b.loans >= BANK.MAX_LOANS ? 'closed_until_bankruptcy' : 'open' }; },
    bankPenalty,
    // Admin metadata for future same-match quotes only (saved tickets keep their frozen price).
    setEventSport(adminId, lineId, sport) {
      return tx(() => { const a = db.prepare('SELECT is_admin FROM users WHERE id=?').get(adminId); if (!a || !a.is_admin) err('Solo el administrador');
        if (sport && !SPORTS.includes(sport)) err('Deporte inválido'); const l = db.prepare('SELECT * FROM lines WHERE id=?').get(Number(lineId)); if (!l) err('Línea no existe');
        if (l.event_id) db.prepare('UPDATE lines SET sport=? WHERE event_id=? AND kind=?').run(sport || null, l.event_id, l.kind); else db.prepare('UPDATE lines SET sport=? WHERE id=?').run(sport || null, l.id);
        return { sport: sport || null }; }); },
    // Admin: set/change/clear the stored start (ISO, saved as UTC) for the whole match. Explicit reschedule is the only way to reopen after start.
    setEventStart(adminId, lineId, starts) {
      return tx(() => { const a = db.prepare('SELECT is_admin FROM users WHERE id=?').get(adminId); if (!a || !a.is_admin) err('Solo el administrador');
        const l = db.prepare('SELECT * FROM lines WHERE id=?').get(Number(lineId)); if (!l) err('Línea no existe');
        let v = null; if (starts != null && starts !== '') { const ms = Date.parse(String(starts)); if (!Number.isFinite(ms)) err('Fecha/hora inválida'); v = new Date(ms).toISOString(); }
        if (l.event_id) db.prepare('UPDATE lines SET starts=? WHERE event_id=? AND kind=?').run(v, l.event_id, l.kind); else db.prepare('UPDATE lines SET starts=? WHERE id=?').run(v, l.id);
        return { starts: v }; }); },
    hasStarted,
    // Admin, reversible. Does not change line status, odds or accepted tickets.
    setEventPaused(adminId, lineId, paused) {
      return tx(() => { const a = db.prepare('SELECT is_admin FROM users WHERE id=?').get(adminId); if (!a || !a.is_admin) err('Solo el administrador');
        const l = db.prepare('SELECT * FROM lines WHERE id=?').get(Number(lineId)); if (!l) err('Línea no existe');
        const group = l.event_id ? db.prepare('SELECT status FROM lines WHERE event_id=? AND kind=?').all(l.event_id, l.kind) : [l];
        if (!group.some(x => ['open', 'closed'].includes(x.status))) err('Este partido ya no tiene mercados sin liquidar');
        if (paused) db.prepare('INSERT OR REPLACE INTO paused_events(key,admin_id,ts) VALUES(?,?,?)').run(eventKey(l), adminId, Date.now());
        else db.prepare('DELETE FROM paused_events WHERE key=?').run(eventKey(l));
        return { paused: !!paused }; }); },
  };
  const api = {
    ...bankApi,
    // Capas del avatar: solo se equipa lo que el usuario posee; color = el del artículo comprado.
    _unequip: (uid, itemId) => editWear(uid, w => { for (const k in w) if (w[k].id === itemId) delete w[k]; }),
    owned: uid => db.prepare('SELECT item_id, color, price, created FROM purchases WHERE user_id=? ORDER BY created').all(Number(uid)).map(o => ({ ...o, color: ST.norm(o.item_id, o.color) })),
    buyItem: (uid, itemId, color) => { const i = ST.byId(itemId); if (!i) err('Artículo no existe');
      if (color != null && !ST.valid(itemId, color)) err('Color inválido');
      return tx(() => { if (db.prepare('SELECT 1 FROM purchases WHERE user_id=? AND item_id=?').get(uid, itemId)) err('Ya es tuyo');
        const r = db.prepare('UPDATE users SET coins=coins-? WHERE id=? AND coins>=?').run(i.price, uid, i.price); if (!r.changes) err('No tienes monedas suficientes');
        db.prepare('INSERT INTO purchases(user_id,item_id,price,color) VALUES(?,?,?,?)').run(uid, itemId, i.price, color || i.color);
        return { coins: db.prepare('SELECT coins FROM users WHERE id=?').get(uid).coins }; }); },
    setItemColor: (uid, itemId, color) => { if (!ST.valid(itemId, color)) err('Color inválido');
      if (!db.prepare('UPDATE purchases SET color=? WHERE user_id=? AND item_id=?').run(color, uid, itemId).changes) err('No es tuyo');
      editWear(uid, w => { for (const k in w) if (w[k].id === itemId) w[k].color = color; }); return { ok: true }; },
    // Venta: devuelve 75% de lo pagado y el artículo vuelve a la tienda (atómico).
    sellItem: (uid, itemId) => tx(() => { const p = db.prepare('SELECT price FROM purchases WHERE user_id=? AND item_id=?').get(uid, itemId); if (!p) err('No es tuyo');
      const refund = Math.floor(p.price * 3 / 4); db.prepare('DELETE FROM purchases WHERE user_id=? AND item_id=?').run(uid, itemId);
      db.prepare('UPDATE users SET coins=coins+? WHERE id=?').run(refund, uid); if (api._unequip) api._unequip(uid, itemId);
      return { refund, coins: db.prepare('SELECT coins FROM users WHERE id=?').get(uid).coins }; }),
    // Bono diario idempotente: una vez cada 24 h; repetir antes devuelve claimed:false sin sumar.
    bonusStatus: (uid, now = Date.now()) => { const l = db.prepare('SELECT last_bonus FROM users WHERE id=?').get(uid)?.last_bonus; const next = l ? Number(l) + BONUS_MS : 0;
      return { amount: BONUS, available: now >= next, nextAt: next > now ? next : null, msLeft: Math.max(0, next - now) }; },
    claimBonus: (uid, now = Date.now()) => tx(() => { const r = db.prepare('UPDATE users SET coins=coins+?, last_bonus=? WHERE id=? AND (last_bonus IS NULL OR last_bonus<=?)').run(BONUS, now, uid, now - BONUS_MS);
      const coins = db.prepare('SELECT coins FROM users WHERE id=?').get(uid).coins; return { claimed: !!r.changes, coins, ...api.bonusStatus(uid, now) }; }),
    // Racha: apuestas resueltas (ganada/perdida) en orden cronológico; parlay = 1; pendientes/devueltas no cuentan.
    streak: uid => { const rs = db.prepare("SELECT status, COALESCE(ts, CAST(strftime('%s', created) AS INTEGER) * 1000000) o, id FROM bets WHERE user_id=? AND status IN ('won','lost') UNION ALL SELECT status, COALESCE(ts, CAST(strftime('%s', created) AS INTEGER) * 1000000) o, id FROM parlays WHERE user_id=? AND status IN ('won','lost') ORDER BY o, id").all(uid, uid);
      if (!rs.length) return null; const last = rs[rs.length - 1].status; let n = 0; for (let i = rs.length - 1; i >= 0 && rs[i].status === last; i--) n++;
      // 🔥 3+, 🔥🔥 5+; 🧊 2+, 🧊🧊 3+
      return last === 'won' && n >= 3 ? { kind: 'fuego', n, intense: n >= 5 } : last === 'lost' && n >= 2 ? { kind: 'hielo', n, intense: n >= 3 } : null; },
    // Piedra/Papel/Tijera entre amigos. Apuestas retenidas al retar/aceptar; ganador se lleva el bote; empate devuelve.
    RPS_MIN, RPS_MAX, RPS_MS,
    bbHalf, bbGame, BB_N, BB_OUTS, BB_OUTS_SCOPE,
    bbExpire: (now = Date.now()) => tx(() => {
      db.prepare("UPDATE bb SET status='expired', resolved=? WHERE status='pending' AND created<=?").run(now, now - PEN_MS);
      for (const g of db.prepare("SELECT * FROM bb WHERE status='accepted' AND accepted_at<=?").all(now - PEN_MS)) {
        if (!g.c_plan && !g.o_plan) { if (db.prepare("UPDATE bb SET status='expired', reason='ninguno jugó', resolved=? WHERE id=? AND status='accepted'").run(now, g.id).changes) db.prepare('UPDATE users SET coins=coins+? WHERE id IN (?,?)').run(g.stake, g.challenger, g.opponent); }
        else { const w = g.c_plan ? g.challenger : g.opponent; if (db.prepare("UPDATE bb SET status='done', winner=?, reason='abandono', resolved=? WHERE id=? AND status='accepted'").run(w, now, g.id).changes) winCredit(w, 2 * g.stake, g.stake, 'reto'); } } }),
    bbChallenge: (uid, oppId, stake, now = Date.now()) => { stake = Number(stake); oppId = Number(oppId);
      if (DISABLED_NEW_MINIGAMES.has('bb') && !api._testAllowDisabled) err('Este minijuego ya no está disponible');
      if (!Number.isInteger(stake) || stake < RPS_MIN || stake > RPS_MAX) err(`La apuesta debe ser un entero entre ${RPS_MIN} y ${RPS_MAX.toLocaleString('es')}`);
      if (oppId === uid) err('No puedes retarte a ti mismo');
      const o = db.prepare('SELECT id, is_admin FROM users WHERE id=?').get(oppId); if (!o || o.is_admin) err('Ese amigo no existe');
      if (db.prepare('SELECT coins FROM users WHERE id=?').get(uid).coins < stake) err('No tienes monedas suficientes');
      return { id: Number(db.prepare("INSERT INTO bb(challenger,opponent,stake,status,created) VALUES(?,?,?,'pending',?)").run(uid, oppId, stake, now).lastInsertRowid) }; },
    bbRespond: (uid, id, accept, now = Date.now()) => { api.bbExpire(now); return tx(() => { const g = db.prepare("SELECT * FROM bb WHERE id=? AND opponent=? AND status='pending'").get(id, uid); if (!g) err('Reto no disponible');
      if (!accept) { db.prepare("UPDATE bb SET status='declined', resolved=? WHERE id=?").run(now, id); return { status: 'declined' }; }
      const c = x => db.prepare('SELECT coins FROM users WHERE id=?').get(x).coins;
      if (c(uid) < g.stake) err('No tienes monedas suficientes para aceptar'); if (c(g.challenger) < g.stake) err('El retador ya no tiene monedas suficientes; el reto no se puede aceptar');
      db.prepare('UPDATE users SET coins=coins-? WHERE id IN (?,?)').run(g.stake, uid, g.challenger); db.prepare("UPDATE bb SET status='accepted', accepted_at=? WHERE id=?").run(now, id); return { status: 'accepted' }; }); },
    bbPlan: (uid, id, pitch, bat, now = Date.now()) => {
      if (!Array.isArray(pitch) || !Array.isArray(bat) || pitch.length !== BB_N || bat.length !== BB_N || !pitch.every(x => x === 'bola' || x === 'strike') || !bat.every(x => x === 'swing' || x === 'no')) err(`El plan debe tener ${BB_N} lanzamientos (bola/strike) y ${BB_N} decisiones (swing/no swing)`);
      api.bbExpire(now); return tx(() => { const g = db.prepare("SELECT * FROM bb WHERE id=? AND status='accepted' AND (challenger=? OR opponent=?)").get(id, uid, uid); if (!g) err('Reto no disponible');
        const col = g.challenger === uid ? 'c_plan' : 'o_plan';
        if (!db.prepare(`UPDATE bb SET ${col}=? WHERE id=? AND ${col} IS NULL`).run(JSON.stringify({ pitch, bat }), id).changes) err('Ya mandaste tu plan; no se puede cambiar');
        const n = db.prepare('SELECT * FROM bb WHERE id=?').get(id);
        if (n.c_plan && n.o_plan) { const r = bbGame(JSON.parse(n.c_plan), JSON.parse(n.o_plan));
          if (r.c === r.o) { if (db.prepare("UPDATE bb SET status='done', reason='empate', result=?, resolved=? WHERE id=? AND status='accepted'").run(JSON.stringify(r), now, id).changes) db.prepare('UPDATE users SET coins=coins+? WHERE id IN (?,?)').run(g.stake, g.challenger, g.opponent); }
          else { const w = r.c > r.o ? g.challenger : g.opponent; if (!db.prepare("UPDATE bb SET status='done', winner=?, reason='carreras', result=?, resolved=? WHERE id=? AND status='accepted'").run(w, JSON.stringify(r), now, id).changes) err('Reto ya resuelto'); winCredit(w, 2 * g.stake, g.stake, 'reto'); } }
        return api.bbView(uid, id); }); },
    bbView: (uid, id) => { const g = db.prepare('SELECT x.*, a.username cu, a.display_name cd, b.username ou, b.display_name od FROM bb x JOIN users a ON a.id=x.challenger JOIN users b ON b.id=x.opponent WHERE x.id=?').get(id);
      if (!g || (g.challenger !== uid && g.opponent !== uid)) err('Reto no encontrado'); const mine = g.challenger === uid, r = g.status === 'done' && g.result ? JSON.parse(g.result) : null;
      return { id: g.id, stake: g.stake, status: g.status, reason: g.reason, mine: mine ? 'sent' : 'received', created: g.created, resolved: g.resolved, iTop: mine,
        expires: g.status === 'pending' ? g.created + PEN_MS : g.status === 'accepted' ? g.accepted_at + PEN_MS : null, rival: mine ? (g.od || g.ou) : (g.cd || g.cu),
        iSent: !!(mine ? g.c_plan : g.o_plan), rivalSent: !!(mine ? g.o_plan : g.c_plan), result: g.status === 'done' ? (g.winner === uid ? 'won' : g.winner ? 'lost' : 'tie') : null,
        game: r ? { my: mine ? r.c : r.o, rival: mine ? r.o : r.c, innings: r.innings } : null }; },
    bbList: (uid, now = Date.now()) => { api.bbExpire(now); return db.prepare('SELECT id FROM bb WHERE challenger=? OR opponent=? ORDER BY id DESC LIMIT 60').all(uid, uid).map(r => api.bbView(uid, r.id)); },
    PEN, PEN_MS, PEN_ROUNDS,
    // Penales: nada de monedas se mueve hasta que se acepta; al aceptar se retienen ambas apuestas a la vez.
    penExpire: (now = Date.now()) => tx(() => {
      db.prepare("UPDATE pen SET status='expired', resolved=? WHERE status='pending' AND created<=?").run(now, now - PEN_MS);
      for (const g of db.prepare("SELECT * FROM pen WHERE status='accepted' AND round_start<=?").all(now - PEN_MS)) {
        const n = db.prepare('SELECT COUNT(*) k FROM pen_rounds WHERE game_id=? AND c_goal IS NOT NULL').get(g.id).k + 1, r = db.prepare('SELECT * FROM pen_rounds WHERE game_id=? AND n=?').get(g.id, n) || {};
        const cp = !!r.c_shot, op = !!r.o_shot;
        if (cp === op) { // ninguno jugó: se devuelve a ambos
          if (db.prepare("UPDATE pen SET status='expired', reason='ninguno jugó', resolved=? WHERE id=? AND status='accepted'").run(now, g.id).changes) db.prepare('UPDATE users SET coins=coins+? WHERE id IN (?,?)').run(g.stake, g.challenger, g.opponent);
        } else { const w = cp ? g.challenger : g.opponent;
          if (db.prepare("UPDATE pen SET status='done', winner=?, reason='abandono', resolved=? WHERE id=? AND status='accepted'").run(w, now, g.id).changes) winCredit(w, 2 * g.stake, g.stake, 'reto'); } } }),
    penChallenge: (uid, oppId, stake, now = Date.now()) => { stake = Number(stake); oppId = Number(oppId);
      if (DISABLED_NEW_MINIGAMES.has('pen') && !api._testAllowDisabled) err('Este minijuego ya no está disponible');
      if (!Number.isInteger(stake) || stake < RPS_MIN || stake > RPS_MAX) err(`La apuesta debe ser un entero entre ${RPS_MIN} y ${RPS_MAX.toLocaleString('es')}`);
      if (oppId === uid) err('No puedes retarte a ti mismo');
      const o = db.prepare('SELECT id, is_admin FROM users WHERE id=?').get(oppId); if (!o || o.is_admin) err('Ese amigo no existe');
      if (db.prepare('SELECT coins FROM users WHERE id=?').get(uid).coins < stake) err('No tienes monedas suficientes');
      return { id: Number(db.prepare("INSERT INTO pen(challenger,opponent,stake,status,created) VALUES(?,?,?,'pending',?)").run(uid, oppId, stake, now).lastInsertRowid) }; },
    penRespond: (uid, id, accept, now = Date.now()) => { api.penExpire(now); return tx(() => { const g = db.prepare("SELECT * FROM pen WHERE id=? AND opponent=? AND status='pending'").get(id, uid); if (!g) err('Reto no disponible');
      if (!accept) { db.prepare("UPDATE pen SET status='declined', resolved=? WHERE id=?").run(now, id); return { status: 'declined' }; }
      const c = id2 => db.prepare('SELECT coins FROM users WHERE id=?').get(id2).coins;
      if (c(uid) < g.stake) err('No tienes monedas suficientes para aceptar');
      if (c(g.challenger) < g.stake) err('El retador ya no tiene monedas suficientes; el reto no se puede aceptar');
      db.prepare('UPDATE users SET coins=coins-? WHERE id IN (?,?)').run(g.stake, uid, g.challenger);
      db.prepare("UPDATE pen SET status='accepted', round_start=? WHERE id=?").run(now, id); return { status: 'accepted' }; }); },
    penPlay: (uid, id, shot, save, now = Date.now()) => { if (!PEN.includes(shot) || !PEN.includes(save)) err('Elige tiro y atajada: izquierda, centro o derecha'); api.penExpire(now); return tx(() => {
      const g = db.prepare("SELECT * FROM pen WHERE id=? AND status='accepted' AND (challenger=? OR opponent=?)").get(id, uid, uid); if (!g) err('Serie no disponible');
      const n = db.prepare('SELECT COUNT(*) k FROM pen_rounds WHERE game_id=? AND c_goal IS NOT NULL').get(id).k + 1, me = g.challenger === uid ? 'c' : 'o';
      db.prepare('INSERT OR IGNORE INTO pen_rounds(game_id,n) VALUES(?,?)').run(id, n);
      if (!db.prepare(`UPDATE pen_rounds SET ${me}_shot=?, ${me}_save=? WHERE game_id=? AND n=? AND ${me}_shot IS NULL`).run(shot, save, id, n).changes) err('Ya jugaste esta ronda; espera a tu rival');
      const r = db.prepare('SELECT * FROM pen_rounds WHERE game_id=? AND n=?').get(id, n);
      if (r.c_shot && r.o_shot) { db.prepare('UPDATE pen_rounds SET c_goal=?, o_goal=? WHERE game_id=? AND n=?').run(+(r.c_shot !== r.o_save), +(r.o_shot !== r.c_save), id, n);
        const t = db.prepare('SELECT SUM(c_goal) c, SUM(o_goal) o FROM pen_rounds WHERE game_id=? AND c_goal IS NOT NULL').get(id);
        if (n >= PEN_ROUNDS && t.c !== t.o) { const w = t.c > t.o ? g.challenger : g.opponent;
          if (!db.prepare("UPDATE pen SET status='done', winner=?, reason='goles', resolved=? WHERE id=? AND status='accepted'").run(w, now, id).changes) err('Serie ya resuelta');
          winCredit(w, 2 * g.stake, g.stake, 'reto'); }
        else db.prepare('UPDATE pen SET round_start=? WHERE id=?').run(now, id); }
      return api.penView(uid, id); }); },
    penView: (uid, id) => { const g = db.prepare('SELECT p.*, a.username cu, a.display_name cd, b.username ou, b.display_name od FROM pen p JOIN users a ON a.id=p.challenger JOIN users b ON b.id=p.opponent WHERE p.id=?').get(id);
      if (!g || (g.challenger !== uid && g.opponent !== uid)) err('Serie no encontrada'); const mine = g.challenger === uid, me = mine ? 'c' : 'o', ot = mine ? 'o' : 'c';
      const rs = db.prepare('SELECT * FROM pen_rounds WHERE game_id=? ORDER BY n').all(id), done = rs.filter(r => r.c_goal !== null), cur = rs.find(r => r.c_goal === null);
      return { id: g.id, stake: g.stake, status: g.status, reason: g.reason, created: g.created, resolved: g.resolved, mine: mine ? 'sent' : 'received',
        expires: g.status === 'pending' ? g.created + PEN_MS : g.status === 'accepted' ? g.round_start + PEN_MS : null,
        rival: mine ? (g.od || g.ou) : (g.cd || g.cu), round: done.length + 1, myGoals: done.reduce((s, r) => s + r[me + '_goal'], 0), rivalGoals: done.reduce((s, r) => s + r[ot + '_goal'], 0),
        iPlayed: !!(cur && cur[me + '_shot']), rivalPlayed: !!(cur && cur[ot + '_shot']), result: g.status === 'done' ? (g.winner === uid ? 'won' : 'lost') : null,
        rounds: done.map(r => ({ n: r.n, myShot: r[me + '_shot'], mySave: r[me + '_save'], rivalShot: r[ot + '_shot'], rivalSave: r[ot + '_save'], myGoal: !!r[me + '_goal'], rivalGoal: !!r[ot + '_goal'] })) }; },
    penList: (uid, now = Date.now()) => { api.penExpire(now); return db.prepare('SELECT id FROM pen WHERE challenger=? OR opponent=? ORDER BY id DESC LIMIT 60').all(uid, uid).map(r => api.penView(uid, r.id)); },
    rpsExpire: (now = Date.now()) => tx(() => { for (const g of db.prepare("SELECT id, challenger, stake FROM rps WHERE status='pending' AND created<=?").all(now - RPS_MS))
      if (db.prepare("UPDATE rps SET status='expired', resolved=? WHERE id=? AND status='pending'").run(now, g.id).changes) db.prepare('UPDATE users SET coins=coins+? WHERE id=?').run(g.stake, g.challenger); }),
    rpsChallenge: (uid, oppId, stake, now = Date.now()) => { stake = Number(stake); oppId = Number(oppId);
      if (!Number.isInteger(stake) || stake < RPS_MIN || stake > RPS_MAX) err(`La apuesta debe ser un entero entre ${RPS_MIN} y ${RPS_MAX.toLocaleString('es')}`);
      if (oppId === Number(uid)) err('No puedes retarte a ti mismo');
      if (!db.prepare('SELECT 1 FROM users WHERE id=? AND is_admin=0').get(oppId)) err('Ese amigo no existe');
      return tx(() => { if (!db.prepare('UPDATE users SET coins=coins-? WHERE id=? AND coins>=?').run(stake, uid, stake).changes) err('No tienes monedas suficientes');
        return { id: Number(db.prepare("INSERT INTO rps(challenger,opponent,stake,status,created) VALUES(?,?,?,'pending',?)").run(uid, oppId, stake, now).lastInsertRowid) }; }); },
    rpsRespond: (uid, id, accept, now = Date.now()) => { api.rpsExpire(now); return tx(() => { const g = db.prepare("SELECT * FROM rps WHERE id=? AND opponent=? AND status='pending'").get(id, uid); if (!g) err('Reto no disponible');
      if (!accept) { db.prepare("UPDATE rps SET status='declined', resolved=? WHERE id=?").run(now, id); db.prepare('UPDATE users SET coins=coins+? WHERE id=?').run(g.stake, g.challenger); return { status: 'declined' }; }
      if (!db.prepare('UPDATE users SET coins=coins-? WHERE id=? AND coins>=?').run(g.stake, uid, g.stake).changes) err('No tienes monedas suficientes');
      db.prepare("UPDATE rps SET status='accepted' WHERE id=?").run(id); return { status: 'accepted' }; }); },
    rpsPick: (uid, id, pick, now = Date.now()) => { if (!RPS.includes(pick)) err('Elige piedra, papel o tijera'); return tx(() => {
      const g = db.prepare("SELECT * FROM rps WHERE id=? AND status='accepted' AND (challenger=? OR opponent=?)").get(id, uid, uid); if (!g) err('Reto no disponible');
      const col = g.challenger === Number(uid) ? 'c_pick' : 'o_pick'; if (g[col]) err('Ya elegiste');
      db.prepare(`UPDATE rps SET ${col}=? WHERE id=? AND ${col} IS NULL`).run(pick, id); const n = db.prepare('SELECT * FROM rps WHERE id=?').get(id);
      if (n.c_pick && n.o_pick) { const w = n.c_pick === n.o_pick ? null : BEATS[n.c_pick] === n.o_pick ? n.challenger : n.opponent;
        if (!db.prepare("UPDATE rps SET status='done', winner=?, resolved=? WHERE id=? AND status='accepted'").run(w, now, id).changes) err('Reto ya resuelto');
        if (w) winCredit(w, n.stake * 2, n.stake, 'reto'); else db.prepare('UPDATE users SET coins=coins+? WHERE id IN (?,?)').run(n.stake, n.challenger, n.opponent); }
      return api.rpsView(uid, id); }); },
    // Vista segura: la elección del rival solo se ve cuando el reto terminó.
    rpsView: (uid, id) => { const g = db.prepare('SELECT r.*, a.username cu, a.display_name cd, b.username ou, b.display_name od FROM rps r JOIN users a ON a.id=r.challenger JOIN users b ON b.id=r.opponent WHERE r.id=?').get(id);
      if (!g || (g.challenger !== Number(uid) && g.opponent !== Number(uid))) return null; const mine = g.challenger === Number(uid), done = g.status === 'done';
      return { id: g.id, stake: g.stake, status: g.status, created: g.created, resolved: g.resolved, expires: g.created + RPS_MS, mine: mine ? 'sent' : 'received',
        rival: mine ? (g.od || g.ou) : (g.cd || g.cu), myPick: mine ? g.c_pick : g.o_pick, rivalPicked: !!(mine ? g.o_pick : g.c_pick), rivalPick: done ? (mine ? g.o_pick : g.c_pick) : null,
        result: done ? (g.winner == null ? 'empate' : g.winner === Number(uid) ? 'ganaste' : 'perdiste') : null }; },
    rpsList: (uid, now = Date.now()) => { api.rpsExpire(now); return db.prepare('SELECT id FROM rps WHERE challenger=? OR opponent=? ORDER BY id DESC LIMIT 60').all(uid, uid).map(r => api.rpsView(uid, r.id)); },
    db,
    hasAdmin: () => !!db.prepare('SELECT 1 FROM users WHERE is_admin=1').get(),
    createUser(username, pin, isAdmin = false) {
      username = String(username || '').trim();
      if (!/^[\wáéíóúñÁÉÍÓÚÑ.-]{2,20}$/.test(username)) err('Usuario inválido (2-20 letras/números)');
      if (String(pin || '').length < 4) err('El PIN debe tener al menos 4 caracteres');
      if (db.prepare('SELECT 1 FROM users WHERE username=?').get(username)) err('Ese usuario ya existe');
      const h = hash(pin);
      return Number(db.prepare('INSERT INTO users(username,pin_hash,salt,coins,is_admin) VALUES(?,?,?,?,?)').run(username, h.hash, h.salt, START_COINS, isAdmin ? 1 : 0).lastInsertRowid);
    },
    setupAdmin(username, pin) { if (api.hasAdmin()) err('El administrador ya existe'); return api.createUser(username, pin, true); },
    newInvite() { const c = crypto.randomBytes(4).toString('hex'); db.prepare('INSERT INTO invites(code) VALUES(?)').run(c); return c; },
    listInvites: () => { const rk = api.refreshRanks(); return db.prepare('SELECT i.code, u.username used_by, u.avatar, u.display_name, u.facial_hair, u.cosmetics, u.avatar_cfg, u.id uid FROM invites i LEFT JOIN users u ON u.id=i.used_by ORDER BY i.rowid DESC').all().map(r => { const { uid, ...o } = deco(r, r.uid, rk); return o; }); },
    register(code, username, pin, avatarCfg) {
      let ac = null; if (avatarCfg != null) { const v = AV.validate(avatarCfg); if (v.error) err(v.error); ac = JSON.stringify(v.cfg); }
      return tx(() => {
        const inv = db.prepare('SELECT * FROM invites WHERE code=?').get(String(code || ''));
        if (!inv) err('Código de invitación inválido'); if (inv.used_by) err('Esa invitación ya se usó');
        const id = api.createUser(username, pin); db.prepare('UPDATE invites SET used_by=? WHERE code=?').run(id, code); db.prepare('UPDATE users SET avatar_cfg=? WHERE id=?').run(ac || JSON.stringify(AV.DEFAULT), id); return id;
      });
    },
    login(username, pin) {
      const u = db.prepare('SELECT * FROM users WHERE username=?').get(String(username || '').trim());
      if (!u || !crypto.timingSafeEqual(Buffer.from(hash(pin, u.salt).hash, 'hex'), Buffer.from(u.pin_hash, 'hex'))) err('Usuario o PIN incorrecto');
      const t = crypto.randomBytes(24).toString('hex'); db.prepare('INSERT INTO sessions VALUES(?,?)').run(t, u.id); return t;
    },
    userByToken: t => { const u = t && db.prepare('SELECT u.id,u.username,u.coins,u.is_admin,u.avatar,u.display_name,u.facial_hair,u.cosmetics,u.avatar_cfg FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=?').get(t); if (!u) return u; const rk = api.refreshRanks(); return { ...deco(u, u.id, rk), unlocks: api.unlocksOf(u.id) }; },
    createLine(title, opts, extra = {}) {
      title = String(title || '').trim(); if (!title) err('Falta el título');
      if (!Array.isArray(opts) || opts.length < 2) err('Se necesitan al menos 2 opciones');
      opts.forEach(o => { if (!String(o.label || '').trim()) err('Opción sin nombre'); try { profit(100, o.odds); } catch (e) { err(e.message); } });
      if (extra.market) { try { Markets.validate(extra.market, opts, extra.home, extra.away); } catch(e) { err(e.message); } }
      return tx(() => {
        const id = Number(db.prepare('INSERT INTO lines(title,kind,event_id,starts) VALUES(?,?,?,?)').run(title, extra.kind || 'custom', extra.event_id || null, extra.starts || null).lastInsertRowid);
        db.prepare('UPDATE lines SET market=?,home=?,away=?,unit=?,bookmaker=?,sport=? WHERE id=?').run(extra.market || null, extra.home || null, extra.away || null, extra.unit || '', extra.bookmaker || null, extra.sport || null, id);
        for (const o of opts) db.prepare('INSERT INTO options(line_id,label,odds,point,outcome) VALUES(?,?,?,?,?)').run(id, extra.market ? Markets.label(extra.market,o) : String(o.label).trim(), Math.trunc(Number(o.odds)), extra.market && extra.market !== 'h2h' ? o.point : null, extra.market ? o.label : null);
        return id;
      });
    },
    createEvent(event, kind = 'custom') {
      if (!event || !event.id || !Array.isArray(event.markets) || !event.markets.length) err('Evento sin mercados');
      if (new Set(event.markets.map(m => m.key)).size !== event.markets.length) err('Mercados repetidos');
      if (event.starts != null && event.starts !== '') { const ms = Date.parse(String(event.starts)); if (!Number.isFinite(ms)) err('Fecha/hora inválida'); event = { ...event, starts: new Date(ms).toISOString() }; } else event = { ...event, starts: null };
      return tx(() => event.markets.map(m => {
        try { Markets.validate(m.key, m.options, event.home, event.away); } catch(e) { err(e.message); }
        const prior = db.prepare("SELECT id FROM lines WHERE event_id=? AND kind=? AND COALESCE(market,'h2h')=?").get(String(event.id), kind, m.key);
        if (prior) return prior.id;
        return api.createLine(event.title, m.options, { kind, event_id: String(event.id), starts: event.starts, market: m.key, home: event.home, away: event.away, unit: event.unit, bookmaker: m.bookmaker, sport: sportOf(event) });
      }));
    },
    addEventMarket(lineId, market, options, home, away, unit = '') {
      return tx(() => {
        const source = db.prepare('SELECT * FROM lines WHERE id=?').get(Number(lineId));
        if (!source || source.status !== 'open') err('El evento debe tener una línea abierta');
        if (!['spreads','totals'].includes(market)) err('Solo se pueden agregar hándicap o total');
        home = String(home || '').trim(); away = String(away || '').trim();
        if (source.home && (source.home !== home || source.away !== away)) err('No se pueden cambiar los equipos del evento');
        if (!source.market) {
          const original = db.prepare('SELECT label,odds FROM options WHERE line_id=?').all(source.id);
          try { Markets.validate('h2h', original.map(o => ({ ...o, label: o.label === 'Empate' ? 'Draw' : o.label })), home, away); } catch { err('Los equipos deben coincidir exactamente con las opciones ganadoras existentes'); }
        }
        try { Markets.validate(market, options, home, away); } catch(e) { err(e.message); }
        const eventId = source.event_id || `legacy:${source.id}`;
        if (db.prepare("SELECT id FROM lines WHERE event_id=? AND kind=? AND market=?").get(eventId, source.kind, market)) err('Este mercado ya existe; no se sobrescriben cuotas ni apuestas');
        // Explicit admin action upgrades grouping metadata only. Original options/bets/odds untouched.
        db.prepare("UPDATE lines SET event_id=?,home=?,away=?,unit=?,market=COALESCE(market,'h2h') WHERE id=?").run(eventId, home, away, source.unit || String(unit || ''), source.id);
        return api.createLine(source.title, options, { kind: source.kind, event_id: eventId, starts: source.starts, market, home, away, unit: source.unit || String(unit || ''), sport: source.sport });
      });
    },
    pushLine(id) {
      return tx(() => {
        const l = db.prepare('SELECT * FROM lines WHERE id=?').get(Number(id));
        if (!l || !['spreads','totals'].includes(l.market)) err('Push solo para hándicap o total');
        const os = db.prepare('SELECT point FROM options WHERE line_id=?').all(l.id);
        if (!os.every(o => Number.isInteger(o.point))) err('No hay push en umbrales de medio punto');
        api.cancelLine(l.id);
        db.prepare("UPDATE lines SET status='pushed' WHERE id=?").run(l.id);
      });
    },
    lines(statusFilter) {
      const ls = db.prepare(`SELECT * FROM lines ${statusFilter ? 'WHERE status IN (' + statusFilter.map(() => '?').join(',') + ')' : ''} ORDER BY id DESC`).all(...(statusFilter || []));
      const t = Date.now(); return ls.map(l => ({ ...l, paused: isPaused(l), started: hasStarted(l, t), options: db.prepare('SELECT * FROM options WHERE line_id=?').all(l.id) }));
    },
    placeBet(userId, optionId, stake, t = Date.now()) {
      stake = Number(stake);
      if (!Number.isInteger(stake) || stake <= 0) err('La apuesta debe ser un número entero mayor que 0');
      return tx(() => {
        const o = db.prepare('SELECT o.*, l.status, l.event_id, l.kind, l.market, l.home, l.away, l.starts FROM options o JOIN lines l ON l.id=o.line_id WHERE o.id=?').get(Number(optionId));
        if (!o) err('Opción no existe'); if (o.status !== 'open') err('Esta línea ya no acepta apuestas'); if (isPaused(o)) err(PAUSED_MSG); if (hasStarted(o, t)) err(STARTED_MSG);
        const u = db.prepare('SELECT coins FROM users WHERE id=?').get(userId);
        if (u.coins < stake) err('No tienes suficientes monedas');
        db.prepare('UPDATE users SET coins=coins-? WHERE id=?').run(stake, userId);
        return Number(db.prepare('INSERT INTO bets(user_id,line_id,option_id,stake,odds,ts) VALUES(?,?,?,?,?,?)').run(userId, o.line_id, o.id, stake, o.odds, now()).lastInsertRowid);
      });
    },
    placeParlay(userId, optionIds, stake, t = Date.now()) {
      stake = Number(stake);
      if (!Array.isArray(optionIds) || optionIds.length < 2 || optionIds.length > 15) err('El parlay debe tener de 2 a 15 selecciones');
      const ids = optionIds.map(Number);
      if (new Set(ids).size !== ids.length) err('Selecciones repetidas');
      if (!Number.isInteger(stake) || stake <= 0) err('La apuesta debe ser un número entero mayor que 0');
      return tx(() => {
        const legs = ids.map(id => {
          const o = db.prepare('SELECT o.*, l.status, l.event_id, l.kind, l.market, l.home, l.away, l.starts FROM options o JOIN lines l ON l.id=o.line_id WHERE o.id=?').get(id);
          if (!o) err('Opción no existe'); if (o.status !== 'open') err('Una de las líneas ya no acepta apuestas'); if (isPaused(o)) err(PAUSED_MSG); if (hasStarted(o, t)) err(STARTED_MSG); return o;
        });
        if (new Set(legs.map(o => o.line_id)).size !== legs.length) err('Solo una selección por línea');
        const legMeta = legs.map(o => ({ event: o.event_id ? `${o.kind}:${o.event_id}` : null, line: o.line_id, market: o.market, home: o.home, away: o.away, outcome: o.outcome, label: o.label, point: o.point, option: o.id, odds: o.odds })); { const e = Markets.sameEventError(legMeta); if (e) err(e); }
        const eventLines = {};
        for (const g of legs) if (g.event_id) { const k = `${g.kind}:${g.event_id}`; if (eventLines[k]) continue;
          eventLines[k] = db.prepare('SELECT * FROM lines WHERE event_id=? AND kind=? ORDER BY id').all(g.event_id, g.kind).map(l => ({ market: l.market, home: l.home, away: l.away, sport: l.sport, options: db.prepare('SELECT label,odds,point,outcome FROM options WHERE line_id=? ORDER BY id').all(l.id) })); }
        const q = Sgp.quote(legMeta, eventLines); if (q.error) err(q.error);
        const u = db.prepare('SELECT coins FROM users WHERE id=?').get(userId);
        if (u.coins < stake) err('No tienes suficientes monedas');
        db.prepare('UPDATE users SET coins=coins-? WHERE id=?').run(stake, userId);
        const pid = Number(db.prepare('INSERT INTO parlays(user_id,stake,ts,same_event,pricing,odds_dec) VALUES(?,?,?,?,?,?)').run(userId, stake, now(), Markets.hasSameEvent(legMeta) ? 1 : 0, q.modeled ? JSON.stringify({ version: Sgp.VERSION, groups: q.groups }) : null, q.modeled ? q.dec : null).lastInsertRowid);
        for (const o of legs) db.prepare('INSERT INTO parlay_legs(parlay_id,line_id,option_id,odds) VALUES(?,?,?,?)').run(pid, o.line_id, o.id, o.odds);
        return pid;
      });
    },
    _parlayLegs(lineId, winnerId) {
      // winnerId null => cancelled
      const touched = new Set();
      for (const g of db.prepare("SELECT * FROM parlay_legs WHERE line_id=? AND status='open'").all(lineId)) {
        const st = winnerId == null ? 'cancelled' : g.option_id === winnerId ? 'won' : 'lost';
        db.prepare('UPDATE parlay_legs SET status=? WHERE id=?').run(st, g.id); touched.add(g.parlay_id);
      }
      for (const pid of touched) {
        const p = db.prepare('SELECT * FROM parlays WHERE id=?').get(pid); if (p.status !== 'open') continue;
        const legs = db.prepare('SELECT * FROM parlay_legs WHERE parlay_id=?').all(pid);
        if (legs.some(g => g.status === 'lost')) { db.prepare("UPDATE parlays SET status='lost', ts=? WHERE id=? AND status='open'").run(now(), pid); continue; }
        if (legs.some(g => g.status === 'open')) continue;
        let st, pay;
        if (p.pricing) { const f = modeledFactor(p, legs); [st, pay] = f.live ? ['won', Math.floor(p.stake * f.d)] : ['refunded', p.stake]; }
        else { const live = legs.filter(g => g.status === 'won');
          [st, pay] = live.length ? ['won', Math.floor(p.stake * live.reduce((m, g) => m * dec(g.odds), 1))] : ['refunded', p.stake]; }
        if (db.prepare("UPDATE parlays SET status=?, payout=?, ts=? WHERE id=? AND status='open'").run(st, pay, now(), pid).changes === 1) {
          if (st === 'won') winCredit(p.user_id, pay, p.stake, `parlay#${pid}`); else db.prepare('UPDATE users SET coins=coins+? WHERE id=?').run(pay, p.user_id); }
      }
    },
    myParlays: uid => db.prepare('SELECT * FROM parlays WHERE user_id=? ORDER BY id DESC').all(uid).map(p => {
      const legs = db.prepare('SELECT g.*, l.title, l.home, l.away, o.label FROM parlay_legs g JOIN lines l ON l.id=g.line_id JOIN options o ON o.id=g.option_id WHERE g.parlay_id=? ORDER BY g.id').all(p.id);
      const d = p.pricing ? modeledFactor(p, legs).d : legs.filter(g => g.status !== 'cancelled').reduce((m, g) => m * dec(g.odds), 1);
      const { pricing, ...pp } = p;
      return { ...pp, legs, ...(p.pricing ? { pricing_note: Sgp.NOTE, model: JSON.parse(p.pricing).version } : p.same_event ? { pricing_note: Markets.SAME_EVENT_NOTE } : {}), odds: d > 1 ? toAmerican(d) : null, potential: Math.floor(p.stake * d) };
    }),
    closeLine(id) { if (db.prepare("UPDATE lines SET status='closed' WHERE id=? AND status='open'").run(id).changes !== 1) err('La línea no está abierta'); },
    settleLine(id, winnerOptionId) {
      return tx(() => {
        const l = db.prepare('SELECT * FROM lines WHERE id=?').get(Number(id));
        if (!l) err('Línea no existe'); if (!['open', 'closed'].includes(l.status)) err('Esta línea ya fue liquidada o cancelada');
        if (!db.prepare('SELECT 1 FROM options WHERE id=? AND line_id=?').get(Number(winnerOptionId), l.id)) err('Opción ganadora inválida');
        db.prepare("UPDATE lines SET status='settled', winner=? WHERE id=?").run(Number(winnerOptionId), l.id);
        for (const b of db.prepare("SELECT * FROM bets WHERE line_id=? AND status='open'").all(l.id)) {
          if (b.option_id === Number(winnerOptionId)) {
            const pay = b.stake + profit(b.stake, b.odds);
            db.prepare("UPDATE bets SET status='won', payout=?, ts=? WHERE id=?").run(pay, now(), b.id);
            winCredit(b.user_id, pay, b.stake, `bet#${b.id}`);
          } else db.prepare("UPDATE bets SET status='lost', ts=? WHERE id=?").run(now(), b.id);
        }
        api._parlayLegs(l.id, Number(winnerOptionId)); api.refreshRanks();
      });
    },
    cancelLine(id) {
      return tx(() => {
        const l = db.prepare('SELECT * FROM lines WHERE id=?').get(Number(id));
        if (!l || !['open', 'closed'].includes(l.status)) err('No se puede cancelar esta línea');
        db.prepare("UPDATE lines SET status='cancelled' WHERE id=?").run(l.id);
        for (const b of db.prepare("SELECT * FROM bets WHERE line_id=? AND status='open'").all(l.id)) {
          db.prepare("UPDATE bets SET status='refunded', payout=? WHERE id=?").run(b.stake, b.id);
          db.prepare('UPDATE users SET coins=coins+? WHERE id=?').run(b.stake, b.user_id);
        }
        api._parlayLegs(l.id, null); api.refreshRanks();
      });
    },
    myBets: uid => db.prepare('SELECT b.*, l.title, l.kind, l.home, l.away, o.label FROM bets b JOIN lines l ON l.id=b.line_id JOIN options o ON o.id=b.option_id WHERE b.user_id=? ORDER BY b.id DESC').all(uid),
    setProfile(uid, avatar, displayName, facialHair, cosmetics, avatarCfg) {
      let cos, acfg;
      if (avatarCfg !== undefined && avatarCfg !== null) { const v = AV.validate(avatarCfg); if (v.error) err(v.error); acfg = v.cfg; }
      if (cosmetics !== undefined) {
        cos = {}; if (cosmetics !== null && typeof cosmetics !== 'object') err('Cosméticos inválidos');
        api.refreshRanks(); const mine = new Set(api.unlocksOf(uid).map(u => u.item_id));
        for (const kind of ['color', 'accessory']) { const v = cosmetics?.[kind]; if (v == null || v === '') continue;
          const it = REWARDS.find(r => r.id === v && r.kind === kind); if (!it) err('Ítem inválido');
          if (!mine.has(v)) err(`Bloqueado: ${it.name} requiere top ${it.minRank}`); cos[kind] = v; }
      }
      let fh = null;
      if (facialHair != null && facialHair !== '') {
        const st = typeof facialHair === 'string' ? facialHair : facialHair.style, col = typeof facialHair === 'object' ? facialHair.color : null;
        if (!FACIAL.includes(st)) err('Vello facial inválido');
        if (col != null && col !== '' && !/^#[0-9a-fA-F]{6}$/.test(col)) err('Color inválido (use #rrggbb)');
        if (st !== 'ninguno') fh = { style: st, color: col ? col.toLowerCase() : null };
      }
      avatar = String(avatar ?? '').trim(); displayName = String(displayName ?? '').trim().replace(/\s+/g, ' ');
      if (avatar) {
        const g = [...new Intl.Segmenter('es', { granularity: 'grapheme' }).segment(avatar)];
        if (avatar.length > 16 || g.length !== 1 || !/\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(avatar)) err('El avatar debe ser un solo emoji');
      }
      if ([...displayName].length > 20) err('El nombre debe tener máximo 20 caracteres');
      if (/[\u0000-\u001f\u007f<>]/.test(displayName)) err('El nombre tiene caracteres no permitidos');
      db.prepare('UPDATE users SET avatar=?, display_name=?, facial_hair=? WHERE id=?').run(avatar || null, displayName || null, fh && JSON.stringify(fh), uid);
      if (cos) db.prepare('UPDATE users SET cosmetics=? WHERE id=?').run(JSON.stringify(cos), uid);
      if (acfg) db.prepare('UPDATE users SET avatar_cfg=? WHERE id=?').run(JSON.stringify(acfg), uid);
      return { avatar: avatar || null, display_name: displayName || null, facialHair: fh, ...(cos ? { cosmetics: cos } : {}), ...(acfg ? { avatarCfg: acfg } : {}) };
    },
    topup(adminId, userId, amount) {
      amount = Number(amount);
      if (!Number.isInteger(amount) || amount <= 0 || amount > MAX_TOPUP) err('El monto debe ser un entero entre 1 y 10.000.000');
      return tx(() => {
        const a = db.prepare('SELECT is_admin FROM users WHERE id=?').get(adminId); if (!a || !a.is_admin) err('Solo el administrador');
        if (!db.prepare('SELECT 1 FROM users WHERE id=?').get(Number(userId))) err('Usuario no existe');
        db.prepare('UPDATE users SET coins=coins+? WHERE id=?').run(amount, Number(userId));
        const id = Number(db.prepare('INSERT INTO topups(user_id,admin_id,amount) VALUES(?,?,?)').run(Number(userId), adminId, amount).lastInsertRowid);
        api.refreshRanks(); return { id, coins: db.prepare('SELECT coins FROM users WHERE id=?').get(Number(userId)).coins };
      });
    },
    topups: (limit = 20) => db.prepare('SELECT t.id, t.amount, t.created, u.username, u.display_name, u.avatar, u.avatar_cfg, u.facial_hair, a.username admin FROM topups t JOIN users u ON u.id=t.user_id JOIN users a ON a.id=t.admin_id ORDER BY t.id DESC LIMIT ?').all(limit).map(r => deco(r)),
    users: () => { const rk = api.refreshRanks(); return db.prepare('SELECT id, username, avatar, display_name, facial_hair, cosmetics, avatar_cfg, coins, is_admin FROM users ORDER BY username').all().map(r => deco(r, r.id, rk)); },
    periodCutoff(period) {
      const d = new Date(); d.setHours(0, 0, 0, 0);
      if (period === 'hoy') return d.getTime() * 1000;
      if (period === 'semana') { const day = d.getDay(); d.setDate(d.getDate() - ((day + 6) % 7)); return d.getTime() * 1000; }
      return null; // temporada = all time
    },
    _settledCounts(uid, cutoff) {
      const ts = "COALESCE(ts, CAST(strftime('%s', created) AS INTEGER) * 1000000)";
      const f = cutoff == null ? '' : ` AND ${ts}>=?`;
      const args = cutoff == null ? [uid] : [uid, cutoff];
      const wonB = db.prepare(`SELECT COUNT(*) c FROM bets WHERE user_id=? AND status='won'${f}`).get(...args).c;
      const lostB = db.prepare(`SELECT COUNT(*) c FROM bets WHERE user_id=? AND status='lost'${f}`).get(...args).c;
      const wonP = db.prepare(`SELECT COUNT(*) c FROM parlays WHERE user_id=? AND status='won'${f}`).get(...args).c;
      const lostP = db.prepare(`SELECT COUNT(*) c FROM parlays WHERE user_id=? AND status='lost'${f}`).get(...args).c;
      return { wins: wonB + wonP, losses: lostB + lostP };
    },
    leaderboard(period = 'temporada') {
      const rk = api.refreshRanks();
      const cutoff = api.periodCutoff(period);
      return db.prepare('SELECT id, username, avatar, display_name, facial_hair, cosmetics, avatar_cfg, coins, is_admin FROM users ORDER BY username').all().map(r => {
        const { wins, losses } = api._settledCounts(r.id, cutoff);
        const tot = wins + losses;
        const { id, is_admin, ...o } = deco(r, r.id, rk);
        const bankPenalty = api.bankPenalty(r.id); return { ...o, id, is_admin, wins, losses, bankPenalty, points: 3 * wins - bankPenalty, winPct: winPct(wins, losses), streak: api.streak(r.id) };
      }).sort(rankCmp);
    },
    activity(limit = 8) {
      const rows = db.prepare(`SELECT * FROM (
        SELECT u.username, u.display_name, u.avatar_cfg, b.status, b.stake, b.payout,
          COALESCE(b.ts, CAST(strftime('%s', b.created) AS INTEGER) * 1000000) o, l.title, 'bet' kind
        FROM bets b JOIN users u ON u.id=b.user_id JOIN lines l ON l.id=b.line_id
        WHERE b.status IN ('won','lost')
        UNION ALL
        SELECT u.username, u.display_name, u.avatar_cfg, p.status, p.stake, p.payout,
          COALESCE(p.ts, CAST(strftime('%s', p.created) AS INTEGER) * 1000000) o, 'Parlay' title, 'parlay' kind
        FROM parlays p JOIN users u ON u.id=p.user_id
        WHERE p.status IN ('won','lost')
      ) ORDER BY o DESC, title LIMIT ?`).all(Math.min(20, Math.max(1, Number(limit) || 8)));
      return rows.map(r => ({ username: r.username, display_name: r.display_name, avatarCfg: AV.norm(r.avatar_cfg), status: r.status, stake: r.stake, payout: r.payout, title: r.title, kind: r.kind, ts: r.o }));
    },
    // Podio top 3 (owner t628): los 3 primeros de la tabla, sin mínimo de apuestas (puntos → % victoria → dinero).
    // La tabla lista a TODOS (incl. admin); el podio solo a elegibles (0–3 huecos), admin incluido si califica.
    tabla(period = 'temporada') {
      const rows = api.leaderboard(period).map(({ is_admin, ...u }) => u);
      const podium = rows.slice(0, 3);
      return { period: ['hoy', 'semana', 'temporada'].includes(period) ? period : 'temporada', rows, podium, activity: api.activity(8) };
    },
    ranks() { const m = new Map(); db.prepare("SELECT id, username, coins, (SELECT COUNT(*) FROM bets b WHERE b.user_id=users.id AND b.status='won') + (SELECT COUNT(*) FROM parlays p WHERE p.user_id=users.id AND p.status='won') wins, (SELECT COUNT(*) FROM bets b WHERE b.user_id=users.id AND b.status='lost') + (SELECT COUNT(*) FROM parlays p WHERE p.user_id=users.id AND p.status='lost') losses FROM users WHERE is_admin=0").all()
      .map(u => ({ ...u, points: 3 * u.wins - bankPenalty(u.id), winPct: winPct(u.wins, u.losses) })).sort(rankCmp).slice(0, 3).forEach((u, i) => m.set(u.id, i + 1)); return m; },
    refreshRanks() { const m = api.ranks(); const ins = db.prepare('INSERT OR IGNORE INTO unlocks(user_id,item_id,rank) VALUES(?,?,?)');
      for (const [uid, rank] of m) for (const it of REWARDS) if (rank <= it.minRank) ins.run(uid, it.id, rank); return m; },
    unlocksOf: uid => db.prepare('SELECT item_id, rank, created FROM unlocks WHERE user_id=? ORDER BY created').all(uid),
  };
  // ---- Three Contest: 5 posiciones × 5 balones, 75 s de reloj del servidor, 40% por tiro ----
  const POINTS_PER_MAKE = 3, TC_PER = 5, TC_MS = 75000, TC_BAR_MS = 2500, TC_POS = ['Esquina izquierda', 'Centro', 'Esquina derecha']; const TC_N = TC_POS.length * TC_PER, TC_MAX = TC_N * POINTS_PER_MAKE; // todos los tiros valen igual; el último de cada posición solo se ve dorado
  api.TC = { ppm: POINTS_PER_MAKE, per: TC_PER, ms: TC_MS, total: TC_N, max: TC_MAX, bar: TC_BAR_MS, pos: TC_POS }; api.TC_POS = TC_POS; api.TC_MS = TC_MS; api.tcRand = Math.random;
  const tcPts = st => st ? st.shots.reduce((a, x) => a + x.pts, 0) : 0;
  const tcDone = (st, now) => !!st && (st.shots.length >= TC_N || now > st.start + TC_MS || st.fin);
  const tcRow = id => db.prepare('SELECT * FROM tc WHERE id=?').get(Number(id));
  // Barra de potencia: sube 0→100% mientras se mantiene presionado (TC_BAR_MS para llenarse). El servidor mide press→release.
  // La zona verde (ancho TC_GREEN) se sortea en cada tiro con centro entre TC_GREEN_MIN y TC_GREEN_MAX (siempre arriba); amarilla TC_YELLOW a cada lado.
  const TC_GREEN = 10, TC_YELLOW = 10, TC_GREEN_MIN = 68, TC_GREEN_MAX = 90, TC_P_GREEN = 0.85, TC_P_YELLOW = 0.5, TC_P_ELSE = 0.1;
  api.TC.green = { width: TC_GREEN, yellow: TC_YELLOW, min: TC_GREEN_MIN, max: TC_GREEN_MAX }; api.tcZoneRand = Math.random;
  const tcBar = el => Math.max(0, Math.min(100, Math.round(el / TC_BAR_MS * 100)));
  const tcZone = (v, c) => { const d = Math.abs(v - c), g = TC_GREEN / 2;
    if (v >= 100) return { p: TC_P_ELSE, k: 'tarde', label: 'Muy tarde' }; if (d <= g) return { p: TC_P_GREEN, k: 'perfecto', label: '¡Perfecto!' };
    if (d <= g + TC_YELLOW) return { p: TC_P_YELLOW, k: 'bien', label: 'Bien' }; return v < c ? { p: TC_P_ELSE, k: 'temprano', label: 'Muy temprano' } : { p: TC_P_ELSE, k: 'tarde', label: 'Muy tarde' }; };
  const tcNewGreen = () => Math.round(TC_GREEN_MIN + api.tcZoneRand() * (TC_GREEN_MAX - TC_GREEN_MIN));
  const tcProb = (v, c) => tcZone(v, c).p; api.tcBar = tcBar; api.tcProb = tcProb; api.tcZone = tcZone;
  const tcRoll = (aim, green, now) => { const bar = tcBar(now - (aim ?? now)), z = tcZone(bar, green ?? 79); return { bar, green: green ?? 79, zone: z.k, label: z.label, made: api.tcRand() < z.p }; };
  const pay = (g, w, reason, now, extra) => { if (!db.prepare("UPDATE tc SET status='done', winner=?, reason=?, extra=COALESCE(?, extra), resolved=? WHERE id=? AND status='accepted'").run(w, reason, extra ? JSON.stringify(extra) : null, now, g.id).changes) return;
    if (w) winCredit(w, 2 * g.stake, g.stake, 'reto'); else db.prepare('UPDATE users SET coins=coins+? WHERE id IN (?,?)').run(g.stake, g.challenger, g.opponent); };
  const tcResolve = (g, now) => { if (g.status !== 'accepted') return; const cs = g.c_st && JSON.parse(g.c_st), os = g.o_st && JSON.parse(g.o_st); if (!tcDone(cs, now) || !tcDone(os, now)) return;
    const c = tcPts(cs), o = tcPts(os); if (c !== o) return pay(g, c > o ? g.challenger : g.opponent, 'puntos', now);
    let tb = g.extra && JSON.parse(g.extra); if (!tb) { tb = { r: 1, at: now, c: null, o: null, hist: [] }; db.prepare('UPDATE tc SET extra=? WHERE id=?').run(JSON.stringify(tb), g.id); return; }
    if (!tb.c || tb.c.made == null || !tb.o || tb.o.made == null) return;
    tb.hist.push({ c: tb.c.made, o: tb.o.made, cb: tb.c.bar, ob: tb.o.bar });
    if (tb.c.made !== tb.o.made) return pay(g, tb.c.made ? g.challenger : g.opponent, 'desempate', now, { ...tb, c: null, o: null });
    Object.assign(tb, { r: tb.r + 1, at: now, c: null, o: null }); db.prepare('UPDATE tc SET extra=? WHERE id=?').run(JSON.stringify(tb), g.id); };
  api.tcExpire = (now = Date.now()) => tx(() => {
    db.prepare("UPDATE tc SET status='expired', resolved=? WHERE status='pending' AND created<=?").run(now, now - PEN_MS);
    for (const g0 of db.prepare("SELECT * FROM tc WHERE status='accepted'").all()) { tcResolve(g0, now); const g = tcRow(g0.id); if (g.status !== 'accepted') continue;
      const tb = g.extra && JSON.parse(g.extra);
      if (tb) { if (tb.at > now - PEN_MS) continue; const cs = tb.c && tb.c.made != null, os = tb.o && tb.o.made != null;
        if (cs || os) pay(g, cs ? g.challenger : g.opponent, 'abandono', now); else { if (db.prepare("UPDATE tc SET status='expired', reason='ninguno jugó', resolved=? WHERE id=? AND status='accepted'").run(now, g.id).changes) db.prepare('UPDATE users SET coins=coins+? WHERE id IN (?,?)').run(g.stake, g.challenger, g.opponent); } continue; }
      if (g.accepted_at > now - PEN_MS) continue;
      if (!g.c_st && !g.o_st) { if (db.prepare("UPDATE tc SET status='expired', reason='ninguno jugó', resolved=? WHERE id=? AND status='accepted'").run(now, g.id).changes) db.prepare('UPDATE users SET coins=coins+? WHERE id IN (?,?)').run(g.stake, g.challenger, g.opponent); }
      else if (!g.c_st || !g.o_st) pay(g, g.c_st ? g.challenger : g.opponent, 'abandono', now); } });
  api.tcChallenge = (uid, oppId, stake, now = Date.now()) => { stake = Number(stake); oppId = Number(oppId);
    if (DISABLED_NEW_MINIGAMES.has('tc') && !api._testAllowDisabled) err('Este minijuego ya no está disponible');
    if (!Number.isInteger(stake) || stake < RPS_MIN || stake > RPS_MAX) err(`La apuesta debe ser un entero entre ${RPS_MIN} y ${RPS_MAX.toLocaleString('es')}`);
    if (oppId === uid) err('No puedes retarte a ti mismo'); const o = db.prepare('SELECT id, is_admin FROM users WHERE id=?').get(oppId); if (!o || o.is_admin) err('Ese amigo no existe');
    if (db.prepare('SELECT coins FROM users WHERE id=?').get(uid).coins < stake) err('No tienes monedas suficientes');
    return { id: Number(db.prepare("INSERT INTO tc(challenger,opponent,stake,status,created) VALUES(?,?,?,'pending',?)").run(uid, oppId, stake, now).lastInsertRowid) }; };
  api.tcRespond = (uid, id, accept, now = Date.now()) => { api.tcExpire(now); return tx(() => { const g = db.prepare("SELECT * FROM tc WHERE id=? AND opponent=? AND status='pending'").get(Number(id), uid); if (!g) err('Reto no disponible');
    if (!accept) { db.prepare("UPDATE tc SET status='declined', resolved=? WHERE id=?").run(now, g.id); return { status: 'declined' }; }
    const c = x => db.prepare('SELECT coins FROM users WHERE id=?').get(x).coins;
    if (c(uid) < g.stake) err('No tienes monedas suficientes para aceptar'); if (c(g.challenger) < g.stake) err('El retador ya no tiene monedas suficientes; el reto no se puede aceptar');
    db.prepare('UPDATE users SET coins=coins-? WHERE id IN (?,?)').run(g.stake, uid, g.challenger); db.prepare("UPDATE tc SET status='accepted', accepted_at=? WHERE id=?").run(now, g.id); return { status: 'accepted' }; }); };
  const tcMine = (uid, id, now) => { const g = tcRow(id); if (!g || (g.challenger !== uid && g.opponent !== uid)) err('Reto no encontrado'); if (g.status !== 'accepted') err('Este reto ya no está en juego');
    const col = g.challenger === uid ? 'c_st' : 'o_st'; return { g, col, st: g[col] && JSON.parse(g[col]) }; };
  const tcSave = (g, col, st, now) => { db.prepare(`UPDATE tc SET ${col}=? WHERE id=?`).run(JSON.stringify(st), g.id); tcResolve(tcRow(g.id), now); };
  api.tcStart = (uid, id, now = Date.now()) => { api.tcExpire(now); return tx(() => { const { g, col, st } = tcMine(uid, id, now); if (st) err('Ya empezaste tu concurso; solo se hace una vez');
    tcSave(g, col, { start: now, pos: 0, shots: [] }, now); return api.tcView(uid, g.id, now); }); };
  const tcTb = (g, uid) => { const tb = g.extra && JSON.parse(g.extra); return tb && { tb, k: g.challenger === uid ? 'c' : 'o' }; };
  api.tcAim = (uid, id, now = Date.now()) => { api.tcExpire(now); return tx(() => { const { g, col, st } = tcMine(uid, id, now), T = tcTb(g, uid);
    if (T) { if (T.tb[T.k] && T.tb[T.k].made != null) err('Ya hiciste tu tiro de desempate de esta ronda'); const green = tcNewGreen(); T.tb[T.k] = { aim: now, green }; db.prepare('UPDATE tc SET extra=? WHERE id=?').run(JSON.stringify(T.tb), g.id); return { aim: now, green, tiebreak: T.tb.r }; }
    if (!st) err('Primero empieza tu concurso'); if (now > st.start + TC_MS) { tcSave(g, col, st, now); err(`Se acabó el tiempo (${TC_MS / 1000} s)`); } st.aim = now; st.green = tcNewGreen(); tcSave(g, col, st, now); return { aim: now, green: st.green }; }); };
  api.tcShoot = (uid, id, now = Date.now()) => { api.tcExpire(now); return tx(() => { const { g, col, st } = tcMine(uid, id, now), T = tcTb(g, uid);
    if (T) { const me = T.tb[T.k]; if (me && me.made != null) err('Ya hiciste tu tiro de desempate de esta ronda'); const r = tcRoll(me && me.aim, me && me.green, now), round = T.tb.r; T.tb[T.k] = { ...r };
      db.prepare('UPDATE tc SET extra=? WHERE id=?').run(JSON.stringify(T.tb), g.id); tcResolve(tcRow(g.id), now); return { tiebreak: round, shot: { ...r, pts: 0 } }; }
    if (!st) err('Primero empieza tu concurso');
    if (now > st.start + TC_MS) { tcSave(g, col, st, now); err(`Se acabó el tiempo (${TC_MS / 1000} s)`); } if (st.shots.length >= TC_N || st.fin) err(`Ya tiraste los ${TC_N} balones`);
    const inPos = st.shots.filter(x => x.pos === st.pos).length; if (inPos >= TC_PER) err(`Ya tiraste los ${TC_PER} balones de esta posición; pasa a la siguiente`);
    const ball = inPos + 1, money = ball === TC_PER, { bar, made, zone, green, label } = tcRoll(st.aim, st.green, now); st.aim = null; st.green = null; const shot = { pos: st.pos, ball, money, made, bar, zone, green, label, pts: made ? POINTS_PER_MAKE : 0, t: now - st.start };
    st.shots.push(shot); tcSave(g, col, st, now); return { shot, points: tcPts(st), left: Math.max(0, st.start + TC_MS - now), done: st.shots.length >= TC_N }; }); };
  api.tcNext = (uid, id, now = Date.now()) => { api.tcExpire(now); return tx(() => { const { g, col, st } = tcMine(uid, id, now); if (!st) err('Primero empieza tu concurso');
    if (now > st.start + TC_MS) { tcSave(g, col, st, now); err(`Se acabó el tiempo (${TC_MS / 1000} s)`); } if (st.pos >= TC_POS.length - 1) err('Ya estás en la última posición');
    st.pos++; tcSave(g, col, st, now); return { pos: st.pos, name: TC_POS[st.pos] }; }); };
  api.tcView = (uid, id, now = Date.now()) => { const g = db.prepare('SELECT x.*, a.username cu, a.display_name cd, b.username ou, b.display_name od FROM tc x JOIN users a ON a.id=x.challenger JOIN users b ON b.id=x.opponent WHERE x.id=?').get(Number(id));
    if (!g || (g.challenger !== uid && g.opponent !== uid)) err('Reto no encontrado'); const mine = g.challenger === uid, ms = JSON.parse((mine ? g.c_st : g.o_st) || 'null'), rs = JSON.parse((mine ? g.o_st : g.c_st) || 'null'), ex = g.extra && JSON.parse(g.extra), done = g.status === 'done';
    return { id: g.id, stake: g.stake, status: g.status, reason: g.reason, mine: mine ? 'sent' : 'received', rival: mine ? (g.od || g.ou) : (g.cd || g.cu),
      expires: g.status === 'pending' ? g.created + PEN_MS : g.status === 'accepted' ? g.accepted_at + PEN_MS : null,
      me: ms && { shots: ms.shots, pos: ms.pos, points: tcPts(ms), left: Math.max(0, ms.start + TC_MS - now), finished: tcDone(ms, now) }, rivalFinished: tcDone(rs, now), rivalStarted: !!rs,
      rivalShots: done ? (rs ? rs.shots : []) : null, rivalPoints: done ? tcPts(rs) : null,
      tiebreak: ex ? { round: ex.r, active: g.status === 'accepted', iShot: !!(ex[mine ? 'c' : 'o'] && ex[mine ? 'c' : 'o'].made != null), rivalShot: !!(ex[mine ? 'o' : 'c'] && ex[mine ? 'o' : 'c'].made != null),
        expires: ex.at + PEN_MS, hist: ex.hist.map(h => ({ my: mine ? h.c : h.o, rival: mine ? h.o : h.c, myBar: mine ? h.cb : h.ob, rivalBar: mine ? h.ob : h.cb })) } : null,
      result: done ? (g.winner === uid ? 'won' : g.winner ? 'lost' : 'tie') : null }; };
  api.tcList = (uid, now = Date.now()) => { api.tcExpire(now); return db.prepare('SELECT id FROM tc WHERE challenger=? OR opponent=? ORDER BY id DESC LIMIT 60').all(uid, uid).map(r => api.tcView(uid, r.id, now)); };

  // Mensajes dentro de retos aceptados: solo en memoria, solo los dos jugadores, se borran al cerrar el reto.
  const CHAT_T = { rps: 'rps', pen: 'pen', bb: 'bb', tc: 'tc' }, chats = new Map(), CHAT_MAX = 140, CHAT_PER = 30, CHAT_GAP = 1000;
  const chatGame = (kind, id) => { if (!CHAT_T[kind]) err('Juego no válido'); return db.prepare(`SELECT id, challenger, opponent, status FROM ${CHAT_T[kind]} WHERE id=?`).get(Number(id)); };
  api.chatPurge = () => { for (const k of [...chats.keys()]) { const [kind, id] = k.split(':'), g = chatGame(kind, id); if (!g || g.status !== 'accepted') chats.delete(k); } };
  const chatCheck = (uid, kind, id) => { const g = chatGame(kind, id); if (!g || (g.challenger !== uid && g.opponent !== uid)) err('No participas en este reto');
    if (g.status !== 'accepted') { chats.delete(kind + ':' + g.id); err('El chat solo está disponible durante un reto aceptado y en curso'); } return kind + ':' + g.id; };
  const escH = t => t.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  api.chatSend = (uid, kind, id, text, now = Date.now()) => { const k = chatCheck(uid, kind, id); text = String(text ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
    if (!text) err('Escribe un mensaje'); if ([...text].length > CHAT_MAX) err(`Máximo ${CHAT_MAX} caracteres`);
    const L = chats.get(k) || []; if (L.length >= CHAT_PER) err(`Máximo ${CHAT_PER} mensajes por reto`);
    const last = L.filter(m => m.uid === uid).pop(); if (last && now - last.at < CHAT_GAP) err('Vas muy rápido; espera un segundo');
    const u = db.prepare('SELECT username, display_name FROM users WHERE id=?').get(uid); L.push({ uid, name: u.display_name || u.username, text: escH(text), at: now }); chats.set(k, L); return { ok: true }; };
  api.chatList = (uid, kind, id) => { const k = chatCheck(uid, kind, id); return (chats.get(k) || []).map(m => ({ name: escH(m.name), text: m.text, at: m.at, mine: m.uid === uid })); };
  for (const f of ['rpsRespond', 'rpsPick', 'rpsExpire', 'penRespond', 'penPlay', 'penExpire', 'bbRespond', 'bbPlan', 'bbExpire', 'tcRespond', 'tcExpire', 'tcStart', 'tcShoot', 'tcNext', 'tcAim']) { const o = api[f]; api[f] = (...a) => { try { return o(...a); } finally { if (chats.size) api.chatPurge(); } }; }
  api.PODIUM_MIN_SETTLED = PODIUM_MIN_SETTLED;
  api.DISABLED_NEW_MINIGAMES = DISABLED_NEW_MINIGAMES;
  api._testAllowDisabled = false;
  return api;
}
module.exports = { rankCmp, winPct, open, BANK, addMonthNY, BONUS, FACIAL, REWARDS, profit, dec, toAmerican, START_COINS, PODIUM_MIN_SETTLED };
