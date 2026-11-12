// The Odds API v4 documented featured markets: h2h,spreads,totals.
const M = require('./public/markets');
const BASE = 'https://api.the-odds-api.com/v4';
const BOOKMAKER = 'hardrockbet_fl';
const SOURCE = 'Hard Rock Bet (Florida) vía The Odds API';
const MISSING = 'Hard Rock Bet (Florida): falta configurar ODDS_API_KEY de The Odds API';
const NO_COVERAGE = 'Hard Rock Bet (Florida) no tiene mercados disponibles para esta consulta. No se sustituyen por otras casas.';
function parseEvents(data) {
  return (Array.isArray(data) ? data : []).map(e => {
    const markets = [];
    for (const key of Object.keys(M.NAMES)) {
      // Florida only: never substitute another state or bookmaker for a missing market.
      for (const bm of e.bookmakers || []) {
        if (bm.key !== BOOKMAKER) continue;
        const m = (bm.markets || []).find(m => m.key === key); if (!m) continue;
        const options = (m.outcomes || []).map(o => ({ label: o.name, odds: o.price, ...(key !== 'h2h' ? { point: o.point } : {}) }));
        try { M.validate(key, options, e.home_team, e.away_team); } catch { continue; }
        markets.push({ key, options, bookmaker: 'Hard Rock Bet (Florida)', updated: m.last_update }); break;
      }
    }
    return { id: e.id, sport: e.sport_title, sport_key: e.sport_key, unit: /^(soccer|icehockey)_/.test(e.sport_key || '') ? 'goles' : /^(basketball|americanfootball|rugby|aussierules)_/.test(e.sport_key || '') ? 'puntos' : '', home: e.home_team, away: e.away_team, starts: e.commence_time,
      title: `${e.home_team} vs ${e.away_team}`, markets, bookmaker: markets.map(m => m.bookmaker).join(' / '), options: markets.find(m => m.key === 'h2h')?.options || [] };
  }).filter(e => e.id && e.markets.length);
}
// Soccer leagues only (The Odds API sport keys). No generic 'upcoming' query: it returned no Hard Rock FL markets.
const SOCCER = [['soccer_spain_la_liga', 'LaLiga'], ['soccer_epl', 'Premier League'], ['soccer_uefa_champs_league', 'Champions League'], ['soccer_italy_serie_a', 'Serie A'], ['soccer_germany_bundesliga', 'Bundesliga'], ['soccer_usa_mls', 'MLS'], ['soccer_saudi_arabia_pro_league', 'Saudi Pro League']];
const DEFAULT_SPORT = SOCCER[0][0];
const cache = new Map();
let keyProvider = null;
function setKeyProvider(fn) { keyProvider = fn; }
function getKey() { return String((typeof keyProvider === 'function' && keyProvider()) || process.env.ODDS_API_KEY || '').trim(); }
const sportKey = s => SOCCER.some(([k]) => k === s) ? s : DEFAULT_SPORT;
async function upcoming(sport) {
  sport = sportKey(sport);
  const key = getKey(); if (!key) return { error: MISSING, sport };
  const ttl = Number(process.env.ODDS_CACHE_MS ?? 300000), hit = cache.get(sport);
  if (hit && Date.now() - hit.at < ttl) return hit.data;
  const data = await fetchOdds(sport, key); if (!data.error) cache.set(sport, { at: Date.now(), data }); return data;
}
async function fetchOdds(sport, key) {
  const league = SOCCER.find(([k]) => k === sport)[1];
  try {
    const r = await fetch(`${BASE}/sports/${encodeURIComponent(sport)}/odds?bookmakers=hardrockbet_fl&markets=h2h,spreads,totals&oddsFormat=american&apiKey=${encodeURIComponent(key)}`, { signal: AbortSignal.timeout(15000) });
    if (!r.ok) return { sport, error: `Líneas reales: error de la API (${r.status}); mercados sujetos a disponibilidad y cuota del proveedor` };
    const events = parseEvents(await r.json());
    return { sport, events, source: SOURCE, ...(events.length ? {} : { notice: `${league}: ${NO_COVERAGE}` }) };
  } catch { return { sport, error: 'Líneas reales: proveedor no disponible' }; }
}

