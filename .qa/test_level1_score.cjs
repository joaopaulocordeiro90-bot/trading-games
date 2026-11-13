/* Isolated economic regression for Level 1 score, based on the actual scenario fixture. */
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(root,'game.js'), 'utf8');
const level = JSON.parse(fs.readFileSync(path.join(root,'data/campaign/levels/level1.json'), 'utf8'));
const start = src.indexOf('function calculateCampaignOfferBasisSnapshot(');
const mid = src.indexOf('/* ============================================================================\n   CAMPANHA L1 — WORKBENCH',start);
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
for(let r=1;r<=4;r++){
  const rd=ctx.getRoundData(r);
  const o={...rd.offers_exw[2],ref_cbot_cent_bu:rd.cbot_cent_bu,ref_cambio:rd.usd};
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
memory.set('tg_campaign_l1_scorecard_v2','corrupt-json');
assert.equal(run('readCampaignL1Record()'),null);
state.campaign.levelId=2;
run('saveCampaignL1Record(buildCampaignLevel1Result())');
assert.equal(memory.get('tg_campaign_l1_scorecard_v2'),'corrupt-json','L2 must not update L1 record');
console.log(`OK: Level 1 scorecard 0–100, gates, ${winner.scorecard.total}-point winner, 60k non-competitive loss, local record and L2 isolation.`);