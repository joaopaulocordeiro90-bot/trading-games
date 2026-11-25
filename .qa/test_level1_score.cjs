/* Isolated economic regression for Level 1 score, based on the actual scenario fixture. */
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(root,'game.js'), 'utf8');
const level = JSON.parse(fs.readFileSync(path.join(root,'data/campaign/levels/level1.json'), 'utf8'));
const start = src.indexOf('function calculateCampaignOfferBasisSnapshot(');
const mid = src.indexOf('/* ============================================================================\n   CAMPANHA L1 — INTERFACE INTEGRADA AO CADERNO',start);
const scoreStart = src.indexOf('/* ==========================================================================\n   CAMPANHA L1 — SCORECARD DIDÁTICO V2', mid);
const scoreEnd = src.indexOf('function positionAccessModalOnCanvas()',scoreStart);
assert(start>0&&mid>start&&scoreStart>mid&&scoreEnd>scoreStart,'L1 score engine missing');
const memory = new Map();
const state = { round:1,campaign:{levelId:1,active:true},confirmed:{exw:{}},choices:{exw:{}} };
const ctx = {
 state, console, BU_PER_TON_SOY:36.7437, SACKS_PER_TON:1000/60,
 localStorage:{getItem:key=>memory.get(key)??null,setItem:(key,val)=>memory.set(key,val)},
 getCampaignLevel:()=>level,
 getRoundData:r=>level.scenario.rounds.find(x=>Number(x.round)===Number(r)),
 formatOfferDisplayName:o=>(o?.label||'Origem').split(' - ')[0],
 getExwInlandByCorridor:o=>o?.inland_by_corridor||{},
 centsBuToUsdT:v=>(Number(v||0)/100)*36.7437,
 campaignWeightedAverage:(lots,key)=>{
   let t=0,s=0;
   for(const o of lots){const v=Number(o.usedVolumeT||0);if(v>0){t+=v;s+=Number(o[key]||0)*v;}}
   return t?s/t:0;
 },
 formatCampaignSigned:(n,d=1,s='')=>`${n>0?'+':''}${Number(n).toFixed(d)}${s}`,
 formatTon:x=>Math.round(x).toLocaleString('pt-BR'),
 formatCampaignUsd:x=>`US$ ${Number(x).toFixed(0)}`,
 escapeHtml:s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;')
};
vm.createContext(ctx);
vm.runInContext(src.slice(start,mid),ctx);
vm.runInContext(src.slice(scoreStart,scoreEnd),ctx);
const run=(expr)=>vm.runInContext(expr,ctx);
const result=()=>run('buildCampaignLevel1Result()');
const baseline=result();
assert.equal(baseline.approved,false,'Blank cargo cannot pass');
assert.equal(baseline.scorecard.total,0);
assert.equal(baseline.missingT,60000);
const winnerIds=[3,2,1,4,1];
for(let r=1;r<=5;r++){
  const rd=ctx.getRoundData(r);
  const o={...rd.offers_exw[winnerIds[r-1]-1],ref_cbot_cent_bu:rd.cbot_cent_bu,ref_cambio:rd.usd};
  const cap=60000-Object.values(state.confirmed.exw).reduce((sum,x)=>sum+x.volume_t,0);
  o.volume_t=Math.min(o.volume_t,cap);
  state.confirmed.exw[r]=o;
}
const winner=result();
assert.equal(winner.totalUsedT,60000);
assert.equal(winner.excessT,0);
assert.equal(winner.economicApproved,true);
assert.equal(winner.approved,true,'Good decisions should unlock L2');
assert(winner.scorecard.total>=70&&winner.scorecard.total<=100);
assert.equal(winner.scorecard.total,winner.scorecard.origination+winner.scorecard.margin+winner.scorecard.utilization+winner.scorecard.discipline);
run('saveCampaignL1Record(buildCampaignLevel1Result())');
const saved=run('readCampaignL1Record()');
assert.equal(saved.bestScore,winner.scorecard.total);
assert.equal(saved.approved,true);
assert.equal(saved.version,2);
// Test poor purchases: fill all vessel capacity with consistently high-basis alternatives.
state.confirmed.exw={};
for(let r=1;r<=5;r++){
 const rd=ctx.getRoundData(r); const o={...rd.offers_exw[3],ref_cbot_cent_bu:rd.cbot_cent_bu,ref_cambio:rd.usd};
 const cap=60000-Object.values(state.confirmed.exw).reduce((sum,x)=>sum+x.volume_t,0);
 if(cap<=0)break;
 o.volume_t=Math.min(o.volume_t,cap);state.confirmed.exw[r]=o;
}
const loser=result();
assert.equal(loser.totalUsedT,60000);
assert.equal(loser.approved,false,'Non-competitive full cargo must not pass');
assert(loser.basisAvg>level.targetBasisCentBu);
run('saveCampaignL1Record(buildCampaignLevel1Result())');
assert.equal(run('readCampaignL1Record()').bestScore,saved.bestScore,'Best score must not regress');
assert.equal(run('readCampaignL1Record()').approved,true,'Historical approval retained');
// If the record is corrupt, never crash rendering.
memory.set('tg_campaign_l1_scorecard_final_v1','corrupt-json');
assert.equal(run('readCampaignL1Record()'),null);
state.campaign.levelId=2;
run('saveCampaignL1Record(buildCampaignLevel1Result())');
assert.equal(memory.get('tg_campaign_l1_scorecard_final_v1'),'corrupt-json','L2 must not update L1 record');
console.log(`OK: Level 1 scorecard 0–100, gates, ${winner.scorecard.total}-point winner, 60k non-competitive loss, local record and L2 isolation.`);
/* Exhaustive 5^5: 0=wait, 1..4=offer; the engine's actual score and volume gates
   must agree with independently computed replacement and scoring. */