const SEARCH_SPORTS = [
  ['soccer_epl', 'Premier League'],
  ['soccer_spain_la_liga', 'LaLiga'],
  ['soccer_italy_serie_a', 'Serie A'],
  ['soccer_germany_bundesliga', 'Bundesliga'],
  ['soccer_uefa_champs_league', 'Champions League'],
  ['basketball_nba', 'NBA'],
  ['baseball_mlb', 'MLB'],
  ['mma_mixed_martial_arts', 'UFC (MMA)'],
  ['icehockey_nhl', 'NHL'],
  ['soccer_uefa_nations_league', 'UEFA Nations League'],
  ['soccer_fifa_world_cup_qualifiers_europe', 'Eliminatorias Mundial (Europa)'],
  ['soccer_fifa_world_cup_qualifiers_south_america', 'Eliminatorias Mundial (Sudamérica)'],
];
function marketsForSport(key) {
  const k = String(key || '');
  if (/^mma_/.test(k) || /^boxing_/.test(k)) return 'h2h';
  return 'h2h,spreads,totals';
}
// Soccer spreads/totals are often missing from US books (h2h only). UK+EU keeps the
// featured markets (not alternate_spreads/totals) and costs 2 regions × 3 markets = 6 credits.
function regionsForSport(key) {
  const k = String(key || '');
  if (/^soccer_/.test(k)) return 'uk,eu';
  return 'us';
}
function creditsForSport(key) {
  return marketsForSport(key).split(',').filter(Boolean).length * regionsForSport(key).split(',').filter(Boolean).length;
}
const PREFERRED_BOOKS = ['draftkings', 'fanduel', 'pinnacle', 'paddypower', 'williamhill', 'betfair_sb_uk'];
let searchCache = new Map();

