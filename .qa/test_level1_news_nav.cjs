/* Contrato pedagógico L1: notícias acionam a próxima rodada e Parciais devolve à origem. */
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const game=fs.readFileSync(path.join(root,'game.js'),'utf8');
const level=JSON.parse(fs.readFileSync(path.join(root,'data/campaign/levels/level1.json'),'utf8'));
const rounds=level.scenario.rounds;
assert.equal(rounds.length,5);
const close=(a,b)=>Math.abs(a-b)<0.00001;
const pn=r=>r.offers_exw.find(o=>o.city==='Porto Nacional').price_brl_saca;
for(let i=0;i<rounds.length;i++){
  const rd=rounds[i];
  assert(rd.master_news&&rd.market_signal&&rd.decision_prompt,'Radar e decisão ausentes na rodada '+(i+1));
  for(const field of [rd.news,rd.master_news,rd.market_headline,rd.market_signal,rd.decision_prompt,rd.market_note]){
    assert(!/\bBRZ\b|\bH27\b|(?:Fev|Mar)\/27|\b20\d{2}-\d\d-\d\d/.test(field),'Referência indevida no texto do jogador');
  }
  if(i===4){assert.equal(rd.impact_next,undefined,'Última rodada não deve prever rodada inexistente');continue;}
  const next=rounds[i+1],impact=rd.impact_next;
  assert.equal(impact.driver,'news');
  assert(close(next.cbot_cent_bu-rd.cbot_cent_bu,impact.cbot_cent_bu),'Chicago desconectada da notícia');
  assert(close(next.usd-rd.usd,impact.usd_brl),'Câmbio desconectado da notícia');
  assert(close(pn(next)-pn(rd),impact.portonacional_brl_sc),'Mercado físico desconectado da notícia');
}
const ui=game.slice(game.indexOf('function campaignL1WorkbenchMarkup('),game.indexOf('function renderCampaignL1Workbench(',game.indexOf('function campaignL1WorkbenchMarkup(')));
assert(ui.includes('Notícia-mestre')&&ui.includes('Efeito da notícia anterior'),'Notícia mestre não é protagonista');
assert(!/\bBRZ\b|Fev\/27|Mar\/27|H27/.test(ui),'Datas ou BRZ na interface L1');
assert(game.includes("if (Number(state.campaign.levelId) === 1) addHot(\"hot_news\""),'Notícias ainda bloqueadas no L1');
assert(game.includes("fontSize:'40px'"),'Fontes Chicago/câmbio não foram padronizadas');
const a=game.indexOf('function setStage('),b=game.indexOf('function renderHome()',a);
assert(a>0&&b>a,'Funções de navegação não encontradas');
const state={
 stage:'r1_exw',prevStage:'r1_home',partialsReturnStage:null,
 campaign:{active:true,levelId:1,l1Focus:false,l1CalcVisible:false}
};
const ctx={
 state,console,document:{getElementById:()=>null},isCampaignMode:()=>state.campaign.active,
 renderStage:()=>{},fadeInBgmHome:()=>{},fadeOutBgmHome:()=>{},requestAnimationFrame:()=>{}
};
vm.createContext(ctx);vm.runInContext(game.slice(a,b),ctx);
const run=x=>vm.runInContext(x,ctx);
run('openPartialsMenu()');
assert.equal(state.stage,'partials_menu');assert.equal(state.partialsReturnStage,'r1_exw');
run("setStage('partials_soja')");
run('backFromPartials()');assert.equal(state.stage,'partials_menu');
run('backFromPartials()');assert.equal(state.stage,'r1_exw');
assert.equal(state.partialsReturnStage,null);
state.campaign.active=false;state.stage='r1_frete';
run('openPartialsMenu()');run("setStage('partials_pl')");
run('backFromPartials()');run('backFromPartials()');
assert.equal(state.stage,'r1_frete','O retorno também deve funcionar nos outros modos');
console.log('OK: cinco notícias com impactos físicos/Chicago/câmbio, interface sem datas/BRZ e histórico de Parciais reversível.');
