const assert = require('node:assert/strict');
const { open } = require('./core');
process.env.ODDS_CACHE_MS='0';
const { parseEvents, upcoming, sportKey, DEFAULT_SPORT } = require('./odds-api');
const M = require('./public/markets');
let n = 0; const t = (name, fn) => { fn(); console.log('OK', name); n++; };
const options = {
  h2h: [{label:'Local',odds:-135},{label:'Visita',odds:210},{label:'Draw',odds:250}],
  spreads: [{label:'Local',point:-1,odds:125},{label:'Visita',point:1,odds:-145}],
  totals: [{label:'Over',point:3,odds:105},{label:'Under',point:3,odds:-120}]
};
const event = id => ({id,title:'Local vs Visita',home:'Local',away:'Visita',unit:'goles',markets:Object.entries(options).map(([key,options])=>({key,options}))});
const florida = {key:'hardrockbet_fl',title:'Hard Rock Bet (FL)',markets:Object.keys(options).map(key=>({key,outcomes:options[key].map(o=>({name:o.label,price:o.odds,...(key==='h2h'?{}:{point:o.point})}))}))};
const fixture = {id:'real-1',sport_key:'soccer_epl',sport_title:'EPL',home_team:'Local',away_team:'Visita',bookmakers:[{...structuredClone(florida),key:'fanduel',title:'Wrong book'},florida]};
t('provider: strictly Florida, preserving points and own American odds',()=>{
 const [e]=parseEvents([fixture]);assert.equal(e.markets.length,3);assert.equal(e.unit,'goles');assert.equal(e.markets[1].options[0].point,-1);assert.equal(e.markets[1].options[0].odds,125);assert.equal(e.markets[2].bookmaker,'Hard Rock Bet (Florida)');
 for(const key of ['hardrockbet','hardrockbet_az','hardrockbet_oh','fanduel',undefined]) assert.deepEqual(parseEvents([{...fixture,bookmakers:[{...florida,key}]}]),[]);
 const missing=structuredClone(fixture);missing.bookmakers[1].markets=[florida.markets[0]];
 assert.deepEqual(parseEvents([missing])[0].markets.map(m=>m.key),['h2h']);assert.deepEqual(parseEvents([{...fixture,bookmakers:[]}]),[]);
 const bad=structuredClone(fixture);bad.bookmakers[1].markets[1].outcomes[0].point=undefined;assert.deepEqual(parseEvents([bad])[0].markets.map(m=>m.key),['h2h','totals']);
 const quarter=structuredClone(fixture);quarter.bookmakers[1].markets[1].outcomes.forEach(o=>o.point/=4);assert.equal(parseEvents([quarter])[0].markets.some(m=>m.key==='spreads'),false);
});
const Q=open(':memory:');Q.setupAdmin('admin','1234');const u=Q.register(Q.newInvite(),'jugador','1234');const coin=()=>Q.db.prepare('SELECT coins FROM users WHERE id=?').get(u).coins;
let ids;
t('import identity/idempotence, labels, distinct markets, atomic validation',()=>{
 const e=event('one');ids=Q.createEvent(e,'real');assert.equal(new Set(ids).size,3);assert.deepEqual(Q.createEvent(e,'real'),ids);
 let ls=Q.lines();assert.equal(ls.find(l=>l.id===ids[1]).options[0].point,-1);assert.match(ls.find(l=>l.id===ids[2]).options[0].label,/Total · Over O 3/);
 const before=ls.length;const broken=event('bad');broken.markets[2].options=[{label:'Over',point:3,odds:0}];assert.throws(()=>Q.createEvent(broken),/Faltan|Cuota/);assert.equal(Q.lines().length,before);
});
const op=id=>Q.lines().find(l=>l.id===id).options;
t('same event Draw+spread allowed (product/SGP); single markets coexist; cross settlement prohibited',()=>{
 const b=coin();assert.ok(Q.placeParlay(u,[op(ids[0])[2].id,op(ids[1])[0].id],100));assert.equal(coin(),b-100);
 const betA=Q.placeBet(u,op(ids[0])[0].id,100),betB=Q.placeBet(u,op(ids[1])[0].id,100);
 assert.throws(()=>Q.settleLine(ids[1],op(ids[0])[0].id),/inválida/);
 Q.settleLine(ids[0],op(ids[0])[0].id);
 assert.equal(Q.myBets(u).find(b=>b.id===betA).status,'won');assert.equal(Q.myBets(u).find(b=>b.id===betB).status,'open');
 Q.pushLine(ids[1]);assert.equal(Q.myBets(u).find(b=>b.id===betB).status,'refunded');assert.throws(()=>Q.pushLine(ids[1]),/cancelar/);
});
t('push voids only selected leg; other-event win pays reduced parlay, immutable odds+labels',()=>{
 const second=Q.createEvent(event('two'));const a=op(ids[2])[0],b=op(second[0])[0];const pid=Q.placeParlay(u,[a.id,b.id],100);const c=coin();
 Q.pushLine(ids[2]);let p=Q.myParlays(u).find(p=>p.id===pid);assert.equal(p.status,'open');assert.equal(p.legs[0].status,'cancelled');assert.match(p.legs[0].label,/O 3/);
 Q.settleLine(second[0],b.id);p=Q.myParlays(u).find(p=>p.id===pid);assert.equal(p.payout,174);assert.equal(coin(),c+174);assert.equal(p.legs[1].odds,-135);
});
t('all void parlay refund exactly once; half point cannot push; legacy bets intact',()=>{
 const x=Q.createEvent(event('x')),y=Q.createEvent(event('y'));const pid=Q.placeParlay(u,[op(x[1])[0].id,op(y[2])[0].id],123);const b=coin();Q.pushLine(x[1]);Q.pushLine(y[2]);assert.equal(coin(),b+123);assert.equal(Q.myParlays(u).find(p=>p.id===pid).status,'refunded');
 const half=event('half');half.markets=[{key:'totals',options:[{label:'Over',point:2.5,odds:-110},{label:'Under',point:2.5,odds:-105}]}];const [h]=Q.createEvent(half);assert.throws(()=>Q.pushLine(h),/medio/);
 const l=Q.createLine('legacy',[{label:'Sí',odds:100},{label:'No',odds:-120}]);const bet=Q.placeBet(u,op(l)[0].id,20);Q.settleLine(l,op(l)[0].id);assert.equal(Q.myBets(u).find(b=>b.id===bet).payout,40);assert.throws(()=>Q.pushLine(l),/solo/);
});
t('grouped mobile markup missing cells, order handicap/total/winner and draw only winner',()=>{
 const fs=require('node:fs'),vm=require('node:vm');const src=fs.readFileSync('public/app.js','utf8');
 const ctx={Markets:M,me:{is_admin:false},boleto:[],esc:s=>String(s),od:n=>n>0?'+'+n:String(n)};
 vm.runInNewContext(src.slice(src.indexOf('// Display-only'),src.indexOf('function boletoCard('))+'\nthis.cards=marketCards;',ctx);
 const lines=Q.lines().filter(l=>l.event_id==='half');const html=ctx.cards(lines);assert.ok(html.indexOf('Hándicap')<html.indexOf('Total'));assert.ok(html.indexOf('Total')<html.indexOf('Ganador'));assert.match(html,/O 2.5/);assert.match(html,/U 2.5/);assert.match(html,/No disponible/);assert.ok(!html.includes('>Empate<'));assert.match(html,/event-market-grid/);
 const draw=ctx.cards(Q.lines().filter(l=>l.event_id==='x'));assert.match(draw,/>Empate<\/span><span><\/span><span><\/span>/);assert.match(fs.readFileSync('public/index.html','utf8'),/markets.js/);
});
t('slip updates keep fixture DOM/viewport and stake; no render, focus, or forced top',()=>{
 const fs=require('node:fs'),vm=require('node:vm');const src=fs.readFileSync('public/app.js','utf8');
 const block=src.slice(src.indexOf('function bindBets('),src.indexOf('async function adminView('));
 let top=200,corrections=[],stake={value:'125'},html='';
 const buttons=[1,2].map(id=>({dataset:{add:String(id)},isConnected:true,getBoundingClientRect:()=>({top}),classList:{toggle(){}},setAttribute(){}}));
 const slip={set outerHTML(s){html=s;top+=55;}};
 const ctx={boleto:[],boletoStake:'',A:{querySelector:()=>slip,querySelectorAll:sel=>sel==='[data-add]'?buttons:[]},
  $:sel=>sel==='#ps'?stake:null,window:{innerHeight:800,scrollBy:o=>{corrections.push(o);top-=o.top;}},boletoCard:()=>'<div class="slip">new</div>',dec:n=>2,fmt:String,flash:()=>{},Markets:require('./public/markets'),slipQuote:b=>{const ev={};for(const x of b)if(x.event)ev[x.event]=x.lines||[];return require('./public/sgp').quote(b,ev);},render:()=>{throw new Error('Selection must not rerender page');}};
 vm.runInNewContext(block+'\nthis.bind=bindBets;',ctx);
 ctx.bind([{id:4,event_id:'event',kind:'real',title:'A-B',options:[{id:1,label:'Over O 3',odds:105},{id:2,label:'Under U 3',odds:-120}]}]);
 buttons[0].onclick();assert.equal(top,200);assert.equal(ctx.boleto.length,1);assert.equal(ctx.boletoStake,'125');assert.equal(html,'<div class="slip">new</div>');
 buttons[1].onclick();assert.equal(top,200);assert.equal(ctx.boleto.length,1);assert.equal(ctx.boleto[0].id,2);buttons[1].onclick();assert.equal(ctx.boleto.length,0);assert.equal(top,200);assert.equal(ctx.boletoStake,'125');
 assert.equal(corrections.length,3);assert.ok(!block.includes('scrollIntoView')&&!block.includes('.focus(')&&!block.includes('scrollTo('));
});
t('legacy winner-only add handicap+total keeps old bets, creates selectable independent markets',()=>{
 const R=open(':memory:');R.setupAdmin('admin','1234');const u=R.register(R.newInvite(),'tester','1234');
 const id=R.createLine('Synthetic legacy fixture',[{label:'Local',odds:120},{label:'Visita',odds:-140},{label:'Empate',odds:230}]);
 const oldOptions=R.lines()[0].options;const bet=R.placeBet(u,oldOptions[0].id,25);const oldBet=R.myBets(u).find(b=>b.id===bet);
 const balance=R.db.prepare('SELECT coins FROM users WHERE id=?').get(u).coins;
 assert.throws(()=>R.addEventMarket(id,'spreads',options.spreads,'Incorrecto','Visita'),/coincidir/);
 assert.equal(R.lines()[0].event_id,null);
 const sp=R.addEventMarket(id,'spreads',options.spreads,'Local','Visita','goles');const total=R.addEventMarket(id,'totals',options.totals,'Local','Visita','goles');
 assert.equal(R.db.prepare('SELECT coins FROM users WHERE id=?').get(u).coins,balance);
 assert.deepEqual(R.lines().find(l=>l.id===id).options,oldOptions);{const strip=({home,away,...r})=>r;assert.deepEqual(strip(R.myBets(u).find(b=>b.id===bet)),strip(oldBet));}
 assert.equal(R.lines().length,3);assert.equal(new Set(R.lines().map(l=>l.event_id)).size,1);
 assert.throws(()=>R.addEventMarket(id,'totals',options.totals,'Local','Visita'),/ya existe/);
 // Each offered handicap and total outcome is a valid single selection.
 for(const lineId of [sp,total]) for(const o of R.lines().find(l=>l.id===lineId).options) assert.ok(R.placeBet(u,o.id,10));
 assert.ok(R.placeParlay(u,[oldOptions[0].id,R.lines().find(l=>l.id===total).options[0].id],10));assert.ok(R.placeParlay(u,[oldOptions[2].id,R.lines().find(l=>l.id===sp).options[0].id],10));
 const other=R.createLine('Other fixture',[{label:'A',odds:110},{label:'B',odds:-120}]);
 assert.ok(R.placeParlay(u,[R.lines().find(l=>l.id===sp).options[0].id,R.lines().find(l=>l.id===other).options[0].id],10));
 const fs=require('node:fs'),vm=require('node:vm'),src=fs.readFileSync('public/app.js','utf8');const ctx={Markets:M,me:{is_admin:true},boleto:[],esc:String,od:String};
 vm.runInNewContext(src.slice(src.indexOf('// Display-only'),src.indexOf('function boletoCard('))+'\nthis.cards=marketCards;',ctx);
 const html=ctx.cards(R.lines().filter(l=>l.event_id));
 for(const lineId of [sp,total]) for(const o of R.lines().find(l=>l.id===lineId).options) assert.ok(html.includes(`data-add="${o.id}"`));
 assert.ok(html.includes('O 3')&&html.includes('U 3')&&html.includes('+1')&&html.includes('-1'));
 R.settleLine(id,oldOptions[0].id);assert.equal(R.lines().find(l=>l.id===total).status,'open');
});
t('legacy cards retain three equal market columns with compact nonoverflowing mobile CSS',()=>{
 const fs=require('node:fs'),vm=require('node:vm');const src=fs.readFileSync('public/app.js','utf8'),css=fs.readFileSync('public/index.html','utf8');
 const ctx={Markets:M,me:{is_admin:true},boleto:[{id:100}],esc:String,od:String};
 vm.runInNewContext(src.slice(src.indexOf('// Display-only'),src.indexOf('function boletoCard('))+'\nthis.cards=marketCards;',ctx);
 const html=ctx.cards([{id:50,title:'Synthetic legacy',status:'open',kind:'custom',options:[{id:100,label:'Atlético de Madrid',odds:125},{id:101,label:'Barcelona',odds:-140},{id:102,label:'Empate',odds:230}]}]);
 assert.match(html,/event-market-grid/);assert.match(html,/Hándicap/);assert.match(html,/Total/);assert.match(html,/Ganador/);
 assert.equal((html.match(/class="market-unavailable"/g)||[]).length,4);assert.match(html,/>Empate<\/span><span><\/span><span><\/span>/);
 assert.match(html,/class="odds on"/);assert.match(html,/<details class="market-admin">/);assert.ok(html.indexOf('event-date')>html.indexOf('event-market-grid'));
 assert.match(css,/repeat\(3,minmax\(0,1fr\)\)/);assert.match(css,/width:100%!important;min-width:0!important;max-width:none!important/);
 assert.ok(css.includes('button.odds.on{background:#38bdf855'));
 for(const width of [390,470]){const content=width-48, gap=4*3, col=(content-gap)/4.5;assert.ok(col>60);assert.ok(col*4.5+gap<=content);}
});
(async()=>{
 const orig=global.fetch,old=process.env.ODDS_API_KEY;process.env.ODDS_API_KEY='test-only';
 try {global.fetch=async url=>{const request=new URL(url);assert.equal(request.searchParams.get('bookmakers'),'hardrockbet_fl');assert.equal(request.searchParams.has('regions'),false);assert.equal(request.searchParams.get('markets'),'h2h,spreads,totals');assert.equal(request.searchParams.get('oddsFormat'),'american');return {ok:true,json:async()=>[fixture]};};assert.equal((await upcoming()).events[0].markets.length,3);
 global.fetch=async()=>({ok:true,json:async()=>[{...fixture,bookmakers:[fixture.bookmakers[0]]}]});const absent=await upcoming();assert.deepEqual(absent.events,[]);assert.match(absent.notice,/no tiene mercados disponibles/);assert.match(absent.source,/Florida/);
 delete process.env.ODDS_API_KEY;global.fetch=async()=>{throw new Error('Must not request without key');};assert.match((await upcoming()).error,/ODDS_API_KEY/);process.env.ODDS_API_KEY='test-only';
 assert.match(require('node:fs').readFileSync('public/app.js','utf8'),/Nuevas importaciones: Hard Rock Bet \(Florida\) vía The Odds API/);
 global.fetch=async()=>({ok:false,status:422});assert.match((await upcoming()).error,/422/);
 assert.equal(DEFAULT_SPORT,'soccer_spain_la_liga');assert.equal(sportKey('upcoming'),DEFAULT_SPORT);assert.equal(sportKey('americanfootball_nfl'),DEFAULT_SPORT);assert.equal(sportKey('soccer_epl'),'soccer_epl');
 let urls=[];global.fetch=async u=>{urls.push(new URL(u).pathname);return {ok:true,json:async()=>[fixture]};};await upcoming();await upcoming('soccer_epl');assert.deepEqual(urls,['/v4/sports/soccer_spain_la_liga/odds','/v4/sports/soccer_epl/odds']);
 process.env.ODDS_CACHE_MS='60000';urls=[];await upcoming('soccer_usa_mls');await upcoming('soccer_usa_mls');assert.equal(urls.length,1);
 global.fetch=async()=>({ok:false,status:500});assert.match((await upcoming('soccer_italy_serie_a')).error,/500/);global.fetch=async u=>{urls.push(u);return {ok:true,json:async()=>[]};};const r2=await upcoming('soccer_italy_serie_a');assert.match(r2.notice,/Serie A: .*no tiene mercados/);process.env.ODDS_CACHE_MS='0';console.log('OK provider request and unavailable response');n++;}
 finally{global.fetch=orig;if(old===undefined)delete process.env.ODDS_API_KEY;else process.env.ODDS_API_KEY=old;}
 console.log(`${n} market tests passed`);
})().catch(e=>{console.error(e);process.exitCode=1;});

