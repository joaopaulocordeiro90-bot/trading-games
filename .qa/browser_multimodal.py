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
    for level,seq in [(2,'03481'),(3,'050831')]:
        waitjs("return !!document.getElementById('multi-panel')")
        waitjs("return document.querySelectorAll('#l1m-map .l1m-money-pin').length===4")
        waitjs("return [...document.querySelectorAll('#l1m-map img.leaflet-tile')].some(i=>i.complete&&i.naturalWidth>0) || document.querySelector('#l1m-health')?.dataset.state==='error'")
        assert js("return !!document.querySelector('#l1m-map .multi-terminal')")
        assert js("return document.querySelectorAll('#multi-rounds .l1m-round').length")==len(seq)
        js("""window.__osrm=[];const real=window.fetch.bind(window);window.fetch=(u,o)=>{
        if(!String(u).includes('router.project-osrm.org'))return real(u,o);
        window.__osrm.push(String(u));const route=String(u).split('/driving/')[1].split('?')[0].split(';').map(x=>x.split(',').map(Number));
        return Promise.resolve({ok:true,json:async()=>({code:'Ok',routes:[{distance:100000,geometry:{type:'LineString',coordinates:route}}]})});};""")
        for r,a in enumerate(seq,1):
            waitjs("return document.querySelector('#multi-rounds .active')?.textContent==="+repr(str(r)))
            if r>1:assert 'REAÇÃO À NOTÍCIA ANTERIOR' in js("return document.getElementById('multi-panel').textContent")
            n=int(a)
            if n:
                offer=(n+1)//2;mode='road' if n%2 else 'rail'
                click('[data-tab=offers]')
                click('[data-offer="'+str(offer)+'"]')
                assert js("return document.querySelectorAll('.multi-mode').length")==2
                assert js("return document.querySelectorAll('.multi-mode.active').length")==0
                assert js("return document.getElementById('multi-buy').disabled")
                click('[data-mode="'+mode+'"]')
                waitjs("return document.querySelector('#multi-status').textContent.includes('Trecho rodoviário aprox.')")
                assert js("return !document.getElementById('multi-buy').disabled")
                if r==2:
                    click('[data-action=calc]')
                    waitjs("return document.getElementById('multi-dialog').open")
                    assert js("return document.querySelectorAll('#multi-dialog input').length")==4
                    click('#multi-dialog [data-close]')
                    driver.save_screenshot(str(OUT/f'l{level}-modal.png'))
                click('#multi-buy');click('#multi-confirm')
                waitjs("return document.getElementById('multi-buy').disabled")
                assert js("return document.getElementById('multi-discard').disabled")
            click('#multi-next')
            if not n and js("return document.getElementById('multi-dialog').open"):click('#multi-advance-confirm')
        waitjs("return !!document.querySelector('.multi-result')")
        assert 'RESULTADO SATISFATÓRIO' in js("return document.querySelector('.multi-result').textContent")
        assert '60.000 t' in js("return document.querySelector('.multi-result').textContent")
        assert 'Rodo direto' in js("return document.querySelector('.multi-result').textContent") and 'Rodo + ferro' in js("return document.querySelector('.multi-result').textContent")
        driver.save_screenshot(str(OUT/f'l{level}-resultado.png'))
        if level==2:
            assert js("return localStorage.getItem('tg_campaign_unlocked_level')")=='3'
            click('a[href="./campaign-multimodal.html?level=3"]')
        else:
            assert js("return JSON.parse(localStorage.getItem('tg_campaign_multimodal_l3_v1')).approved")
    print('OK: gates, L2→L3, four origins, real Leaflet, both modals, manual calculator, immutable purchases, 5/6 rounds, approval and progression.')
finally:
    driver.quit();server.shutdown()
