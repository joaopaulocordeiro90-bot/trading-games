const fs=require('node:fs'),assert=require('node:assert/strict'),E=require('../campaign-multimodal-engine.js');
const near=(a,b)=>assert(Math.abs(a-b)<1e-6,String(a)+' != '+String(b)),rp=x=>Math.round(x+1e-9),clamp=x=>Math.max(0,Math.min(1,x));
for(const id of [2,3]){
const l=JSON.parse(fs.readFileSync('data/campaign/levels/level'+id+'.json')),rs=l.scenario.rounds;
assert.equal(rs.length,id===2?5:6);
let road=0,rail=0,alt=0,ties=0;
const all=rs.map((r,i)=>{
assert(r.offers_exw.some(o=>o.uf==='MT')&&r.offers_exw.some(o=>o.uf==='GO'||o.uf==='MG'||o.uf==='MS'));
if(i<rs.length-1){let n=rs[i+1];near(n.rail_tariffs.rondonopolis-r.rail_tariffs.rondonopolis,r.impact_next.rail_rondonopolis_brl_t);near(n.rail_brl_t-r.rail_brl_t,r.impact_next.rail_brl_t);near(n.cbot_cent_bu-r.cbot_cent_bu,r.impact_next.cbot_cent_bu);near(n.usd-r.usd,r.impact_next.usd_brl);}
const options=r.offers_exw.flatMap(o=>{
assert.equal(o.destination_port,'Santos');
assert(["Jataí","Rio Verde","Cristalina","Itumbiara","Silvânia","Chapadão do Sul","Sorriso","Lucas do Rio Verde","Nova Mutum","Primavera do Leste","Campo Novo do Parecis","Sinop","Sapezal","Querência","Água Boa"].includes(o.city));
const f=o.freight_reference;assert.equal(f.week,'2026-S46');assert.equal(o.logistics.road.brl_t,Math.round(f.road_santos_brl_t*r.road_index/100/5)*5);assert.equal(o.logistics.rail.feeder_brl_t,Math.round(f.feeder_brl_t*r.feeder_index/100/5)*5);
assert.equal(f.feeder_kind,o.city==='Rio Verde'?'simulated_local_access':'observed_spot_reference');
if(o.logistics.rail_alt)assert.equal(o.logistics.rail_alt.feeder_brl_t,Math.round(f.alternative_rio_verde_brl_t*r.feeder_index/100/5)*5);
assert.equal(new Set(r.offers_exw.map(x=>x.city)).size,4);assert.equal(o.logistics.rail.terminal,o.uf==='MT'?'rondonopolis':'rio_verde');
const modes=Object.keys(o.logistics);assert.equal(modes.length,id===2?2:o.logistics.rail_alt?3:2);if(o.logistics.rail_alt)alt++;
const min=Math.min(...modes.map(m=>o.logistics[m].brl_t));if(o.logistics.road.brl_t===min){if(modes.some(m=>m!=='road'&&o.logistics[m].brl_t===min))ties++;else road++;}else rail++;
return modes.map(m=>{const x=o.logistics[m];if(m!=='road'){assert.equal(x.rail_brl_t,r.rail_tariffs[x.terminal]);assert.equal(x.brl_t,x.feeder_brl_t+x.rail_brl_t);}
const b=((o.price_brl_saca*1000/60+x.brl_t)/r.usd+l.fixedFobbingUsdT+l.fixedFreightUsdT)/.367437-r.cbot_cent_bu;near(E.calc(l,r,o,m).basis,b);
return {o,m,b,d:x.brl_t-min,bmin:((o.price_brl_saca*1000/60+min)/r.usd+l.fixedFobbingUsdT+l.fixedFreightUsdT)/.367437-r.cbot_cent_bu};});});
const benchmark=Math.min(...options.map(x=>x.b));return options.map(x=>({...x,g:x.bmin-benchmark}));
});
let count=0,approved=0,best=0,mixed=0,bestSeq=null;
function walk(i,lots,seq,vol,bs,gs,ds,pos,comp,mask){
 if(i===rs.length){count++;const b=vol?bs/vol:0,score=vol?rp(25*clamp(1-gs/vol/45))+rp(25*clamp((l.fixedSaleBasisCentBu-b)/40))+rp(20*clamp(1-ds/vol/75))+rp(20*clamp(vol/60000))+rp(5*pos/vol+5*comp/vol):0;
 const out=E.result(l,lots),ok=vol===60000&&b<=l.targetBasisCentBu+1e-9&&b<=l.fixedSaleBasisCentBu&&score>=70;
 near(out.basis,b);near(out.margin,(l.fixedSaleBasisCentBu-b)*.367437*vol);assert.equal(out.score.total,score);assert.equal(out.approved,ok);if(ok){approved++;if(mask===3)mixed++;if(score>best){best=score;bestSeq=seq;}}return;}
 for(let j=0;j<=all[i].length;j++){const x=all[i][j-1],q=x?Math.min(60000-vol,x.o.volume_t):0;
 if(!q){walk(i+1,lots,[...seq,0],vol,bs,gs,ds,pos,comp,mask);continue;}
 const lot=E.decision(l,i+1,x.o.id,x.m,lots);assert.equal(lot.volume,q);
 walk(i+1,[...lots,lot],[...seq,j],vol+q,bs+x.b*q,gs+x.g*q,ds+x.d*q,pos+(x.b<=l.fixedSaleBasisCentBu?q:0),comp+(x.b<=l.targetBasisCentBu?q:0),mask|(x.m==='road'?1:2));
 }
}
walk(0,[],[],0,0,0,0,0,0,0);assert.equal(count,all.reduce((a,r)=>a*(r.length+1),1));assert(approved>0&&mixed>approved*.5&&road>0&&rail>0);if(id===3)assert(alt>=4);
assert(E.evaluate(l,bestSeq).approved);assert(!E.evaluate(l,Array(rs.length).fill(0)).approved);
console.log('DUAL_AUDIT',JSON.stringify({id,count,approved,best,mixed,road,rail,ties,alt,bestSeq}));
}