{const src=require('node:fs').readFileSync(__dirname+'/public/app.js','utf8');require('node:assert/strict').doesNotMatch(src,/'Ficticia'/);console.log('OK no Ficticia card label');}

{const assert=require('node:assert/strict');const M=require('./public/markets');
 const L=(line,market,outcome,point)=>({event:'real:psg',line,market,home:'PSG',away:'Troyes',outcome,point});
 const ok=gs=>assert.equal(M.sameEventError(gs),null,JSON.stringify(gs));
 ok([L(1,'h2h','PSG'),L(3,'totals','Over',3.5)]);ok([L(2,'spreads','PSG',8.5),L(3,'totals','Under',24.5)]);
 ok([L(1,'h2h','Draw'),L(2,'spreads','PSG',-1.5)]);ok([L(5,'props','Under',null),L(6,'props','Under',null)]);
 ok([L(2,'spreads','PSG',8.5),L(5,'props','Under',null),L(6,'props','Over',null)]);
 assert.match(M.sameEventError([L(1,'h2h','PSG'),L(1,'h2h','Troyes')])||'',/una selección/);
 assert.equal(M.sameEventError([{...L(1,'h2h','PSG'),event:'a'},{...L(2,'h2h','Troyes'),event:'b'}]),null);console.log('OK same-event parlay feasibility');}

