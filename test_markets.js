const assert = require('node:assert/strict');
const { open } = require('./core');
const { parseEvents, upcoming } = require('./odds-api');
const M = require('./public/markets');
let n = 0; const t = (name, fn) => { fn(); console.log('OK', name); n++; };
const options = {
  h2h: [{label:'Local',odds:-135},{label:'Visita',odds:210},{label:'Draw',odds:250}],
  spreads: [{label:'Local',point:-1,odds:125},{label:'Visita',point:1,odds:-145}],
  totals: [{label:'Over',point:3,odds:105},{label:'Under',point:3,odds:-120}]
};
const event = id => ({id,title:'Local vs Visita',home:'Local',away:'Visita',unit:'goles',markets:Object.entries(options).map(([key,options])=>({key,options}))});
const fixture = {id:'real-1',sport_key:'soccer_epl',sport_title:'EPL',home_team:'Local',away_team:'Visita',bookmakers:[{title:'Solo ML',markets:[{key:'h2h',outcomes:options.h2h.map(o=>({name:o.label,price:o.odds}))}]},{title:'Otro',markets:['spreads','totals'].map(key=>({key,outcomes:options[key].map(o=>({name:o.label,price:o.odds,point:o.point}))}))}]};
t('provider: varied books complete markets preserve point+own American odds',()=>{
 const [e]=parseEvents([fixture]);assert.equal(e.markets.length,3);assert.equal(e.unit,'goles');assert.equal(e.markets[1].options[0].point,-1);assert.equal(e.markets[1].options[0].odds,125);assert.equal(e.markets[2].bookmaker,'Otro');
 const missing=parseEvents([{...fixture,bookmakers:[fixture.bookmakers[0]]}])[0];assert.deepEqual(missing.markets.map(m=>m.key),['h2h']);assert.deepEqual(parseEvents([{...fixture,bookmakers:[]}]),[]);
 const bad=structuredClone(fixture);bad.bookmakers[1].markets[0].outcomes[0].point=undefined;assert.deepEqual(parseEvents([bad])[0].markets.map(m=>m.key),['h2h','totals']);
 const quarter=structuredClone(fixture);quarter.bookmakers[1].markets[0].outcomes.forEach(o=>o.point/=4);assert.equal(parseEvents([quarter])[0].markets.some(m=>m.key==='spreads'),false);
});
const Q=open(':memory:');Q.setupAdmin('admin','1234');const u=Q.register(Q.newInvite(),'jugador','1234');const coin=()=>Q.db.prepare('SELECT coins FROM users WHERE id=?').get(u).coins;
let ids;
t('import identity/idempotence, labels, distinct markets, atomic validation',()=>{
 const e=event('one');ids=Q.createEvent(e,'real');assert.equal(new Set(ids).size,3);assert.deepEqual(Q.createEvent(e,'real'),ids);
 let ls=Q.lines();assert.equal(ls.find(l=>l.id===ids[1]).options[0].point,-1);assert.match(ls.find(l=>l.id===ids[2]).options[0].label,/Total · Over O 3/);
 const before=ls.length;const broken=event('bad');broken.markets[2].options=[{label:'Over',point:3,odds:0}];assert.throws(()=>Q.createEvent(broken),/Faltan|Cuota/);assert.equal(Q.lines().length,before);
});
const op=id=>Q.lines().find(l=>l.id===id).options;
t('same event correlated parlay rejected; single markets coexist; cross settlement prohibited',()=>{
 const b=coin();assert.throws(()=>Q.placeParlay(u,[op(ids[0])[0].id,op(ids[1])[0].id],100),/evento/);assert.equal(coin(),b);
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
 const ctx={Markets:M,boleto:[],esc:s=>String(s),od:n=>n>0?'+'+n:String(n)};
 vm.runInNewContext(src.slice(src.indexOf('function marketCards('),src.indexOf('function boletoCard('))+'\nthis.cards=marketCards;',ctx);
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
  $:sel=>sel==='#ps'?stake:null,window:{innerHeight:800,scrollBy:o=>{corrections.push(o);top-=o.top;}},boletoCard:()=>'<div class="slip">new</div>',dec:n=>2,fmt:String,flash:()=>{},render:()=>{throw new Error('Selection must not rerender page');}};
 vm.runInNewContext(block+'\nthis.bind=bindBets;',ctx);
 ctx.bind([{id:4,event_id:'event',kind:'real',title:'A-B',options:[{id:1,label:'Over O 3',odds:105},{id:2,label:'Under U 3',odds:-120}]}]);
 buttons[0].onclick();assert.equal(top,200);assert.equal(ctx.boleto.length,1);assert.equal(ctx.boletoStake,'125');assert.equal(html,'<div class="slip">new</div>');
 buttons[1].onclick();assert.equal(top,200);assert.equal(ctx.boleto.length,1);assert.equal(ctx.boleto[0].id,2);buttons[1].onclick();assert.equal(ctx.boleto.length,0);assert.equal(top,200);assert.equal(ctx.boletoStake,'125');
 assert.equal(corrections.length,3);assert.ok(!block.includes('scrollIntoView')&&!block.includes('.focus(')&&!block.includes('scrollTo('));
});
(async()=>{
 const orig=global.fetch,old=process.env.ODDS_API_KEY;process.env.ODDS_API_KEY='test-only';
 try {global.fetch=async url=>{assert.match(url,/markets=h2h,spreads,totals/);return {ok:true,json:async()=>[fixture]};};assert.equal((await upcoming()).events[0].markets.length,3);
 global.fetch=async()=>({ok:false,status:422});assert.match((await upcoming()).error,/422/);console.log('OK provider request and unavailable response');n++;}
 finally{global.fetch=orig;if(old===undefined)delete process.env.ODDS_API_KEY;else process.env.ODDS_API_KEY=old;}
 console.log(`${n} market tests passed`);
})().catch(e=>{console.error(e);process.exitCode=1;});
