const express = require('express');
const { open } = require('./core');
const odds = require('./odds-api');
const app = express(); const C = open(process.env.DB_FILE || 'data.db');
odds.setKeyProvider(() => C.getOddsApiKey());
if (process.env.ADMIN_PIN && !C.hasAdmin()) C.setupAdmin(process.env.ADMIN_USER || 'angel', process.env.ADMIN_PIN);
app.use(express.json());
// Cache-bust: index.html references each script with ?v=<content hash>; html itself always revalidated.
const fs = require('node:fs'), crypto = require('node:crypto');
const INDEX = fs.readFileSync(__dirname + '/public/index.html', 'utf8').replace(/src="([\w.-]+\.js)"/g, (m, f) => { try { return `src="${f}?v=${crypto.createHash('sha256').update(fs.readFileSync(__dirname + '/public/' + f)).digest('hex').slice(0, 12)}"`; } catch { return m; } });
app.get(['/', '/index.html'], (req, res) => { res.set('Cache-Control', 'no-cache'); res.type('html').send(INDEX); });
// PWA: sw.js (offline page only) always revalidated, root scope.
app.get('/sw.js', (req, res) => { res.set({ 'Cache-Control': 'no-cache', 'Service-Worker-Allowed': '/' }); res.type('application/javascript').sendFile(__dirname + '/public/sw.js'); });
app.get('/manifest.webmanifest', (req, res) => { res.set('Cache-Control', 'no-cache'); res.type('application/manifest+json').sendFile(__dirname + '/public/manifest.webmanifest'); });
app.use(express.static(__dirname + '/public'));
const h = fn => async (req, res) => { try { res.json((await fn(req, res)) ?? { ok: true }); } catch (e) { res.status(e.user ? 400 : 500).json({ error: e.user ? e.message : 'Error del servidor' }); if (!e.user) console.error(e); } };
const auth = (req) => { const u = C.userByToken(req.get('x-token')); if (!u) { const e = new Error('Inicia sesión'); e.user = true; throw e; } return u; };
const admin = (req) => { const u = auth(req); if (!u.is_admin) { const e = new Error('Solo el administrador'); e.user = true; throw e; } return u; };
app.get('/api/status', h(() => ({ hasAdmin: C.hasAdmin() })));
app.post('/api/setup', h(r => { C.setupAdmin(r.body.username, r.body.pin); return { token: C.login(r.body.username, r.body.pin) }; }));
app.post('/api/register', h(r => { C.register(r.body.code, r.body.username, r.body.pin, r.body.avatarCfg); return { token: C.login(r.body.username, r.body.pin) }; }));
app.post('/api/login', h(r => ({ token: C.login(r.body.username, r.body.pin) })));
app.get('/api/me', h(r => { const u = auth(r); return { ...u, streak: C.streak(u.id), retosPend: C.rpsList(u.id).filter(g => g.status === 'pending' && g.mine === 'received').length + C.penList(u.id).filter(g => g.status === 'pending' && g.mine === 'received').length + C.tcList(u.id).filter(g => g.status === 'pending' && g.mine === 'received').length + C.bbList(u.id).filter(g => g.status === 'pending' && g.mine === 'received').length, bets: C.myBets(u.id), parlays: C.myParlays(u.id), bank: C.bankBrief(u.id) }; }));
app.get('/api/lines', h(r => { auth(r); return C.lines(['open', 'closed']); }));
app.get('/api/leaderboard', h(r => { auth(r); return C.leaderboard(r.query.period); }));
app.get('/api/tabla', h(r => { const u = auth(r); const d = C.tabla(r.query.period || 'temporada'); return { ...d, me: u.id }; }));
app.post('/api/bet', h(r => { const u = auth(r); C.placeBet(u.id, r.body.optionId, r.body.stake); }));
app.post('/api/bet/cancel', h(r => C.cancelBet(auth(r).id, r.body.betId)));
app.post('/api/parlay/cancel', h(r => C.cancelParlay(auth(r).id, r.body.parlayId)));
app.post('/api/profile', h(r => { const u = auth(r); return C.setProfile(u.id, r.body.avatar, r.body.display_name, r.body.facialHair, r.body.cosmetics, r.body.avatarCfg); }));
app.get('/api/owned', h(r => { const u = auth(r); return { owned: C.owned(u.id) }; }));
app.get('/api/chat/:kind/:id', h(r => C.chatList(auth(r).id, r.params.kind, r.params.id)));
app.post('/api/chat/:kind/:id', h(r => C.chatSend(auth(r).id, r.params.kind, r.params.id, r.body.text)));
app.get('/api/tc', h(r => { const u = auth(r); return { games: C.tcList(u.id), min: C.RPS_MIN, max: C.RPS_MAX, tc: C.TC, friends: C.users().filter(x => !x.is_admin && x.id !== u.id).map(x => ({ id: x.id, name: x.display_name || x.username })) }; }));
app.post('/api/tc', h(r => C.tcChallenge(auth(r).id, r.body.opponentId, r.body.stake)));
app.post('/api/tc/respond', h(r => C.tcRespond(auth(r).id, r.body.id, !!r.body.accept)));
app.post('/api/tc/start', h(r => C.tcStart(auth(r).id, r.body.id)));
app.post('/api/tc/aim', h(r => C.tcAim(auth(r).id, r.body.id)));
app.post('/api/tc/press', h(r => C.tcAim(auth(r).id, r.body.id)));
app.post('/api/tc/release', h(r => C.tcShoot(auth(r).id, r.body.id)));
app.post('/api/tc/shoot', h(r => C.tcShoot(auth(r).id, r.body.id)));
app.post('/api/tc/next', h(r => C.tcNext(auth(r).id, r.body.id)));
app.get('/api/bb', h(r => { const u = auth(r); return { games: C.bbList(u.id), min: C.RPS_MIN, max: C.RPS_MAX, n: C.BB_N, friends: C.users().filter(x => !x.is_admin && x.id !== u.id).map(x => ({ id: x.id, name: x.display_name || x.username })) }; }));
app.post('/api/bb', h(r => C.bbChallenge(auth(r).id, r.body.opponentId, r.body.stake)));
app.post('/api/bb/respond', h(r => C.bbRespond(auth(r).id, r.body.id, !!r.body.accept)));
app.post('/api/bb/plan', h(r => C.bbPlan(auth(r).id, r.body.id, r.body.pitch, r.body.bat)));
app.get('/api/pen', h(r => { const u = auth(r); return { games: C.penList(u.id), min: C.RPS_MIN, max: C.RPS_MAX, friends: C.users().filter(x => !x.is_admin && x.id !== u.id).map(x => ({ id: x.id, name: x.display_name || x.username })) }; }));
app.post('/api/pen', h(r => C.penChallenge(auth(r).id, r.body.opponentId, r.body.stake)));
app.post('/api/pen/respond', h(r => C.penRespond(auth(r).id, r.body.id, !!r.body.accept)));
app.post('/api/pen/play', h(r => C.penPlay(auth(r).id, r.body.id, r.body.shot, r.body.save)));
app.get('/api/rps', h(r => { const u = auth(r); return { games: C.rpsList(u.id), min: C.RPS_MIN, max: C.RPS_MAX, friends: C.users().filter(x => !x.is_admin && x.id !== u.id).map(x => ({ id: x.id, name: x.display_name || x.username })) }; }));
app.post('/api/rps', h(r => C.rpsChallenge(auth(r).id, r.body.opponentId, r.body.stake)));
app.post('/api/rps/respond', h(r => C.rpsRespond(auth(r).id, r.body.id, !!r.body.accept)));
app.post('/api/rps/pick', h(r => C.rpsPick(auth(r).id, r.body.id, r.body.pick)));
app.get('/api/roulette', h(r => { const u = auth(r); return { history: C.rouletteHistory(u.id), board: C.rouletteBoard(), coins: u.coins, limits: C.ROULETTE }; }));
app.post('/api/roulette/spin', h(r => { const u = auth(r); return C.rouletteSpin(u.id, r.body.bets, r.body.idem); }));
app.get('/api/roulette/live', h(r => { const u = auth(r); return C.livePublicState(u.id); }));
app.post('/api/roulette/live/bet', h(r => { const u = auth(r); const out = C.liveBet(u.id, r.body.bets, r.body.idem); try { liveBroadcast(); } catch {} return out; }));
const liveClients = new Set();
function liveBroadcast() {
  if (!liveClients.size) return;
  for (const res of [...liveClients]) {
    try { res.write('data: ' + JSON.stringify(C.livePublicState(res.liveUid)) + '\n\n'); }
    catch (e) { liveClients.delete(res); try { res.end(); } catch {} }
  }
}
app.get('/api/roulette/live/stream', (req, res) => {
  const token = req.get('x-token') || req.query.token;
  const u = C.userByToken(token);
  if (!u) { res.status(401).json({ error: 'Inicia sesión' }); return; }
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  if (typeof res.flushHeaders === 'function') res.flushHeaders();
  res.liveUid = u.id;
  liveClients.add(res);
  try { res.write('data: ' + JSON.stringify(C.livePublicState(u.id)) + '\n\n'); } catch {}
  const ping = setInterval(() => { try { res.write(': ping\n\n'); } catch { clearInterval(ping); } }, 15000);
  req.on('close', () => { clearInterval(ping); liveClients.delete(res); });
});
app.get('/api/bonus', h(r => C.bonusStatus(auth(r).id)));
app.get('/api/bank', h(r => C.bankStatus(auth(r).id)));
app.post('/api/bank/loan', h(r => C.takeLoan(auth(r).id, r.body.amount)));
app.post('/api/bank/pay', h(r => C.payDebtFull(auth(r).id, r.body.expectedDebt)));
app.post('/api/bank/bankruptcy', h(r => C.declareBankruptcy(auth(r).id)));
app.get('/api/admin/bank', h(r => { admin(r); return C.bankClosedUsers(); }));
app.post('/api/admin/bank/reset', h(r => C.adminFreshStart(admin(r).id, r.body.userId, r.body.confirm)));
app.post('/api/bonus', h(r => C.claimBonus(auth(r).id)));
app.get('/api/rewards', h(r => { auth(r); return require('./core').REWARDS; }));
app.post('/api/parlay', h(r => { const u = auth(r); return { id: C.placeParlay(u.id, r.body.optionIds, r.body.stake) }; }));
app.get('/api/real', h(async r => { auth(r); return odds.upcoming(r.query.sport); }));
app.get('/api/real/sports', h(r => { auth(r); return { default: odds.DEFAULT_SPORT, sports: odds.SOCCER.map(([key, name]) => ({ key, name })) }; }));
app.post('/api/admin/import', h(async r => { admin(r); const d = await odds.upcoming(r.body.sport); if (d.error) return d;
  const e = d.events.find(x => x.id === r.body.eventId); if (!e) return { error: 'Evento no encontrado' };
  return { ids: C.createEvent({ ...e, title: `${e.sport}: ${e.title}` }, 'real') }; }));
