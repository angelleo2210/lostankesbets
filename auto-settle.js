// Automatic settlement of Odds API–imported events from the scores endpoint.
// Soccer: bookmakers usually grade 90' + stoppage (not ET/penalties). The Odds API
// returns a single final score and does not split ET; knockout games that go to
// extra time may need a manual check. NBA/NHL/MLB use the final score as reported (OT included).
const odds = require('./odds-api');

const FETCH_MS = 45 * 60e3;
const GIVE_UP_MS = 3 * 24 * 3600e3;
const DURATION = {
  soccer: 2.5 * 3600e3,
  basketball: 3 * 3600e3,
  hockey: 3 * 3600e3,
  baseball: 3.5 * 3600e3,
};
const SETTLED_MARKETS = new Set(['h2h', 'spreads', 'totals']);

function autoSportOk(key) {
  const k = String(key || '');
  if (/^mma_/.test(k) || /^boxing_/.test(k)) return false;
  return /^soccer_/.test(k) || k === 'basketball_nba' || k === 'icehockey_nhl' || k === 'baseball_mlb';
}
function durationMs(sportKey) {
  const k = String(sportKey || '');
  if (/^soccer_/.test(k)) return DURATION.soccer;
  if (/^baseball_/.test(k)) return DURATION.baseball;
  if (/^basketball_/.test(k) || /^icehockey_/.test(k)) return DURATION.basketball;
  return DURATION.basketball;
}
function isSoccer(sportKey) { return /^soccer_/.test(String(sportKey || '')); }

function titleSportKey(title) {
  const t = String(title || '');
  const rows = []
    .concat(odds.SEARCH_SPORTS || [])
    .concat(odds.SOCCER || []);
  const seen = new Set();
  for (const [key, name] of rows) {
    if (!key || !name || seen.has(key)) continue;
    seen.add(key);
    if (t.startsWith(name + ':') || t.startsWith(name + ' :')) return key;
  }
  return null;
}

function parseScoreEvent(ev) {
  if (!ev || ev.completed !== true || !Array.isArray(ev.scores)) return null;
  const num = s => { const n = Number(s); return Number.isFinite(n) ? n : null; };
  const home = ev.scores.find(s => s && s.name === ev.home_team);
  const away = ev.scores.find(s => s && s.name === ev.away_team);
  const homeScore = home && num(home.score), awayScore = away && num(away.score);
  if (homeScore == null || awayScore == null) return null;
  return { id: ev.id, sport_key: ev.sport_key, home: ev.home_team, away: ev.away_team, homeScore, awayScore };
}

function optName(o) { return String((o && (o.outcome || o.label)) || '').trim(); }

function decideLine(line, homeScore, awayScore, sportKey) {
  const market = line.market || 'h2h';
  if (!SETTLED_MARKETS.has(market)) return { action: 'skip', reason: 'market' };
  const options = line.options || [];
  const h = Number(homeScore), a = Number(awayScore);
  if (!Number.isFinite(h) || !Number.isFinite(a)) return { action: 'skip', reason: 'score' };
  if (market === 'h2h') {
    if (h === a) {
      if (!isSoccer(sportKey)) return { action: 'skip', reason: 'tie' };
      const draw = options.find(o => ['Draw', 'Empate'].includes(optName(o)));
      if (!draw) return { action: 'skip', reason: 'no-draw' };
      return { action: 'settle', optionId: draw.id };
    }
    const want = h > a ? line.home : line.away;
    const opt = options.find(o => optName(o) === want);
    if (!opt) return { action: 'skip', reason: 'no-side' };
    return { action: 'settle', optionId: opt.id };
  }
  if (market === 'spreads') {
    const d = h - a;
    const covers = [];
    for (const o of options) {
      const name = optName(o);
      const p = Number(o.point);
      if (!Number.isFinite(p)) continue;
      const margin = name === line.home ? d + p : name === line.away ? -d + p : null;
      if (margin == null) continue;
      if (margin === 0) return { action: 'push' };
      if (margin > 0) covers.push(o);
    }
    if (covers.length === 1) return { action: 'settle', optionId: covers[0].id };
    return { action: 'skip', reason: 'spread' };
  }
  if (market === 'totals') {
    const total = h + a;
    const over = options.find(o => optName(o) === 'Over');
    const under = options.find(o => optName(o) === 'Under');
    if (!over || !under) return { action: 'skip', reason: 'total' };
    const p = Number(over.point);
    if (!Number.isFinite(p) || Number(under.point) !== p) return { action: 'skip', reason: 'point' };
    if (total === p) return { action: 'push' };
    return { action: 'settle', optionId: (total > p ? over : under).id };
  }
  return { action: 'skip', reason: 'market' };
}

function eventReady(line, now) {
  const start = Date.parse(line.starts);
  if (!Number.isFinite(start) || now < start) return false;
  if (now < start + durationMs(line.sport_key)) return false;
  if (now > start + GIVE_UP_MS) return false;
  return true;
}

function groupPending(lines, now) {
  const by = new Map();
  for (const l of lines || []) {
    if (!eventReady(l, now)) continue;
    const k = l.sport_key;
    if (!by.has(k)) by.set(k, []);
    if (!by.get(k).some(x => x.event_id === l.event_id)) by.get(k).push(l);
  }
  return by;
}

module.exports = {
  FETCH_MS, GIVE_UP_MS, DURATION, autoSportOk, durationMs, isSoccer,
  titleSportKey, parseScoreEvent, decideLine, eventReady, groupPending, SETTLED_MARKETS,
};
