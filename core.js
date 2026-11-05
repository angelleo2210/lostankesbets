const { DatabaseSync } = require('node:sqlite');
const crypto = require('node:crypto');
const AV = require('./public/avatar'); const ST = require('./public/store');
const START_COINS = 50000; const BONUS = 5000, BONUS_MS = 24 * 3600 * 1000; const MAX_TOPUP = 10000000;

function profit(stake, odds) {
  odds = Number(odds);
  if (!Number.isFinite(odds) || (odds > -100 && odds < 100)) throw new Error('Cuota inválida (use p.ej. -250 o +880)');
  return Math.floor(odds > 0 ? stake * odds / 100 : stake * 100 / -odds);
}

const dec = o => (o > 0 ? 1 + o / 100 : 1 + 100 / -o);
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
const bbHalf = (pitch, bat, off = 0) => { let runs = 0, balls = 0, strikes = 0; const ev = [];
  for (let i = 0; i < BB_N; i++) { const p = pitch[(i + off) % BB_N], b = bat[(i + off) % BB_N]; let e;
    if (p === 'strike' && b === 'swing') { runs++; balls = 0; e = 'jonron'; }
    else if (p === 'strike') e = 'ponche';
    else if (b === 'swing') { strikes++; e = strikes >= 3 ? 'out' : 'strike'; }
    else { balls++; e = 'bola'; if (balls >= 4) { runs++; balls = 0; e = 'base'; } }
    ev.push({ p, b, e, runs, balls, strikes }); if (e === 'ponche' || e === 'out') break; }
  return { runs, ev }; };
const bbGame = (cp, op) => { const innings = []; let c = 0, o = 0;
  for (let k = 0; k <= BB_EXTRA; k++) { const top = bbHalf(op.pitch, cp.bat, k), bot = bbHalf(cp.pitch, op.bat, k); c += top.runs; o += bot.runs; innings.push({ n: k + 1, top, bot });
    if (c !== o) break; }
  return { c, o, innings }; };
