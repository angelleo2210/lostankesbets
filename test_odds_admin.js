// Admin Odds API key + manual "Buscar partidos nuevos". All network calls are mocked.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { open } = require('./core');
const odds = require('./odds-api');
const { SEARCH_SPORTS, marketsForSport, creditsForSport, parseRegionEvents } = odds;

let n = 0;
const t = (name, fn) => { fn(); console.log('OK', name); n++; };
const oldEnv = process.env.ODDS_API_KEY;
const restoreEnv = () => { if (oldEnv === undefined) delete process.env.ODDS_API_KEY; else process.env.ODDS_API_KEY = oldEnv; };
const mk = () => { const D = open(':memory:'); D.setupAdmin('admin', '1234'); const adminId = D.db.prepare('SELECT id FROM users WHERE is_admin=1').get().id; const u = D.register(D.newInvite(), 'jugador', '1234'); return { D, adminId, u }; };
const future = (mins = 120) => new Date(Date.now() + mins * 60e3).toISOString();
const past = () => new Date(Date.now() - 3600e3).toISOString();
const options = {
  h2h: [{ label: 'Local', odds: -135 }, { label: 'Visita', odds: 210 }],
  spreads: [{ label: 'Local', point: -1.5, odds: 125 }, { label: 'Visita', point: 1.5, odds: -145 }],
  totals: [{ label: 'Over', point: 3.5, odds: 105 }, { label: 'Under', point: 3.5, odds: -120 }],
};
const book = (key, title, markets = Object.keys(options)) => ({
  key, title,
  markets: markets.map(k => ({ key: k, outcomes: options[k].map(o => ({ name: o.label, price: o.odds, ...(k === 'h2h' ? {} : { point: o.point }) })) })),
});
const ev = (id, extra = {}) => ({
  id, sport_key: extra.sport_key || 'soccer_epl', sport_title: extra.sport_title || 'EPL',
  home_team: extra.home || 'Local', away_team: extra.away || 'Visita',
  commence_time: extra.starts || future(),
  bookmakers: extra.bookmakers || [book('betmgm', 'BetMGM'), book('draftkings', 'DraftKings'), book('fanduel', 'FanDuel')],
});


t('search sports include UFC, NHL, Nations League and official World Cup qualifier keys; MMA costs 1 credit', () => {
  const keys = SEARCH_SPORTS.map(([k]) => k);
  assert.deepEqual(SEARCH_SPORTS.slice(0, 7).map(([k]) => k), ['soccer_epl','soccer_spain_la_liga','soccer_italy_serie_a','soccer_germany_bundesliga','soccer_uefa_champs_league','basketball_nba','baseball_mlb']);
  for (const k of ['mma_mixed_martial_arts','icehockey_nhl','soccer_uefa_nations_league','soccer_fifa_world_cup_qualifiers_europe','soccer_fifa_world_cup_qualifiers_south_america']) assert.ok(keys.includes(k), k);
  assert.equal(marketsForSport('mma_mixed_martial_arts'), 'h2h');
  assert.equal(creditsForSport('mma_mixed_martial_arts'), 1);
  assert.equal(marketsForSport('icehockey_nhl'), 'h2h,spreads,totals');
  assert.equal(creditsForSport('soccer_uefa_nations_league'), 3);
  assert.equal(marketsForSport('soccer_epl'), 'h2h,spreads,totals');
  const app = fs.readFileSync(__dirname + '/public/app.js', 'utf8');
  const m = app.match(/const ODDS_LEAGUES = (\[[^;]+\])/);
  assert.ok(m);
  const ui = Function('return ' + m[1])();
  assert.deepEqual(ui, SEARCH_SPORTS);
  assert.ok(app.includes('Cada liga cuesta unos 3 créditos (UFC/MMA: 1 crédito, solo ganador)'));
});

