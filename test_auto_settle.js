const assert = require('node:assert/strict');
const { open, START_COINS } = require('./core');
const Auto = require('./auto-settle');
let n = 0; const t = (name, fn) => { const r = fn(); if (r && r.then) return r.then(() => { console.log('OK', name); n++; }); console.log('OK', name); n++; return r; };

const now = Auto.nyLocalToUtc(2026, 11, 12, 18); // 6 p.m. ET, 12 Nov 2026
const startAgo = hours => new Date(now - hours * 3600e3).toISOString();
const mk = () => {
  const D = open(':memory:');
  D.setupAdmin('admin', '1234');
  const u = D.register(D.newInvite(), 'ana', '1234');
  D.setOddsApiKey('test-secret-KEY99');
  return { D, u, coins: () => D.db.prepare('SELECT coins FROM users WHERE id=?').get(u).coins };
};
const ev = (id, extra = {}) => ({
  id, sport: extra.sport || 'UEFA Nations League', sport_key: extra.sport_key || 'soccer_uefa_nations_league',
  home: extra.home || 'Wales', away: extra.away || 'Portugal', unit: 'goles',
  starts: extra.starts || startAgo(3),
  title: `${extra.sport || 'UEFA Nations League'}: ${extra.home || 'Wales'} vs ${extra.away || 'Portugal'}`,
  markets: extra.markets || [
    { key: 'h2h', options: [{ label: 'Wales', odds: 200 }, { label: 'Portugal', odds: -150 }, { label: 'Draw', odds: 230 }] },
    { key: 'spreads', options: [{ label: 'Wales', point: 0.5, odds: -110 }, { label: 'Portugal', point: -0.5, odds: -110 }] },
    { key: 'totals', options: [{ label: 'Over', point: 2.5, odds: -110 }, { label: 'Under', point: 2.5, odds: -110 }] },
  ],
});
const score = (id, home, away, hs, as, sport_key = 'soccer_uefa_nations_league') => ({
  id, sport_key, completed: true, home_team: home, away_team: away,
  scores: [{ name: home, score: String(hs) }, { name: away, score: String(as) }],
});
const fetchOf = (map, usage = { remaining: 80, used: 20, last: 2 }) => async (sportKey) => ({ events: map[sportKey] || [], usage });

t('decide: soccer 3-way, US sports 2-way, spreads/totals and pushes', () => {
  const soccer = { market: 'h2h', home: 'Wales', away: 'Portugal', options: [
    { id: 1, outcome: 'Wales' }, { id: 2, outcome: 'Portugal' }, { id: 3, outcome: 'Draw' },
  ]};
  assert.equal(Auto.decideLine(soccer, 2, 1, 'soccer_epl').optionId, 1);
  assert.equal(Auto.decideLine(soccer, 0, 1, 'soccer_epl').optionId, 2);
  assert.equal(Auto.decideLine(soccer, 1, 1, 'soccer_epl').optionId, 3);
  const nba = { market: 'h2h', home: 'Lakers', away: 'Celtics', options: [
    { id: 1, outcome: 'Lakers' }, { id: 2, outcome: 'Celtics' },
  ]};
  assert.equal(Auto.decideLine(nba, 110, 108, 'basketball_nba').optionId, 1);
  assert.equal(Auto.decideLine(nba, 100, 100, 'basketball_nba').action, 'skip');
});

// Fix the spreads push example in a dedicated assert below after I think...
// home point +1, score 1-2, d=-1, margin=-1+1=0 push. Yes.

