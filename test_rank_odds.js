const assert = require('node:assert/strict');
const fs = require('node:fs');
const { open, oddsQualify, RANK_POINTS_GATE, RANK_MIN_ODDS, toAmerican, dec } = require('./core');
let n = 0; const t = (name, fn) => { fn(); console.log('OK', name); n++; };

const mk = () => {
  const D = open(':memory:');
  D.setupAdmin('admin', '1234');
  const u = D.register(D.newInvite(), 'ana', '1234');
  const pts = () => D.tabla('temporada').rows.find(r => r.id === u).points;
  const row = () => D.tabla('temporada').rows.find(r => r.id === u);
  const coins = () => D.db.prepare('SELECT coins FROM users WHERE id=?').get(u).coins;
  return { D, u, pts, row, coins };
};
const addWin = (D, u, odds, title) => {
  const id = D.createLine(title || ('U ' + Math.random()), [{ label: 'Sí', odds }, { label: 'No', odds: odds > 0 ? -120 : 100 }]);
  const yes = D.lines().find(l => l.id === id).options.find(o => o.label === 'Sí');
  const betId = D.placeBet(u, yes.id, 10);
  D.settleLine(id, yes.id);
  return { id, betId, yes };
};
const reach = (D, u, points) => {
  const need = Math.max(0, Math.ceil(points / 3) - D._rankingWinCount(u, null));
  for (let i = 0; i < need; i++) addWin(D, u, 100, 'Reach ' + i + ' ' + Math.random());
};

t('oddsQualify: -150 or better (decimal >= 1.6667); shorter favorites do not', () => {
  assert.equal(RANK_POINTS_GATE, 21);
  assert.equal(RANK_MIN_ODDS, -150);
  assert.equal(oddsQualify(-150), true);
  assert.equal(oddsQualify(-130), true);
  assert.equal(oddsQualify(-110), true);
  assert.equal(oddsQualify(100), true);
  assert.equal(oddsQualify(200), true);
  assert.equal(oddsQualify(-155), false);
  assert.equal(oddsQualify(-160), false);
  assert.equal(oddsQualify(-200), false);
  assert.ok(dec(-150) + 1e-12 >= 1 + 100 / 150);
  assert.ok(dec(-155) < 1 + 100 / 150);
  assert.equal(oddsQualify(0), false);
  assert.equal(oddsQualify(-50), false);
});

t('below 21 points, a -200 (or -155) win still awards +3; money is paid', () => {
  const { D, u, pts, coins, row } = mk();
  reach(D, u, 18);
  assert.equal(pts(), 18);
  const before = coins();
  addWin(D, u, -200, 'Heavy before gate');
  assert.equal(pts(), 21);
  assert.equal(row().wins, 7);
  assert.ok(coins() > before); // payout
  const bet = D.db.prepare('SELECT rank_qualifies, rank_credit, payout, status FROM bets WHERE user_id=? ORDER BY id DESC LIMIT 1').get(u);
  assert.equal(bet.rank_qualifies, 1);
  assert.equal(bet.rank_credit, 1);
  assert.equal(bet.status, 'won');
  assert.ok(bet.payout > 10);
});

t('at 21 points, -200/-155 do not add points; -150 and parlays at long enough combined odds do; payouts unchanged', () => {
  const { D, u, pts, row, coins } = mk();
  reach(D, u, 21);
  assert.equal(pts(), 21);
  const before = coins();
  addWin(D, u, -200, 'Short 200');
  assert.equal(pts(), 21);
  assert.equal(row().wins, 8); // still a unique win for % / cups
  assert.ok(coins() > before);
  const short = D.db.prepare('SELECT rank_qualifies, rank_credit FROM bets WHERE user_id=? ORDER BY id DESC LIMIT 1').get(u);
  assert.equal(short.rank_qualifies, 0);
  assert.equal(short.rank_credit, 0);

  addWin(D, u, -155, 'Short 155');
  assert.equal(pts(), 21);

  addWin(D, u, -150, 'Edge 150');
  assert.equal(pts(), 24);
  const ok = D.db.prepare('SELECT rank_qualifies, rank_credit FROM bets WHERE user_id=? ORDER BY id DESC LIMIT 1').get(u);
  assert.equal(ok.rank_qualifies, 1);
  assert.equal(ok.rank_credit, 1);

  const a = D.createLine('P1 ' + Math.random(), [{ label: 'A', odds: -500 }, { label: 'B', odds: 400 }]);
  const b = D.createLine('P2 ' + Math.random(), [{ label: 'A', odds: -500 }, { label: 'B', odds: 400 }]);
  const oa = D.lines().find(l => l.id === a).options[0];
  const ob = D.lines().find(l => l.id === b).options[0];
  const combined = toAmerican(dec(-500) * dec(-500));
  assert.ok(combined < -150, 'two -500s should be shorter than -150, got ' + combined);
  const mid = coins();
  const pid = D.placeParlay(u, [oa.id, ob.id], 10);
  const pRow = D.db.prepare('SELECT rank_qualifies FROM parlays WHERE id=?').get(pid);
  assert.equal(pRow.rank_qualifies, 0);
  D.settleLine(a, oa.id); D.settleLine(b, ob.id);
  assert.equal(D.myParlays(u).find(p => p.id === pid).status, 'won');
  assert.equal(pts(), 24); // no +3
  assert.ok(coins() > mid);

  const c = D.createLine('P3 ' + Math.random(), [{ label: 'A', odds: -110 }, { label: 'B', odds: 100 }]);
  const d = D.createLine('P4 ' + Math.random(), [{ label: 'A', odds: -110 }, { label: 'B', odds: 100 }]);
  const oc = D.lines().find(l => l.id === c).options[0];
  const od_ = D.lines().find(l => l.id === d).options[0];
  const pid2 = D.placeParlay(u, [oc.id, od_.id], 10);
  assert.equal(D.db.prepare('SELECT rank_qualifies FROM parlays WHERE id=?').get(pid2).rank_qualifies, 1);
  D.settleLine(c, oc.id); D.settleLine(d, od_.id);
  assert.equal(pts(), 27);
});

