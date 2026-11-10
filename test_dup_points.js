// Duplicate selections: only the first eligible ticket awards 3 ranking points. Money is unchanged.
const assert = require('node:assert/strict');
const { open, START_COINS } = require('./core');
let n = 0; const t = (name, fn) => { fn(); console.log('OK', name); n++; };

const mk = () => {
  const D = open(':memory:');
  D.setupAdmin('admin', '1234');
  const u = D.register(D.newInvite(), 'ana', '1234');
  const coins = () => D.bankStatus(u).coins;
  const pts = () => D.leaderboard('temporada').find(r => r.id === u).points;
  const wins = () => D.leaderboard('temporada').find(r => r.id === u).wins;
  const opt = (lineId, i = 0) => D.lines().find(l => l.id === lineId).options[i];
  return { D, u, coins, pts, wins, opt };
};
const twoWay = (D, title = 'L') => D.createLine(title, [{ label: 'A', odds: -110 }, { label: 'B', odds: 100 }]);

t('10 identical singles that all win: +3 points, all stakes paid', () => {
  const { D, u, coins, pts, wins, opt } = mk();
  const line = twoWay(D);
  const a = opt(line, 0).id, before = coins();
  const ids = [];
  for (let i = 0; i < 10; i++) ids.push(D.placeBet(u, a, 1000));
  assert.equal(coins(), before - 10000);
  D.settleLine(line, a);
  const pay = 1000 + Math.floor(1000 * 100 / 110);
  assert.equal(coins(), before - 10000 + pay * 10);
  assert.equal(pts(), 3);
  assert.equal(wins(), 1);
  const rows = D.db.prepare("SELECT id, rank_credit, status, payout FROM bets WHERE user_id=? ORDER BY id").all(u);
  assert.equal(rows.filter(r => r.status === 'won').length, 10);
  assert.equal(rows.filter(r => r.rank_credit === 1).length, 1);
  assert.equal(rows.filter(r => r.rank_credit === 0).length, 9);
  assert.equal(rows[0].rank_credit, 1);
  assert.ok(rows.every(r => r.payout === pay));
});

t('if the first ticket is cancelled, the next winning duplicate gets the 3 points', () => {
  const { D, u, pts, wins, opt } = mk();
  const line = twoWay(D);
  const a = opt(line, 0).id;
  const first = D.placeBet(u, a, 100);
  const second = D.placeBet(u, a, 100);
  D.cancelBet(u, first);
  D.settleLine(line, a);
  assert.equal(D.db.prepare('SELECT status, rank_credit FROM bets WHERE id=?').get(first).status, 'cancelled');
  const s = D.db.prepare('SELECT status, rank_credit FROM bets WHERE id=?').get(second);
  assert.equal(s.status, 'won'); assert.equal(s.rank_credit, 1);
  assert.equal(pts(), 3); assert.equal(wins(), 1);
});

t('first loses and a duplicate wins: the winner still gets 3 points', () => {
  const { D, u, pts, opt } = mk();
  const l1 = twoWay(D, 'X1'), l2 = twoWay(D, 'X2');
  // not the same line — need same selection. Same line, different options? That's not a duplicate.
  // Same option: can't lose and win the same option on one settlement.
  // Simulate: two identical logical picks on two lines with same event+market+outcome+point.
  const ev = { id: 'e1', title: 'NBA', home: 'LAL', away: 'BOS', unit: 'puntos', markets: [
    { key: 'totals', options: [{ label: 'Over', point: 15.5, odds: -115 }, { label: 'Under', point: 15.5, odds: -105 }] }] };
  const [tA] = D.createEvent(ev);
  // can't add a second identical totals line easily if unique per event? addEventMarket may allow only one totals.
  // Use two standalone custom lines with same market/outcome/point and same event_id by raw SQL? createLine doesn't set market.
  // Alternative story: first bet on Over 15.5 wins? We need first lost — so they must be on different option ids but same key, or sequential lines.
  // Better: place two bets on same option; we cannot have one lost and one won on the same option when the line settles.
  // The "first loses, second wins" case only happens if they are the same logical pick on different line rows (re-created market).
  D.db.prepare("UPDATE lines SET market='totals', event_id='dup', kind='custom' WHERE id=?").run(l1);
  D.db.prepare("UPDATE lines SET market='totals', event_id='dup', kind='custom' WHERE id=?").run(l2);
  D.db.prepare('UPDATE options SET outcome=?, point=? WHERE line_id=?').run('Over', 15.5, l1);
  D.db.prepare('UPDATE options SET outcome=?, point=? WHERE line_id=?').run('Over', 15.5, l2);
  const o1 = D.lines().find(l => l.id === l1).options[0];
  const o2 = D.lines().find(l => l.id === l2).options[0];
  D.placeBet(u, o1.id, 50);
  D.placeBet(u, o2.id, 50);
  D.settleLine(l1, D.lines().find(l => l.id === l1).options[1].id); // first lost
  assert.equal(pts(), 0);
  D.settleLine(l2, o2.id); // second won, same key
  assert.equal(pts(), 3);
});

