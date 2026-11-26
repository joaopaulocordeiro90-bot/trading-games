/* Trading Games L2/L3. Independent campaign engine; no dependency on L1 state. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TGMulti=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const K=.367437, clamp=x=>Math.max(0,Math.min(1,x)),MODES=['road','rail'];
function calc(level,rd,offer,mode){
 if(!MODES.includes(mode))throw Error('Selecione um modal');
 const freight=offer.logistics?.[mode]?.brl_t;
 if(!Number.isFinite(freight)||freight<0||!(rd.usd>0))throw Error('Dados comerciais inválidos');
 const exwUsd=offer.price_brl_saca/.06/rd.usd,inlandUsd=freight/rd.usd,fob=level.fixedFobbingUsdT,sea=level.fixedFreightUsdT;
 const cfrUsd=exwUsd+inlandUsd+fob+sea,cfr=cfrUsd/K,basis=cfr-rd.cbot_cent_bu;
 const bestFreight=Math.min(offer.logistics.road.brl_t,offer.logistics.rail.brl_t);
 const bestOriginBasis=basis-(freight-bestFreight)/rd.usd/K;
 return {round:rd.round,id:offer.id,city:offer.city,uf:offer.uf,mode,fx:rd.usd,cbot:rd.cbot_cent_bu,price:offer.price_brl_saca,freight,exwUsd,inlandUsd,fob,sea,cfrUsd,cfr,basis,marginUsdT:(level.fixedSaleBasisCentBu-basis)*K,bestOriginBasis,logisticsRegretBrlT:freight-bestFreight,available:offer.volume_t};
}
function benchmark(level,rd){return Math.min(...rd.offers_exw.flatMap(o=>MODES.map(m=>calc(level,rd,o,m).basis)));}
function decision(level,round,offerId,mode,existing){
 if(existing.some(x=>x.round===round))throw Error('Compra já confirmada');
 const rd=level.scenario.rounds[round-1],offer=rd?.offers_exw.find(x=>x.id===offerId);
 if(!offer)throw Error('Oferta inválida');
 const remaining=Math.max(0,level.targetVolumeT-existing.reduce((a,b)=>a+b.volume,0));
 if(!remaining)throw Error('Navio completo');
 return {...calc(level,rd,offer,mode),volume:Math.min(remaining,offer.volume_t),originRegret:Math.max(0,calc(level,rd,offer,mode).bestOriginBasis-benchmark(level,rd))};
}
function result(level,lots){
 const volume=lots.reduce((a,b)=>a+b.volume,0),weighted=f=>volume?lots.reduce((a,b)=>a+f(b)*b.volume,0)/volume:0;
 const basis=weighted(x=>x.basis),margin=lots.reduce((a,b)=>a+b.marginUsdT*b.volume,0),logisticsLoss=lots.reduce((a,b)=>a+b.logisticsRegretBrlT*b.volume,0);
 const score={origination:volume?Math.round(25*clamp(1-weighted(x=>x.originRegret)/45)):0,margin:volume?Math.round(25*clamp((level.fixedSaleBasisCentBu-basis)/40)):0,logistics:volume?Math.round(20*clamp(1-weighted(x=>x.logisticsRegretBrlT)/75)):0,utilization:Math.round(20*clamp(volume/level.targetVolumeT)),discipline:volume?Math.round(5*weighted(x=>x.basis<=level.fixedSaleBasisCentBu?1:0)+5*weighted(x=>x.basis<=level.targetBasisCentBu?1:0)):0};
 score.total=Object.values(score).reduce((a,b)=>a+b,0);
 const approved=volume===level.targetVolumeT&&basis<=level.targetBasisCentBu+1e-9&&margin>=-1e-6&&score.total>=70;
 return {volume,remaining:Math.max(0,level.targetVolumeT-volume),basis,margin,logisticsLoss,score,approved};
}
function evaluate(level,seq){
 const lots=[];
 for(let i=0;i<level.rounds;i++){const option=seq[i]||0;if(!option||lots.reduce((a,b)=>a+b.volume,0)>=level.targetVolumeT)continue;lots.push(decision(level,i+1,Math.ceil(option/2),option%2?'road':'rail',lots));}
 return result(level,lots);
}
return {calc,benchmark,decision,result,evaluate,MODES,K};
});
