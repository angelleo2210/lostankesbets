// Ranking (owner t627): loans -7 can make points negative (6→-1, 0→-7, 3→-4); order = points, then win %, then coins.
const assert = require('node:assert/strict'); const { open, rankCmp } = require('./core');
let n = 0; const t = (name, fn) => { fn(); console.log('OK', name); n++; };
const mk = () => { const D = open(':memory:'); D.setupAdmin('admin', '1234'); const reg = nm => D.register(D.newInvite(), nm, '1234');
  const line = () => D.createLine('L' + Math.random(), [{ label: 'A', odds: 100 }, { label: 'B', odds: -110 }]);
  const opts = id => D.lines().find(l => l.id === id).options;
  const win = u => { const l = line(); D.placeBet(u, opts(l)[0].id, 10); D.settleLine(l, opts(l)[0].id); };
  const lose = u => { const l = line(); D.placeBet(u, opts(l)[0].id, 10); D.settleLine(l, opts(l)[1].id); };
  const setCoins = (u, c) => D.db.prepare('UPDATE users SET coins=? WHERE id=?').run(c, u);
  const row = u => D.leaderboard('temporada').find(r => r.id === u);
  return { D, reg, win, lose, setCoins, row }; };
t('owner examples: 6→-1, 0→-7, 3→-4 after one loan (no floor)', () => {
  const { D, reg, win, row } = mk(); const a = reg('seis'), b = reg('cero'), c = reg('tres');
  win(a); win(a); win(c);
  assert.equal(row(a).points, 6); assert.equal(row(b).points, 0); assert.equal(row(c).points, 3);
  D.takeLoan(a, 100); D.takeLoan(b, 100); D.takeLoan(c, 100);
  assert.equal(row(a).points, -1); assert.equal(row(b).points, -7); assert.equal(row(c).points, -4);
});
t('points beat higher win %', () => {
  const { D, reg, win, lose } = mk(); const a = reg('alfa'), b = reg('beta');
  for (let i = 0; i < 3; i++) win(a); for (let i = 0; i < 3; i++) lose(a); // 9 pts, 50%
  win(b); win(b); lose(b); // 6 pts, 66.7%
  const tb = D.tabla('temporada'); assert.deepEqual(tb.podium.slice(0, 2).map(r => r.id), [a, b]); assert.equal(D.ranks().get(a), 1); assert.equal(D.ranks().get(b), 2);
});
t('win % beats money at equal points', () => {
  const { D, reg, win, lose, setCoins } = mk(); const a = reg('pobre'), b = reg('rico');
  win(a); win(a); lose(a);            // 6 pts, 66.7%
  win(b); win(b); lose(b); lose(b);   // 6 pts, 50%
  setCoins(a, 10); setCoins(b, 999999);
  const tb = D.tabla('temporada'); assert.deepEqual(tb.podium.slice(0, 2).map(r => r.id), [a, b]); assert.equal(D.ranks().get(a), 1);
});
t('money breaks exact points + win % tie (name only after)', () => {
  const { D, reg, win, lose, setCoins } = mk(); const a = reg('aaa'), b = reg('zzz');
  for (const u of [a, b]) { win(u); win(u); lose(u); }
  setCoins(a, 100); setCoins(b, 5000);
  const tb = D.tabla('temporada'); assert.deepEqual(tb.podium.slice(0, 2).map(r => r.id), [b, a]); assert.equal(D.ranks().get(b), 1); assert.equal(D.ranks().get(a), 2);
  setCoins(b, 100); assert.deepEqual(D.tabla('temporada').podium.slice(0, 2).map(r => r.id), [a, b]); // full tie → name
});
t('negative points stay eligible for the podium (≥3 settled), no floor; table/podium/badges share one comparator', () => {
  const { D, reg, win, lose, row } = mk(); const a = reg('neg'), b = reg('pos');
  win(a); lose(a); lose(a); D.takeLoan(a, 100); D.takeLoan(a, 100); // 3 - 14 = -11
  win(b); lose(b); lose(b);
  assert.equal(row(a).points, -11);
  const tb = D.tabla('temporada'); assert.deepEqual(tb.podium.filter(r => r.id === a || r.id === b).map(r => r.id), [b, a]); assert.equal(tb.rows.find(r => r.id === a).points, -11);
  assert.deepEqual(tb.podium.map(r => r.id), tb.rows.slice(0, 3).map(r => r.id));
  assert.deepEqual([...tb.rows].sort(rankCmp).map(r => r.id), tb.rows.map(r => r.id));
  assert.equal(D.ranks().get(b), 1); assert.equal(D.ranks().get(a), 2);
});
t('owner t628: no minimum — 0/1/2-bet players can podium; 0 pts above a negative loan player; badges = same order (non-admin)', () => {
  const { D, reg, win, lose, setCoins } = mk(); const z = reg('cero'), one = reg('uno'), two = reg('dos'), neg = reg('deuda'), vet = reg('veterano');
  win(one);                                   // 1 bet: 3 pts 100%
  win(two); lose(two);                        // 2 bets: 3 pts 50%
  for (let i = 0; i < 4; i++) lose(vet);      // 4 bets: 0 pts 0%
  D.takeLoan(neg, 100);                       // 0 bets: -7
  setCoins(z, 50000); setCoins(vet, 40000); D.db.prepare('UPDATE users SET coins=0 WHERE is_admin=1').run(); // admin stays in the table/podium policy; keep it below for this case
  const tb = D.tabla('temporada');
  assert.deepEqual(tb.podium.map(r => r.id), [one, two, z]);  // z (0 bets, 0 pts, 0%) beats vet on coins
  const ids = tb.rows.map(r => r.id); assert.ok(ids.indexOf(z) < ids.indexOf(neg) && ids.indexOf(vet) < ids.indexOf(neg));
  const zr = tb.rows.find(r => r.id === z); assert.equal(zr.winPct, 0); assert.equal(zr.points, 0); assert.equal(zr.wins + zr.losses, 0);
  assert.equal(tb.rows.find(r => r.id === neg).points, -7);
  const nonAdmin = D.leaderboard('temporada').filter(r => !r.is_admin).slice(0, 3).map(r => r.id);
  const rk = D.ranks(); assert.deepEqual([...rk.entries()].sort((a, b) => a[1] - b[1]).map(e => e[0]), nonAdmin);
  assert.equal(rk.get(z), 3); // no ≥1-win threshold for badges
  const lb = D.leaderboard('temporada'); assert.equal(lb.find(r => r.id === z).badge, '🥉'); assert.equal(lb.find(r => r.id === one).badge, '🥇');
});
console.log(n + ' ranking tests passed');
