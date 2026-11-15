// Confere mapa e caixas exclusivas do Level 1. Executado em todas as atualizações.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const cal=JSON.parse(fs.readFileSync(path.join(root,'calibration.json'),'utf8')).screens.r1_exw;
const lvl=JSON.parse(fs.readFileSync(path.join(root,'data/campaign/levels/level1.json'),'utf8'));
const sheet={notebook:{x:172,y:345,w:600,h:670},offers:{x:1472,y:370,w:356,h:504},cbot:cal.l1_text_cbot,fx:cal.l1_text_cambio};
const home=JSON.parse(fs.readFileSync(path.join(root,'calibration.json'),'utf8')).screens.r1_home;
assert.deepEqual(home.l1_text_cbot,cal.l1_text_cbot,'CBOT deve seguir mesmo padrão no home e EXW');
assert.deepEqual(home.l1_text_cambio,cal.l1_text_cambio,'Câmbio deve seguir mesmo padrão no home e EXW');
assert(sheet.cbot.x>=1185&&sheet.cbot.x+sheet.cbot.w<=1380,'CBOT fora da cápsula');
assert(sheet.fx.x>=1600&&sheet.fx.x+sheet.fx.w<=1780,'Câmbio fora da cápsula');
assert(sheet.cbot.font===sheet.fx.font,'Fontes do topo inconsistentes');
const within=(r,b)=>r.x>=b.x&&r.y>=b.y&&r.x+r.w<=b.x+b.w&&r.y+r.h<=b.y+b.h;
const intersection=(a,b)=>Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*
  Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
const map={x:700,y:200,w:740,h:715}; // região das origens sobre o mapa ilustrativo
const geo={
  MT:{x:850,y:430,w:260,h:230},
  TO:{x:1120,y:375,w:120,h:150},
  GO:{x:1060,y:530,w:160,h:150},
  MS:{x:950,y:650,w:155,h:155}
}; // envelope aproximado por UF, NÃO georreferenciamento de cidade
const errors=[];
assert.equal(lvl.id,1);
assert.equal(lvl.scenario.rounds.length,5);
for(const round of lvl.scenario.rounds) {
  assert.equal(round.offers_exw.length,4,'Número inesperado de origens R'+round.round);
  const bags=[];
  for(const [i,offer] of round.offers_exw.entries()){
    const id='l1_bag_r'+round.round+'_'+(i+1);
    const box=cal[id];
    assert(box,'Sem calibração '+id);
    const where='R'+round.round+' '+offer.city+'/'+offer.uf+' '+id;
    assert.equal(box.x,offer.map_x,where+' X diferente da fonte do cenário');
    assert.equal(box.y,offer.map_y,where+' Y diferente da fonte do cenário');
    assert(box.w>=75&&box.w<=110&&box.h>=75&&box.h<=110,where+' escala do saco alterada');
    assert(within(box,map),where+' fora do mapa');
    assert(geo[offer.uf]&&within({x:box.x,y:box.y,w:1,h:1},geo[offer.uf]),where+' fora da região esquemática do estado');
    for(const [name,panel] of Object.entries(sheet))
      assert.equal(intersection(box,panel),0,where+' encosta em '+name);
    for(const previous of bags)
      assert.equal(intersection(box,previous.box),0,where+' sobrepõe '+previous.city);
    bags.push({box,city:offer.city});
  }
  console.log('R'+round.round+': '+bags.length+' sacos, localidades e áreas sem colisões');
}
assert.equal(intersection(sheet.cbot,sheet.fx),0,'Chicago e câmbio se sobrepõem');
assert.equal(intersection(sheet.cbot,{x:1798,y:20,w:100,h:100}),0,'CBOT sobrepõe guia');
assert.equal(intersection(sheet.fx,{x:1798,y:20,w:100,h:100}),0,'Câmbio sobrepõe guia');
console.log('OK: 5 rodadas, 20 origens, caixas de indicadores sem colisão. Exclusivo L1.');
