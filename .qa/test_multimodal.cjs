const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const E=require('../campaign-multimodal-engine.js');
const root=path.resolve(__dirname,'..'),near=(a,b)=>assert(Math.abs(a-b)<1e-7,String(a)+' != '+String(b));
const roundPoints=x=>Math.round(x+1e-9);
const load=n=>JSON.parse(fs.readFileSync(path.join(root,'data/campaign/levels/level'+n+'.json'),'utf8'));
for(const id of [2,3]){
 const l=load(id),rounds=l.scenario.rounds,K=.367437,clamp=x=>Math.max(0,Math.min(1,x)),expected=id===2?{n:59049,full:51360,pass:3012,unique:1268,best:99,roadOnly:153,railOnly:132,mixed:2727}:{n:531441,full:504112,pass:42852,unique:11516,best:100,roadOnly:1467,railOnly:1534,mixed:39851};
 assert.equal(rounds.length,id===2?5:6);assert.equal(l.fixedPort,'santos');assert.equal(l.targetVolumeT,60000);
 let road=0,rail=0,ties=0;
 const options=rounds.map((r,i)=>{
  assert.equal(r.round,i+1);assert.equal(r.offers_exw.length,4);assert.equal(new Set(r.offers_exw.map(o=>o.label)).size,4);
  assert(r.master_news&&r.market_signal&&r.previous_news_review);
  if(i<rounds.length-1){const n=rounds[i+1],d=r.impact_next;near(n.usd-r.usd,d.usd_brl);near(n.cbot_cent_bu-r.cbot_cent_bu,d.cbot_cent_bu);near(n.rail_brl_t-r.rail_brl_t,d.rail_brl_t);near(n.road_index-r.road_index,d.road_index);near(n.feeder_index-r.feeder_index,d.feeder_index);near(n.physical_reference.price_brl_sc-r.physical_reference.price_brl_sc,d.physical_reference_brl_sc);}else assert.equal(r.impact_next,undefined);
  const out=r.offers_exw.flatMap(o=>{
   assert.equal(o.destination_port,'Santos');assert(Number.isFinite(o.lat)&&Number.isFinite(o.lng)&&o.volume_t>0&&o.price_brl_saca>0);
   assert.equal(o.logistics.rail.feeder_brl_t+o.logistics.rail.rail_brl_t,o.logistics.rail.brl_t);assert.equal(o.logistics.rail.rail_brl_t,r.rail_brl_t);
   if(o.logistics.road.brl_t<o.logistics.rail.brl_t)road++;else if(o.logistics.road.brl_t>o.logistics.rail.brl_t)rail++;else ties++;
   return E.MODES.map(m=>{const x=E.calc(l,r,o,m),cost=((o.price_brl_saca*1000/60+o.logistics[m].brl_t)/r.usd+l.fixedFobbingUsdT+l.fixedFreightUsdT)/K-r.cbot_cent_bu;near(x.basis,cost);near(x.marginUsdT,(l.fixedSaleBasisCentBu-cost)*K);return {m,o,b:cost,d:o.logistics[m].brl_t-Math.min(o.logistics.road.brl_t,o.logistics.rail.brl_t)};});
  });const best=Math.min(...out.map(x=>x.b));return out.map((x,i)=>({...x,g:Math.min(out[i-i%2].b,out[i-i%2+1].b)-best}));
 });
 assert.deepEqual([road,rail,ties],id===2?[11,9,0]:[15,9,0]);
 let n=0,full=0,pass=0,best=0,roadOnly=0,railOnly=0,mixed=0,unique=new Set();
 function walk(i,lots,vol,bs,gs,ds,pos,comp,mask,effective){
  if(i===rounds.length){n++;const b=vol?bs/vol:0,score=vol?roundPoints(25*clamp(1-gs/vol/45))+roundPoints(25*clamp((l.fixedSaleBasisCentBu-b)/40))+roundPoints(20*clamp(1-ds/vol/75))+roundPoints(20*clamp(vol/60000))+roundPoints(5*pos/vol+5*comp/vol):0;
   const r=E.result(l,lots),ok=vol===60000&&b<=l.targetBasisCentBu+1e-9&&b<=l.fixedSaleBasisCentBu&&score>=70;
   near(r.basis,b);near(r.margin,(l.fixedSaleBasisCentBu-b)*K*vol);near(r.logisticsLoss,ds);assert.equal(r.volume,vol);assert.equal(r.score.total,score);assert.equal(r.approved,ok);
   if(vol===60000)full++;if(ok){pass++;unique.add(effective);best=Math.max(best,score);if(mask===1)roadOnly++;else if(mask===2)railOnly++;else mixed++;}return;
  }
  for(let a=0;a<=8;a++){
   const x=options[i][a-1],q=a?Math.min(60000-vol,x.o.volume_t):0;
   if(!q){walk(i+1,lots,vol,bs,gs,ds,pos,comp,mask,effective+'0');continue;}
   const lot=E.decision(l,i+1,x.o.id,x.m,lots);assert.equal(lot.volume,q);assert.equal(lot.mode,x.m);
   walk(i+1,[...lots,lot],vol+q,bs+x.b*q,gs+x.g*q,ds+x.d*q,pos+(x.b<=l.fixedSaleBasisCentBu?q:0),comp+(x.b<=l.targetBasisCentBu?q:0),mask|(a%2?1:2),effective+a);
  }
 }
 walk(0,[],0,0,0,0,0,0,0,'');
 assert.deepEqual({n,full,pass,unique:unique.size,best,roadOnly,railOnly,mixed},expected);
 assert(mixed/pass>.9);
 const lot=E.decision(l,1,1,'road',[]);assert.throws(()=>E.decision(l,1,2,'rail',[lot]),/confirmada/);assert.throws(()=>E.decision(l,1,1,null,[]),/modal/);
 const winner=(id===2?'03481':'050831').split('').map(Number);assert(E.evaluate(l,winner).approved);assert(!E.evaluate(l,Array(l.rounds).fill(0)).approved);
 console.log('L'+id+' OK:',JSON.stringify({n,full,pass,distinct:unique.size,best,roadOnly,railOnly,mixed,road,rail}));
}
