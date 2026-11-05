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
  const ucols = db.prepare('PRAGMA table_info(users)').all().map(c => c.name);
  if (!ucols.includes('avatar')) db.exec('ALTER TABLE users ADD COLUMN avatar TEXT');
  if (!ucols.includes('display_name')) db.exec('ALTER TABLE users ADD COLUMN display_name TEXT');
  if (!ucols.includes('avatar_cfg')) db.exec('ALTER TABLE users ADD COLUMN avatar_cfg TEXT');
  if (!ucols.includes('cosmetics')) db.exec('ALTER TABLE users ADD COLUMN cosmetics TEXT');
  if (!ucols.includes('last_bonus')) db.exec('ALTER TABLE users ADD COLUMN last_bonus INTEGER');
  if (!ucols.includes('facial_hair')) db.exec('ALTER TABLE users ADD COLUMN facial_hair TEXT');
  db.exec('CREATE TABLE IF NOT EXISTS purchases(user_id INTEGER, item_id TEXT, price INTEGER, color TEXT, created TEXT DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(user_id, item_id))');
  if (!db.prepare('PRAGMA table_info(purchases)').all().some(c => c.name === 'color')) db.exec('ALTER TABLE purchases ADD COLUMN color TEXT');
  const tx = fn => { db.exec('BEGIN'); try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; } };
  const err = m => { const e = new Error(m); e.user = true; throw e; };
  const api = {
    owned: uid => db.prepare('SELECT item_id, color, price, created FROM purchases WHERE user_id=? ORDER BY created').all(Number(uid)).map(o => ({ ...o, color: ST.norm(o.item_id, o.color) })),
    buyItem: (uid, itemId, color) => { const i = ST.byId(itemId); if (!i) err('Artículo no existe');
      if (color != null && !ST.valid(itemId, color)) err('Color inválido');
      return tx(() => { if (db.prepare('SELECT 1 FROM purchases WHERE user_id=? AND item_id=?').get(uid, itemId)) err('Ya es tuyo');
        const r = db.prepare('UPDATE users SET coins=coins-? WHERE id=? AND coins>=?').run(i.price, uid, i.price); if (!r.changes) err('No tienes monedas suficientes');
        db.prepare('INSERT INTO purchases(user_id,item_id,price,color) VALUES(?,?,?,?)').run(uid, itemId, i.price, color || i.color);
        return { coins: db.prepare('SELECT coins FROM users WHERE id=?').get(uid).coins }; }); },
    setItemColor: (uid, itemId, color) => { if (!ST.valid(itemId, color)) err('Color inválido');
      if (!db.prepare('UPDATE purchases SET color=? WHERE user_id=? AND item_id=?').run(color, uid, itemId).changes) err('No es tuyo'); return { ok: true }; },
    // Venta: devuelve 50% de lo pagado y el artículo vuelve a la tienda (atómico).
    sellItem: (uid, itemId) => tx(() => { const p = db.prepare('SELECT price FROM purchases WHERE user_id=? AND item_id=?').get(uid, itemId); if (!p) err('No es tuyo');
      const refund = Math.floor(p.price / 2); db.prepare('DELETE FROM purchases WHERE user_id=? AND item_id=?').run(uid, itemId);
      db.prepare('UPDATE users SET coins=coins+? WHERE id=?').run(refund, uid); if (api._unequip) api._unequip(uid, itemId);
      return { refund, coins: db.prepare('SELECT coins FROM users WHERE id=?').get(uid).coins }; }),
    // Bono diario idempotente: una vez cada 24 h; repetir antes devuelve claimed:false sin sumar.
    bonusStatus: (uid, now = Date.now()) => { const l = db.prepare('SELECT last_bonus FROM users WHERE id=?').get(uid)?.last_bonus; const next = l ? Number(l) + BONUS_MS : 0;
      return { amount: BONUS, available: now >= next, nextAt: next > now ? next : null, msLeft: Math.max(0, next - now) }; },
    claimBonus: (uid, now = Date.now()) => tx(() => { const r = db.prepare('UPDATE users SET coins=coins+?, last_bonus=? WHERE id=? AND (last_bonus IS NULL OR last_bonus<=?)').run(BONUS, now, uid, now - BONUS_MS);
      const coins = db.prepare('SELECT coins FROM users WHERE id=?').get(uid).coins; return { claimed: !!r.changes, coins, ...api.bonusStatus(uid, now) }; }),
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
        return Number(db.prepare('INSERT INTO bets(user_id,line_id,option_id,stake,odds) VALUES(?,?,?,?,?)').run(userId, o.line_id, o.id, stake, o.odds).lastInsertRowid);
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
        const pid = Number(db.prepare('INSERT INTO parlays(user_id,stake) VALUES(?,?)').run(userId, stake).lastInsertRowid);
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
      if (avatarCfg !== undefined && avatarCfg !== null) { api.refreshRanks(); const v = AV.validate(avatarCfg, new Set(api.unlocksOf(uid).map(u => u.item_id))); if (v.error) err(v.error); acfg = v.cfg; }
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
    leaderboard: () => { const rk = api.refreshRanks(); return db.prepare('SELECT id, username, avatar, display_name, facial_hair, cosmetics, avatar_cfg, coins, (SELECT COUNT(*) FROM bets b WHERE b.user_id=users.id AND b.status=\'won\') + (SELECT COUNT(*) FROM parlays p WHERE p.user_id=users.id AND p.status=\'won\') wins FROM users ORDER BY wins DESC, coins DESC, username').all().map(r => { const { id, ...o } = deco(r, r.id, rk); return o; }); },
    ranks() { const m = new Map(); db.prepare('SELECT id, (SELECT COUNT(*) FROM bets b WHERE b.user_id=users.id AND b.status=\'won\') + (SELECT COUNT(*) FROM parlays p WHERE p.user_id=users.id AND p.status=\'won\') wins FROM users WHERE is_admin=0 AND wins>0 ORDER BY wins DESC, coins DESC, username LIMIT 3').all().forEach((u, i) => m.set(u.id, i + 1)); return m; },
    refreshRanks() { const m = api.ranks(); const ins = db.prepare('INSERT OR IGNORE INTO unlocks(user_id,item_id,rank) VALUES(?,?,?)');
      for (const [uid, rank] of m) for (const it of REWARDS) if (rank <= it.minRank) ins.run(uid, it.id, rank); return m; },
    unlocksOf: uid => db.prepare('SELECT item_id, rank, created FROM unlocks WHERE user_id=? ORDER BY created').all(uid),
  };
  return api;
}
module.exports = { open, BONUS, FACIAL, REWARDS, profit, dec, toAmerican, START_COINS };