t('two different selections: +6 points', () => {
  const { D, u, pts, opt } = mk();
  const l1 = twoWay(D, 'A'), l2 = twoWay(D, 'B');
  D.placeBet(u, opt(l1, 0).id, 50);
  D.placeBet(u, opt(l2, 0).id, 50);
  D.settleLine(l1, opt(l1, 0).id);
  D.settleLine(l2, opt(l2, 0).id);
  assert.equal(pts(), 6);
});

t('same parlay selections in any order count once; money still paid twice', () => {
  const { D, u, coins, pts, opt } = mk();
  const l1 = twoWay(D, 'P1'), l2 = twoWay(D, 'P2');
  const a = opt(l1, 0).id, b = opt(l2, 0).id;
  const before = coins();
  D.placeParlay(u, [a, b], 100);
  D.placeParlay(u, [b, a], 100);
  D.settleLine(l1, a); D.settleLine(l2, b);
  assert.equal(pts(), 3);
  assert.ok(coins() > before - 200); // both paid
  const rows = D.db.prepare("SELECT rank_credit, payout FROM parlays WHERE user_id=? AND status='won' ORDER BY id").all(u);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].rank_credit, 1);
  assert.equal(rows[1].rank_credit, 0);
  assert.ok(rows[0].payout > 100 && rows[1].payout > 100);
});

t('legacy won bets (rank_credit NULL) still count; new duplicates after deploy do not add points', () => {
  const { D, u, pts, opt } = mk();
  const line = twoWay(D);
  const line2 = twoWay(D, 'L2');
  D.db.prepare("UPDATE lines SET market='h2h', event_id='g', kind='custom' WHERE id IN (?,?)").run(line, line2);
  D.db.prepare("UPDATE options SET outcome=label WHERE line_id IN (?,?)").run(line, line2);
  const a = D.lines().find(l => l.id === line).options[0].id;
  const id = D.placeBet(u, a, 100);
  D.settleLine(line, a);
  D.db.prepare('UPDATE bets SET rank_credit=NULL WHERE id=?').run(id); // as if settled before this rule
  assert.equal(pts(), 3);
  const a2 = D.lines().find(l => l.id === line2).options[0].id;
  D.placeBet(u, a2, 100);
  D.settleLine(line2, a2);
  assert.equal(pts(), 3);
  assert.equal(D.db.prepare("SELECT rank_credit FROM bets WHERE option_id=? AND status='won'").get(a2).rank_credit, 0);
});

t('open duplicates expose repeatNoPoints; cancelling the first clears it on the next', () => {
  const { D, u, opt } = mk();
  const line = twoWay(D);
  const a = opt(line, 0).id;
  const first = D.placeBet(u, a, 100);
  const second = D.placeBet(u, a, 200);
  const mine = D.myBets(u);
  assert.equal(mine.find(b => b.id === first).repeatNoPoints, false);
  assert.equal(mine.find(b => b.id === second).repeatNoPoints, true);
  D.cancelBet(u, first);
  const after = D.myBets(u);
  assert.equal(after.find(b => b.id === second).repeatNoPoints, false);
});

t('UI shows the discreet repeat note', () => {
  const fs = require('node:fs');
  const src = fs.readFileSync(__dirname + '/public/app.js', 'utf8');
  const css = fs.readFileSync(__dirname + '/public/index.html', 'utf8');
  assert.ok(src.includes('Apuesta repetida: no suma puntos') && src.includes('repeatNoPoints'));
  assert.ok(css.includes('.hrb-dup{'));
});

console.log(n, 'dup-points tests passed');