t('parse: MMA is two-way h2h; NHL keeps puck-line and totals; soccer keeps the draw', () => {
  const now = Date.now();
  const start = new Date(now + 3600e3).toISOString();
  const mmaBm = { key: 'draftkings', title: 'DraftKings', markets: [{ key: 'h2h', outcomes: [{ name: 'A Fighter', price: -150 }, { name: 'B Fighter', price: 130 }] }] };
  const [mma] = parseRegionEvents([{ id: 'mma-1', sport_key: 'mma_mixed_martial_arts', sport_title: 'MMA', home_team: 'A Fighter', away_team: 'B Fighter', commence_time: start, bookmakers: [mmaBm] }], now);
  assert.equal(mma.home, 'A Fighter'); assert.equal(mma.away, 'B Fighter');
  assert.deepEqual(mma.markets.map(x => x.key), ['h2h']);
  assert.equal(mma.markets[0].options.length, 2);
  assert.ok(!mma.markets[0].options.some(o => o.label === 'Draw'));
  const nhlBm = { key: 'fanduel', title: 'FanDuel', markets: [
    { key: 'h2h', outcomes: [{ name: 'Rangers', price: -110 }, { name: 'Bruins', price: -110 }] },
    { key: 'spreads', outcomes: [{ name: 'Rangers', price: -120, point: -1.5 }, { name: 'Bruins', price: 100, point: 1.5 }] },
    { key: 'totals', outcomes: [{ name: 'Over', price: -110, point: 5.5 }, { name: 'Under', price: -110, point: 5.5 }] }
  ]};
  const [nhl] = parseRegionEvents([{ id: 'nhl-1', sport_key: 'icehockey_nhl', sport_title: 'NHL', home_team: 'Rangers', away_team: 'Bruins', commence_time: start, bookmakers: [nhlBm] }], now);
  assert.equal(nhl.unit, 'goles');
  assert.deepEqual(nhl.markets.map(x => x.key), ['h2h', 'spreads', 'totals']);
  const socBm = { key: 'draftkings', title: 'DraftKings', markets: [{ key: 'h2h', outcomes: [{ name: 'Spain', price: -140 }, { name: 'Portugal', price: 320 }, { name: 'Draw', price: 250 }] }] };
  const [soc] = parseRegionEvents([{ id: 'nl-1', sport_key: 'soccer_uefa_nations_league', sport_title: 'UEFA Nations League', home_team: 'Spain', away_team: 'Portugal', commence_time: start, bookmakers: [socBm] }], now);
  assert.ok(soc.markets[0].options.some(o => o.label === 'Draw'));
  const { D } = mk();
  const ids = D.createEvent({ ...mma, title: `${mma.sport}: ${mma.title}` }, 'real');
  assert.equal(D.lines().find(l => l.id === ids[0]).sport, 'mma');
  const nhlIds = D.createEvent({ ...nhl, title: `${nhl.sport}: ${nhl.title}` }, 'real');
  assert.equal(D.lines().find(l => l.id === nhlIds[0]).sport, 'hockey');
  assert.equal(D.lines().find(l => l.id === nhlIds[0]).home, 'Rangers');
  assert.equal(D.lines().find(l => l.id === nhlIds[0]).away, 'Bruins');
});


t('key: stored last-4 only, env fallback, stored wins, delete does not touch env', () => {
  const { D } = mk();
  delete process.env.ODDS_API_KEY;
  assert.deepEqual(D.oddsKeyStatus(), { configured: false, source: null, last4: null });
  process.env.ODDS_API_KEY = 'env-key-9999';
  let st = D.oddsKeyStatus();
  assert.equal(st.configured, true); assert.equal(st.source, 'env'); assert.equal(st.last4, '9999');
  assert.equal(JSON.stringify(st).includes('env-key-9999'), false);
  assert.equal(D.getOddsApiKey(), 'env-key-9999');
  st = D.setOddsApiKey('stored-key-1234');
  assert.equal(st.source, 'stored'); assert.equal(st.last4, '1234');
  assert.equal(JSON.stringify(st).includes('stored-key-1234'), false);
  assert.equal(D.getOddsApiKey(), 'stored-key-1234');
  assert.equal(process.env.ODDS_API_KEY, 'env-key-9999'); // never mutate env
  st = D.deleteOddsApiKey();
  assert.equal(st.source, 'env'); assert.equal(st.last4, '9999');
  assert.equal(process.env.ODDS_API_KEY, 'env-key-9999');
  assert.throws(() => D.setOddsApiKey('short'), /formato válido|Escribe/);
  restoreEnv();
});

t('admin UI has the key form and manual search; no auto poll in admin view', () => {
  const src = fs.readFileSync(__dirname + '/public/app.js', 'utf8');
  const i = src.indexOf('function oddsAdminCard'), j = src.indexOf('function bindOddsAdmin');
  assert.ok(i > 0 && j > i);
  const card = src.slice(i, j);
  assert.ok(card.includes('Clave de The Odds API'));
  assert.ok(card.includes('Buscar partidos nuevos'));
  assert.ok(card.includes('Agregar a la app'));
  assert.ok(card.includes('Te quedan'));
  assert.ok(card.includes('type="password"'));
  assert.ok(card.includes('oddsKeySave') && card.includes('Guardar'));
  assert.ok(src.includes("tab === 'admin'") && src.includes('oddsAdminCard('));
  assert.ok(!src.includes("api('/admin/odds-search'") || src.indexOf("api('/admin/odds-search'") > src.indexOf('function bindOddsAdmin'));
  const server = fs.readFileSync(__dirname + '/server.js', 'utf8');
  for (const route of ["/api/admin/odds-key", "/api/admin/odds-key/delete", "/api/admin/odds-search", "/api/admin/odds-add"]) {
    const line = server.split('\n').find(l => l.includes(route) && (l.includes('app.get') || l.includes('app.post')));
    assert.ok(line && line.includes('admin(r)'), route);
  }
});

