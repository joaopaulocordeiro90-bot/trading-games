/* Trading Games · Campanha L1 · apresentação cartográfica Leaflet/Esri.
   Nenhuma regra de negócio, pontuação ou cotação é recalculada aqui:
   usa state/game.js e os hotspots originais para comprar/descartar/avançar. */
(function(){
'use strict';
const ROOT_ID='campaign-l1-realmap',COORDS={
'Querência|MT':[-12.6093,-52.1828],'Porto Nacional|TO':[-10.7082,-48.4117],
'Rio Verde|GO':[-17.7923,-50.9192],'Dourados|MS':[-22.2231,-54.8120],
'Sapezal|MT':[-13.5429,-58.8145],'Jataí|GO':[-17.8790,-51.7217],
'Maracaju|MS':[-21.6145,-55.1672],'Rondonópolis|MT':[-16.4673,-54.6372],
'Sorriso|MT':[-12.5425,-55.7211],'Primavera do Leste|MT':[-15.5608,-54.2979]
};
const PORT=[-23.9539,-46.3093];
const BASES={
street:{name:'Ruas',url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}'},
topo:{name:'Topográfico',url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}'},
satellite:{name:'Satélite',url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'}
};
const fmt=(n,d=0)=>Number(n||0).toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d});
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const el=id=>document.getElementById(id);
const good=()=>typeof isCampaignMode==='function'&&isCampaignMode()&&Number(state.campaign?.levelId)===1;
const current=()=>typeof getRoundData==='function'?getRoundData(state.round):null;
const offers=()=>typeof getCurrentExwOffersForRender==='function'?getCurrentExwOffersForRender(current()):[];
const chosen=()=>state.choices?.exw?.[state.round]||null;
const bought=()=>state.confirmed?.exw?.[state.round]||null;
let map=null,markLayer=null,routeLayer=null,portMarker=null,markers=[];
let activeTile=null,style='street',failures=0,tileLoaded=false,tileTimer=null,renderedRound=0;
let req=null,selectedRouteId=null,loadingLeaflet=false,routeBounds=null;
function status(message='',bad=false){
 const x=el('l1m-status');if(!x)return;
 x.textContent=message;
 x.className='l1m-status'+(bad?' error':'');
 x.hidden=!message;
}
function shell(){
 return '<div id="'+ROOT_ID+'" aria-label="Level 1 — mapa real de originação">'+
 '<div id="l1m-map" aria-label="Mapa cartográfico real com as origens das ofertas EXW"></div>'+
 '<div class="l1m-ui">'+
 '<header class="l1m-top">'+
 '<div class="l1m-brand"><div class="l1m-logo">TG</div><div><div class="l1m-title">TRADING GAMES / <b>LEVEL 1</b></div><div class="l1m-sub">Originação pura · cinco rodadas</div></div></div>'+
 '<div class="l1m-rounds" id="l1m-rounds"></div>'+
 '<div class="l1m-top-right"><div class="l1m-market" id="l1m-market"></div>'+
 '<select class="l1m-select" id="l1m-style" aria-label="Estilo do mapa"><option value="street">Ruas</option><option value="topo">Topográfico</option><option value="satellite">Satélite</option></select>'+
 '<button class="l1m-btn" data-l1m-action="back" type="button">Campanha</button></div></header>'+
 '<section class="l1m-news" id="l1m-news"></section>'+
 '<aside class="l1m-side"><div class="l1m-side-head"><span class="l1m-eyebrow">Mesa de originação · Santos</span><h2>Escolha sua operação</h2><p>Uma decisão EXW por rodada · valores simulados</p></div>'+
 '<nav class="l1m-tabs" id="l1m-tabs"><button data-l1m-tab="market">Mercado</button><button data-l1m-tab="offers">Ofertas</button><button data-l1m-tab="book">Posição</button></nav>'+
 '<div class="l1m-side-scroll" id="l1m-panel"></div>'+
 '<div class="l1m-foot"><div class="l1m-progress"><div id="l1m-progress-fill"></div></div><div class="l1m-progress-text"><span id="l1m-volume"></span><span id="l1m-missing"></span></div>'+
 '<div class="l1m-commit"><button class="l1m-btn" type="button" data-l1m-action="discard">Descartar</button><button class="l1m-btn primary" type="button" id="l1m-buy" data-l1m-action="buy">Comprar</button></div>'+
 '<div class="l1m-commit"><button class="l1m-btn" type="button" data-l1m-action="general">Visão geral</button><button class="l1m-btn primary" type="button" data-l1m-action="next" id="l1m-next">Avançar rodada</button></div></div></aside>'+
 '<div class="l1m-bottom"><b>●</b> Oferta EXW <span style="color:#ca893b">◆</span> Porto de Santos <span style="color:#128d6a">━</span> Rota rodoviária ilustrada por OSRM quando disponível</div>'+
 '<div class="l1m-status" id="l1m-status" hidden></div>'+
 '</div></div>';
}
function isMapStage(){return good()&&['r1_home','r1_exw'].includes(state.stage);}
function stopRoute(){if(req){try{req.abort()}catch(_){ }req=null;}if(routeLayer)routeLayer.clearLayers();selectedRouteId=null;routeBounds=null;}
function tile(next){
 if(!map||!window.L)return;
 clearTimeout(tileTimer);
 if(activeTile)map.removeLayer(activeTile);
 style=next;failures=0;tileLoaded=false;
 const select=el('l1m-style');if(select)select.value=next;
 status('Carregando cartografia '+BASES[style].name.toLowerCase()+'…');
 const layer=L.tileLayer(BASES[style].url,{maxZoom:19,maxNativeZoom:17,minZoom:3,
 attribution:'Cartografia © Esri e provedores de dados · dados de referência OSM'});
 activeTile=layer;
 layer.on('tileload',()=>{if(activeTile!==layer)return;if(!tileLoaded){tileLoaded=true;clearTimeout(tileTimer);status('');}});
 layer.on('tileerror',()=>{if(activeTile!==layer||tileLoaded)return;if(++failures>=5)fallback();});
 layer.addTo(map);
 tileTimer=setTimeout(()=>{if(activeTile===layer&&!tileLoaded)fallback()},8500);
}
function fallback(){
 if(style==='street')tile('topo');
 else if(style==='topo')tile('satellite');
 else {clearTimeout(tileTimer);status('Não foi possível carregar a cartografia. Tente outra camada.',true);}
}
function icon(offer,active,confirmed){
 const name=esc(String(offer.city||'Origem'));
 return L.divIcon({className:'',iconSize:[86,69],iconAnchor:[43,47],
 html:'<div class="l1m-money-pin'+(active?' selected':'')+(confirmed?' confirmed':'')+'"><div class="l1m-money-icon">$</div><div class="l1m-money-name">'+name+'</div></div>'});
}
function fitSelectedRoute(bounds){
 if(!map||!bounds||!bounds.isValid())return;
 // Reserve visible space for the floating news card / right drawer (desktop),
 // or the lower drawer (mobile), keeping BOTH endpoints on the visible map.
 const size=map.getSize(),w=size.x||window.innerWidth,h=size.y||window.innerHeight;
 const mobile=w<=760;
 const top=mobile?Math.min(158,Math.round(h*.2)):Math.min(136,Math.round(h*.16));
 const bottom=mobile?Math.min(Math.round(h*.51),Math.max(36,h-top-130)):Math.min(74,Math.round(h*.1));
 const left=mobile?22:Math.min(105,Math.max(25,Math.round(w*.05)));
 const right=mobile?20:Math.min(402,Math.max(265,Math.round(w*.29)));
 map.fitBounds(bounds.pad(.08),{
  paddingTopLeft:[left,top],paddingBottomRight:[right,bottom],
  maxZoom:7,animate:true,duration:.45
 });
}
function general(){
 if(!map||!window.L)return;
 const coords=offers().map(o=>COORDS[o.city+'|'+o.uf]).filter(Boolean).concat([PORT]);
 if(coords.length>1)map.fitBounds(L.latLngBounds(coords).pad(.13),{paddingTopLeft:[25,105],paddingBottomRight:[395,65],maxZoom:6,animate:false});
}
function redrawMarkers(){
 if(!map||!markLayer)return;
 markLayer.clearLayers();markers=[];
 const s=chosen(),b=bought();
 offers().forEach(o=>{
  const p=COORDS[o.city+'|'+o.uf];if(!p)return;
  const m=L.marker(p,{icon:icon(o,!!s&&Number(o.id)===Number(s.id),!!b&&Number(o.id)===Number(b.id)),
   title:o.city+'/'+o.uf+' · oferta EXW',keyboard:true,riseOnHover:true}).addTo(markLayer);
  m.on('click',()=>selectOffer(o.id));
  markers.push({offer:o,marker:m});
 });
}
function renderMarkersIfNeeded(){
 if(!map)return;
 if(renderedRound!==state.round){stopRoute();renderedRound=state.round;redrawMarkers();general();}
 else {
  const s=chosen(),b=bought();
  markers.forEach(m=>m.marker.setIcon(icon(m.offer,!!s&&Number(m.offer.id)===Number(s.id),!!b&&Number(m.offer.id)===Number(b.id))));
 }
}
function loadMap(){
 if(!el(ROOT_ID)||map)return;
 if(!window.L){status('Preparando biblioteca cartográfica…');loadLeaflet();return;}
 map=L.map('l1m-map',{zoomControl:false,preferCanvas:true,minZoom:3,maxZoom:13}).setView([-17.5,-52],5);
 L.control.zoom({position:'bottomright'}).addTo(map);
 routeLayer=L.layerGroup().addTo(map);
 markLayer=L.layerGroup().addTo(map);
 portMarker=L.marker(PORT,{zIndexOffset:-100,icon:L.divIcon({className:'',iconAnchor:[15,15],iconSize:[120,35],
  html:'<div class="l1m-port"><b>⚓</b>SANTOS</div>'}),title:'Porto de Santos'}).addTo(map);
 tile(style);renderedRound=0;renderMarkersIfNeeded();
 // A selection made while Leaflet was still loading must also show its route.
 if(chosen())requestRoute();
 setTimeout(()=>map&&map.invalidateSize(),40);
}
function loadLeaflet(){
 if(loadingLeaflet)return;
 loadingLeaflet=true;
 const urls=['https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js','https://unpkg.com/leaflet@1.9.4/dist/leaflet.js','https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js'];
 function tryNext(n){if(window.L){loadingLeaflet=false;loadMap();return;}if(n>=urls.length){loadingLeaflet=false;status('Biblioteca Leaflet bloqueada. Atualize a página.',true);return;}
  const s=document.createElement('script');s.src=urls[n];s.async=true;
  let done=false;const timer=setTimeout(()=>{if(done)return;done=true;s.remove();tryNext(n+1)},8500);
  s.onload=()=>{if(done)return;done=true;clearTimeout(timer);tryNext(n+1);};
  s.onerror=()=>{if(done)return;done=true;clearTimeout(timer);tryNext(n+1);};
  document.head.appendChild(s);}
 tryNext(0);
}
function panel(){
 if(!good()||!el(ROOT_ID))return;
 const rd=current();if(!rd)return;
 const lv=getCampaignLevel(1),bk=calculateCampaignBookSnapshot(),ls=state.campaign.l1Tab||'market';
 const s=chosen(),b=bought(),left=Math.max(0,Number(lv.targetVolumeT)-Number(bk.totalUsedT)),p=Number(bk.totalUsedT)/Math.max(1,Number(lv.targetVolumeT));
 const prev=state.round>1?getRoundData(state.round-1):null;
 el('l1m-rounds').innerHTML='<span>RODADA</span>'+[1,2,3,4,5].map(n=>'<span class="l1m-round '+(n===state.round?'active':n<state.round?'done':'')+'" title="Rodadas seguem a sequência obrigatória">'+(n<state.round?'✓':n)+'</span>').join('');
 el('l1m-market').innerHTML='<span>CBOT <strong>'+fmt(rd.cbot_cent_bu,2)+' ¢/bu</strong></span><span>USDBRL <strong>'+fmt(rd.usd,4)+'</strong></span>';
 const headline=String(rd.master_news||rd.market_headline||rd.news||'Observe as condições da rodada.');
 el('l1m-news').innerHTML='<div class="l1m-eyebrow">NOTÍCIA-MESTRE · RODADA '+state.round+'</div><h3>'+esc(headline)+'</h3><p>'+esc(rd.market_signal||'')+'</p>';
 el('l1m-tabs').querySelectorAll('button').forEach(x=>x.classList.toggle('active',x.dataset.l1mTab===ls));
 let html='';
 if(ls==='market'){
  let reaction='';
  if(prev){
   const diff=(x,y,dec)=>{let v=Number(x)-Number(y);return (v>=0?'+':'')+fmt(v,dec);};
   const po=rd.offers_exw?.find(o=>o.city==='Porto Nacional');
   const pp=prev.offers_exw?.find(o=>o.city==='Porto Nacional');
   reaction='<div class="l1m-stat"><span>Chicago ante rodada anterior</span><strong>'+diff(rd.cbot_cent_bu,prev.cbot_cent_bu,2)+' ¢/bu</strong></div>'+
     '<div class="l1m-stat"><span>Dólar ante rodada anterior</span><strong>'+diff(rd.usd,prev.usd,4)+'</strong></div>'+
     (po&&pp?'<div class="l1m-stat"><span>Físico TO</span><strong>'+diff(po.price_brl_saca,pp.price_brl_saca,2)+' R$/sc</strong></div>':'');
  }
  html='<div class="l1m-eyebrow">LEITURA DE MERCADO</div><h3>'+esc(headline)+'</h3>'+reaction+
   '<p class="l1m-note">'+esc(rd.market_signal||'Compare Chicago, câmbio e preço físico.')+'</p>'+
   '<p class="l1m-note"><b>Decisão:</b> '+esc(rd.decision_prompt||'Selecione uma origem ou aguarde.')+'</p>'+
   '<div class="l1m-action-row"><button class="l1m-btn primary" type="button" data-l1m-tab="offers">Comparar ofertas →</button></div>';
 } else if(ls==='offers'){
  html='<div class="l1m-eyebrow">OFERTAS EXW · ORIGENS SIMULADAS</div><p class="l1m-note">Selecione uma origem no mapa ou na lista. O frete cotado permanece o do cenário, independentemente do serviço de rotas.</p>';
  html+=offers().map(o=>{
   const isSelected=!!s&&Number(s.id)===Number(o.id),isConfirmed=!!b&&Number(b.id)===Number(o.id);
   return '<button type="button" class="l1m-offer '+(isSelected?'selected ':'')+(isConfirmed?'confirmed':'')+'" data-l1m-offer="'+o.id+'">'+
    '<div class="l1m-offer-top"><strong>'+esc(formatOfferDisplayName(o))+'</strong><b>R$ '+fmt(o.price_brl_saca,2)+'/sc</b></div>'+
    '<div class="l1m-offer-sub"><span>'+fmt(o.volume_t)+' t disponíveis</span><span>Frete R$ '+fmt(o.freight_brl_t_santos,0)+'/t</span></div></button>';
  }).join('');
  if(s){
   const vol=b?Number(b.volume_t):Math.min(Number(s.available_volume_t||s.volume_t),left);
   html+='<div class="l1m-eyebrow" style="margin-top:13px">'+(b?'COMPRA CONFIRMADA':'OFERTA SELECIONADA')+'</div>'+
    '<div class="l1m-stat"><span>Origem</span><strong>'+esc(formatOfferDisplayName(s))+'</strong></div>'+
    '<div class="l1m-stat"><span>Volume da operação</span><strong>'+fmt(vol)+' t</strong></div>'+
    '<div class="l1m-stat"><span>Preço EXW</span><strong>R$ '+fmt(s.price_brl_saca,2)+'/sc</strong></div>'+
    '<div class="l1m-stat"><span>Frete para Santos</span><strong>R$ '+fmt(s.freight_brl_t_santos,2)+'/t</strong></div>';
   if(state.round===1){
    const snap=calculateCampaignOfferBasisSnapshot({...s,volume_t:vol},state.round);
    html+='<div class="l1m-stat"><span>Basis CFR equivalente</span><strong>'+fmt(snap.basisCentBu,1)+' ¢/bu</strong></div>';
   } else html+='<p class="l1m-note">A partir da rodada 2, calcule o custo CFR e o basis antes da decisão.</p>';
   html+='<div class="l1m-action-row"><button type="button" class="l1m-btn" data-l1m-action="calculator">'+(state.round===1?'Ver cálculo CFR':'Fazer cálculos')+'</button>'+
    '<button type="button" class="l1m-btn" data-l1m-action="route">Ver rota</button></div>';
  }
  if(!s)html+='<p class="l1m-note">Selecione uma oferta para consultar valores e confirmar sua compra.</p>';
 } else {
  html='<div class="l1m-eyebrow">POSIÇÃO DA OPERAÇÃO · NAVIO DE '+fmt(lv.targetVolumeT)+' T</div>'+
   '<div class="l1m-stat"><span>Volume originado</span><strong>'+fmt(bk.totalUsedT)+' t</strong></div>'+
   '<div class="l1m-stat"><span>Volume restante</span><strong>'+fmt(bk.missingT)+' t</strong></div>'+
   '<div class="l1m-stat"><span>Compras confirmadas</span><strong>'+Object.keys(state.confirmed?.exw||{}).length+'/5</strong></div>';
  if(state.round===1&&bk.totalUsedT){
   html+='<div class="l1m-stat"><span>Basis médio</span><strong>'+fmt(bk.basisAvg,1)+' ¢/bu</strong></div>'+
    '<div class="l1m-stat"><span>Margem indicativa</span><strong>US$ '+fmt(bk.pnlUsd,0)+'</strong></div>';
  } else html+='<p class="l1m-note">Os cálculos e a avaliação comercial completa aparecem no encerramento da quinta rodada.</p>';
  html+='<p class="l1m-note"><b>Critério:</b> completar 60.000 t, respeitar o basis médio e preservar margem não negativa. Avaliação final de originação, margem, ocupação e disciplina.</p>';
 }
 el('l1m-panel').innerHTML=html;
 el('l1m-progress-fill').style.width=Math.max(0,Math.min(100,p*100))+'%';
 el('l1m-volume').textContent=fmt(bk.totalUsedT)+' / '+fmt(lv.targetVolumeT)+' t';
 el('l1m-missing').textContent=fmt(left)+' t restantes';
 const buy=el('l1m-buy');buy.disabled=!s||!!b;buy.textContent=b?'Compra confirmada':'Comprar';
 el('l1m-next').textContent=state.round===lv.rounds?'Encerrar Level 1':'Avançar rodada';
 renderMarkersIfNeeded();
}
function selectOffer(id){
 if(!good())return;
 const offer=offers().find(o=>String(o.id)===String(id));if(!offer)return;
 if(state.stage!=='r1_exw')setStage('r1_exw');
 state.campaign.l1Tab='offers';
 selectExwOfferForCurrentRound(offer,current(),'r1_exw');
 panel();
 // The route and zoom are part of selecting an offer, not an extra button.
 // This applies equally to an animated map marker or a sidebar list item.
 requestRoute();
}
function useOriginalHot(action){
 const hotspot=document.querySelector('[data-l1-hot="'+action+'"]');
 if(!hotspot){status('Controles do jogo ainda inicializando. Tente novamente.',true);return false;}
 hotspot.click();panel();return true;
}
function next(){
 if(!good())return;
 if(bought())openCampaignAdvanceModal();
 else nextRound();
}
function calculator(){
 const s=chosen();if(!s){status('Selecione uma oferta antes de calcular.',true);return;}
 const prior=el('l1m-calc-backdrop');if(prior)prior.remove();
 const bg=document.createElement('div');bg.id='l1m-calc-backdrop';bg.className='l1m-calc-backdrop';
 bg.innerHTML='<div class="l1m-calc" role="dialog" aria-modal="true" aria-label="Calculadora didática CFR">'+campaignL1CalculatorMarkup(current())+'</div>';
 el(ROOT_ID).appendChild(bg);
 bg.addEventListener('click',e=>{if(e.target===bg||e.target.closest('[data-l1-action="close"]')){e.preventDefault();e.stopPropagation();bg.remove();panel();}},true);
 attachCampaignL1WorkbenchEvents(bg.querySelector('.l1m-calc'),current());
}
async function requestRoute(){
 if(!window.L||!map||!chosen())return;
 const s=chosen(),p=COORDS[s.city+'|'+s.uf];
 if(!p){status('Origem sem coordenadas urbanas de referência.',true);return;}
 // Cancel previous HTTP request and remove old line when a different lot is selected.
 stopRoute();
 const id=state.round+':'+s.id;
 selectedRouteId=id;
 // Draw a visibly provisional straight line immediately; never represent it as a road.
 const preview=L.polyline([p,PORT],{color:'#cb903e',weight:3,opacity:.95,
  dashArray:'7 8',lineCap:'round',interactive:false}).addTo(routeLayer);
 routeBounds=L.latLngBounds([p,PORT]);
 fitSelectedRoute(routeBounds);
 status('Ligação visual origem–Santos exibida · calculando trajeto rodoviário…');
 const c=new AbortController();req=c;
 const timer=setTimeout(()=>c.abort(),18000);
 try{
  const url='https://router.project-osrm.org/route/v1/driving/'+p[1]+','+p[0]+';'+PORT[1]+','+PORT[0]+'?overview=full&geometries=geojson&steps=false';
  const response=await fetch(url,{signal:c.signal});
  if(!response.ok)throw new Error('HTTP '+response.status);
  const data=await response.json();
  if(data.code!=='Ok'||!data.routes?.length)throw new Error('Sem rota');
  // Stale responses must never redraw the prior offer on top of a newer choice.
  if(selectedRouteId!==id||!map||!chosen()||String(chosen().id)!==String(s.id))return;
  const result=data.routes[0];
  if(result.geometry?.type!=='LineString'||!Array.isArray(result.geometry.coordinates)||result.geometry.coordinates.length<2)throw new Error('Geometria inválida');
  routeLayer.clearLayers(); // Replace preview with actual road geometry.
  const shape=L.geoJSON(result.geometry,{style:{color:'#128466',weight:5,opacity:.93,lineCap:'round',lineJoin:'round'}}).addTo(routeLayer);
  routeBounds=shape.getBounds().extend(L.latLngBounds([p,PORT]));
  fitSelectedRoute(routeBounds);
  status('Rota rodoviária: aprox. '+fmt(result.distance/1000,0)+' km até Santos · sem restrições de caminhão. Frete do jogo inalterado.');
 }catch(e){
  if(selectedRouteId!==id||!map)return;
  // Keep the already visible dashed segment rather than leaving a blank map.
  // A straight link is NOT a calculated road route.
  status('Trajeto rodoviário indisponível. Linha pontilhada = ligação visual, não rota por rodovias. Frete do jogo inalterado.',true);
 }finally{
  clearTimeout(timer);
  if(req===c)req=null;
 }
}
function onClick(e){
 const tab=e.target.closest('[data-l1m-tab]');
 if(tab){state.campaign.l1Tab=tab.dataset.l1mTab;panel();return;}
 const offer=e.target.closest('[data-l1m-offer]');if(offer){selectOffer(offer.dataset.l1mOffer);return;}
 const btn=e.target.closest('[data-l1m-action]');if(!btn)return;
 const action=btn.dataset.l1mAction;
 if(action==='back'){unmount();backToCampaignMenu();return;}
 if(action==='buy'){if(chosen()&&!bought()){useOriginalHot('confirm');}return;}
 if(action==='discard'){
  useOriginalHot('discard');
  // Discard removes the offer selection, so the visual route must disappear too.
  if(!chosen()){stopRoute();general();status('');}
  return;
 }
 if(action==='next'){next();return;}
 if(action==='general'){stopRoute();general();status('');return;}
 if(action==='calculator'){calculator();return;}
 if(action==='route'){requestRoute();return;}
}
function mount(){
 if(!isMapStage())return;
 let root=el(ROOT_ID);
 if(!root){
  root=document.createElement('div');
  root.innerHTML=shell();
  document.body.appendChild(root.firstElementChild);
  root=el(ROOT_ID);
  root.addEventListener('click',onClick);
  el('l1m-style').addEventListener('change',e=>tile(e.target.value));
 }
 panel();
 loadMap();
}
function unmount(){
 stopRoute();clearTimeout(tileTimer);
 if(map){try{map.remove()}catch(_){ }map=null;}
 markers=[];portMarker=null;markLayer=null;routeLayer=null;activeTile=null;renderedRound=0;
 const root=el(ROOT_ID);if(root)root.remove();
}
window.CampaignL1Map={mount,unmount,panel,selectOffer,next,requestRoute};
})();