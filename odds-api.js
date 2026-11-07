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
const sportKey = s => SOCCER.some(([k]) => k === s) ? s : DEFAULT_SPORT;
async function upcoming(sport) {
  sport = sportKey(sport);
  const key = process.env.ODDS_API_KEY; if (!key) return { error: MISSING, sport };
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
module.exports = { upcoming, SOCCER, DEFAULT_SPORT, sportKey, parseEvents, MISSING, BOOKMAKER, SOURCE, NO_COVERAGE };