{ // async block
  const origFetch = global.fetch;
  const logs = [];
  const cLog = console.log, cErr = console.error, cWarn = console.warn;
  const spy = (...a) => { logs.push(a.map(String).join(' ')); };
  (async () => {
    try {
      console.log = (...a) => { spy(...a); cLog(...a); };
      console.error = (...a) => { spy(...a); cErr(...a); };
      console.warn = (...a) => { spy(...a); cWarn(...a); };

      odds.resetSearchCache();
      const { D } = mk();
      D.setOddsApiKey('test-secret-KEY99');
      odds.setKeyProvider(() => D.getOddsApiKey());

      // parse: future only, prefer DraftKings over FanDuel over first available
      const now = Date.now();
      const parsed = odds.parseRegionEvents([
        ev('past-1', { starts: past() }),
        ev('dk-1', { starts: future(60) }),
        ev('fd-1', { starts: future(90), bookmakers: [book('betmgm', 'BetMGM'), book('fanduel', 'FanDuel')] }),
        ev('first-1', { starts: future(120), bookmakers: [book('pointsbetau', 'PointsBet')] }),
        ev('empty-1', { starts: future(30), bookmakers: [] }),
      ], now);
      assert.deepEqual(parsed.map(e => e.id), ['dk-1', 'fd-1', 'first-1']);
      assert.equal(parsed[0].bookmaker, 'DraftKings');
      assert.equal(parsed[1].bookmaker, 'FanDuel');
      assert.equal(parsed[2].bookmaker, 'PointsBet');
      assert.equal(parsed[0].starts === ev('dk-1').starts || Date.parse(parsed[0].starts) > now, true);
      assert.equal(parsed[0].home, 'Local');
      console.log('OK parse: future only, DraftKings then FanDuel then first book'); n++;

      const urls = [];
      const sportsBody = [
        { key: 'soccer_epl', active: true, title: 'EPL' },
        { key: 'soccer_spain_la_liga', active: false, title: 'La Liga' },
        { key: 'basketball_nba', active: true, title: 'NBA' },
      ];
      global.fetch = async (url) => {
        const u = typeof url === 'string' ? new URL(url) : new URL(String(url));
        urls.push(u.pathname + u.search.replace(/apiKey=[^&]+/, 'apiKey=REDACTED'));
        if (u.pathname === '/v4/sports' || u.pathname === '/v4/sports/') {
          return { ok: true, status: 200, headers: { get: k => ({ 'x-requests-remaining': '80', 'x-requests-used': '20' }[k.toLowerCase()] || null) }, json: async () => sportsBody };
        }
        if (u.pathname.includes('/odds')) {
          assert.equal(u.searchParams.get('regions'), 'us');
          assert.equal(u.searchParams.get('markets'), 'h2h,spreads,totals');
          assert.equal(u.searchParams.get('oddsFormat'), 'american');
          assert.equal(u.searchParams.has('bookmakers'), false);
          const sport = u.pathname.split('/')[3];
          const rows = sport === 'soccer_epl' ? [ev('epl-live', { starts: past() }), ev('epl-1')] : [ev('nba-1', { sport_key: 'basketball_nba', sport_title: 'NBA', home: 'Lakers', away: 'Celtics' })];
          return { ok: true, status: 200, headers: { get: k => ({ 'x-requests-remaining': '74', 'x-requests-used': '26' }[k.toLowerCase()] || null) }, json: async () => rows };
        }
        throw new Error('unexpected ' + u.pathname);
      };

      // search does not hit odds for inactive LaLiga; no past events; does not auto-import
      const before = D.db.prepare('SELECT COUNT(*) c FROM lines').get().c;
      const r = await odds.searchNew(['soccer_epl', 'soccer_spain_la_liga', 'basketball_nba']);
      assert.equal(r.error, undefined);
      assert.equal(r.creditsRemaining, 74);
      assert.ok(r.skipped.some(s => s.key === 'soccer_spain_la_liga' && s.reason === 'inactive'));
      assert.deepEqual(r.events.map(e => e.id).sort(), ['epl-1', 'nba-1']);
      assert.ok(!r.events.some(e => e.id === 'epl-live'));
      assert.equal(D.db.prepare('SELECT COUNT(*) c FROM lines').get().c, before);
      assert.ok(urls.some(u => u.startsWith('/v4/sports?')));
      assert.ok(urls.some(u => u.startsWith('/v4/sports/soccer_epl/odds?')));
      assert.ok(urls.some(u => u.startsWith('/v4/sports/basketball_nba/odds?')));
      assert.ok(!urls.some(u => u.includes('soccer_spain_la_liga/odds')));
      assert.ok(!logs.some(l => l.includes('test-secret-KEY99')));
      console.log('OK search: skips inactive cheaply, future only, credits, no auto add, key not logged'); n++;

      // add selected, dedupe by Odds API event id, auto-close at commence_time
      const add1 = ev => D.createEvent({ ...ev, title: `${ev.sport}: ${ev.title}` }, 'real');
      const epl = odds.cachedEvent('epl-1');
      assert.ok(epl);
      const ids = add1(epl);
      assert.ok(ids.length >= 1);
      assert.equal(D.hasImportedEvent('epl-1'), true);
      assert.deepEqual(D.createEvent({ ...epl, title: `${epl.sport}: ${epl.title}` }, 'real'), ids); // idempotent
      const line = D.lines().find(l => l.event_id === 'epl-1');
      assert.ok(line.starts);
      assert.equal(Date.parse(line.starts), Date.parse(epl.starts));
      assert.equal(D.hasStarted(line, Date.parse(line.starts) - 1), false);
      assert.equal(D.hasStarted(line, Date.parse(line.starts)), true);
      const nba = odds.cachedEvent('nba-1');
      const nbaIds = add1(nba);
      assert.ok(nbaIds.length);
      console.log('OK add: dedupes by event id, kickoff auto-close at commence_time'); n++;

      // Spanish errors, never leak the key
      for (const [status, body, re] of [
        [401, { error_code: 'INVALID_KEY', message: 'bad key test-secret-KEY99' }, /Clave de The Odds API inválida/],
        [429, {}, /Demasiadas consultas/],
        [401, { error_code: 'OUT_OF_USAGE_CREDITS' }, /Se acabaron los créditos/],
        [402, { error_code: 'OUT_OF_USAGE_CREDITS' }, /Se acabaron los créditos/],
      ]) {
        const msg = odds.explainOddsError(status, body);
        assert.match(msg, re);
        assert.equal(msg.includes('test-secret-KEY99'), false);
      }
      global.fetch = async (url) => {
        const u = new URL(String(url));
        if (u.pathname === '/v4/sports' || u.pathname === '/v4/sports/') {
          return { ok: false, status: 401, headers: { get: () => null }, json: async () => ({ error_code: 'INVALID_KEY', message: 'key test-secret-KEY99' }) };
        }
        throw new Error('should not fetch odds after 401 on /sports');
      };
      const bad = await odds.searchNew(['soccer_epl']);
      assert.match(bad.error, /Clave de The Odds API inválida/);
      assert.equal(JSON.stringify(bad).includes('test-secret-KEY99'), false);
      global.fetch = async (url) => {
        const u = new URL(String(url));
        if (u.pathname.startsWith('/v4/sports') && !u.pathname.includes('/odds')) {
          return { ok: true, status: 200, headers: { get: k => ({ 'x-requests-remaining': '3' }[k.toLowerCase()] || null) }, json: async () => [{ key: 'soccer_epl', active: true }] };
        }
        return { ok: false, status: 429, headers: { get: () => null }, json: async () => ({}) };
      };
      const busy = await odds.searchNew(['soccer_epl']);
      assert.match(busy.error, /Demasiadas consultas/);
      global.fetch = async (url) => {
        const u = new URL(String(url));
        if (u.pathname.startsWith('/v4/sports') && !u.pathname.includes('/odds')) {
          return { ok: true, status: 200, headers: { get: () => null }, json: async () => [{ key: 'soccer_epl', active: true }] };
        }
        return { ok: false, status: 401, headers: { get: k => ({ 'x-requests-remaining': '0', 'x-requests-used': '500' }[k.toLowerCase()] || null) }, json: async () => ({ error_code: 'OUT_OF_USAGE_CREDITS' }) };
      };
      const out = await odds.searchNew(['soccer_epl']);
      assert.match(out.error, /Se acabaron los créditos/);
      assert.ok(!logs.some(l => l.includes('test-secret-KEY99')));
      console.log('OK errors: 401 / 429 / OUT_OF_USAGE_CREDITS in Spanish, key never logged or returned'); n++;

      // no key → no fetch
      odds.setKeyProvider(() => '');
      delete process.env.ODDS_API_KEY;
      global.fetch = async () => { throw new Error('Must not request without key'); };
      const miss = await odds.searchNew(['soccer_epl']);
      assert.match(miss.error, /Falta configurar la clave/);
      console.log('OK search refuses without a key and does not call the API'); n++;

      console.log(n, 'odds admin tests passed');
    } catch (e) {
      console.error(e);
      process.exitCode = 1;
    } finally {
      global.fetch = origFetch;
      console.log = cLog; console.error = cErr; console.warn = cWarn;
      odds.setKeyProvider(null);
      odds.resetSearchCache();
      restoreEnv();
    }
  })();
}
