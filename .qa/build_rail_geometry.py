#!/usr/bin/env python3
"""Create actual corridor geometries from the ANTT/Infra S.A. public network.
No synthetic links are drawn. Small topology gaps are used only for connectivity."""
import json,urllib.request,urllib.parse,math,heapq,time,sys
from collections import defaultdict
from pathlib import Path
URL='https://geo.infrasa.gov.br/server/rest/services/Ferrovias_Concedidas_em_opera%C3%A7%C3%A3o/FeatureServer/0/query'
PATIO='https://geo.infrasa.gov.br/server/rest/services/P%C3%A1tio_Ferrovi%C3%A1rio/MapServer/0/query'
def get(url,params):
    u=url+'?'+urllib.parse.urlencode(params)
    for i in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':'TradingGames educational cartography/1.0'}),timeout=35) as f:
                data=json.load(f)
            if 'error' in data: raise ValueError(str(data['error']))
            return data
        except Exception:
            if i==2:raise
            time.sleep(1+i)
def features(url,where,fields):
    p={'where':where,'f':'json','returnIdsOnly':'true'}
    ids=get(url,p).get('objectIds') or []
    if not ids:raise ValueError('No features '+where)
    result=[]
    for k in range(0,len(ids),100):
        result+=get(url,{'objectIds':','.join(map(str,ids[k:k+100])),'outFields':fields,'returnGeometry':'true','outSR':4326,'geometryPrecision':6,'f':'json'}).get('features',[])
    return result
def dist(a,b):
    return math.hypot((a[0]-b[0])*111.2*math.cos(math.radians((a[1]+b[1])/2)),(a[1]-b[1])*111.2)
def norm(s):
    import unicodedata
    return ''.join(c for c in unicodedata.normalize('NFD',str(s or '').upper()) if unicodedata.category(c)!='Mn')
def simplify(p,eps=.00025):
    if len(p)<3:return p
    keep={0,len(p)-1};stack=[(0,len(p)-1)]
    while stack:
        a,b=stack.pop();x,y=p[a];dx=p[b][0]-x;dy=p[b][1]-y;den=dx*dx+dy*dy
        best=0;idx=None
        for i in range(a+1,b):
            u,v=p[i];t=max(0,min(1,((u-x)*dx+(v-y)*dy)/den)) if den else 0
            d=(u-x-t*dx)**2+(v-y-t*dy)**2
            if d>best:best=d;idx=i
        if idx is not None and best>eps*eps:keep.add(idx);stack.extend([(a,idx),(idx,b)])
    return [p[i] for i in sorted(keep)]
allf=features(URL,"vhr_ferrov IN ('RMC','RMN','RMP','MRS')",'vhr_ferrov,vhr_siglap,vhr_sigl_1,nome_patioinicial,nome_patiofinal')
print('Network features:',len(allf),flush=True)
try:
    stations=features(PATIO,"vhr_ferrov IN ('RMC','RMN','RMP','MRS')",'nomeestaca,codigotres,vhr_ferrov,uf')
except Exception as e:
    stations=[];print('Station data unavailable:',str(e),flush=True)