t('eventBucket: real sports, Locales for manual, never Ficticias', () => {
  assert.equal(M.eventBucket({ kind: 'real', sport: 'soccer' }), 'soccer');
  assert.equal(M.eventBucket({ kind: 'real', sport_key: 'soccer_uefa_nations_league' }), 'soccer');
  assert.equal(M.eventBucket({ kind: 'real', sport: 'mma' }), 'mma');
  assert.equal(M.eventBucket({ kind: 'real', sport_key: 'icehockey_nhl' }), 'hockey');
  assert.equal(M.eventBucket({ kind: 'real', sport: 'basketball' }), 'basketball');
  assert.equal(M.eventBucket({ kind: 'real', sport_key: 'baseball_mlb' }), 'baseball');
  assert.equal(M.eventBucket({ kind: 'custom', sport: 'soccer' }), 'locales');
  assert.equal(M.eventBucket({ kind: 'real', sport: 'other' }), 'other');
  assert.equal(M.eventBucketLabel('locales'), 'Locales');
  assert.equal(M.eventBucketLabel('mma'), 'UFC');
  assert.ok(!M.BUCKETS.some(([, lab]) => /ficticia/i.test(lab)));
  assert.equal(JSON.stringify(M.BUCKETS).includes('Ficticias'), false);
});