state.campaign.levelId=1;
const scenarios=level.scenario.rounds.map(rd=>rd.offers_exw.map(o=>{
 const independent=((o.price_brl_saca*1000/60+o.freight_brl_t_santos)/rd.usd+level.fixedFobbingUsdT+level.fixedFreightUsdT)*100/36.7437-rd.cbot_cent_bu;
 const actual=run('calculateCampaignOfferBasisSnapshot('+JSON.stringify(o)+','+rd.round+').basisCentBu');
 assert(Math.abs(independent-actual)<.0001,'Independent replacement mismatch R'+rd.round+' '+o.city);
 return {offer:o,basis:independent};
}));
const bestSlots=scenarios.map(r=>r.reduce((a,b)=>a.basis<b.basis?a:b).offer.id);
assert.deepEqual(bestSlots,[3,2,1,4,1],'Best opportunities must rotate by origin');
let paths=0,full=0,approved=0,best=0,uniquePass=new Set(),fixedPass=0;
function audit(seq){
 state.confirmed.exw={};let remaining=60000,weighted=0,regret=0,positive=0,compliant=0;
 const effective=seq.slice();
 for(let i=0;i<5;i++){
  const choice=seq[i];if(!choice||remaining===0){if(remaining===0)effective[i]=0;continue;}
  const row=scenarios[i][choice-1],o={...row.offer},v=Math.min(remaining,o.volume_t);
  o.volume_t=v;state.confirmed.exw[i+1]=o;remaining-=v;
  weighted+=row.basis*v;
  regret+=(row.basis-Math.min(...scenarios[i].map(x=>x.basis)))*v;
  if(row.basis<=130)positive+=v;if(row.basis<=125)compliant+=v;
 }
 const vol=60000-remaining,avg=vol?weighted/vol:0;
 const clamp=x=>Math.max(0,Math.min(1,x));
 const expected=vol?Math.round(35*clamp(1-regret/vol/45))+Math.round(30*clamp((130-avg)/40))+Math.round(20*vol/60000)+Math.round(5+5*positive/vol+5*compliant/vol):0;
 const r=result(),ok=vol===60000&&avg<=125&&expected>=70;
 assert.equal(r.totalUsedT,vol);assert(Math.abs(r.basisAvg-avg)<.0001);
 assert(Math.abs(r.grossMarginUsd-(vol?(130-avg)*.367437*vol:0))<.05);
 assert.equal(r.scorecard.total,expected);assert.equal(r.approved,ok);
 paths++;if(vol===60000)full++;if(ok){approved++;uniquePass.add(effective.join(''));best=Math.max(best,expected);if(seq.every(x=>x===seq[0]))fixedPass++;}
}
for(let i=0;i<3125;i++){let n=i,seq=[];for(let j=0;j<5;j++){seq.push(n%5);n=Math.floor(n/5);}audit(seq);}
assert.equal(paths,3125);assert.equal(full,1362);assert.equal(approved,384);assert.equal(fixedPass,0);assert.equal(best,95);
console.log('AUDITORIA FINAL: '+paths+' sequências; '+full+' cargo completo; '+approved+' aprovadas (inclui equivalências após encher navio); '+uniquePass.size+' trajetórias distintas aprovadas; melhor '+best+'/100; nenhuma posição fixa aprova.');