t('qualification is frozen at placement; later points changes do not rewrite the flag; legacy NULL still counts', () => {
  const { D, u, pts, row } = mk();
  reach(D, u, 18);
  const id = D.createLine('Frozen short', [{ label: 'Sí', odds: -200 }, { label: 'No', odds: 150 }]);
  const yes = D.lines().find(l => l.id === id).options[0];
  const betId = D.placeBet(u, yes.id, 10);
  assert.equal(D.db.prepare('SELECT rank_qualifies FROM bets WHERE id=?').get(betId).rank_qualifies, 1); // placed at 18
  reach(D, u, 21); // more wins before this bet settles
  assert.ok(pts() >= 21);
  D.settleLine(id, yes.id);
  assert.equal(D.db.prepare('SELECT rank_qualifies, rank_credit FROM bets WHERE id=?').get(betId).rank_credit, 1);
  assert.equal(pts(), 24); // 21 + 3 from the frozen qualifying ticket

  // legacy ticket (NULL) placed conceptually after 21 still counts — we do not strip old bets
  const id2 = D.createLine('Legacy', [{ label: 'Sí', odds: -200 }, { label: 'No', odds: 150 }]);
  const y2 = D.lines().find(l => l.id === id2).options[0];
  D.db.prepare('INSERT INTO bets(user_id,line_id,option_id,stake,odds,ts) VALUES(?,?,?,?,?,?)').run(u, id2, y2.id, 10, -200, Date.now() * 1000);
  const legacy = D.db.prepare('SELECT id, rank_qualifies FROM bets WHERE line_id=?').get(id2);
  assert.equal(legacy.rank_qualifies, null);
  D.settleLine(id2, y2.id);
  assert.equal(D.db.prepare('SELECT rank_credit FROM bets WHERE id=?').get(legacy.id).rank_credit, 1);
  assert.equal(pts(), 27);
  assert.equal(row().wins, 9);
});

t('duplicate rule still awards only 3 points total; non-qualifying unique wins do not block a later qualifying different bet', () => {
  const { D, u, pts, row } = mk();
  reach(D, u, 21);
  const id = D.createLine('Dup line', [{ label: 'Sí', odds: -110 }, { label: 'No', odds: -110 }]);
  const yes = D.lines().find(l => l.id === id).options[0];
  D.placeBet(u, yes.id, 10);
  D.placeBet(u, yes.id, 10);
  D.settleLine(id, yes.id);
  assert.equal(pts(), 24);
  const credits = D.db.prepare('SELECT rank_credit, rank_qualifies FROM bets WHERE line_id=? ORDER BY id').all(id);
  assert.equal(credits.filter(r => r.rank_credit === 1).length, 1);
  assert.ok(credits.every(r => r.rank_qualifies === 1));
  assert.equal(row().wins, 8); // unique selections
});

t('UI shows live slip notices and ranking help; SW v29', () => {
  const src = fs.readFileSync(__dirname + '/public/app.js', 'utf8');
  assert.ok(src.includes('function rankSlipNotice'));
  assert.ok(src.includes('Esta apuesta califica para el ranking (+3 pts)'));
  assert.ok(src.includes('Esta apuesta no suma puntos al ranking: desde 21 puntos la cuota debe ser -150 o mejor'));
  assert.ok(src.includes('me.points < 21'));
  assert.ok(src.includes('rankSlipNotice(toAm(d))'));
  assert.ok(src.includes('Desde 21 puntos, una victoria solo suma +3 si la cuota (o la combinada del parlay) es -150 o mejor'));
  assert.ok(src.includes('No suma puntos al ranking (cuota menor a -150)'));
  const html = fs.readFileSync(__dirname + '/public/index.html', 'utf8');
  assert.ok(html.includes('slip-rank') && html.includes('slip-rank.ok') && html.includes('slip-rank.no'));
  assert.ok(fs.readFileSync(__dirname + '/public/sw.js', 'utf8').includes('ltb-shell-v29'));
});

console.log(n, 'rank-odds tests passed');
