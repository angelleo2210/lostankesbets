const { DatabaseSync } = require('node:sqlite');
const crypto = require('node:crypto');
const START_COINS = 50000;

function profit(stake, odds) {
  odds = Number(odds);
  if (!Number.isFinite(odds) || (odds > -100 && odds < 100)) throw new Error('Cuota inválida (use p.ej. -250 o +880)');
  return Math.floor(odds > 0 ? stake * odds / 100 : stake * 100 / -odds);
}

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
  CREATE TABLE IF NOT EXISTS bets(id INTEGER PRIMARY KEY, user_id INTEGER, line_id INTEGER, option_id INTEGER, stake INTEGER, odds INTEGER, status TEXT DEFAULT 'open', payout INTEGER DEFAULT 0, created TEXT DEFAULT CURRENT_TIMESTAMP);`);
  const tx = fn => { db.exec('BEGIN'); try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; } };
  const err = m => { const e = new Error(m); e.user = true; throw e; };
  const api = {
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
    listInvites: () => db.prepare('SELECT i.code, u.username used_by FROM invites i LEFT JOIN users u ON u.id=i.used_by ORDER BY i.rowid DESC').all(),
    register(code, username, pin) {
      return tx(() => {
        const inv = db.prepare('SELECT * FROM invites WHERE code=?').get(String(code || ''));
        if (!inv) err('Código de invitación inválido'); if (inv.used_by) err('Esa invitación ya se usó');
        const id = api.createUser(username, pin); db.prepare('UPDATE invites SET used_by=? WHERE code=?').run(id, code); return id;
      });
    },
    login(username, pin) {
      const u = db.prepare('SELECT * FROM users WHERE username=?').get(String(username || '').trim());
      if (!u || !crypto.timingSafeEqual(Buffer.from(hash(pin, u.salt).hash, 'hex'), Buffer.from(u.pin_hash, 'hex'))) err('Usuario o PIN incorrecto');
      const t = crypto.randomBytes(24).toString('hex'); db.prepare('INSERT INTO sessions VALUES(?,?)').run(t, u.id); return t;
    },
    userByToken: t => t && db.prepare('SELECT u.id,u.username,u.coins,u.is_admin FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=?').get(t),
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
      });
    },
    myBets: uid => db.prepare('SELECT b.*, l.title, l.kind, o.label FROM bets b JOIN lines l ON l.id=b.line_id JOIN options o ON o.id=b.option_id WHERE b.user_id=? ORDER BY b.id DESC').all(uid),
    leaderboard: () => db.prepare('SELECT username, coins FROM users ORDER BY coins DESC, username').all(),
  };
  return api;
}
module.exports = { open, profit, START_COINS };