const RPS = ['piedra', 'papel', 'tijera'], BEATS = { piedra: 'tijera', tijera: 'papel', papel: 'piedra' }, RPS_MIN = 10, RPS_MAX = 25000, RPS_MS = 24 * 3600e3;
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
  db.exec('CREATE TABLE IF NOT EXISTS bb(id INTEGER PRIMARY KEY, challenger INTEGER, opponent INTEGER, stake INTEGER, status TEXT, created INTEGER, accepted_at INTEGER, c_plan TEXT, o_plan TEXT, winner INTEGER, reason TEXT, result TEXT, resolved INTEGER)');
  db.exec('CREATE TABLE IF NOT EXISTS rps(id INTEGER PRIMARY KEY, challenger INTEGER, opponent INTEGER, stake INTEGER, status TEXT, c_pick TEXT, o_pick TEXT, winner INTEGER, created INTEGER, resolved INTEGER)');
  const ucols = db.prepare('PRAGMA table_info(users)').all().map(c => c.name);
  if (!ucols.includes('avatar')) db.exec('ALTER TABLE users ADD COLUMN avatar TEXT');
  if (!ucols.includes('display_name')) db.exec('ALTER TABLE users ADD COLUMN display_name TEXT');
  if (!ucols.includes('avatar_cfg')) db.exec('ALTER TABLE users ADD COLUMN avatar_cfg TEXT');
  if (!ucols.includes('cosmetics')) db.exec('ALTER TABLE users ADD COLUMN cosmetics TEXT');
  for (const t of ['bets', 'parlays']) if (!db.prepare(`PRAGMA table_info(${t})`).all().some(c => c.name === 'ts')) db.exec(`ALTER TABLE ${t} ADD COLUMN ts INTEGER`);
  let tick = 0; const now = () => Date.now() * 1000 + (tick++ % 1000);
  if (!ucols.includes('last_bonus')) db.exec('ALTER TABLE users ADD COLUMN last_bonus INTEGER');
  if (!ucols.includes('facial_hair')) db.exec('ALTER TABLE users ADD COLUMN facial_hair TEXT');
  db.exec('CREATE TABLE IF NOT EXISTS purchases(user_id INTEGER, item_id TEXT, price INTEGER, color TEXT, created TEXT DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(user_id, item_id))');
  if (!db.prepare('PRAGMA table_info(purchases)').all().some(c => c.name === 'color')) db.exec('ALTER TABLE purchases ADD COLUMN color TEXT');
  const tx = fn => { db.exec('BEGIN'); try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; } };
  const err = m => { const e = new Error(m); e.user = true; throw e; };
  const getCfg = uid => { try { return AV.norm(JSON.parse(db.prepare('SELECT avatar_cfg FROM users WHERE id=?').get(uid)?.avatar_cfg || 'null')); } catch { return AV.norm(null); } };
  const editWear = (uid, fn) => { const c = getCfg(uid); fn(c.wear); db.prepare('UPDATE users SET avatar_cfg=? WHERE id=?').run(JSON.stringify(c), uid); };
  // Migración: la Gorra antigua (acc_gorra) pasa a la Gorra Casual nueva; si ya la tenía, se devuelve lo pagado. Sin pérdidas.
  tx(() => { for (const o of db.prepare("SELECT user_id, price FROM purchases WHERE item_id='acc_gorra'").all()) {
    if (db.prepare("SELECT 1 FROM purchases WHERE user_id=? AND item_id='head_gorra_casual'").get(o.user_id)) { db.prepare("DELETE FROM purchases WHERE user_id=? AND item_id='acc_gorra'").run(o.user_id); db.prepare('UPDATE users SET coins=coins+? WHERE id=?').run(o.price || 0, o.user_id); }
    else db.prepare("UPDATE purchases SET item_id='head_gorra_casual' WHERE user_id=? AND item_id='acc_gorra'").run(o.user_id); } });
  const api = {
    // Capas del avatar: solo se equipa lo que el usuario posee; color = el del artículo comprado.
    _unequip: (uid, itemId) => editWear(uid, w => { for (const k in w) if (w[k].id === itemId) delete w[k]; }),
    owned: uid => db.prepare('SELECT item_id, color, price, created FROM purchases WHERE user_id=? ORDER BY created').all(Number(uid)).map(o => ({ ...o, color: ST.norm(o.item_id, o.color) })),
    buyItem: (uid, itemId, color) => { const i = ST.byId(itemId); if (!i) err('Artículo no existe');
      if (color != null && !ST.valid(itemId, color)) err('Color inválido');
      return tx(() => { if (db.prepare('SELECT 1 FROM purchases WHERE user_id=? AND item_id=?').get(uid, itemId)) err('Ya es tuyo');
        const r = db.prepare('UPDATE users SET coins=coins-? WHERE id=? AND coins>=?').run(i.price, uid, i.price); if (!r.changes) err('No tienes monedas suficientes');
        db.prepare('INSERT INTO purchases(user_id,item_id,price,color) VALUES(?,?,?,?)').run(uid, itemId, i.price, color || i.color);
        if (AV.LAYERS[itemId]) editWear(uid, w => { w[AV.LAYERS[itemId][0]] = { id: itemId, color: color || i.color }; });
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
      return last === 'won' && n >= 3 ? { kind: 'fuego', n, intense: n >= 6 } : last === 'lost' && n >= 2 ? { kind: 'hielo', n, intense: n >= 6 } : null; },
    // Piedra/Papel/Tijera entre amigos. Apuestas retenidas al retar/aceptar; ganador se lleva el bote; empate devuelve.
    RPS_MIN, RPS_MAX, RPS_MS,
    bbHalf, bbGame, BB_N,
    bbExpire: (now = Date.now()) => tx(() => {
      db.prepare("UPDATE bb SET status='expired', resolved=? WHERE status='pending' AND created<=?").run(now, now - PEN_MS);
      for (const g of db.prepare("SELECT * FROM bb WHERE status='accepted' AND accepted_at<=?").all(now - PEN_MS)) {
        if (!g.c_plan && !g.o_plan) { if (db.prepare("UPDATE bb SET status='expired', reason='ninguno jugó', resolved=? WHERE id=? AND status='accepted'").run(now, g.id).changes) db.prepare('UPDATE users SET coins=coins+? WHERE id IN (?,?)').run(g.stake, g.challenger, g.opponent); }
        else { const w = g.c_plan ? g.challenger : g.opponent; if (db.prepare("UPDATE bb SET status='done', winner=?, reason='abandono', resolved=? WHERE id=? AND status='accepted'").run(w, now, g.id).changes) db.prepare('UPDATE users SET coins=coins+? WHERE id=?').run(2 * g.stake, w); } } }),
    bbChallenge: (uid, oppId, stake, now = Date.now()) => { stake = Number(stake); oppId = Number(oppId);
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
          else { const w = r.c > r.o ? g.challenger : g.opponent; if (!db.prepare("UPDATE bb SET status='done', winner=?, reason='carreras', result=?, resolved=? WHERE id=? AND status='accepted'").run(w, JSON.stringify(r), now, id).changes) err('Reto ya resuelto'); db.prepare('UPDATE users SET coins=coins+? WHERE id=?').run(2 * g.stake, w); } }
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
          if (db.prepare("UPDATE pen SET status='done', winner=?, reason='abandono', resolved=? WHERE id=? AND status='accepted'").run(w, now, g.id).changes) db.prepare('UPDATE users SET coins=coins+? WHERE id=?').run(2 * g.stake, w); } } }),
    penChallenge: (uid, oppId, stake, now = Date.now()) => { stake = Number(stake); oppId = Number(oppId);
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
          db.prepare('UPDATE users SET coins=coins+? WHERE id=?').run(2 * g.stake, w); }
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
        if (w) db.prepare('UPDATE users SET coins=coins+? WHERE id=?').run(n.stake * 2, w); else db.prepare('UPDATE users SET coins=coins+? WHERE id IN (?,?)').run(n.stake, n.challenger, n.opponent); }
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
    listInvites: () => { const rk = api.refreshRanks(); return db.prepare('SELECT i.code, u.username used_by, u.avatar, u.display_name, u.facial_hair, u.cosmetics, u.avatar_cfg, u.id uid FROM invites i LEFT JOIN users u ON u.id=i.used_by ORDER BY i.rowid DESC').all().map(r => { const { uid, ...o } = deco(r, uid, rk); return o; }); },
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
      return tx(() => {
        const id = Number(db.prepare('INSERT INTO lines(title,kind,event_id,starts) VALUES(?,?,?,?)').run(title, extra.kind || 'custom', extra.event_id || null, extra.starts || null).lastInsertRowid);
        for (const o of opts) db.prepare('INSERT INTO options(line_id,label,odds) VALUES(?,?,?)').run(id, String(o.label).trim(), Math.trunc(Number(o.odds)));
        return id;
      });
    },
    lines(statusFilter) {
      const ls = db.prepare(`SELECT * FROM lines ${statusFilter ? 'WHERE status IN (' + statusFilter.map(() => '?').join(',') + ')' : ''} ORDER BY id DESC`).all(...(statusFilter || []));
      return ls.map(l => ({ ...l, options: db.prepare('SELECT * FROM options WHERE line_id=?').all(l.id) }));
    },
    placeBet(userId, optionId, stake) {
      stake = Number(stake);
      if (!Number.isInteger(stake) || stake <= 0) err('La apuesta debe ser un número entero mayor que 0');
      return tx(() => {
        const o = db.prepare('SELECT o.*, l.status FROM options o JOIN lines l ON l.id=o.line_id WHERE o.id=?').get(Number(optionId));
        if (!o) err('Opción no existe'); if (o.status !== 'open') err('Esta línea ya no acepta apuestas');
        const u = db.prepare('SELECT coins FROM users WHERE id=?').get(userId);
        if (u.coins < stake) err('No tienes suficientes monedas');
        db.prepare('UPDATE users SET coins=coins-? WHERE id=?').run(stake, userId);
        return Number(db.prepare('INSERT INTO bets(user_id,line_id,option_id,stake,odds,ts) VALUES(?,?,?,?,?,?)').run(userId, o.line_id, o.id, stake, o.odds, now()).lastInsertRowid);
      });
    },
    placeParlay(userId, optionIds, stake) {
      stake = Number(stake);
      if (!Array.isArray(optionIds) || optionIds.length < 2 || optionIds.length > 15) err('El parlay debe tener de 2 a 15 selecciones');
      const ids = optionIds.map(Number);
      if (new Set(ids).size !== ids.length) err('Selecciones repetidas');
      if (!Number.isInteger(stake) || stake <= 0) err('La apuesta debe ser un número entero mayor que 0');
      return tx(() => {
        const legs = ids.map(id => {
          const o = db.prepare('SELECT o.*, l.status FROM options o JOIN lines l ON l.id=o.line_id WHERE o.id=?').get(id);
          if (!o) err('Opción no existe'); if (o.status !== 'open') err('Una de las líneas ya no acepta apuestas'); return o;
        });
        if (new Set(legs.map(o => o.line_id)).size !== legs.length) err('Solo una selección por línea');
        const u = db.prepare('SELECT coins FROM users WHERE id=?').get(userId);
        if (u.coins < stake) err('No tienes suficientes monedas');
        db.prepare('UPDATE users SET coins=coins-? WHERE id=?').run(stake, userId);
        const pid = Number(db.prepare('INSERT INTO parlays(user_id,stake,ts) VALUES(?,?,?)').run(userId, stake, now()).lastInsertRowid);
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
        if (legs.some(g => g.status === 'lost')) { db.prepare("UPDATE parlays SET status='lost' WHERE id=? AND status='open'").run(pid); continue; }
        if (legs.some(g => g.status === 'open')) continue;
        const live = legs.filter(g => g.status === 'won');
        const [st, pay] = live.length ? ['won', Math.floor(p.stake * live.reduce((m, g) => m * dec(g.odds), 1))] : ['refunded', p.stake];
        if (db.prepare("UPDATE parlays SET status=?, payout=? WHERE id=? AND status='open'").run(st, pay, pid).changes === 1)
          db.prepare('UPDATE users SET coins=coins+? WHERE id=?').run(pay, p.user_id);
      }
    },
    myParlays: uid => db.prepare('SELECT * FROM parlays WHERE user_id=? ORDER BY id DESC').all(uid).map(p => {
      const legs = db.prepare('SELECT g.*, l.title, o.label FROM parlay_legs g JOIN lines l ON l.id=g.line_id JOIN options o ON o.id=g.option_id WHERE g.parlay_id=? ORDER BY g.id').all(p.id);
      const d = legs.filter(g => g.status !== 'cancelled').reduce((m, g) => m * dec(g.odds), 1);
      return { ...p, legs, odds: d > 1 ? toAmerican(d) : null, potential: Math.floor(p.stake * d) };
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
            db.prepare("UPDATE bets SET status='won', payout=? WHERE id=?").run(pay, b.id);
            db.prepare('UPDATE users SET coins=coins+? WHERE id=?').run(pay, b.user_id);
          } else db.prepare("UPDATE bets SET status='lost' WHERE id=?").run(b.id);
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
    myBets: uid => db.prepare('SELECT b.*, l.title, l.kind, o.label FROM bets b JOIN lines l ON l.id=b.line_id JOIN options o ON o.id=b.option_id WHERE b.user_id=? ORDER BY b.id DESC').all(uid),
    setProfile(uid, avatar, displayName, facialHair, cosmetics, avatarCfg) {
      let cos, acfg;
      if (avatarCfg !== undefined && avatarCfg !== null) { api.refreshRanks(); const v = AV.validate(avatarCfg, new Set(api.unlocksOf(uid).map(u => u.item_id))); if (v.error) err(v.error); acfg = v.cfg;
        const own = new Map(api.owned(uid).map(o => [o.item_id, o.color])); for (const k in acfg.wear) { const id = acfg.wear[k].id; if (!own.has(id)) err('No tienes ese artículo: ' + (ST.byId(id)?.name || id)); acfg.wear[k].color = own.get(id); } }
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
    leaderboard: () => { const rk = api.refreshRanks(); return db.prepare('SELECT id, username, avatar, display_name, facial_hair, cosmetics, avatar_cfg, coins, (SELECT COUNT(*) FROM bets b WHERE b.user_id=users.id AND b.status=\'won\') + (SELECT COUNT(*) FROM parlays p WHERE p.user_id=users.id AND p.status=\'won\') wins FROM users ORDER BY wins DESC, coins DESC, username').all().map(r => { const { id, ...o } = deco(r, r.id, rk); return { ...o, streak: api.streak(id) }; }); },
    ranks() { const m = new Map(); db.prepare('SELECT id, (SELECT COUNT(*) FROM bets b WHERE b.user_id=users.id AND b.status=\'won\') + (SELECT COUNT(*) FROM parlays p WHERE p.user_id=users.id AND p.status=\'won\') wins FROM users WHERE is_admin=0 AND wins>0 ORDER BY wins DESC, coins DESC, username LIMIT 3').all().forEach((u, i) => m.set(u.id, i + 1)); return m; },
    refreshRanks() { const m = api.ranks(); const ins = db.prepare('INSERT OR IGNORE INTO unlocks(user_id,item_id,rank) VALUES(?,?,?)');
      for (const [uid, rank] of m) for (const it of REWARDS) if (rank <= it.minRank) ins.run(uid, it.id, rank); return m; },
    unlocksOf: uid => db.prepare('SELECT item_id, rank, created FROM unlocks WHERE user_id=? ORDER BY created').all(uid),
  };
  // Mensajes dentro de retos aceptados: solo en memoria, solo los dos jugadores, se borran al cerrar el reto.
  const CHAT_T = { rps: 'rps', pen: 'pen', bb: 'bb' }, chats = new Map(), CHAT_MAX = 140, CHAT_PER = 30, CHAT_GAP = 1000;
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
  for (const f of ['rpsRespond', 'rpsPick', 'rpsExpire', 'penRespond', 'penPlay', 'penExpire', 'bbRespond', 'bbPlan', 'bbExpire']) { const o = api[f]; api[f] = (...a) => { try { return o(...a); } finally { if (chats.size) api.chatPurge(); } }; }
  return api;
}
module.exports = { open, BONUS, FACIAL, REWARDS, profit, dec, toAmerican, START_COINS };