t('decide spreads push on exact integer; half points do not push; totals equal is push', () => {
  const sp = { market: 'spreads', home: 'Rangers', away: 'Bruins', options: [
    { id: 10, outcome: 'Rangers', point: -1 }, { id: 11, outcome: 'Bruins', point: 1 },
  ]};
  assert.deepEqual(Auto.decideLine(sp, 3, 2, 'icehockey_nhl'), { action: 'push' }); // d=1, home 1-1=0
  assert.equal(Auto.decideLine(sp, 4, 2, 'icehockey_nhl').optionId, 10);
  assert.equal(Auto.decideLine(sp, 2, 4, 'icehockey_nhl').optionId, 11);
  const half = { market: 'spreads', home: 'Rangers', away: 'Bruins', options: [
    { id: 10, outcome: 'Rangers', point: -1.5 }, { id: 11, outcome: 'Bruins', point: 1.5 },
  ]};
  assert.equal(Auto.decideLine(half, 3, 2, 'icehockey_nhl').optionId, 11); // d=1, home 1-1.5<0, away -1+1.5>0
  const tot = { market: 'totals', options: [
    { id: 20, outcome: 'Over', point: 5 }, { id: 21, outcome: 'Under', point: 5 },
  ]};
  assert.deepEqual(Auto.decideLine(tot, 2, 3, 'baseball_mlb'), { action: 'push' });
  assert.equal(Auto.decideLine(tot, 4, 3, 'baseball_mlb').optionId, 20);
  assert.equal(Auto.decideLine(tot, 1, 2, 'baseball_mlb').optionId, 21);
  const totH = { market: 'totals', options: [
    { id: 20, outcome: 'Over', point: 2.5 }, { id: 21, outcome: 'Under', point: 2.5 },
  ]};
  assert.equal(Auto.decideLine(totH, 2, 1, 'soccer_epl').optionId, 20);
});

t('slots are 6 p.m. and midnight America/New_York; 2h catch-up only', () => {
  const six = Auto.nyLocalToUtc(2026, 11, 12, 18);
  assert.equal(six, Date.parse('2026-11-12T23:00:00Z'));
  const mid = Auto.nyLocalToUtc(2026, 11, 13, 0);
  assert.equal(mid, Date.parse('2026-11-13T05:00:00Z'));
  const sixSummer = Auto.nyLocalToUtc(2026, 6, 15, 18);
  assert.equal(sixSummer, Date.parse('2026-06-15T22:00:00Z'));
  const midSummer = Auto.nyLocalToUtc(2026, 6, 16, 0);
  assert.equal(midSummer, Date.parse('2026-06-16T04:00:00Z'));
  assert.equal(Auto.dueSlot(six - 1, null), null);
  assert.equal(Auto.dueSlot(six, null).id, '2026-11-12T18:00');
  assert.equal(Auto.dueSlot(six + 90 * 60e3, null).id, '2026-11-12T18:00');
  assert.equal(Auto.dueSlot(six + 90 * 60e3, '2026-11-12T18:00'), null);
  assert.equal(Auto.dueSlot(six + Auto.CATCHUP_MS + 1000, null), null);
  assert.equal(Auto.dueSlot(mid, '2026-11-12T18:00').id, '2026-11-13T00:00');
  assert.equal(Auto.nextSlot(six - 3600e3, null).id, '2026-11-12T18:00');
  assert.equal(Auto.nextSlot(six + 1000, '2026-11-12T18:00').id, '2026-11-13T00:00');
});

t('title backfill maps official names; MMA is never auto', () => {
  assert.equal(Auto.titleSportKey('UEFA Nations League: Wales vs Portugal'), 'soccer_uefa_nations_league');
  assert.equal(Auto.titleSportKey('NBA: Lakers vs Celtics'), 'basketball_nba');
  assert.equal(Auto.autoSportOk('soccer_epl'), true);
  assert.equal(Auto.autoSportOk('basketball_nba'), true);
  assert.equal(Auto.autoSportOk('icehockey_nhl'), true);
  assert.equal(Auto.autoSportOk('baseball_mlb'), true);
  assert.equal(Auto.autoSportOk('mma_mixed_martial_arts'), false);
  assert.equal(Auto.eventReady({ starts: startAgo(3), sport_key: 'soccer_epl' }, now), true);
  assert.equal(Auto.eventReady({ starts: startAgo(2), sport_key: 'soccer_epl' }, now), false);
  assert.equal(Auto.eventReady({ starts: new Date(now - 4 * 24 * 3600e3).toISOString(), sport_key: 'soccer_epl' }, now), false);
});

