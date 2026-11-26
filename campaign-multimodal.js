/* L2/L3 — standalone presentation, same local Leaflet and visual vocabulary as L1. */
(function(){
'use strict';
const id=Number(new URLSearchParams(location.search).get('level')),KEY='tg_campaign_unlocked_level',E=window.TGMulti;
const $=x=>document.getElementById(x),esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),fmt=(n,d=0)=>Number(n).toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d}),signed=(n,d=1)=>(n>=0?'+':'')+fmt(n,d);
const PORT=[-23.9539,-46.3093],TERMINAL=[-17.7923,-50.9192];
const BASES={street:'World_Street_Map',topo:'World_Topo_Map',satellite:'World_Imagery'};
const modalName=m=>m==='road'?'Rodo direto':'Rodo + ferro';
let level,round=1,selected=null,mode=null,lots=[],tab='market',map=null,markers=null,routeLayer=null,tile=null,tileTimer=null,routeAbort=null,routeVersion=0,mapStyle='street',drawnRound=0,ended=false;
const rd=()=>level.scenario.rounds[round-1],confirmed=()=>lots.find(x=>x.round===round),book=()=>E.result(level,lots),offer=()=>rd().offers_exw.find(o=>o.id===selected);
const unlocked=()=>{try{return Math.max(1,Number(localStorage.getItem(KEY))||1)}catch(_){return 1}};
const recordKey=()=> 'tg_campaign_multimodal_l'+id+'_v1';
function fail(msg){$('multi-app').innerHTML='<section class="multi-loading"><h1>Trading Games</h1><p>'+esc(msg)+'</p><a href="./?campaign=1">Voltar à campanha</a></section>';}
async function boot(){
 if(![2,3].includes(id)){fail('Nível inválido.');return}
 if(unlocked()<id){fail('Level '+id+' bloqueado. Conclua o Level '+(id-1)+' para liberar esta missão.');return}
 try{const r=await fetch('./data/campaign/levels/level'+id+'.json',{cache:'no-store'});if(!r.ok)throw Error('Dados indisponíveis');level=await r.json();if(!E||level.id!==id||level.scenario.rounds.length!==level.rounds)throw Error('Cenário inválido');mount();}
 catch(e){fail('Não foi possível carregar o cenário: '+e.message);}
}
function mount(){
 $('multi-app').innerHTML='<div id="campaign-l1-realmap" class="multi"><div id="l1m-map" aria-label="Mapa real das origens e do terminal"></div><div id="l1m-health" role="status" data-state="loading"><span>Inicializando cartografia…</span><button data-action="retry-map" hidden>Tentar novamente</button></div><div class="l1m-ui">'+
 '<header class="l1m-top"><div class="l1m-brand"><div class="l1m-logo">TG</div><div><div class="l1m-title">TRADING GAMES / <b>LEVEL '+id+'</b></div><div class="l1m-sub">'+esc(level.name)+' · '+level.rounds+' rodadas</div></div></div><div class="l1m-rounds" id="multi-rounds"></div><div class="l1m-top-right"><div class="l1m-market" id="multi-market"></div><select class="l1m-select" id="multi-style" aria-label="Cartografia"><option value="street">Ruas</option><option value="topo">Topográfico</option><option value="satellite">Satélite</option></select><button class="l1m-btn" data-action="back">Campanha</button></div></header>'+
 '<section class="l1m-news" id="multi-news"></section><aside class="l1m-side"><div class="l1m-side-head"><span class="l1m-eyebrow">Mesa de originação · Santos</span><h2>Escolha sua operação</h2><p>Uma compra por rodada · cenário simulado</p></div><nav class="l1m-tabs" id="multi-tabs"><button data-tab="market">Mercado</button><button data-tab="offers">Ofertas</button><button data-tab="book">Posição</button></nav><div class="l1m-side-scroll" id="multi-panel"></div><div class="l1m-foot"><div class="l1m-progress"><div id="multi-progress"></div></div><div class="l1m-progress-text"><span id="multi-volume"></span><span id="multi-left"></span></div><div class="l1m-commit"><button class="l1m-btn" id="multi-discard" data-action="discard">Descartar</button><button class="l1m-btn primary" id="multi-buy" data-action="buy">Comprar</button></div><div class="l1m-commit"><button class="l1m-btn" data-action="general">Visão geral</button><button class="l1m-btn primary" id="multi-next" data-action="next">Avançar rodada</button></div></div></aside>'+
 '<div class="l1m-bottom"><b style="color:#168866">$</b> Oferta EXW <b style="color:#a97831">▣</b> Terminal Rio Verde <b>⚓</b> Santos <span style="color:#128466">━</span> Rodo <span style="color:#b97f35">┅</span> Ferrovia esquemática</div><div class="l1m-status" id="multi-status" hidden></div></div></div>';
 $('campaign-l1-realmap').addEventListener('click',onClick);
 $('multi-style').addEventListener('change',e=>{mapStyle=e.target.value;if(map)loadTiles(mapStyle);else initMap();});
 render();initMap();
}
function mapHealth(msg='',failed=false){const x=$('l1m-health');if(!x)return;x.hidden=!msg;x.dataset.state=failed?'error':msg?'loading':'ready';x.querySelector('span').textContent=msg;x.querySelector('button').hidden=!failed;}
function status(msg='',bad=false){const x=$('multi-status');if(!x)return;x.textContent=msg;x.hidden=!msg;x.className='l1m-status'+(bad?' error':'');}
function initMap(){
 if(!window.L||!L.map){mapHealth('Biblioteca cartográfica indisponível. As ofertas continuam acessíveis na lista.',true);return;}
 try{
 if(map){map.remove();map=null;}clearTimeout(tileTimer);drawnRound=0;
 map=L.map('l1m-map',{zoomControl:false,minZoom:3,maxZoom:13}).setView([-19,-50],5);L.control.zoom({position:'bottomright'}).addTo(map);
 routeLayer=L.layerGroup().addTo(map);markers=L.layerGroup().addTo(map);
 L.marker(TERMINAL,{icon:L.divIcon({className:'',iconAnchor:[15,15],iconSize:[145,30],html:'<div class="multi-terminal"><b>▣</b> Rio Verde · Terminal</div>'}),title:'Rio Verde/GO — referência urbana do terminal ferroviário'}).addTo(map);
 L.marker(PORT,{icon:L.divIcon({className:'',iconAnchor:[15,15],iconSize:[120,35],html:'<div class="l1m-port"><b>⚓</b>SANTOS</div>'})}).addTo(map);
 updateMarkers();loadTiles(mapStyle);requestAnimationFrame(()=>{if(map){map.invalidateSize({pan:false});if(selected)drawRoutes();else general();}});
 }catch(e){console.error(e);if(map){try{map.remove()}catch(_){}map=null;}const old=$('l1m-map');if(old)old.replaceWith(old.cloneNode(false));mapHealth('Falha ao iniciar mapa. '+e.message,true);}
}
function loadTiles(style){
 if(!map)return;clearTimeout(tileTimer);if(tile)map.removeLayer(tile);
 mapStyle=style;$('multi-style').value=style;mapHealth('Carregando cartografia…');
 const layer=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/'+BASES[style]+'/MapServer/tile/{z}/{y}/{x}',{maxNativeZoom:17,maxZoom:19,attribution:'© Esri e provedores de dados'});tile=layer;let loaded=false,errors=0;
 const retry=()=>{if(tile!==layer||loaded)return;if(style==='street')loadTiles('topo');else if(style==='topo')loadTiles('satellite');else mapHealth('Cartografia externa indisponível. Tente novamente ou use a lista de ofertas.',true);};
 layer.on('tileload',()=>{if(tile===layer){loaded=true;clearTimeout(tileTimer);mapHealth();}});layer.on('tileerror',()=>{if(++errors>=5)retry();});layer.addTo(map);tileTimer=setTimeout(retry,9000);
}
function pin(o){return L.divIcon({className:'',iconSize:[100,64],iconAnchor:[50,43],html:'<div class="l1m-money-pin'+(selected===o.id?' selected':'')+(confirmed()?.id===o.id?' confirmed':'')+'"><div class="l1m-money-icon">$</div><div class="l1m-money-name">'+esc(o.city)+'</div></div>'});}
function updateMarkers(){if(!map||!markers)return;markers.clearLayers();for(const o of rd().offers_exw){const m=L.marker([o.lat,o.lng],{icon:pin(o),title:o.label,riseOnHover:true}).addTo(markers);m.on('click',()=>select(o.id));}drawnRound=round;}
function fit(points,animate=true){
 if(!map||!points.length)return;const w=map.getSize().x,h=map.getSize().y,mobile=w<=760,side=$('campaign-l1-realmap').querySelector('.l1m-side'),news=$('multi-news');
 const top=mobile?Math.min(160,h*.28):Math.min(145,h*.23),bottom=mobile?Math.min(side.offsetHeight+20,h*.53):65,right=mobile?22:side.offsetWidth+32;
 map.fitBounds(L.latLngBounds(points).pad(.1),{paddingTopLeft:[25,top],paddingBottomRight:[right,bottom],maxZoom:7,animate,duration:.4});
}
function clearRoutes(){routeVersion++;if(routeAbort){routeAbort.abort();routeAbort=null;}if(routeLayer)routeLayer.clearLayers();}
function general(){clearRoutes();if(map)fit([...rd().offers_exw.map(o=>[o.lat,o.lng]),TERMINAL,PORT],false);status();}
const railLink=()=>L.polyline([TERMINAL,[-19.0,-50.55],[-20.29,-50.40],PORT],{color:'#b47c2d',dashArray:'9 7',weight:4,opacity:.85,interactive:false}).addTo(routeLayer);
async function drawRoutes(){
 if(!map||!selected||!offer())return;clearRoutes();const o=offer(),p=[o.lat,o.lng],m=mode,token=routeVersion;
 if(!m){L.polyline([p,PORT],{color:'#128466',dashArray:'6 6',weight:3,opacity:.65}).addTo(routeLayer);L.polyline([p,TERMINAL],{color:'#128466',dashArray:'6 6',weight:3}).addTo(routeLayer);railLink();fit([p,TERMINAL,PORT]);status('Duas ligações ilustrativas. Escolha o modal para consultar o trecho rodoviário.');return;}
 const dest=m==='rail'?TERMINAL:PORT,preview=L.polyline([p,dest],{color:'#128466',dashArray:'6 7',weight:4}).addTo(routeLayer);
 if(m==='rail')railLink();fit(m==='rail'?[p,TERMINAL,PORT]:[p,PORT]);status('Consultando trecho rodoviário… '+(m==='rail'?'Ferrovia ilustrativa, não traçado real.':''));
 const controller=new AbortController();routeAbort=controller;const timer=setTimeout(()=>controller.abort(),14000);
 try{const url='https://router.project-osrm.org/route/v1/driving/'+p[1]+','+p[0]+';'+dest[1]+','+dest[0]+'?overview=full&geometries=geojson&steps=false';const response=await fetch(url,{signal:controller.signal});if(!response.ok)throw Error('Roteamento indisponível');const data=await response.json();if(data.code!=='Ok'||!data.routes?.[0]?.geometry?.coordinates?.length)throw Error('Sem rota');if(token!==routeVersion||!map)return;routeLayer.removeLayer(preview);const g=L.geoJSON(data.routes[0].geometry,{style:{color:'#128466',weight:5,opacity:.92}}).addTo(routeLayer);const points=[g.getBounds().getSouthWest(),g.getBounds().getNorthEast(),p,dest];if(m==='rail')points.push(PORT);fit(points);status('Trecho rodoviário aprox. '+fmt(data.routes[0].distance/1000)+' km'+(m==='rail'?' · ferrovia esquemática':'')+' · fretes simulados, sem restrições de caminhão.');}
 catch(e){if(token===routeVersion)status('Roteamento indisponível: linha verde pontilhada é ligação visual, não estrada calculada.'+(m==='rail'?' Ferrovia esquemática.':''),true);}
 finally{clearTimeout(timer);if(routeAbort===controller)routeAbort=null;}
}
function stat(k,v){return '<div class="l1m-stat"><span>'+esc(k)+'</span><strong>'+esc(v)+'</strong></div>';}
function render(){
 if(ended)return;const r=rd(),previous=round>1?level.scenario.rounds[round-2]:null,b=book(),c=confirmed(),o=offer();
 $('multi-rounds').innerHTML='<span>RODADA</span>'+Array.from({length:level.rounds},(_,i)=>'<span class="l1m-round '+(i+1===round?'active':i+1<round?'done':'')+'">'+(i+1<round?'✓':i+1)+'</span>').join('');
 $('multi-market').innerHTML='<span>CBOT <strong>'+fmt(r.cbot_cent_bu,2)+' ¢/bu</strong></span><span>USDBRL <strong>'+fmt(r.usd,4)+'</strong></span>';
 $('multi-news').innerHTML='<div class="l1m-eyebrow">NOTÍCIA-MESTRE · RODADA '+round+'</div><h3>'+esc(r.master_news)+'</h3><p>'+esc(r.market_signal)+'</p>';
 $('multi-tabs').querySelectorAll('button').forEach(x=>x.classList.toggle('active',x.dataset.tab===tab));
 let panel='';
 if(tab==='market'){
 panel='<div class="l1m-eyebrow">MISSÃO · '+esc(level.name.toUpperCase())+'</div><p class="l1m-note">60.000 t · Santos → Norte da China · venda CFR +'+fmt(level.fixedSaleBasisCentBu)+' ¢/bu · basis médio máximo +'+fmt(level.targetBasisCentBu)+' ¢/bu · nota mínima 70.</p><p class="l1m-note">Fobbing US$ '+fmt(level.fixedFobbingUsdT,2)+'/t · marítimo US$ '+fmt(level.fixedFreightUsdT,2)+'/t. Uma compra definitiva por rodada.</p><div class="l1m-eyebrow">LEITURA DE MERCADO</div><h3>'+esc(r.master_news)+'</h3>'+stat('Físico indicativo Rio Verde','R$ '+fmt(r.physical_reference.price_brl_sc,2)+'/sc')+stat('Tarifa ferrovia Rio Verde → Santos','R$ '+fmt(r.rail_brl_t)+'/t')+stat('Índice rodo direto (R1 = 100)',fmt(r.road_index))+stat('Índice acesso ao terminal (R1 = 100)',fmt(r.feeder_index));
 if(previous){const ds=[['Chicago',signed(r.cbot_cent_bu-previous.cbot_cent_bu,2)+' ¢/bu'],['Dólar',signed(r.usd-previous.usd,4)],['Físico Rio Verde',signed(r.physical_reference.price_brl_sc-previous.physical_reference.price_brl_sc,2)+' R$/sc'],['Tarifa ferroviária',signed(r.rail_brl_t-previous.rail_brl_t,0)+' R$/t'],['Rodo direto',signed(r.road_index-previous.road_index,0)+' pts'],['Acesso ao terminal',signed(r.feeder_index-previous.feeder_index,0)+' pts']];panel+='<div class="l1m-eyebrow" style="margin-top:14px">REAÇÃO À NOTÍCIA ANTERIOR</div><div class="multi-delta">'+ds.map(x=>'<div>'+esc(x[0])+'<strong>'+esc(x[1])+'</strong></div>').join('')+'</div><p class="l1m-note">'+esc(r.previous_news_review)+'</p>';}
 panel+='<p class="multi-highlight">'+esc(r.market_signal)+'</p><p class="l1m-note">'+esc(r.decision_prompt)+'</p><button class="l1m-btn primary" data-tab="offers">Comparar ofertas →</button>';
 }else if(tab==='offers'){
 panel='<div class="l1m-eyebrow">OFERTAS EXW · '+round+'ª RODADA</div><p class="l1m-note">Escolha a origem. Compare ambos os modais antes de confirmar. Não há seleção automática de rota.</p>';
 panel+=r.offers_exw.map(x=>'<button class="l1m-offer '+(x.id===selected?'selected ':'')+(c?.id===x.id?'confirmed':'')+'" data-offer="'+x.id+'" '+(c&&c.id!==x.id?'disabled':'')+'><div class="l1m-offer-top"><strong>'+esc(x.label)+'</strong><b>R$ '+fmt(x.price_brl_saca,2)+'/sc</b></div><div class="l1m-offer-sub"><span>'+fmt(x.volume_t)+' t</span><span>2 alternativas logísticas</span></div></button>').join('');
 if(o){const q=c?c.volume:Math.min(o.volume_t,b.remaining);panel+='<div class="l1m-eyebrow" style="margin-top:12px">'+(c?'COMPRA CONFIRMADA':'MODAL DA OFERTA')+'</div>'+stat('Origem',o.label)+stat('Volume da operação',fmt(q)+' t')+'<div class="multi-modes">'+E.MODES.map(m=>{const x=o.logistics[m];return '<button class="multi-mode '+(mode===m?'active':'')+'" data-mode="'+m+'" aria-pressed="'+(mode===m)+'" '+(c?'disabled':'')+'><strong>'+(m==='road'?'🚚 Rodo direto':'🚆 Rodo + ferro')+'</strong><small>'+(m==='road'?'Origem → Santos':'Origem → Rio Verde → Santos')+'</small><b>R$ '+fmt(x.brl_t)+'/t</b><small>'+(m==='rail'?'Rodo R$ '+fmt(x.feeder_brl_t)+'/t + ferro R$ '+fmt(x.rail_brl_t)+'/t':'Frete rodoviário total')+'</small></button>';}).join('')+'</div>';
 if(mode)panel+=stat('Logística selecionada','R$ '+fmt(o.logistics[mode].brl_t)+'/t')+'<p class="multi-note">Fobbing US$ '+fmt(level.fixedFobbingUsdT,2)+'/t · marítimo US$ '+fmt(level.fixedFreightUsdT,2)+'/t.</p><div class="l1m-action-row"><button class="l1m-btn" data-action="calc">Fazer cálculos</button><button class="l1m-btn" data-action="route">Ver rota</button></div>';
 else panel+='<p class="multi-note">Selecione um modal para calcular e comprar.</p>';
 if(c)panel+='<p class="multi-highlight">Compra definitiva nesta rodada. Avance para continuar.</p>';
 }
 }else{
 panel='<div class="l1m-eyebrow">POSIÇÃO · NAVIO 60.000 T</div>'+stat('Volume originado',fmt(b.volume)+' t')+stat('Saldo',fmt(b.remaining)+' t')+stat('Compras confirmadas',String(lots.length))+'<p class="l1m-note">Basis médio, margem e eficiência logística são revelados ao encerrar.</p>';
 panel+=lots.map(x=>'<div class="l1m-offer confirmed"><div class="l1m-offer-top"><strong>R'+x.round+' · '+esc(x.city+'/'+x.uf)+'</strong><b>'+fmt(x.volume)+' t</b></div><div class="l1m-offer-sub"><span>'+modalName(x.mode)+'</span><span>R$ '+fmt(x.freight)+'/t</span></div></div>').join('');
 }
 $('multi-panel').innerHTML=panel;$('multi-progress').style.width=Math.min(100,100*b.volume/level.targetVolumeT)+'%';$('multi-volume').textContent=fmt(b.volume)+' / '+fmt(level.targetVolumeT)+' t';$('multi-left').textContent=fmt(b.remaining)+' t restantes';$('multi-buy').disabled=!o||!mode||!!c||!b.remaining;$('multi-buy').textContent=c?'Compra confirmada':!b.remaining?'Navio completo':'Comprar';$('multi-discard').disabled=!selected||!!c;$('multi-next').textContent=round===level.rounds?'Encerrar Level '+id:'Avançar rodada';
 if(map)updateMarkers();
}
function select(n){if(ended)return;const c=confirmed();if(c&&c.id!==n){status('Compra confirmada. Avance para a próxima rodada.',true);return;}if(!rd().offers_exw.some(x=>x.id===n))return;selected=n;mode=c?c.mode:null;tab='offers';render();drawRoutes();}
function chooseModal(m){if(confirmed()||!offer()||!E.MODES.includes(m))return;mode=m;render();drawRoutes();}
function dialog(html){const d=$('multi-dialog');d.innerHTML=html;if(!d.open)d.showModal();return d;}
function closeDialog(){$('multi-dialog').close();}
function confirmBuy(){if(!offer()||!mode||confirmed()||!book().remaining)return;const x=E.decision(level,round,selected,mode,lots);const d=dialog('<h2>Confirmar compra EXW</h2><p><b>'+esc(x.city+'/'+x.uf)+'</b> · '+modalName(x.mode)+'</p><p>'+fmt(x.volume)+' t a R$ '+fmt(x.price,2)+'/sc · logística R$ '+fmt(x.freight)+'/t.</p>'+(x.volume<x.available?'<p>Compra parcial: o saldo do navio comporta '+fmt(x.volume)+' t das '+fmt(x.available)+' t disponíveis.</p>':'')+'<p>A compra e o modal serão definitivos nesta rodada.</p><div class="multi-dialog-row"><button class="multi-btn" data-close>Cancelar</button><button class="multi-btn primary" id="multi-confirm">Confirmar</button></div>');
 d.querySelector('[data-close]').onclick=closeDialog;$('multi-confirm').onclick=()=>{if(confirmed())return;lots.push(x);closeDialog();render();status('Compra confirmada: '+fmt(x.volume)+' t · '+modalName(x.mode));};}