def route(key,concessions,origin,origin_name):
    graph=defaultdict(list);ends=set();candidates=[];geo={}
    def node(p):
        k=tuple(round(float(x),5) for x in p[:2]);geo[k]=k;return k
    def edge(a,b,gap=False):
        if a==b:return
        w=dist(a,b)
        graph[a].append((b,w,gap));graph[b].append((a,w,gap))
    for f in allf:
        at=f.get('attributes',{})
        if at.get('vhr_ferrov') not in concessions and at.get('vhr_ferrov')!='MRS':continue
        for p in (f.get('geometry') or {}).get('paths',[]):
            if len(p)<2:continue
            if at.get('vhr_ferrov')=='MRS' and not all(-46.8<q[0]<-46.10 and -24.10<q[1]<-23.45 for q in p):continue
            v=[node(q) for q in p];ends.update((v[0],v[-1]))
            for a,b in zip(v,v[1:]):edge(a,b)
            for n,lab,code in [(v[0],at.get('nome_patioinicial'),at.get('vhr_siglap')),(v[-1],at.get('nome_patiofinal'),at.get('vhr_sigl_1'))]:
                if origin_name in norm(lab) or (key=='rondonopolis' and norm(code)=='TRO'):candidates.append((n,str(lab or code)))
    if not graph:raise ValueError('Empty network')
    # Only connect ends at small geographic gaps; output retains the source segments, not invented edges.
    buckets=defaultdict(list)
    for n in ends:buckets[(math.floor(n[0]/.002),math.floor(n[1]/.002))].append(n)
    for a in ends:
        x,y=math.floor(a[0]/.002),math.floor(a[1]/.002)
        for i in range(x-2,x+3):
            for j in range(y-2,y+3):
                for b in buckets.get((i,j),()):
                    if a<b and dist(a,b)<=.20:edge(a,b,True)
    origin_points=[]
    for f in stations:
        at=f.get('attributes',{});p=f.get('geometry') or {}
        if at.get('vhr_ferrov') in concessions and 'x' in p and (origin_name in norm(at.get('nomeestaca')) or (key=='rondonopolis' and norm(at.get('codigotres'))=='TRO')):
            point=(p['x'],p['y'])
            if dist(point,origin)<45:origin_points.append((point,str(at.get('nomeestaca') or at.get('codigotres'))))
    # Prefer actual declared terminal/station name, then closest named network endpoint.
    if origin_points:
        point,label=min(origin_points,key=lambda t:dist(t[0],origin))
        start=min(graph,key=lambda p:dist(p,point))
        if dist(start,point)>1.5:raise ValueError('Station off railway '+label)
    elif candidates:
        start,label=min(candidates,key=lambda t:dist(t[0],origin));point=start
        if dist(start,origin)>45:raise ValueError('Named station far away')
    else:raise ValueError('No named station '+origin_name)
    port=(-46.3093,-23.9539)
    target=min(graph,key=lambda p:dist(p,port))
    if dist(target,port)>5:raise ValueError('No rail endpoint close enough to Santos: '+str(dist(target,port)))
    q=[(0,start)];d={start:0};prev={}
    while q:
        cost,a=heapq.heappop(q)
        if cost!=d.get(a):continue
        if a==target:break
        for b,w,gap in graph[a]:
            nc=cost+w+(1 if gap else 0)
            if nc<d.get(b,float('inf')):d[b]=nc;prev[b]=(a,gap);heapq.heappush(q,(nc,b))
    if target not in d:
        target=min(d,key=lambda p:dist(p,port))
        if dist(target,port)>5:raise ValueError('Disconnected port approach '+key+' '+str(dist(target,port)))
    seq=[(target,False)];a=target
    while a!=start:
        b,gap=prev[a];seq[-1]=(a,gap);seq.append((b,False));a=b
    seq.reverse();parts=[];part=[];gaps=0;length=0
    for i,(p,gap) in enumerate(seq):
        if gap:
            gaps+=1
            if len(part)>1:parts.append(simplify(part))
            part=[p]
        else:
            if part:length+=dist(part[-1],p)
            part.append(p)
    if len(part)>1:parts.append(simplify(part))
    if not (500<length<2500):raise ValueError('Unreasonable length '+str(length))
    if gaps>150:raise ValueError('Too many gaps')
    return {'type':'Feature','properties':{'terminal':key,'name':label,'terminal_coordinate':[start[1],start[0]],'station_coordinate':[point[1],point[0]],'port_rail_coordinate':[target[1],target[0]],'distance_km':round(length,1),'topology_gaps':gaps,'source':'Infra S.A./ANTT, Declaração de Rede 2024','source_url':URL,'port_reference_distance_km':round(dist(target,port),2)},'geometry':{'type':'MultiLineString','coordinates':parts}}
out={'type':'FeatureCollection','features':[route('rio_verde',{'RMC','RMP'},(-50.9192,-17.7923),'RIO VERDE'),route('rondonopolis',{'RMN','RMP'},(-54.6372,-16.4673),'RONDONOPOLIS')]}
path=Path('data/campaign/rail-corridors.geojson');path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(out,separators=(',',':'),ensure_ascii=False))
for f in out['features']:print('RAIL_META',json.dumps(f['properties'],ensure_ascii=False),flush=True)
# Output chunks separately for reproducible import without binary artifacts.
raw=path.read_text()
for i in range(0,len(raw),6000):print('RAIL_DATA '+str(i//6000)+' '+raw[i:i+6000],flush=True)
