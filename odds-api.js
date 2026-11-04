// Adaptador para The Odds API (https://the-odds-api.com). Requiere ODDS_API_KEY.
const BASE = 'https://api.the-odds-api.com/v4';
const MISSING = 'Líneas reales: falta configurar la clave';
async function upcoming(sport = 'upcoming') {
  const key = process.env.ODDS_API_KEY;
  if (!key) return { error: MISSING };
  const url = `${BASE}/sports/${encodeURIComponent(sport)}/odds?regions=us&markets=h2h&oddsFormat=american&apiKey=${encodeURIComponent(key)}`;
  const r = await fetch(url);
  if (!r.ok) return { error: `Líneas reales: error de la API (${r.status})` };
  const data = await r.json();
  return { events: data.map(e => {
    const bm = (e.bookmakers || [])[0]; const m = bm && bm.markets.find(x => x.key === 'h2h');
    return { id: e.id, sport: e.sport_title, starts: e.commence_time, title: `${e.home_team} vs ${e.away_team}`, bookmaker: bm && bm.title,
      options: m ? m.outcomes.map(o => ({ label: o.name, odds: o.price })) : [] };
  }).filter(e => e.options.length >= 2) };
}
module.exports = { upcoming, MISSING };
