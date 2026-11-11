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
];
const PREFERRED_BOOKS = ['draftkings', 'fanduel'];
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
function marketsFromBook(bm, event) {
  const markets = [];
  for (const key of Object.keys(M.NAMES)) {
    const m = (bm.markets || []).find(x => x.key === key); if (!m) continue;
    const options = (m.outcomes || []).map(o => ({ label: o.name, odds: o.price, ...(key !== 'h2h' ? { point: o.point } : {}) }));
    try { M.validate(key, options, event.home_team, event.away_team); } catch { continue; }
    markets.push({ key, options, bookmaker: bm.title || bm.key, updated: m.last_update });
  }
  return markets;
}
function pickBookmaker(event) {
  const bms = event.bookmakers || [];
  for (const k of PREFERRED_BOOKS) {
    const bm = bms.find(b => b.key === k);
    if (!bm) continue;
    const markets = marketsFromBook(bm, event);
    if (markets.length) return { bm, markets };
  }
  for (const bm of bms) {
    const markets = marketsFromBook(bm, event);
    if (markets.length) return { bm, markets };
  }
  return null;
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
    const picked = pickBookmaker(e);
    if (!picked) return null;
    const { bm, markets } = picked;
    return {
      id: e.id, sport: e.sport_title, sport_key: e.sport_key, unit: unitOf(e.sport_key),
      home: e.home_team, away: e.away_team, starts: e.commence_time,
      title: `${e.home_team} vs ${e.away_team}`, markets, bookmaker: bm.title || bm.key,
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
    const r = await oddsFetch(`/sports/${encodeURIComponent(k)}/odds`, key, { regions: 'us', markets: 'h2h,spreads,totals', oddsFormat: 'american' });
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

module.exports = { upcoming, SOCCER, DEFAULT_SPORT, sportKey, parseEvents, MISSING, BOOKMAKER, SOURCE, NO_COVERAGE, SEARCH_SPORTS, parseRegionEvents, searchNew, cachedEvent, resetSearchCache, setKeyProvider, getKey, explainOddsError };