function headerVal(res, name) {
  const h = res && res.headers;
  if (!h) return null;
  if (typeof h.get === 'function') return h.get(name) || h.get(name.toLowerCase()) || h.get(name.toUpperCase()) || null;
  return h[name] || h[name.toLowerCase()] || h[name.toUpperCase()] || null;
}
function usageFrom(res, prev = {}) {
  const out = { ...prev };
  const rem = headerVal(res, 'x-requests-remaining');
  const used = headerVal(res, 'x-requests-used');
  const last = headerVal(res, 'x-requests-last');
  if (rem != null && rem !== '') { const n = Number(rem); if (Number.isFinite(n)) out.remaining = n; }
  if (used != null && used !== '') { const n = Number(used); if (Number.isFinite(n)) out.used = n; }
  if (last != null && last !== '') { const n = Number(last); if (Number.isFinite(n)) out.last = n; }
  return out;
}
function explainOddsError(status, body) {
  const code = body && typeof body === 'object' ? String(body.error_code || body.code || '') : '';
  if (code === 'OUT_OF_USAGE_CREDITS' || status === 402) return 'Se acabaron los créditos de The Odds API este mes.';
  if (status === 401 || code === 'INVALID_KEY' || code === 'DEACTIVATED_KEY' || code === 'MISSING_KEY') return 'Clave de The Odds API inválida o no autorizada.';
  if (status === 429) return 'Demasiadas consultas a The Odds API. Espera un momento e inténtalo de nuevo.';
  return `The Odds API no está disponible (${status}).`;
}
async function oddsFetch(path, key, params) {
  const u = new URL(BASE + path);
  for (const [k, v] of Object.entries(params || {})) if (v != null && v !== '') u.searchParams.set(k, v);
  u.searchParams.set('apiKey', key);
  try {
    const r = await fetch(u, { signal: AbortSignal.timeout(15000) });
    const usage = usageFrom(r);
    let body = null;
    try { body = await r.json(); } catch { body = null; }
    if (!r.ok) return { error: explainOddsError(r.status, body), usage, status: r.status };
    return { data: body, usage };
  } catch {
    return { error: 'The Odds API no está disponible en este momento.' };
  }
}
function americanPrice(price) {
  const n = Number(price);
  if (!Number.isFinite(n) || n === 0) return null;
  if (Number.isInteger(n) && Math.abs(n) >= 100) return n;
  // Some UK/EU books still send decimal even when oddsFormat=american.
  if (n > 1) {
    const a = n >= 2 ? Math.round((n - 1) * 100) : Math.round(-100 / (n - 1));
    return Number.isInteger(a) && Math.abs(a) >= 100 ? a : null;
  }
  return null;
}
function impliedProb(a) {
  return a > 0 ? 100 / (a + 100) : (-a) / ((-a) + 100);
}
// Two-way vig sanity: reject impossible both-sides favorites like Over -5000 / Under -400.
function twoWayJuiceOk(a, b) {
  const s = impliedProb(a) + impliedProb(b);
  return Number.isFinite(s) && s >= 0.98 && s <= 1.40;
}
function twoWayScore(a, b) {
  return Math.abs(impliedProb(a) + impliedProb(b) - 1.05) + Math.abs(impliedProb(a) - impliedProb(b));
}
function outcomeOf(raw, key) {
  const odds = americanPrice(raw && raw.price);
  const label = raw && raw.name != null ? String(raw.name).trim() : '';
  if (odds == null || !label) return null;
  const row = { label, odds };
  if (key !== 'h2h') {
    const point = Number(raw.point);
    if (!Number.isFinite(point)) return null;
    row.point = point;
  }
  return row;
}
function packaged(key, options, bm, updated) {
  return { key, options, bookmaker: bm.title || bm.key, updated };
}
function bestTotals(bm, event) {
  const m = (bm.markets || []).find(x => x.key === 'totals');
  if (!m) return null;
  const byPoint = new Map();
  for (const raw of m.outcomes || []) {
    const o = outcomeOf(raw, 'totals');
    if (!o || (o.label !== 'Over' && o.label !== 'Under')) continue;
    const k = String(o.point);
    if (!byPoint.has(k)) byPoint.set(k, {});
    const slot = byPoint.get(k);
    if (!slot[o.label]) slot[o.label] = o;
  }
  let best = null, bestScore = Infinity;
  for (const slot of byPoint.values()) {
    if (!slot.Over || !slot.Under || slot.Over.point !== slot.Under.point) continue;
    if (!twoWayJuiceOk(slot.Over.odds, slot.Under.odds)) continue;
    const options = [slot.Over, slot.Under];
    try { M.validate('totals', options, event.home_team, event.away_team); } catch { continue; }
    const score = twoWayScore(slot.Over.odds, slot.Under.odds);
    if (score < bestScore) { bestScore = score; best = options; }
  }
  return best ? packaged('totals', best, bm, m.last_update) : null;
}
function bestSpreads(bm, event) {
  const m = (bm.markets || []).find(x => x.key === 'spreads');
  if (!m) return null;
  const home = event.home_team, away = event.away_team;
  const rows = (m.outcomes || []).map(o => outcomeOf(o, 'spreads')).filter(o => o && (o.label === home || o.label === away));
  const homes = rows.filter(o => o.label === home);
  const aways = rows.filter(o => o.label === away);
  let best = null, bestScore = Infinity;
  for (const h of homes) {
    const a = aways.find(x => x.point === -h.point);
    if (!a || !twoWayJuiceOk(h.odds, a.odds)) continue;
    const options = [h, a];
    try { M.validate('spreads', options, home, away); } catch { continue; }
    const score = twoWayScore(h.odds, a.odds);
    if (score < bestScore) { bestScore = score; best = options; }
  }
  return best ? packaged('spreads', best, bm, m.last_update) : null;
}
function bestH2h(bm, event) {
  const m = (bm.markets || []).find(x => x.key === 'h2h');
  if (!m) return null;
  const options = [];
  for (const raw of m.outcomes || []) {
    const o = outcomeOf(raw, 'h2h');
    if (o) options.push(o);
  }
  try { M.validate('h2h', options, event.home_team, event.away_team); } catch { return null; }
  return packaged('h2h', options, bm, m.last_update);
}
function marketFromBook(bm, key, event) {
  if (key === 'totals') return bestTotals(bm, event);
  if (key === 'spreads') return bestSpreads(bm, event);
  if (key === 'h2h') return bestH2h(bm, event);
  return null;
}
const EXCHANGE_BOOKS = new Set(['betfair_ex_uk', 'betfair_ex_eu', 'betfair', 'matchbook', 'smarkets']);
function orderedBooks(event) {
  const bms = event.bookmakers || [];
  const out = [], seen = new Set();
  const push = bm => { if (bm && !seen.has(bm)) { out.push(bm); seen.add(bm); } };
  for (const k of PREFERRED_BOOKS) push(bms.find(b => b.key === k));
  for (const bm of bms) if (!EXCHANGE_BOOKS.has(bm.key)) push(bm);
  for (const bm of bms) push(bm);
  return out;
}
// Fill each featured market from the first preferred book that has a valid line.
// A book with only h2h no longer hides spreads/totals offered by another book.
function pickMarkets(event) {
  const markets = [];
  const books = orderedBooks(event);
  for (const key of Object.keys(M.NAMES)) {
    if (key === 'props') continue;
    for (const bm of books) {
      const m = marketFromBook(bm, key, event);
      if (m) { markets.push(m); break; }
    }
  }
  return markets;
}
function bookmakerLabel(markets) {
  const names = [];
  for (const m of markets || []) if (m.bookmaker && !names.includes(m.bookmaker)) names.push(m.bookmaker);
  return names.join(' / ');
}
function unitOf(sport_key) {
  if (/^(soccer|icehockey)_/.test(sport_key || '')) return 'goles';
  if (/^(basketball|americanfootball|rugby|aussierules)_/.test(sport_key || '')) return 'puntos';
  if (/^baseball_/.test(sport_key || '')) return 'carreras';
  return '';
}
function parseRegionEvents(data, now = Date.now()) {
  return (Array.isArray(data) ? data : []).map(e => {
    const startMs = Date.parse(e.commence_time);
    if (!Number.isFinite(startMs) || startMs <= now) return null;
    const markets = pickMarkets(e);
    if (!markets.length) return null;
    return {
      id: e.id, sport: e.sport_title, sport_key: e.sport_key, unit: unitOf(e.sport_key),
      home: e.home_team, away: e.away_team, starts: e.commence_time,
      title: `${e.home_team} vs ${e.away_team}`, markets, bookmaker: bookmakerLabel(markets),
      options: markets.find(m => m.key === 'h2h')?.options || [],
    };
  }).filter(e => e && e.id && e.markets.length);
}
function allowedSport(key) { return SEARCH_SPORTS.find(([k]) => k === key); }

