#!/usr/bin/env python3
"""Smoke test real do cockpit L1 em Chrome; executado apenas na PR."""
import functools
import http.server
from pathlib import Path
import threading
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.common.exceptions import NoAlertPresentException

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / "test-artifacts"
ARTIFACTS.mkdir(exist_ok=True)
handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
options = webdriver.ChromeOptions()
options.add_argument("--headless=new")
options.add_argument("--no-sandbox")
options.add_argument("--disable-dev-shm-usage")
options.add_argument("--window-size=1600,960")
options.set_capability("goog:loggingPrefs", {"browser": "ALL"})
driver = webdriver.Chrome(options=options)
wait = WebDriverWait(driver, 25)

def js(src):
    return driver.execute_script(src)

def guide_off():
    # O guia é uma camada de interação real. Para testar as abas, encerramos
    # seu fluxo e reconstruímos o canvas, removendo também o blocker do DOM.
    js("""state.guideSeen.campaign_exw=true;
          state.guideSeen.campaign_home=true;
          state.guideSeen.r1_exw_first_offer=true;
          state.guideOverlayOpen=false;state.guideFlow=null;
          if(document.querySelector('.guideBlocker')) renderStage();""")
    wait.until(lambda d: len(d.find_elements(By.CSS_SELECTOR, ".guideBlocker")) == 0)

def at_panel():
    try:
        wait.until(lambda d: len(d.find_elements(By.ID, "l1wb-panel")) == 1)
    except Exception:
        print("DIAGNOSTICO L1:", js("return JSON.stringify({stage:state.stage,campaign:state.campaign,guide:state.guideOverlayOpen,screen:document.getElementById('screen')?.innerText?.slice(0,250)})"))
        print("BROWSER ERRORS:", driver.get_log("browser")[-15:])
        driver.save_screenshot(str(ARTIFACTS/"erro-canvas.png"))
        raise
    guide_off()
    wait.until(lambda d: len(d.find_elements(By.ID, "l1wb-panel")) == 1)
    return driver.find_element(By.ID,"l1wb-panel")