function calculator(){if(!offer()||!mode)return;const x=E.calc(level,rd(),offer(),mode);const entries=[['Frete interno (US$/t)',x.inlandUsd,.06],['EXW (US$/t)',x.exwUsd,.06],['CFR equivalente (¢/bu)',x.cfr,.16],['Basis CFR (¢/bu)',x.basis,.17]];
 const d=dialog('<h2>Caderno de cálculos</h2><p>'+esc(x.city)+' · '+modalName(mode)+' · frete '+fmt(x.freight)+' R$/t · dólar '+fmt(x.fx,4)+' · Chicago '+fmt(x.cbot,2)+' ¢/bu.</p><p>Fobbing US$ '+fmt(x.fob,2)+'/t · marítimo US$ '+fmt(x.sea,2)+'/t. Soja: saca 60 kg e 1 ¢/bu = US$ 0,367437/t.</p>'+entries.map((a,i)=>'<label for="answer-'+i+'">'+esc(a[0])+'</label><div class="multi-dialog-row" style="justify-content:flex-start;margin:5px 0 10px"><input id="answer-'+i+'" inputmode="decimal" placeholder="Sua resposta" style="font:inherit;padding:8px;width:150px;border:1px solid #c8d9d0;border-radius:6px"><button class="multi-btn" data-check="'+i+'">Conferir</button><span id="check-'+i+'"></span></div>').join('')+'<div class="multi-dialog-row"><button class="multi-btn" data-close>Fechar</button></div>');
 d.querySelector('[data-close]').onclick=closeDialog;d.querySelectorAll('[data-check]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.check),raw=$('answer-'+i).value.trim(),n=Number(raw.replace(',','.'));$('check-'+i).textContent=raw!==''&&Number.isFinite(n)&&Math.abs(n-entries[i][1])<=entries[i][2]?'✓ Correto':'Revise o cálculo';});
}
function advance(){if(ended)return;const b=book();if(!confirmed()&&b.remaining>0){const d=dialog('<h2>'+(round===level.rounds?'Encerrar sem comprar?':'Avançar sem comprar?')+'</h2><p>Saldo atual: '+fmt(b.remaining)+' t. As ofertas desta rodada não ficarão disponíveis depois.</p><div class="multi-dialog-row"><button class="multi-btn" data-close>Voltar</button><button class="multi-btn primary" id="multi-advance-confirm">Continuar</button></div>');d.querySelector('[data-close]').onclick=closeDialog;$('multi-advance-confirm').onclick=()=>{closeDialog();advanceNow();};}else advanceNow();}
function advanceNow(){if(round>=level.rounds){finish();return;}clearRoutes();round++;selected=null;mode=null;tab='market';render();general();}
function finish(){
 ended=true;clearRoutes();clearTimeout(tileTimer);if(map){map.remove();map=null;}
 const b=book();let previous={};try{previous=JSON.parse(localStorage.getItem(recordKey())||'{}')||{};localStorage.setItem(recordKey(),JSON.stringify({bestScore:Math.max(Number(previous.bestScore)||0,b.score.total),approved:!!previous.approved||b.approved,lastScore:b.score.total,version:1}));if(b.approved)localStorage.setItem(KEY,String(Math.max(unlocked(),Math.min(3,id+1))));}catch(_){}
 const parts=[['Originação','origination',25],['Margem','margin',25],['Eficiência logística','logistics',20],['Ocupação','utilization',20],['Disciplina','discipline',10]];
 const reason=b.approved?'Todos os critérios atingidos. '+(id===2?'Level 3 desbloqueado.':'Campanha concluída!'):b.remaining?'Faltaram '+fmt(b.remaining)+' t para completar o navio.':b.basis>level.targetBasisCentBu?'Basis médio acima da meta.':b.margin<0?'Margem negativa.':'Nota inferior a 70.';
 $('multi-app').innerHTML='<article class="multi-result"><div style="font-weight:850;color:#507765">TRADING GAMES / LEVEL '+id+' — RESULTADO FINAL</div><h1>'+(b.approved?'RESULTADO SATISFATÓRIO':'RESULTADO NÃO SATISFATÓRIO')+'</h1><p>'+esc(reason)+'</p><div class="metrics">'+[['Nota',b.score.total+'/100'],['Volume',fmt(b.volume)+' t'],['Basis médio',b.volume?signed(b.basis)+' ¢/bu':'—'],['Margem simulada','US$ '+fmt(b.margin)]].map(x=>'<div><span>'+x[0]+'</span><strong>'+esc(x[1])+'</strong></div>').join('')+'</div><h2>Scorecard</h2>'+parts.map(x=>'<div class="score-line"><span>'+x[0]+'</span><div class="score-track"><b style="width:'+(100*b.score[x[1]]/x[2])+'%"></b></div><strong>'+b.score[x[1]]+'/'+x[2]+'</strong></div>').join('')+'<p>Custo logístico adicional frente à alternativa mais barata de cada lote: <b>R$ '+fmt(b.logisticsLoss)+'</b>.</p><h2>Compras confirmadas</h2><div class="scroll"><table><thead><tr><th>R</th><th>Origem</th><th>Modal</th><th>Volume t</th><th>Frete R$/t</th><th>CFR ¢/bu</th><th>Basis ¢/bu</th><th>Margem US$</th><th>Dif. logística R$/t</th></tr></thead><tbody>'+lots.map(x=>'<tr><td>'+x.round+'</td><td>'+esc(x.city+'/'+x.uf)+'</td><td>'+modalName(x.mode)+'</td><td>'+fmt(x.volume)+'</td><td>'+fmt(x.freight)+'</td><td>'+fmt(x.cfr,1)+'</td><td>'+signed(x.basis)+'</td><td>'+fmt(x.marginUsdT*x.volume)+'</td><td>'+fmt(x.logisticsRegretBrlT)+'</td></tr>').join('')+'</tbody></table></div><p style="font-size:12px;color:#657a6e">Meta: '+fmt(level.targetVolumeT)+' t · basis até +'+level.targetBasisCentBu+' ¢/bu · margem não negativa · nota mínima 70. Margem em basis, não P&L realizado. Todas as cotações são fictícias.</p><footer><button class="multi-btn" id="multi-restart">Repetir nível</button><a class="multi-btn" href="./?campaign=1">Menu campanha</a>'+(b.approved&&id===2?'<a class="multi-btn primary" href="./campaign-multimodal.html?level=3">Iniciar Level 3</a>':'')+'</footer></article>';
 $('multi-restart').onclick=()=>{location.reload();};
}
function onClick(e){const b=e.target.closest('button');if(!b||b.disabled)return;
 if(b.dataset.tab){tab=b.dataset.tab;render();return}
 if(b.dataset.offer){select(Number(b.dataset.offer));return}
 if(b.dataset.mode){chooseModal(b.dataset.mode);return}
 switch(b.dataset.action){
 case 'back':{const d=dialog('<h2>Voltar à campanha?</h2><p>A partida atual será encerrada sem registrar aprovação.</p><div class="multi-dialog-row"><button class="multi-btn" data-close>Continuar jogando</button><a class="multi-btn primary" href="./?campaign=1">Sair</a></div>');d.querySelector('[data-close]').onclick=closeDialog;break;}
 case 'retry-map':initMap();break;
 case 'discard':if(!confirmed()){selected=null;mode=null;render();general();}break;
 case 'buy':confirmBuy();break;
 case 'next':advance();break;
 case 'general':general();break;
 case 'calc':calculator();break;
 case 'route':drawRoutes();break;
 }}
window.addEventListener('resize',()=>{if(map){map.invalidateSize({pan:false});if(!selected)general();}});
boot();
})();
