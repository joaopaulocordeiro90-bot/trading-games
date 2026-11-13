/* Level 1 UX: checks the tab/calc output using the real source fragment, without a browser. */
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
const a = src.indexOf('/* ============================================================================\n   CAMPANHA L1 — WORKBENCH DE DECISÃO');
const b = src.indexOf('function buildCampaignStatusHtml()', a);
assert(a > 0 && b > a, 'Área isolada do L1 não encontrada');
const isolated = src.slice(a, b);
const level = JSON.parse(fs.readFileSync(path.join(root,'data/campaign/levels/level1.json')));
const state = {round:1, campaign:{active:true,levelId:1,l1Tab:'market',l1CalcVisible:false,l1Focus:false},choices:{exw:{}},confirmed:{exw:{}}};
const ctx = {
  state, console, BU_PER_TON_SOY:36.7437,
  document:{ getElementById:()=>null, createElement:()=>({}), head:{appendChild:()=>{}} },
  isCampaignMode:()=>state.campaign.active,
  getCampaignLevel:()=>level,
  getCurrentExwOffersForRender:rd=>rd.offers_exw,
  formatOfferDisplayName:o=>(o.label||'Origem').split(' - ')[0],
  escapeHtml:s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'),
  calculateCampaignOfferBasisSnapshot:o=>{
    const rd=level.scenario.rounds[state.round-1];
    const fx=Number(o.ref_cambio||rd.usd);
    const cbot=Number(o.ref_cbot_cent_bu||rd.cbot_cent_bu);
    const interior=(Number(o.price_brl_saca)*1000/60/fx)/36.7437*100;
    const inland=Number(o.inland_by_corridor?.santos||0);
    const cfr=interior+((inland+Number(level.fixedFobbingUsdT)+Number(level.fixedFreightUsdT))/36.7437)*100;
    const basis=cfr-cbot;
    return {basisCentBu:basis,cfrCostCentBu:cfr,cbotCentBu:cbot,interiorCentBu:interior,
      inlandUsdT:inland,fobbingUsdT:Number(level.fixedFobbingUsdT),maritimeUsdT:Number(level.fixedFreightUsdT),
      pnlUsdT:(Number(level.fixedSaleBasisCentBu)-basis)/100*36.7437};
  },
  calculateCampaignBookSnapshot:o=>{
    const lots=Object.values(state.confirmed.exw).map(x=>({...ctx.calculateCampaignOfferBasisSnapshot(x),volumeT:x.volume_t}));
    if(o)lots.push({...ctx.calculateCampaignOfferBasisSnapshot(o),volumeT:o.volume_t});
    const t=lots.reduce((s,x)=>s+x.volumeT,0);
    const avg=t?lots.reduce((s,x)=>s+x.volumeT*x.basisCentBu,0)/t:0;
    return {totalUsedT:t,basisAvg:avg,pnlUsd:t?(Number(level.fixedSaleBasisCentBu)-avg)/100*36.7437*t:0,
      usedLots:lots.map((x,i)=>({...x,usedVolumeT:x.volumeT,origin:'Lote '+i}))};
  }
};
vm.createContext(ctx);vm.runInContext(isolated,ctx);
assert.equal(vm.runInContext("isCampaignLevel1Exw('r1_exw')",ctx),true);
state.campaign.active=false;
assert.equal(vm.runInContext("isCampaignLevel1Exw('r1_exw')",ctx),false);
state.campaign.active=true;
state.campaign.levelId=2;
assert.equal(vm.runInContext("isCampaignLevel1Exw('r1_exw')",ctx),false);
state.campaign.levelId=1;
for(let r=1;r<=5;r++){
  state.round=r;
  const rd=level.scenario.rounds[r-1];
  ctx.rd=rd;
  for(const tab of ['market','offers','book']){
    state.campaign.l1Tab=tab;
    const html=vm.runInContext('campaignL1WorkbenchMarkup(rd)',ctx);
    assert(html.includes('Rodada '+r+' de 5'));
    assert(html.includes('data-l1-tab="market"')&&html.includes('data-l1-tab="offers"')&&html.includes('data-l1-tab="book"'));
    if(tab==='offers')assert.equal((html.match(/class="l1wb-offer"/g)||[]).length,rd.offers_exw.length);
  }
  state.campaign.l1Tab='offers';
  state.campaign.l1CalcVisible=true;
  state.choices.exw[r]={...rd.offers_exw[0],ref_cbot_cent_bu:rd.cbot_cent_bu,ref_cambio:rd.usd};
  const html=vm.runInContext('campaignL1WorkbenchMarkup(rd)',ctx);
  assert(html.includes('Custo CFR equivalente') && html.includes('Frete rodoviário'));
  assert(html.includes('Basis médio projetado'));
  delete state.choices.exw[r];state.campaign.l1CalcVisible=false;
}
console.log('OK: 5 rodadas, 3 abas, custos CFR, seleção, escopo restrito ao Level 1.');