try:
    driver.get(f"http://127.0.0.1:{server.server_address[1]}/")
    wait.until(lambda d: js("return typeof initCampaignRun === 'function' && !!getCampaignLevel(1).scenario;"))
    js("initCampaignRun(1); state.campaign.introRedirectPending=false;state.guideSeen={campaign_exw:true,campaign_home:true,r1_exw_first_offer:true};state.guideOverlayOpen=false; state.guideFlow=null;")
    wait.until(lambda d: js("return state.stage === 'r1_home' && !!document.querySelector('#bgImg')?.complete"))
    js("setStage('r1_exw');")
    at_panel()
    assert "1 · Mercado" in at_panel().text
    assert len(driver.find_elements(By.CSS_SELECTOR, ".l1wb-sideguide")) == 1
    assert len(driver.find_elements(By.ID,"txt_text_note")) == 0
    assert len(driver.find_elements(By.ID,"txt_text_exw_offers")) == 0
    driver.save_screenshot(str(ARTIFACTS/"01-mercado.png"))

    driver.find_element(By.CSS_SELECTOR,'#l1wb-panel [data-l1-tab="offers"]').click()
    assert len(driver.find_elements(By.CSS_SELECTOR,"#l1wb-panel .l1wb-offer")) == 4
    driver.find_elements(By.CSS_SELECTOR,"#l1wb-panel .l1wb-offer")[2].click()
    at_panel()
    driver.find_element(By.CSS_SELECTOR,'#l1wb-panel [data-l1-action="calculator"]').click()
    assert "Custo CFR equivalente" in at_panel().text
    driver.save_screenshot(str(ARTIFACTS/"02-calculadora.png"))
    driver.find_element(By.CSS_SELECTOR,'#l1wb-panel [data-l1-action="focus"]').click()
    wait.until(lambda d: len(d.find_elements(By.ID,"l1wb-dialog")) == 1)
    driver.save_screenshot(str(ARTIFACTS/"03-ampliado.png"))
    driver.find_element(By.CSS_SELECTOR,'#l1wb-dialog [data-l1-action="focus"]').click()
    assert len(driver.find_elements(By.ID,"l1wb-dialog")) == 0

    driver.find_element(By.CSS_SELECTOR,'#l1wb-panel [data-l1-action="buy"]').click()
    wait.until(lambda d: len(d.find_elements(By.ID,"campaignAdvanceModal")) == 1)
    assert js("return Number(state.confirmed.exw[1]?.volume_t||0)") > 0
    assert len(driver.find_elements(By.CSS_SELECTOR, "#campaignAdvanceModal .l1-feedback")) == 1
    assert "Basis do lote" in driver.find_element(By.ID,"campaignAdvanceModal").text
    driver.save_screenshot(str(ARTIFACTS/"04-resumo.png"))
    js("closeCampaignAdvanceModal();")
    driver.find_element(By.CSS_SELECTOR,'#l1wb-panel [data-l1-tab="book"]').click()
    assert "Margem bruta indicativa" in at_panel().text

    for round in range(2,6):
        js("nextRound();")
        at_panel()
        assert js("return state.round") == round
        wait.until(lambda d: js("return document.querySelector('#l1wb-panel [data-l1-tab=\\\"market\\\"]')?.getAttribute('aria-selected') === 'true'"))
        # Rodadas 2–5: o canvas reconstruído substitui os nós do DOM.
        # Dispare o clique no nó atual (sem reutilizar referências Selenium antigas).
        js("""document.querySelector('#l1wb-panel [data-l1-tab="offers"]').click();""")
        js("""document.querySelectorAll('#l1wb-panel .l1wb-offer')[2].click();""")
        at_panel()
        if js("return calculateCampaignBookSnapshot().missingT <= 0"):
            # Cargo completado antecipadamente: bloqueio de novas compras é correto.
            assert js("""return document.querySelector('#l1wb-panel [data-l1-action="buy"]')?.disabled === true""")
            continue
        js("""document.querySelector('#l1wb-panel [data-l1-action="buy"]').click();""")
        # Ao ultrapassar o saldo do navio, o jogo confirma uma compra parcial
        # em alerta nativo, antes de abrir o resumo da rodada.
        try:
            driver.switch_to.alert.accept()
        except NoAlertPresentException:
            pass
        wait.until(lambda d: len(d.find_elements(By.ID,"campaignAdvanceModal")) == 1)
        js("closeCampaignAdvanceModal();")
    js("nextRound();")
    wait.until(lambda d: js("return state.stage === 'campaign_result'"))
    driver.save_screenshot(str(ARTIFACTS/"05-resultado.png"))
    score = js("return buildCampaignLevel1Result().scorecard.total")
    assert 70 <= score <= 100, f"Nota inesperada: {score}"
    assert js("return buildCampaignLevel1Result().approved") is True
    assert js("return readCampaignL1Record()?.bestScore") >= score
    assert js("return getCampaignUnlockedLevel()") >= 2
    assert len(driver.find_elements(By.CSS_SELECTOR, ".l1-scorecard")) == 1
    js("backToCampaignMenu()")
    wait.until(lambda d: len(d.find_elements(By.ID, "campaignLevelsContainer")) == 1)
    assert "Desbloqueado" in driver.find_element(By.ID,"campaignLevelsContainer").text
    driver.save_screenshot(str(ARTIFACTS/"05b-menu-progresso.png"))

    for mode in ("guided","expert"):
        js(f"state.primaryMode='scenarios';state.gameMode='{mode}';state.campaign.active=false;state.round=1;state.guideSeen={{r1_exw:true}};state.guideOverlayOpen=false;setStage('r1_exw');")
        wait.until(lambda d: len(d.find_elements(By.ID, "overlayLayer")) == 1)
        assert len(driver.find_elements(By.ID,"l1wb-panel")) == 0
        driver.save_screenshot(str(ARTIFACTS/f"06-{mode}.png"))
    # A interface original usa canvas escalado. Em celular, o L1 abre o
    # painel independente em modo foco para preservar leitura e cliques.
    driver.set_window_size(430, 900)
    js("initCampaignRun(1);state.campaign.introRedirectPending=false;state.guideSeen={campaign_exw:true,campaign_home:true,r1_exw_first_offer:true};state.guideOverlayOpen=false;state.guideFlow=null;")
    wait.until(lambda d: js("return state.stage === 'r1_home' && !!document.querySelector('#bgImg')?.complete"))
    js("setStage('r1_exw');")
    wait.until(lambda d: len(d.find_elements(By.ID, "l1wb-dialog")) == 1)
    assert js("return state.campaign.l1Focus") is True
    driver.save_screenshot(str(ARTIFACTS/"07-mobile-foco.png"))
    # Testa retorno ao layout convencional sem modificar os modos de cenários.
    js("state.campaign.l1Focus=false;document.querySelector('#l1wb-dialog')?.remove();")

    # Áudio legado ausente na base original: não faz parte do escopo L1.
    # Continuamos reprovando qualquer erro JavaScript novo ou recurso essencial 404.
    errors = [e for e in driver.get_log("browser") if e.get("level") == "SEVERE"
              and "favicon" not in e.get("message","")
              and "/assets/audio/r1_home.mp3" not in e.get("message","")]
    assert not errors, errors
    print("OK: Chrome real; cinco rodadas, seleção, calculadora, modal de resultado e isolamento Iniciante/Expert.")
finally:
    driver.quit()
    server.shutdown()