async function searchNew(sportKeys, now = Date.now()) {
  const key = getKey();
  if (!key) return { error: 'Falta configurar la clave de The Odds API' };
  const wanted = [];
  const seen = new Set();
  for (const k of sportKeys || []) {
    const row = allowedSport(k);
    if (row && !seen.has(row[0])) { seen.add(row[0]); wanted.push(row); }
  }
  if (!wanted.length) return { error: 'Elige al menos una liga' };
  const sportsRes = await oddsFetch('/sports', key);
  if (sportsRes.error) return { error: sportsRes.error, creditsRemaining: sportsRes.usage && sportsRes.usage.remaining, creditsUsed: sportsRes.usage && sportsRes.usage.used };
  let usage = sportsRes.usage || {};
  const active = new Set((Array.isArray(sportsRes.data) ? sportsRes.data : []).filter(s => s && s.active !== false && s.key).map(s => s.key));
  const skipped = [];
  const toFetch = [];
  for (const [k, name] of wanted) {
    if (!active.has(k)) skipped.push({ key: k, name, reason: 'inactive' });
    else toFetch.push([k, name]);
  }
  const events = [];
  for (const [k, name] of toFetch) {
    const r = await oddsFetch(`/sports/${encodeURIComponent(k)}/odds`, key, { regions: regionsForSport(k), markets: marketsForSport(k), oddsFormat: 'american' });
    usage = { ...usage, ...(r.usage || {}) };
    if (r.error) {
      return { error: r.error, events, skipped, creditsRemaining: usage.remaining, creditsUsed: usage.used };
    }
    for (const e of parseRegionEvents(r.data, now)) events.push({ ...e, league: name, sport_key: e.sport_key || k });
  }
  searchCache = new Map(events.map(e => [String(e.id), e]));
  return { events, skipped, creditsRemaining: usage.remaining ?? null, creditsUsed: usage.used ?? null };
}
function cachedEvent(id) { return searchCache.get(String(id)) || null; }
function resetSearchCache() { searchCache = new Map(); }


async function fetchScores(sportKey, daysFrom = 3) {
  const key = getKey();
  if (!key) return { error: 'Falta configurar la clave de The Odds API' };
  const params = {};
  if (daysFrom) params.daysFrom = String(daysFrom);
  const r = await oddsFetch(`/sports/${encodeURIComponent(sportKey)}/scores`, key, params);
  if (r.error) return { error: r.error, usage: r.usage, status: r.status };
  return { events: Array.isArray(r.data) ? r.data : [], usage: r.usage };
}
module.exports = { upcoming, SOCCER, DEFAULT_SPORT, sportKey, parseEvents, MISSING, BOOKMAKER, SOURCE, NO_COVERAGE, SEARCH_SPORTS, parseRegionEvents, searchNew, cachedEvent, resetSearchCache, setKeyProvider, getKey, explainOddsError, marketsForSport, creditsForSport, regionsForSport, pickMarkets, americanPrice, twoWayJuiceOk, fetchScores };