app.get('/api/admin/odds-key', h(r => { admin(r); return C.oddsKeyStatus(); }));
app.post('/api/admin/odds-key', h(r => { admin(r); return C.setOddsApiKey(r.body && r.body.key); }));
app.post('/api/admin/odds-key/delete', h(r => { admin(r); return C.deleteOddsApiKey(); }));
app.get('/api/admin/odds-settle', h(r => { admin(r); return C.autoSettleStatus(); }));
app.post('/api/admin/odds-settle', h(r => { admin(r); return C.setAutoSettleEnabled(!!(r.body && r.body.enabled)); }));

app.post('/api/admin/odds-search', h(async r => { admin(r);
  const d = await odds.searchNew(r.body && r.body.sports);
  if (d.events) d.events = d.events.map(e => ({ ...e, imported: C.hasImportedEvent(e.id) }));
  return d;
}));
app.post('/api/admin/odds-add', h(r => { admin(r);
  const ids = Array.isArray(r.body && r.body.eventIds) ? r.body.eventIds : [];
  if (!ids.length) return { error: 'Elige al menos un partido' };
  const added = [], skipped = [], missing = [];
  for (const id of ids) {
    const evId = String(id);
    if (C.hasImportedEvent(evId)) { skipped.push(evId); continue; }
    const e = odds.cachedEvent(evId);
    if (!e) { missing.push(evId); continue; }
    added.push({ id: evId, ids: C.createEvent({ ...e, title: `${e.sport}: ${e.title}` }, 'real') });
  }
  if (missing.length && !added.length && !skipped.length) return { error: 'Vuelve a buscar los partidos antes de agregarlos' };
  return { added, skipped, missing };
}));
app.post('/api/admin/lines/:id/sport', h(r => C.setEventSport(admin(r).id, r.params.id, r.body.sport || null)));
app.post('/api/admin/lines/:id/start', h(r => C.setEventStart(admin(r).id, r.params.id, r.body.starts ?? null)));
app.post('/api/admin/lines/:id/pause', h(r => C.setEventPaused(admin(r).id, r.params.id, !!r.body.paused)));
app.post('/api/admin/events', h(r => { admin(r); return { ids: C.createEvent({ ...r.body, id: 'custom:' + require('node:crypto').randomUUID() }) }; }));
app.post('/api/admin/lines/:id/markets', h(r => { admin(r); return { id: C.addEventMarket(r.params.id, r.body.market, r.body.options, r.body.home, r.body.away, r.body.unit, r.body.prop_title) }; }));
app.post('/api/admin/lines/:id/remove-prop', h(r => { C.removeProp(admin(r).id, r.params.id); }));
app.post('/api/admin/lines/:id/push', h(r => { admin(r); C.pushLine(r.params.id); }));
app.post('/api/admin/lines', h(r => { admin(r); return { id: C.createLine(r.body.title, r.body.options) }; }));
app.post('/api/admin/lines/:id/close', h(r => { admin(r); C.closeLine(Number(r.params.id)); }));
app.post('/api/admin/lines/:id/settle', h(r => { admin(r); C.settleLine(r.params.id, r.body.optionId); }));
app.post('/api/admin/lines/:id/cancel', h(r => { admin(r); C.cancelLine(r.params.id); }));
app.get('/api/admin/users', h(r => { admin(r); return C.users(); }));
app.get('/api/admin/topups', h(r => { admin(r); return C.topups(); }));
app.post('/api/admin/topup', h(r => { const a = admin(r); return C.topup(a.id, r.body.userId, r.body.amount); }));
app.post('/api/admin/invites', h(r => { admin(r); return { code: C.newInvite() }; }));
app.get('/api/admin/invites', h(r => { admin(r); return C.listInvites(); }));
const port = process.env.PORT || 3000; app.listen(port, () => {
  try { C.liveRecover(); } catch (e) { console.error('LIVE_ROULETTE_RECOVER', e && e.message); }
  setInterval(() => { try { C.liveTick(); liveBroadcast(); } catch (e) { if (e && !e.user) console.error('LIVE_ROULETTE_TICK', e && e.message); } }, 1000);
  // Slot check only (6 p.m. and midnight ET, plus a 2h catch-up after restart). Does not poll scores every minute.
  const settleTick = () => { C.autoSettleTick().catch(e => { if (e && !e.user) console.error('AUTO_SETTLE', e && e.message); }); };
  setTimeout(settleTick, 10 * 1000);
  setInterval(settleTick, 60 * 1000);
  try {
    const points = C.auditDupPoints();
    const stats = C.auditDupStats();
    console.log('DUP_POINTS_AUDIT ' + JSON.stringify(points));
    console.log('DUP_STATS_AUDIT ' + JSON.stringify(stats));
    const dir = require('node:path').dirname(process.env.DB_FILE || 'data.db');
    fs.writeFileSync(require('node:path').join(dir, 'dup-points-audit.json'), JSON.stringify({ ts: Date.now(), report: points }, null, 2));
    fs.writeFileSync(require('node:path').join(dir, 'dup-stats-audit.json'), JSON.stringify({ ts: Date.now(), report: stats }, null, 2));
    const loans = C.auditLoanCycles();
    console.log('LOAN_LIMIT_AUDIT ' + JSON.stringify(loans));
    fs.writeFileSync(require('node:path').join(dir, 'loan-limit-audit.json'), JSON.stringify({ ts: Date.now(), report: loans }, null, 2));
  } catch (e) { console.error('DUP_POINTS_AUDIT_ERROR', e && e.message); }
  console.log('LosTankesBets en http://localhost:' + port);
});