t('events sort by soonest upcoming start; started/closed after; no start last', () => {
  const now = Date.parse('2026-11-12T19:50:00Z');
  const later = { id: 3, starts: '2026-11-17T19:45:00Z', status: 'open', started: false };
  const today = { id: 8, starts: '2026-11-12T20:00:00Z', status: 'open', started: false };
  const started = { id: 9, starts: '2026-11-12T18:00:00Z', status: 'open', started: true };
  const closed = { id: 2, starts: '2026-11-12T16:00:00Z', status: 'closed', started: true };
  const none = { id: 5, starts: null, status: 'open', started: false };
  const none2 = { id: 1, starts: '', status: 'open' };
  const ordered = M.sortLinesByStart([later, none, started, today, none2, closed], now);
  assert.deepEqual(ordered.map(l => l.id), [8, 3, 2, 9, 1, 5]);
  const { open } = require('./core');
  const R = open(':memory:');
  const t0 = Date.now();
  R.createEvent({ id: 'wal', title: 'Wales vs Portugal', home: 'Wales', away: 'Portugal', starts: new Date(t0 + 5 * 86400e3).toISOString(), markets: [{ key: 'h2h', options: [{ label: 'Wales', odds: 200 }, { label: 'Portugal', odds: -150 }, { label: 'Draw', odds: 230 }] }] }, 'real');
  R.createEvent({ id: 'cz', title: 'Czech Republic vs Spain', home: 'Czech Republic', away: 'Spain', starts: new Date(t0 + 3600e3).toISOString(), markets: [{ key: 'h2h', options: [{ label: 'Czech Republic', odds: 180 }, { label: 'Spain', odds: 150 }, { label: 'Draw', odds: 220 }] }] }, 'real');
  R.createEvent({ id: 'done', title: 'Already started', home: 'A', away: 'B', starts: new Date(t0 - 3600e3).toISOString(), markets: [{ key: 'h2h', options: [{ label: 'A', odds: -110 }, { label: 'B', odds: -110 }] }] }, 'real');
  R.createLine('Sin fecha', [{ label: 'Sí', odds: 100 }, { label: 'No', odds: -120 }]);
  const titles = R.lines().map(l => l.title);
  const iToday = titles.findIndex(x => /Czech/.test(x));
  const iLater = titles.findIndex(x => /Wales/.test(x));
  const iNone = titles.findIndex(x => x === 'Sin fecha');
  assert.ok(iToday >= 0 && iLater >= 0 && iNone >= 0);
  const iStarted = titles.findIndex(x => x === 'Already started' || /Already started/.test(x));
  assert.ok(iToday < iLater, 'today before later');
  assert.ok(iLater < iStarted || iStarted < 0, 'upcoming before already started');
  assert.ok(iLater < iNone, 'dated events before no-start');
  assert.ok(iStarted < iNone, 'started before no-start');
  const groups = [['later', later], ['today', today], ['started', started], ['none', none]].map(([, l]) => [l]);
  const grouped = M.sortGroupsByStart(groups, now);
  assert.deepEqual(grouped.map(g => g[0].id), [8, 3, 9, 5]);
});
