// Duplicate selections: only the first eligible ticket awards 3 ranking points. Money is unchanged.
const assert = require('node:assert/strict');
const { open, START_COINS } = require('./core');
let n = 0; const t = (name, fn) => { fn(); console.log('OK', name); n++; };

const mk = () => {
  const D = open(':memory:');
  D.setupAdmin('admin', '1234');
  const u = D.register(D.newInvite(), 'ana', '1234');
  const coins = () => D.bankStatus(u).coins;
  const row = () => D.leaderboard('temporada').find(r => r.id === u);
  const pts = () => row().points;
  const wins = () => row().wins;
  const losses = () => row().losses;
  const pct = () => row().winPct;
  const streak = () => row().streak;
  const opt = (lineId, i = 0) => D.lines().find(l => l.id === lineId).options[i];
  return { D, u, coins, pts, wins, losses, pct, streak, row, opt };
};
const twoWay = (D, title = 'L') => D.createLine(title, [{ label: 'A', odds: -110 }, { label: 'B', odds: 100 }]);

t('10 identical singles that all win: +3 points, all stakes paid', () => {
  const { D, u, coins, pts, wins, losses, pct, streak, opt } = mk();
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
  assert.equal(losses(), 0);
  assert.equal(pct(), 100);
  assert.equal(streak(), null); // one unique win is not a 3-win cup/streak
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

t('already-settled identical wins with NULL rank_credit also count only once', () => {
  const { D, u, pts, coins, opt } = mk();
  const line = twoWay(D);
  const a = opt(line, 0).id;
  const before = coins();
  const ids = [];
  for (let i = 0; i < 10; i++) ids.push(D.placeBet(u, a, 100));
  D.settleLine(line, a);
  D.db.prepare("UPDATE bets SET rank_credit=NULL, sel_key=NULL WHERE user_id=?").run(u);
  assert.equal(pts(), 3);
  assert.equal(D.leaderboard('temporada').find(r => r.id === u).wins, 1);
  const pay = 100 + Math.floor(100 * 100 / 110);
  assert.equal(coins(), before - 1000 + pay * 10); // money untouched
});

t('a unique legacy win (rank_credit NULL) still counts; a later duplicate does not add points', () => {
  const { D, u, pts } = mk();
  const line = twoWay(D);
  const line2 = twoWay(D, 'L2');
  D.db.prepare("UPDATE lines SET market='h2h', event_id='g', kind='custom' WHERE id IN (?,?)").run(line, line2);
  D.db.prepare("UPDATE options SET outcome=label WHERE line_id IN (?,?)").run(line, line2);
  const a = D.lines().find(l => l.id === line).options[0].id;
  const id = D.placeBet(u, a, 100);
  D.settleLine(line, a);
  D.db.prepare('UPDATE bets SET rank_credit=NULL, sel_key=NULL WHERE id=?').run(id);
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


t('audit lists historical duplicate points before and after without changing money', () => {
  const { D, u, coins, opt } = mk();
  const line = twoWay(D);
  const a = opt(line, 0).id;
  const before = coins();
  for (let i = 0; i < 5; i++) D.placeBet(u, a, 100);
  D.settleLine(line, a);
  D.db.prepare("UPDATE bets SET rank_credit=NULL, sel_key=NULL WHERE user_id=?").run(u);
  const money = coins();
  const audit = D.auditDupPoints();
  const row = audit.find(r => r.userId === u);
  assert.equal(row.wonBefore, 5);
  assert.equal(row.wonAfter, 1);
  assert.equal(row.pointsBefore, 15);
  assert.equal(row.pointsAfter, 3);
  assert.equal(row.pointsDelta, -12);
  assert.equal(row.groups.length, 1);
  assert.equal(row.groups[0].wonCount, 5);
  assert.equal(row.groups[0].creditedId, row.groups[0].tickets[0].id);
  assert.equal(coins(), money);
});


t('identical losses count as one loss, 0% hit rate, no ice streak', () => {
  const { D, u, wins, losses, pct, streak, opt } = mk();
  const line = twoWay(D);
  const a = opt(line, 0).id, b = opt(line, 1).id;
  for (let i = 0; i < 10; i++) D.placeBet(u, a, 100);
  D.settleLine(line, b);
  assert.equal(wins(), 0);
  assert.equal(losses(), 1);
  assert.equal(pct(), 0);
  assert.equal(streak(), null);
});

t('1 unique win + 9 duplicate losses of another pick: 50% not 10%, one cup', () => {
  const { D, u, wins, losses, pct, pts, opt } = mk();
  const l1 = twoWay(D, 'W'), l2 = twoWay(D, 'L');
  D.placeBet(u, opt(l1, 0).id, 50);
  for (let i = 0; i < 9; i++) D.placeBet(u, opt(l2, 0).id, 50);
  D.settleLine(l1, opt(l1, 0).id);
  D.settleLine(l2, opt(l2, 1).id);
  assert.equal(wins(), 1);
  assert.equal(losses(), 1);
  assert.equal(pct(), 50);
  assert.equal(pts(), 3);
});

t('5 copies of the same win do not make a fire streak; 3 different wins do', () => {
  const { D, u, streak, wins, opt } = mk();
  const line = twoWay(D);
  for (let i = 0; i < 5; i++) D.placeBet(u, opt(line, 0).id, 50);
  D.settleLine(line, opt(line, 0).id);
  assert.equal(wins(), 1);
  assert.equal(streak(), null);
  const ids = [];
  for (let i = 0; i < 3; i++) {
    const l = twoWay(D, 'U' + i);
    ids.push([l, opt(l, 0).id]);
    D.placeBet(u, opt(l, 0).id, 50);
  }
  for (const [l, a] of ids) D.settleLine(l, a);
  assert.equal(wins(), 4);
  const st = streak();
  assert.equal(st.kind, 'fuego');
  assert.equal(st.n, 4);
  assert.equal(st.intense, false);
});

t('same parlay five times winning: one cup, 100%, paid five times, no farmed streak', () => {
  const { D, u, coins, wins, losses, pct, streak, pts, opt } = mk();
  const l1 = twoWay(D, 'P1'), l2 = twoWay(D, 'P2');
  const a = opt(l1, 0).id, b = opt(l2, 0).id;
  const before = coins();
  for (let i = 0; i < 5; i++) D.placeParlay(u, [a, b], 100);
  D.settleLine(l1, a); D.settleLine(l2, b);
  assert.equal(wins(), 1);
  assert.equal(losses(), 0);
  assert.equal(pct(), 100);
  assert.equal(pts(), 3);
  assert.equal(streak(), null);
  assert.ok(coins() > before); // all five paid
  assert.equal(D.db.prepare("SELECT COUNT(*) c FROM parlays WHERE user_id=? AND status='won'").get(u).c, 5);
});

t('auditDupStats reports cups, %, and streak before/after without touching money', () => {
  const { D, u, coins, opt } = mk();
  const line = twoWay(D);
  const a = opt(line, 0).id, b = opt(line, 1).id;
  for (let i = 0; i < 5; i++) D.placeBet(u, a, 100);
  D.settleLine(line, b); // 5 identical losses
  const money = coins();
  const row = D.auditDupStats().find(r => r.userId === u);
  assert.equal(row.beforeRaw.wins, 0);
  assert.equal(row.beforeRaw.losses, 5);
  assert.equal(row.beforeRaw.winPct, 0);
  assert.equal(row.beforeRaw.streak, 'hielo x5 intense');
  assert.equal(row.beforeThisDeploy.losses, 5);
  assert.equal(row.after.wins, 0);
  assert.equal(row.after.losses, 1);
  assert.equal(row.after.winPct, 0);
  assert.equal(row.after.streak, null);
  assert.equal(row.groups[0].lostCount, 5);
  assert.equal(coins(), money);
});

console.log(n, 'dup-points tests passed');


