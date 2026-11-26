/* Common campaign purchase/advance dialog: presentation only; engines own all calculations. */
(function(root){
'use strict';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(n,d=0)=>Number(n).toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d});
const money=(n,d=2)=>'R$ '+fmt(n,d),usd=(n,d=2)=>(n<0?'−':'')+'US$ '+fmt(Math.abs(n),d),basis=n=>(n>=0?'+':'−')+fmt(Math.abs(n),1)+' ¢/bu';
function ensureStyle(){if(!document.querySelector('link[data-tg-round-ui]')){const l=document.createElement('link');l.rel='stylesheet';l.href='./campaign-round-ui.css?v=3';l.dataset.tgRoundUi='1';document.head.appendChild(l);}}
function field(label,value){return '<div class="tg-ru-field"><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong></div>';}
function open(data,onConfirm){
 ensureStyle();let d=document.getElementById('tg-round-dialog');if(d?.open)return false;
 if(!d){d=document.createElement('dialog');d.id='tg-round-dialog';d.setAttribute('aria-labelledby','tg-ru-title');document.body.appendChild(d);}
 const buy=data.kind==='purchase',final=!!data.final,volume=Number(data.projectedVolume),target=Number(data.target),remaining=Math.max(0,target-volume);
 const label=buy?(final?'Confirmar e encerrar nível':'Confirmar e avançar rodada'):(final?'Encerrar nível':'Avançar rodada');
 const title=buy?'Confirmar compra EXW':data.complete?'Navio completo':final?'Encerrar sem comprar?':'Avançar sem comprar?';
 let details='';
 if(buy){
  details='<section class="tg-ru-operation"><div class="tg-ru-operation-head"><div><span class="tg-ru-label">OPERAÇÃO SELECIONADA</span><h3>'+esc(data.origin)+'</h3></div><span class="tg-ru-chip">'+esc(data.modal)+'</span></div><p class="tg-ru-route">'+esc(data.route)+'</p><div class="tg-ru-grid">'+field('Volume contratado',fmt(data.volume)+' t')+field('Preço EXW',money(data.price)+'/sc')+field('Logística total',money(data.freight)+'/t')+'</div>'+
  (data.components?.length?'<div class="tg-ru-components">'+data.components.map(x=>'<span>'+esc(x[0])+' <b>'+esc(x[1])+'</b></span>').join('')+'</div>':'')+'</section>';
  if(data.volume<data.available)details+='<p class="tg-ru-partial"><strong>Compra parcial:</strong> '+fmt(data.volume)+' t das '+fmt(data.available)+' t disponíveis. Limite do navio respeitado.</p>';
  details+='<div class="tg-ru-context"><span>Chicago <b>'+fmt(data.cbot,2)+' ¢/bu</b></span><span>Dólar <b>R$ '+fmt(data.fx,4)+'</b></span><span>Fobbing <b>'+usd(data.fobbing)+'/t</b></span><span>Marítimo <b>'+usd(data.sea)+'/t</b></span></div>';
  if(data.teaching){
   const t=data.teaching;
   details+='<div class="tg-ru-review"><strong>Leitura de mesa · projeção:</strong> '+esc(t.review)+'</div><details class="tg-ru-details"><summary>Como o basis e a margem foram calculados</summary><div class="tg-ru-grid">'+field('EXW',usd(t.exwUsd)+'/t')+field('Logística',usd(t.inlandUsd)+'/t')+field('CFR equivalente',fmt(t.cfr,1)+' ¢/bu')+'</div><p>Basis do lote: <b>'+fmt(t.cfr,1)+' − '+fmt(data.cbot,1)+' = '+basis(t.lotBasis)+'</b>. Venda CFR: '+basis(t.sale)+'. Margem bruta simulada do lote: '+usd(t.lotMargin,0)+'.</p></details>';
  }else details+='<p class="tg-ru-muted">Confira os seus cálculos antes de confirmar. Os resultados de basis e margem serão revelados no encerramento do nível.</p>';
 }else details='<p class="tg-ru-muted">'+(data.complete?'A capacidade do navio foi atingida. Nenhuma nova compra será realizada nesta rodada.':'Nenhuma compra será realizada nesta rodada. As ofertas atuais não estarão disponíveis depois do avanço.')+'</p>';
 d.innerHTML='<div class="tg-ru-shell"><header class="tg-ru-head"><span class="tg-ru-label">TRADING GAMES · LEVEL '+esc(data.level)+' · RODADA '+esc(data.round)+'/'+esc(data.rounds)+'</span><h2 id="tg-ru-title">'+title+'</h2><p>'+(buy?'Revise a operação. A confirmação é definitiva e encerra a rodada.':'Revise sua posição antes de continuar.')+'</p></header><div class="tg-ru-body">'+details+
 '<section class="tg-ru-book"><div class="tg-ru-label">'+(buy?'POSIÇÃO PROJETADA APÓS A COMPRA':'POSIÇÃO ATUAL')+'</div><div class="tg-ru-grid">'+field('Volume acumulado',fmt(volume)+' / '+fmt(target)+' t')+field('Saldo do navio',fmt(remaining)+' t')+field('Ocupação',fmt(volume/target*100,1)+'%')+'</div><div class="tg-ru-progress" role="progressbar" aria-label="Ocupação do navio" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+Math.round(volume/target*100)+'"><i style="width:'+Math.min(100,100*volume/target)+'%"></i></div>'+
 (data.teaching?'<div class="tg-ru-grid tg-ru-economics">'+field('Basis médio projetado',basis(data.teaching.avgBasis))+field('Margem bruta indicada',usd(data.teaching.bookMargin,0))+'</div>':'')+'</section></div><footer class="tg-ru-footer"><button type="button" class="tg-ru-btn" id="tg-ru-cancel">Cancelar</button><button type="button" class="tg-ru-btn primary" id="'+(buy?'tg-ru-confirm':'tg-ru-advance')+'">'+label+'</button></footer></div>';
 let done=false;const cancel=d.querySelector('#tg-ru-cancel'),confirm=d.querySelector('.tg-ru-btn.primary');
 cancel.onclick=()=>{if(!done)d.close();};
 confirm.onclick=()=>{if(done)return;done=true;confirm.disabled=true;cancel.disabled=true;d.close();onConfirm();};
 d.showModal();cancel.focus();return true;
}
function splash(round){
 ensureStyle();document.getElementById('campaignRoundSplashFixed')?.remove();
 const d=document.createElement('div');d.id='campaignRoundSplashFixed';d.className='tg-ru-splash';d.setAttribute('role','status');d.innerHTML='<div>RODADA '+Number(round)+'</div>';document.body.appendChild(d);
 setTimeout(()=>d.remove(),2000);
}
root.TGRoundUI={open,splash};
})(window);
