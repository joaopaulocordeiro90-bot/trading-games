#!/usr/bin/env python3
"""Smoke test real do cockpit L1 em Chrome; executado apenas na PR."""
import functools
import http.server
from pathlib import Path
import threading
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait

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
    wait.until(lambda d: len(d.find_elements(By.ID, "l1wb-panel")) == 1)
    guide_off()
    return driver.find_element(By.ID,"l1wb-panel")

try:
    driver.get(f"http://127.0.0.1:{server.server_address[1]}/")
    wait.until(lambda d: js("return typeof initCampaignRun === 'function' && !!getCampaignLevel(1).scenario;"))
    js("initCampaignRun(1); state.guideSeen={campaign_exw:true,campaign_home:true,r1_exw_first_offer:true};state.guideOverlayOpen=false; state.guideFlow=null;setStage('r1_exw');")
    at_panel()
    assert "1 · Mercado" in at_panel().text
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
    driver.save_screenshot(str(ARTIFACTS/"04-resumo.png"))
    js("closeCampaignAdvanceModal();")
    driver.find_element(By.CSS_SELECTOR,'#l1wb-panel [data-l1-tab="book"]').click()
    assert "Margem bruta indicativa" in at_panel().text

    for round in range(2,6):
        js("nextRound();")
        at_panel()
        assert js("return state.round") == round
        assert at_panel().find_element(By.CSS_SELECTOR,'[data-l1-tab="market"]').get_attribute("aria-selected") == "true"
        driver.find_element(By.CSS_SELECTOR,'#l1wb-panel [data-l1-tab="offers"]').click()
        driver.find_elements(By.CSS_SELECTOR, "#l1wb-panel .l1wb-offer")[2].click()
        at_panel()
        driver.find_element(By.CSS_SELECTOR,'#l1wb-panel [data-l1-action="buy"]').click()
        wait.until(lambda d: len(d.find_elements(By.ID,"campaignAdvanceModal")) == 1)
        js("closeCampaignAdvanceModal();")
    js("nextRound();")
    wait.until(lambda d: js("return state.stage === 'campaign_result'"))
    driver.save_screenshot(str(ARTIFACTS/"05-resultado.png"))

    for mode in ("guided","expert"):
        js(f"state.primaryMode='scenarios';state.gameMode='{mode}';state.campaign.active=false;state.round=1;state.guideSeen={{r1_exw:true}};state.guideOverlayOpen=false;setStage('r1_exw');")
        wait.until(lambda d: len(d.find_elements(By.ID, "overlayLayer")) == 1)
        assert len(driver.find_elements(By.ID,"l1wb-panel")) == 0
        driver.save_screenshot(str(ARTIFACTS/f"06-{mode}.png"))
    errors = [e for e in driver.get_log("browser") if e.get("level") == "SEVERE" and "favicon" not in e.get("message","")]
    assert not errors, errors
    print("OK: Chrome real; cinco rodadas, seleção, calculadora, modal de resultado e isolamento Iniciante/Expert.")
finally:
    driver.quit()
    server.shutdown()