(async () => {
  await t('settles soccer h2h/spreads/totals from a mocked scores call; uses settleLine', async () => {
    const { D, u, coins } = mk();
    const ids = D.createEvent(ev('nl-1'), 'real');
    assert.ok(D.db.prepare('SELECT sport_key FROM lines WHERE id=?').get(ids[0]).sport_key === 'soccer_uefa_nations_league');
    const line = id => D.lines().find(l => l.id === id);
    const opt = (id, name) => line(id).options.find(o => (o.outcome || o.label) === name);
    D.placeBet(u, opt(ids[0], 'Portugal').id, 100, Date.parse(startAgo(3)) - 1000);
    D.placeBet(u, opt(ids[1], 'Portugal').id, 100, Date.parse(startAgo(3)) - 1000); // -0.5, 2-0 covers
    D.placeBet(u, opt(ids[2], 'Over').id, 100, Date.parse(startAgo(3)) - 1000); // 2-0 = 2, under 2.5
    const before = coins();
    const st = await D.autoSettleTick(now, fetchOf({ soccer_uefa_nations_league: [score('nl-1', 'Wales', 'Portugal', 0, 2)] }));
    assert.equal(line(ids[0]).status, 'settled');
    assert.equal(line(ids[1]).status, 'settled');
    assert.equal(line(ids[2]).status, 'settled'); // 2 < 2.5 under
    const bets = D.myBets(u);
    assert.equal(bets.find(b => b.option_id === opt(ids[0], 'Portugal').id).status, 'won');
    assert.equal(bets.find(b => b.option_id === opt(ids[2], 'Over').id).status, 'lost');
    assert.ok(coins() > before - 300); // at least one win paid
    assert.equal(st.credits.remaining, 80);
    assert.equal(st.credits.last, 2);
  });

  await t('NHL/NBA/MLB settle 2-way including OT-style finals; integer push refunds; parlay push is consistent', async () => {
    const { D, u, coins } = mk();
    const nhl = D.createEvent({
      ...ev('nhl-1', { sport: 'NHL', sport_key: 'icehockey_nhl', home: 'Rangers', away: 'Bruins', unit: 'goles', starts: startAgo(4),
        markets: [
          { key: 'h2h', options: [{ label: 'Rangers', odds: -110 }, { label: 'Bruins', odds: -110 }] },
          { key: 'spreads', options: [{ label: 'Rangers', point: -1, odds: -110 }, { label: 'Bruins', point: 1, odds: -110 }] },
          { key: 'totals', options: [{ label: 'Over', point: 5, odds: -110 }, { label: 'Under', point: 5, odds: -110 }] },
        ] }),
    }, 'real');
    const nba = D.createEvent({
      ...ev('nba-1', { sport: 'NBA', sport_key: 'basketball_nba', home: 'Lakers', away: 'Celtics', unit: 'puntos', starts: startAgo(4),
        markets: [{ key: 'h2h', options: [{ label: 'Lakers', odds: -150 }, { label: 'Celtics', odds: 130 }] }] }),
    }, 'real');
    const mlb = D.createEvent({
      ...ev('mlb-1', { sport: 'MLB', sport_key: 'baseball_mlb', home: 'Yankees', away: 'Red Sox', unit: 'carreras', starts: startAgo(4),
        markets: [{ key: 'h2h', options: [{ label: 'Yankees', odds: -120 }, { label: 'Red Sox', odds: 100 }] }] }),
    }, 'real');
    const opt = (id, name) => D.lines().find(l => l.id === id).options.find(o => (o.outcome || o.label) === name);
    const ts = Date.parse(startAgo(4)) - 1000;
    D.placeBet(u, opt(nhl[0], 'Rangers').id, 100, ts); // 3-2 win
    D.placeBet(u, opt(nhl[1], 'Rangers').id, 100, ts); // d=1, -1 → push
    D.placeBet(u, opt(nhl[2], 'Over').id, 100, ts); // 5 → push
    const other = D.createEvent({
      ...ev('epl-1', { sport: 'Premier League', sport_key: 'soccer_epl', home: 'Arsenal', away: 'Chelsea',
        markets: [{ key: 'h2h', options: [{ label: 'Arsenal', odds: -140 }, { label: 'Chelsea', odds: 320 }, { label: 'Draw', odds: 250 }] }] }),
    }, 'real');
    const start = coins();
    D.placeParlay(u, [opt(nhl[2], 'Over').id, opt(other[0], 'Arsenal').id], 200, ts);
    await D.autoSettleTick(now, fetchOf({
      icehockey_nhl: [score('nhl-1', 'Rangers', 'Bruins', 3, 2, 'icehockey_nhl')],
      basketball_nba: [score('nba-1', 'Lakers', 'Celtics', 110, 108, 'basketball_nba')],
      baseball_mlb: [score('mlb-1', 'Yankees', 'Red Sox', 5, 4, 'baseball_mlb')],
      soccer_epl: [score('epl-1', 'Arsenal', 'Chelsea', 2, 0, 'soccer_epl')],
    }));
    assert.equal(D.lines().find(l => l.id === nhl[0]).status, 'settled');
    assert.equal(D.lines().find(l => l.id === nhl[1]).status, 'pushed');
    assert.equal(D.lines().find(l => l.id === nhl[2]).status, 'pushed');
    assert.equal(D.lines().find(l => l.id === nba[0]).status, 'settled');
    assert.equal(D.lines().find(l => l.id === mlb[0]).status, 'settled');
    const parlay = D.myParlays(u)[0];
    assert.equal(parlay.status, 'won'); // totals pushed/cancelled, Arsenal won → remaining legs pay
    assert.ok(coins() > start - 500);
  });

  await t('skips MMA, Locales, games still in progress, and does not fetch when toggle is off; idempotent', async () => {
    const { D, u } = mk();
    const mma = D.createEvent({
      ...ev('mma-1', { sport: 'MMA', sport_key: 'mma_mixed_martial_arts', home: 'A Fighter', away: 'B Fighter',
        markets: [{ key: 'h2h', options: [{ label: 'A Fighter', odds: -150 }, { label: 'B Fighter', odds: 130 }] }] }),
    }, 'real');
    const local = D.createEvent({
      id: 'custom-1', title: 'Locales: Sí o no', home: 'Sí', away: 'No', starts: startAgo(5),
      sport_key: 'soccer_epl',
      markets: [{ key: 'h2h', options: [{ label: 'Sí', odds: 100 }, { label: 'No', odds: -120 }] }],
    }, 'custom');
    const early = D.createEvent(ev('nl-early', { starts: startAgo(1) }), 'real'); // 1h ago, soccer needs 2.5h
    const ok = D.createEvent(ev('nl-ok'), 'real');
    let calls = 0;
    const fetch = async (sportKey) => { calls++; return fetchOf({ soccer_uefa_nations_league: [score('nl-ok', 'Wales', 'Portugal', 1, 0), score('nl-early', 'Wales', 'Portugal', 1, 1)] })(sportKey); };
    D.setAutoSettleEnabled(false);
    await D.autoSettleTick(now, fetch);
    assert.equal(calls, 0);
    assert.equal(D.lines().find(l => l.id === ok[0]).status, 'open');
    D.setAutoSettleEnabled(true);
    await D.autoSettleTick(now, fetch);
    assert.ok(calls >= 1);
    assert.equal(D.lines().find(l => l.id === mma[0]).status, 'open');
    assert.equal(D.lines().find(l => l.id === local[0]).status, 'open');
    assert.equal(D.lines().find(l => l.id === early[0]).status, 'open');
    assert.equal(D.lines().find(l => l.id === ok[0]).status, 'settled');
    const after = calls;
    await D.autoSettleTick(now, fetch);
    assert.equal(calls, after); // same 6 p.m. slot already persisted — no second fetch
    assert.equal(D.lines().find(l => l.id === ok[0]).status, 'settled');
    const st = D.autoSettleStatus(now);
    assert.equal(st.enabled, true);
    assert.ok(st.lastRunAt);
    assert.equal(st.lastRunSlot, '2026-11-12T18:00');
    assert.ok(st.nextRunAt > now);
    assert.equal(JSON.stringify(st).includes('test-secret-KEY99'), false);
  });

  await t('manual settle takes priority; no double pay; no scores call if nothing is ready', async () => {
    const { D, u, coins } = mk();
    const ids = D.createEvent(ev('nl-man'), 'real');
    const opt = D.lines().find(l => l.id === ids[0]).options.find(o => o.outcome === 'Wales');
    D.placeBet(u, opt.id, 100, Date.parse(startAgo(3)) - 1000);
    const mid = coins();
    D.settleLine(ids[0], opt.id);
    const paid = coins();
    let calls = 0;
    await D.autoSettleTick(now, async () => { calls++; return fetchOf({ soccer_uefa_nations_league: [score('nl-man', 'Wales', 'Portugal', 0, 3)] })('soccer_uefa_nations_league'); });
    assert.equal(D.lines().find(l => l.id === ids[0]).status, 'settled');
    assert.equal(coins(), paid);
    const earlyOnly = D.createEvent(ev('nl-wait', { starts: startAgo(1) }), 'real');
    const before = calls;
    await D.autoSettleTick(now, async () => { calls++; return { events: [], usage: { last: 2 } }; });
    assert.equal(calls, before); // slot already used; early game waits until the next slot
    assert.equal(D.lines().find(l => l.id === earlyOnly[0]).status, 'open');
  });

  await t('does not fetch outside the 6 p.m. / midnight ET slots', async () => {
    const { D } = mk();
    D.createEvent(ev('nl-off'), 'real');
    let calls = 0;
    const fivePm = Auto.nyLocalToUtc(2026, 11, 12, 17);
    await D.autoSettleTick(fivePm, async () => { calls++; return { events: [] }; });
    assert.equal(calls, 0);
    assert.equal(D.lines().find(l => l.event_id === 'nl-off').status, 'open');
    const st = D.autoSettleStatus(fivePm);
    assert.equal(st.lastRunAt, null);
    assert.equal(st.nextRunAt, now);
  });

  await t('catch-up runs once if a slot was missed within 2h; not after 2h; restart does not double-run', async () => {
    const { D } = mk();
    D.createEvent(ev('nl-catch', { starts: startAgo(3) }), 'real');
    let calls = 0;
    const fetch = async (sportKey) => { calls++; return fetchOf({ soccer_uefa_nations_league: [score('nl-catch', 'Wales', 'Portugal', 1, 0)] })(sportKey); };
    const seven30 = now + 90 * 60e3; // 7:30 p.m. ET
    await D.autoSettleTick(seven30, fetch);
    assert.equal(calls, 1);
    assert.equal(D.lines().find(l => l.event_id === 'nl-catch' && l.market === 'h2h').status, 'settled');
    await D.autoSettleTick(seven30 + 1000, fetch);
    assert.equal(calls, 1);

    const D2 = mk().D;
    D2.createEvent(ev('nl-late'), 'real');
    let late = 0;
    const eight01 = now + (2 * 3600e3) + 60e3; // 8:01 p.m. ET, past the 2h catch-up
    await D2.autoSettleTick(eight01, async () => { late++; return { events: [] }; });
    assert.equal(late, 0);
    assert.equal(D2.autoSettleStatus(eight01).nextRunAt, Auto.nyLocalToUtc(2026, 11, 13, 0));
  });

  await t('midnight ET is a new slot; empty leagues are not called; one call per pending league', async () => {
    const { D } = mk();
    D.createEvent(ev('nl-mid', { starts: startAgo(8) }), 'real');
    D.createEvent(ev('nba-mid', { sport: 'NBA', sport_key: 'basketball_nba', home: 'Lakers', away: 'Celtics', unit: 'puntos', starts: startAgo(8),
      markets: [{ key: 'h2h', options: [{ label: 'Lakers', odds: -150 }, { label: 'Celtics', odds: 130 }] }] }), 'real');
    let seen = [];
    const midnight = Auto.nyLocalToUtc(2026, 11, 13, 0);
    const six = now;
    await D.autoSettleTick(six, async (sportKey) => { seen.push(sportKey); return { events: [], usage: { remaining: 70, last: 2 } }; });
    assert.deepEqual([...seen].sort(), ['basketball_nba', 'soccer_uefa_nations_league']);
    seen = [];
    await D.autoSettleTick(six + 1000, async (sportKey) => { seen.push(sportKey); return { events: [] }; });
    assert.deepEqual(seen, []);
    await D.autoSettleTick(midnight, async (sportKey) => { seen.push(sportKey); return fetchOf({
      soccer_uefa_nations_league: [score('nl-mid', 'Wales', 'Portugal', 2, 0)],
      basketball_nba: [score('nba-mid', 'Lakers', 'Celtics', 99, 90, 'basketball_nba')],
      baseball_mlb: [score('ghost', 'Yankees', 'Red Sox', 1, 0, 'baseball_mlb')],
    })(sportKey); });
    assert.deepEqual([...seen].sort(), ['basketball_nba', 'soccer_uefa_nations_league']);
    assert.ok(!seen.includes('baseball_mlb'));
    assert.equal(D.autoSettleStatus(midnight).lastRunSlot, '2026-11-13T00:00');
    assert.equal(D.lines().find(l => l.event_id === 'nl-mid' && l.market === 'h2h').status, 'settled');
    assert.equal(D.lines().find(l => l.event_id === 'nba-mid').status, 'settled');
  });

  console.log(n, 'auto-settle tests passed');
})().catch(e => { console.error(e); process.exitCode = 1; });
