#!/usr/bin/env python3
"""E2E Chrome da interface L1 integrada ao caderno e quadro de ofertas originais.
Usado somente nas PRs; percorre 5 rodadas e verifica outros modos.
"""
import functools
import http.server
from pathlib import Path
import threading
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.common.exceptions import NoAlertPresentException

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / 'test-artifacts'
ARTIFACTS.mkdir(exist_ok=True)
handler=functools.partial(http.server.SimpleHTTPRequestHandler,directory=str(ROOT))
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),handler)
threading.Thread(target=server.serve_forever,daemon=True).start()
opt=webdriver.ChromeOptions()
for flag in ('--headless=new','--no-sandbox','--disable-dev-shm-usage','--window-size=1600,960'):
    opt.add_argument(flag)
opt.set_capability('goog:loggingPrefs',{'browser':'ALL'})
driver=webdriver.Chrome(options=opt)
wait=WebDriverWait(driver,25)
def js(x): return driver.execute_script(x)
def click(css):
    return js(f"""const el=document.querySelector({css!r}); if(!el) throw Error('Botão não encontrado: {css}'); el.click();""")
def quiet_guide():
    js("""state.guideSeen.campaign_exw=true;
        state.guideSeen.campaign_home=true;
        state.guideSeen.r1_exw_first_offer=true;
        state.guideOverlayOpen=false;state.guideFlow=null;
        if(document.querySelector('.guideBlocker'))renderStage();""")
    wait.until(lambda d:not d.find_elements(By.CSS_SELECTOR,'.guideBlocker'))
def screen_ready():
    wait.until(lambda d:len(d.find_elements(By.ID,'l1wb-panel'))==1 and len(d.find_elements(By.ID,'l1wb-offers'))==1)
    quiet_guide()
    wait.until(lambda d:len(d.find_elements(By.ID,'l1wb-panel'))==1 and len(d.find_elements(By.ID,'l1wb-offers'))==1)

def enter_l1():
    js("""initCampaignRun(1);state.campaign.introRedirectPending=false;
        state.guideSeen={campaign_exw:true,campaign_home:true,r1_exw_first_offer:true};
        state.guideOverlayOpen=false;state.guideFlow=null;""")
    wait.until(lambda d: js("return state.stage==='r1_home' && !!document.querySelector('#bgImg')?.complete"))
    js("setStage('r1_exw');")
    screen_ready()

