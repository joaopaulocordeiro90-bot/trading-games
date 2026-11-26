#!/usr/bin/env python3
"""End-to-end multimodal game and progression; deterministic OSRM, real Leaflet."""
import functools,http.server,threading
from pathlib import Path
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'test-artifacts';OUT.mkdir(exist_ok=True)
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(http.server.SimpleHTTPRequestHandler,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
url='http://127.0.0.1:%s/'%server.server_address[1]
opts=webdriver.ChromeOptions()
for flag in ['--headless=new','--no-sandbox','--disable-dev-shm-usage','--window-size=1500,950']:opts.add_argument(flag)
driver=webdriver.Chrome(options=opts);wait=WebDriverWait(driver,40)
def js(s):return driver.execute_script(s)
def click(css):
    wait.until(lambda d:js("return !!document.querySelector("+repr(css)+")"))
    js("document.querySelector("+repr(css)+").click()")
def waitjs(s):return wait.until(lambda d:js(s))
try:
    driver.get(url+'campaign-multimodal.html?level=3')
    waitjs("return document.body.textContent.includes('bloqueado')")
    js("localStorage.setItem('tg_campaign_unlocked_level','2')")
    driver.get(url+'?campaign=1')
    waitjs("return !!document.getElementById('campaignLevelsContainer')")
    assert 'Mais alternativas logísticas' in js("return document.getElementById('campaignLevelsContainer').textContent")
    assert 'Mercado em movimento' in js("return document.getElementById('campaignLevelsContainer').textContent")
    click('[onclick="window.startCampaignLevel(2)"]')
    for level in (2,3):
        waitjs("return !!document.getElementById('multi-panel')")
        waitjs("return document.querySelectorAll('#l1m-map .l1m-money-pin').length===4")
        waitjs("return [...document.querySelectorAll('#l1m-map img.leaflet-tile')].some(i=>i.complete&&i.naturalWidth>0) || document.querySelector('#l1m-health')?.dataset.state==='error'")
        assert js("return document.querySelectorAll('#l1m-map .multi-terminal').length") == 2
        # The complete terminal label must be enclosed by the badge at 100% and 125% zoom.
        for zoom in ('1','1.25'):
            js("document.documentElement.style.zoom="+repr(zoom))
            assert js("return [...document.querySelectorAll('.multi-terminal')].every(t=>{const a=t.getBoundingClientRect(),b=t.querySelector('strong').getBoundingClientRect();return t.scrollWidth<=t.clientWidth+2 && b.right<=a.right+1 && b.left>=a.left-1 && b.bottom<=a.bottom+1})"),'Terminal name overflows'
        js("document.documentElement.style.zoom='1'")
        driver.save_screenshot(str(OUT/f'l{level}-terminal-label.png'))
        geo=json_geo=driver.execute_async_script("const cb=arguments[arguments.length-1];fetch('./data/campaign/rail-corridors.geojson').then(r=>r.json()).then(cb).catch(e=>cb({error:String(e)}));")
        assert len(geo.get('features',[]))==2
        assert all(f['properties']['port_reference_distance_km']<=5 for f in geo['features'])
        assert all(f['geometry']['type']=='MultiLineString' for f in geo['features'])
        import json
        cfg=json.loads((ROOT/f'data/campaign/levels/level{level}.json').read_text())
        seq=driver.execute_script("""const l=arguments[0],E=window.TGMulti;let answer=null;function dfs(i,lots,picks){if(answer)return;if(i===l.rounds){if(E.result(l,lots).approved&&lots.some(x=>x.mode==='road')&&lots.some(x=>x.mode!=='road'))answer=picks;return;}let r=l.scenario.rounds[i];let candidates=r.offers_exw.flatMap(o=>E.modes(o).map(m=>({o,m,b:E.calc(l,r,o,m).basis}))).sort((a,b)=>a.b-b.b);if(E.result(l,lots).remaining)for(const c of candidates){dfs(i+1,[...lots,E.decision(l,i+1,c.o.id,c.m,lots)],[...picks,[c.o.id,c.m]]);if(answer)return;}dfs(i+1,lots,[...picks,null]);}dfs(0,[],[]);return answer;""",cfg)
        assert seq and len(seq)==cfg['rounds']
        js("""window.__osrm=[];const real=window.fetch.bind(window);window.fetch=(u,o)=>{
        if(!String(u).includes('router.project-osrm.org'))return real(u,o);
        window.__osrm.push(String(u));const route=String(u).split('/driving/')[1].split('?')[0].split(';').map(x=>x.split(',').map(Number));
        return Promise.resolve({ok:true,json:async()=>({code:'Ok',routes:[{distance:100000,geometry:{type:'LineString',coordinates:route}}]})});};""")
        for r,a in enumerate(seq,1):
            waitjs("return document.querySelector('#multi-rounds .active')?.textContent==="+repr(str(r)))
            if r>1:assert 'REAÇÃO À NOTÍCIA ANTERIOR' in js("return document.getElementById('multi-panel').textContent")
            n=a
            if n:
                offer,mode=n
                click('[data-tab=offers]')
                click('[data-offer="'+str(offer)+'"]')
                assert js("return document.querySelectorAll('.multi-mode').length") in (2,3)
                assert js("return document.querySelectorAll('.multi-mode.active').length")==0
                assert js("return document.getElementById('multi-buy').disabled")
                click('[data-mode="'+mode+'"]')
                waitjs("return document.querySelector('#multi-status').textContent.includes('Trecho rodoviário aprox.')")
                assert js("return !document.getElementById('multi-buy').disabled")
                if mode!='road':
                    waitjs("return [...document.querySelectorAll('#l1m-map .leaflet-overlay-pane path')].some(x=>['#b47c2d','#8d4b24'].includes(x.getAttribute('stroke')))")
                    assert 'ANTT/Infra S.A.' in js("return document.querySelector('#multi-status').textContent")
                if r==2:
                    click('[data-action=calc]')
                    waitjs("return document.getElementById('multi-dialog').open")
                    assert js("return document.querySelectorAll('#multi-dialog input').length")==4
                    click('#multi-dialog [data-close]')
                    driver.save_screenshot(str(OUT/f'l{level}-modal.png'))
                click('#multi-buy')
                waitjs("return document.getElementById('tg-round-dialog')?.open")
                assert 'POSIÇÃO PROJETADA' in js("return document.getElementById('tg-round-dialog').textContent")
                assert 'Margem bruta indicada' not in js("return document.getElementById('tg-round-dialog').textContent")
                if r==1:
                    before=js("return document.getElementById('multi-volume').textContent")
                    click('#tg-ru-cancel')
                    assert js("return document.getElementById('multi-volume').textContent")==before
                    assert js("return document.querySelector('#multi-rounds .active').textContent")==str(r)
                    click('#multi-buy')
                    waitjs("return document.getElementById('tg-round-dialog')?.open")
                driver.save_screenshot(str(OUT/f'l{level}-compra-r{r}.png'))
                click('#tg-ru-confirm')
            else:
                click('#multi-next')
                waitjs("return document.getElementById('tg-round-dialog')?.open")
                click('#tg-ru-advance')
            if r<len(seq):
                waitjs("return document.querySelector('#multi-rounds .active')?.textContent==="+repr(str(r+1)))
                waitjs("return document.getElementById('campaignRoundSplashFixed')?.textContent.includes('RODADA "+str(r+1)+"')")
        waitjs("return !!document.querySelector('.multi-result')")
        assert 'RESULTADO SATISFATÓRIO' in js("return document.querySelector('.multi-result').textContent")
        assert '60.000 t' in js("return document.querySelector('.multi-result').textContent")
        assert 'Rodo direto' in js("return document.querySelector('.multi-result').textContent") and 'Rodo + ferro' in js("return document.querySelector('.multi-result').textContent")
        driver.save_screenshot(str(OUT/f'l{level}-resultado.png'))
        if level==2:
            assert js("return localStorage.getItem('tg_campaign_unlocked_level')")=='3'
            click('a[href="./campaign-multimodal.html?level=3"]')
        else:
            assert js("return JSON.parse(localStorage.getItem('tg_campaign_multimodal_l3_v3')).approved")
    print('OK: gates, L2→L3, four origins, real Leaflet, both modals, manual calculator, immutable purchases, 5/6 rounds, approval and progression.')
finally:
    driver.quit();server.shutdown()
