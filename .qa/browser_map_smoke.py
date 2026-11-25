#!/usr/bin/env python3
"""Smoke do Level 1 no mapa real, exercitando hotspots e engine canônicos."""
import functools
import http.server
import threading
from pathlib import Path
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.common.exceptions import NoAlertPresentException, UnexpectedAlertPresentException

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'test-artifacts'
OUT.mkdir(exist_ok=True)
handler=functools.partial(http.server.SimpleHTTPRequestHandler,directory=str(ROOT))
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),handler)
threading.Thread(target=server.serve_forever,daemon=True).start()
options=webdriver.ChromeOptions()
for flag in ('--headless=new','--no-sandbox','--disable-dev-shm-usage','--window-size=1550,980'):
    options.add_argument(flag)
options.set_capability('goog:loggingPrefs', {'browser':'ALL'})
driver=webdriver.Chrome(options=options)
wait=WebDriverWait(driver,40)
def js(s):return driver.execute_script(s)
def click(css):return js("var e=document.querySelector("+repr(css)+");if(!e)throw new Error('missing "+css+"');e.click();")
def close_alert():
    try:driver.switch_to.alert.accept()
    except NoAlertPresentException:pass

try:
    driver.get('http://127.0.0.1:%s/'%server.server_address[1])
    wait.until(lambda d:js("return typeof initCampaignRun==='function' && !!getCampaignLevel(1)?.scenario"))
    js("""initCampaignRun(1);
      state.campaign.introRedirectPending=false;
      state.guideSeen={campaign_exw:true,campaign_home:true,r1_exw_first_offer:true};
      state.guideOverlayOpen=false;state.guideFlow=null;
      setStage('r1_exw');""")
    wait.until(lambda d:len(d.find_elements(By.ID,'campaign-l1-realmap'))==1)
    wait.until(lambda d:js("return typeof window.CampaignL1Map?.selectOffer==='function'"))
    wait.until(lambda d:len(d.find_elements(By.CSS_SELECTOR,'#l1m-panel'))==1)
    assert 'LEVEL 1' in driver.find_element(By.ID,'campaign-l1-realmap').text
    assert 'China reduz' in driver.find_element(By.ID,'l1m-news').text
    assert 'Esri' in js("return window.CampaignL1Map.mount.toString()") or (
        'Esri' in Path(ROOT/'campaign-level1-map.js').read_text())
    click('[data-l1m-tab="offers"]')
    assert len(driver.find_elements(By.CSS_SELECTOR,'#l1m-panel .l1m-offer'))==4
    # Keep routing deterministic in CI: a mock OSRM shape checks the visual
    # auto-routing flow; the real public OSRM endpoint remains unchanged in production.
    wait.until(lambda d:js("return !!window.L && document.querySelectorAll('#l1m-map .l1m-money-pin').length===4"))
    assert js("return [...document.scripts].some(s=>s.src.includes('/vendor/leaflet/leaflet.js'))"), 'Leaflet must load from local vendor'
    assert js("return document.querySelector('#l1m-map').clientWidth>100 && document.querySelector('#l1m-map').clientHeight>100")
    assert js("return !!document.querySelector('#l1m-map .leaflet-control-zoom')"), 'Zoom controls missing'
    assert js("return [...document.styleSheets].some(s=>s.href?.includes('/vendor/leaflet/leaflet.css'))"), 'Local Leaflet CSS missing'
    # Actual raster tiles, not merely existence of the Leaflet DOM. A network
    # failure must be explicitly visible rather than leaving a silent blank map.
    wait.until(lambda d:js("return [...document.querySelectorAll('#l1m-map img.leaflet-tile')].some(i=>i.complete && i.naturalWidth>0) || document.querySelector('#l1m-health')?.dataset.state==='error'"))
    assert js("return [...document.querySelectorAll('#l1m-map img.leaflet-tile')].some(i=>i.complete && i.naturalWidth>0)"), 'Esri tiles failed to load in CI'
    assert js("return document.querySelector('#l1m-health').hidden"), 'Map loading notice should clear after actual tiles'
    driver.save_screenshot(str(OUT/'l1-map-cartografia-renderizada.png'))
    js("""window.__l1OsrmCalls=[];
        const realFetch=window.fetch.bind(window);
        window.fetch=(url, opts)=>{
          const address=String(url);
          if(!address.startsWith('https://router.project-osrm.org/route/v1/driving/'))return realFetch(url,opts);
          window.__l1OsrmCalls.push(address);
          const matches=address.match(/driving\\/([^;]+);([^?]+)/);
          if(!matches)throw Error('URL de rota incorreta '+address);
          const start=matches[1].split(',').map(Number),end=matches[2].split(',').map(Number);
          const middle=[(start[0]+end[0])/2+1.3,(start[1]+end[1])/2-.7];
          return Promise.resolve({ok:true,json:async()=>({code:'Ok',routes:[{
            distance:1234000,geometry:{type:'LineString',coordinates:[start,middle,end]}
          }]})});
        };""")
    # First test the real marker click, not only the sidebar.
    click('#l1m-map .l1m-money-pin')
    wait.until(lambda d:js("return Number(state.choices?.exw?.[1]?.id)===1"))
    wait.until(lambda d:js("return document.querySelector('#l1m-status')?.textContent?.includes('Rota rodoviária')"))
    assert js("return window.__l1OsrmCalls.length")==1
    assert len(driver.find_elements(By.CSS_SELECTOR,'#l1m-map .leaflet-interactive'))>=1
    # A second selection must replace the previous segment, not stack routes.
    click('#l1m-panel .l1m-offer:nth-of-type(3)')
    wait.until(lambda d:js("return Number(state.choices?.exw?.[1]?.id)===3"))
    wait.until(lambda d:js("return window.__l1OsrmCalls.length===2"))
    wait.until(lambda d:js("return document.querySelector('#l1m-status')?.textContent?.includes('Rota rodoviária')"))
    driver.save_screenshot(str(OUT/'l1-map-rota-automatica.png'))
    for rd in range(1,6):
        wait.until(lambda d:js("return state.round")==rd)
        wait.until(lambda d:len(d.find_elements(By.CSS_SELECTOR,'#l1m-panel'))==1)
        click('#l1m-tabs [data-l1m-tab="offers"]')
        expected=['Sorriso','Primavera do Leste','Mineiros','Jataí','Sinop'][rd-1]
        wait.until(lambda d:js("return document.querySelectorAll('#l1m-map .l1m-money-pin').length===4"))
        assert expected in js("return document.querySelectorAll('#l1m-panel .l1m-offer')[1].textContent")
        if rd==4:
            assert js("return [...document.querySelectorAll('#l1m-map .l1m-money-name')].map(x=>x.textContent).includes('Jataí') && [...document.querySelectorAll('#l1m-map .l1m-money-name')].map(x=>x.textContent).includes('Rio Verde')")
        click('#l1m-panel .l1m-offer:nth-of-type(2)')
        wait.until(lambda d:js("return Number(state.choices?.exw?.[state.round]?.id)===2"))
        wait.until(lambda d:js("return document.querySelector('#l1m-status')?.textContent?.includes('Rota rodoviária')"))
        click('[data-l1m-action="discard"]')
        if rd<=5:
            pick=[3,2,1,4,1][rd-1]
            click(f'#l1m-panel .l1m-offer:nth-of-type({pick})')
            wait.until(lambda d:js(f"return Number(state.choices?.exw?.[state.round]?.id)==={pick}"))
            if rd==1:
                assert 'Basis CFR equivalente' in driver.find_element(By.ID,'l1m-panel').text
                click('[data-l1m-action="calculator"]')
                wait.until(lambda d:len(d.find_elements(By.ID,'l1m-calc-backdrop'))==1)
                assert 'Exemplo resolvido' in driver.find_element(By.ID,'l1m-calc-backdrop').text
                click('#l1m-calc-backdrop [data-l1-action="close"]')
            else:
                assert 'Basis CFR equivalente' not in driver.find_element(By.ID,'l1m-panel').text
                click('[data-l1m-action="calculator"]')
                wait.until(lambda d:len(d.find_elements(By.ID,'l1m-calc-backdrop'))==1)
                assert 'Digite o resultado' in js("return document.querySelector('#l1m-calc-backdrop')?.innerHTML") or \
                    len(driver.find_elements(By.CSS_SELECTOR,'#l1m-calc-backdrop input[data-l1-answer]'))==4
                click('#l1m-calc-backdrop [data-l1-action="close"]')
            try:click('#l1m-buy')
            except UnexpectedAlertPresentException:pass
            close_alert()
            wait.until(lambda d:js("return !!state.confirmed.exw[state.round]"))
            wait.until(lambda d:len(d.find_elements(By.ID,'campaignAdvanceModal'))==1)
            assert js("return Number(state.confirmed.exw[state.round].volume_t)")>0
            assert js("return document.querySelector('#l1m-buy').disabled")
            assert js("return document.querySelector('[data-l1m-action=discard]').disabled")
            # Engine guard: attempts to replace or discard a confirmed purchase have no effect.
            js("selectExwOfferForCurrentRound(getRoundData(state.round).offers_exw[0],getRoundData(state.round),'r1_exw')")
            assert js("return Number(state.confirmed.exw[state.round].id)")==pick
            assert js("return Number(state.choices.exw[state.round].id)")==pick
            if rd==5:
                assert js("return calculateCampaignBookSnapshot().totalUsedT")==60000
                assert js("return state.confirmed.exw[5].volume_t")==3000
        if rd==1:
            driver.save_screenshot(str(OUT/'l1-map-round1.png'))
        if rd==4:
            driver.save_screenshot(str(OUT/'l1-map-round4.png'))
        if driver.find_elements(By.ID,'campaignAdvanceModal'):
            click('#campaignAdvanceModal .btn-dark')
        else:click('#l1m-next')
    wait.until(lambda d:js("return state.stage==='campaign_result'"))
    result=js("return buildCampaignLevel1Result()")
    assert result['approved'],result
    assert result['scorecard']['total']>=70,result
    assert not driver.find_elements(By.ID,'campaign-l1-realmap')
    driver.save_screenshot(str(OUT/'l1-map-final-score.png'))
    for mode in ('guided','expert'):
        js("state.primaryMode='scenarios';state.gameMode='"+mode+"';state.campaign.active=false;state.guideOverlayOpen=false;state.guideFlow=null;setStage('r1_exw')")
        wait.until(lambda d:len(d.find_elements(By.ID,'overlayLayer'))==1)
        assert not driver.find_elements(By.ID,'campaign-l1-realmap')
    print('OK: rota automática por pin/lista, substituição da rota, compra real, 5 rodadas, score e isolamento.')
finally:
    driver.quit()
    server.shutdown()