try:
    driver.get(f'http://127.0.0.1:{server.server_address[1]}/')
    wait.until(lambda d:js("return typeof initCampaignRun==='function' && !!getCampaignLevel(1)?.scenario"))
    enter_l1()
    # O cenário original deve estar integralmente visível, com os controles alinhados.
    info=js("""return (()=>{
      const c=document.getElementById('l1wb-panel'), l=document.getElementById('l1wb-offers');
      const map=document.querySelector('img[src*="r1_exw_campaign_dynamic"]');
      return {note:[c.offsetLeft,c.offsetTop,c.offsetWidth,c.offsetHeight],
              list:[l.offsetLeft,l.offsetTop,l.offsetWidth,l.offsetHeight],
              noteBg:getComputedStyle(c).backgroundColor,listBg:getComputedStyle(l).backgroundColor,
              originalImage:!!map,shields:document.querySelectorAll('.l1wb-legacy-shield,.l1wb-sideguide').length};
    })();""")
    assert info['note']==[230,648,467,265],info
    assert info['list']==[1472,370,356,504],info
    assert info['noteBg']=='rgba(0, 0, 0, 0)' and info['listBg']=='rgba(0, 0, 0, 0)',info
    assert info['shields']==0 and info['originalImage'],info
    assert len(driver.find_elements(By.CSS_SELECTOR,'#l1wb-offers .l1wb-offer'))==4
    assert not driver.find_elements(By.ID,'l1wb-dialog')  # nenhuma camada aberta na chegada
    driver.save_screenshot(str(ARTIFACTS/'01-layout-original-integrado.png'))
    click('#l1wb-panel [data-l1-tab="offers"]')
    click('#l1wb-offers .l1wb-offer:nth-of-type(3)')
    screen_ready()
    assert 'Rio Verde' in driver.find_element(By.ID,'l1wb-panel').text
    driver.save_screenshot(str(ARTIFACTS/'02-oferta-selecionada.png'))
    click('#l1wb-panel [data-l1-action="calculator"]')
    wait.until(lambda d:len(d.find_elements(By.ID,'l1wb-dialog'))==1)
    modal=driver.find_element(By.ID,'l1wb-dialog').text
    assert 'Custo CFR equivalente' in modal and 'Frete rodoviário' in modal
    driver.save_screenshot(str(ARTIFACTS/'03-calculadora-sob-demanda.png'))
    click('#l1wb-dialog [data-l1-action="close"]')
    wait.until(lambda d:len(d.find_elements(By.ID,'l1wb-dialog'))==0)
    click('#l1wb-panel [data-l1-action="focus"]')
    wait.until(lambda d:len(d.find_elements(By.ID,'l1wb-dialog'))==1)
    driver.save_screenshot(str(ARTIFACTS/'04-leitura-opcional.png'))
    click('#l1wb-dialog [data-l1-action="close"]')
    wait.until(lambda d:len(d.find_elements(By.ID,'l1wb-dialog'))==0)
    # Compra acontece com o COMPRAR original do caderno, não botão desenhado sobre ele.
    click('[data-l1-hot="confirm"]')
    wait.until(lambda d:len(d.find_elements(By.ID,'campaignAdvanceModal'))==1)
    assert js('return Number(state.confirmed.exw[1]?.volume_t||0)')>0
    assert 'Basis do lote' in driver.find_element(By.ID,'campaignAdvanceModal').text
    driver.save_screenshot(str(ARTIFACTS/'05-feedback-rodada.png'))
    js('closeCampaignAdvanceModal();')
    click('#l1wb-panel [data-l1-tab="book"]')
    assert 'Margem bruta' in driver.find_element(By.ID,'l1wb-panel').text
    for rnd in range(2,6):
        js('nextRound();')
        screen_ready()
        assert js('return state.round')==rnd
        assert not driver.find_elements(By.ID,'l1wb-dialog')
        click('#l1wb-offers .l1wb-offer:nth-of-type(3)')
        screen_ready()
        if js('return calculateCampaignBookSnapshot().missingT<=0'):
            continue
        click('[data-l1-hot="confirm"]')
        try: driver.switch_to.alert.accept()
        except NoAlertPresentException: pass
        wait.until(lambda d:len(d.find_elements(By.ID,'campaignAdvanceModal'))==1)
        js('closeCampaignAdvanceModal();')
    js('nextRound();')
    wait.until(lambda d:js("return state.stage==='campaign_result'"))
    assert js('return buildCampaignLevel1Result().approved') is True
    assert js('return buildCampaignLevel1Result().scorecard.total')>=70
    assert driver.find_elements(By.CSS_SELECTOR,'.l1-scorecard')
    driver.save_screenshot(str(ARTIFACTS/'06-resultado-final.png'))
    # Iniciante/Expert não recebem nenhuma nova interface do L1.
    for mode in ('guided','expert'):
        js(f"state.primaryMode='scenarios';state.gameMode='{mode}';state.campaign.active=false;state.round=1;state.guideOverlayOpen=false;state.guideFlow=null;setStage('r1_exw');")
        wait.until(lambda d:len(d.find_elements(By.ID,'overlayLayer'))==1)
        assert not driver.find_elements(By.ID,'l1wb-panel')
        assert not driver.find_elements(By.ID,'l1wb-offers')
        driver.save_screenshot(str(ARTIFACTS/f'07-{mode}-inalterado.png'))
    # Mobile: o jogo não exibe sobreposição de leitura por padrão.
    driver.set_window_size(430,900)
    enter_l1()
    assert not driver.find_elements(By.ID,'l1wb-dialog')
    driver.save_screenshot(str(ARTIFACTS/'08-mobile-sem-modal-automatico.png'))
    errors=[e for e in driver.get_log('browser') if e.get('level')=='SEVERE'
            and 'favicon' not in e.get('message','')
            and '/assets/audio/r1_home.mp3' not in e.get('message','')]
    assert not errors,errors
    print('OK: original intacto, caderno+tabela integrados, calculadora opcional, 5 rodadas, score e dois modos preservados.')
finally:
    driver.quit()
    server.shutdown()