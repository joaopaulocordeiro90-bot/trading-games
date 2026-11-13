
function openLinkBidModal(portOrDone, maybeDone) {
  // suporte a chamadas antigas: openLinkBidModal(onDone)
  // e chamadas novas: openLinkBidModal(port, onDone)
  let port = null;
  let onDone = null;

  if (typeof portOrDone === "function") {
    onDone = portOrDone;
  } else {
    port = portOrDone || null;
    onDone = (typeof maybeDone === "function") ? maybeDone : null;
  }

  const modal = document.getElementById("linkBidModal");
  const sel = document.getElementById("linkBidSelect");
  const btnOk = document.getElementById("linkBidConfirm");
  const btnSkip = document.getElementById("linkBidSkip");

  if (!modal || !sel || !btnOk || !btnSkip) {
    console.warn("[linkBid] modal elements missing");
    if (onDone) onDone(null);
    return;
  }

  // popular dropdown com BIDs confirmados (rodadas)
  sel.innerHTML = "";
  const optNone = document.createElement("option");
  optNone.value = "";
  optNone.textContent = "(Não vincular agora)";
  sel.appendChild(optNone);

  try {
    const srcA = (state && state.confirmed && state.confirmed.china && typeof state.confirmed.china === "object") ? state.confirmed.china : {};
    const srcB = (state && state.confirmed && state.confirmed.cfr && typeof state.confirmed.cfr === "object") ? state.confirmed.cfr : {};

    // mesclar chaves (china + cfr), sem exigir status (basta existir e não estar vinculado)
    const keySet = new Set([...Object.keys(srcA), ...Object.keys(srcB)]);
    const rounds = Array.from(keySet).map(k=>parseInt(k,10)).filter(n=>Number.isFinite(n)).sort((a,b)=>a-b);

    rounds.forEach((r)=>{
      const bid = srcA[r] || srcB[r];
      if (!bid) return;
      if (bid.linkedFreightPort) return;

      const vol = bid.volume_t ?? bid.volume ?? 0;
      const basis = bid.basis_cent_bu ?? bid.basis ?? bid.basis_cents ?? "-";
      const label = bid.label || bid.name || "BID";
      const opt = document.createElement("option");
      opt.value = String(r);
      opt.textContent = `Rodada ${r}: ${label} • ${FMT_TON_SAFE(vol)} t • Basis ${basis}` + (port ? ` • Frete: ${PORT_LABEL_SAFE(port)}` : "");
      sel.appendChild(opt);
    });
  } catch (e) {
    console.warn("[linkBid] failed to build options", e);
  }

  modal.style.display = "flex";
  // Centraliza no canvas (stage)
  try { centerModalDialogToStage(modal); } catch(e) {}

  const close = (v) => {
    modal.style.display = "none";
    if (onDone) onDone(v);
  };

  btnOk.onclick = (ev) => { ev.preventDefault(); ev.stopPropagation();
    const v = sel.value ? parseInt(sel.value, 10) : null;
    close(Number.isFinite(v) ? v : null);
  };
  btnSkip.onclick = (ev) => { ev.preventDefault(); ev.stopPropagation(); close(null); };
}



function PORT_LABEL_SAFE(p){
  try {
    const s = PORT_LABEL(p);
    return (s && String(s).trim().length) ? s : (p ? String(p) : "-");
  } catch (e) {

function FMT_TON_SAFE(v){
  const n = Number(v);
  const x = Number.isFinite(n) ? n : 0;
  return x.toLocaleString('pt-BR');
}
    return (p ? String(p) : "-");
  }
}


function SAFE_PORT_LABEL_SAFE(p){
  try {
    const s = PORT_LABEL_SAFE(p);
    return (s && String(s).trim().length) ? s : (p ? String(p) : "-");
  } catch (e) {
    return (p ? String(p) : "-");
  }
}

// Trading Game - versão com telas em imagem + calibração (Home / Notícias / EXW / Frete / CFR China / Resultados)
// Coordenadas de calibração em pixels do "canvas" 1920x1080 (independente de zoom/tamanho da tela).

let gameData = null;

// Portos/corredores disponíveis (Etapa: estoque por porto)
const PORTS = [
  { key: "barcarena", label: "Barcarena" },
  { key: "itaqui", label: "Itaqui" },
  { key: "santos", label: "Santos" },
  { key: "paranagua", label: "Paranaguá" },
  { key: "riogrande", label: "Rio Grande" },
];
const PORT_LABEL = (k) => (PORTS.find(p=>p.key===k)?.label || k);




// --- helpers (safe) ---
function PORT_LABEL_SAFE(p){
  try {
    const s = PORT_LABEL(p);
    return (s && String(s).trim().length) ? s : (p ? String(p) : "-");
  } catch (e) {
    return (p ? String(p) : "-");
  }
}
function FMT_TON_SAFE(v){
  const n = Number(v);
  const x = Number.isFinite(n) ? n : 0;
  return x.toLocaleString('pt-BR');
}

// ------------------------------------------------------------
// Vínculo livre Frete ↔ BID (modal 2 passos)
// ------------------------------------------------------------
function openLinkFreteBidModal(onDone) {
  // cria modal sob demanda (não depende do HTML)
  let modal = document.getElementById("linkFreteBidModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "linkFreteBidModal";
    modal.style.cssText = [
      "position:fixed","inset:0","background:rgba(0,0,0,0.55)",
      "display:none","align-items:center","justify-content:center",
      "z-index:99999"
    ].join(";");

    const card = document.createElement("div");
    card.style.cssText = [
      "background:#fff","border-radius:12px","padding:18px 18px 14px 18px",
      "width:min(720px,92vw)","box-shadow:0 10px 30px rgba(0,0,0,0.35)",
      "font-family:Arial, Helvetica, sans-serif"
    ].join(";");

    const title = document.createElement("div");
    title.textContent = "Vincular Frete ↔ BID";
    title.style.cssText = "font-size:20px;font-weight:700;margin-bottom:10px;";

    const p1 = document.createElement("div");
    p1.textContent = "1) Selecione um frete em aberto:";
    p1.style.cssText = "font-size:14px;margin:8px 0 6px 0;";

    const selFrete = document.createElement("select");
    selFrete.id = "linkFreteSelect";
    selFrete.style.cssText = "width:100%;padding:10px;border-radius:8px;border:1px solid #ccc;font-size:14px;";

    const p2 = document.createElement("div");
    p2.textContent = "2) Selecione um BID em aberto:";
    p2.style.cssText = "font-size:14px;margin:12px 0 6px 0;";

    const selBid = document.createElement("select");
    selBid.id = "linkBid2Select";
    selBid.disabled = true;
    selBid.style.cssText = "width:100%;padding:10px;border-radius:8px;border:1px solid #ccc;font-size:14px;";

    const row = document.createElement("div");
    row.style.cssText = "display:flex;gap:10px;justify-content:flex-end;margin-top:14px;";

    const btnCancel = document.createElement("button");
    btnCancel.id = "linkFreteBidCancel";
    btnCancel.textContent = "Cancelar";
    btnCancel.style.cssText = "padding:10px 14px;border-radius:10px;border:1px solid #999;background:#fff;cursor:pointer;";

    const btnOk = document.createElement("button");
    btnOk.id = "linkFreteBidConfirm";
    btnOk.textContent = "Confirmar";
    btnOk.disabled = true;
    btnOk.style.cssText = "padding:10px 14px;border-radius:10px;border:0;background:#111;color:#fff;cursor:pointer;opacity:.6;";

    row.appendChild(btnCancel);
    row.appendChild(btnOk);

    card.appendChild(title);
    card.appendChild(p1);
    card.appendChild(selFrete);
    card.appendChild(p2);
    card.appendChild(selBid);
    card.appendChild(row);

    modal.appendChild(card);
    document.body.appendChild(modal);
  }

  const selFrete = document.getElementById("linkFreteSelect");
  const selBid = document.getElementById("linkBid2Select");
  const btnOk = document.getElementById("linkFreteBidConfirm");
  const btnCancel = document.getElementById("linkFreteBidCancel");

  const plans = (state && state.freightPlansByPort && typeof state.freightPlansByPort === "object") ? state.freightPlansByPort : {};

  const isBidConfirmed = (b) => {
    if (!b) return false;
    const s = (b.status || b.Status || "").toString().toUpperCase();
    if (!s) return true; // não bloqueia se não existir status
    return s.includes("CONFIRM");
  };

  // fretes em aberto
  const openFretes = Object.keys(plans)
    .map(p => ({ port: p, plan: plans[p] }))
    .filter(x => x.plan && !x.plan.linkedBidRound);

  if (!openFretes.length) {
    alert("Nenhum frete em aberto para vincular (todos já estão vinculados ou não há fretes).");
    if (typeof onDone === "function") onDone(null);
    return;
  }

  // popular dropdown fretes
  selFrete.innerHTML = "";
  const opt0 = document.createElement("option");
  opt0.value = "";
  opt0.textContent = "(Selecione um frete)";
  selFrete.appendChild(opt0);

  openFretes.forEach(({port, plan}) => {
    const opt = document.createElement("option");
    opt.value = port;
    const usd = (plan.usd_t ?? plan.freight_usd_t ?? "-");
    const tr = (plan.targetRound ?? plan.embarqueRound ?? "-");
    const dem = (plan.demurrageUsdPerRound ?? plan.demurrage_usd_rod ?? "-");
    opt.textContent = `Frete ${PORT_LABEL_SAFE(port)} • Embarque R${tr} • US$ ${usd}/t • Dem ${dem}/rod`;
    selFrete.appendChild(opt);
  });

  const resetBids = () => {
    selBid.innerHTML = "";
    const o = document.createElement("option");
    o.value = "";
    o.textContent = "(Selecione um BID)";
    selBid.appendChild(o);
    selBid.disabled = true;
    btnOk.disabled = true;
    btnOk.style.opacity = ".6";
  };

  const buildBidOptions = (port) => {
    resetBids();

    const srcA = (state && state.confirmed && state.confirmed.china && typeof state.confirmed.china === "object") ? state.confirmed.china : {};
    const srcB = (state && state.confirmed && state.confirmed.cfr && typeof state.confirmed.cfr === "object") ? state.confirmed.cfr : {};
    const keySet = new Set([...Object.keys(srcA), ...Object.keys(srcB)]);
    const rounds = Array.from(keySet).map(k=>parseInt(k,10)).filter(n=>Number.isFinite(n)).sort((a,b)=>a-b);

    const bidsOpen = [];
    rounds.forEach((r)=>{
      const bid = srcA[r] || srcB[r];
      if (!bid) return;
      if (!isBidConfirmed(bid)) return;
      if (bid.linkedFreightPort) return;
      bidsOpen.push({ r, bid });
    });

    bidsOpen.forEach(({r,bid})=>{
      const opt = document.createElement("option");
      opt.value = String(r);
      const vol = bid.volume_t ?? bid.volume ?? 0;
      const basis = bid.basis_cent_bu ?? bid.basis ?? bid.basis_cents ?? "-";
      const label = bid.label || bid.name || "CHINA";
      opt.textContent = `Rodada ${r}: ${label} • ${FMT_TON_SAFE(vol)} t • Basis ${basis} • Porto frete: ${PORT_LABEL_SAFE(port)}`;
      selBid.appendChild(opt);
    });

    selBid.disabled = false;
  };

  const close = (payload) => {
    modal.style.display = "none";
    if (typeof onDone === "function") onDone(payload || null);
  };

  resetBids();

  selFrete.onchange = () => {
    const port = selFrete.value || "";
    if (!port) { resetBids(); return; }
    buildBidOptions(port);
  };

  selBid.onchange = () => {
    const ok = !!(selFrete.value && selBid.value);
    btnOk.disabled = !ok;
    btnOk.style.opacity = ok ? "1" : ".6";
  };

  btnCancel.onclick = (ev) => { ev.preventDefault(); ev.stopPropagation(); close(null); };

  btnOk.onclick = (ev) => {
    ev.preventDefault(); ev.stopPropagation();
    const port = selFrete.value || "";
    const bidRound = selBid.value ? parseInt(selBid.value, 10) : null;
    if (!port || !Number.isFinite(bidRound)) { close(null); return; }

    // Atualiza os dois lados
    const plan = plans[port];
    if (plan) plan.linkedBidRound = bidRound;

    state.confirmed = state.confirmed || {};
    state.confirmed.cfr = state.confirmed.cfr || {};
    state.confirmed.china = state.confirmed.china || {};

    if (state.confirmed.cfr[bidRound]) state.confirmed.cfr[bidRound].linkedFreightPort = port;
    if (state.confirmed.china[bidRound]) state.confirmed.china[bidRound].linkedFreightPort = port;

    close({ port, bidRound });
  };

  modal.style.display = "flex";
  // Centraliza no canvas (stage)
  try { centerModalDialogToStage(modal); } catch(e) {}
}

// ----------------------
const screen = document.getElementById("screen");
const timerBox = document.getElementById("timerBox");

const BASE_W = 1920;
const BASE_H = 1080;

// ===============================
// FULLSCREEN (Tela Cheia)
// ===============================
function toggleFullscreen(){
  const el = document.getElementById("screen") || document.documentElement;

  // Se já está em fullscreen, sai
  if (document.fullscreenElement) {
    document.exitFullscreen?.();
  } else {
    // Se não está, entra
    el.requestFullscreen?.();
  }
}

// Atualiza o texto do botão quando entra/sai
document.addEventListener("fullscreenchange", () => {
  const b = document.getElementById("btnFullscreen");
  if (!b) return;
  b.textContent = document.fullscreenElement ? "Sair tela cheia" : "Tela cheia";
});

// --------------------
// Fullscreen (tela cheia)
// --------------------
function toggleFullscreen() {
  // Tela cheia precisa ser acionada por clique do usuario.
  // Colocamos o documento em fullscreen para o CSS conseguir ajustar layout.
  const root = document.documentElement;
  try {
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      root.requestFullscreen?.();
    }
  } catch (e) {
    console.warn("Fullscreen nao disponivel:", e);
  }
}

// Se o usuario sair do fullscreen por ESC, atualiza o layout
document.addEventListener("fullscreenchange", () => {
  // re-render leve: recalcula overlays/tamanho
  try { renderStage(); } catch {}
});

// --------------------
// Áudio (BGM r1_home com fade)
// --------------------
const bgmHome = new Audio("assets/audio/r1_home.mp3");
bgmHome.loop = true;
bgmHome.volume = 0; // começa mudo (a gente sobe com fade)

// Configs do fade (ajuste se quiser)
const BGM_TARGET_VOL = 0.35;   // volume final (0.0 a 1.0)
const BGM_FADE_MS = 700;       // duração do fade (ms)

let bgmFadeTimer = null;

function clearBgmFade() {
  if (bgmFadeTimer) clearInterval(bgmFadeTimer);
  bgmFadeTimer = null;
}

// Sobe o volume suavemente e garante que está tocando
function fadeInBgmHome() {
  clearBgmFade();

  // tenta dar play (browser pode bloquear se não houve clique ainda)
  bgmHome.play().catch(() => { /* ok */ });

  const steps = 20;
  const stepMs = Math.max(20, Math.floor(BGM_FADE_MS / steps));
  const startVol = bgmHome.volume;
  const delta = (BGM_TARGET_VOL - startVol) / steps;

  let i = 0;
  bgmFadeTimer = setInterval(() => {
    i++;
    const v = Math.min(BGM_TARGET_VOL, bgmHome.volume + delta);
    bgmHome.volume = Math.max(0, v);

    if (i >= steps || bgmHome.volume >= BGM_TARGET_VOL - 0.001) {
      bgmHome.volume = BGM_TARGET_VOL;
      clearBgmFade();
    }
  }, stepMs);
}

// Desce o volume suavemente e pausa no final
function fadeOutBgmHome() {
  clearBgmFade();

  const steps = 20;
  const stepMs = Math.max(20, Math.floor(BGM_FADE_MS / steps));
  const startVol = bgmHome.volume;
  const delta = startVol / steps;

  let i = 0;
  bgmFadeTimer = setInterval(() => {
    i++;
    const v = Math.max(0, bgmHome.volume - delta);
    bgmHome.volume = v;

    if (i >= steps || bgmHome.volume <= 0.001) {
      bgmHome.volume = 0;
      bgmHome.pause();
      // opcional: se quiser voltar sempre do começo ao entrar no home:
      // bgmHome.currentTime = 0;
      clearBgmFade();
    }
  }, stepMs);
}

// --------------------
// Formatação (padrão EUA)
// --------------------
const fmtUSD = (v) => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
}).format(Number(v || 0));


// --------------------
// Estado do jogo
// --------------------
const state = {
  scenarioId: 1,
  round: 0,
  stage: "home",
  prevStage: "home", // home | r1_home | r1_news | r1_exw | r1_frete | r1_cfr | results
  running: false,
  timeLeft: 0,
  interval: null,
  roundEndTs: null,
  choices: { exw: {}, ocean: {}, china: {} },
  confirmed: { exw: {}, ocean: {}, china: {} },

  // Livro de posições (carteira) para MTM
  exwPositions: [],


  // Frete + Demurrage (planejamento)
  freightPlan: null,

  // ✅ IMPORTANTE: sem isso o clique nos navios dá erro e o jogo não inicia
  settings: {
    shipCount: 1 // padrão
  },

  // ✅ UI (tela de resultados)
  ui: {
    showDetails: false
  },

  // Modos do jogo
  primaryMode: null, // "scenarios" | "campaign"
  gameMode: null, // "guided" | "expert"
  totalRounds: 0,

  // Campanha
  campaign: {
    active: false,
    levelId: null,
    introRedirectPending: false,
    unlockedLevel: 1,
    roundSplashUntil: 0
  },

  // Sistema de guia
  guideSeen: {},
  guideOverlayOpen: false,
  guideFlow: null,
  guideStep: 0
};

const MODE_RULES = {
  guided: {
    showGuide: true,
    chooseShipmentRound: false
  },
  expert: {
    showGuide: false,
    chooseShipmentRound: true
  },
  professional: {
    showGuide: false,
    chooseShipmentRound: true
  }
};

const CAMPAIGN_STORAGE_KEY = "tg_campaign_unlocked_level";
const BU_PER_TON_SOY = 36.7437;
const SACKS_PER_TON = 1000 / 60;
const CAMPAIGN_LEVELS = [
  {
    id: 1,
    code: "L1",
    name: "Originação pura",
    rounds: 5,
    scenarioId: 1,
    targetVolumeT: 60000,
    targetBasisCentBu: 110,
    fixedPort: "santos",
    fixedPortLabel: "Santos",
    fixedDestination: "N. China",
    fixedFreightUsdT: 37,
    fixedSaleBasisCentBu: 110,
    shipmentMonth: "Março",
    startStage: "r1_home",
    summary: "Book vendido CFR China e frete marítimo fixado. O foco do L1 é originar soja no interior, controlar o custo CFR equivalente e manter o basis médio dentro da meta.",
    intro: [
      "Modo Campanha iniciado. Aqui cada level simula um recorte específico da operação física, com escopo controlado e decisão direcionada.",
      "No L1, o book já possui venda CFR China para março a +110 c/bu e frete marítimo fixado em US$ 37/t na rota Santos → N. China.",
      "Com venda e frete travados, a exposição está na originação. As demais telas seguem bloqueadas; neste level o foco é comprar origem competitiva.",
      "Sua decisão é avaliar cada EXW, converter preço e logística para custo CFR equivalente e definir se o lote entra ou não no navio.",
      "São 5 rodadas para completar 60.000 t. O fechamento será medido pelo basis médio ponderado, que precisa ficar em até +110 c/bu."
],
    exwGuide: [
      "Tela de originação aberta. O mercado oferece lotes EXW por rodada; cada saco representa uma origem, preço e volume.",
      "A venda CFR e o frete marítimo já estão fixados. A variável agora é capturar soja interior com logística compatível para Santos.",
      "Compare preço em R$/sc, câmbio, CBOT e frete interno. O objetivo é estimar o custo CFR equivalente antes de confirmar a compra.",
      "Você pode comprar no máximo uma oferta por rodada. Se o lote não fecha conta, descarte ou avance; proteger o basis médio vale mais que completar volume a qualquer custo."
]
  },
  { id: 2, code: "L2", name: "Mais alternativas logísticas", summary: "Disponível quando você concluir o Level 1." },
  { id: 3, code: "L3", name: "Janelas de embarque", summary: "Disponível quando você concluir os níveis anteriores." }
];

function getCampaignUnlockedLevel() {
  try {
    const raw = parseInt(localStorage.getItem(CAMPAIGN_STORAGE_KEY) || "1", 10);
    return Number.isFinite(raw) && raw > 0 ? raw : 1;
  } catch (_) {
    return 1;
  }
}

function setCampaignUnlockedLevel(levelNum) {
  const value = Math.max(1, Number(levelNum || 1));
  state.campaign.unlockedLevel = value;
  try { localStorage.setItem(CAMPAIGN_STORAGE_KEY, String(value)); } catch (_) {}
}

function getCampaignLevel(levelId) {
  const staticLevel = CAMPAIGN_LEVELS.find(l => Number(l.id) === Number(levelId)) || CAMPAIGN_LEVELS[0];
  let dataLevel = null;
  try {
    dataLevel = getCampaignLevelData(levelId);
  } catch (_) {
    dataLevel = null;
  }
  if (!dataLevel) return staticLevel;
  const merged = { ...staticLevel, ...dataLevel };
  const levelRules = dataLevel.rules || {};
  const levelScenario = dataLevel.scenario || null;
  merged.rounds = Number(dataLevel.rounds || levelRules.rounds || levelScenario?.rounds?.length || staticLevel.rounds || 1);
  return merged;
}


const CAMPAIGN_EXW_DEFAULT_BAG = { w: 110, h: 96 };

function getCampaignOfferCalibKey(roundNum, idx) {
  // Namespace EXCLUSIVO do L1: nunca altera os hotspots dos outros modos ou levels.
  const l1Only = isCampaignMode() && Number(state.campaign?.levelId) === 1;
  const prefix = l1Only ? 'l1_bag' : 'campaign_bag';
  return `${prefix}_r${Number(roundNum || 1)}_${Number(idx || 0) + 1}`;
}

function getOfferShortLabel(offer) {
  if (!offer) return "Oferta";
  // Nome principal da oferta deve vir do campo label/nome editável.
  // Ex.: "Sapezal MT - Produtor Rodolfo" deve aparecer como "Sapezal MT" no quadro de ofertas.
  const rawLabel = String(offer.label || offer.name || offer.nome || "").trim();
  if (rawLabel) return rawLabel.split(" - ")[0].trim();
  if (offer.city && offer.uf) return `${String(offer.city).trim()} ${String(offer.uf).trim()}`.trim();
  if (offer.city) return String(offer.city).trim();
  if (offer.map_label) return String(offer.map_label).trim();
  return "Oferta";
}

function getCampaignOfferMapBox(offer, idx, roundNum = state.round) {
  const fallback = [
    { x: 1010, y: 350 }, // MT
    { x: 1215, y: 250 }, // MA
    { x: 1170, y: 470 }, // GO
    { x: 1050, y: 575 }, // MS
    { x: 1155, y: 665 }  // PR
  ][idx] || { x: 960 + idx * 100, y: 420 };

  const dataBox = {
    x: Number.isFinite(Number(offer?.map_x)) ? Number(offer.map_x) : fallback.x,
    y: Number.isFinite(Number(offer?.map_y)) ? Number(offer.map_y) : fallback.y,
    w: Number(offer?.map_w || CAMPAIGN_EXW_DEFAULT_BAG.w),
    h: Number(offer?.map_h || CAMPAIGN_EXW_DEFAULT_BAG.h)
  };

  // No modo campanha, cada saco de soja é calibrável por rodada e por oferta.
  // Ex.: campaign_bag_r1_1, campaign_bag_r1_2 ... campaign_bag_r5_5.
  // Isso permite alterar posição e tamanho de cada botão visual sem mudar o código.
  try {
    const sc = getScreenCalib('r1_exw');
    const key = getCampaignOfferCalibKey(roundNum, idx);
    if (sc && sc[key]) return sc[key];
  } catch (_) {}

  return dataBox;
}

function selectExwOfferForCurrentRound(offer, rd, screenId = "r1_exw") {
  if (!offer) return;
  const draft = { ...offer, ref_cbot_cent_bu: rd.cbot_cent_bu, ref_cambio: rd.usd };
  if (isCampaignMode()) {
    const fixedKey = getCampaignLevel(state.campaign.levelId || 1).fixedPort || 'santos';
    const inlandMap = getExwInlandByCorridor(draft);
    draft.corredor = fixedKey;
    draft.inland_usd_t_selected = Number(inlandMap?.[fixedKey] || draft.inland_usd_t || draft.freight_inland_usd_t || 0);
    // Ao selecionar pelo mapa, também abre a etapa Ofertas do L1 para dar feedback imediato.
    if (isCampaignLevel1Exw(screenId)) {
      state.campaign.l1Tab = 'offers';
      state.campaign.l1CalcVisible = false;
    }
  }
  state.choices.exw[state.round] = draft;
  renderOverlaysForScreen(screenId, rd);
  setTimerText();
  // O L1 possui guia próprio; não reabre o tutorial genérico de escolha de corredor.
  if (!isCampaignLevel1Exw(screenId)) triggerGuideEvent("r1_exw_first_offer");
}


function getCampaignGuideContent(kind = "home") {
  const level = getCampaignLevel(state.campaign.levelId || 1);
  if (kind === "home") return Array.isArray(level.intro) ? level.intro : [];
  if (kind === "exw") return Array.isArray(level.exwGuide) ? level.exwGuide : [];
  return [];
}

function getGuideFlowContent(flowKey) {
  if (flowKey === "campaign_home") return getCampaignGuideContent("home");
  if (flowKey === "campaign_exw") return getCampaignGuideContent("exw");
  return GUIDE_CONTENT[flowKey] || [];
}

function isCampaignMode() {
  return !!(state.campaign && state.campaign.active);
}

function isCampaignLevelUnlocked(levelId) {
  return Number(levelId || 0) <= Number(state.campaign.unlockedLevel || 1);
}

function unlockNextCampaignLevel(currentLevelId) {
  const next = Number(currentLevelId || 0) + 1;
  if (next > Number(state.campaign.unlockedLevel || 1)) setCampaignUnlockedLevel(next);
}

function initCampaignRun(levelId = 1) {
  const level = getCampaignLevel(levelId);
  resetGameStateForNewRun();
  state.primaryMode = "campaign";
  state.gameMode = "guided";
  state.campaign.active = true;
  state.campaign.levelId = level.id;
  state.campaign.introRedirectPending = true;
  state.campaign.roundSplashUntil = 0;
  state.totalRounds = level.rounds;
  state.round = 1;
  state.scenarioId = level.scenarioId || 1;
  state.guideSeen = {};
  state.guideOverlayOpen = false;
  state.guideFlow = null;
  state.guideStep = 0;
  if (Number(level.id) === 1) {
    state.campaign.l1Tab = 'market';
    state.campaign.l1CalcVisible = false;
    state.campaign.l1Exercises = {};
    state.campaign.l1Focus = false; // Não encobrir a arte original ao avançar rodada
  }
  state.settings.shipCount = 1;
  state.timeLeft = 0;
  stopTimer();
  setStage(level.startStage || "r1_home");
}

function exitCampaignFlow() {
  state.campaign.active = false;
  state.campaign.levelId = null;
  state.campaign.introRedirectPending = false;
  state.campaign.roundSplashUntil = 0;
  state.totalRounds = 0;
}

function getCampaignContextLabel() {
  const level = getCampaignLevel(state.campaign.levelId || 1);
  if (Number(state.campaign?.levelId) === 1) {
    return `Soja CFR China • Navio de ${formatTon(level.targetVolumeT)} t • Porto Santos definido • Venda +${level.fixedSaleBasisCentBu} ¢/bu • Frete marítimo US$ ${level.fixedFreightUsdT}/t`;
  }
  return `Venda: 1 cargo soja CFR China • Embarque ${level.shipmentMonth} • Venda ${level.fixedSaleBasisCentBu} ¢/bu • Frete marítimo US$ ${level.fixedFreightUsdT}/t • ${level.fixedPortLabel} → ${level.fixedDestination}`;
}

function campaignWeightedAverage(entries, valueKey, volumeKey = 'usedVolumeT') {
  let sumV = 0;
  let sum = 0;
  (entries || []).forEach(entry => {
    const v = Number(entry?.[volumeKey] || 0);
    const x = Number(entry?.[valueKey] || 0);
    if (v <= 0 || !Number.isFinite(x)) return;
    sumV += v;
    sum += x * v;
  });
  return sumV > 0 ? sum / sumV : 0;
}

function getCampaignRoundHistory() {
  const level = getCampaignLevel(state.campaign.levelId || 1);
  const lines = [];
  for (let r = 1; r <= level.rounds; r++) {
    const exw = state.confirmed?.exw?.[r];
    if (!exw) {
      lines.push(`Rodada ${r}: nenhuma compra confirmada`);
      continue;
    }
    const origin = formatOfferDisplayName(exw) || `Oferta ${r}`;
    const volume = Number(exw.volume_t || exw.volume || 0);
    const price = Number(exw.price_brl_saca || 0);
    lines.push(`Rodada ${r}: comprou ${origin} — ${formatTon(volume)} t — R$ ${price.toFixed(1)}/sc`);
  }
  return lines;
}


function formatCampaignSigned(value, digits = 1, suffix = '') {
  const n = Number(value || 0);
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(digits)}${suffix}`;
}

function formatCampaignUsd(value, digits = 0) {
  const n = Number(value || 0);
  const sign = n > 0 ? '+' : n < 0 ? '-' : '';
  const abs = Math.abs(n);
  return `${sign}US$ ${abs.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

function centsBuToUsdT(centsBu) {
  return (Number(centsBu || 0) / 100) * BU_PER_TON_SOY;
}

function calculateCampaignOfferBasisSnapshot(offer, roundNum = state.round) {
  const level = getCampaignLevel(state.campaign?.levelId || 1);
  const rd = getRoundData(roundNum) || {};
  const exw = offer || {};
  const volumeT = Number(exw.volume_t || exw.volume || 0);
  const priceBrlSc = Number(exw.price_brl_saca || 0);
  const fx = Number(exw.ref_cambio || rd.usd || 0);
  const cbotCentBu = Number(exw.ref_cbot_cent_bu || rd.cbot_cent_bu || 0);
  const inlandMap = getExwInlandByCorridor(exw);
  const fixedKey = level.fixedPort || 'santos';
  const inlandUsdT = Number(exw.inland_usd_t_selected ?? inlandMap?.[fixedKey] ?? exw.inland_usd_t ?? exw.freight_inland_usd_t ?? 0);
  const interiorUsdT = fx > 0 ? (priceBrlSc * SACKS_PER_TON) / fx : 0;
  const maritimeUsdT = Number(level.fixedFreightUsdT || 0);
  // L1 pedagógico: fobbing explícito da base BRZ. Não alteramos os demais modos/níveis.
  const fobbingUsdT = Number(state.campaign?.levelId) === 1 ? Number(level.fixedFobbingUsdT || 0) : 0;
  const interiorCentBu = (interiorUsdT / BU_PER_TON_SOY) * 100;
  const inlandCentBu = (inlandUsdT / BU_PER_TON_SOY) * 100;
  const maritimeCentBu = (maritimeUsdT / BU_PER_TON_SOY) * 100;
  const fobbingCentBu = (fobbingUsdT / BU_PER_TON_SOY) * 100;
  const cfrCostCentBu = interiorCentBu + inlandCentBu + fobbingCentBu + maritimeCentBu;
  const basisCentBu = cfrCostCentBu - cbotCentBu;
  const saleBasisCentBu = Number(level.fixedSaleBasisCentBu ?? level.targetBasisCentBu ?? 0);
  const marginCentBu = saleBasisCentBu - basisCentBu;
  const pnlUsdT = centsBuToUsdT(marginCentBu);
  const pnlUsd = pnlUsdT * volumeT;
  return {
    level,
    round: roundNum,
    origin: formatOfferDisplayName(exw) || `Oferta ${roundNum}`,
    volumeT,
    priceBrlSc,
    fx,
    cbotCentBu,
    inlandUsdT,
    maritimeUsdT,
    fobbingUsdT,
    interiorCentBu,
    inlandCentBu,
    maritimeCentBu,
    fobbingCentBu,
    cfrCostCentBu,
    basisCentBu,
    saleBasisCentBu,
    marginCentBu,
    pnlUsdT,
    pnlUsd
  };
}

function getCampaignUsedLotsWithPnl(extraOffer = null, extraRound = state.round) {
  const level = getCampaignLevel(state.campaign?.levelId || 1);
  const lots = [];
  for (let r = 1; r <= Number(level.rounds || 1); r++) {
    const exw = state.confirmed?.exw?.[r];
    if (exw) lots.push(calculateCampaignOfferBasisSnapshot(exw, r));
  }
  if (extraOffer) lots.push(calculateCampaignOfferBasisSnapshot(extraOffer, extraRound));
  let remaining = Number(level.targetVolumeT || 60000);
  return lots.map(lot => {
    const usedVolumeT = Math.max(0, Math.min(remaining, Number(lot.volumeT || 0)));
    remaining -= usedVolumeT;
    return {
      ...lot,
      usedVolumeT,
      pnlUsedUsd: centsBuToUsdT(lot.marginCentBu) * usedVolumeT
    };
  }).filter(lot => lot.usedVolumeT > 0);
}

function calculateCampaignBookSnapshot(extraOffer = null) {
  const level = getCampaignLevel(state.campaign?.levelId || 1);
  const usedLots = getCampaignUsedLotsWithPnl(extraOffer, state.round);
  const totalUsedT = usedLots.reduce((acc, lot) => acc + Number(lot.usedVolumeT || 0), 0);
  const missingT = Math.max(0, Number(level.targetVolumeT || 0) - totalUsedT);
  const basisAvg = campaignWeightedAverage(usedLots, 'basisCentBu');
  const pnlUsd = usedLots.reduce((acc, lot) => acc + Number(lot.pnlUsedUsd || 0), 0);
  const pnlUsdT = totalUsedT > 0 ? pnlUsd / totalUsedT : 0;
  const saleBasisCentBu = Number(level.fixedSaleBasisCentBu ?? level.targetBasisCentBu ?? 0);
  const mtmCentBu = saleBasisCentBu - basisAvg;
  return { level, usedLots, totalUsedT, missingT, basisAvg, pnlUsd, pnlUsdT, saleBasisCentBu, mtmCentBu };
}

/* ============================================================================
   CAMPANHA L1 — INTERFACE INTEGRADA AO CADERNO + QUADRO ORIGINAL
   Restitui integralmente a imagem do mapa, caderno, quadro de ofertas, sacas e
   hotspots originais. Calculadora/detalhes só abrem por escolha do jogador.
   Esta seção só é utilizada no Modo Campanha / Level 1 / tela r1_exw.
   ============================================================================ */
function isCampaignLevel1Exw(screenId='r1_exw') {
  return screenId === 'r1_exw' && isCampaignMode() && Number(state.campaign?.levelId) === 1;
}

function ensureCampaignL1WorkbenchStyle() {
  if (document.getElementById('campaign-l1-workbench-style')) return;
  const el = document.createElement('style');
  el.id = 'campaign-l1-workbench-style';
  el.textContent = `
  /* Caderno original: apenas textos e botões dentro da folha, sem cartão extra. */
  .l1wb,.l1wb *,.l1wb-list,.l1wb-list *{box-sizing:border-box}
  .l1wb{position:absolute;left:230px;top:648px;width:467px;height:265px;z-index:19;
    padding:0;background:transparent;border:0;box-shadow:none;overflow:hidden;
    font:16px/1.26 system-ui,-apple-system,Segoe UI,Arial,sans-serif;color:#172533;
    display:flex;flex-direction:column;gap:5px;pointer-events:auto}
  .l1wb-head{display:flex;align-items:center;justify-content:space-between;gap:6px;min-height:25px}
  .l1wb-head strong{font-size:17px;letter-spacing:-.01em;color:#57351b}
  .l1wb-head small{font-size:13px;font-weight:800;color:#436156}
  .l1wb-tabs{display:flex;gap:4px;align-items:center;min-height:33px}
  .l1wb-btn{border:1px solid #d5bfa1;background:#fffaf1;border-radius:8px;padding:5px 9px;
    font:800 13px/1.2 system-ui,Arial,sans-serif;cursor:pointer;color:#493b29}
  .l1wb-btn:hover{background:#f3e5cd}
  .l1wb-btn[aria-selected=true]{background:#d46b1d;color:white;border-color:#ad5115}
  .l1wb-btn-primary{color:#fff;background:#167449;border-color:#167449}
  .l1wb-btn-primary:hover{background:#075b34}
  .l1wb-btn:disabled{opacity:.45;cursor:not-allowed}
  .l1wb-content{flex:1;min-height:0;overflow:auto;scrollbar-width:thin;padding-right:4px}
  .l1wb-label{font:900 12px/1.3 system-ui,Arial,sans-serif;text-transform:uppercase;letter-spacing:.055em;color:#9a541b}
  .l1wb-content h3{font-size:17px;line-height:1.22;margin:5px 0;color:#233329}
  .l1wb-content p{font-size:14px;line-height:1.3;margin:5px 0;color:#44423b}
  .l1wb-content strong{color:#163c33}
  .l1wb-actions{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:7px}
  .l1wb-mini{background:rgba(254,247,232,.9);border:1px solid #e8d3ab;border-radius:8px;padding:6px 8px;margin-top:5px}
  .l1wb-mini p{margin:2px 0}
  .l1wb-foot{font:11px/1.2 system-ui,Arial,sans-serif;color:#826c58;min-height:14px}
  /* Quadro OFERTAS EXW é parte da imagem; cards ocupam apenas seu interior. */
  .l1wb-list{position:absolute;left:1472px;top:370px;width:356px;height:504px;z-index:18;
    background:transparent;border:0;overflow-y:auto;scrollbar-width:thin;pointer-events:auto;
    display:flex;flex-direction:column;gap:8px;padding:1px 3px}
  .l1wb-list-heading{margin:0 2px 1px;color:#655140;font:800 13px/1.3 system-ui,Arial,sans-serif;text-align:center}
  .l1wb-offer{width:100%;min-height:94px;text-align:left;border:1.5px solid #d9cbb6;border-radius:11px;
    background:#fdfbf5;color:#17252b;padding:10px 12px;cursor:pointer;
    display:flex;flex-direction:column;justify-content:center;gap:4px;font:16px/1.2 system-ui,Arial,sans-serif}
  .l1wb-offer:hover{border-color:#0e7b57;background:#f5faee}
  .l1wb-offer[aria-pressed=true]{border:3px solid #16804d;background:#eaf5df;padding:8px 10px}
  .l1wb-offer-top{display:flex;align-items:center;gap:7px;justify-content:space-between}
  .l1wb-offer-top strong{font-size:17px;font-weight:900;line-height:1.18}
  .l1wb-offer-price{font-weight:900;color:#a34f17;white-space:nowrap;font-size:17px}
  .l1wb-offer small{font-size:13px;color:#526066;font-weight:700}
  .l1wb-offer-flag{font-size:12px;font-weight:800;color:#157549}
  /* Sob demanda: modal compacto central, nunca aberto permanentemente. */
  .l1wb-focus-backdrop{position:fixed;inset:0;background:rgba(7,16,27,.49);z-index:10040;
    display:flex;align-items:center;justify-content:center;padding:16px}
  .l1wb-dialog{background:#fffaf1;border:3px solid #e0b477;border-radius:18px;box-shadow:0 25px 70px #0006;
    width:min(580px,94vw);max-height:min(680px,88vh);overflow-y:auto;padding:22px 25px;
    font:16px/1.4 system-ui,Arial,sans-serif;color:#18312a}
  .l1wb-dialog h2{font-size:21px;margin:0 0 10px}
  .l1wb-dialog-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px}
  .l1wb-costrow{display:flex;align-items:center;justify-content:space-between;gap:10px;
    padding:9px 0;border-bottom:1px solid #e1d4c1;font-size:15px}
  .l1wb-costrow strong{font-size:16px;white-space:nowrap}
  .l1wb-hint{font-size:12px;color:#6b6152;line-height:1.35;margin-top:8px}
  .l1wb-exercise{padding:10px 0;border-bottom:1px solid #e1d4c1}
  .l1wb-exercise-controls{display:flex;gap:8px;margin-top:8px}
  .l1wb-exercise-controls input{min-width:0;flex:1;padding:9px;border:1px solid #bba98f;border-radius:7px;font:inherit}
  .l1wb-exercise-feedback{font-size:13px;color:#2d6448;min-height:18px;margin-top:5px}
  .l1wb-dialog .l1wb-market{max-height:440px;overflow:auto}
  .l1wb-dialog .l1wb-market h3{font-size:20px}
  .l1wb-dialog .l1wb-market p{font-size:16px}
  .l1wb-dialog .l1wb-actions{margin-top:18px}
  @media(max-width:680px){.l1wb-dialog{width:96vw;max-height:90vh;padding:16px}.l1wb-dialog .l1wb-tabs{flex-wrap:wrap}}
  /* Regras de resultado da Etapa 2, exclusivas do L1. */
  .l1-feedback{border-radius:12px;background:#fff7e8;border:1px solid #e9cfaa;padding:14px 16px;margin:8px 0 14px}
  .l1-feedback.is-positive{background:#edf7ee;border-color:#b6d4be}.l1-feedback-title{font-size:18px;font-weight:800;margin-bottom:9px}
  .l1-feedback-metrics{display:flex;gap:14px;flex-wrap:wrap;font-size:13px}.l1-feedback p{font-size:13px;margin:10px 0 0}
  .l1-scorecard{border:1px solid #dce4ed;background:#f7fafc;border-radius:17px;padding:15px 18px;margin:14px 0}
  .l1-scorecard-head{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:13px;font-weight:800;color:#43566a}
  .l1-scorecard-head strong{font-size:29px;color:#18304b}.l1-scorecard-head small{font-size:14px}
  .l1-scorecard-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 20px;margin-top:12px}
  .l1-score-item>div{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:13px}
  .l1-score-item>i{display:block;height:7px;background:#dce4ed;border-radius:8px;overflow:hidden;margin-top:5px}
  .l1-score-item>i>b{display:block;height:100%;border-radius:8px;background:#0d8065}
  .l1-score-note{font-size:12px;color:#64748b;line-height:1.45;margin:12px 0 0}
  .l1-best-score{display:inline-flex;font-size:13px;align-self:center;color:#0c7153;font-weight:700}
  .l1-result-details{border:1px solid #e3e9ef;border-radius:12px;padding:8px 14px;margin:15px 0}
  .l1-result-details summary{cursor:pointer;padding:10px 0;font-weight:700}
  `;
  document.head.appendChild(el);
}

function campaignL1UiData(rd) {
  const level=getCampaignLevel(1),book=calculateCampaignBookSnapshot();
  const offers=getCurrentExwOffersForRender(rd);
  const tab=['market','offers','book'].includes(state.campaign.l1Tab)?state.campaign.l1Tab:'market';
  const confirmed=!!state.confirmed?.exw?.[state.round];
  const selected=state.choices?.exw?.[state.round]||null;
  const maxVol=Number(level.targetVolumeT||60000);
  const remaining=Math.max(0,maxVol-Number(book.totalUsedT||0));
  return {level,book,offers,tab,confirmed,selected,maxVol,remaining};
}

function campaignL1WorkbenchMarkup(rd) {
  const {level,book,tab,confirmed,selected,maxVol,remaining}=campaignL1UiData(rd);
  const num=(v,d=1)=>Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d});
  const vol=v=>Number(v||0).toLocaleString('pt-BR',{maximumFractionDigits:0});
  const signed=v=>`${Number(v)>=0?'+':''}${num(v,1)}`;
  const round=Number(state.round);
  let content='';
  if(tab==='market'){
    const news=String(rd.master_news||rd.market_headline||rd.news||'Observe o mercado antes de comprar.');
    const previous=round>1?getRoundData(round-1):null;
    const fmtMove=(v,d=1)=>`${Number(v)>=0?'+':''}${num(v,d)}`;
    const currentPx=rd.offers_exw?.find(x=>x.city==='Porto Nacional');
    const previousPx=previous?.offers_exw?.find(x=>x.city==='Porto Nacional');
    const physical=(currentPx&&previousPx)?` · Físico TO ${fmtMove(Number(currentPx.price_brl_saca)-Number(previousPx.price_brl_saca),2)} R$/sc`:'';
    const reaction=previous?`<p class="l1wb-mini"><strong>Efeito da notícia anterior:</strong> Chicago ${fmtMove(Number(rd.cbot_cent_bu)-Number(previous.cbot_cent_bu),2)} ¢/bu · dólar ${fmtMove(Number(rd.usd)-Number(previous.usd),4)} R$/US$${physical}.</p>`:'';
    content=`<span class="l1wb-label">1. Notícia-mestre · rodada ${round}</span>
      <h3>${escapeHtml(news)}</h3>
      ${reaction}
      <p><strong>O que observar:</strong> ${escapeHtml(rd.market_signal||'Compare Chicago, câmbio e preço físico.')}</p>
      <p><strong>Sua missão:</strong> ${escapeHtml(rd.decision_prompt||'Compare as origens e decida se compra ou espera.')}</p>
      <div class="l1wb-actions"><button class="l1wb-btn l1wb-btn-primary" type="button" data-l1-tab="offers">2. Comparar origens →</button><button class="l1wb-btn" type="button" data-l1-action="focus">Ler mais ⛶</button></div>`;
  }
  if(tab==='offers'){
    let inner='<span class="l1wb-label">Decisão · Uma compra por rodada</span><h3>Selecione uma oferta no quadro à direita ou no mapa.</h3><p>Confira volume e custo antes de usar o botão COMPRAR do caderno.</p>';
    if(selected){
      const offered=Number(selected.available_volume_t||selected.volume_t||0);
      const effective=confirmed?Number(state.confirmed.exw[round]?.volume_t||0):Math.min(offered,remaining);
      const lot=calculateCampaignOfferBasisSnapshot({...selected,volume_t:effective},round);
      const projected=confirmed?book:calculateCampaignBookSnapshot({...selected,volume_t:effective});
      inner=`<span class="l1wb-label">${confirmed?'Compra confirmada':'Oferta selecionada'}</span>
        <h3>${escapeHtml(formatOfferDisplayName(selected))}</h3>
        <div class="l1wb-mini"><p><strong>${vol(effective)} t · R$ ${num(selected.price_brl_saca,2)}/sc</strong></p>
        <p>${round===1?`Basis: <strong>${signed(lot.basisCentBu)} ¢/bu</strong> · Book: <strong>${signed(projected.basisAvg)} ¢/bu</strong>`:'Calcule o frete, o CFR e o basis antes de decidir.'}</p></div>
        <div class="l1wb-actions"><button type="button" class="l1wb-btn" data-l1-action="calculator">Calcular CFR ↗</button>
        <span style="font-size:12px;color:#526557">${confirmed?'Compra registrada':'Use COMPRAR abaixo'}</span></div>`;
    }
    content=inner;
  }
  if(tab==='book'){
    content=`<span class="l1wb-label">Posição · Navio de ${vol(maxVol)} t</span>
    <div class="l1wb-mini"><p><strong>Originação:</strong> ${vol(book.totalUsedT)} t · faltam ${vol(book.missingT)} t</p>
    <p><strong>Basis médio:</strong> ${book.totalUsedT?signed(book.basisAvg)+' ¢/bu':'—'} · teto +${num(level.targetBasisCentBu,0)}</p>
    <p><strong>Margem bruta:</strong> ${book.totalUsedT?'US$ '+num(book.pnlUsd,0):'—'}</p></div>
    <p>${book.totalUsedT?`Nota parcial: <strong>${calculateCampaignL1Score(book.usedLots,book).total}/100</strong>`:'A pontuação começa após a primeira compra.'}</p>
    <p>Resultado completo e disciplina comercial ao final das cinco rodadas.</p>`;
  }
  return `<div class="l1wb-head"><strong>Rodada ${round} de ${level.rounds}</strong><small>${vol(book.totalUsedT)} / ${vol(maxVol)} t</small></div>
    <nav class="l1wb-tabs" role="tablist" aria-label="Etapas da rodada">
    <button type="button" class="l1wb-btn" role="tab" data-l1-tab="market" aria-selected="${tab==='market'}">Mercado</button>
    <button type="button" class="l1wb-btn" role="tab" data-l1-tab="offers" aria-selected="${tab==='offers'}">Origem</button>
    <button type="button" class="l1wb-btn" role="tab" data-l1-tab="book" aria-selected="${tab==='book'}">Posição</button>
    <button type="button" class="l1wb-btn" data-l1-action="focus" aria-label="Ampliar leitura do caderno">Ler ⛶</button></nav>
    <div class="l1wb-content">${content}</div>
    <div class="l1wb-foot">Meta: basis médio ≤ +${num(level.targetBasisCentBu,0)} ¢/bu · Cenário simulado</div>`;
}

function campaignL1OfferListMarkup(rd){
  const {offers,selected,confirmed}=campaignL1UiData(rd);
  const num=(v,d=2)=>Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d});
  const vol=v=>Number(v||0).toLocaleString('pt-BR',{maximumFractionDigits:0});
  return `<p class="l1wb-list-heading">Selecione na lista ou no mapa</p>${offers.map((o,i)=>{
    const active=!!selected&&Number(selected.id)===Number(o.id);
    return `<button type="button" class="l1wb-offer" data-l1-select="${i}" aria-pressed="${active}">
       <span class="l1wb-offer-top"><strong>${escapeHtml(formatOfferDisplayName(o))}</strong></span>
       <span class="l1wb-offer-top"><small>${vol(o.volume_t)} t · Disponível</small><span class="l1wb-offer-price">R$ ${num(o.price_brl_saca)}/sc</span></span>
       ${active?`<span class="l1wb-offer-flag">${confirmed?'✓ Compra confirmada':'✓ Selecionada · consulte o caderno'}</span>`:''}
    </button>`}).join('')}`;
}

function campaignL1CalculatorMarkup(rd){
  const {selected,confirmed,book,remaining}=campaignL1UiData(rd);
  if(!selected)return '';
  const num=(v,d=2)=>Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d});
  const effective=confirmed?Number(state.confirmed.exw[state.round]?.volume_t||0):Math.min(Number(selected.available_volume_t||selected.volume_t||0),remaining);
  const lot=calculateCampaignOfferBasisSnapshot({...selected,volume_t:effective},state.round);
  const header=`<div class="l1wb-dialog-head"><h2>${state.round===1?'Exemplo resolvido':'Faça os cálculos'} · ${escapeHtml(formatOfferDisplayName(selected))}</h2><button class="l1wb-btn" type="button" data-l1-action="close">Fechar ✕</button></div>`;
  if(state.round===1){
    const rows=[
      ['Preço EXW convertido',num(lot.interiorUsdT)+' US$/t'],
      ['Frete rodoviário',num(lot.inlandUsdT*lot.fx)+' R$/t'],
      ['Fobbing + marítimo',num(lot.fobbingUsdT+lot.maritimeUsdT)+' US$/t'],
      ['Custo CFR equivalente',num(lot.cfrCostCentBu,1)+' ¢/bu'],
      ['Chicago',num(lot.cbotCentBu)+' ¢/bu'],
      ['Basis = CFR − Chicago',num(lot.basisCentBu,1)+' ¢/bu']
    ];
    return header+`<p><strong>Rodada 1: exemplo resolvido.</strong> Observe os passos e a conversão de unidades.</p>
    <p class="l1wb-hint">EXW = R$ ${num(lot.priceBrlSc)}/sc × ${num((1000/60),4)} sc/t ÷ câmbio R$ ${num(lot.fx,4)}/US$. Frete em R$/t = US$/t × câmbio. CFR = (EXW + rodoviário + fobbing + marítimo) ÷ ${num(36.7437,4)} bu/t × 100.</p>
    ${rows.map(x=>`<div class="l1wb-costrow"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('')}
    <p class="l1wb-hint">Valores simulados; não inclui hedge, financiamento ou MTM.</p>`;
  }
  const key=String(state.round)+':'+String(selected.id??formatOfferDisplayName(selected));
  const answers=(state.campaign.l1Exercises||(state.campaign.l1Exercises={}))[key]||{};
  const steps=[
    ['freight','1. Calcule o frete rodoviário (R$/t)',`Frete informado: US$ ${num(lot.inlandUsdT)}/t. Câmbio: R$ ${num(lot.fx,4)}/US$. Multiplique.`],
    ['exw','2. Converta o preço EXW (US$/t)',`R$ ${num(lot.priceBrlSc)}/sc × ${num((1000/60),4)} sc/t ÷ câmbio.`],
    ['cfr','3. Calcule o custo CFR (¢/bu)',`Some EXW, rodoviário US$ ${num(lot.inlandUsdT)}/t, fobbing US$ ${num(lot.fobbingUsdT)}/t e marítimo US$ ${num(lot.maritimeUsdT)}/t; divida por ${num(36.7437,4)} e multiplique por 100.`],
    ['basis','4. Calcule o basis de custo (¢/bu)',`CFR calculado menos Chicago ${num(lot.cbotCentBu)} ¢/bu.`]
  ];
  return header+`<p><strong>Rodada ${state.round} de 5.</strong> Responda cada conta e confira. Os botões e a navegação do jogo permanecem disponíveis.</p>
    ${steps.map(([id,label,hint])=>`<div class="l1wb-exercise"><strong>${label}</strong><p class="l1wb-hint">${hint}</p><div class="l1wb-exercise-controls">
      <input type="text" inputmode="decimal" data-l1-answer="${id}" aria-label="${label}" placeholder="Digite o resultado" value="${escapeHtml(String(answers[id]?.value||''))}"/>
      <button type="button" class="l1wb-btn" data-l1-check="${id}">Conferir</button></div>
      <div class="l1wb-exercise-feedback" data-l1-feedback="${id}" aria-live="polite">${answers[id]?.ok?'✓ Correto':answers[id]?.attempted?'Confira as unidades e tente novamente.':''}</div></div>`).join('')}
    <p class="l1wb-hint">Você pode tentar novamente sem penalidade. Os resultados são validados sem revelar a resposta antecipadamente.</p>`;
}

function renderCampaignL1Workbench(layer,rd) {
  if(!isCampaignLevel1Exw())return;
  ensureCampaignL1WorkbenchStyle();
  // Não cobrimos caderno, mapa ou tabela: HTML transparente alinhado ao desenho.
  const notebook=document.createElement('section');
  notebook.className='l1wb';notebook.id='l1wb-panel';
  notebook.setAttribute('aria-label','Informações no caderno original');
  notebook.innerHTML=campaignL1WorkbenchMarkup(rd);
  attachCampaignL1WorkbenchEvents(notebook,rd);layer.appendChild(notebook);
  const list=document.createElement('aside');
  list.className='l1wb-list';list.id='l1wb-offers';
  list.setAttribute('aria-label','Ofertas EXW no quadro original');
  list.innerHTML=campaignL1OfferListMarkup(rd);
  attachCampaignL1WorkbenchEvents(list,rd);layer.appendChild(list);
  document.getElementById('l1wb-dialog')?.remove();
  if(state.campaign.l1CalcVisible || state.campaign.l1Focus){
    const backdrop=document.createElement('div');
    backdrop.id='l1wb-dialog';backdrop.className='l1wb-focus-backdrop';
    const calculator=!!state.campaign.l1CalcVisible && !!state.choices?.exw?.[state.round];
    backdrop.innerHTML=`<section class="l1wb-dialog" role="dialog" aria-modal="true" aria-label="${calculator?'Calculadora CFR':'Leitura ampliada'}">${calculator?campaignL1CalculatorMarkup(rd):
      `<div class="l1wb-dialog-head"><h2>Caderno · rodada ${state.round}</h2><button type="button" class="l1wb-btn" data-l1-action="close">Fechar ✕</button></div><div class="l1wb-market">${campaignL1WorkbenchMarkup(rd)}</div>`}</section>`;
    backdrop.addEventListener('click',e=>{if(e.target===backdrop){state.campaign.l1Focus=false;state.campaign.l1CalcVisible=false;renderOverlaysForScreen('r1_exw',rd);}});
    attachCampaignL1WorkbenchEvents(backdrop.querySelector('section'),rd);
    document.body.appendChild(backdrop);
  }
}

function attachCampaignL1WorkbenchEvents(container,rd){
  container.addEventListener('click',ev=>{
    const button=ev.target.closest('button');
    if(!button||state.guideOverlayOpen)return;
    const tab=button.dataset.l1Tab;
    if(tab){state.campaign.l1Tab=tab;renderOverlaysForScreen('r1_exw',rd);return;}
    const idx=button.dataset.l1Select;
    if(idx!==undefined){
      const offer=getCurrentExwOffersForRender(rd)[Number(idx)];if(!offer)return;
      state.campaign.l1Tab='offers';state.campaign.l1CalcVisible=false;state.campaign.l1Focus=false;
      selectExwOfferForCurrentRound(offer,rd,'r1_exw');return;
    }
    const check=button.dataset.l1Check;
    if(check){
      const input=container.querySelector('[data-l1-answer="'+check+'"]');
      const feedback=container.querySelector('[data-l1-feedback="'+check+'"]');
      const selected=state.choices?.exw?.[state.round];
      if(!input||!selected)return;
      const key=String(state.round)+':'+String(selected.id??formatOfferDisplayName(selected));
      const store=state.campaign.l1Exercises||(state.campaign.l1Exercises={});
      const answers=store[key]||(store[key]={});
      const value=String(input.value||'').trim();
      const candidate=Number(value.replace(/\s/g,'').replace(',','.'));
      const lot=calculateCampaignOfferBasisSnapshot(selected,state.round);
      const targets={freight:[lot.inlandUsdT*lot.fx,.06],exw:[lot.interiorUsdT,.06],cfr:[lot.cfrCostCentBu,.16],basis:[lot.basisCentBu,.17]};
      const target=targets[check];
      if(!target)return;
      const ok=value!==''&&Number.isFinite(candidate)&&Math.abs(candidate-target[0])<=target[1];
      answers[check]={value,attempted:true,ok};
      if(feedback)feedback.textContent=ok?'✓ Correto.':'Confira as unidades e tente novamente.';
      return;
    }
    const action=button.dataset.l1Action;
    if(action==='calculator'){
      state.campaign.l1CalcVisible=true;state.campaign.l1Focus=false;
      renderOverlaysForScreen('r1_exw',rd);return;
    }
    if(action==='focus'){
      state.campaign.l1Focus=true;state.campaign.l1CalcVisible=false;
      renderOverlaysForScreen('r1_exw',rd);return;
    }
    if(action==='close'){
      state.campaign.l1Focus=false;state.campaign.l1CalcVisible=false;
      renderOverlaysForScreen('r1_exw',rd);return;
    }
  });
}

function buildCampaignStatusHtml() {
  if (isCampaignMode() && Number(state.campaign?.levelId) !== 1) return buildCampaignStatusHtmlLegacy();
  const level = getCampaignLevel(state.campaign?.levelId || 1);
  if (!isCampaignMode() || Number(state.campaign?.levelId) !== 1) return `
    <div class="campaign-canvas-card campaign-status-card">
      <div class="campaign-canvas-title">STATUS DO LEVEL</div>
      <div class="campaign-status-block"><span>Contexto:</span> carga vendida CFR China para ${level.shipmentMonth || 'março'}.</div>
      <div class="campaign-status-block"><span>Meta:</span> completar ${formatTon(level.targetVolumeT||60000)} t em ${level.rounds||5} rodadas.</div>
    </div>`;
  return `
    <div class="campaign-canvas-card campaign-status-card">
      <div class="campaign-canvas-title">STATUS · L1</div>
      <div class="campaign-status-block"><span>Venda contratada (simulação)</span>CFR +${Number(level.fixedSaleBasisCentBu).toFixed(0)} c/bu · Santos → Norte da China.</div>
      <div class="campaign-status-block"><span>Originação</span>Compra EXW: escolha a praça, o volume e o preço físico.</div>
      <div class="campaign-status-block"><span>Custos fixados</span>Marítimo US$ ${Number(level.fixedFreightUsdT).toFixed(2)}/t · fobbing US$ ${Number(level.fixedFobbingUsdT).toFixed(2)}/t; rodoviário por praça.</div>
      <div class="campaign-status-block"><span>Meta</span>${formatTon(level.targetVolumeT)} t em ${level.rounds} rodadas · basis ≤ +${Number(level.targetBasisCentBu).toFixed(0)} c/bu.</div>
    </div>`;
}

function buildCampaignBookPanelHtml() {
  if (isCampaignMode() && Number(state.campaign?.levelId) !== 1) return buildCampaignBookPanelHtmlLegacy();
  const snap = calculateCampaignBookSnapshot();
  const progress = snap.level.targetVolumeT > 0 ? Math.min(100, (snap.totalUsedT / snap.level.targetVolumeT) * 100) : 0;
  return `
    <div class="campaign-canvas-card campaign-book-card">
      <div class="campaign-canvas-title">BOOK DO LEVEL / MARGEM</div>
      <div class="campaign-book-grid">
        <div><span>Venda CFR</span><strong>${formatCampaignSigned(snap.saleBasisCentBu, 0, ' c/bu')}</strong></div>
        <div><span>Volume</span><strong>${formatTon(snap.totalUsedT)} / ${formatTon(snap.level.targetVolumeT || 0)} t</strong></div>
        <div><span>Faltante</span><strong>${formatTon(snap.missingT)} t</strong></div>
        <div><span>Basis médio</span><strong>${snap.totalUsedT > 0 ? formatCampaignSigned(snap.basisAvg, 1, ' c/bu') : '—'}</strong></div>
        <div><span>Margem ¢/bu</span><strong>${snap.totalUsedT > 0 ? formatCampaignSigned(snap.mtmCentBu, 1, ' c/bu') : '—'}</strong></div>
        <div><span>Margem bruta</span><strong>${snap.totalUsedT > 0 ? formatCampaignUsd(snap.pnlUsd, 0) : '—'}</strong></div>
      </div>
      <div class="campaign-progress"><i style="width:${progress.toFixed(1)}%"></i></div>
      <div class="campaign-book-note">Venda CFR didática menos basis de aquisição = margem bruta indicativa; não é MTM nem lucro realizado.</div>
    </div>`;
}

function buildCampaignNewsPanelHtml(roundNum = state.round) {
  if (isCampaignMode() && Number(state.campaign?.levelId) !== 1) return buildCampaignNewsPanelHtmlLegacy(roundNum);
  const rd = getRoundData(roundNum) || {};
  const level = getCampaignLevel(state.campaign?.levelId || 1);
  const totalRounds = Number(level.rounds || 5);
  const rawHeadline = String(rd.market_headline || rd.news || '').trim();
  const headline = rawHeadline || 'Mercado sem manchete relevante nesta rodada.';
  const roundLabel = `Rodada ${Number(roundNum || 1)} / ${totalRounds} · notícia simulada`;
  return `
    <div class="campaign-canvas-card campaign-news-card">
      <div class="campaign-news-kicker">${escapeHtml(roundLabel)}</div>
      <div class="campaign-canvas-title">RADAR DA RODADA</div>
      <div class="campaign-news-headline">${escapeHtml(headline)}</div>
    </div>`;
}

function buildCampaignRoundSummaryHtml(roundNum = state.round) {
  if (isCampaignMode() && Number(state.campaign?.levelId) !== 1) return buildCampaignRoundSummaryHtmlLegacy(roundNum);
  const exw = state.confirmed?.exw?.[roundNum];
  if (!exw) {
    return `<div class="campaign-round-summary"><p>Nenhuma compra foi confirmada nesta rodada. O book segue sem alteração operacional.</p></div>`;
  }
  const lot = calculateCampaignOfferBasisSnapshot(exw, roundNum);
  const book = calculateCampaignBookSnapshot();
  const introHtml = `A origem foi contratada com basis de <strong>${formatCampaignSigned(lot.basisCentBu, 1, ' c/bu')}</strong>. Reveja a conversão do preço, a logística até Santos e o custo CFR para compreender sua margem.`;
  const feedback = campaignL1RoundFeedbackMarkup(roundNum,lot,book);
  const cfrValueHtml = `${lot.cfrCostCentBu.toFixed(1)} c/bu`;
  const basisLineHtml = `Basis do lote: <strong>${lot.cfrCostCentBu.toFixed(1)} − ${lot.cbotCentBu.toFixed(1)} = ${formatCampaignSigned(lot.basisCentBu, 1, ' c/bu')}</strong>`;
  const mtmLineHtml = `Diferença contra a venda CFR a <strong>${formatCampaignSigned(lot.saleBasisCentBu, 0, ' c/bu')}</strong>: <strong>${formatCampaignSigned(lot.marginCentBu, 1, ' c/bu')}</strong>, ou <strong>${formatCampaignUsd(lot.pnlUsdT, 2)}/t</strong> de margem bruta teórica.`;
  const partialNotice = Number(exw.available_volume_t || 0) > Number(exw.volume_t || 0)
    ? `<p><strong>Compra parcial:</strong> contratadas ${formatTon(exw.volume_t)} t de ${formatTon(exw.available_volume_t)} t disponíveis no lote do exercício.</p>` : '';
  return `
    <div class="campaign-round-summary">
      <div class="campaign-round-kicker">Resumo da rodada ${Number(roundNum || 1)}</div>
      ${feedback}
      ${partialNotice}
      <details class="l1-result-details"><summary>Como o basis e a margem foram calculados</summary><p>${introHtml}</p>
      <p>Preço EXW: R$ ${lot.priceBrlSc.toFixed(2)}/sc · câmbio: R$ ${lot.fx.toFixed(4)} · Chicago: ${lot.cbotCentBu.toFixed(2)} c/bu · frete Santos: US$ ${lot.inlandUsdT.toFixed(2)}/t.</p>
      <div class="campaign-formula-box">
        <div><span>Soja interior</span><strong>${lot.interiorCentBu.toFixed(1)} c/bu</strong></div>
        <div><span>Logística interna</span><strong>${lot.inlandCentBu.toFixed(1)} c/bu</strong></div>
        <div><span>Custo portuário</span><strong>${lot.fobbingCentBu.toFixed(1)} c/bu</strong></div>
        <div><span>Frete marítimo</span><strong>${lot.maritimeCentBu.toFixed(1)} c/bu</strong></div>
        <div class="total"><span>Custo CFR equivalente</span><strong>${cfrValueHtml}</strong></div>
      </div>
      <div class="campaign-basis-line">${basisLineHtml}</div>
      <div class="campaign-mtm-line">${mtmLineHtml}</div></details>
      <div class="campaign-summary-grid">
        <div><span>Volume acumulado</span><strong>${formatTon(book.totalUsedT)} / ${formatTon(book.level.targetVolumeT || 0)} t</strong></div>
        <div><span>Basis médio</span><strong>${formatCampaignSigned(book.basisAvg, 1, ' c/bu')}</strong></div>
        <div><span>Margem bruta indicada</span><strong>${formatCampaignUsd(book.pnlUsd, 0)}</strong></div>
      </div>
    </div>`;
}

/* ==========================================================================
   CAMPANHA L1 — SCORECARD DIDÁTICO V2 (ESCOPADO AO LEVEL 1)
   Sempre usa o mesmo cálculo CFR/basis da origem. Não é P&L realizado.
   Originação 35 + margem 30 + ocupação 20 + disciplina 15 = 100 pontos.
   ========================================================================== */
const CAMPAIGN_L1_RECORD_KEY = 'tg_campaign_l1_scorecard_v2';
const CAMPAIGN_L1_MIN_SCORE = 70;
const CAMPAIGN_L1_MARGIN_FULL_SCORE_CENT_BU = 40;
const CAMPAIGN_L1_ORIGIN_REGRET_CENT_BU = 45;

function campaignL1Clamp(value, min=0, max=1) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function readCampaignL1Record() {
  try {
    const raw = JSON.parse(localStorage.getItem(CAMPAIGN_L1_RECORD_KEY) || 'null');
    return raw && raw.version === 2 && Number.isFinite(Number(raw.bestScore)) ? raw : null;
  } catch (_) { return null; }
}

function saveCampaignL1Record(result) {
  if (!result || !result.scorecard || Number(state.campaign?.levelId) !== 1) return;
  const last = readCampaignL1Record();
  const bestScore = Math.max(0, Number(last?.bestScore || 0), Number(result.scorecard.total || 0));
  const record = {
    version: 2, bestScore,
    approved: Boolean(last?.approved || result.approved),
    lastScore: Number(result.scorecard.total || 0),
    lastApproved: Boolean(result.approved),
    completedAt: new Date().toISOString()
  };
  try { localStorage.setItem(CAMPAIGN_L1_RECORD_KEY, JSON.stringify(record)); } catch (_) {}
}

function campaignL1RoundCheapestBasis(round) {
  const rd = getRoundData(round) || {};
  const offers = Array.isArray(rd.offers_exw) ? rd.offers_exw : [];
  const basisValues = offers.map(o => {
    const draft = { ...o, ref_cbot_cent_bu: Number(rd.cbot_cent_bu || 0), ref_cambio: Number(rd.usd || 0) };
    return calculateCampaignOfferBasisSnapshot(draft, round).basisCentBu;
  }).filter(Number.isFinite);
  return basisValues.length ? Math.min(...basisValues) : null;
}

function calculateCampaignL1Score(usedLots, book, excessT=0) {
  const level = getCampaignLevel(1);
  const lots = Array.isArray(usedLots) ? usedLots : [];
  const volumeT = lots.reduce((sum,l) => sum + Math.max(0, Number(l.usedVolumeT || 0)), 0);
  const targetT = Math.max(1, Number(level.targetVolumeT || 60000));
  const basisAvg = volumeT > 0 ? campaignWeightedAverage(lots,'basisCentBu') : 0;
  const saleBasis = Number(level.fixedSaleBasisCentBu ?? level.targetBasisCentBu ?? 0);
  const marginCentBu = volumeT > 0 ? saleBasis - basisAvg : 0;
  let totalRegret = 0, positiveMarginT = 0, compliantT = 0;
  for (const lot of lots) {
    const vol = Math.max(0, Number(lot.usedVolumeT || 0));
    const benchmark = campaignL1RoundCheapestBasis(lot.round);
    totalRegret += (benchmark === null ? 0 : Math.max(0, Number(lot.basisCentBu) - benchmark)) * vol;
    if (Number(lot.marginCentBu) >= -1e-8) positiveMarginT += vol;
    if (Number(lot.basisCentBu) <= Number(level.targetBasisCentBu) + 1e-8) compliantT += vol;
  }
  const avgRegret = volumeT > 0 ? totalRegret / volumeT : 0;
  // O benchmark é a menor oferta de cada sessão efetivamente utilizada, não um preço nacional executável.
  const origination = volumeT > 0 ? Math.round(35 * campaignL1Clamp(1-avgRegret/CAMPAIGN_L1_ORIGIN_REGRET_CENT_BU)) : 0;
  const margin = volumeT > 0 ? Math.round(30 * campaignL1Clamp(marginCentBu/CAMPAIGN_L1_MARGIN_FULL_SCORE_CENT_BU)) : 0;
  const utilization = Math.round(20 * campaignL1Clamp(volumeT/targetT));
  const discipline = volumeT > 0 ? Math.round(
    (excessT <= 1e-8 ? 5 : 0) + 5 * positiveMarginT/volumeT + 5 * compliantT/volumeT
  ) : 0;
  const total = origination + margin + utilization + discipline;
  return {
    version:2, total, minScore:CAMPAIGN_L1_MIN_SCORE,
    origination, margin, utilization, discipline, avgRegret, marginCentBu,
    weights:{origination:35,margin:30,utilization:20,discipline:15},
    targetVolumeT:targetT, volumeT, basisAvg,
    qualifyingScore:total>=CAMPAIGN_L1_MIN_SCORE
  };
}

function campaignL1ScoreMarkup(score) {
  const metrics = [
    ['Originação',score.origination,35],['Margem',score.margin,30],
    ['Ocupação',score.utilization,20],['Disciplina',score.discipline,15]
  ];
  return `<div class="l1-scorecard" aria-label="Avaliação de desempenho do Level 1">
      <div class="l1-scorecard-head"><span>AVALIAÇÃO DE DESEMPENHO</span><strong>${score.total}<small> / 100 pontos</small></strong></div>
      <div class="l1-scorecard-grid">${metrics.map(([name,value,max])=>`<div class="l1-score-item"><div><span>${name}</span><strong>${value}/${max}</strong></div><i><b style="width:${(100*value/max).toFixed(1)}%"></b></i></div>`).join('')}</div>
      <p class="l1-score-note">Pontuação didática: originação versus menor basis das ofertas das sessões compradas; margem bruta indicativa, ocupação e disciplina. Aprovação exige nota ≥ ${score.minScore}, 60.000 t, basis médio dentro da meta, margem não negativa e ausência de excesso.</p>
    </div>`;
}

function campaignL1RoundFeedbackMarkup(roundNum, lot, book) {
  const usedBefore = book.usedLots.filter(l => Number(l.round) < Number(roundNum));
  const prevT = usedBefore.reduce((sum,l)=>sum+Number(l.usedVolumeT||0),0);
  const prevBasis = prevT ? campaignWeightedAverage(usedBefore,'basisCentBu') : null;
  const signedBasis = formatCampaignSigned(lot.basisCentBu,1,' ¢/bu');
  const cap = Number(book.level.targetVolumeT || 60000);
  const delta = prevBasis === null ? 'Primeira origem do book' :
    `${lot.basisCentBu <= prevBasis ? 'Melhorou' : 'Elevou'} o basis médio em ${Math.abs(book.basisAvg-prevBasis).toFixed(1)} ¢/bu`;
  const status = lot.marginCentBu >= 0 ? 'Margem bruta positiva no lote' : 'Margem bruta negativa no lote';
  const good = lot.basisCentBu <= Number(book.level.targetBasisCentBu);
  return `<div class="l1-feedback ${good && lot.marginCentBu>=0?'is-positive':'is-warning'}">
    <div class="l1-feedback-title">${good ? 'Boa execução de origem' : 'Atenção à competitividade'} · ${escapeHtml(lot.origin)}</div>
    <div class="l1-feedback-metrics">
      <span>Contratado <b>${formatTon(lot.volumeT)} t</b></span>
      <span>Basis do lote <b>${signedBasis}</b></span>
      <span>Book <b>${formatTon(book.totalUsedT)} / ${formatTon(cap)} t</b></span>
    </div>
    <p>${delta}. ${status}; confira o efeito na margem e na ocupação antes de avançar.</p>
  </div>`;
}

function buildCampaignLevel1Result() {
  const level = getCampaignLevel(1);
  // Reutiliza exatamente o mesmo cálculo exibido no book/resumo de cada rodada.
  const usedLots = getCampaignUsedLotsWithPnl();
  const totalBoughtT = Object.values(state.confirmed?.exw || {}).reduce((acc, exw) => acc + Number(exw?.volume_t || 0), 0);
  const totalUsedT = usedLots.reduce((acc, lot) => acc + Number(lot.usedVolumeT || 0), 0);
  const basisAvg = campaignWeightedAverage(usedLots, 'basisCentBu');
  const cfrAvg = campaignWeightedAverage(usedLots, 'cfrCostCentBu');
  const grossMarginUsd = usedLots.reduce((acc, lot) => acc + Number(lot.pnlUsedUsd || 0), 0);
  const missingT = Math.max(0, Number(level.targetVolumeT || 0) - totalUsedT);
  const excessT = Math.max(0, totalBoughtT - Number(level.targetVolumeT || 0));
  const economicApproved = missingT <= 1e-9 && excessT <= 1e-9 && basisAvg <= Number(level.targetBasisCentBu || 0) + 1e-9 && grossMarginUsd >= -1e-6;
  const scorecard = calculateCampaignL1Score(usedLots, { level, totalUsedT, basisAvg, grossMarginUsd }, excessT);
  const approved = economicApproved && scorecard.qualifyingScore;
  return { level, lots:usedLots, usedLots, totalBoughtT, totalUsedT, missingT, excessT, basisAvg, cfrAvg, grossMarginUsd, economicApproved, scorecard, approved };
}

function positionAccessModalOnCanvas() {
  positionCanvasModalElements('accessOverlay', 'accessBox', { maxW: 460, widthPct: 0.92, marginX: 12, marginY: 16, fitHeight: true });
}

function openAccessModal(kind, onSuccess) {
  pendingProtectedAccess = { kind, onSuccess };
  const modal = document.getElementById("accessModal");
  const input = document.getElementById("accessPassword");
  const error = document.getElementById("accessError");
  const title = document.getElementById("accessTitle");
  const sub = document.getElementById("accessSub");
  if (!modal || !input) return;
  if (title) title.textContent = kind === "admin" ? "Admin restrito" : "Modo Expert restrito";
  if (sub) sub.textContent = kind === "admin"
    ? "Digite a senha de 4 dígitos para abrir o painel Admin."
    : "Digite a senha de 4 dígitos para acessar o modo Jogo Expert.";
  input.value = "";
  if (error) error.style.display = "none";
  modal.style.display = "block";
  requestAnimationFrame(() => {
    positionAccessModalOnCanvas();
    requestAnimationFrame(() => {
      positionAccessModalOnCanvas();
      try { input.focus(); } catch(_) {}
    });
  });
}

function closeAccessModal() {
  const modal = document.getElementById("accessModal");
  if (modal) modal.style.display = "none";
  pendingProtectedAccess = null;
}

function submitAccessModal() {
  const input = document.getElementById("accessPassword");
  const error = document.getElementById("accessError");
  const typed = input ? String(input.value || "").trim() : "";
  if (!isProtectedPasswordValid(typed)) {
    if (error) error.style.display = "block";
    if (input) {
      input.focus();
      try { input.select(); } catch(_) {}
    }
    return;
  }
  const payload = pendingProtectedAccess;
  closeAccessModal();
  if (payload && typeof payload.onSuccess === "function") payload.onSuccess();
}

window.closeAccessModal = closeAccessModal;
window.submitAccessModal = submitAccessModal;

window.addEventListener("resize", () => {
  const modal = document.getElementById("accessModal");
  if (modal && modal.style.display !== "none") positionAccessModalOnCanvas();
});
window.addEventListener("scroll", () => {
  const modal = document.getElementById("accessModal");
  if (modal && modal.style.display !== "none") positionAccessModalOnCanvas();
}, { passive: true });

// Sistema de guia (modo iniciado / expert)
// --------------------
const GUIDE_CONTENT = {
  r1_home_enter: [
    "Olá! A partir de agora serei o seu guia no Trading Games.",
    "Nesta tela principal você navegará entre os caminhos para as tomadas de decisão por rodada, lembrando que seu jogo terá um total de 10 rodadas.",
    "Aqui você pode abrir as notícias, analisar ofertas EXW, verificar fretes marítimos e consultar os bids CFR da China.",
    "Recomendo que em toda nova rodada você inicie suas ações pelo botão Notícia pois é o balizador da sua tomada de decisão. E por fim, quando quiser revisar esta explicação, use o botão GUIA da tela."
  ],
  r1_exw_enter: [
    "Nesta tela estão as ofertas EXW disponíveis da rodada. Atente-se! Pois as variações de CBOT e Câmbio movimentam os preços.",
    "Cada saco representa uma oferta de compra de soja com origem, volume e preços específicos.Você poderá escolher 1 oferta por rodada.",
    "Seu objetivo é avaliar qual oferta faz sentido comercialmente antes de assumir uma posição. Portanto, você deve fazer o calculo do custo de comprar essa soja e leva-la até o porto escolhido.",
    "Depois de escolher uma oferta, você poderá confirmar ou descartar a operação."
  ],
  r1_exw_first_offer: [
    "Ao clicar no saco, você abriu os detalhes da oferta no caderno à esquerda. Portanto avalie as condições.",
    "Depois de avaliar cada oferta, agora você pode confirmar a compra ou descartar essa oportunidade.",
    "Se confirmar, o próximo passo será escolher o corredor de exportação por onde essa soja seguirá.",
    "Observe bem o volume, preço e viabilidade logística antes de decidir. Calule o custo total até o porto dessa soja originada."
  ],
  r1_exw_after_corridor: [
    "Ótimo! Você executou a compra da soja e definiu o corredor de exportação.",
    "Agora vale acompanhar as telas de parciais para enxergar suas posições em aberto, clique no canto inferior direito (≡).",
    "Logo na sequência, seu próximo passo é monitorar os níveis de BID na China e os fretes marítimos para planejar o fechamento da operação. Vá ao menu principal e navegue nessas telas.",
    "Lembre-se: a boa decisão não termina na compra, ela continua no acompanhamento do mercado."
  ],
  r1_cfr_enter: [
    "Nesta tela estão os bids CFR da China disponíveis na rodada.",
    "Cada porto representa uma oportunidade de venda e pode mostrar níveis diferentes de preço.",
    "Aqui você precisa avaliar se já existe soja originada e se o preço de venda remunera seus custos e riscos.",
    "A lógica é: selecionar um bid, analisar os detalhes no caderno e só então decidir se confirma ou descarta."
  ],
  r1_cfr_first_offer: [
    "Você abriu um bid CFR e os detalhes apareceram no caderno.",
    "Agora confira porto, preço e status da oportunidade antes de fechar a venda.",
    "Confirmar esta ação registra um bid fechado na rodada e ajuda a construir sua receita futura.",
    "Se ainda não estiver convicto, descarte e continue observando outras alternativas."
  ],
  r1_cfr_after_confirm: [
    "Perfeito, você confirmou um bid CFR na China.",
    "A partir de agora essa venda passa a aparecer nas parciais e pode ser vinculada à sua estratégia logística.",
    "O próximo passo é verificar se o frete marítimo está coerente com essa oportunidade e se a margem da operação continua saudável.",
    "Use as telas de parciais e de frete para acompanhar a consistência da decisão."
  ],
  r1_frete_enter: [
    "Nesta tela você avalia os fretes marítimos disponíveis para embarque.",
    "Cada navio representa uma alternativa logística com custo e timing próprios.",
    "Seu trabalho aqui é escolher um frete competitivo para sustentar a margem da operação até a China.",
    "A lógica é semelhante às outras telas: selecione um navio, analise o caderno e confirme apenas se o custo fizer sentido."
  ],
  r1_frete_first_offer: [
    "Você abriu uma opção de frete marítimo no caderno.",
    "Agora observe custo, rota e condições antes de contratar.",
    "Se confirmar, o jogo vai pedir o porto e a rodada-alvo do embarque para estruturar o plano logístico.",
    "Essa decisão impacta diretamente sua competitividade e o resultado final da operação."
  ],
  r1_frete_after_confirm: [
    "Ótimo, o frete foi contratado e o plano logístico da rodada foi criado.",
    "Agora vale conferir as parciais para ver como esse custo entrou na sua operação.",
    "Também é importante comparar esse frete com os bids disponíveis na China para entender se a venda continua atrativa.",
    "No trading, contratar frete é uma etapa estratégica, não apenas operacional."
  ],
  partials_menu_enter: [
    "Esta é a central de parciais do jogo.",
    "Aqui você consegue abrir visões específicas da soja originada, dos fretes contratados, dos bids fechados e do P/L parcial.",
    "A função desta área é transformar suas decisões em acompanhamento de posição e resultado.",
    "Sempre que quiser entender se a estratégia está funcionando, volte para esta tela e navegue entre os relatórios."
  ],
  partials_soja_enter: [
    "Aqui você acompanha a soja originada confirmada ao longo da rodada.",
    "Essa tela mostra o que já foi comprado, em quais volumes e sob quais condições operacionais.",
    "Ela serve para você entender a posição física que precisa ser administrada e monetizada.",
    "Use essa visão para verificar exposição, compromissos e necessidade de novos fechamentos."
  ],
  partials_frete_enter: [
    "Nesta tela você acompanha os fretes marítimos já contratados.",
    "O objetivo é enxergar como o custo logístico está sendo construído nas suas operações.",
    "Sempre compare esta visão com a soja originada e com os bids fechados para garantir coerência entre compra, logística e venda.",
    "Uma boa operação não depende só do preço, mas da combinação entre execução e custo."
  ],
  partials_bids_enter: [
    "Aqui você vê os bids já fechados e as condições comerciais assumidas na venda.",
    "Essa tela ajuda a enxergar a receita potencial das operações que você estruturou.",
    "A leitura correta aqui é cruzar preço, volume e porto com o que já foi originado e com o frete contratado.",
    "Assim você entende se a comercialização está andando na direção certa."
  ],
  partials_pl_enter: [
    "Nesta tela você acompanha o P/L parcial da rodada.",
    "Aqui o jogo consolida o impacto financeiro das suas compras, fretes e vendas até este momento.",
    "Use essa visão para perceber se a estratégia está gerando valor ou se algum elo da operação está comprimindo a margem.",
    "O P/L parcial não encerra a decisão, mas orienta os próximos passos com mais consciência."
  ],
  partials_closed_enter: [
    "Aqui ficam os negócios fechados, ou seja, os fluxos completos da soja desde a compra até a venda.",
    "Nesta tela você vê a ligação entre a soja originada no interior, o porto escolhido, o frete contratado e o bid fechado na China.",
    "Ela foi criada para mostrar o fluxo completo da operação de trading e facilitar a leitura do negócio já montado.",
    "Use o botão Detalhes para abrir a boleta completa de cada fluxo fechado."
  ],
  campaign_home: [],
  campaign_exw: []
};

const GUIDE_DEFAULT_FLOW_BY_SCREEN = {
  r1_home: "r1_home_enter",
  r1_exw: "r1_exw_enter",
  r1_cfr: "r1_cfr_enter",
  r1_frete: "r1_frete_enter",
  partials_menu: "partials_menu_enter",
  partials_bids: "partials_bids_enter",
  partials_frete: "partials_frete_enter",
  partials_soja: "partials_soja_enter",
  partials_pl: "partials_pl_enter",
  partials_closed: "partials_closed_enter"

};

function getModeRules() {
  return MODE_RULES[state.gameMode] || MODE_RULES.expert;
}

function isGuidedMode() {
  return !!getModeRules().showGuide;
}

function shouldChooseShipmentRound() {
  return !!getModeRules().chooseShipmentRound;
}

function getAutoShipmentRound() {
  const minRound = Number(state.round) || 1;
  const maxRound = Number(getActiveRules()?.rounds || 10);
  return Math.min(Math.max(minRound, 1), maxRound);
}

function currentGuideScreenId() {
  return String(state.stage || "").startsWith("results") ? "results_screen" : state.stage;
}

function canShowGuideFlow(flowKey) {
  if (!(isGuidedMode() || isCampaignMode())) return false;
  if (flowKey === "campaign_home") return getCampaignGuideContent("home").length > 0;
  if (flowKey === "campaign_exw") return getCampaignGuideContent("exw").length > 0;
  return !!GUIDE_CONTENT[flowKey];
}

function openGuideFlow(flowKey, force = false) {
  if (!canShowGuideFlow(flowKey)) return;
  if (!force && state.guideSeen[flowKey]) return;
  state.guideOverlayOpen = true;
  state.guideFlow = flowKey;
  state.guideStep = 0;
  if (!force) state.guideSeen[flowKey] = true;
  renderStage();
}

function closeGuideFlow() {
  if (!state.guideOverlayOpen) return;
  state.guideOverlayOpen = false;
  const lastFlow = state.guideFlow;
  state.guideFlow = null;
  state.guideStep = 0;
  if (isCampaignMode() && lastFlow === "campaign_home" && state.campaign.introRedirectPending) {
    state.campaign.introRedirectPending = false;
    setStage("r1_exw");
    return;
  }
  if (isCampaignMode() && lastFlow === "campaign_exw") {
    state.campaign.roundSplashUntil = 0;
    renderStage();
    setTimeout(() => {
      if (state.stage === "r1_exw") showCampaignRoundSplash(state.round || 1);
    }, 40);
    return;
  }
  renderStage();
}

function advanceGuideFlow() {
  if (!state.guideOverlayOpen || !state.guideFlow) return;
  const list = getGuideFlowContent(state.guideFlow);
  if (state.guideStep >= list.length - 1) {
    closeGuideFlow();
    return;
  }
  state.guideStep += 1;
  renderStage();
}

function maybeOpenGuideForScreen(screenId) {
  let flowKey = GUIDE_DEFAULT_FLOW_BY_SCREEN[screenId];
  if (isCampaignMode()) {
    if (screenId === "r1_home") flowKey = "campaign_home";
    if (screenId === "r1_exw") flowKey = "campaign_exw";
  }
  if (!flowKey) return;
  if (!isGuidedMode() && !isCampaignMode()) return;
  if (state.guideOverlayOpen) return;
  if (state.guideSeen[flowKey]) return;
  openGuideFlow(flowKey, false);
}

function triggerGuideEvent(flowKey) {
  if (!isGuidedMode()) return;
  if (state.guideOverlayOpen) return;
  openGuideFlow(flowKey, false);
}

// --------------------
// Calibração
// --------------------
const CALIB_KEY = "trading_game_calibration_v1";
let calib = null;
let calibEnabled = getCalibFlagFromUrlOrStorage(); // true/false

// Compat/migração: mantém o que o usuário já ajustou, mas adiciona itens novos que não existiam
function ensureCalibItem(screenId, itemId, def) {
  if (!calib) return;
  calib.screens = calib.screens || {};
  calib.screens[screenId] = calib.screens[screenId] || {};
  if (!calib.screens[screenId][itemId]) {
    calib.screens[screenId][itemId] = { ...def };
  }
}

function getCalibFlagFromUrlOrStorage() {
  const url = new URL(location.href);
  if (url.searchParams.has("calib")) {
    const v = url.searchParams.get("calib");
    const enabled = (v === "1" || v === "true");
    localStorage.setItem("calib_enabled", enabled ? "1" : "0");
    return enabled;
  }
  return localStorage.getItem("calib_enabled") === "1";
}

function toggleCalib(enabled) {
  calibEnabled = enabled;
  localStorage.setItem("calib_enabled", enabled ? "1" : "0");
  renderStage();
}

function loadCalibrationFromLocalStorage() {
  try {
    const raw = localStorage.getItem(CALIB_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function loadCalibrationFile() {
  try {
    const res = await fetch("./calibration.json", { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function saveCalibrationToLocalStorage() {
  localStorage.setItem(CALIB_KEY, JSON.stringify(calib, null, 2));
}

async function ensureCalibDefaults() {
  // ✅ Se NÃO estiver em calibração, sempre usa o arquivo calibration.json
  // (ignora qualquer coisa salva no navegador)
  if (!calibEnabled) {
    const fileCalib = await loadCalibrationFile();
    calib = fileCalib || { screens: {} };
    calib.screens ||= {};

    // garante os textos novos (frete e CFR) mesmo em modo normal
    ensureCalibItem("r1_frete", "text_frete_offers", defBox(180, 170, 520, 260, { font: 18 }));
    ensureCalibItem("r1_cfr",   "text_cfr_offers",   defBox(180, 170, 520, 260, { font: 18 }));
    return;
  }

  // ✅ Se ESTIVER em calibração, permite usar o que está salvo no navegador
  // para ir ajustando, mas se não existir, começa pelo arquivo.
  const saved = loadCalibrationFromLocalStorage();
  const fileCalib = await loadCalibrationFile();

  if (saved) {
    // usa o que o usuário já tinha, mas adiciona qualquer item novo do arquivo
    calib = saved;
    calib.screens ||= {};

    if (fileCalib && fileCalib.screens) {
      for (const [sid, sc] of Object.entries(fileCalib.screens)) {
        calib.screens[sid] ||= {};
        for (const [k, v] of Object.entries(sc || {})) {
          if (!calib.screens[sid][k]) calib.screens[sid][k] = v;
        }
      }
    }

    // garante os textos novos mesmo que o arquivo não tenha
    ensureCalibItem("r1_frete", "text_frete_offers", defBox(180, 170, 520, 260, { font: 18 }));
    ensureCalibItem("r1_cfr",   "text_cfr_offers",   defBox(180, 170, 520, 260, { font: 18 }));

    saveCalibrationToLocalStorage();
    return;
  }

  // primeira vez em calibração: começa do arquivo
  calib = fileCalib || { screens: {} };
  calib.screens ||= {};
  ensureCalibItem("r1_frete", "text_frete_offers", defBox(180, 170, 520, 260, { font: 18 }));
  ensureCalibItem("r1_cfr",   "text_cfr_offers",   defBox(180, 170, 520, 260, { font: 18 }));
  saveCalibrationToLocalStorage(); // cria o storage inicial para você editar
}

// Helpers de calib
function getScreenCalib(screenId) {
  calib.screens ||= {};
  calib.screens[screenId] ||= {};
  return calib.screens[screenId];
}

function defBox(x, y, w, h, extra = {}) {
  return { x, y, w, h, ...extra };
}

const GAME_ADMIN_OVERRIDE_KEY = "tradingGame.adminOverrides.v2";

function deepClone(obj){
  return JSON.parse(JSON.stringify(obj));
}

function deepMerge(base, override){
  if (Array.isArray(override)) return override.map(item => deepClone(item));
  if (!override || typeof override !== "object") return override;
  const out = (base && typeof base === "object" && !Array.isArray(base)) ? { ...base } : {};
  Object.keys(override).forEach((key) => {
    const oVal = override[key];
    const bVal = out[key];
    if (Array.isArray(oVal)) {
      out[key] = oVal.map(item => deepClone(item));
    } else if (oVal && typeof oVal === "object") {
      out[key] = deepMerge(bVal, oVal);
    } else {
      out[key] = oVal;
    }
  });
  return out;
}


const GAME_MODE_DATA_KEYS = ["guided", "expert", "campaign"];

function getLegacyModeSeed(data){
  return {
    scenarios: deepClone(Array.isArray(data?.scenarios) ? data.scenarios : []),
    rules: deepClone(data?.rules || {}),
    corridorList: deepClone(data?.corridorList || [])
  };
}

function normalizeGameDataModes(data){
  if (!data || typeof data !== "object") return data;
  const seed = getLegacyModeSeed(data);
  data.modes = (data.modes && typeof data.modes === "object") ? data.modes : {};
  GAME_MODE_DATA_KEYS.forEach((key) => {
    const current = (data.modes[key] && typeof data.modes[key] === "object") ? data.modes[key] : {};
    data.modes[key] = {
      ...current,
      scenarios: Array.isArray(current.scenarios) ? current.scenarios : deepClone(seed.scenarios),
      rules: current.rules && typeof current.rules === "object" ? current.rules : deepClone(seed.rules),
      corridorList: Array.isArray(current.corridorList) ? current.corridorList : deepClone(seed.corridorList)
    };
  });
  // Compatibilidade com trechos legados: mantém o topo apontando para Expert.
  if (!Array.isArray(data.scenarios)) data.scenarios = deepClone(data.modes.expert.scenarios || []);
  if (!data.rules || typeof data.rules !== "object") data.rules = deepClone(data.modes.expert.rules || {});
  if (!Array.isArray(data.corridorList)) data.corridorList = deepClone(data.modes.expert.corridorList || []);
  return data;
}

function getActiveModeDataKey(){
  if (state?.primaryMode === "campaign" || isCampaignMode()) return "campaign";
  if (state?.gameMode === "guided") return "guided";
  if (state?.gameMode === "expert") return "expert";
  return "expert";
}

function getModeGameData(modeKey){
  const normalized = normalizeGameDataModes(gameData || {});
  const key = GAME_MODE_DATA_KEYS.includes(modeKey) ? modeKey : "expert";
  return normalized?.modes?.[key] || normalized;
}

function getCampaignModeData(){
  return getModeGameData("campaign") || {};
}

function getCampaignLevelsData(){
  const campaignData = getCampaignModeData();
  return Array.isArray(campaignData.levels) ? campaignData.levels : [];
}

function getCampaignLevelData(levelId){
  const id = Number(levelId || state?.campaign?.levelId || 1);
  return getCampaignLevelsData().find(l => Number(l?.id) === id) || null;
}

function getCampaignScenarioForLevel(levelId){
  const levelData = getCampaignLevelData(levelId);
  if (levelData?.scenario?.rounds) return levelData.scenario;
  const campaignData = getCampaignModeData();
  const scenarioId = Number(levelData?.scenarioId || levelId || 1);
  return (campaignData.scenarios || []).find(s => Number(s?.id) === scenarioId) || (campaignData.scenarios || [])[0];
}

function getActiveGameData(){
  if (getActiveModeDataKey() !== "campaign") return getModeGameData(getActiveModeDataKey());
  const campaignData = getCampaignModeData();
  if (!isCampaignMode()) return campaignData;
  const levelData = getCampaignLevelData(state.campaign.levelId || 1);
  const scenario = getCampaignScenarioForLevel(state.campaign.levelId || 1);
  return {
    ...campaignData,
    rules: levelData?.rules || campaignData.rules || {},
    scenarios: scenario ? [scenario] : (campaignData.scenarios || []),
    corridorList: campaignData.corridorList || []
  };
}

function getActiveRules(){
  return getActiveGameData()?.rules || {};
}

function getActiveScenarios(){
  return Array.isArray(getActiveGameData()?.scenarios) ? getActiveGameData().scenarios : [];
}

function getActiveCorridorList(){
  return Array.isArray(getActiveGameData()?.corridorList) ? getActiveGameData().corridorList : [];
}

function loadAdminOverrides(){
  try {
    const raw = localStorage.getItem(GAME_ADMIN_OVERRIDE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === "object") ? parsed : null;
  } catch (e) {
    console.warn("[admin] overrides inválidos no localStorage", e);
    return null;
  }
}

function applyAdminOverrides(baseGameData){
  const overrides = loadAdminOverrides();
  const hasOverrides = !!(overrides && Object.keys(overrides).length);
  window.__TRADING_GAME_HAS_ADMIN_OVERRIDES = hasOverrides;
  if (!hasOverrides) return baseGameData;
  try {
    // Compatibilidade: overrides antigos do admin não tinham separação por modo.
    // Quando encontrados, eles são replicados nos três modos apenas na migração inicial.
    if (overrides && !overrides.modes && (overrides.scenarios || overrides.rules || overrides.corridorList)) {
      const seed = getLegacyModeSeed(overrides);
      overrides.modes = {
        guided: deepClone(seed),
        expert: deepClone(seed),
        campaign: deepClone(seed)
      };
    }
    return deepMerge(baseGameData, overrides);
  } catch (e) {
    console.warn("[admin] falha ao aplicar overrides", e);
    return baseGameData;
  }
}


async function fetchJsonNoStore(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return await res.json();
}

async function loadSplitGameDataFiles() {
  const manifest = await fetchJsonNoStore("./data/gameData.manifest.json");
  const guidedPath = manifest.guided || "./data/guided/gameData.json";
  const expertPath = manifest.expert || "./data/expert/gameData.json";
  const campaignPath = manifest.campaign || "./data/campaign/campaignData.json";
  const levelPaths = Array.isArray(manifest.campaignLevels) ? manifest.campaignLevels : [];

  const [guided, expert, campaignBase] = await Promise.all([
    fetchJsonNoStore(guidedPath),
    fetchJsonNoStore(expertPath),
    fetchJsonNoStore(campaignPath)
  ]);

  const levels = [];
  for (const levelPath of levelPaths) {
    try {
      levels.push(await fetchJsonNoStore(levelPath));
    } catch (err) {
      console.warn("[dados] falha ao carregar level da campanha", levelPath, err);
    }
  }
  levels.sort((a, b) => Number(a?.id || 0) - Number(b?.id || 0));

  const campaign = { ...(campaignBase || {}), levels };
  delete campaign.levelIndex;

  return normalizeGameDataModes({
    scenarios: deepClone(expert?.scenarios || []),
    rules: deepClone(expert?.rules || {}),
    corridorList: deepClone(expert?.corridorList || []),
    modes: {
      guided: guided || {},
      expert: expert || {},
      campaign
    }
  });
}

async function loadBaseGameDataFiles() {
  try {
    return await loadSplitGameDataFiles();
  } catch (splitErr) {
    console.warn("[dados] estrutura separada indisponível; usando gameData.json como fallback", splitErr);
    const res = await fetch("./gameData.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`Erro ao carregar gameData.json: ${res.status}`);
    return await res.json();
  }
}

// --------------------
// Carregar dados
// --------------------
async function loadGameData() {
  try {
    const baseGameData = await loadBaseGameDataFiles();
    gameData = normalizeGameDataModes(applyAdminOverrides(baseGameData));
    await ensureCalibDefaults();
    // ✅ Novo fluxo: antes do Start, abre a tela inicial do tutorial (landing)
    // (o Start original continua existindo como 'home_canva')
    state.campaign.unlockedLevel = getCampaignUnlockedLevel();
    setStage("tutorial_0");
  } catch (err) {
    screen.innerHTML = `
      <div class="card">
        <h1>Erro</h1>
        <p>Não consegui carregar os <b>arquivos de dados do jogo</b>.</p>
        <p class="small">${err.message}</p>
      </div>
    `;
    console.error(err);
  }
}

function getScenario() {
  return getActiveScenarios().find(s => s.id === state.scenarioId) || getActiveScenarios()[0];
}

function pickRandomScenarioId() {
  const arr = getActiveScenarios();
  if (!arr.length) return 1;

  // evita repetir o mesmo cenário em partidas consecutivas (se localStorage estiver disponível)
  const key = "tg_lastScenarioId";
  let last = 0;
  try {
    last = parseInt(localStorage.getItem(key) || "0", 10) || 0;
  } catch (_) {
    last = 0;
  }

  let candidates = arr;
  if (arr.length > 1 && last) {
    candidates = arr.filter(s => (s && typeof s.id === "number") ? s.id !== last : true);
    if (!candidates.length) candidates = arr;
  }

  // random mais robusto (crypto quando disponível)
  let idx = 0;
  try {
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      const u32 = new Uint32Array(1);
      crypto.getRandomValues(u32);
      idx = u32[0] % candidates.length;
    } else {
      idx = Math.floor(Math.random() * candidates.length);
    }
  } catch (_) {
    idx = Math.floor(Math.random() * candidates.length);
  }

  const chosen = candidates[idx] || candidates[0];
  const id = (chosen && typeof chosen.id === "number") ? chosen.id : 1;

  try { localStorage.setItem(key, String(id)); } catch (_) {}
  return id;
}



function getRoundData(r) {
  return getScenario().rounds.find(x => x.round === r);
}


function getCurrentExwOffersForRender(rd) {
  // Fonte única para a tela EXW: os sacos dinâmicos e o quadro "OFERTAS EXW"
  // sempre devem ler o mesmo array da rodada atual.
  // No modo campanha, força a leitura da rodada ativa para evitar tabela presa em dados antigos.
  const activeRoundData = isCampaignMode() ? getRoundData(state.round) : rd;
  const offers = Array.isArray(activeRoundData?.offers_exw) ? activeRoundData.offers_exw : [];
  return offers;
}

function formatOfferDisplayName(offer) {
  if (!offer) return "Oferta";
  // O quadro OFERTAS EXW deve exibir o nome principal da oferta,
  // o mesmo que aparece no resumo ao selecionar o saco.
  // Prioridade correta: label/nome editável > cidade/UF > map_label.
  const raw = String(offer.label || offer.name || offer.nome || "").trim();
  if (raw) return raw.split(" - ")[0].trim();
  if (offer.city && offer.uf) return `${String(offer.city).trim()} ${String(offer.uf).trim()}`.trim();
  if (offer.city) return String(offer.city).trim();
  if (offer.map_label) return String(offer.map_label).trim();
  return "Oferta";
}

function isTimeControlEnabled() {
  if (isCampaignMode()) return false;
  return getActiveRules()?.time_control_enabled !== false;
}

// --------------------
// Timer (corrigido p/ atualizar o tempo dentro da imagem)
// --------------------
function getTimerString() {
  if (!isTimeControlEnabled()) return "Tempo livre";
  if (state.running && state.roundEndTs) {
    const now = Date.now();
    state.timeLeft = Math.max(0, Math.ceil((state.roundEndTs - now) / 1000));
  }
  return state.running
    ? `Tempo: ${String(state.timeLeft).padStart(2, "0")}s`
    : "--";
}

function setTimerText() {
  const txt = getTimerString();

  // topo
  if (timerBox) timerBox.textContent = txt;

  // ✅ tempo dentro da imagem (overlay)
  const inImg = document.getElementById("txt_text_tempo");
  if (inImg) inImg.textContent = txt;

  // ✅ também atualiza o número da rodada na imagem, caso esteja visível
  const roundEl = document.getElementById("txt_text_round");
  if (roundEl) roundEl.textContent = String(state.round);
}

function stopTimer() {
  state.running = false;
  if (state.interval) clearInterval(state.interval);
  state.interval = null;
  state.roundEndTs = null;
  setTimerText();
}

function startTimer() {
  if (state.interval) clearInterval(state.interval);
  state.interval = null;

  if (!isTimeControlEnabled()) {
    state.running = false;
    state.roundEndTs = null;
    setTimerText();
    return;
  }

  const duration = Math.max(0, Number(getActiveRules()?.time_per_round_s ?? state.timeLeft ?? 120));
  state.timeLeft = duration;
  state.roundEndTs = Date.now() + duration * 1000;
  state.running = true;
  setTimerText();

  state.interval = setInterval(() => {
    const now = Date.now();
    state.timeLeft = Math.max(0, Math.ceil((state.roundEndTs - now) / 1000));
    setTimerText();

    if (state.timeLeft <= 0) {
      stopTimer();
      nextRound();
    }
  }, 250);
}

// --------------------
// Navegação / Stages
// --------------------
function setStage(stage) {
  const from = state.stage;
  const to = stage;

  state.prevStage = state.stage;
  state.stage = stage;
  if (isCampaignMode() && Number(state.campaign?.levelId) === 1) {
    if (stage !== 'r1_exw') {
      state.campaign.l1Focus = false;
      document.getElementById('l1wb-dialog')?.remove();
    } else if (from !== 'r1_exw') {
      // A arte original permanece visível por padrão, inclusive no celular.
      // Leitura ampliada e calculadora são escolhas explícitas do jogador.
      state.campaign.l1Focus = false;
      state.campaign.l1CalcVisible = false;
    }
  }

  // 🎵 Música
  if (to === "r1_home" && from !== "r1_home") {
    fadeInBgmHome();
  }

  if (from === "r1_home" && to !== "r1_home") {
    fadeOutBgmHome();
  }

  renderStage();

  // ============================
  // BOTÃO MTM (depois do render)
  // ============================
  const btn = document.getElementById("btnMtm");

  if (!btn) return;

  if (to === "r1_home") {
    btn.style.display = "block";
    // posiciona o botão embaixo do "canvas" do jogo
    requestAnimationFrame(positionMtmButton);
  } else {
    btn.style.display = "none";
  }
}

function openPartialsMenu() {
  // Memoriza a tela de trabalho; navegar pelas sub-telas não deve substituir o retorno.
  const origin=state.stage;
  state.partialsReturnStage = origin.startsWith('partials_') ? (state.partialsReturnStage || 'r1_exw') : origin;
  setStage('partials_menu');
}

function backFromPartials() {
  // Soja Originada → Menu do Trader → Oferta EXW (ou tela de origem).
  if (state.stage !== 'partials_menu' && String(state.stage).startsWith('partials_')) {
    setStage('partials_menu');
    return;
  }
  const destination=state.partialsReturnStage || (isCampaignMode() ? 'r1_exw' : 'r1_home');
  state.partialsReturnStage=null;
  setStage(destination);
}
function renderHome() {
  stopTimer();
  state.stage = "home_canva";
  renderStage();
}

function resetGameStateForNewRun() {
  // mantém shipCount escolhido (se já tiver sido selecionado)
  state.round = 0;
  state.running = false;
  state.timeLeft = 0;
  if (state.interval) clearInterval(state.interval);
  state.interval = null;
  state.roundEndTs = null;

  state.choices = { exw: {}, ocean: {}, china: {} };
  state.confirmed = { exw: {}, ocean: {}, china: {} };
  state.exwPositions = []; // reset carteira EXW

  // reset freight plans (avoid carry-over between runs)
  state.freightPlansByPort = {};
  state.freightPlans = [];
  state.freightPlanByRound = {};
  state.freightPlansByPort = {};
  delete state.freightPlan; // legado

  state.ui.showDetails = false;
  state.partialsReturnStage = null;
  state.totalRounds = 0;
  state.primaryMode = state.primaryMode === "campaign" ? state.primaryMode : null;
  if (!isCampaignMode()) {
    state.campaign.active = false;
    state.campaign.levelId = null;
    state.campaign.introRedirectPending = false;
  }
}


function startGame() {
  state.primaryMode = "scenarios";
  state.round = 1;
  state.totalRounds = getActiveRules()?.rounds ?? 5;
  state.scenarioId = pickRandomScenarioId();
  state.choices = { exw: {}, ocean: {}, china: {} };
  state.confirmed = { exw: {}, ocean: {}, china: {} };
  state.exwPositions = []; // inicia carteira EXW vazia
  state.ui.showDetails = false;
  state.guideSeen = {};
  state.guideOverlayOpen = false;
  state.guideFlow = null;
  state.guideStep = 0;

  state.timeLeft = isTimeControlEnabled() ? (getActiveRules().time_per_round_s ?? 120) : 0;
  startTimer();
  setStage("r1_home");
}


function processEmbarkmentsForRound(roundNum){
  // ✅ NOVA LÓGICA (embarque progressivo):
  // - Se o frete foi marcado para embarcar na rodada X, a partir de X o navio "abre".
  // - Em cada rodada >= X, embarcamos o que houver disponível (FIFO) até completar 60k.
  // - Assim, compras feitas após a rodada X entram no custo do embarque.
  const rules = getActiveRules() || {};
  const shipSizeT = rules.ship_sizes_t?.[0] ?? 60000;

  state.freightPlansByPort = (state.freightPlansByPort && typeof state.freightPlansByPort === "object") ? state.freightPlansByPort : {};
  const plans = state.freightPlansByPort;

  Object.keys(plans).forEach((port) => {
    const plan = plans[port];
    if (!plan || !plan.targetRound) return;
    if (roundNum < plan.targetRound) return;

    // só embarca se houver BID vinculado
    const bidRound = plan.linkedBidRound ?? null;
    if (!bidRound) {
      plan.shippedRound = roundNum;
      plan.shipped_t = 0;
      plan.shipCostUsd = 0;
      plan.shipComplete = false;
      return;
    }

    const prevShipped = Number(plan.shipped_t ?? 0);

    // Recalcula embarcado acumulado (FIFO) com base nas compras até a rodada atual.
    const lots = buildPortLotsUpToRound(port, roundNum);
    const res = consumeLotsFIFO(lots, shipSizeT);

    const newShipped = Number(res.taken_t ?? 0);
    plan.shippedRound = roundNum;          // última rodada em que recalculamos/atualizamos
    plan.shipped_t = newShipped;           // embarcado acumulado até a rodada atual
    plan.shipCostUsd = Number(res.cost_usd ?? 0); // custo (USD) do que foi embarcado (FIFO)
    plan.shipComplete = (newShipped >= shipSizeT - 1e-9);

    // Atualiza o BID apenas pelo delta (para não somar repetido a cada rodada)
    const delta = Math.max(0, newShipped - prevShipped);
    state.confirmed = state.confirmed || {};
    state.confirmed.china = state.confirmed.china || {};
    state.confirmed.cfr = state.confirmed.cfr || {};
    const bid = state.confirmed.china[bidRound] || state.confirmed.cfr[bidRound];
    if (bid && delta > 0) {
      bid.shipped_t = (bid.shipped_t ?? 0) + delta;
      bid.shippedPort = port;
      bid.shippedRound = roundNum;
    }
  });
}

function nextRound() {
  // DEMURRAGE CHECK (por porto)
  // Cobra na entrada da PRÓXIMA rodada (R = state.round + 1) se:
  // R > targetRound e totalCompradoNoPorto < 60.000 t
  const nextR = state.round + 1;

  // soma compras EXW confirmadas por porto até a rodada atual
  const boughtByPort = {};
  for (let r = 1; r <= state.round; r++) {
    const exw = getConfirmedChoice(state.confirmed.exw, r);
    if (!exw) continue;
    const p = exw.corredor;
    const v = (exw.volume_t ?? 0);
    if (!p) continue;
    boughtByPort[p] = (boughtByPort[p] || 0) + v;
  }

  state.freightPlansByPort = (state.freightPlansByPort && typeof state.freightPlansByPort === 'object') ? state.freightPlansByPort : {};
  Object.keys(state.freightPlansByPort).forEach((port) => {
    const plan = state.freightPlansByPort[port];
    if (!plan || !plan.targetRound) return;

    const bought = boughtByPort[port] || 0;
    const required = 60000;
    if (nextR > plan.targetRound && bought < required) {
      if (plan.lastChargedRound !== nextR) {
        plan.demurrageAcc = (plan.demurrageAcc ?? 0) + (plan.demurrageUsdPerRound ?? 0);
        plan.lastChargedRound = nextR;
      }
    }
  });

const totalRounds = state.totalRounds || getActiveRules()?.rounds || 5;

  if (state.round < totalRounds) {
    state.round += 1;
    // Embarque automático: consome estoque SOMENTE na rodada de embarque selecionada
    processEmbarkmentsForRound(state.round);

    state.timeLeft = isTimeControlEnabled() ? (getActiveRules().time_per_round_s ?? 120) : 0;
    startTimer();
    if (isCampaignMode()) {
      if (Number(state.campaign?.levelId) === 1) {
        state.campaign.l1Tab = 'market';
        state.campaign.l1CalcVisible = false;
        state.campaign.l1Focus = false; // Não encobrir a arte original ao avançar rodada
      }
      state.campaign.roundSplashUntil = 0;
      setStage("r1_exw");
      setTimeout(() => {
        if (state.stage === "r1_exw") showCampaignRoundSplash(state.round || 1);
      }, 40);
    } else {
      setStage("r1_home");
    }
    setTimerText();
  } else {
    stopTimer();
    if (isCampaignMode()) {
      state.campaign.roundSplashUntil = 0;
      const fixedSplash = document.getElementById('campaignRoundSplashFixed');
      if (fixedSplash) fixedSplash.remove();
      const result = buildCampaignLevel1Result();
      if (Number(state.campaign?.levelId) === 1) saveCampaignL1Record(result);
      if (result.approved) unlockNextCampaignLevel(state.campaign.levelId || 1);
      setStage("campaign_result");
    } else {
      // ✅ abre tela de resultados (com imagem)
      setStage("results");
    }
  }
}

function renderStage() {
  const rd = getRoundData(state.round || 1);

  if (state.stage === "mode_select") return renderPrimaryModeSelect();
  if (state.stage === "scenario_select") return renderScenarioModeSelect();
  if (state.stage === "campaign_menu") return renderImageScreen("campaign_menu", "assets/campaign_menu_bg.png", rd);
  if (state.stage === "campaign_result") return renderCampaignResultScreen();

  // ✅ TUTORIAL (5 telas antes do Start)
  if (state.stage && String(state.stage).startsWith("tutorial_")) {
    const sid = String(state.stage);
    const idx = parseInt(sid.split("_")[1] || "0", 10) || 0;
    return renderImageScreen(sid, `assets/tutorial_${idx}.png`, rd);
  }

  if (state.stage === "home_canva") {
    return renderImageScreen("home_canva", "assets/r1_inicial.png", rd);
  }

  if (state.stage === "home") return renderHome();

  // ✅ RESULTADOS: agora é uma tela de imagem + overlays
  if (state.stage === "results") {
    // imagem deve existir em: assets/results_screen.png
    return renderImageScreen("results_screen", "assets/results_screen.png", rd);
  }

  switch (state.stage) {
    case "ship_select": return renderImageScreen("ship_select", "assets/ship_select.png", rd);
    case "r1_home": return renderImageScreen("r1_home", "assets/r1_home.png", rd);
    case "r1_news": return renderImageScreen("r1_news", "assets/r1_noticias.png", rd);
    case "r1_exw": return renderImageScreen("r1_exw", isCampaignMode() ? "assets/r1_exw_campaign_dynamic.png" : "assets/r1_exw.png", rd);
    case "r1_frete": return renderImageScreen("r1_frete", "assets/r1_frete.png", rd);
    case "r1_cfr": return renderImageScreen("r1_cfr", "assets/r1_cfr.png", rd);

    // Parciais (menu + telas)
    case "partials_menu": return renderImageScreen("partials_menu", "assets/partials_menu.png", rd);
    case "partials_soja": return renderImageScreen("partials_soja", "assets/partials_soja.png", rd);
    case "partials_frete": return renderImageScreen("partials_frete", "assets/partials_frete.png", rd);
    case "partials_bids": return renderImageScreen("partials_bids", "assets/partials_bids.png", rd);
    case "partials_pl": return renderImageScreen("partials_pl", "assets/partials_pl.png", rd);
    case "partials_closed": return renderImageScreen("partials_closed", "assets/partials_pl.png", rd);

    default: return renderHome();
  }
}

function renderPrimaryModeSelect() {
  screen.innerHTML = `
    <section class="campaign-shell">
      <div class="campaign-card campaign-card-lg">
        <div class="campaign-kicker">TRADING GAMES</div>
        <h1>Escolha como deseja jogar</h1>
        <p class="campaign-lead">O modo cenários mantém a navegação aberta do simulador. O modo campanha apresenta desafios progressivos, com escopo controlado e foco didático.</p>
        <div class="campaign-actions campaign-actions-stack">
          <button class="campaign-btn campaign-btn-dark" onclick="setStage('campaign_menu')">Modo Campanha</button>
          <button class="campaign-btn campaign-btn-light" onclick="setStage('scenario_select')">Modo Cenários</button>
        </div>
      </div>
    </section>
  `;
}

function renderScenarioModeSelect() {
  screen.innerHTML = `
    <section class="campaign-shell">
      <div class="campaign-card campaign-card-lg">
        <div class="campaign-kicker">MODO CENÁRIOS</div>
        <h1>Escolha o formato do jogo aberto</h1>
        <p class="campaign-lead">O modo guiado mantém o canguru e as explicações contextuais. O modo expert retira a ajuda e libera o fluxo completo tradicional.</p>
        <div class="campaign-grid-2">
          <button class="campaign-choice ${state.gameMode === 'guided' ? 'is-active' : ''}" onclick="window.selectScenarioMode('guided')">
            <strong>Jogo Guiado / Iniciante</strong>
            <span>Com guia, balões e ajuda contextual.</span>
          </button>
          <button class="campaign-choice ${state.gameMode === 'expert' ? 'is-active' : ''}" onclick="window.selectScenarioMode('expert')">
            <strong>Jogo Expert</strong>
            <span>Fluxo completo, sem ajuda na tela.</span>
          </button>
        </div>
        <div class="campaign-actions">
          <button class="campaign-btn campaign-btn-light" onclick="setStage('mode_select')">Voltar</button>
          <button class="campaign-btn campaign-btn-dark" onclick="window.startScenarioModeFromMenu()">Entrar no modo cenários</button>
        </div>
      </div>
    </section>
  `;
}

function renderCampaignMenu() {
  return renderImageScreen("campaign_menu", "assets/campaign_menu_bg.png", state.roundData[state.round] || {});
}

function renderCampaignResultScreen() {
  if (isCampaignMode() && Number(state.campaign?.levelId) !== 1) return renderCampaignResultScreenLegacy();
  const result = buildCampaignLevel1Result();
  const level = result.level;
  const rows = result.usedLots.length ? result.usedLots.map(lot => `
    <tr><td>R${lot.round}</td><td>${escapeHtml(lot.origin)}</td><td>${formatTon(lot.usedVolumeT)} t</td>
    <td>${lot.interiorCentBu.toFixed(1)}</td><td>${lot.inlandCentBu.toFixed(1)}</td>
    <td>${lot.fobbingCentBu.toFixed(1)}</td><td>${lot.maritimeCentBu.toFixed(1)}</td>
    <td>${lot.cfrCostCentBu.toFixed(1)}</td><td>${lot.basisCentBu.toFixed(1)}</td></tr>
  `).join('') : `<tr><td colspan="9">Nenhuma compra confirmada no level.</td></tr>`;
  const verdict = result.approved ? 'RESULTADO SATISFATÓRIO' : 'RESULTADO NÃO SATISFATÓRIO';
  const diagnosis = result.excessT > 0
    ? `Compra excedente de ${formatTon(result.excessT)} t: a capacidade é ${formatTon(level.targetVolumeT)} t. O resultado não autoriza excedentes; use compras parciais para completar o navio. Basis e margem são calculados apenas sobre ${formatTon(result.totalUsedT)} t.`
    : result.missingT > 0
      ? `Faltaram ${formatTon(result.missingT)} t para completar o cargo de ${formatTon(level.targetVolumeT)} t.`
      : result.basisAvg > level.targetBasisCentBu
        ? `Navio completo, mas o basis médio ${formatCampaignSigned(result.basisAvg, 1, ' c/bu')} supera o teto de +${level.targetBasisCentBu.toFixed(1)} c/bu.`
        : result.grossMarginUsd <= 0
          ? `Navio completo e basis dentro da meta, porém margem bruta não positiva. Revise a estrutura comercial.`
          : `Navio completo, basis médio dentro da meta e margem bruta positiva frente à venda CFR simulada.`;
  const nextLevel = getCampaignLevelData(2);
  const nextReady = !!(nextLevel?.scenario?.rounds?.length);
  const score = result.scorecard;
  const approvedText = result.approved
    ? (nextReady ? 'Level 2 desbloqueado. Você já pode acessar a próxima missão.' : 'Level 2 desbloqueado no progresso. A missão seguinte ainda está em desenvolvimento.')
    : (result.economicApproved ? `Condições econômicas atendidas, mas a nota ${score.total} está abaixo da mínima ${score.minScore}. Revise a qualidade da originação.` : 'Revise as condições econômicas obrigatórias e tente novamente.');
  screen.innerHTML = `
    <section class="campaign-shell">
      <div class="campaign-card campaign-card-xl">
        <div class="campaign-kicker">LEVEL 1 — RESULTADO FINAL</div>
        <h1>${verdict}</h1>
        <p class="campaign-lead">Operação simulada de originação, com destino e logística principal já definidos. Venda CFR China: +${level.fixedSaleBasisCentBu.toFixed(1)} c/bu · frete marítimo fixo: US$ ${level.fixedFreightUsdT.toFixed(2)}/t · fobbing: US$ ${level.fixedFobbingUsdT.toFixed(2)}/t.</p>
        <div class="campaign-metrics">
          <div class="metric-box"><span>Volume-alvo</span><strong>${formatTon(level.targetVolumeT)} t</strong></div>
          <div class="metric-box"><span>Volume contratado</span><strong>${formatTon(result.totalBoughtT)} t</strong></div>
          <div class="metric-box"><span>Basis médio CFR eq.</span><strong>${formatCampaignSigned(result.basisAvg, 1, ' c/bu')}</strong></div>
          <div class="metric-box"><span>Meta do nível</span><strong>≤ +${level.targetBasisCentBu.toFixed(1)} c/bu</strong></div>
          <div class="metric-box"><span>Margem bruta indicativa</span><strong>${formatCampaignUsd(result.grossMarginUsd, 0)}</strong></div>
        </div>
        <div class="campaign-diagnosis">${diagnosis}</div>
        ${campaignL1ScoreMarkup(score)}
        <div class="campaign-diagnosis">${approvedText}</div>
        <details class="l1-result-details"><summary>Auditar os lotes e a formação do custo CFR equivalente</summary><div class="campaign-table-wrap">
          <table class="campaign-table">
            <thead><tr><th>Rodada</th><th>Origem</th><th>Volume</th><th>Soja interior</th><th>Rodoviário</th><th>Fobbing</th><th>Marítimo</th><th>Custo CFR eq.</th><th>Basis</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div></details>
        <p class="campaign-lead" style="font-size:13px;margin-top:10px">Valores em c/bu, salvo volume. A margem indicada é didática e não inclui hedge executado, capital, custos financeiros, impostos ou marcação a mercado. Preços, volumes e venda são simulados.</p>
        <div class="campaign-actions">
          <button class="campaign-btn campaign-btn-light" onclick="window.restartCampaignLevel()">Repetir level</button>
          <button class="campaign-btn campaign-btn-light" onclick="window.backToCampaignMenu()">Voltar ao menu campanha</button>
          ${result.approved && nextReady ? '<button class="campaign-btn campaign-btn-dark" onclick="window.backToCampaignMenu()">Próximo level</button>' : ''}
        </div>
      </div>
    </section>
  `;
}

// --------------------
// Render tela por imagem
// --------------------
function renderImageScreen(screenId, imgSrc, rd) {
  screen.innerHTML = `
    <div class="canvas-screen" id="canvasWrap" style="opacity:0;">
      <div class="canvas-stage" id="canvasStage">
        <img class="bg" id="bgImg" src="${imgSrc}" alt="${screenId}" />
        <div class="overlay-layer" id="overlayLayer"></div>
      </div>
      ${calibEnabled ? renderCalibPanelHTML(screenId) : ""}
    </div>
  `;

  const wrap = document.getElementById("canvasWrap");
  const stage = document.getElementById("canvasStage");
  const img = document.getElementById("bgImg");

  const applyCanvasStageScale = () => {
    if (!wrap || !stage) return;
    const w = wrap.clientWidth || 0;
    const h = wrap.clientHeight || 0;
    if (!w || !h) return;

    const s = Math.min(w / BASE_W, h / BASE_H);
    stage.style.transform = `scale(${s})`;
    stage.style.left = `${Math.max(0, (w - BASE_W * s) / 2)}px`;
    stage.style.top = `${Math.max(0, (h - BASE_H * s) / 2)}px`;
  };

  const afterLayout = () => {
    applyCanvasStageScale();
    if (wrap) { wrap.style.opacity = "1"; }
    renderOverlaysForScreen(screenId, rd);
    if (window.updateLinkBidLaterButton) window.updateLinkBidLaterButton(screenId);
    if (!state.guideOverlayOpen) {
      setTimeout(() => maybeOpenGuideForScreen(screenId), 0);
    }
    setTimerText();
    if (calibEnabled) bindCalibPanel(screenId, rd);

    // Reposiciona MTM (botão e modal) quando a tela muda
    if (screenId === "r1_home") {
      positionMtmButton();
    }
    requestAnimationFrame(repositionOpenCanvasModals);
  };

  img.onload = () => {
    afterLayout();
  };

  // Evita empilhar listeners a cada render
  if (window.__canvasResizeHandler) {
    window.removeEventListener("resize", window.__canvasResizeHandler);
  }
  window.__canvasResizeHandler = () => {
    applyCanvasStageScale();
    // MTM acompanha a área do jogo
    if (screenId === "r1_home") positionMtmButton();
    requestAnimationFrame(repositionOpenCanvasModals);
  };
  window.addEventListener("resize", window.__canvasResizeHandler, { passive: true });

  // fallback (caso onload já tenha disparado antes)
  setTimeout(() => {
    afterLayout();
  }, 30);
}

function pxToPctX(px) { return (px / BASE_W) * 100; }
function pxToPctY(px) { return (px / BASE_H) * 100; }

function placeBox(el, box) {
  el.style.left = `${pxToPctX(box.x)}%`;
  el.style.top = `${pxToPctY(box.y)}%`;
  el.style.width = `${pxToPctX(box.w)}%`;
  el.style.height = `${pxToPctY(box.h)}%`;
}

// --------------------
// RESULTADOS: textos e helpers
// --------------------

function buildResultsPayload() {
  // Resultado final (3 blocos):
  // 1) Geral
  // 2) Por Negociação (BID/Navio) – até 5 (1 por porto)
  // 3) Por Porto – 5 portos sempre
  try {
    const rules = getActiveRules() || {};
    const roundsMax = rules.rounds || 10;
    const shipSizeT = (rules.ship_sizes_t && rules.ship_sizes_t[0]) ? rules.ship_sizes_t[0] : 60000;

    // Ordem fixa dos 5 portos (sempre mostrar)
    const PORTS = ["barcarena","itaqui","santos","paranagua","riogrande"];

    const confirmed = state.confirmed || {};
    const exwByRound = confirmed.exw || {};
    const bidsByRound = (confirmed.china || confirmed.cfr || {});
    const oceanByPort = confirmed.ocean || {};
    const plansByPort = (state.freightPlansByPort && typeof state.freightPlansByPort === "object") ? state.freightPlansByPort : oceanByPort;

    function getBidRoundForPort(portKey){
      // 1) prefer plan.linkedBidRound
      const pl = plansByPort && plansByPort[portKey];
      if (pl && pl.linkedBidRound) return parseInt(pl.linkedBidRound,10);

      // 2) search bids with linkedFreightPort == portKey
      const china = confirmed.china || {};
      for (const [r, b] of Object.entries(china)){
        if (b && b.linkedFreightPort === portKey) return parseInt(r,10);
      }
      return null;
    }

    function getBid(bidRound){
      if (!bidRound) return null;
      const china = confirmed.china || {};
      const cfr = confirmed.cfr || {};
      return china[bidRound] || cfr[bidRound] || null;
    }

    function getPlan(portKey){
      const pl = (plansByPort && plansByPort[portKey]) ? plansByPort[portKey] : null;
      if (!pl) return null;
      // normalize
      pl.embarqueRound = pl.embarqueRound || pl.embarque || pl.targetRound || pl.target || null;
      pl.usd_t = (typeof pl.usd_t === "number") ? pl.usd_t : (typeof pl.price_usd_t === "number" ? pl.price_usd_t : pl.usdT);
      pl.demurrageAcc = (typeof pl.demurrageAcc === "number") ? pl.demurrageAcc : 0;
      pl.shipped_t = (typeof pl.shipped_t === "number") ? pl.shipped_t : 0;
      return pl;
    }

    function fmtNegLabel(i){ return `Negociação ${i}`; }

    // --- Consolidar negociações (1 por porto, até 5)
    const negotiations = [];
    const notes = [];

    // flags de “uso” por porto (para bloco 3)
    const portUsage = {};
    PORTS.forEach(p => portUsage[p] = { used:false, messages:[], negotiation:null });

    // detectar originação por porto (informativo)
    const originByPort = {};
    PORTS.forEach(p => originByPort[p]=0);
    for (const c of Object.values(exwByRound)){
      if (!c) continue;
      const p = c.corredor || null;
      if (p && originByPort[p] != null) originByPort[p] += (c.volume_t ?? c.volume ?? 0);
    }

    // helper: compute soy cost FIFO for a port up to embarqueRound, consuming shipSizeT
    function computeSoyCostFor(portKey, embarqueRound){
      if (!portKey || !embarqueRound) return 0;
      const lots = buildPortLotsUpToRound(portKey, embarqueRound);
      const res = consumeLotsFIFO(lots, shipSizeT);
      return res && typeof res.cost_usd === "number" ? res.cost_usd : 0;
    }

    // helper: compute china revenue for bidRound
    function computeRevenueFor(bidRound){
      const bid = getBid(bidRound);
      if (!bid) return 0;
      const rd = getRoundData(bidRound);
      const px = chinaPriceUsdPerT(rd, bid);
      return shipSizeT * px;
    }

    // determine end-of-game round
    const atEnd = (state.round >= roundsMax);

    PORTS.forEach((portKey, idx0)=>{
      const i = idx0+1;
      const plan = getPlan(portKey);
      const bidRound = getBidRoundForPort(portKey);
      const bid = getBid(bidRound);

      // determine if used
      const hasOrigin = (originByPort[portKey] || 0) > 0;
      const hasPlan = !!plan && (plan.status === "confirmed" || plan.confirmed || plan.usd_t != null);
      const hasBid = !!bid && (bid.status === "confirmed" || bid.confirmed || true);

      if (hasOrigin || hasPlan || hasBid) portUsage[portKey].used = true;

      // status logic
      let status = "Não utilizado";
      let executed = false;

      if (!hasPlan && !hasBid && hasOrigin){
        status = "Soja originada, mas sem frete e sem BID.";
        portUsage[portKey].messages.push(status);
      } else if (hasBid && !hasPlan){
        status = "BID fechado, mas sem frete marítimo.";
        portUsage[portKey].messages.push(status);
      } else if (hasPlan && !hasBid){
        status = "Frete contratado, mas sem BID.";
        portUsage[portKey].messages.push(status);
      } else if (hasPlan && hasBid){
        // executed only if shipped completed (>= 60k)
        const shippedOk = (plan.shipped_t || 0) >= shipSizeT;
        if (shippedOk){
          executed = true;
          status = "Executada.";
        } else if (atEnd){
          status = "Cancelada: não completou 60.000 t até o fim do jogo (BID e frete cancelados – informativo).";
          portUsage[portKey].messages.push(status);
        } else {
          status = "Pendente: aguardando completar carga.";
          portUsage[portKey].messages.push(status);
        }
      }

      // build negotiation result
      const neg = {
        idx: i,
        portKey,
        portLabel: PORT_LABEL_SAFE(portKey),
        bidRound: bidRound || null,
        bidLabel: bid ? (bid.label || bid.name || `CHINA ${bidRound}`) : null,
        embarqueRound: plan ? (plan.embarqueRound || null) : null,
        executed,
        status,
        revenue: 0,
        soyCost: 0,
        oceanCost: 0,
        demurrageCost: 0,
        pnl: 0
      };

      if (executed){
        neg.revenue = computeRevenueFor(bidRound);
        // ✅ Soja: custo FIFO do que foi efetivamente embarcado (pode ser completado após a rodada de embarque)
        // O processEmbarkmentsForRound atualiza plan.shipCostUsd a cada rodada com base nas compras até a rodada atual.
        neg.soyCost = (plan && typeof plan.shipCostUsd === "number")
          ? plan.shipCostUsd
          : computeSoyCostFor(portKey, state.round);
        neg.oceanCost = shipSizeT * (plan.usd_t || 0);
        neg.demurrageCost = plan.demurrageAcc || 0;
        neg.pnl = neg.revenue - neg.soyCost - neg.oceanCost - neg.demurrageCost;
      }

      negotiations.push(neg);
      portUsage[portKey].negotiation = neg;
    });

    // --- Bloco 1: Geral (somente negociações executadas)
    const total = { revenue:0, cost:0, pnl:0, demurrage:0, ocean:0, soy:0 };
    negotiations.forEach(n=>{
      if (!n.executed) return;
      total.revenue += n.revenue;
      total.soy += n.soyCost;
      total.ocean += n.oceanCost;
      total.demurrage += n.demurrageCost;
    });
    total.cost = total.soy + total.ocean + total.demurrage;
    total.pnl = total.revenue - total.cost;

    // --- Bloco 2: Por Negociação (até 5)
    const bidLines = [];
    negotiations.forEach(n=>{
      bidLines.push(`${fmtNegLabel(n.idx)} • Porto ${n.portLabel}`);
      if (n.executed){
        bidLines.push(`  BID: R${n.bidRound} ${n.bidLabel || ""} • Embarque: R${n.embarqueRound || "-"}`);
        bidLines.push(`  Receita: ${fmtUSD(n.revenue)} • Custo soja: ${fmtUSD(n.soyCost)}`);
        bidLines.push(`  Frete mar.: ${fmtUSD(n.oceanCost)} • Demurrage: ${fmtUSD(n.demurrageCost)}`);
        bidLines.push(`  P/L Negociação: ${fmtUSD(n.pnl)}`);
      } else {
        bidLines.push(`  Status: ${n.status}`);
      }
      bidLines.push("");
    });
    const blockBids = bidLines.join("\n").trim();

    // --- Bloco 3: Por Porto (sempre 5 portos)
    const portLines = [];
    PORTS.forEach((p)=>{
      const u = portUsage[p];
      const label = PORT_LABEL_SAFE(p);
      if (!u.used){
        portLines.push(`${label}: Não utilizado`);
        return;
      }
      const orig = originByPort[p] || 0;
      // shipped total (60k se executado; 0 se não)
      const shipped = (u.negotiation && u.negotiation.executed) ? shipSizeT : 0;
      const saldo = orig - shipped;
      portLines.push(`${label}: Originado ${FMT_TON_SAFE(orig)} t • Embarcado ${FMT_TON_SAFE(shipped)} t • Saldo ${FMT_TON_SAFE(saldo)} t`);
      if (u.messages && u.messages.length){
        u.messages.forEach(msg=>portLines.push(`  - ${msg}`));
      } else {
        portLines.push(`  - Operação executada.`);
      }
    });
    const blockPorts = portLines.join("\n");

    const insight =
      total.pnl >= 0
        ? "✅ Bom resultado: operação fechou no positivo. Compare receita vs custos por negociação/porto."
        : "⚠️ Resultado negativo: avalie custo de originação, fretes e timing do BID.";

    return {
      out: { total },
      text: {
        title: "RESULTADO FINAL",
        revenue: fmtUSD(total.revenue),
        cost: fmtUSD(total.cost),
        penalties: fmtUSD(0),
        pnl: fmtUSD(total.pnl),
        ship1: "— RESULTADO POR NEGOCIAÇÃO (1–5) —\n" + (blockBids || "Nenhuma negociação."),
        ship2: "— STATUS POR PORTO (5 portos) —\n" + (blockPorts || "Sem dados."),
        penaltiesApplied: "Notas:\n" + (notes.length ? notes.join("\n") : "Sem notas adicionais."),
        insight
      }
    };
  } catch (e) {
    console.error(e);
    // fallback ultra seguro: nunca deixar tela branca
    return {
      out: { total: { revenue:0, cost:0, penalties:0, pnl:0 } },
      text: {
        title: "RESULTADO FINAL",
        revenue: fmtUSD(0),
        cost: fmtUSD(0),
        penalties: fmtUSD(0),
        pnl: fmtUSD(0),
        ship1: "Erro ao gerar resultado por negociação.",
        ship2: "Erro ao gerar status por porto.",
        penaltiesApplied: "Ocorreu um erro ao consolidar o resultado. Veja o console.",
        insight: "⚠️ Erro ao consolidar resultado."
      }
    };
  }
}


function renderOverlaysForScreen(screenId, rd) {
  const layer = document.getElementById("overlayLayer");
  if (!layer) return;

  const sc = getScreenCalib(screenId);

  // --------------------
  // Defaults por tela
  // --------------------
  if (screenId === "r1_home") {
    if (isCampaignMode()) {
      sc.campaign_banner ||= defBox(1205, 355, 720, 120, { font: 56 });
    }
    sc.hot_endround ||= defBox(1700, 930, 200, 120);
    sc.hot_mtm ||= defBox(1450, 930, 230, 120);
    sc.hot_glossary ||= defBox(1190, 930, 230, 120);
    sc.hot_ports ||= defBox(1760, 170, 120, 120);
    sc.hot_longshort ||= defBox(1760, 170, 120, 120);
    sc.hot_help ||= defBox(1760, 40, 120, 120);
    sc.text_cbot ||= defBox(1160, 82, 320, 70, { font: 46 });
    sc.text_cambio ||= defBox(1530, 82, 320, 70, { font: 46 });
    sc.text_tempo ||= defBox(120, 955, 650, 100, { font: 64 });
    sc.text_round ||= defBox(420, 48, 140, 90, { font: 86 });
    sc.hot_news ||= defBox(490, 60, 520, 120);
    sc.hot_exw ||= defBox(720, 640, 520, 140);
    sc.hot_frete ||= defBox(1370, 820, 520, 140);
    sc.hot_cfr ||= defBox(1450, 265, 520, 140);
    sc.guide_kangaroo ||= defBox(10, 820, 260, 250);
    if (isCampaignMode()) {
      sc.guide_bubble ||= defBox(470, 470, 520, 300);
      sc.guide_text ||= defBox(565, 540, 330, 155, { font: 24 });
      sc.guide_next ||= defBox(890, 690, 110, 78, { font: 34 });
    } else {
      sc.guide_bubble ||= defBox(250, 560, 335, 220);
      sc.guide_text ||= defBox(300, 600, 235, 120, { font: 22 });
      sc.guide_next ||= defBox(680, 625, 120, 86, { font: 42 });
    }
  }


  if (screenId === "campaign_menu") {
    sc.hot_back_campaign ||= defBox(18, 930, 150, 120);
    sc.campaign_levels_container ||= defBox(130, 420, 1660, 520);
  }
  if (screenId === "campaign_menu") {
    addHot("hot_back_campaign", () => setStage("tutorial_0"));
  }

  if (screenId === "home_canva") {
    sc.hot_start ||= defBox(820, 780, 300, 140);
    sc.hot_calib ||= defBox(1760, 900, 140, 140);
    // Botao de tela cheia (visivel) - ajuste a caixa se quiser via calibration
    sc.hot_fullscreen ||= defBox(1760, 740, 140, 140);
  }

  // =========================================================
  // ✅ TUTORIAL (5 telas antes do Start)
  // tutorial_0: tela inicial do jogo com botão "Iniciar tutorial"
  // tutorial_1: botões "Avançar" + "Pular tutorial"
  // tutorial_2/3/4: botão "Avançar"
  // (todas as caixas são calibráveis e ficam invisíveis no jogo)
  // =========================================================
  if (screenId === "tutorial_0") {
    sc.hot_mode_guided ||= defBox(520, 760, 380, 130);
    sc.hot_mode_expert ||= defBox(1020, 760, 380, 130);
    sc.hot_mode_campaign ||= defBox(770, 910, 380, 120);
  }
  if (screenId === "tutorial_1") {
    sc.hot_tut_next ||= defBox(1560, 900, 320, 140);
    sc.hot_tut_skip ||= defBox(80, 900, 360, 140);
  }
  if (screenId === "tutorial_2" || screenId === "tutorial_3" || screenId === "tutorial_4") {
    sc.hot_tut_next ||= defBox(1560, 900, 320, 140);
  }

  if (screenId === "ship_select") {
    sc.hot_ship1 ||= defBox(420, 360, 520, 520);
    sc.hot_ship2 ||= defBox(980, 360, 520, 520);
    sc.hot_back  ||= defBox(120, 830, 180, 180);
  }

  if (screenId === "r1_news") {
    sc.text_news ||= defBox(460, 350, 1000, 420, { font: 36 });
    sc.hot_back ||= defBox(65, 930, 200, 140);
  }

  if (screenId === "r1_exw") {
    if (isCampaignMode()) {
      sc.campaign_tracker ||= defBox(120, 135, 740, 185, { font: 18 });
      sc.campaign_book_panel ||= defBox(930, 135, 410, 210, { font: 16 });
      sc.campaign_news_panel ||= defBox(930, 365, 410, 145, { font: 16 });
      sc.hot_advance_round ||= defBox(1110, 930, 420, 100);

      // Sacos EXW dinâmicos e calibráveis por rodada.
      // Cada chave aparece no painel de calibração para ajuste fino de X/Y/Larg/Alt.
      // O nome/cidade/estado/preço/volume continuam editáveis no gameData.json.
      try {
        const scenarioForBags = getScenario && getScenario();
        const roundsForBags = Array.isArray(scenarioForBags?.rounds) ? scenarioForBags.rounds.slice(0, 5) : [];
        roundsForBags.forEach((roundData, rIdx) => {
          const roundNum = Number(roundData?.round || (rIdx + 1));
          const offersForBags = Array.isArray(roundData?.offers_exw) ? roundData.offers_exw.slice(0, 5) : [];
          offersForBags.forEach((offer, idx) => {
            const key = getCampaignOfferCalibKey(roundNum, idx);
            const fallbackBox = getCampaignOfferMapBox(offer, idx, roundNum);
            sc[key] ||= defBox(fallbackBox.x, fallbackBox.y, fallbackBox.w, fallbackBox.h);
          });
        });
      } catch (_) {}
    }
    sc.hot_help ||= defBox(1760, 40, 120, 120);
    sc.text_cbot ||= defBox(1160, 82, 320, 70, { font: 46 });
    sc.text_cambio ||= defBox(1530, 82, 320, 70, { font: 46 });
    sc.text_note ||= defBox(145, 430, 640, 520, { font: 34 });
    sc.hot_partials ||= defBox(1680, 940, 220, 110);
    sc.hot_back ||= defBox(65, 930, 200, 140);
    if (!isCampaignMode()) {
      sc.hot_bag1 ||= defBox(1060, 250, 240, 240);
      sc.hot_bag2 ||= defBox(1350, 170, 240, 240);
      sc.hot_bag3 ||= defBox(1430, 340, 260, 260);
      sc.hot_bag4 ||= defBox(1090, 520, 240, 240);
      sc.hot_bag5 ||= defBox(1320, 540, 240, 240);
    }
    sc.hot_confirm ||= defBox(820, 920, 420, 120);
    sc.hot_discard ||= defBox(1260, 920, 420, 120);
    sc.hot_link_bid ||= defBox(260, 915, 380, 55);
    sc.guide_kangaroo ||= defBox(10, 820, 260, 250);
    if (isCampaignMode()) {
      sc.guide_bubble ||= defBox(470, 470, 520, 300);
      sc.guide_text ||= defBox(565, 540, 330, 155, { font: 24 });
      sc.guide_next ||= defBox(890, 690, 110, 78, { font: 34 });
    } else {
      sc.guide_bubble ||= defBox(250, 560, 335, 220);
      sc.guide_text ||= defBox(300, 600, 235, 120, { font: 22 });
      sc.guide_next ||= defBox(680, 625, 120, 86, { font: 42 });
    }
  }

  if (screenId === "r1_frete") {
    sc.hot_help ||= defBox(1760, 40, 120, 120);
    sc.text_cbot ||= defBox(1160, 82, 320, 70, { font: 46 });
    sc.text_cambio ||= defBox(1530, 82, 320, 70, { font: 46 });
    sc.text_note ||= defBox(145, 430, 640, 520, { font: 34 });
    sc.hot_partials ||= defBox(1680, 940, 220, 110);
    sc.hot_back ||= defBox(65, 930, 200, 140);
    sc.hot_ship1 ||= defBox(980, 650, 260, 220);
    sc.hot_ship2 ||= defBox(1320, 560, 260, 220);
    sc.hot_ship3 ||= defBox(1570, 450, 260, 220);
    sc.hot_ship4 ||= defBox(1120, 850, 260, 220);
    sc.hot_ship5 ||= defBox(1560, 820, 260, 220);
    sc.hot_confirm ||= defBox(820, 920, 420, 120);
    sc.hot_discard ||= defBox(1260, 920, 420, 120);
    if (isCampaignMode()) sc.hot_advance_round ||= defBox(1110, 930, 420, 100);
    sc.hot_link_bid ||= defBox(260, 915, 380, 55);
    sc.guide_kangaroo ||= defBox(10, 820, 260, 250);
    if (isCampaignMode()) {
      sc.guide_bubble ||= defBox(470, 470, 520, 300);
      sc.guide_text ||= defBox(565, 540, 330, 155, { font: 24 });
      sc.guide_next ||= defBox(890, 690, 110, 78, { font: 34 });
    } else {
      sc.guide_bubble ||= defBox(250, 560, 335, 220);
      sc.guide_text ||= defBox(300, 600, 235, 120, { font: 22 });
      sc.guide_next ||= defBox(680, 625, 120, 86, { font: 42 });
    }
  }

  if (screenId === "r1_cfr") {
    sc.hot_help ||= defBox(1760, 40, 120, 120);
    sc.text_cbot ||= defBox(1160, 82, 320, 70, { font: 46 });
    sc.text_cambio ||= defBox(1530, 82, 320, 70, { font: 46 });
    sc.text_note ||= defBox(145, 430, 640, 520, { font: 34 });
    sc.hot_partials ||= defBox(1680, 940, 220, 110);
    sc.hot_back ||= defBox(65, 930, 200, 140);
    sc.hot_port1 ||= defBox(1240, 210, 330, 240);
    sc.hot_port2 ||= defBox(1370, 430, 320, 220);
    sc.hot_port3 ||= defBox(1270, 600, 320, 220);
    sc.hot_port4 ||= defBox(1020, 740, 300, 220);
    sc.hot_confirm ||= defBox(820, 920, 420, 120);
    sc.hot_discard ||= defBox(1260, 920, 420, 120);
    sc.guide_kangaroo ||= defBox(10, 820, 260, 250);
    if (isCampaignMode()) {
      sc.guide_bubble ||= defBox(470, 470, 520, 300);
      sc.guide_text ||= defBox(565, 540, 330, 155, { font: 24 });
      sc.guide_next ||= defBox(890, 690, 110, 78, { font: 34 });
    } else {
      sc.guide_bubble ||= defBox(250, 560, 335, 220);
      sc.guide_text ||= defBox(300, 600, 235, 120, { font: 22 });
      sc.guide_next ||= defBox(680, 625, 120, 86, { font: 42 });
    }
  }

  if (screenId === "partials_menu") {
    sc.hot_help ||= defBox(1760, 40, 120, 120);
    sc.hot_home ||= defBox(1600, 930, 260, 140);
    sc.hot_back ||= defBox(65, 930, 200, 140);
    sc.hot_soja ||= defBox(520, 300, 900, 140);
    sc.hot_frete ||= defBox(520, 470, 900, 140);
    sc.hot_bids ||= defBox(520, 640, 900, 140);
    sc.hot_closed ||= defBox(520, 810, 900, 140);
    sc.hot_pl ||= defBox(520, 980, 900, 90);
    sc.text_title ||= defBox(520, 140, 900, 120, { font: 64 });
    sc.guide_kangaroo ||= defBox(10, 820, 260, 250);
    if (isCampaignMode()) {
      sc.guide_bubble ||= defBox(470, 470, 520, 300);
      sc.guide_text ||= defBox(565, 540, 330, 155, { font: 24 });
      sc.guide_next ||= defBox(890, 690, 110, 78, { font: 34 });
    } else {
      sc.guide_bubble ||= defBox(250, 560, 335, 220);
      sc.guide_text ||= defBox(300, 600, 235, 120, { font: 22 });
      sc.guide_next ||= defBox(680, 625, 120, 86, { font: 42 });
    }
  }

  if (screenId === "partials_soja" || screenId === "partials_frete" || screenId === "partials_bids" || screenId === "partials_pl" || screenId === "partials_closed") {
    sc.hot_help ||= defBox(1760, 40, 120, 120);
    sc.hot_back ||= defBox(65, 930, 200, 140);
    sc.text_note ||= defBox(220, 220, 1480, 760, { font: 34 });
    sc.text_title ||= defBox(220, 110, 1480, 90, { font: 56 });
    sc.guide_kangaroo ||= defBox(10, 820, 260, 250);
    if (isCampaignMode()) {
      sc.guide_bubble ||= defBox(470, 470, 520, 300);
      sc.guide_text ||= defBox(565, 540, 330, 155, { font: 24 });
      sc.guide_next ||= defBox(890, 690, 110, 78, { font: 34 });
    } else {
      sc.guide_bubble ||= defBox(250, 560, 335, 220);
      sc.guide_text ||= defBox(300, 600, 235, 120, { font: 22 });
      sc.guide_next ||= defBox(680, 625, 120, 86, { font: 42 });
    }
  }

  // ✅ RESULTADOS (imagem assets/results_screen.png)
  if (screenId === "results_screen") {
    // HOTSPOTS
    sc.hot_details ||= defBox(1080, 35, 420, 105); // botão amarelo "Detalhes"
    sc.hot_close ||= defBox(1540, 35, 340, 105);   // botão preto "Fechar Jogo"
    sc.hot_home ||= defBox(70, 35, 360, 120);      // se você quiser um hotspot no canto (opcional)

    // TEXTOS (coloquei DENTRO dos retângulos do layout, para facilitar ajustar depois)
    sc.text_title ||= defBox(760, 290, 420, 70, { font: 24 });

    sc.text_revenue ||= defBox(360, 462, 340, 86, { font: 28 });
    sc.text_cost ||= defBox(790, 462, 340, 86, { font: 28 });
    sc.text_penalties ||= defBox(1220, 462, 340, 86, { font: 28 });

    sc.text_ship1 ||= defBox(360, 640, 340, 250, { font: 24 });
    sc.text_ship2 ||= defBox(790, 640, 340, 250, { font: 24 });
    sc.text_pen_applied ||= defBox(1220, 640, 340, 250, { font: 22 });

    sc.text_insight ||= defBox(470, 915, 980, 110, { font: 24 });

    // PNL (posição "livre" - ajuste como quiser)
    sc.text_pnl ||= defBox(90, 250, 520, 90, { font: 40 });

    // Painel de detalhes (overlay)
    sc.text_details ||= defBox(520, 380, 880, 520, { font: 20 });
  }

  saveCalibrationToLocalStorage();
  layer.innerHTML = "";

  // Textos padrão
  const addText = (key, text, cssClass = "overlayText", style = {}) => {
    const box = sc[key];
    if (!box) return;
    const el = document.createElement("div");
    el.className = cssClass;
    el.id = `txt_${key}`;
    placeBox(el, box);

    el.style.fontSize = `${box.font || 40}px`;
    el.style.display = "flex";
    el.style.alignItems = "center";
    el.style.justifyContent = "center";
    el.style.pointerEvents = "none";

    // estilos extra (para caixas grandes de texto)
    Object.assign(el.style, style);

    el.textContent = text;
    layer.appendChild(el);
  };

  // HTML (para "tabelas" e layouts mais ricos)
  const addHtml = (key, html, cssClass = "overlayText", style = {}) => {
    const box = sc[key];
    if (!box) return;
    const el = document.createElement("div");
    el.className = cssClass;
    el.id = `txt_${key}`;
    placeBox(el, box);

    el.style.fontSize = `${box.font || 22}px`;
    el.style.pointerEvents = "none";

    // Por padrão, deixa o conteúdo "preso" ao topo/esquerda
    el.style.display = "block";
    el.style.padding = "8px";
    el.style.boxSizing = "border-box";

    Object.assign(el.style, style);

    el.innerHTML = html;
    layer.appendChild(el);
  };

  if (screenId === "campaign_menu" && sc.campaign_levels_container) {
    const unlocked = state.campaign.unlockedLevel || getCampaignUnlockedLevel();
    const levelCards = CAMPAIGN_LEVELS.map(level => {
      const isUnlocked = Number(level.id) <= Number(unlocked);
      const lockedTip = isUnlocked ? '' : 'Desbloqueie os próximos níveis';
      const record = level.id === 1 ? readCampaignL1Record() : null;
      const actions = level.id === 1
        ? `<button class="campaign-btn campaign-btn-dark" ${isUnlocked ? `onclick="window.startCampaignLevel(${level.id})"` : ''}>Iniciar</button>${record?`<span class="l1-best-score">Melhor nota: ${record.bestScore}/100 ${record.approved?'· aprovado':'· não aprovado'}</span>`:''}`
        : `<button class="campaign-btn campaign-btn-light" type="button" disabled>${isUnlocked?'Desbloqueado · em preparação':'Em breve'}</button>`;
      return `
        <article class="campaign-level-card2 ${isUnlocked ? '' : 'is-locked'}">
          <div class="campaign-level-top">
            <div>
              <div class="campaign-level-code">${level.code}</div>
              <h3>${level.name}</h3>
            </div>
            ${!isUnlocked ? '<div class="campaign-lock-badge">🔒</div>' : ''}
          </div>
          <p>${level.summary || 'Próximo desafio da campanha.'}</p>
          <div class="campaign-actions campaign-card-actions">${actions}</div>
          ${!isUnlocked ? `<div class="campaign-lock-overlay" data-tip="${lockedTip}"></div>` : ''}
        </article>`;
    }).join('');

    const el = document.createElement('div');
    el.id = 'campaignLevelsContainer';
    el.className = 'campaign-levels-viewport';
    placeBox(el, sc.campaign_levels_container);
    el.innerHTML = `<div class="campaign-levels-scroll">${levelCards}</div>`;
    layer.appendChild(el);

    if (sc.hot_back_campaign) {
      const backHit = document.createElement('button');
      backHit.type = 'button';
      backHit.id = 'campaignBackHitbox';
      placeBox(backHit, sc.hot_back_campaign);
      backHit.style.position = 'absolute';
      backHit.style.background = 'transparent';
      backHit.style.border = '0';
      backHit.style.padding = '0';
      backHit.style.margin = '0';
      backHit.style.cursor = 'pointer';
      backHit.style.zIndex = '60';
      backHit.style.pointerEvents = 'auto';
      backHit.style.opacity = '1';
      backHit.setAttribute('aria-label', 'Voltar');
      backHit.onclick = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        setStage('tutorial_0');
      };
      layer.appendChild(backHit);
    }
  }

  if (isCampaignMode() && screenId === "r1_home" && sc.campaign_banner) {
    const level = getCampaignLevel(state.campaign.levelId || 1);
    const html = `<div class="campaign-level-glow">LvL: ${level.id} — ${String(level.name || '').toUpperCase()}</div>`;
    addHtml('campaign_banner', html, 'overlayText', {
      color:'#fff7c7',
      textShadow:'0 0 6px rgba(255,240,180,.95), 0 0 18px rgba(255,214,102,.85), 2px 3px 0 rgba(0,0,0,.42)',
      fontStyle:'italic',
      fontWeight:'900',
      fontSize:'54px',
      background:'transparent',
      border:'0',
      boxShadow:'none',
      display:'flex',
      alignItems:'center',
      justifyContent:'center',
      textAlign:'center',
      letterSpacing:'.04em'
    });
  }

  if (isCampaignMode() && screenId === "r1_exw") {
    const l1Only = Number(state.campaign.levelId) === 1;
    const trackerKey = l1Only && sc.l1_tracker ? 'l1_tracker' : 'campaign_tracker';
    const bookKey = l1Only && sc.l1_book_panel ? 'l1_book_panel' : 'campaign_book_panel';
    const newsKey = l1Only && sc.l1_news_panel ? 'l1_news_panel' : 'campaign_news_panel';
    if (l1Only) {
      // Um único painel focado substitui os três cartões concorrentes na tela EXW do Level 1.
      renderCampaignL1Workbench(layer, rd);
    } else {
      if (sc[trackerKey]) addHtml(trackerKey, buildCampaignStatusHtml(), 'overlayText', { color:'#111', textShadow:'none' });
      if (sc[bookKey]) addHtml(bookKey, buildCampaignBookPanelHtml(), 'overlayText', { color:'#111', textShadow:'none' });
      if (sc[newsKey]) addHtml(newsKey, buildCampaignNewsPanelHtml(), 'overlayText', { color:'#111', textShadow:'none' });
    }
  }

  if (isCampaignMode() && screenId === "r1_exw" && Number(state.campaign?.roundSplashUntil || 0) > Date.now()) {
    const html = `<div class="campaign-round-splash">RODADA ${Number(state.round || 1)}</div>`;
    addHtml('campaign_round_splash', html, 'overlayText', {
      left:'50%', top:'50%', width:'auto', height:'auto', transform:'translate(-50%, -50%)',
      color:'#fff', background:'transparent', border:'0', boxShadow:'none',
      fontSize:'92px', fontStyle:'italic', fontWeight:'900', textAlign:'center',
      textShadow:'0 0 10px rgba(255,255,255,.95), 0 0 26px rgba(255,160,0,.95), 4px 5px 0 rgba(0,0,0,.45)',
      letterSpacing:'.06em', zIndex:'30', pointerEvents:'none',
      animation:'campaignShock 1.2s ease-out infinite'
    });
  }

  // ✅ rodada (no home)
  if (screenId === "r1_home" && sc.text_round) addText("text_round", String(state.round), "overlayText", isCampaignMode() && Number(state.campaign?.levelId)===1 ? {fontSize:"76px"} : {});

  // ✅ Título (parciais)
  if (sc.text_title && (screenId === "partials_menu" || screenId.startsWith("partials_"))) {
    const titleMap = {
      partials_menu: "PARCIAIS",
      partials_soja: "SOJA ORIGINADA (CONFIRMADO)",
      partials_frete: "FRETE CONTRATADO (CONFIRMADO)",
      partials_bids: "BIDS FECHADOS (CONFIRMADO)",
      partials_pl: "P/L PARCIAL",
      partials_closed: "NEGÓCIOS FECHADOS",
    };
    addText("text_title", titleMap[screenId] || "");
  }

  // ✅ Fonte consistente de Chicago e câmbio na abertura e na origem, apenas L1.
  if (isCampaignMode() && Number(state.campaign.levelId) === 1 &&
      (screenId === 'r1_home' || screenId === 'r1_exw')) {
    const cbKey=screenId==='r1_exw'&&sc.l1_text_cbot?'l1_text_cbot':'text_cbot';
    const fxKey=screenId==='r1_exw'&&sc.l1_text_cambio?'l1_text_cambio':'text_cambio';
    const compact={fontSize:'40px',fontWeight:'900',whiteSpace:'nowrap'};
    if (sc[cbKey]) addText(cbKey,Number(rd.cbot_cent_bu).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}),'overlayText',compact);
    if (sc[fxKey]) addText(fxKey,Number(rd.usd).toLocaleString('pt-BR',{minimumFractionDigits:4,maximumFractionDigits:4}),'overlayText',compact);
  } else {
    if (sc.text_cbot) addText("text_cbot", String(rd.cbot_cent_bu));
    if (sc.text_cambio) addText("text_cambio", String(rd.usd));
  }

  // ✅ TEMPO
  if (sc.text_tempo) addText("text_tempo", getTimerString());

  // Notícia (jornal)
  if (screenId === "r1_news" && sc.text_news) {
    const box = sc.text_news;
    const el = document.createElement("div");
    el.className = "overlayText";
    el.id = "txt_text_news";
    placeBox(el, box);
    el.style.fontSize = `${box.font || 34}px`;
    el.style.fontWeight = "700";
    el.style.color = "#111";
    el.style.textShadow = "none";
    el.style.pointerEvents = "none";
    el.style.padding = "8px";
    el.style.display = "flex";
    el.style.alignItems = "flex-start";
    el.style.justifyContent = "flex-start";
    el.style.lineHeight = "1.25";
    el.textContent = rd.news;
    layer.appendChild(el);
  }

  
// ✅ FRETE: lista de fretes no quadro (Nome | Volume | Preço)
// (usa placeBox + fonte por cfg.font, para ficar idêntico ao EXW e escalar junto do canvas)
if (screenId === "r1_frete") {
  const cfg = sc?.text_frete_offers;
  if (cfg) {
    const old = document.getElementById("offersTableFrete");
    if (old) old.remove();

    const rdd = getRoundData(state.round);
    const tbl = document.createElement("div");
    tbl.id = "offersTableFrete";
    tbl.className = "noteText";

    placeBox(tbl, cfg);
    tbl.style.position = "absolute";
    tbl.style.pointerEvents = "none";
    tbl.style.display = "block";
    tbl.style.overflow = "hidden";
    tbl.style.background = "rgba(255,255,255,0.00)";
    tbl.style.color = "#111";
    tbl.style.fontSize = `${cfg.font || 18}px`;
    tbl.style.lineHeight = "1.15";

    const rows = (rdd && Array.isArray(rdd.ocean_freight) ? rdd.ocean_freight : [])
      .slice(0, 5)
      .map(o => ([
        (o.label || "Frete"),
        "60.000 t",
        (typeof o.usd_t === "number" ? `US$ ${o.usd_t.toFixed(1)}/t` : "—")
      ]));

    const headerHtml =
      `<th style="text-align:left; padding:6px 8px; border-bottom:1px solid rgba(0,0,0,.25);">Nome</th>` +
      `<th style="text-align:left; padding:6px 8px; border-bottom:1px solid rgba(0,0,0,.25);">Volume</th>` +
      `<th style="text-align:left; padding:6px 8px; border-bottom:1px solid rgba(0,0,0,.25);">Preço</th>`;

    const bodyHtml = rows.map(r =>
      `<tr>` + r.map(c =>
        `<td style="padding:6px 8px; border-bottom:1px solid rgba(0,0,0,.12); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${c}</td>`
      ).join("") + `</tr>`
    ).join("");

    tbl.innerHTML = `
      <div style="border:0; border-radius:0; overflow:hidden; background:transparent;">
        <table style="width:100%; border-collapse:collapse; font-size:inherit;">
          <thead><tr>${headerHtml}</tr></thead>
          <tbody>${bodyHtml}</tbody>
        </table>
      </div>
    `;

    layer.appendChild(tbl);
  }
}


// ✅ CFR CHINA: lista de bids no quadro (Nome | Volume | Preço)
// (usa placeBox + fonte por cfg.font, para ficar idêntico ao EXW e escalar junto do canvas)
if (screenId === "r1_cfr") {
  const cfg = sc?.text_cfr_offers;
  if (cfg) {
    const old = document.getElementById("offersTableCfr");
    if (old) old.remove();

    const rdd = getRoundData(state.round);
    const tbl = document.createElement("div");
    tbl.id = "offersTableCfr";
    tbl.className = "noteText";

    placeBox(tbl, cfg);
    tbl.style.position = "absolute";
    tbl.style.pointerEvents = "none";
    tbl.style.display = "block";
    tbl.style.overflow = "hidden";
    tbl.style.background = "rgba(255,255,255,0.00)";
    tbl.style.color = "#111";
    tbl.style.fontSize = `${cfg.font || 18}px`;
    tbl.style.lineHeight = "1.15";

    const rows = (rdd && Array.isArray(rdd.china_offers) ? rdd.china_offers : [])
      .slice(0, 5)
      .map(o => ([
        (o.label || "BID"),
        "60.000 t",
        (typeof o.basis_cent_bu === "number" ? `${o.basis_cent_bu.toFixed(1)} ¢/bu` : "—")
      ]));

    const headerHtml =
      `<th style="text-align:left; padding:6px 8px; border-bottom:1px solid rgba(0,0,0,.25);">Nome</th>` +
      `<th style="text-align:left; padding:6px 8px; border-bottom:1px solid rgba(0,0,0,.25);">Volume</th>` +
      `<th style="text-align:left; padding:6px 8px; border-bottom:1px solid rgba(0,0,0,.25);">Preço</th>`;

    const bodyHtml = rows.map(r =>
      `<tr>` + r.map(c =>
        `<td style="padding:6px 8px; border-bottom:1px solid rgba(0,0,0,.12); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${c}</td>`
      ).join("") + `</tr>`
    ).join("");

    tbl.innerHTML = `
      <div style="border:0; border-radius:0; overflow:hidden; background:transparent;">
        <table style="width:100%; border-collapse:collapse; font-size:inherit;">
          <thead><tr>${headerHtml}</tr></thead>
          <tbody>${bodyHtml}</tbody>
        </table>
      </div>
    `;

    layer.appendChild(tbl);
  }
}

// --------------------
  // Caderno (nota) e telas de parciais
  // --------------------
  const getNoteText = () => {
    if (screenId === "r1_exw") {
      const chosen = state.choices.exw[state.round];
      if (!chosen) {
        if (isCampaignMode()) return `L1 — Originação física

Venda CFR China e frete marítimo já estão fixados. A decisão agora está na origem: preço, volume e logística interna até Santos.

Estime o custo CFR equivalente de cada EXW, incluindo fobbing, e preserve o basis médio do book em até +${Number(getCampaignLevel(state.campaign.levelId || 1).targetBasisCentBu).toFixed(0)} c/bu. Cotações de cenário e volumes simulados.`;
        return "Selecione uma oferta (clique em um saco).";
      }
      const isConf = !!state.confirmed.exw[state.round];
      return [
        `${isConf ? "✅ CONFIRMADO" : "⏳ NÃO CONFIRMADO"}`,
        `${chosen.label}`,
        `Preço: R$ ${chosen.price_brl_saca}/saca`,
        `Volume: ${chosen.volume_t} t`,
        `Corredor: ${corridorLabel(chosen.corredor || '-') } (US$ ${ (typeof chosen.inland_usd_t_selected==='number'? chosen.inland_usd_t_selected : (typeof chosen.inland_usd_t==='number'? chosen.inland_usd_t:0)) }/t)`,
      ].join("\n");
    }

    if (screenId === "r1_frete") {
      const chosen = state.choices.ocean[state.round];
      if (!chosen) return "Selecione um frete (clique em um navio).";
      const isConf = !!state.confirmed.ocean[state.round];

      // se confirmado, busca qual porto foi associado a este contrato
      const port = (state.freightPlanByRound && state.freightPlanByRound[state.round]) ? state.freightPlanByRound[state.round] : null;
      const plan = (port && state.freightPlansByPort) ? state.freightPlansByPort[port] : null;

      const portoTxt = plan ? PORT_LABEL(plan.port) : (port ? PORT_LABEL(port) : "-");
      const embarqueTxt = plan?.targetRound ? `Rodada ${plan.targetRound}` : "-";

      return [
        `${isConf ? "✅ CONFIRMADO" : "⏳ NÃO CONFIRMADO"}`,
        `${chosen.label}`,
        `Frete marítimo: US$ ${chosen.usd_t}/t`,
        `Demurrage: US$ ${chosen.demurrage_usd_round ?? "-"} / rodada`,
        `Porto: ${portoTxt}`,
        `Embarque: ${embarqueTxt}`,
      ].join("\n");
    }

    if (screenId === "r1_cfr") {
      const chosen = state.choices.china[state.round];
      if (!chosen) return "Selecione uma oferta CFR (clique em um porto).";
      const isConf = !!state.confirmed.china[state.round];
      return [
        `${isConf ? "✅ CONFIRMADO" : "⏳ NÃO CONFIRMADO"}`,
        `${chosen.label}`,
        `Basis: ${chosen.basis_cent_bu} ¢/bu`,
      ].join("\n");
    }

    const listConfirmed = (kind) => {
      const out = [];

      if (kind === "exw") {
        const obj = (state.confirmed && state.confirmed.exw && typeof state.confirmed.exw === "object") ? state.confirmed.exw : {};
        const keys = Object.keys(obj).map(k=>Number(k)).filter(n=>Number.isFinite(n)).sort((a,b)=>a-b);
        keys.forEach((r)=>{
          const c = obj[r];
          if (!c) return;
          const label = c.label || c.name || c.offer_label || (c.offer_id ? `OFERTA ${c.offer_id}` : "OFERTA");
          const vol = (c.volume_t ?? c.volume ?? 0);
          const price = (c.price_rs_saca ?? c.price_brl_saca ?? c.price ?? 0);
          const inland = (c.inland_usd_t_selected ?? c.freight_inland_usd_t ?? 0);
          const port = PORT_LABEL_SAFE(c.corredor || c.port || "");
          out.push(`Rodada ${r}: ${label} • ${FMT_TON_SAFE(vol)} t • R$ ${Number(price)||0}/saca • CBOT ${(c && c.ref_cbot_cent_bu!=null)?c.ref_cbot_cent_bu:"?"} ¢/bu • Câmbio ${(c && c.ref_cambio!=null)?c.ref_cambio:"?"} • ${port} • Inland US$ ${Number(inland)||0}/t`);
        });
        return out;
      }

      if (kind === "ocean" || kind === "frete") {
        const plans = (state.freightPlansByPort && typeof state.freightPlansByPort === "object") ? state.freightPlansByPort : {};
        const ports = Object.keys(plans).sort((a,b)=>PORT_LABEL_SAFE(a).localeCompare(PORT_LABEL_SAFE(b)));
        ports.forEach((p)=>{
          const pl = plans[p];
          if (!pl) return;
          const label = pl.label || "FRETE";
          const usdT = (typeof pl.usd_t === "number") ? pl.usd_t : 0;
          const trg = pl.targetRound ?? "-";
          const dr = (typeof pl.demurrageUsdPerRound === "number") ? pl.demurrageUsdPerRound : 0;
          const acc = (typeof pl.demurrageAcc === "number") ? pl.demurrageAcc : 0;
          
          const fx = Number(pl.ref_cambio ?? 0).toFixed(2);
          let bidTxt = "";
          if (pl.linkedBidRound != null) {
            const bb = state.confirmed?.china?.[pl.linkedBidRound];
            const bLabel = bb?.label ? ` ${bb.label}` : "";
            bidTxt = ` • BID R${pl.linkedBidRound}${bLabel}`;
          }
          out.push(`${SAFE_PORT_LABEL_SAFE(p)}: ${label} • US$ ${usdT}/t • Câmbio ${fx} • embarque R${trg}${bidTxt} • demurrage US$ ${dr}/rod • acumulado ${fmtUSD(acc)}`);

        });
        return out;
      }

      if (kind === "china" || kind === "cfr") {
        const keys = Array.from(new Set([
          ...Object.keys((state.confirmed.cfr||{})),
          ...Object.keys((state.confirmed.china||{}))
        ].map(k=>Number(k)).filter(n=>!Number.isNaN(n)))).sort((a,b)=>a-b);
        for (const r of keys) {
          const c = (state.confirmed.cfr && state.confirmed.cfr[r]) ? state.confirmed.cfr[r]
                  : (state.confirmed.china ? state.confirmed.china[r] : null);
          if (!c) continue;

          const vol = (typeof c.volume_t === "number") ? c.volume_t
                    : (typeof c.volume === "number" ? c.volume : 60000);

          const basis = (typeof c.basis_cent_bu === "number") ? c.basis_cent_bu
                      : (typeof c.basis === "number" ? c.basis : null);

          const px = (typeof c.price_usd_bu === "number") ? c.price_usd_bu
                   : (typeof c.price === "number" ? c.price : null);

          const label = c.label || c.name || "BID";

          const basisTxt = (basis !== null) ? `Basis ${basis} ¢/bu` : "Basis -";
          const pxTxt = (px !== null) ? ` • Preço ${px}` : "";
          const refCbot = (c && c.ref_cbot_cent_bu != null) ? c.ref_cbot_cent_bu : null;
          const refUsd = (c && c.ref_cambio != null) ? c.ref_cambio : null;
          const refTxt = (refCbot !== null && refUsd !== null) ? ` • CBOT ${refCbot} ¢/bu • Câmbio ${refUsd}` : "";
          let linkTxt = "";
        if (c.linkedFreightPort) {
          const portName = (typeof PORT_LABEL_SAFE === "function") ? PORT_LABEL_SAFE(c.linkedFreightPort) : c.linkedFreightPort;
          let embarqueTxt = "";
          const pl = state.freightPlansByPort?.[c.linkedFreightPort];
          if (pl && pl.linkedBidRound === r) embarqueTxt = ` (embarque R${pl.targetRound})`;
          linkTxt = ` • Frete: ${portName}${embarqueTxt}`;
        }
        out.push(`Rodada ${r}: ${label} • ${FMT_TON_SAFE(vol)} t • ${basisTxt}${pxTxt}${refTxt}${linkTxt}`);
        }
        return out;
      }

      return out;
    };

    if (screenId === "partials_soja") {
      const rows = listConfirmed("exw");
      return rows.length ? rows.join("\n") : "Nenhuma soja originada CONFIRMADA até agora.";
    }

    if (screenId === "partials_frete") {
      const rows = listConfirmed("ocean");
      return rows.length ? rows.join("\n") : "Nenhum frete contratado CONFIRMADO até agora.";
    }

    if (screenId === "partials_bids") {
      const rows = listConfirmed("china");
      return rows.length ? rows.join("\n") : "Nenhum bid fechado (China) CONFIRMADO até agora.";
    }

    if (screenId === "partials_closed") {
      const rows = getClosedDealRowsForUi();
      return rows.length ? rows.map((r)=>`Rodada ${r.bidRound}: ${r.originShort} → ${r.portLabel} → ${r.buyerLabel}`).join("\n") : "Nenhum negócio fechado até agora.";
    }

    if (screenId === "partials_pl") {
      let partial;
      try { partial = computePartial(state.round); }
      catch(e){ console.error("Erro computePartial:", e); partial = {totalRevenueUsd:0,totalCostUsd:0,totalFreightUsd:0,totalDemurrageUsd:0,pnlUsd:0}; }
      return [
        `P/L parcial até a rodada ${state.round}`,
        ``,
        `Receita (vendas atendidas): ${fmtUSD(partial.totalRevenueUsd)}`,
        `Custo soja (FIFO): ${fmtUSD(partial.totalCostUsd - partial.totalFreightUsd - partial.totalDemurrageUsd)}`,
        `Custo frete contratado: ${fmtUSD(partial.totalFreightUsd)}`,
        `Custo demurrage acumulado: ${fmtUSD(partial.totalDemurrageUsd)}`,
        ``,
        `P/L parcial: ${fmtUSD(partial.pnlUsd)}`
      ].join("\n");
    }

    return "";
  };


function getFreteRowsForUi() {
  const plans = (state.freightPlansByPort && typeof state.freightPlansByPort === "object") ? state.freightPlansByPort : {};
  return Object.keys(plans).sort((a,b)=>PORT_LABEL_SAFE(a).localeCompare(PORT_LABEL_SAFE(b), 'pt-BR')).map((port)=>{
    const pl = plans[port];
    if (!pl) return null;
    const bidRound = pl.linkedBidRound ?? null;
    const bid = bidRound ? ((state.confirmed?.china||{})[bidRound] || (state.confirmed?.cfr||{})[bidRound]) : null;
    return {
      portKey: port,
      portLabel: PORT_LABEL_SAFE(port),
      contractRound: Number(pl.contractRound ?? 0) || 0,
      targetRound: pl.targetRound ?? null,
      label: pl.label || 'Frete contratado',
      usd_t: Number(pl.usd_t ?? 0) || 0,
      ref_cambio: pl.ref_cambio ?? null,
      demurrageUsdPerRound: Number(pl.demurrageUsdPerRound ?? 0) || 0,
      demurrageAcc: Number(pl.demurrageAcc ?? 0) || 0,
      buyerLabel: bid ? (bid.label || bid.name || `BID R${bidRound}`) : 'Comprador ainda não definido',
      bidRound,
      volume_t: 60000,
      destination: 'CFR China'
    };
  }).filter(Boolean);
}

function getBidRowsForUi() {
  const china = state.confirmed?.china || {};
  const cfr = state.confirmed?.cfr || {};
  const plans = (state.freightPlansByPort && typeof state.freightPlansByPort === 'object') ? state.freightPlansByPort : {};
  return Array.from(new Set([...Object.keys(china), ...Object.keys(cfr)].map(x=>Number(x)).filter(n=>!Number.isNaN(n))))
    .sort((a,b)=>a-b)
    .map((round)=>{
      const bid = china[round] || cfr[round];
      if (!bid) return null;
      let portKey = bid.linkedFreightPort || null;
      let plan = portKey ? plans[portKey] : null;
      if (!plan) {
        for (const [pk, pl] of Object.entries(plans)) {
          if (pl && Number(pl.linkedBidRound) === Number(round)) {
            portKey = pk;
            plan = pl;
            break;
          }
        }
      }
      return {
        round,
        label: bid.label || bid.name || `BID ${round}`,
        basis: bid.basis_cent_bu ?? bid.basis ?? null,
        ref_cbot_cent_bu: bid.ref_cbot_cent_bu ?? null,
        ref_cambio: bid.ref_cambio ?? null,
        volume_t: Number(bid.volume_t ?? bid.volume ?? 60000) || 60000,
        destination: 'CFR China',
        buyerLabel: bid.label || bid.name || `BID ${round}`,
        portLabel: portKey ? PORT_LABEL_SAFE(portKey) : 'Frete ainda não contratado',
        portKey,
        freightLabel: plan ? `${plan.label || 'Frete'} • US$ ${Number(plan.usd_t||0).toFixed(1)}/t` : 'Frete ainda não contratado',
        linkedFreightRound: plan ? (plan.targetRound ?? null) : null,
      };
    }).filter(Boolean);
}

function getClosedDealRowsForUi() {
  const rows = [];
  const plans = (state.freightPlansByPort && typeof state.freightPlansByPort === "object") ? state.freightPlansByPort : {};
  Object.keys(plans).forEach((port)=>{
    const pl = plans[port];
    if (!pl || pl.linkedBidRound == null) return;
    const bidRound = Number(pl.linkedBidRound);
    const bid = (state.confirmed?.china||{})[bidRound] || (state.confirmed?.cfr||{})[bidRound];
    if (!bid) return;
    const exwRounds = Object.keys(state.confirmed?.exw || {}).map(x=>Number(x)).filter(n=>!Number.isNaN(n)).sort((a,b)=>a-b);
    const exwList = exwRounds.map(r=>({round:r, exw:getConfirmedChoice(state.confirmed.exw, r)})).filter(obj=>obj.exw && String(obj.exw.corredor||'')===String(port));
    if (!exwList.length) return;
    const weighted = exwList.reduce((acc,obj)=>{
      const exw = obj.exw || {};
      const vol = Number(exw.volume_t ?? exw.volume ?? 0) || 0;
      const p = Number(exw.price_brl_saca ?? exw.price ?? 0) || 0;
      const inland = Number(exw.inland_usd_t_selected ?? exw.freight_inland_usd_t ?? 0) || 0;
      const camb = Number(exw.ref_cambio ?? bid.ref_cambio ?? 0) || 0;
      acc.priceBRLxVol += p * vol;
      acc.inlandxVol += inland * vol;
      acc.cambioxVol += camb * vol;
      acc.volume += vol;
      return acc;
    }, {priceBRLxVol:0, inlandxVol:0, cambioxVol:0, volume:0});
    const totalVolume = weighted.volume;
    const avgPriceBRLSaca = weighted.volume ? (weighted.priceBRLxVol / weighted.volume) : 0;
    const avgInlandUsdT = weighted.volume ? (weighted.inlandxVol / weighted.volume) : 0;
    const avgCambio = weighted.volume ? (weighted.cambioxVol / weighted.volume) : (Number(bid.ref_cambio ?? 0) || 0);
    const avgPriceUsdT = avgCambio > 0 ? ((avgPriceBRLSaca * (1000/60)) / avgCambio) : 0;
    rows.push({
      portKey: port,
      portLabel: PORT_LABEL_SAFE(port),
      bidRound,
      exwRounds: exwList.map(x=>x.round),
      originShort: 'INTERIOR',
      totalVolume,
      avgPriceBRLSaca,
      avgPriceUsdT,
      avgCambio,
      inland: avgInlandUsdT,
      freightLabel: pl.label || 'Frete contratado',
      freightUsdT: Number(pl.usd_t ?? 0) || 0,
      freightTargetRound: pl.targetRound ?? null,
      buyerLabel: bid.label || bid.name || `BID ${bidRound}`,
      basis: bid.basis_cent_bu ?? bid.basis ?? null,
      ref_cbot_cent_bu: bid.ref_cbot_cent_bu ?? null,
      ref_cambio: bid.ref_cambio ?? avgCambio ?? null,
      destination: 'CFR China'
    });
  });
  return rows.sort((a,b)=>a.bidRound-b.bidRound);
}

function buildFreteBoletaHtml(portKey) {
  const row = getFreteRowsForUi().find(r => r.portKey === portKey);
  if (!row) return '<div style="padding:8px 0; color:#666;">Frete contratado não encontrado.</div>';
  return `
    <div style="background:#fff; border:2px solid #d9dee8; border-radius:10px; overflow:hidden; box-shadow:inset 0 0 0 1px rgba(0,0,0,.02);">
      <div style="padding:12px 16px; border-bottom:1px solid #dfe5ee; display:flex; align-items:flex-start; justify-content:space-between; gap:16px;">
        <div>
          <div style="font-size:12px; letter-spacing:.12em; color:#7d8896; font-weight:700; text-transform:uppercase;">Ocean Freight Confirmation</div>
          <div style="margin-top:6px; font-size:22px; font-weight:800; color:#1b2430;">Boleta de Afretamento Marítimo</div>
        </div>
        <div style="text-align:right; font-size:12px; color:#5b6470; min-width:160px;">
          <div><b>Status:</b> Confirmado</div>
          <div style="margin-top:4px;"><b>Rodada contrato:</b> ${row.contractRound}</div>
        </div>
      </div>
      <div style="padding:16px; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px;">
        <div style="border:1px solid #e6e9ef; border-radius:10px; padding:12px 14px; background:#fcfdff;">
          <div style="font-size:11px; letter-spacing:.08em; color:#7d8896; font-weight:700; text-transform:uppercase;">Rota logística</div>
          <div style="margin-top:10px; line-height:1.55; color:#222;">
            <div><b>Origem do embarque:</b> ${escapeHtml(row.portLabel)}</div>
            <div><b>Destino:</b> ${escapeHtml(row.destination)}</div>
            <div><b>Rodada alvo do embarque:</b> ${escapeHtml(String(row.targetRound ?? '—'))}</div>
          </div>
        </div>
        <div style="border:1px solid #e6e9ef; border-radius:10px; padding:12px 14px; background:#fcfdff;">
          <div style="font-size:11px; letter-spacing:.08em; color:#7d8896; font-weight:700; text-transform:uppercase;">Afretamento</div>
          <div style="margin-top:10px; line-height:1.55; color:#222;">
            <div><b>Navio / Opção:</b> ${escapeHtml(row.label)}</div>
            <div><b>Volume padrão:</b> ${FMT_TON_SAFE(row.volume_t)} t</div>
            <div><b>Frete marítimo:</b> US$ ${Number(row.usd_t||0).toFixed(1)}/t</div>
            <div><b>Valor total estimado:</b> ${fmtUSD((Number(row.usd_t||0) * Number(row.volume_t||0)))}</div>
          </div>
        </div>
        <div style="border:1px solid #e6e9ef; border-radius:10px; padding:12px 14px; background:#fcfdff;">
          <div style="font-size:11px; letter-spacing:.08em; color:#7d8896; font-weight:700; text-transform:uppercase;">Mercado e custos</div>
          <div style="margin-top:10px; line-height:1.55; color:#222;">
            <div><b>Câmbio de referência:</b> ${escapeHtml(String(row.ref_cambio ?? '—'))}</div>
            <div><b>Demurrage por rodada:</b> US$ ${Number(row.demurrageUsdPerRound||0).toFixed(0)}</div>
            <div><b>Demurrage acumulado:</b> ${fmtUSD(row.demurrageAcc || 0)}</div>
          </div>
        </div>
        <div style="border:1px solid #e6e9ef; border-radius:10px; padding:12px 14px; background:#fcfdff;">
          <div style="font-size:11px; letter-spacing:.08em; color:#7d8896; font-weight:700; text-transform:uppercase;">Recebedor da carga</div>
          <div style="margin-top:10px; line-height:1.55; color:#222;">
            <div><b>Comprador final:</b> ${escapeHtml(row.buyerLabel)}</div>
            <div><b>Observação:</b> ${row.bidRound != null ? 'Frete já vinculado a uma venda CFR.' : 'Comprador ainda não definido.'}</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function buildBidBoletaHtml(round) {
  const row = getBidRowsForUi().find(r => r.round === round);
  if (!row) return '<div style="padding:8px 0; color:#666;">Bid fechado não encontrado.</div>';
  return `
    <div style="background:#fff; border:2px solid #d9dee8; border-radius:10px; overflow:hidden; box-shadow:inset 0 0 0 1px rgba(0,0,0,.02);">
      <div style="padding:12px 16px; border-bottom:1px solid #dfe5ee; display:flex; align-items:flex-start; justify-content:space-between; gap:16px;">
        <div>
          <div style="font-size:12px; letter-spacing:.12em; color:#7d8896; font-weight:700; text-transform:uppercase;">CFR Sale Confirmation</div>
          <div style="margin-top:6px; font-size:22px; font-weight:800; color:#1b2430;">Boleta de Venda Internacional</div>
        </div>
        <div style="text-align:right; font-size:12px; color:#5b6470; min-width:160px;">
          <div><b>Status:</b> Confirmado</div>
          <div style="margin-top:4px;"><b>Rodada:</b> ${row.round}</div>
        </div>
      </div>
      <div style="padding:16px; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px;">
        <div style="border:1px solid #e6e9ef; border-radius:10px; padding:12px 14px; background:#fcfdff;">
          <div style="font-size:11px; letter-spacing:.08em; color:#7d8896; font-weight:700; text-transform:uppercase;">Venda</div>
          <div style="margin-top:10px; line-height:1.55; color:#222;">
            <div><b>Comprador:</b> ${escapeHtml(row.buyerLabel)}</div>
            <div><b>Destino:</b> ${escapeHtml(row.destination)}</div>
            <div><b>Volume:</b> ${FMT_TON_SAFE(row.volume_t)} t</div>
          </div>
        </div>
        <div style="border:1px solid #e6e9ef; border-radius:10px; padding:12px 14px; background:#fcfdff;">
          <div style="font-size:11px; letter-spacing:.08em; color:#7d8896; font-weight:700; text-transform:uppercase;">Preço e mercado</div>
          <div style="margin-top:10px; line-height:1.55; color:#222;">
            <div><b>Basis:</b> ${row.basis != null ? escapeHtml(String(row.basis)) + ' ¢/bu' : '—'}</div>
            <div><b>CBOT de referência:</b> ${escapeHtml(String(row.ref_cbot_cent_bu ?? '—'))} ¢/bu</div>
          </div>
        </div>
        <div style="border:1px solid #e6e9ef; border-radius:10px; padding:12px 14px; background:#fcfdff;">
          <div style="font-size:11px; letter-spacing:.08em; color:#7d8896; font-weight:700; text-transform:uppercase;">Logística vinculada</div>
          <div style="margin-top:10px; line-height:1.55; color:#222;">
            <div><b>Porto:</b> ${escapeHtml(row.portLabel)}</div>
            <div><b>Frete:</b> ${escapeHtml(row.freightLabel)}</div>
            <div><b>Rodada de embarque:</b> ${escapeHtml(String(row.linkedFreightRound ?? '—'))}</div>
          </div>
        </div>
        <div style="border:1px solid #e6e9ef; border-radius:10px; padding:12px 14px; background:#fcfdff;">
          <div style="font-size:11px; letter-spacing:.08em; color:#7d8896; font-weight:700; text-transform:uppercase;">Observação</div>
          <div style="margin-top:10px; line-height:1.55; color:#222;">
            <div>${row.portKey ? 'Esta venda já possui frete marítimo vinculado.' : 'Frete ainda não contratado para este bid.'}</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function buildClosedDealBoletaHtml(portKey) {
  const row = getClosedDealRowsForUi().find(r => r.portKey === portKey);
  if (!row) return '<div style="padding:8px 0; color:#666;">Fluxo fechado não encontrado.</div>';
  return `
    <div style="background:#fff; border:2px solid #d9dee8; border-radius:10px; overflow:hidden; box-shadow:inset 0 0 0 1px rgba(0,0,0,.02);">
      <div style="padding:12px 16px; border-bottom:1px solid #dfe5ee; display:flex; align-items:flex-start; justify-content:space-between; gap:16px;">
        <div>
          <div style="font-size:12px; letter-spacing:.12em; color:#7d8896; font-weight:700; text-transform:uppercase;">Closed Trading Flow</div>
          <div style="margin-top:6px; font-size:22px; font-weight:800; color:#1b2430;">Boleta de Negócio Fechado</div>
        </div>
        <div style="text-align:right; font-size:12px; color:#5b6470; min-width:160px;">
          <div><b>Status:</b> Fluxo fechado</div>
          <div style="margin-top:4px;"><b>Venda:</b> Rodada ${row.bidRound}</div>
        </div>
      </div>
      <div style="padding:16px; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px;">
        <div style="border:1px solid #e6e9ef; border-radius:10px; padding:12px 14px; background:#fcfdff;">
          <div style="font-size:11px; letter-spacing:.08em; color:#7d8896; font-weight:700; text-transform:uppercase;">Compra</div>
          <div style="margin-top:10px; line-height:1.55; color:#222;">
            <div><b>Origem:</b> ${escapeHtml(row.originShort)}</div>
            <div><b>Soja originada:</b> ${FMT_TON_SAFE(row.totalVolume)} t</div>
            <div><b>Preço médio:</b> R$ ${Number(row.avgPriceBRLSaca||0).toFixed(1)}/saca</div>
            <div><b>Preço médio:</b> US$ ${Number(row.avgPriceUsdT||0).toFixed(1)}/t</div>
          </div>
        </div>
        <div style="border:1px solid #e6e9ef; border-radius:10px; padding:12px 14px; background:#fcfdff;">
          <div style="font-size:11px; letter-spacing:.08em; color:#7d8896; font-weight:700; text-transform:uppercase;">Porto e logística</div>
          <div style="margin-top:10px; line-height:1.55; color:#222;">
            <div><b>Porto:</b> ${escapeHtml(row.portLabel)}</div>
            <div><b>Inland:</b> US$ ${escapeHtml(String(row.inland ?? '—'))}/t</div>
            <div><b>Frete:</b> ${escapeHtml(row.freightLabel)} • US$ ${Number(row.freightUsdT||0).toFixed(1)}/t</div>
            <div><b>Embarque:</b> Rodada ${escapeHtml(String(row.freightTargetRound ?? '—'))}</div>
          </div>
        </div>
        <div style="border:1px solid #e6e9ef; border-radius:10px; padding:12px 14px; background:#fcfdff;">
          <div style="font-size:11px; letter-spacing:.08em; color:#7d8896; font-weight:700; text-transform:uppercase;">Venda</div>
          <div style="margin-top:10px; line-height:1.55; color:#222;">
            <div><b>Comprador:</b> ${escapeHtml(row.buyerLabel)}</div>
            <div><b>Destino:</b> ${escapeHtml(row.destination)}</div>
            <div><b>Basis:</b> ${row.basis != null ? escapeHtml(String(row.basis)) + ' ¢/bu' : '—'}</div>
            <div><b>CBOT ref.:</b> ${escapeHtml(String(row.ref_cbot_cent_bu ?? '—'))} ¢/bu</div>
          </div>
        </div>
        <div style="border:1px solid #e6e9ef; border-radius:10px; padding:12px 14px; background:#fcfdff;">
          <div style="font-size:11px; letter-spacing:.08em; color:#7d8896; font-weight:700; text-transform:uppercase;">Mercado</div>
          <div style="margin-top:10px; line-height:1.55; color:#222;">
            <div><b>Câmbio:</b> ${escapeHtml(String(row.ref_cambio ?? '—'))}</div>
            <div><b>Rodadas de compra:</b> ${escapeHtml(row.exwRounds.join(', '))}</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function openTradeDetailModal(kind, key) {
  const modal = document.getElementById('tradeDetailModal');
  const title = document.getElementById('tradeDetailTitle');
  const sub = document.getElementById('tradeDetailSub');
  const content = document.getElementById('tradeDetailContent');
  if (!modal || !title || !sub || !content) return;
  ensureTradeDetailModalBindings();
  if (kind === 'frete') {
    title.textContent = 'Boleta de Frete Contratado';
    sub.textContent = `Detalhes estruturados do frete contratado para ${PORT_LABEL_SAFE(key)}.`;
    content.innerHTML = buildFreteBoletaHtml(key);
  } else if (kind === 'bid') {
    title.textContent = 'Boleta de BID Fechado';
    sub.textContent = `Detalhes estruturados do bid fechado da rodada ${key}.`;
    content.innerHTML = buildBidBoletaHtml(Number(key));
  } else {
    title.textContent = 'Boleta de Negócio Fechado';
    sub.textContent = `Fluxo completo da soja até a venda para ${PORT_LABEL_SAFE(key)}.`;
    content.innerHTML = buildClosedDealBoletaHtml(key);
  }
  modal.style.display = 'block';
  requestAnimationFrame(() => { positionTradeDetailOnCanvas(); requestAnimationFrame(positionTradeDetailOnCanvas); });
}

function closeTradeDetailModal() {
  const modal = document.getElementById('tradeDetailModal');
  if (modal) modal.style.display = 'none';
}


function ensureTradeDetailModalBindings() {
  const modal = document.getElementById('tradeDetailModal');
  const overlay = document.getElementById('tradeDetailOverlay');
  const box = document.getElementById('tradeDetailBox');
  const btn = document.getElementById('tradeDetailCloseBtn');
  if (!modal || modal.dataset.boundTradeDetail === '1') return;
  modal.dataset.boundTradeDetail = '1';
  if (btn) btn.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); closeTradeDetailModal(); });
  if (overlay) overlay.addEventListener('click', closeTradeDetailModal);
  if (box) box.addEventListener('click', (ev) => ev.stopPropagation());
}

function positionTradeDetailOnCanvas() {
  positionCanvasModalElements('tradeDetailOverlay', 'tradeDetailBox', { maxW: 980, widthPct: 0.94, marginX: 14, marginY: 18, fitHeight: true });
}

  if (screenId === "partials_soja" && sc.text_note) {
    const box = sc.text_note;
    const old = document.getElementById("txt_text_note");
    if (old) old.remove();
    const wrap = document.createElement("div");
    wrap.className = "noteText";
    wrap.id = "txt_text_note";
    placeBox(wrap, box);
    wrap.style.fontSize = `${box.font || 24}px`;
    wrap.style.pointerEvents = "auto";
    wrap.style.display = "block";
    wrap.style.overflowY = "auto";
    wrap.style.overflowX = "hidden";
    wrap.style.padding = "10px 18px";
    wrap.style.boxSizing = "border-box";

    try {
      const items = getConfirmedExwRowsForUi();
      if (!items.length) {
        wrap.innerHTML = '<div style="padding:8px 0; color:#444;">Nenhuma soja originada CONFIRMADA até agora.</div>';
      } else {
        wrap.innerHTML = items.map(item => `
          <div style="background:rgba(255,255,255,0.50); border:1px solid rgba(0,0,0,.08); border-radius:14px; padding:12px 14px; margin-bottom:12px; box-shadow:0 3px 10px rgba(0,0,0,.04);">
            <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px;">
              <div style="min-width:0; flex:1;">
                <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                  <div style="font-weight:800; color:#111; font-size:${Math.max(20, (box.font || 24) - 2)}px;">Rodada ${item.round}</div>
                  <button type="button" class="btn-light soja-detail-btn" data-round="${item.round}" style="pointer-events:auto; padding:6px 12px; border-radius:999px; font-size:13px; line-height:1;">Detalhes</button>
                </div>
                <div style="margin-top:8px; font-weight:700; color:#171717; line-height:1.35;">${escapeHtml(item.label || 'Operação confirmada')}</div>
                <div style="margin-top:8px; color:#333; line-height:1.45; font-size:${Math.max(18, (box.font || 24) - 4)}px;">
                  ${escapeHtml(item.origin)} • ${escapeHtml(item.producer)} • ${FMT_TON_SAFE(item.volume_t)} t • R$ ${Number(item.price_brl_saca||0).toFixed(1)}/saca<br>
                  CBOT ${escapeHtml(String(item.ref_cbot_cent_bu ?? '-'))} ¢/bu • Câmbio ${escapeHtml(String(item.ref_cambio ?? '-'))} • ${escapeHtml(item.portLabel)} • Inland US$ ${escapeHtml(String(item.inland_usd_t_selected ?? '-'))}/t
                </div>
              </div>
            </div>
          </div>
        `).join('');
        wrap.querySelectorAll('.soja-detail-btn').forEach(btn => {
          btn.addEventListener('click', (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            openSojaDetailModal(Number(btn.dataset.round));
          });
        });
      }
    } catch (e) {
      console.error("Erro ao renderizar soja originada:", e);
      wrap.innerHTML = 'Erro ao carregar esta tela (veja o console).';
    }
    layer.appendChild(wrap);
  }



  if ((screenId === "partials_frete" || screenId === "partials_bids" || screenId === "partials_closed") && sc.text_note) {
    const box = sc.text_note;
    const old = document.getElementById("txt_text_note");
    if (old) old.remove();
    const wrap = document.createElement("div");
    wrap.className = "noteText";
    wrap.id = "txt_text_note";
    placeBox(wrap, box);
    wrap.style.fontSize = `${box.font || 24}px`;
    wrap.style.pointerEvents = "auto";
    wrap.style.display = "block";
    wrap.style.overflowY = "auto";
    wrap.style.overflowX = "hidden";
    wrap.style.padding = "10px 18px";
    wrap.style.boxSizing = "border-box";
    try {
      const items = screenId === "partials_frete" ? getFreteRowsForUi() : (screenId === "partials_bids" ? getBidRowsForUi() : getClosedDealRowsForUi());
      const emptyMsg = screenId === "partials_frete" ? 'Nenhum frete contratado CONFIRMADO até agora.' : (screenId === "partials_bids" ? 'Nenhum bid fechado (China) CONFIRMADO até agora.' : 'Nenhum negócio fechado até agora.');
      if (!items.length) {
        wrap.innerHTML = `<div style="padding:8px 0; color:#444;">${emptyMsg}</div>`;
      } else {
        wrap.innerHTML = items.map(item => {
          if (screenId === "partials_frete") {
            return `
            <div style="background:rgba(255,255,255,0.50); border:1px solid rgba(0,0,0,.08); border-radius:14px; padding:12px 14px; margin-bottom:12px; box-shadow:0 3px 10px rgba(0,0,0,.04);">
              <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px;">
                <div style="min-width:0; flex:1;">
                  <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                    <div style="font-weight:800; color:#111; font-size:${Math.max(20, (box.font || 24) - 2)}px;">Rodada ${item.contractRound}</div>
                    <button type="button" class="btn-light trade-detail-btn" data-kind="frete" data-key="${item.portKey}" style="pointer-events:auto; padding:6px 12px; border-radius:999px; font-size:13px; line-height:1;">Detalhes</button>
                  </div>
                  <div style="margin-top:8px; font-weight:700; color:#171717; line-height:1.35;">${escapeHtml(item.label)}</div>
                  <div style="margin-top:8px; color:#333; line-height:1.45; font-size:${Math.max(18, (box.font || 24) - 4)}px;">
                    ${escapeHtml(item.portLabel)} → ${escapeHtml(item.destination)} • ${FMT_TON_SAFE(item.volume_t)} t • US$ ${Number(item.usd_t||0).toFixed(1)}/t<br>
                    Comprador final: ${escapeHtml(item.buyerLabel)}
                  </div>
                </div>
              </div>
            </div>`;
          }
          if (screenId === "partials_bids") {
            return `
            <div style="background:rgba(255,255,255,0.50); border:1px solid rgba(0,0,0,.08); border-radius:14px; padding:12px 14px; margin-bottom:12px; box-shadow:0 3px 10px rgba(0,0,0,.04);">
              <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px;">
                <div style="min-width:0; flex:1;">
                  <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                    <div style="font-weight:800; color:#111; font-size:${Math.max(20, (box.font || 24) - 2)}px;">Rodada ${item.round}</div>
                    <button type="button" class="btn-light trade-detail-btn" data-kind="bid" data-key="${item.round}" style="pointer-events:auto; padding:6px 12px; border-radius:999px; font-size:13px; line-height:1;">Detalhes</button>
                  </div>
                  <div style="margin-top:8px; font-weight:700; color:#171717; line-height:1.35;">${escapeHtml(item.label)}</div>
                  <div style="margin-top:8px; color:#333; line-height:1.45; font-size:${Math.max(18, (box.font || 24) - 4)}px;">
                    ${escapeHtml(item.destination)} • ${FMT_TON_SAFE(item.volume_t)} t • Basis ${escapeHtml(String(item.basis ?? '—'))} ¢/bu<br>
                    ${escapeHtml(item.portKey ? item.portLabel : 'Frete ainda não contratado')}
                  </div>
                </div>
              </div>
            </div>`;
          }
          return `
            <div style="background:rgba(255,255,255,0.50); border:1px solid rgba(0,0,0,.08); border-radius:14px; padding:12px 14px; margin-bottom:12px; box-shadow:0 3px 10px rgba(0,0,0,.04);">
              <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px;">
                <div style="min-width:0; flex:1;">
                  <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                    <div style="font-weight:800; color:#111; font-size:${Math.max(20, (box.font || 24) - 2)}px;">Rodada ${item.bidRound}</div>
                    <button type="button" class="btn-light trade-detail-btn" data-kind="closed" data-key="${item.portKey}" style="pointer-events:auto; padding:6px 12px; border-radius:999px; font-size:13px; line-height:1;">Detalhes</button>
                  </div>
                  <div style="margin-top:8px; font-weight:700; color:#171717; line-height:1.35;">${escapeHtml(item.originShort)} → ${escapeHtml(item.portLabel)} → ${escapeHtml(item.destination)}</div>
                  <div style="margin-top:8px; color:#333; line-height:1.45; font-size:${Math.max(18, (box.font || 24) - 4)}px;">
                    ${FMT_TON_SAFE(item.totalVolume)} t • ${escapeHtml(item.freightLabel)} • Comprador ${escapeHtml(item.buyerLabel)}
                  </div>
                </div>
              </div>
            </div>`;
        }).join('');
        wrap.querySelectorAll('.trade-detail-btn').forEach(btn => {
          btn.addEventListener('click', (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            openTradeDetailModal(btn.dataset.kind, btn.dataset.key);
          });
        });
      }
    } catch (e) {
      console.error(`Erro ao renderizar ${screenId}:`, e);
      wrap.innerHTML = 'Erro ao carregar esta tela (veja o console).';
    }
    layer.appendChild(wrap);
  }


  if (
    sc.text_note &&
    (
      (screenId === "r1_exw" && !isCampaignLevel1Exw()) ||
      screenId === "r1_frete" ||
      screenId === "r1_cfr" ||
      screenId === "partials_pl"
    )
  ) {
    const box = sc.text_note;
    const el = document.createElement("div");
    el.className = "noteText";
    el.id = "txt_text_note";
    placeBox(el, box);
    el.style.fontSize = `${box.font || 34}px`;
    el.style.whiteSpace = "pre-wrap";
    el.style.pointerEvents = "none";
    try {
    el.textContent = getNoteText();
  } catch (e) {
    console.error("Erro ao renderizar note/parciais:", e);
    el.textContent = "Erro ao carregar esta tela (veja o console).";
  }
    layer.appendChild(el);
  }

  // ✅ EXW: tabela fixa com as 5 ofertas (sem depender de clique no mapa)
  // Isso desenha APENAS o texto dentro do quadro "LISTA DE OFERTAS EXW" da imagem.
  if (screenId === "r1_exw" && sc.text_exw_offers && !isCampaignLevel1Exw()) {
    const box = sc.text_exw_offers;
    const el = document.createElement("div");
    el.className = "noteText";
    el.id = "txt_text_exw_offers";
    placeBox(el, box);
    el.style.pointerEvents = "none";
    el.style.display = "block";
    el.style.fontSize = `${box.font || 20}px`;
    el.style.lineHeight = "1.15";
    el.style.padding = box.padding ?? "10px";
    el.style.color = "#111";

    const offers = getCurrentExwOffersForRender(rd).slice(0, 5);
    const fmtVol = (v) => {
      const n = Number(v || 0);
      return n.toLocaleString("pt-BR");
    };
    const fmtPrice = (p) => {
      const n = Number(p || 0);
      // tenta mostrar sem casas decimais se for inteiro
      const isInt = Number.isFinite(n) && Math.abs(n - Math.round(n)) < 1e-9;
      return "R$" + n.toLocaleString("pt-BR", {
        minimumFractionDigits: isInt ? 0 : 1,
        maximumFractionDigits: isInt ? 0 : 1
      });
    };

    const rowsHtml = offers.map((o) => {
      const label = formatOfferDisplayName(o);
      return `
        <tr>
          <td style="padding:8px 10px; border-bottom:1px solid rgba(0,0,0,.12); font-weight:700;">${label}</td>
          <td style="padding:8px 10px; border-bottom:1px solid rgba(0,0,0,.12); text-align:center;">${fmtVol(o?.volume_t)} t</td>
          <td style="padding:8px 10px; border-bottom:1px solid rgba(0,0,0,.12); text-align:right; font-weight:800;">${fmtPrice(o?.price_brl_saca)}</td>
        </tr>`;
    }).join("");

    el.innerHTML = `
      <table style="width:100%; border-collapse:collapse;">
        <thead>
          <tr>
            <th style="text-align:left; padding:6px 10px; border-bottom:2px solid rgba(0,0,0,.25);">Nome</th>
            <th style="text-align:center; padding:6px 10px; border-bottom:2px solid rgba(0,0,0,.25);">Volume</th>
            <th style="text-align:right; padding:6px 10px; border-bottom:2px solid rgba(0,0,0,.25);">Preço</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || `
            <tr><td colspan="3" style="padding:10px; opacity:.75;">Sem ofertas nesta rodada.</td></tr>
          `}
        </tbody>
      </table>
    `;

    layer.appendChild(el);
  }

  // ✅ RESULTADOS: imprime os textos nos quadrados do layout
  if (screenId === "results_screen") {
    const payload = buildResultsPayload();

    addText("text_title", payload.text.title, "overlayText", { fontWeight: "700" });
    addText("text_revenue", payload.text.revenue, "overlayText", { fontWeight: "800" });
    addText("text_cost", payload.text.cost, "overlayText", { fontWeight: "800" });
    addText("text_penalties", payload.text.penalties, "overlayText", { fontWeight: "800" });

    // PNL: usa uma classe diferente para facilitar CSS se quiser
    addText("text_pnl", `PNL: ${payload.text.pnl}`, "overlayText", { fontWeight: "900" });

    // caixas grandes -> texto no topo/esquerda, quebra de linha
    addText("text_ship1", payload.text.ship1, "noteText", {
      whiteSpace: "pre-wrap",
      justifyContent: "flex-start",
      alignItems: "flex-start",
      padding: "10px",
      textAlign: "left",
      lineHeight: "1.2"
    });
    addText("text_ship2", payload.text.ship2, "noteText", {
      whiteSpace: "pre-wrap",
      justifyContent: "flex-start",
      alignItems: "flex-start",
      padding: "10px",
      textAlign: "left",
      lineHeight: "1.2"
    });
    addText("text_pen_applied", payload.text.penaltiesApplied, "noteText", {
      whiteSpace: "pre-wrap",
      justifyContent: "flex-start",
      alignItems: "flex-start",
      padding: "10px",
      textAlign: "left",
      lineHeight: "1.2"
    });

    addText("text_insight", payload.text.insight, "noteText", {
      whiteSpace: "pre-wrap",
      justifyContent: "center",
      alignItems: "center",
      padding: "10px",
      textAlign: "center",
      lineHeight: "1.2"
    });

    // Painel “Detalhes” (OPÇÃO A): alterna JSON completo
    if (state.ui.showDetails) {
      addText("text_details", JSON.stringify(payload.out, null, 2), "noteText", {
        whiteSpace: "pre-wrap",
        justifyContent: "flex-start",
        alignItems: "flex-start",
        padding: "12px",
        textAlign: "left",
        lineHeight: "1.15",
        background: "rgba(0,0,0,.55)",
        borderRadius: "16px",
        border: "1px solid rgba(255,255,255,.25)"
      });
    }
  }

  // --------------------
  // Hotspots
  // --------------------
  function addHot(key, onClick) {
    const box = sc[key];
    if (!box) return;
    const el = document.createElement("div");
    el.className = calibEnabled ? "hotspot hotspot-debug" : "hotspot";
    placeBox(el, box);
    el.onclick = () => {
      if (state.guideOverlayOpen) return;
      onClick();
    };
    // Atalho de confirmação apenas para o cockpit do L1; não altera hotspots compartilhados.
    if (isCampaignLevel1Exw(screenId) && key === 'hot_confirm') el.dataset.l1Hot = 'confirm';
    layer.appendChild(el);
  };

  // Botao VISIVEL (usa a mesma caixa de calibracao do hotspot)
  function addIconButton(key, label, onClick) {
    const box = sc[key];
    if (!box) return;

    const el = document.createElement("div");
    el.className = (key === "hot_link_bid") ? "iconBtn iconBtnRed" : (key === "hot_advance_round") ? "iconBtn iconBtnAdvance" : "iconBtn";
    placeBox(el, box);
    el.innerHTML = label;
    if (key === "hot_longshort") {
      el.style.fontSize = "18px";
      el.style.lineHeight = "1.05";
      el.style.textAlign = "center";
      el.style.padding = "6px";
      el.style.fontWeight = "900";
    }
    el.onclick = (ev) => {
      if (state.guideOverlayOpen) return;
      ev.stopPropagation();
      onClick(ev);
    };
    layer.appendChild(el);
  }

  function renderCampaignExwBags() {
    const offers = getCurrentExwOffersForRender(rd);
    offers.forEach((offer, idx) => {
      const box = getCampaignOfferMapBox(offer, idx, state.round);
      const img = document.createElement("img");
      img.className = "campaign-exw-bag";
      img.src = "assets/soy_bag.png";
      img.alt = getOfferShortLabel(offer);
      img.title = `${getOfferShortLabel(offer)} • ${formatTon(Number(offer.volume_t || offer.volume || 0))} t • R$ ${Number(offer.price_brl_saca || 0).toFixed(1)}/sc`;
      placeBox(img, box);
      const chosen = state.choices?.exw?.[state.round];
      if (chosen && Number(chosen.id) === Number(offer.id)) img.classList.add("selected");
      img.onclick = (ev) => {
        if (state.guideOverlayOpen) return;
        ev.preventDefault();
        ev.stopPropagation();
        selectExwOfferForCurrentRound(offer, rd, screenId);
      };
      layer.appendChild(img);
    });
  }

  function addModeButton(key, label, onClick, tone = "guided") {
    const box = sc[key];
    if (!box) return;
    const el = document.createElement("div");
    const toneClass = tone === "expert" ? "modeChoiceBtnExpert" : tone === "campaign" ? "modeChoiceBtnCampaign" : "modeChoiceBtnGuided";
    el.className = `modeChoiceBtn ${toneClass}`;
    placeBox(el, box);
    el.textContent = label;
    el.onclick = onClick;
    layer.appendChild(el);
  }

  function addLockOverlay(key, message = "Esta etapa não faz parte deste level") {
    const box = sc[key];
    if (!box) return;
    const el = document.createElement('div');
    el.className = 'lockOverlayHint';
    placeBox(el, box);
    el.setAttribute('data-tip', message);
    el.innerHTML = '<span class="lockOverlayIcon">🔒</span>';
    layer.appendChild(el);
  }

  function addGuideHelpButton(screenKey) {
    if (!isGuidedMode() && !isCampaignMode()) return;
    let flow = GUIDE_DEFAULT_FLOW_BY_SCREEN[screenKey];
    if (isCampaignMode()) {
      if (screenKey === 'r1_home') flow = 'campaign_home';
      if (screenKey === 'r1_exw') flow = 'campaign_exw';
    }
    if (!flow || !sc.hot_help) return;
    addIconButton("hot_help", "GUIA", () => openGuideFlow(flow, true));
  }

  function renderGuideOverlay() {
    if (!state.guideOverlayOpen || !state.guideFlow) return;
    const flowContent = getGuideFlowContent(state.guideFlow);
    if (!flowContent || !flowContent.length) return;
    const text = flowContent[state.guideStep] || "";

    const blocker = document.createElement("div");
    blocker.className = "guideBlocker";
    layer.appendChild(blocker);

    const kBox = sc.guide_kangaroo;
    if (kBox) {
      const kangaroo = document.createElement("img");
      kangaroo.className = "guideKangaroo";
      kangaroo.src = "assets/kangaroo.png";
      kangaroo.alt = "Guia do jogo";
      placeBox(kangaroo, kBox);
      layer.appendChild(kangaroo);
    }

    const bBox = sc.guide_bubble;
    if (bBox) {
      const bubble = document.createElement("img");
      bubble.className = "guideBubbleImg";
      bubble.src = "assets/speech_balloon.png";
      bubble.alt = "Balão de fala";
      placeBox(bubble, bBox);
      layer.appendChild(bubble);
    }

    const tBox = sc.guide_text;
    if (tBox) {
      const txt = document.createElement("div");
      txt.className = "guideBubbleText";
      txt.textContent = text;
      placeBox(txt, tBox);
      if (tBox.font) txt.style.fontSize = `${Math.round(tBox.font)}px`;
      layer.appendChild(txt);
    }

    const nBox = sc.guide_next;
    if (nBox) {
      const next = document.createElement("button");
      next.className = "guideNextBtn";
      next.type = "button";
      next.textContent = state.guideStep >= (flowContent.length - 1) ? "OK" : "➜";
      placeBox(next, nBox);
      if (nBox.font) next.style.fontSize = `${Math.round(nBox.font)}px`;
      next.onclick = (ev) => {
        ev.stopPropagation();
        advanceGuideFlow();
      };
      layer.appendChild(next);
    }
  }

  if (screenId === "r1_home") {
    addGuideHelpButton("r1_home");
    if (isCampaignMode()) {
      addHot("hot_exw", () => setStage("r1_exw"));
      addHot("hot_endround", () => nextRound());
      addIconButton("hot_ports", "PORTOS", () => {});
      addIconButton("hot_longshort", "LONG /<br>SHORT", () => {});
      if (Number(state.campaign.levelId) === 1) addHot("hot_news", () => setStage("r1_news"));
      else addLockOverlay("hot_news", "Esta etapa será desbloqueada nos próximos níveis");
      addLockOverlay("hot_frete", "Esta etapa será desbloqueada nos próximos níveis");
      addLockOverlay("hot_cfr", "Esta etapa será desbloqueada nos próximos níveis");
      addLockOverlay("hot_mtm", "Esta etapa será desbloqueada nos próximos níveis");
      addLockOverlay("hot_ports", "Esta etapa será desbloqueada nos próximos níveis");
      addLockOverlay("hot_longshort", "Esta etapa será desbloqueada nos próximos níveis");
      addLockOverlay("hot_glossary", "Esta etapa será desbloqueada nos próximos níveis");
    } else {
      addHot("hot_news", () => setStage("r1_news"));
      addHot("hot_exw", () => setStage("r1_exw"));
      addHot("hot_frete", () => setStage("r1_frete"));
      addHot("hot_cfr", () => setStage("r1_cfr"));
      addHot("hot_glossary", () => openGlossaryModal());
      addIconButton("hot_ports", "PORTOS", () => openPortsModal());
      addIconButton("hot_longshort", "LONG /<br>SHORT", () => openLongShortModal());
      addHot("hot_mtm", () => openMtmModal());
      addHot("hot_endround", () => openRoundSummaryModal());
    }
  }

  if (screenId === "ship_select") {
    addHot("hot_ship1", () => {
      resetGameStateForNewRun();
      state.settings.shipCount = 1;
      startGame();
    });
    addHot("hot_ship2", () => {
      resetGameStateForNewRun();
      state.settings.shipCount = 2;
      startGame();
    });
    addHot("hot_back", () => setStage("home_canva"));
  }

  if (screenId === "home_canva") {
    addHot("hot_start", () => {
  resetGameStateForNewRun();
  state.settings.shipCount = 1; // legado: não usado na lógica por porto
  bgmHome.play().then(() => { bgmHome.pause(); bgmHome.volume = 0; }).catch(() => {});
  if (state.primaryMode === "campaign" && !state.campaign.active) {
    initCampaignRun(state.campaign.levelId || 1);
  } else {
    startGame();
  }
    });
addHot("hot_calib", () => toggleCalib(!calibEnabled));

    // Botao tela cheia (visivel e clicavel)
    addHot("hot_fullscreen", () => toggleFullscreen());
    addIconButton("hot_fullscreen", "⛶", () => toggleFullscreen());
  }

  // --------------------
  // ✅ TUTORIAL (5 telas antes do Start)
  // --------------------
  if (screenId === "tutorial_0") {
    addModeButton("hot_mode_guided", "JOGO GUIADO / INICIANTE", () => {
      state.primaryMode = "scenarios";
      state.gameMode = "guided";
      state.campaign.active = false;
      state.guideSeen = {};
      state.guideOverlayOpen = false;
      state.guideFlow = null;
      state.guideStep = 0;
      setStage("tutorial_1");
    }, "guided");

    addModeButton("hot_mode_expert", "JOGO EXPERT", () => {
      openAccessModal("expert", () => {
        state.primaryMode = "scenarios";
        state.gameMode = "expert";
        state.campaign.active = false;
        state.guideSeen = {};
        state.guideOverlayOpen = false;
        state.guideFlow = null;
        state.guideStep = 0;
        setStage("tutorial_1");
      });
    }, "expert");

    addModeButton("hot_mode_campaign", "MODO CAMPANHA", () => {
      state.primaryMode = "campaign";
      state.gameMode = "guided";
      state.campaign.active = false;
      state.campaign.levelId = 1;
      state.campaign.introRedirectPending = false;
      state.guideSeen = {};
      state.guideOverlayOpen = false;
      state.guideFlow = null;
      state.guideStep = 0;
      setStage("campaign_menu");
    }, "campaign");
  }

  if (screenId === "tutorial_1") {
    // Primeira tela do tutorial: Avançar e Pular tutorial
    addHot("hot_tut_next", () => setStage("tutorial_2"));
    addHot("hot_tut_skip", () => setStage("home_canva"));
  }

  if (screenId === "tutorial_2") {
    addHot("hot_tut_next", () => setStage("tutorial_3"));
  }

  if (screenId === "tutorial_3") {
    addHot("hot_tut_next", () => setStage("tutorial_4"));
  }

  if (screenId === "tutorial_4") {
    // Última tela: Avançar -> vai para o Start
    addHot("hot_tut_next", () => setStage("home_canva"));
  }

  // voltar das telas (exceto ship_select e home_canva e results_screen)
  if (sc.hot_back && !screenId.startsWith("partials_") && screenId !== "ship_select" && screenId !== "home_canva" && screenId !== "results_screen") {
    addHot("hot_back", () => {
      if (isCampaignMode() && screenId === "r1_exw") {
        setStage("r1_home");
        return;
      }
      setStage(state.prevStage || "home_canva");
    });
  }

  if (screenId === "r1_exw" || screenId === "r1_frete" || screenId === "r1_cfr") {
    addHot("hot_partials", () => openPartialsMenu());
  }

  if (screenId === "partials_menu") {
    addGuideHelpButton("partials_menu");
    addHot("hot_soja", () => setStage("partials_soja"));
    if (isCampaignMode()) {
      addLockOverlay("hot_frete", "Esta etapa será desbloqueada nos próximos níveis");
      addLockOverlay("hot_bids", "Esta etapa será desbloqueada nos próximos níveis");
      addLockOverlay("hot_closed", "Esta etapa será desbloqueada nos próximos níveis");
      addLockOverlay("hot_pl", "Esta etapa será desbloqueada nos próximos níveis");
    } else {
      addHot("hot_frete", () => setStage("partials_frete"));
      addHot("hot_bids", () => setStage("partials_bids"));
      addHot("hot_closed", () => setStage("partials_closed"));
      addHot("hot_pl", () => setStage("partials_pl"));
    }
    addHot("hot_home", () => setStage("r1_home"));
    addHot("hot_back", () => backFromPartials());
  }

  if (screenId === "partials_soja" || screenId === "partials_frete" || screenId === "partials_bids" || screenId === "partials_pl" || screenId === "partials_closed") {
    addGuideHelpButton(screenId);
    addHot("hot_back", () => backFromPartials());
  }

  if (screenId === "r1_exw") {
    addGuideHelpButton("r1_exw");
    if (isCampaignMode()) {
      addIconButton("hot_advance_round", "AVANÇAR RODADA", () => {
        if (state.confirmed?.exw?.[state.round]) openCampaignAdvanceModal();
        else { nextRound(); }
      });
    }
    const offers = getCurrentExwOffersForRender(rd);
    if (isCampaignMode()) {
      renderCampaignExwBags();
    } else {
      const keys = ["hot_bag1","hot_bag2","hot_bag3","hot_bag4","hot_bag5"];
      keys.forEach((k, idx) => {
        if (offers[idx]) addHot(k, () => selectExwOfferForCurrentRound(offers[idx], rd, screenId));
      });
    }

    addHot("hot_confirm", () => {
      const chosen = state.choices.exw[state.round];
      if (!chosen) return;

      const confirmChosen = ({ key, inland }) => {
        chosen.corredor = key;
        chosen.inland_usd_t_selected = inland;
        state.confirmed.exw[state.round] = chosen;
        upsertExwPositionForRound(state.round, rd, chosen);
        renderOverlaysForScreen(screenId, rd);
        setTimerText();
        if (!isCampaignMode()) triggerGuideEvent("r1_exw_after_corridor");
      };

      if (isCampaignMode()) {
        const fixedKey = getCampaignLevel(state.campaign.levelId || 1).fixedPort || 'santos';
        const inlandMap = getExwInlandByCorridor(chosen);
        if (Number(state.campaign.levelId) === 1) {
          const lv = getCampaignLevel(1);
          const already = Object.entries(state.confirmed?.exw || {}).reduce((a,[r,o]) => a + (Number(r) === Number(state.round) ? 0 : Number(o?.volume_t || 0)),0);
          const remaining = Math.max(0, Number(lv.targetVolumeT || 0) - already);
          if (!remaining) { alert('Cargo completo. Avance para o fechamento do nível.'); return; }
          const offered = Number(chosen.available_volume_t || chosen.volume_t || 0);
          chosen.available_volume_t = offered;
          chosen.volume_t = Math.min(offered,remaining);
          if (chosen.volume_t < offered) {
            alert(`Compra parcial de ${formatTon(chosen.volume_t)} t confirmada no exercício. A oferta tinha ${formatTon(offered)} t, mas o navio só comporta o saldo disponível.`);
          }
        }
        confirmChosen({ key: fixedKey, inland: Number(inlandMap?.[fixedKey] || 0) });
        openCampaignAdvanceModal();
      } else {
        // Escolher corredor (porto) e aplicar o custo de frete interno específico da oferta
        openCorredorModal(chosen, confirmChosen);
      }
    });

    addHot("hot_discard", () => {
      delete state.choices.exw[state.round];
      delete state.confirmed.exw[state.round];
      removeExwPositionForRound(state.round);
      renderOverlaysForScreen(screenId, rd);
      setTimerText();
    });
  }

  if (screenId === "r1_frete") {
    addGuideHelpButton("r1_frete");
    // Botao visivel para vincular frete em aberto a um BID em aberto (modal 2 passos)
    addIconButton("hot_link_bid", "VINCULAR BID", () => {
      openLinkFreteBidModal(() => {
        renderOverlaysForScreen(screenId, rd);
        setTimerText();
      });
    });

    const offers = rd.ocean_freight || [];
    const keys = ["hot_ship1","hot_ship2","hot_ship3","hot_ship4","hot_ship5"];
    keys.forEach((k, idx) => {
      if (offers[idx]) addHot(k, () => {
        state.choices.ocean[state.round] = { ...offers[idx], ref_cambio: rd.usd };
        renderOverlaysForScreen(screenId, rd);
        setTimerText();
        triggerGuideEvent("r1_frete_first_offer");
      });
    });

    addHot("hot_confirm", () => {
      const chosen = state.choices.ocean[state.round];
      if (!chosen) return alert("Selecione um navio antes de confirmar.");
      // Escolher porto e rodada-alvo de embarque (modais)
      openPortoModal({ chosen }, (port) => {
        // 1 frete por porto
        state.freightPlansByPort = (state.freightPlansByPort && typeof state.freightPlansByPort === 'object') ? state.freightPlansByPort : {};
        if (state.freightPlansByPort[port]) {
          alert("Já existe um frete contratado para este porto.");
          return;
        }

        const proceedWithFreteTarget = (targetRound) => {
        state.confirmed.ocean[state.round] = chosen;

// ----- FREIGHT PLAN (por porto) -----
state.freightPlansByPort = (state.freightPlansByPort && typeof state.freightPlansByPort === 'object') ? state.freightPlansByPort : {};
state.freightPlanByRound = state.freightPlanByRound || {};

state.freightPlansByPort[port] = {
  port,
  contractRound: state.round,
  targetRound,
  usd_t: chosen.usd_t,
  label: chosen.label,
  ref_cambio: rd.usd,
  demurrageUsdPerRound: chosen.demurrage_usd_round ?? 0,
  demurrageAcc: state.freightPlansByPort[port]?.demurrageAcc ?? 0,
  lastChargedRound: null
};
state.freightPlanByRound[state.round] = port;

        // Modal 3 (opcional): vincular este frete a um BID China já fechado
        openLinkBidModal(port, (bidRound) => {
          if (bidRound) {
            const plan = state.freightPlansByPort ? state.freightPlansByPort[port] : null;
            if (plan) plan.linkedBidRound = bidRound;

            state.confirmed = state.confirmed || {};
            state.confirmed.cfr = state.confirmed.cfr || {};
            if (state.confirmed.cfr[bidRound]) {
              state.confirmed.cfr[bidRound].linkedFreightPort = port;
            }
          }
          renderOverlaysForScreen(screenId, rd);
          setTimerText();
          triggerGuideEvent("r1_frete_after_confirm");
          // permanece na tela de frete (apenas atualiza o caderno)
          renderStage();
        });

        renderOverlaysForScreen(screenId, rd);
        setTimerText();
        };

        if (shouldChooseShipmentRound()) {
          openFreteModal((targetRound) => {
            proceedWithFreteTarget(targetRound);
          });
        } else {
          proceedWithFreteTarget(getAutoShipmentRound());
        }
      });
      });

    addHot("hot_discard", () => {
      delete state.choices.ocean[state.round];
      delete state.confirmed.ocean[state.round];
      // remover freight plan associado a esta rodada (se existir)
      if (state.freightPlanByRound && state.freightPlanByRound[state.round] !== undefined) {
        const port = state.freightPlanByRound[state.round];
        if (state.freightPlansByPort && state.freightPlansByPort[port]) delete state.freightPlansByPort[port];
        delete state.freightPlanByRound[state.round];
      }
      renderOverlaysForScreen(screenId, rd);
      setTimerText();
    });
  }

  if (screenId === "r1_cfr") {
    addGuideHelpButton("r1_cfr");
    const offers = rd.china_offers || [];
    const keys = ["hot_port1","hot_port2","hot_port3","hot_port4"];
    keys.forEach((k, idx) => {
      if (offers[idx]) addHot(k, () => {
        state.choices.china[state.round] = { ...offers[idx], ref_cbot_cent_bu: rd.cbot_cent_bu, ref_cambio: rd.usd };
        renderOverlaysForScreen(screenId, rd);
        setTimerText();
        triggerGuideEvent("r1_cfr_first_offer");
      });
    });

    addHot("hot_confirm", () => {
      const chosen = state.choices.china[state.round];
      if (!chosen) return;
      // BID China pode ser fechado sem porto; vínculo com frete/porto ocorre depois
      if (!("port" in chosen)) chosen.port = null;
      if (!chosen.port) chosen.port = null;
      chosen.status = "CONFIRMADO";
      state.confirmed.china[state.round] = chosen;
      renderOverlaysForScreen(screenId, rd);
      setTimerText();
      triggerGuideEvent("r1_cfr_after_confirm");
    });
    addHot("hot_discard", () => {
      delete state.choices.china[state.round];
      delete state.confirmed.china[state.round];
      renderOverlaysForScreen(screenId, rd);
      setTimerText();
    });
  }

  // ✅ RESULTADOS: botões
  if (screenId === "results_screen") {
    addHot("hot_details", () => {
      state.ui.showDetails = !state.ui.showDetails;
      renderOverlaysForScreen(screenId, rd);
    });

    addHot("hot_close", () => {
      resetGameStateForNewRun();
      setStage("home_canva");
    });
  }

  renderGuideOverlay();

  const btnExit = document.getElementById("btnExitCalib");
  if (btnExit) btnExit.onclick = () => toggleCalib(false);
}

// --------------------
// MOTOR DE CÁLCULO (PNL)
// --------------------

// Custo fixo FOB/insumos (USD/t)
const FOBINS_USD_T = 11;

// Converte EXW (R$/saca) em USD/t e soma frete interno (USD/t)
function exwCostUsdPerT(rd, exw) {
  const sacaToT = rd.saca_to_t ?? getActiveRules()?.conversion?.saca_to_t_default ?? 0.06;

  const brlPerT = exw.price_brl_saca / sacaToT;     // R$/t
  const usdPerT = brlPerT / rd.usd;                 // USD/t

  // frete interno: usar o selecionado no corredor (quando existir)
  const inland = (exw.inland_usd_t_selected != null) ? exw.inland_usd_t_selected : (exw.freight_inland_usd_t ?? 0);

  // custo fixo FOB/insumos (default 4 USD/t)
  const fobins = (exw.fobins_usd_t != null) ? exw.fobins_usd_t : FOBINS_USD_T;

  return usdPerT + inland + fobins;
}

// ===============================
// POSIÇÕES EXW (Carteira) para MTM
// ===============================

function computeExwOriginBasis(rd, exw) {
  if (!rd || !exw) return null;
  const conv = rd.conv_centbu_to_usd_t || getActiveRules()?.conversion?.centbu_to_usd_t_default || 0.367454;
  const costUsdT = exwCostUsdPerT(rd, exw);
  const costCentBu = costUsdT / conv;
  return costCentBu - rd.cbot_cent_bu;
}

function upsertExwPositionForRound(roundNum, rdBuy, exwConfirmed) {
  if (!roundNum || !rdBuy || !exwConfirmed) return;
  const port = exwConfirmed.corredor;
  if (!port) return;

  const originBasis = computeExwOriginBasis(rdBuy, exwConfirmed);
  if (originBasis == null) return;

  state.exwPositions = Array.isArray(state.exwPositions) ? state.exwPositions : [];
  // 1 EXW por rodada: substitui se já existir
  state.exwPositions = state.exwPositions.filter(p => p && p.roundBought !== roundNum);

  state.exwPositions.push({
    id: `exw_r${roundNum}`,               // id estável (1 EXW por rodada)
    roundBought: roundNum,
    offerId: exwConfirmed.id,
    label: exwConfirmed.label,
    port,
    originBasis,                          // basis implícito no momento da compra
    ref_cbot_cent_bu: rdBuy.cbot_cent_bu,
    ref_usd: rdBuy.usd
  });
}

function removeExwPositionForRound(roundNum) {
  state.exwPositions = Array.isArray(state.exwPositions) ? state.exwPositions : [];
  state.exwPositions = state.exwPositions.filter(p => p && p.roundBought !== roundNum);
}

// ===============================
// MTM EXW (Basis)
// ===============================

function computeExwMtmBasis(rd, exw) {
  if (!rd || !exw) return null;

  const port = exw.corredor;
  if (!port) return null;

  // Basis atual do porto
  const portoBasis = rd.basis_porto?.[port];
  if (portoBasis == null) return null;

  // Custo EXW convertido para USD/t
  const costUsdT = exwCostUsdPerT(rd, exw);

  // Converte para cent/bu
  const conv = rd.conv_centbu_to_usd_t || 0.367454;
  const costCentBu = costUsdT / conv;

  // Basis implícito da originação
  const originBasis = costCentBu - rd.cbot_cent_bu;

  // MTM = diferença de basis
  const mtmBasis = portoBasis - originBasis;

  return {
    port,
    portoBasis,
    originBasis,
    mtmBasis
  };
}

// Preço de venda China em USD/t: (CBOT + basis) * conv
function chinaPriceUsdPerT(rd, china) {
  const conv = rd.conv_centbu_to_usd_t ?? getActiveRules()?.conversion?.centbu_to_usd_t_default ?? 0.367454;
  const centsPerBu = rd.cbot_cent_bu + china.basis_cent_bu;
  return centsPerBu * conv; // USD/t
}

// FIFO: consome estoque por lotes e devolve custo total do volume consumido
function consumeInventoryFifo(lots, qtyT) {
  let remaining = qtyT;
  let costUsd = 0;

  while (remaining > 0 && lots.length > 0) {
    const lot = lots[0];
    const take = Math.min(remaining, lot.vol_t);

    costUsd += take * lot.cost_usd_t;
    lot.vol_t -= take;
    remaining -= take;

    if (lot.vol_t <= 1e-9) lots.shift();
  }

  return { costUsd, filled: remaining <= 1e-9, missingT: remaining };
}

// Retorna escolhas CONFIRMADAS do round
function getConfirmedChoice(map, r) {
  const obj = map?.[r];
  if (!obj) return null;
  if (obj.confirmed === false) return null;
  if (obj.chosen) return obj.chosen;
  return obj;
}

// Computa PnL final baseado em escolhas confirmadas
function computeFinal() {

  const rules = getActiveRules() || {};

  const shipSizeT = rules.ship_sizes_t?.[0] ?? 60000;
  const shipCount = state.settings?.shipCount ?? 1;

  const pSaleCancel = rules.penalties?.sale_cancel_no_full_ship_usd ?? 5000000;
  const pUnusedFrete = rules.penalties?.unused_ocean_freight_penalty_usd ?? 1500000;
  const pOverBuyPerT = rules.penalties?.single_ship_overbuy_usd_per_t ?? 500;

  const lots = [];
  const freteContracts = [];
  const chinaContracts = [];

  let totalBoughtT = 0;

  for (let r = 1; r <= (rules.rounds ?? 5); r++) {
    const rd = getRoundData(r);

    const exw = getConfirmedChoice(state.confirmed.exw, r); // ✅ usa CONFIRMADOS
    if (exw) {
      totalBoughtT += (exw.volume_t ?? 0);
      lots.push({
        vol_t: exw.volume_t,
        cost_usd_t: exwCostUsdPerT(rd, exw),
        label: exw.label
      });
    }

    const ocean = getConfirmedChoice(state.confirmed.ocean, r); // ✅ usa CONFIRMADOS
    if (ocean) freteContracts.push({ round: r, usd_t: ocean.usd_t, label: ocean.label });

    const china = getConfirmedChoice(state.confirmed.china, r); // ✅ usa CONFIRMADOS
    if (china) chinaContracts.push({ round: r, price_usd_t: chinaPriceUsdPerT(rd, china), label: china.label });
  }

  const ships = [];
  const total = { revenue: 0, cost: 0, penalties: 0, pnl: 0, notes: [] };

  for (let i = 0; i < shipCount; i++) {
    const frete = freteContracts[i] || null;
    const sale = chinaContracts[i] || null;

    const ship = {
      ship: i + 1,
      size_t: shipSizeT,
      hasFrete: !!frete,
      hasSale: !!sale,
      executed: false,
      revenue: 0,
      cost: 0,
      penalties: 0,
      notes: []
    };

    if (!sale) {
      if (frete) {
        const freteCost = shipSizeT * frete.usd_t;
        ship.cost += freteCost;
        ship.penalties += pUnusedFrete;
        ship.notes.push(`Frete contratado sem venda (${frete.label}) → paga frete ${fmtUSD(freteCost)} + multa frete não usado ${fmtUSD(pUnusedFrete)}.`);
      }
      ships.push(ship);
      continue;
    }

    const { costUsd, filled, missingT } = consumeInventoryFifo(lots, shipSizeT);

    if (!filled) {
      ship.penalties += pSaleCancel;
      ship.cost += costUsd;

      ship.notes.push(`Venda sem lastro (${sale.label}) → navio NÃO completo. Faltaram ${Math.round(missingT)} t.`);
      ship.notes.push(`Multa venda sem lastro: ${fmtUSD(pSaleCancel)}.`);

      if (frete) {
        const freteCost = shipSizeT * frete.usd_t;
        ship.cost += freteCost;
        ship.penalties += pUnusedFrete;
        ship.notes.push(`Frete contratado (${frete.label}) e navio não embarcou → paga frete ${fmtUSD(freteCost)} + multa frete não usado ${fmtUSD(pUnusedFrete)}.`);
      }
      ships.push(ship);
      continue;
    }

    ship.executed = true;
    ship.cost += costUsd;

    if (frete) {
      const freteCost = shipSizeT * frete.usd_t;
      ship.cost += freteCost;
      ship.notes.push(`Frete aplicado (${frete.label}): ${fmtUSD(freteCost)}.`);
    }

    ship.revenue = shipSizeT * sale.price_usd_t;
    ship.notes.push(`Venda executada (${sale.label}): ${fmtUSD(ship.revenue)}.`);

    ships.push(ship);
  }

  if (shipCount === 1 && totalBoughtT > shipSizeT) {
    const excessT = totalBoughtT - shipSizeT;
    const pen = excessT * pOverBuyPerT;
    total.penalties += pen;
    total.notes.push(`Compras excederam 1 navio (${shipSizeT} t). Excedente: ${Math.round(excessT)} t.`);
    total.notes.push(`Multa excesso (US$ ${pOverBuyPerT}/t): ${fmtUSD(pen)}.`);
  }

  for (const s of ships) {
    total.revenue += s.revenue;
    total.cost += s.cost;
    total.penalties += s.penalties;
  }

  // Demurrage acumulado (custo) - soma por navio
  if (state.freightPlansByPort && typeof state.freightPlansByPort === 'object') {
    const dem = Object.values(state.freightPlansByPort).reduce((s,p)=>s+(p?.demurrageAcc||0),0);
    if (dem) total.cost += dem;
  }
  total.pnl = total.revenue - total.cost - total.penalties;

  return { shipSizeT, shipCount, ships, total };
}


function buildPortLotsUpToRound(port, upToRound){
  const lots = [];
  for (let r = 1; r <= upToRound; r++){
    const rd = getRoundData(r);
    const exw = getConfirmedChoice(state.confirmed.exw, r);
    if (!exw) continue;
    if ((exw.corredor || "") !== port) continue;
    lots.push({ vol_t: (exw.volume_t ?? 0), cost_usd_t: exwCostUsdPerT(rd, exw) });
  }
  return lots;
}

function consumeLotsFIFO(lots, qty_t){
  let remaining = qty_t;
  let taken = 0;
  let costUsd = 0;
  while (remaining > 0 && lots.length > 0){
    const lot = lots[0];
    const take = Math.min(remaining, lot.vol_t);
    if (take > 0){
      taken += take;
      costUsd += take * (lot.cost_usd_t ?? 0);
      lot.vol_t -= take;
      remaining -= take;
    }
    if (lot.vol_t <= 1e-9) lots.shift();
  }
  return { taken_t: taken, cost_usd: costUsd, remaining_t: remaining };
}

function computePartial(upToRound) {
  // P/L parcial (informativo) – usa o estado confirmado até a rodada atual.
  const rules = getActiveRules() || {};
  const shipSizeT = rules.ship_sizes_t?.[0] ?? 60000;

  // ----- Compras EXW (FIFO global) -----
  const lots = [];
  for (let r = 1; r <= upToRound; r++) {
    const rd = getRoundData(r);
    const exw = getConfirmedChoice(state.confirmed.exw, r);
    if (!exw) continue;
    lots.push({ vol_t: exw.volume_t, cost_usd_t: exwCostUsdPerT(rd, exw) });
  }

  // ----- Vendas China (por volume) -----
  const sales = [];
  for (let r = 1; r <= upToRound; r++) {
    const rd = getRoundData(r);
    const china = getConfirmedChoice(state.confirmed.china, r);
    if (!china) continue;
    const vol = (china.volume_t ?? shipSizeT);
    sales.push({ round: r, vol_t: vol, price_usd_t: chinaPriceUsdPerT(rd, china) });
  }

  // ----- Fretes contratados (por porto) -----
  const plans = (state.freightPlansByPort && typeof state.freightPlansByPort === "object") ? state.freightPlansByPort : {};
  const freightCostUsd = Object.keys(plans).reduce((acc, p) => acc + shipSizeT * (plans[p]?.usd_t ?? 0), 0);

  // Demurrage acumulado até aqui (já é atualizado por rodada no endRound)
  const demurrageUsd = Object.keys(plans).reduce((acc, p) => acc + (plans[p]?.demurrageAcc ?? 0), 0);

  // Consome inventário FIFO para atender vendas, na ordem em que foram confirmadas
  let revenue = 0;
  let cost = 0;

  sales.forEach((s) => {
    let remaining = s.vol_t;
    while (remaining > 0 && lots.length > 0) {
      const lot = lots[0];
      const take = Math.min(remaining, lot.vol_t);
      revenue += take * s.price_usd_t;
      cost += take * lot.cost_usd_t;
      lot.vol_t -= take;
      remaining -= take;
      if (lot.vol_t <= 1e-9) lots.shift();
    }
    // Se faltar lastro, a parte não atendida não entra no parcial (informativo)
  });

  const totalCost = cost + freightCostUsd + demurrageUsd;
  const pnl = revenue - totalCost;

  return {
    totalRevenueUsd: revenue,
    totalCostUsd: totalCost,
    totalFreightUsd: freightCostUsd,
    totalDemurrageUsd: demurrageUsd,
    pnlUsd: pnl
  };
}

// --------------------
// UI de calibração (painel)
// --------------------
function renderCalibPanelHTML(screenId) {
  const sc = getScreenCalib(screenId);
  const keys = Object.keys(sc).sort();
  const options = keys.map(k => `<option value="${k}">${k}</option>`).join("");
  return `
    <div class="calib-panel" id="calibPanel">
      <div class="calib-title">Calibração (arraste e redimensione)</div>
      <div class="calib-row">
        <label>Item</label>
        <select id="calibSelect">${options}</select>
      </div>
      <div class="calib-grid">
        <div><label>X</label><input id="calibX" type="number"></div>
        <div><label>Y</label><input id="calibY" type="number"></div>
        <div><label>Larg</label><input id="calibW" type="number"></div>
        <div><label>Alt</label><input id="calibH" type="number"></div>
      </div>
      <div class="calib-row">
        <label>Fonte</label>
        <input id="calibFont" type="number" placeholder="(apenas textos)">
      </div>
      <div class="calib-actions">
        <button class="btn btn-sm" id="btnSaveCalib">Salvar</button>
        <button class="btn btn-sm" id="btnCopyJson">Copiar JSON</button>
        <button class="btn btn-sm" id="btnResetCalib">Resetar tela</button>
      </div>
      <div class="calib-actions">
        <button class="btn btn-sm" id="btnExitCalib">Sair calibração</button>
      </div>
      <div class="calib-hint">
        Dica: selecione um item e arraste a caixa vermelha na tela.<br>
        Tudo fica salvo no seu navegador.
      </div>
    </div>
  `;
}

function bindCalibPanel(screenId, rd) {
  const panel = document.getElementById("calibPanel");
  const sel = document.getElementById("calibSelect");
  if (!panel || !sel) return;

  const sc = getScreenCalib(screenId);

  let currentKey = sel.value;
  const layer = document.getElementById("overlayLayer");

  const refreshInputs = () => {
    const box = sc[currentKey];
    document.getElementById("calibX").value = Math.round(box.x);
    document.getElementById("calibY").value = Math.round(box.y);
    document.getElementById("calibW").value = Math.round(box.w);
    document.getElementById("calibH").value = Math.round(box.h);
    document.getElementById("calibFont").value = box.font ? Math.round(box.font) : "";
  };

  const applyInputs = () => {
    const box = sc[currentKey];
    box.x = Number(document.getElementById("calibX").value);
    box.y = Number(document.getElementById("calibY").value);
    box.w = Number(document.getElementById("calibW").value);
    box.h = Number(document.getElementById("calibH").value);
    const f = document.getElementById("calibFont").value;
    if (f === "") delete box.font;
    else box.font = Number(f);
    saveCalibrationToLocalStorage();
    renderOverlaysForScreen(screenId, rd);
    setTimerText();
  };

  sel.innerHTML = Object.keys(sc).sort().map(k => `<option value="${k}">${k}</option>`).join("");
  currentKey = sel.value;
  refreshInputs();

  sel.onchange = () => {
    currentKey = sel.value;
    refreshInputs();
    attachDraggableBox();
  };

  ["calibX","calibY","calibW","calibH","calibFont"].forEach(id => {
    document.getElementById(id).oninput = applyInputs;
  });

  document.getElementById("btnSaveCalib").onclick = () => {
    saveCalibrationToLocalStorage();
    alert("Salvo no navegador!");
  };

  document.getElementById("btnCopyJson").onclick = async () => {
    const txt = JSON.stringify(calib, null, 2);
    try {
      await navigator.clipboard.writeText(txt);
      alert("JSON copiado!");
    } catch {
      prompt("Copie manualmente:", txt);
    }
  };

  document.getElementById("btnResetCalib").onclick = async () => {
    const fileCalib = await loadCalibrationFile();
    if (fileCalib?.screens?.[screenId]) {
      calib.screens[screenId] = fileCalib.screens[screenId];
      saveCalibrationToLocalStorage();
      renderOverlaysForScreen(screenId, rd);
      setTimerText();
      bindCalibPanel(screenId, rd);
    } else {
      alert("Não achei defaults para esta tela no calibration.json.");
    }
  };

  let dragEl = null;
  function attachDraggableBox() {
    if (!layer) return;

    if (dragEl) dragEl.remove();

    const box = sc[currentKey];
    dragEl = document.createElement("div");
    dragEl.className = "calib-dragbox";
    placeBox(dragEl, box);
    layer.appendChild(dragEl);

    const handle = document.createElement("div");
    handle.className = "calib-handle";
    dragEl.appendChild(handle);

    let dragging = false;
    let resizing = false;
    let startX = 0, startY = 0;
    let startBox = null;

    const toBase = (clientX, clientY) => {
      const rect = layer.getBoundingClientRect();
      const relX = (clientX - rect.left) / rect.width;
      const relY = (clientY - rect.top) / rect.height;
      return { x: relX * BASE_W, y: relY * BASE_H };
    };

    dragEl.addEventListener("pointerdown", (e) => {
      if (e.target === handle) return;
      dragging = true;
      dragEl.setPointerCapture(e.pointerId);
      const p = toBase(e.clientX, e.clientY);
      startX = p.x; startY = p.y;
      startBox = { ...sc[currentKey] };
      e.preventDefault();
    });

    handle.addEventListener("pointerdown", (e) => {
      resizing = true;
      handle.setPointerCapture(e.pointerId);
      const p = toBase(e.clientX, e.clientY);
      startX = p.x; startY = p.y;
      startBox = { ...sc[currentKey] };
      e.preventDefault();
      e.stopPropagation();
    });

    const onMove = (e) => {
      if (!dragging && !resizing) return;
      const p = toBase(e.clientX, e.clientY);
      const dx = p.x - startX;
      const dy = p.y - startY;

      if (dragging) {
        sc[currentKey].x = Math.round(startBox.x + dx);
        sc[currentKey].y = Math.round(startBox.y + dy);
      } else if (resizing) {
        sc[currentKey].w = Math.max(10, Math.round(startBox.w + dx));
        sc[currentKey].h = Math.max(10, Math.round(startBox.h + dy));
      }
      refreshInputs();
      renderOverlaysForScreen(screenId, rd);
      setTimerText();
      attachDraggableBox();
    };

    const onUp = () => {
      dragging = false;
      resizing = false;
      saveCalibrationToLocalStorage();
    };

    dragEl.addEventListener("pointermove", onMove);
    dragEl.addEventListener("pointerup", onUp);
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
  }

  attachDraggableBox();
}

// Atalho teclado: C liga/desliga calibração
window.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "c") toggleCalib(!calibEnabled);
});

// Start
window.selectScenarioMode = function(mode) {
  if (mode === 'expert') {
    openAccessModal('expert', () => {
      state.primaryMode = 'scenarios';
      state.gameMode = 'expert';
      renderStage();
    });
    return;
  }
  state.primaryMode = 'scenarios';
  state.gameMode = 'guided';
  renderStage();
};

window.startScenarioModeFromMenu = function() {
  if (!state.gameMode) state.gameMode = 'guided';
  resetGameStateForNewRun();
  state.primaryMode = 'scenarios';
  state.settings.shipCount = 1;
  startGame();
};

window.startCampaignLevel = function(levelId) {
  if (!isCampaignLevelUnlocked(levelId)) return;
  initCampaignRun(levelId);
};

window.restartCampaignLevel = function() {
  initCampaignRun(state.campaign.levelId || 1);
};

window.backToCampaignMenu = function() {
  exitCampaignFlow();
  stopTimer();
  setStage('campaign_menu');
};

loadGameData();

/* =========================
   CENTRALIZAÇÃO DE MODAIS NO CANVAS (stage)
   - Centraliza a caixa branca no centro do canvas (não no centro da tela inteira)
   - Funciona para modais HTML (corredor/porto/frete/linkBid) e modais criados via JS
   ========================= */
function getStageRect(){
  const stage = document.querySelector('.stage') || document.querySelector('.canvas-screen');
  if (!stage) return null;
  const r = stage.getBoundingClientRect();
  if (!r || !isFinite(r.left) || !isFinite(r.top) || r.width <= 0 || r.height <= 0) return null;
  return r;
}

function centerModalDialogToStage(modalEl){
  if (!modalEl) return;
  const dlg = modalEl.querySelector(':scope > div') || modalEl.firstElementChild;
  if (!dlg) return;

  const r = getStageRect();
  if (!r) {
    // fallback: centraliza na viewport
    modalEl.style.display = 'flex';
    modalEl.style.alignItems = 'center';
    modalEl.style.justifyContent = 'center';
    return;
  }

  // overlay ocupa viewport toda, mas dialog é fixado no centro do canvas
  modalEl.style.display = 'flex';
  modalEl.style.alignItems = 'stretch';
  modalEl.style.justifyContent = 'stretch';

  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;

  dlg.style.position = 'fixed';
  dlg.style.left = `${cx}px`;
  dlg.style.top = `${cy}px`;
  dlg.style.transform = 'translate(-50%, -50%)';
  dlg.style.margin = '0';

  // garante que não estoure no mobile
  if (!dlg.style.maxWidth) dlg.style.maxWidth = '92vw';
  if (!dlg.style.maxHeight) dlg.style.maxHeight = '80vh';
  if (!dlg.style.overflow) dlg.style.overflow = 'auto';
}

function showModalCentered(modalId){
  const modalEl = document.getElementById(modalId);
  if (!modalEl) return;
  centerModalDialogToStage(modalEl);
}

function closeCampaignAdvanceModal(){
  const modalEl = document.getElementById('campaignAdvanceModal');
  if (!modalEl) return;
  modalEl.remove();
}

function showCampaignRoundSplash(roundNum){
  const old = document.getElementById('campaignRoundSplashFixed');
  if (old) old.remove();
  const splash = document.createElement('div');
  splash.id = 'campaignRoundSplashFixed';
  splash.style.position = 'fixed';
  splash.style.left = '50%';
  splash.style.top = '50%';
  splash.style.transform = 'translate(-50%, -50%)';
  splash.style.zIndex = '10080';
  splash.style.pointerEvents = 'none';
  splash.innerHTML = `<div class="campaign-round-splash-fixed">RODADA ${Number(roundNum || 1)}</div>`;
  document.body.appendChild(splash);
  setTimeout(() => { splash.remove(); }, 2000);
}
window.showCampaignRoundSplash = showCampaignRoundSplash;

function advanceCampaignToNextRound(){
  closeCampaignAdvanceModal();
  nextRound();
}

function openCampaignAdvanceModal(){
  closeCampaignAdvanceModal();
  const modal = document.createElement('div');
  modal.id = 'campaignAdvanceModal';
  modal.className = 'modal-backdrop';
  modal.style.zIndex = '10060';
  modal.style.display = 'flex';

  const summaryHtml = buildCampaignRoundSummaryHtml(state.round);
  modal.innerHTML = `
    <div class="modal-box campaign-round-summary-modal" style="width:820px; text-align:left;">
      ${summaryHtml}
      <div class="btn-row" style="justify-content:center; margin-top:18px;">
        <button class="btn-light" type="button" onclick="closeCampaignAdvanceModal()">Voltar</button>
        <button class="btn-dark" type="button" onclick="advanceCampaignToNextRound()">Avançar rodada</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  centerModalDialogToStage(modal);
}
window.closeCampaignAdvanceModal = closeCampaignAdvanceModal;
window.advanceCampaignToNextRound = advanceCampaignToNextRound;
window.openCampaignAdvanceModal = openCampaignAdvanceModal;

// Re-centraliza em resize/orientação (se algum modal estiver aberto)
window.addEventListener('resize', ()=>{
  ['corredorModal','portoModal','freteModal','linkBidModal','linkFreteBidModal','campaignAdvanceModal'].forEach((id)=>{
    const el = document.getElementById(id);
    if (el && el.style && el.style.display && el.style.display !== 'none') {
      centerModalDialogToStage(el);
    }
  });
});


let pendingFreteChoice = null;



// ----- MODAL CORREDOR (EXW) -----
let pendingCorredorChoice = null;
let pendingExwOfferRef = null;

function getExwInlandByCorridor(offer){
  // A partir da Etapa 1, todas as ofertas EXW já possuem inland_by_corridor no gameData.json.
  if (offer && offer.inland_by_corridor && typeof offer.inland_by_corridor === "object") {
    return offer.inland_by_corridor;
  }

  // Segurança: se por algum motivo vier sem o mapa, retorna zeros (não quebra o jogo)
  return { barcarena:0, itaqui:0, santos:0, paranagua:0, riogrande:0 };
}

function refreshCorredorOptionsForOffer(offer){
  const sel = document.getElementById("corredorSelect");
  if (!sel) return;
  sel.innerHTML = "";
  const list = getActiveCorridorList();
  const map = getExwInlandByCorridor(offer);

  list.forEach(item=>{
  const k = item.key;
  const label = item.label || k;
  const v = (map && typeof map[k] === "number") ? map[k] : 0;

  // ✅ OPÇÃO 1 (ocultar): se o custo for absurdo, a rota é inviável → não mostra no dropdown
  if (v >= 99999) return;

  const opt = document.createElement("option");
  opt.value = k;
  opt.textContent = `${label} — US$ ${v}/t`;
  sel.appendChild(opt);
});
}

function openCorredorModal(offer, onConfirm){
  pendingExwOfferRef = offer;
  pendingCorredorChoice = onConfirm;
  refreshCorredorOptionsForOffer(offer);
  showModalCentered('corredorModal');
}

function confirmCorredor(){
  const key = document.getElementById("corredorSelect").value;
  document.getElementById("corredorModal").style.display="none";

  if (pendingCorredorChoice) {
    const map = getExwInlandByCorridor(pendingExwOfferRef);
    const inland = (map && typeof map[key] === "number") ? map[key] : 0;
    pendingCorredorChoice({ key, inland });
  }
  pendingCorredorChoice = null;
  pendingExwOfferRef = null;
}

function cancelCorredor(){
  document.getElementById("corredorModal").style.display="none";
  pendingCorredorChoice = null;
  pendingExwOfferRef = null;
}


function computeBoughtByPort(){
  const boughtByPort = {};
  for (let r = 1; r <= state.round; r++) {
    const exw = getConfirmedChoice(state.confirmed.exw, r);
    if (!exw) continue;
    const p = exw.corredor;
    const v = (exw.volume_t ?? 0);
    if (!p) continue;
    boughtByPort[p] = (boughtByPort[p] || 0) + v;
  }
  return boughtByPort;
}

function buildPortAlertsForResults(){
  const alerts = [];

  // bought totals across all rounds
  const boughtByPort = {};
  for (let r = 1; r <= (state.totalRounds || 10); r++) {
    const exw = getConfirmedChoice(state.confirmed.exw, r);
    if (!exw) continue;
    const p = exw.corredor;
    const v = (exw.volume_t ?? 0);
    if (!p) continue;
    boughtByPort[p] = (boughtByPort[p] || 0) + v;
  }

  // 1) originou acima do limite
  Object.keys(boughtByPort).forEach((p)=>{
    const over = boughtByPort[p] - 60000;
    if (over > 0) {
      alerts.push(`Originou acima do limite em ${SAFE_PORT_LABEL_SAFE(p)}: +${formatTon(over)} t`);
    }
  });

  // 2) originou mas não embarcou (não contratou frete para o porto)
  const freightPorts = (state.freightPlansByPort && typeof state.freightPlansByPort === 'object')
    ? Object.keys(state.freightPlansByPort)
    : [];
  Object.keys(boughtByPort).forEach((p)=>{
    if (boughtByPort[p] > 0 && !freightPorts.includes(p)) {
      alerts.push(`Originou para ${SAFE_PORT_LABEL_SAFE(p)} mas não embarcou (sem frete contratado)`);
    }
  });

  return alerts;
}
function buildPortSummaryForResults(){
  const lines = [];

  // totals bought by port over all rounds
  const boughtByPort = {};
  for (let r = 1; r <= (state.totalRounds || 10); r++) {
    const exw = getConfirmedChoice(state.confirmed.exw, r);
    if (!exw) continue;
    const p = exw.corredor;
    const v = (exw.volume_t ?? 0);
    if (!p) continue;
    boughtByPort[p] = (boughtByPort[p] || 0) + v;
  }

  const plans = (state.freightPlansByPort && typeof state.freightPlansByPort === 'object') ? state.freightPlansByPort : {};

  // ordenar por porto
  const ports = Object.keys(boughtByPort).sort((a,b)=>PORT_LABEL_SAFE(a).localeCompare(PORT_LABEL_SAFE(b)));

  ports.forEach((p)=>{
    const bought = boughtByPort[p] || 0;
    const hasFreight = !!plans[p];
    const dem = plans[p]?.demurrageAcc || 0;
    let txt = `${SAFE_PORT_LABEL_SAFE(p)}: originado ${formatTon(bought)} t`;
    txt += hasFreight ? " | frete: sim" : " | frete: não";
    if (dem > 0) txt += ` | demurrage: ${fmtUSD(dem)}`;
    lines.push(txt);
  });

  return lines;
}



function corridorLabel(key){
  return PORT_LABEL(key);
}


// ----- MODAL PORTO (frete marítimo) -----
let pendingPortoChoice = null;
let pendingFreteDraft = null;

function getAllowedPortsForFreight(chosen){
  const raw = String(chosen?.label || chosen?.name || chosen?.id || "").toUpperCase();
  const m = raw.match(/(\d+)/);
  const num = m ? parseInt(m[1], 10) : NaN;
  // Arco Norte: Frete 1 e 2 -> Barcarena / Itaqui
  if (num === 1 || num === 2) return ["barcarena", "itaqui"];
  // Arco Sul/Sudeste: Frete 3, 4 e 5 -> Santos / Paranaguá / Rio Grande
  return ["santos", "paranagua", "riogrande"];
}

function openPortoModal(draft, onConfirm){
  pendingFreteDraft = draft;        // { chosenFrete, ... }
  pendingPortoChoice = onConfirm;   // callback(portKey)

  const chosen = draft?.chosen || draft?.chosenFrete || null;
  const allowedPorts = getAllowedPortsForFreight(chosen);
  const sel = document.getElementById("portoSelect");
  if (sel) {
    sel.innerHTML = "";
    allowedPorts.forEach((portKey) => {
      const opt = document.createElement("option");
      opt.value = portKey;
      opt.textContent = PORT_LABEL_SAFE(portKey);
      sel.appendChild(opt);
    });
  }

  showModalCentered('portoModal');
}
function confirmPorto(){
  const port = document.getElementById("portoSelect").value;
  document.getElementById("portoModal").style.display="none";
  if (pendingPortoChoice) pendingPortoChoice(port);
  pendingPortoChoice = null;
}
function cancelPorto(){
  document.getElementById("portoModal").style.display="none";
  pendingPortoChoice = null;
  pendingFreteDraft = null;
}

function openFreteModal(onConfirm){
  pendingFreteChoice = onConfirm;
  const sel = document.getElementById("freteTargetRound");
  sel.innerHTML = "";
  for(let r=state.round; r<= (getActiveRules().rounds||10); r++){
    const o=document.createElement("option"); o.value=r; o.textContent="Rodada "+r;
    sel.appendChild(o);
  }
  showModalCentered('freteModal');
}
function confirmFreteTarget(){
  const r = parseInt(document.getElementById("freteTargetRound").value,10);
  document.getElementById("freteModal").style.display="none";
  if(pendingFreteChoice) pendingFreteChoice(r);
  pendingFreteChoice=null;
}
function cancelFreteTarget(){
  document.getElementById("freteModal").style.display="none";
  pendingFreteChoice=null;
}


/* =========================
   Botão visível (mobile) para vincular BID posteriormente
   ========================= */
(function setupLinkBidLaterButton(){
  const btn = document.getElementById("btnLinkBidLater");
  if (!btn) return;

  // deixa escondido até realmente precisar
  btn.style.display = "none";

  function getConfirmedBidsRounds(){
    const china = (state && state.confirmed && state.confirmed.china) || {};
    const rounds = [];
    Object.keys(china).forEach((r)=>{
      const o = china[r];
      if (o && (o.status === "confirmed" || o.confirmed)) {
        const rr = parseInt(r, 10);
        if (Number.isFinite(rr)) rounds.push(rr);
      }
    });
    rounds.sort((a,b)=>a-b);
    return rounds;
  }

  function getUnlinkedFreightPorts(){
    const ocean = (state && state.confirmed && state.confirmed.ocean) || {};
    return Object.keys(ocean).filter((p)=>{
      const v = ocean[p];
      return v && (v.status === "confirmed" || v.confirmed) && !v.linkedBidRound;
    });
  }

  function shouldShow(){
    return getConfirmedBidsRounds().length > 0 && getUnlinkedFreightPorts().length > 0;
  }

  function pickPort(unlinkedPorts){
    if (unlinkedPorts.length === 1) return unlinkedPorts[0];
    const labels = unlinkedPorts.map((p)=>PORT_LABEL_SAFE(p));
    const raw = prompt("Qual porto deseja vincular?\nOpções: " + labels.join(", "));
    if (!raw) return null;
    const norm = raw.trim().toLowerCase();
    for (let i=0;i<labels.length;i++){
      if (labels[i].toLowerCase().includes(norm) || norm.includes(labels[i].toLowerCase())) return unlinkedPorts[i];
    }
    for (let i=0;i<unlinkedPorts.length;i++){
      if (unlinkedPorts[i].toLowerCase() === norm) return unlinkedPorts[i];
    }
    alert("Porto inválido. Tente novamente.");
    return null;
  }

  function openLaterLinkFlow(){
    try {
      const bidsRounds = getConfirmedBidsRounds();
      if (bidsRounds.length === 0) {
        alert("Nenhum BID China confirmado ainda.");
        return;
      }

      const unlinkedPorts = getUnlinkedFreightPorts();
      if (unlinkedPorts.length === 0) {
        alert("Nenhum frete contratado pendente de vínculo com BID.");
        return;
      }

      const chosenPort = pickPort(unlinkedPorts);
      if (!chosenPort) return;

      openLinkBidModal(chosenPort, (bidRound)=>{
        if (!bidRound) return;

        state.confirmed = state.confirmed || {};
        state.confirmed.ocean = state.confirmed.ocean || {};
        state.confirmed.china = state.confirmed.china || {};

        const plan = state.confirmed.ocean[chosenPort];
        if (!plan) {
          alert("Frete do porto selecionado não encontrado.");
          return;
        }

        plan.linkedBidRound = bidRound;

        if (state.confirmed.china[bidRound]) {
          state.confirmed.china[bidRound].linkedFreightPort = chosenPort;
          state.confirmed.china[bidRound].linkedFreightRound = (plan.embarqueRound || plan.embarque || null);
        }

        // espelho em confirmed.cfr (para compatibilidade com parciais antigas)
        state.confirmed.cfr = state.confirmed.cfr || {};
        state.confirmed.cfr[bidRound] = state.confirmed.china[bidRound];

        saveState();
        renderStage();
      });
    } catch (e) {
      console.error(e);
      alert("Erro ao vincular BID. Veja o console.");
    }
  }

  btn.addEventListener("click", (e)=>{
    e.preventDefault();
    e.stopPropagation();
    openLaterLinkFlow();
  });

  // atualiza visibilidade periodicamente (evita depender de ordem de carga)
  setInterval(()=>{
    try {
      const scr = (state && state.currentScreen) || "";
      const isFrete = String(scr).includes("frete") || String(scr).includes("ocean") || String(scr).includes("maritimo");
      btn.style.display = (isFrete && shouldShow()) ? "block" : "none";
    } catch (_e) {}
  }, 400);

})()
function getHotRect(screenId, hotKey) {
  try {
    const sc = calibrationData[screenId] || {};
    const cfg = sc[hotKey];
    if (!cfg) return null;
    const img = document.getElementById("bgImage");
    if (!img) return null;
    const r = img.getBoundingClientRect();
    const scaleX = r.width / BASE_W;
    const scaleY = r.height / BASE_H;
    return {
      x: r.left + (cfg.x || 0) * scaleX,
      y: r.top + (cfg.y || 0) * scaleY,
      w: (cfg.w || 0) * scaleX,
      h: (cfg.h || 0) * scaleY,
    };
  } catch (e) {
    return null;
  }
}

;

// ===============================
// MODAL RESUMO DA RODADA
// ===============================

function openRoundSummaryModal() {

  const exw = state.confirmed.exw[state.round]
    ? "EXW confirmado"
    : "Nenhuma compra EXW";

  const frete = state.confirmed.ocean[state.round]
    ? "Frete confirmado"
    : "Nenhum frete";

  const bid = state.confirmed.china[state.round]
    ? "BID confirmado"
    : "Nenhuma venda";

  document.getElementById("summaryExw").innerText = exw;
  document.getElementById("summaryFrete").innerText = frete;
  document.getElementById("summaryBid").innerText = bid;

  document.getElementById("roundSummaryModal").style.display = "flex";
}
// Fechar modal (botão Voltar)
window.closeRoundSummary = function () {
  document.getElementById("roundSummaryModal").style.display = "none";
};


// Confirmar rodada e avançar
window.confirmRoundSummary = function () {

  document.getElementById("roundSummaryModal").style.display = "none";

  nextRound();
};

// ===============================
// MODAL MTM EXW
// ===============================

function openMtmModal() {

  const rd = getRoundData(state.round);
  if (!rd) {
    alert("Dados da rodada não carregados.");
    return;
  }

  const positions = (Array.isArray(state.exwPositions) ? state.exwPositions : [])
    .filter(p => p && Number(p.roundBought) <= Number(state.round))
    .sort((a,b) => (a.roundBought - b.roundBought));

  if (positions.length === 0) {
    alert("Nenhuma posição EXW aberta ainda.");
    return;
  }

  const lines = [];
  positions.forEach((p) => {
    const market = rd.basis_porto?.[p.port];
    if (market == null) return;

    const mtm = Number(market) - Number(p.originBasis);

    const sign = mtm >= 0 ? "+" : "";
    const lbl = (p.label ? String(p.label) : `Oferta ${p.offerId ?? ""}`).trim();

    const mtmColor = (mtm >= 0) ? "green" : "red";

lines.push(`
  <div style="padding:10px 0; border-bottom:1px solid #eee;">
    <div style="font-weight:700; margin-bottom:6px;">
      🧾 Rodada ${p.roundBought} • ${lbl}
    </div>

    <div style="margin:4px 0;">
      📍 <b>Porto:</b> ${PORT_LABEL_SAFE(p.port)}
    </div>

    <div style="margin:4px 0;">
      📦 <b>Basis Origem:</b> ${Number(p.originBasis).toFixed(1)} ¢/bu
    </div>

    <div style="margin:4px 0;">
      ⚓ <b>Basis Porto:</b> ${Number(market).toFixed(1)} ¢/bu
    </div>

    <div style="margin-top:6px; font-weight:700;">
      📊 <b>MTM:</b>
      <span style="color:${mtmColor};">
        ${sign}${mtm.toFixed(1)} ¢/bu
      </span>
    </div>
  </div>
`);
  });

  const listEl = document.getElementById("mtmList");
  if (listEl) {
   listEl.innerHTML = lines.length ? lines.join("") : "Sem dados suficientes para MTM.";
  } else {
    // fallback (se HTML antigo ainda estiver ativo)
    const first = positions[0];
    const market = rd.basis_porto?.[first.port];
    const mtm = (market != null) ? (Number(market) - Number(first.originBasis)) : 0;

    document.getElementById("mtmPort").innerText = String(first.port || "—").toUpperCase();
    document.getElementById("mtmOrigin").innerText = Number(first.originBasis).toFixed(1);
    document.getElementById("mtmMarket").innerText = Number(market ?? 0).toFixed(1);
    const mtmEl = document.getElementById("mtmValue");
    mtmEl.innerText = mtm.toFixed(1);
    mtmEl.style.color = (mtm >= 0) ? "green" : "red";
  }

  const modal = document.getElementById("mtmModal");
  modal.style.display = "block";
  requestAnimationFrame(() => {
    positionMtmOnCanvas();
    requestAnimationFrame(positionMtmOnCanvas);
  });
}

function closeMtmModal() {
  document.getElementById("mtmModal").style.display = "none";
}
function getGameCanvasRect() {
  // O jogo usa uma imagem (bgImg) dentro de #canvasWrap, não um <canvas>.
  const img = document.getElementById("bgImg");
  if (img) return img.getBoundingClientRect();

  const wrap = document.getElementById("canvasWrap");
  if (wrap) return wrap.getBoundingClientRect();

  return null;
}


function positionCanvasModalElements(overlayId, boxId, options = {}) {
  const rect = getGameCanvasRect();
  if (!rect) return;

  const overlay = document.getElementById(overlayId);
  const box = document.getElementById(boxId);
  if (!overlay || !box) return;

  const marginX = Number(options.marginX ?? 14);
  const marginY = Number(options.marginY ?? 18);
  const widthPct = Number(options.widthPct ?? 0.94);
  const boxMaxW = Number(options.maxW ?? 940);
  const fitHeight = options.fitHeight !== false;
  const fixedHeight = options.fixedHeight ? Number(options.fixedHeight) : null;

  overlay.style.inset = 'auto';
  overlay.style.left = rect.left + 'px';
  overlay.style.top = rect.top + 'px';
  overlay.style.width = rect.width + 'px';
  overlay.style.height = rect.height + 'px';

  const availableW = Math.max(280, rect.width - marginX * 2);
  const boxW = Math.min(boxMaxW, Math.max(280, rect.width * widthPct), availableW);

  box.style.width = boxW + 'px';
  box.style.maxWidth = boxW + 'px';

  const availableH = Math.max(180, rect.height - marginY * 2);
  if (fixedHeight) {
    const h = Math.min(fixedHeight, availableH);
    box.style.height = h + 'px';
    box.style.maxHeight = h + 'px';
  } else if (fitHeight) {
    box.style.height = '';
    box.style.maxHeight = availableH + 'px';
  }

  const boxRect = box.getBoundingClientRect();
  const boxH = Math.min(boxRect.height || availableH, availableH);
  const left = rect.left + (rect.width - boxW) / 2;
  const top = rect.top + Math.max(marginY, (rect.height - boxH) / 2);

  box.style.left = Math.round(Math.max(rect.left + marginX, left)) + 'px';
  box.style.top = Math.round(top) + 'px';

  if (typeof options.afterPosition === 'function') {
    options.afterPosition({ rect, overlay, box, availableW, availableH, boxW, boxH, marginX, marginY });
  }
}

function repositionOpenCanvasModals() {
  const accessModal = document.getElementById('accessModal');
  if (accessModal && accessModal.style.display !== 'none') positionAccessModalOnCanvas();

  const mtmModal = document.getElementById('mtmModal');
  if (mtmModal && mtmModal.style.display !== 'none') positionMtmOnCanvas();

  const glossaryModal = document.getElementById('glossaryModal');
  if (glossaryModal && glossaryModal.style.display !== 'none') positionGlossaryOnCanvas();

  const portsModal = document.getElementById('portsModal');
  if (portsModal && portsModal.style.display !== 'none') positionPortsOnCanvas();

  const longShortModal = document.getElementById('longShortModal');
  if (longShortModal && longShortModal.style.display !== 'none') positionLongShortOnCanvas();

  const sojaDetailModal = document.getElementById('sojaDetailModal');
  if (sojaDetailModal && sojaDetailModal.style.display !== 'none') positionSojaDetailOnCanvas();

  const tradeDetailModal = document.getElementById('tradeDetailModal');
  if (tradeDetailModal && tradeDetailModal.style.display !== 'none') positionTradeDetailOnCanvas();
}

function positionMtmOnCanvas() {
  positionCanvasModalElements('mtmOverlay', 'mtmBox', { maxW: 820, widthPct: 0.92, marginX: 12, marginY: 18, fitHeight: true });
}

function positionMtmButton() {
  const btn = document.getElementById("btnMtm");
  if (!btn) return;

  // só posiciona se estiver visível
  if (btn.style.display === "none") return;

  const rect = getGameCanvasRect();
  if (!rect) return;

  // centraliza embaixo do jogo (onde você marcou com o retângulo preto)
  const x = rect.left + rect.width / 2;

  // coloca o botão dentro do canvas, perto da borda inferior
  const y = rect.bottom - 14 - btn.getBoundingClientRect().height;

  btn.style.left = x + "px";
  btn.style.top = y + "px";
  btn.style.transform = "translateX(-50%)";
}
window.addEventListener("resize", () => {
  positionMtmButton();
  requestAnimationFrame(repositionOpenCanvasModals);
});
window.addEventListener("scroll", () => {
  requestAnimationFrame(repositionOpenCanvasModals);
}, { passive: true });

const GLOSSARY_TERMS = [
  { term: "ANEC", meaning: "Associação Nacional dos Exportadores de Cereais. No mercado, o termo também remete ao padrão contratual muito usado em exportação de grãos." },
  { term: "Arbitragem", meaning: "Estratégia de explorar diferenças de preço entre mercados, prazos ou instrumentos para capturar oportunidade econômica." },
  { term: "Armazenagem", meaning: "Custo e processo de guardar a commodity até o momento do embarque, venda ou consumo." },
  { term: "Basis", meaning: "Diferença entre o preço físico e o preço futuro de referência. No jogo, é peça central para medir competitividade e MTM." },
  { term: "Bid", meaning: "Oferta de compra. No jogo, normalmente representa o preço que um comprador aceita pagar por soja CFR na China." },
  { term: "Broker", meaning: "Intermediário que aproxima compradores e vendedores, ajudando na formação de negócios e informações de mercado." },
  { term: "CBOT", meaning: "Chicago Board of Trade. Bolsa de referência dos contratos futuros de soja, milho e trigo usados como base de precificação." },
  { term: "CFR", meaning: "Incoterm Cost and Freight. O vendedor entrega a mercadoria a bordo e paga o frete até o destino, mas o risco principal transfere no embarque." },
  { term: "CIF", meaning: "Incoterm Cost, Insurance and Freight. Semelhante ao CFR, mas com seguro contratado pelo vendedor até o destino acordado." },
  { term: "Carry", meaning: "Estratégia ou relação de mercado que compara preços entre vencimentos diferentes, refletindo custo de carregamento no tempo." },
  { term: "Cash Flow", meaning: "Fluxo de caixa. Entradas e saídas financeiras ao longo das rodadas, compras, vendas, fretes e liquidações." },
  { term: "Competitividade", meaning: "Capacidade de uma origem ou rota oferecer produto ao destino final com preço atrativo frente a outras opções globais." },
  { term: "Comprador", meaning: "Parte que adquire a mercadoria. No jogo, pode ser o comprador interno, exportador ou importador final." },
  { term: "Contrato", meaning: "Acordo comercial que define preço, volume, qualidade, prazos e responsabilidades entre as partes." },
  { term: "Corredor de Exportação", meaning: "Fluxo logístico da origem até o porto de embarque. Exemplo: Balsas para Itaqui, Santos ou Barcarena." },
  { term: "CPT", meaning: "Incoterm Carriage Paid To. O vendedor paga o transporte até o destino acordado, mas o risco transfere antes, no ponto de entrega ao transportador." },
  { term: "Câmbio", meaning: "Taxa de conversão entre moedas. No jogo, impacta diretamente preços, competitividade e resultado em reais ou dólares." },
  { term: "Custo Fixo de Originação", meaning: "Valor adicional fixo embutido no custo de compra da soja além do preço da mercadoria e do frete interno." },
  { term: "Custo Logístico", meaning: "Soma de gastos para tirar o produto da origem e levá-lo ao destino: frete interno, portuário, marítimo e outros encargos." },
  { term: "DAP", meaning: "Incoterm Delivered At Place. O vendedor entrega no local de destino acordado, sem desembaraço de importação." },
  { term: "DDP", meaning: "Incoterm Delivered Duty Paid. O vendedor assume praticamente todos os custos e riscos até o destino final, inclusive tributos de importação, quando aplicável." },
  { term: "Demanda", meaning: "Quantidade que compradores desejam adquirir em determinado nível de preço e condição de entrega." },
  { term: "Diferencial", meaning: "Diferença de preço entre duas origens, portos, janelas ou estruturas comerciais." },
  { term: "Disponível", meaning: "Mercado físico de entrega imediata ou muito curta, em contraste com negócios a termo." },
  { term: "DPU", meaning: "Incoterm Delivered at Place Unloaded. O vendedor entrega a mercadoria descarregada no local combinado." },
  { term: "Dólar", meaning: "Moeda de referência do comércio internacional de grãos. No jogo, afeta formação de preço e margem de exportação." },
  { term: "EXW", meaning: "Incoterm Ex Works. O vendedor disponibiliza a mercadoria em sua própria origem; o comprador assume retirada, transporte e demais custos posteriores." },
  { term: "Embarque", meaning: "Processo de carregar a mercadoria para envio ao destino. No jogo, o timing do embarque pode afetar execução e resultado." },
  { term: "Exportação", meaning: "Venda da commodity para outro país, normalmente com precificação baseada em bolsa, prêmio e logística." },
  { term: "FAS", meaning: "Incoterm Free Alongside Ship. O vendedor entrega a mercadoria ao lado do navio no porto de embarque." },
  { term: "FCA", meaning: "Incoterm Free Carrier. O vendedor entrega a mercadoria a um transportador nomeado pelo comprador em local acordado." },
  { term: "FOB", meaning: "Incoterm Free On Board. O vendedor entrega a mercadoria a bordo do navio no porto de embarque; a partir daí, o risco segue para o comprador." },
  { term: "Farmer Selling", meaning: "Movimento de venda do produtor rural. Quando intenso, costuma pressionar os preços no mercado físico." },
  { term: "Flat Price", meaning: "Preço cheio, final, já convertido para a unidade comercial relevante, sem separar mentalmente bolsa e prêmio." },
  { term: "Fluxo", meaning: "Caminho operacional e financeiro de uma decisão: compra, logística, embarque, venda e liquidação." },
  { term: "Frete", meaning: "Custo de transporte da mercadoria. No jogo há frete interno e frete marítimo." },
  { term: "Frete Interno", meaning: "Transporte da origem até o porto ou ponto logístico interno." },
  { term: "Frete Marítimo", meaning: "Transporte internacional do porto de origem até o destino, como a China." },
  { term: "FOSFA", meaning: "Federation of Oils, Seeds and Fats Associations. Padrão contratual amplamente usado em óleos, farelos e produtos relacionados." },
  { term: "Glossário", meaning: "Quadro de referência com termos, conceitos e siglas para apoiar a tomada de decisão no jogo." },
  { term: "Hedge", meaning: "Proteção de preço feita para reduzir risco de mercado, normalmente com contratos futuros, opções ou estruturas equivalentes." },
  { term: "Importador", meaning: "Parte compradora localizada no país de destino, como a China nas operações CFR do jogo." },
  { term: "Incoterms", meaning: "Regras internacionais que definem responsabilidades, custos e riscos entre comprador e vendedor no comércio exterior." },
  { term: "Janela de Exportação", meaning: "Período em que uma origem ou porto apresenta melhor competitividade e capacidade de embarque." },
  { term: "Liquidação", meaning: "Fechamento financeiro de uma operação, consolidando receita, custo e resultado." },
  { term: "Logística", meaning: "Conjunto de atividades para movimentar o produto da origem ao destino com eficiência operacional e econômica." },
  { term: "Lote", meaning: "Volume negociado em uma operação específica." },
  { term: "Margem", meaning: "Diferença entre receita e custo total da operação. É um dos principais indicadores de qualidade da decisão comercial." },
  { term: "Mark to Market (MTM)", meaning: "Marcação a mercado. Atualização do valor econômico de uma posição com base no preço atual de mercado." },
  { term: "Mercado Físico", meaning: "Negociação da commodity real, com entrega ou retirada física, em oposição ao mercado futuro financeiro." },
  { term: "Mercado Futuro", meaning: "Mercado de contratos padronizados negociados em bolsa, usados para precificação, hedge e especulação." },
  { term: "Modal", meaning: "Janela sobreposta à tela principal do jogo, usada para mostrar informações como MTM, parciais ou agora o glossário." },
  { term: "Origem", meaning: "Local de onde a soja está sendo comprada. No jogo, cada origem tem seu custo, logística e competitividade." },
  { term: "Originação", meaning: "Processo de comprar soja na origem, estruturando preço, logística e competitividade para posterior venda." },
  { term: "PPE", meaning: "Paridade de Exportação. Preço máximo que um comprador consegue pagar no interior mantendo viabilidade econômica de exportar." },
  { term: "Paranaguá", meaning: "Porto de exportação brasileiro. No jogo, pode ser uma das alternativas logísticas dependendo da origem e da viabilidade." },
  { term: "Parciais", meaning: "Tela de acompanhamento consolidado das posições, negociações, fretes, soja e P&L ao longo do jogo." },
  { term: "Penalty", meaning: "Penalidade aplicada quando alguma obrigação do fluxo não é cumprida conforme a regra do jogo." },
  { term: "Porto", meaning: "Ponto logístico de embarque ou descarga. A escolha do porto impacta basis, frete e competitividade." },
  { term: "Posição", meaning: "Exposição aberta do jogador após uma compra, venda ou contratação, ainda sujeita a oscilações de mercado." },
  { term: "Preço da Saca", meaning: "Valor da soja cotado por saca de 60 kg, muito usado no mercado interno brasileiro." },
  { term: "Prêmio", meaning: "Componente do preço internacional somado ou subtraído da bolsa para formar o valor negociado no mercado físico/exportação." },
  { term: "P&L", meaning: "Profit and Loss. Demonstrativo de resultado econômico acumulado, mostrando lucro ou prejuízo das decisões tomadas." },
  { term: "Rally", meaning: "Movimento forte de alta dos preços em um intervalo relativamente curto." },
  { term: "Receita", meaning: "Valor obtido com a venda da mercadoria ou com a liquidação favorável de uma operação." },
  { term: "Rio Grande", meaning: "Porto brasileiro de exportação. No jogo, pode ou não ser viável conforme a origem escolhida." },
  { term: "Rodada", meaning: "Unidade de tempo do jogo. Cada rodada traz novos parâmetros de mercado, oportunidades e decisões." },
  { term: "Rota", meaning: "Caminho logístico escolhido para levar a soja da origem ao porto ou ao destino final." },
  { term: "Saca", meaning: "Unidade muito usada no mercado brasileiro de soja. Uma saca equivale a 60 kg." },
  { term: "Santos", meaning: "Porto brasileiro de exportação. Em muitas operações, é referência importante de basis e logística." },
  { term: "Ship Count", meaning: "Configuração do jogo relacionada à quantidade de navios ou estruturas de embarque disponíveis na partida." },
  { term: "Soja Originada", meaning: "Volume de soja já comprado pelo jogador e disponível para estratégias posteriores de venda e embarque." },
  { term: "Spread", meaning: "Diferença entre dois preços, vencimentos, mercados ou estruturas comerciais." },
  { term: "Stop", meaning: "Nível de proteção ou limite de perda adotado para disciplinar decisões sob volatilidade." },
  { term: "Supply", meaning: "Oferta disponível no mercado. Em grãos, depende de safra, logística, farmer selling e competitividade global." },
  { term: "Teto de Compra", meaning: "Preço máximo economicamente aceitável para comprar a soja sem destruir a margem da operação." },
  { term: "Tempo Livre", meaning: "Modo em que a rodada acontece sem cronômetro, deixando o jogador livre para analisar e decidir sem pressão de tempo." },
  { term: "Terminal", meaning: "Estrutura portuária ou logística usada para recepção, armazenagem e embarque da mercadoria." },
  { term: "Trader", meaning: "Profissional que compra e vende commodities, buscando margem, arbitragem, proteção de risco e execução eficiente." },
  { term: "Trading House", meaning: "Empresa especializada em originação, logística, gestão de risco e comercialização internacional de commodities." },
  { term: "Valuation", meaning: "Avaliação econômica da posição ou da operação considerando os parâmetros atuais de mercado." },
  { term: "Volatilidade", meaning: "Intensidade das oscilações de preço. Quanto maior a volatilidade, maior a variação potencial de resultado." },
  { term: "Washout", meaning: "Encerramento ou rearranjo de um contrato sem execução física integral, normalmente por acordo entre as partes." }
].sort((a, b) => a.term.localeCompare(b.term, 'pt-BR'));

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderGlossaryList(query = "") {
  const listEl = document.getElementById("glossaryList");
  if (!listEl) return;
  const q = String(query || "").trim().toLowerCase();
  const filtered = !q ? GLOSSARY_TERMS : GLOSSARY_TERMS.filter(item => {
    const hay = `${item.term} ${item.meaning}`.toLowerCase();
    return hay.includes(q);
  });

  if (!filtered.length) {
    listEl.innerHTML = '<div style="padding:12px; color:#666;">Nenhum termo encontrado.</div>';
    return;
  }

  listEl.innerHTML = filtered.map(item => `
    <div style="padding:10px 0; border-bottom:1px solid #e7e7e7;">
      <div style="font-weight:700; font-size:15px; color:#1f1f1f;">${escapeHtml(item.term)}</div>
      <div style="margin-top:4px; line-height:1.42; color:#444;">${escapeHtml(item.meaning)}</div>
    </div>
  `).join("");
}

function filterGlossary() {
  const input = document.getElementById("glossarySearch");
  renderGlossaryList(input ? input.value : "");
}

function clearGlossarySearch() {
  const input = document.getElementById("glossarySearch");
  if (input) input.value = "";
  renderGlossaryList("");
}

function openGlossaryModal() {
  renderGlossaryList("");
  const input = document.getElementById("glossarySearch");
  if (input) input.value = "";
  const modal = document.getElementById("glossaryModal");
  if (!modal) return;
  modal.style.display = "block";
  requestAnimationFrame(() => {
    positionGlossaryOnCanvas();
    requestAnimationFrame(positionGlossaryOnCanvas);
    if (input) input.focus();
  });
}

function closeGlossaryModal() {
  const modal = document.getElementById("glossaryModal");
  if (modal) modal.style.display = "none";
}

function positionGlossaryOnCanvas() {
  positionCanvasModalElements('glossaryOverlay', 'glossaryBox', { maxW: 900, widthPct: 0.94, marginX: 14, marginY: 18, fitHeight: true });
}



function parseExwLabelParts(label) {
  const raw = String(label || '').trim();
  if (!raw) return { origin: 'Origem não informada', producer: 'Produtor não informado' };
  const m = raw.match(/^(.*?)\s*-\s*Produtor\s*(.*)$/i);
  if (m) {
    return {
      origin: (m[1] || '').trim() || raw,
      producer: (`Produtor ${m[2] || ''}`).trim()
    };
  }
  return { origin: raw, producer: 'Produtor não informado' };
}

function getConfirmedExwRowsForUi() {
  const obj = (state.confirmed && state.confirmed.exw && typeof state.confirmed.exw === "object") ? state.confirmed.exw : {};
  return Object.keys(obj)
    .map(k => Number(k))
    .filter(n => !Number.isNaN(n))
    .sort((a,b) => a-b)
    .map(round => {
      const exw = getConfirmedChoice(state.confirmed.exw, round);
      if (!exw) return null;
      const parts = parseExwLabelParts(exw.label || exw.name || '');
      return {
        round,
        label: exw.label || exw.name || `Operação ${round}`,
        origin: parts.origin,
        producer: parts.producer,
        volume_t: Number(exw.volume_t ?? exw.volume ?? 0) || 0,
        price_brl_saca: Number(exw.price_brl_saca ?? exw.price ?? 0) || 0,
        ref_cbot_cent_bu: exw.ref_cbot_cent_bu ?? null,
        ref_cambio: exw.ref_cambio ?? null,
        portKey: String(exw.corredor || '').trim(),
        portLabel: PORT_LABEL_SAFE(exw.corredor || '—'),
        inland_usd_t_selected: exw.inland_usd_t_selected ?? exw.freight_inland_usd_t ?? null,
      };
    })
    .filter(Boolean);
}

function buildSojaBoletaHtml(round) {
  const exw = getConfirmedChoice(state.confirmed.exw, round);
  if (!exw) {
    return '<div style="padding:8px 0; color:#666;">Operação de soja originada não encontrada.</div>';
  }
  const parts = parseExwLabelParts(exw.label || exw.name || '');
  const volume = Number(exw.volume_t ?? exw.volume ?? 0) || 0;
  const priceSaca = Number(exw.price_brl_saca ?? exw.price ?? 0) || 0;
  const cbot = exw.ref_cbot_cent_bu ?? '—';
  const cambio = exw.ref_cambio ?? '—';
  const portLabel = PORT_LABEL_SAFE(exw.corredor || '—');
  const inland = exw.inland_usd_t_selected ?? exw.freight_inland_usd_t ?? '—';
  const valorMercadoria = volume > 0 && priceSaca > 0 ? (volume / 0.06) * priceSaca : null;

  return `
    <div style="background:#fff; border:2px solid #d9dee8; border-radius:10px; overflow:hidden; box-shadow:inset 0 0 0 1px rgba(0,0,0,.02);">
      <div style="padding:12px 16px; border-bottom:1px solid #dfe5ee; display:flex; align-items:flex-start; justify-content:space-between; gap:16px;">
        <div>
          <div style="font-size:12px; letter-spacing:.12em; color:#7d8896; font-weight:700; text-transform:uppercase;">Trade Confirmation</div>
          <div style="margin-top:6px; font-size:22px; font-weight:800; color:#1b2430;">Boleta de Originação de Soja</div>
        </div>
        <div style="text-align:right; font-size:12px; color:#5b6470; min-width:160px;">
          <div><b>Status:</b> Confirmado</div>
          <div style="margin-top:4px;"><b>Rodada:</b> ${round}</div>
        </div>
      </div>

      <div style="padding:16px; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px;">
        <div style="border:1px solid #e6e9ef; border-radius:10px; padding:12px 14px; background:#fcfdff;">
          <div style="font-size:11px; letter-spacing:.08em; color:#7d8896; font-weight:700; text-transform:uppercase;">Identificação da Operação</div>
          <div style="margin-top:10px; line-height:1.55; color:#222;">
            <div><b>Origem:</b> ${escapeHtml(parts.origin)}</div>
            <div><b>Produtor:</b> ${escapeHtml(parts.producer)}</div>
            <div><b>Descrição:</b> ${escapeHtml(exw.label || exw.name || `Operação ${round}`)}</div>
          </div>
        </div>

        <div style="border:1px solid #e6e9ef; border-radius:10px; padding:12px 14px; background:#fcfdff;">
          <div style="font-size:11px; letter-spacing:.08em; color:#7d8896; font-weight:700; text-transform:uppercase;">Volume e Logística</div>
          <div style="margin-top:10px; line-height:1.55; color:#222;">
            <div><b>Volume:</b> ${FMT_TON_SAFE(volume)} t</div>
            <div><b>Porto / Corredor:</b> ${escapeHtml(portLabel)}</div>
            <div><b>Inland:</b> US$ ${escapeHtml(String(inland))}/t</div>
          </div>
        </div>

        <div style="border:1px solid #e6e9ef; border-radius:10px; padding:12px 14px; background:#fcfdff;">
          <div style="font-size:11px; letter-spacing:.08em; color:#7d8896; font-weight:700; text-transform:uppercase;">Preço e Mercado</div>
          <div style="margin-top:10px; line-height:1.55; color:#222;">
            <div><b>Preço da Soja:</b> R$ ${priceSaca.toFixed(1)}/saca</div>
            <div><b>CBOT de Referência:</b> ${escapeHtml(String(cbot))} ¢/bu</div>
            <div><b>Câmbio de Referência:</b> ${escapeHtml(String(cambio))}</div>
          </div>
        </div>

        <div style="border:1px solid #e6e9ef; border-radius:10px; padding:12px 14px; background:#fcfdff;">
          <div style="font-size:11px; letter-spacing:.08em; color:#7d8896; font-weight:700; text-transform:uppercase;">Resumo Financeiro</div>
          <div style="margin-top:10px; line-height:1.55; color:#222;">
            <div><b>Valor estimado da mercadoria:</b> ${valorMercadoria !== null ? 'R$ ' + valorMercadoria.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2}) : '—'}</div>
            <div><b>Unidade comercial:</b> Saca de 60 kg</div>
            <div><b>Observação:</b> Operação confirmada para acompanhamento nas parciais.</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function openSojaDetailModal(round) {
  const content = document.getElementById('sojaDetailContent');
  const sub = document.getElementById('sojaDetailSub');
  if (content) content.innerHTML = buildSojaBoletaHtml(round);
  if (sub) sub.textContent = `Detalhes estruturados da soja originada confirmada da rodada ${round}.`;
  const modal = document.getElementById('sojaDetailModal');
  if (!modal) return;
  modal.style.display = 'block';
  requestAnimationFrame(() => {
    positionSojaDetailOnCanvas();
    requestAnimationFrame(positionSojaDetailOnCanvas);
  });
}

function closeSojaDetailModal() {
  const modal = document.getElementById('sojaDetailModal');
  if (modal) modal.style.display = 'none';
}

function positionSojaDetailOnCanvas() {
  positionCanvasModalElements('sojaDetailOverlay', 'sojaDetailBox', { maxW: 960, widthPct: 0.94, marginX: 14, marginY: 18, fitHeight: true });
}


function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fmtLsNum(v, decimals = 0) {
  return safeNum(v).toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtLsUsd(v, decimals = 2) {
  return `US$ ${safeNum(v).toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

function fmtLsBrl(v, decimals = 2) {
  return `R$ ${safeNum(v).toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

function formatTon(v, decimals = 0) {
  return safeNum(v).toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function buildLongShortSnapshot() {
  const confirmed = state.confirmed || {};
  const exwMap = confirmed.exw || {};
  const chinaMap = confirmed.china || confirmed.cfr || {};
  const plans = (state.freightPlansByPort && typeof state.freightPlansByPort === 'object') ? state.freightPlansByPort : {};
  const shipSize = Number(getActiveRules()?.ship_sizes_t?.[0] || 60000) || 60000;

  const exws = Object.entries(exwMap)
    .map(([round, exw]) => exw ? { ...exw, __round: Number(round) } : null)
    .filter(Boolean);
  const bids = Object.entries(chinaMap)
    .map(([round, bid]) => bid ? { ...bid, __round: Number(round) } : null)
    .filter(Boolean);
  const planEntries = Object.entries(plans)
    .map(([port, plan]) => plan ? { port, ...plan } : null)
    .filter(Boolean);

  const originVol = exws.reduce((s, exw) => s + safeNum(exw.volume_t ?? exw.volume), 0);
  const soldVol = bids.reduce((s, bid) => s + safeNum(bid.volume_t ?? bid.volume ?? shipSize), 0);
  const netVol = originVol - soldVol;
  const positionLabel = netVol > 0 ? `LONG ${fmtLsNum(netVol)} t` : (netVol < 0 ? `SHORT ${fmtLsNum(Math.abs(netVol))} t` : 'FLAT');

  const freightTotalVol = planEntries.length * shipSize;
  const freightLinked = planEntries.filter(pl => pl.linkedBidRound != null);
  const freightOpen = planEntries.filter(pl => pl.linkedBidRound == null);

  const bidsWithFreight = bids.filter(b => !!b.linkedFreightPort);
  const bidsWithoutFreight = bids.filter(b => !b.linkedFreightPort);

  const portOrder = ['santos', 'paranagua', 'riogrande', 'barcarena', 'itaqui'];
  const portVolumes = Object.fromEntries(portOrder.map(p => [p, 0]));
  exws.forEach(exw => {
    const port = String(exw.corredor || '').trim();
    if (port && portVolumes[port] != null) portVolumes[port] += safeNum(exw.volume_t ?? exw.volume);
  });

  const flowEntries = planEntries.filter(pl => {
    const bidRound = Number(pl.linkedBidRound);
    if (!bidRound) return false;
    const bid = bids.find(b => Number(b.__round) === bidRound);
    return !!bid;
  });
  const completeFlowCount = flowEntries.length;
  const completeFlowVol = flowEntries.reduce((s, pl) => {
    const bid = bids.find(b => Number(b.__round) === Number(pl.linkedBidRound));
    return s + Math.min(shipSize, safeNum(bid?.volume_t ?? bid?.volume ?? shipSize));
  }, 0);

  const boughtWithoutSaleVol = Math.max(0, originVol - soldVol);
  const saleWithoutFreightVol = bidsWithoutFreight.reduce((s, bid) => s + safeNum(bid.volume_t ?? bid.volume ?? shipSize), 0);
  const freightWithoutBuyerVol = freightOpen.length * shipSize;

  let weightedOriginRsSaca = 0, weightedOriginUsdT = 0, weightedFreightUsdT = 0, weightedSaleUsdT = 0, weightedVol = 0;
  flowEntries.forEach(pl => {
    const bid = bids.find(b => Number(b.__round) === Number(pl.linkedBidRound));
    if (!bid) return;
    const flowVol = Math.min(shipSize, safeNum(bid.volume_t ?? bid.volume ?? shipSize));
    if (flowVol <= 0) return;
    const portExws = exws.filter(exw => String(exw.corredor || '').trim() === String(pl.port || '').trim());
    const portVol = portExws.reduce((s, exw) => s + safeNum(exw.volume_t ?? exw.volume), 0);
    let avgRsSaca = 0;
    let avgUsdT = 0;
    if (portVol > 0) {
      avgRsSaca = portExws.reduce((s, exw) => s + safeNum(exw.price_brl_saca ?? exw.price) * safeNum(exw.volume_t ?? exw.volume), 0) / portVol;
      avgUsdT = portExws.reduce((s, exw) => {
        const rd = getRoundData(Number(exw.__round) || 1) || getRoundData(state.round) || {};
        return s + exwCostUsdPerT(rd, exw) * safeNum(exw.volume_t ?? exw.volume);
      }, 0) / portVol;
    }
    const rdBid = getRoundData(Number(bid.__round) || 1) || getRoundData(state.round) || {};
    const saleUsdT = chinaPriceUsdPerT(rdBid, bid);
    weightedOriginRsSaca += avgRsSaca * flowVol;
    weightedOriginUsdT += avgUsdT * flowVol;
    weightedFreightUsdT += safeNum(pl.usd_t) * flowVol;
    weightedSaleUsdT += saleUsdT * flowVol;
    weightedVol += flowVol;
  });

  const avgOriginRsSaca = weightedVol > 0 ? weightedOriginRsSaca / weightedVol : 0;
  const avgOriginUsdT = weightedVol > 0 ? weightedOriginUsdT / weightedVol : 0;
  const avgFreightUsdT = weightedVol > 0 ? weightedFreightUsdT / weightedVol : 0;
  const avgSaleUsdT = weightedVol > 0 ? weightedSaleUsdT / weightedVol : 0;
  const avgFobUsdT = avgOriginUsdT;
  const avgCfrCostUsdT = avgOriginUsdT + avgFreightUsdT;
  const conv = Number(getRoundData(state.round)?.conv_centbu_to_usd_t || getActiveRules()?.conversion?.centbu_to_usd_t_default || 0.367454) || 0.367454;
  const costCbu = conv > 0 ? (avgCfrCostUsdT / conv) : 0;
  const saleCbu = conv > 0 ? (avgSaleUsdT / conv) : 0;
  const marginCbu = saleCbu - costCbu;

  return {
    shipSize,
    positionLabel,
    originVol,
    soldVol,
    netVol,
    freightCount: planEntries.length,
    freightTotalVol,
    freightLinkedCount: freightLinked.length,
    freightLinkedVol: freightLinked.length * shipSize,
    freightOpenCount: freightOpen.length,
    freightOpenVol: freightOpen.length * shipSize,
    bidsCount: bids.length,
    bidsVol: soldVol,
    bidsWithFreightCount: bidsWithFreight.length,
    bidsWithFreightVol: bidsWithFreight.reduce((s, bid) => s + safeNum(bid.volume_t ?? bid.volume ?? shipSize), 0),
    bidsWithoutFreightCount: bidsWithoutFreight.length,
    bidsWithoutFreightVol: saleWithoutFreightVol,
    portVolumes,
    ships: planEntries.map((pl, idx) => ({
      label: pl.label || `Frete ${idx + 1}`,
      portLabel: PORT_LABEL_SAFE(pl.port || '—'),
      status: pl.linkedBidRound != null ? 'Vinculado' : 'Aberto',
      targetRound: pl.targetRound || null,
      linkedBidRound: pl.linkedBidRound || null,
    })),
    completeFlowCount,
    completeFlowVol,
    boughtWithoutSaleVol,
    saleWithoutFreightVol,
    freightWithoutBuyerVol,
    avgOriginRsSaca,
    avgOriginUsdT,
    avgFobUsdT,
    avgFreightUsdT,
    avgCfrCostUsdT,
    avgSaleUsdT,
    costCbu,
    saleCbu,
    marginCbu,
  };
}

function renderLongShortDashboard() {
  const wrap = document.getElementById('longShortContent');
  if (!wrap) return;
  const snap = buildLongShortSnapshot();
  const row = (a,b,c='') => `<tr><td style="padding:8px 10px; border-bottom:1px solid #ececec;">${a}</td><td style="padding:8px 10px; border-bottom:1px solid #ececec; text-align:right; font-weight:700;">${b}</td>${c!==''?`<td style="padding:8px 10px; border-bottom:1px solid #ececec; text-align:right; font-weight:700;">${c}</td>`:''}</tr>`;
  const shipRows = snap.ships.length ? snap.ships.map(s => `<tr><td style="padding:8px 10px; border-bottom:1px solid #ececec;">${escapeHtml(s.label)}</td><td style="padding:8px 10px; border-bottom:1px solid #ececec;">${escapeHtml(s.portLabel)}</td><td style="padding:8px 10px; border-bottom:1px solid #ececec;">${escapeHtml(s.status)}${s.linkedBidRound ? ` • BID R${s.linkedBidRound}` : ''}${s.targetRound ? ` • Emb. R${s.targetRound}` : ''}</td></tr>`).join('') : '<tr><td colspan="3" style="padding:10px; color:#666;">Nenhum frete contratado até o momento.</td></tr>';
  const portRows = ['santos','paranagua','riogrande','barcarena','itaqui'].map(p => row(PORT_LABEL_SAFE(p), `${fmtLsNum(snap.portVolumes[p])} t`)).join('');
  wrap.innerHTML = `
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px; align-items:start;">
      <div style="grid-column:1 / -1; background:#fff7eb; border:1px solid #f5d29f; border-radius:12px; padding:12px 14px; display:flex; align-items:center; justify-content:space-between; gap:12px;">
        <div>
          <div style="font-size:12px; letter-spacing:.08em; text-transform:uppercase; color:#8a5a10; font-weight:800;">Posição do trader</div>
          <div style="font-size:24px; font-weight:900; color:#1d1d1d; margin-top:4px;">POSIÇÃO ATUAL: ${snap.positionLabel}</div>
        </div>
        <div style="font-size:12px; color:#7a7a7a; text-align:right;">Baseado em soja originada x soja vendida<br>até a rodada atual.</div>
      </div>

      <div style="border:1px solid #ececec; border-radius:12px; overflow:hidden; background:#fff;">
        <div style="padding:10px 12px; font-weight:800; background:#fafafa;">Posição Física</div>
        <table style="width:100%; border-collapse:collapse; font-size:14px;">${row('Soja originada', `${fmtLsNum(snap.originVol)} t`)}${row('Soja vendida (CFR China)', `${fmtLsNum(snap.soldVol)} t`)}${row('Posição líquida', snap.positionLabel)}</table>
      </div>

      <div style="border:1px solid #ececec; border-radius:12px; overflow:hidden; background:#fff;">
        <div style="padding:10px 12px; font-weight:800; background:#fafafa;">Logística Marítima</div>
        <table style="width:100%; border-collapse:collapse; font-size:14px;">${row('Navios contratados', fmtLsNum(snap.freightCount), `${fmtLsNum(snap.freightTotalVol)} t`)}${row('Navios vinculados à venda', fmtLsNum(snap.freightLinkedCount), `${fmtLsNum(snap.freightLinkedVol)} t`)}${row('Navios sem comprador', fmtLsNum(snap.freightOpenCount), `${fmtLsNum(snap.freightOpenVol)} t`)}</table>
      </div>

      <div style="border:1px solid #ececec; border-radius:12px; overflow:hidden; background:#fff;">
        <div style="padding:10px 12px; font-weight:800; background:#fafafa;">Vendas CFR China</div>
        <table style="width:100%; border-collapse:collapse; font-size:14px;">${row('Bids fechados', fmtLsNum(snap.bidsCount), `${fmtLsNum(snap.bidsVol)} t`)}${row('Vendas com frete', fmtLsNum(snap.bidsWithFreightCount), `${fmtLsNum(snap.bidsWithFreightVol)} t`)}${row('Vendas sem frete', fmtLsNum(snap.bidsWithoutFreightCount), `${fmtLsNum(snap.bidsWithoutFreightVol)} t`)}</table>
      </div>

      <div style="border:1px solid #ececec; border-radius:12px; overflow:hidden; background:#fff;">
        <div style="padding:10px 12px; font-weight:800; background:#fafafa;">Posição por Porto</div>
        <table style="width:100%; border-collapse:collapse; font-size:14px;">${portRows}</table>
      </div>

      <div style="grid-column:1 / -1; border:1px solid #ececec; border-radius:12px; overflow:hidden; background:#fff;">
        <div style="padding:10px 12px; font-weight:800; background:#fafafa;">Posição por Navio</div>
        <table style="width:100%; border-collapse:collapse; font-size:14px;"><thead><tr><th style="padding:8px 10px; text-align:left; border-bottom:1px solid #ececec;">NAVIO/FRETE</th><th style="padding:8px 10px; text-align:left; border-bottom:1px solid #ececec;">PORTO</th><th style="padding:8px 10px; text-align:left; border-bottom:1px solid #ececec;">STATUS</th></tr></thead><tbody>${shipRows}</tbody></table>
      </div>

      <div style="border:1px solid #ececec; border-radius:12px; overflow:hidden; background:#fff;">
        <div style="padding:10px 12px; font-weight:800; background:#fafafa;">Fluxos Completos</div>
        <table style="width:100%; border-collapse:collapse; font-size:14px;">${row('Negócios totalmente fechados', fmtLsNum(snap.completeFlowCount), `${fmtLsNum(snap.completeFlowVol)} t`)}</table>
      </div>

      <div style="border:1px solid #ececec; border-radius:12px; overflow:hidden; background:#fff;">
        <div style="padding:10px 12px; font-weight:800; background:#fafafa;">Exposição Operacional</div>
        <table style="width:100%; border-collapse:collapse; font-size:14px;">${row('Soja comprada sem venda', `${fmtLsNum(snap.boughtWithoutSaleVol)} t`)}${row('Venda sem frete', `${fmtLsNum(snap.saleWithoutFreightVol)} t`)}${row('Frete sem comprador', `${fmtLsNum(snap.freightWithoutBuyerVol)} t`)}</table>
      </div>

      <div style="grid-column:1 / -1; border:1px solid #ececec; border-radius:12px; overflow:hidden; background:#fff;">
        <div style="padding:10px 12px; font-weight:800; background:#fafafa;">Profit Ladder / Escada de Margem</div>
        <table style="width:100%; border-collapse:collapse; font-size:14px;">${row('Compra média interior', fmtLsBrl(snap.avgOriginRsSaca) + '/saca')}${row('Compra média em US$/t', fmtLsUsd(snap.avgOriginUsdT) + '/t')}${row('Equivalente FOB / porto', fmtLsUsd(snap.avgFobUsdT) + '/t')}${row('Frete marítimo', fmtLsUsd(snap.avgFreightUsdT) + '/t')}${row('Custo CFR', `${fmtLsNum(snap.costCbu,1)} c/bu`)}${row('Venda CFR China', `${fmtLsNum(snap.saleCbu,1)} c/bu`)}${row('Margem final', `${fmtLsNum(snap.marginCbu,1)} c/bu`)}</table>
      </div>
    </div>
  `;
}

function openLongShortModal() {
  renderLongShortDashboard();
  const modal = document.getElementById('longShortModal');
  if (!modal) return;
  modal.style.display = 'block';
  requestAnimationFrame(() => {
    positionLongShortOnCanvas();
    requestAnimationFrame(positionLongShortOnCanvas);
  });
}

function closeLongShortModal() {
  const modal = document.getElementById('longShortModal');
  if (modal) modal.style.display = 'none';
}

function positionLongShortOnCanvas() {
  positionCanvasModalElements('longShortOverlay', 'longShortBox', {
    maxW: 980,
    widthPct: 0.94,
    marginX: 14,
    marginY: 18,
    fixedHeight: Math.max(260, (getGameCanvasRect()?.height || 260) - 36),
    afterPosition: ({ availableH, box }) => {
      box.style.height = availableH + 'px';
      box.style.maxHeight = availableH + 'px';
      const scroll = document.getElementById('longShortScroll');
      if (scroll) {
        const reserved = 140;
        scroll.style.maxHeight = Math.max(120, availableH - reserved) + 'px';
      }
    }
  });
}

function computePortStockSeries() {
  const totals = {};
  const maxRound = Number(state.round || 1);
  for (let r = 1; r <= maxRound; r++) {
    const exw = getConfirmedChoice(state.confirmed.exw, r);
    if (!exw) continue;
    const portKey = String(exw.corredor || "").trim();
    if (!portKey) continue;
    const vol = Number(exw.volume_t ?? exw.volume ?? 0) || 0;
    totals[portKey] = (totals[portKey] || 0) + vol;
  }
  return Object.keys(totals)
    .sort((a,b) => PORT_LABEL_SAFE(a).localeCompare(PORT_LABEL_SAFE(b), 'pt-BR'))
    .map(port => ({ port, label: PORT_LABEL_SAFE(port), volume_t: totals[port] || 0 }));
}

function renderPortsChart() {
  const chartEl = document.getElementById("portsChart");
  if (!chartEl) return;
  const fmtVol = (v) => {
    const n = Number(v || 0);
    return n.toLocaleString("pt-BR");
  };
  const data = computePortStockSeries();
  if (!data.length) {
    chartEl.innerHTML = '<div style="padding:18px; color:#666;">Nenhum volume EXW confirmado por porto ainda.</div>';
    return;
  }

  const maxVal = Math.max(...data.map(d => d.volume_t), 1);
  const yTicks = 4;
  const tickHtml = Array.from({ length: yTicks + 1 }, (_, i) => {
    const frac = 1 - (i / yTicks);
    const val = Math.round(maxVal * frac);
    return `<div style="height:${320 / yTicks}px; display:flex; align-items:flex-start; justify-content:flex-end; padding-right:8px; box-sizing:border-box; font-size:12px; color:#666;">${fmtVol(val)} t</div>`;
  }).join('');

  const barsHtml = data.map(d => {
    const h = Math.max(8, Math.round((d.volume_t / maxVal) * 320));
    return `
      <div style="flex:1; min-width:88px; display:flex; flex-direction:column; align-items:center; justify-content:flex-end; gap:8px;">
        <div style="font-size:12px; font-weight:700; color:#2d2d2d;">${fmtVol(d.volume_t)} t</div>
        <div style="width:72px; height:${h}px; border-radius:10px 10px 0 0; background:linear-gradient(180deg,#ff8a21 0%, #e96500 100%); box-shadow:0 4px 10px rgba(233,101,0,.25);"></div>
        <div style="font-size:12px; font-weight:700; color:#333; text-align:center; line-height:1.2; min-height:32px;">${escapeHtml(d.label)}</div>
      </div>`;
  }).join('');

  chartEl.innerHTML = `
    <div style="display:flex; gap:12px; align-items:stretch;">
      <div style="width:92px; flex:0 0 92px; height:320px; display:flex; flex-direction:column; justify-content:space-between; border-right:1px solid #ddd;">${yTicks>=0 ? tickHtml : ''}</div>
      <div style="flex:1; min-width:0;">
        <div style="height:320px; display:flex; align-items:flex-end; gap:14px; padding:0 6px; border-left:1px solid transparent; background:repeating-linear-gradient(to top, transparent 0, transparent 63px, rgba(0,0,0,.05) 64px);">
          ${barsHtml}
        </div>
        <div style="margin-top:8px; font-size:12px; color:#666;">Eixo X: portos • Eixo Y: volume acumulado comprado no EXW (t).</div>
      </div>
    </div>
  `;
}

function openPortsModal() {
  renderPortsChart();
  const modal = document.getElementById("portsModal");
  if (!modal) return;
  modal.style.display = "block";
  requestAnimationFrame(() => {
    positionPortsOnCanvas();
    requestAnimationFrame(positionPortsOnCanvas);
  });
}

function closePortsModal() {
  const modal = document.getElementById("portsModal");
  if (modal) modal.style.display = "none";
}

function positionPortsOnCanvas() {
  positionCanvasModalElements('portsOverlay', 'portsBox', { maxW: 940, widthPct: 0.94, marginX: 14, marginY: 18, fitHeight: true });
}


document.addEventListener("DOMContentLoaded", () => {
  const btnAdmin = document.getElementById("btnAdmin");
  if (btnAdmin) {
    btnAdmin.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const href = btnAdmin.getAttribute("href") || "./admin.html";
      const target = btnAdmin.getAttribute("target") || "_blank";
      openAccessModal("admin", () => {
        window.open(href, target, "noopener");
      });
    });
  }

  const accessInput = document.getElementById("accessPassword");
  if (accessInput) {
    accessInput.addEventListener("input", () => {
      accessInput.value = String(accessInput.value || "").replace(/\D+/g, "").slice(0, 4);
      const error = document.getElementById("accessError");
      if (error) error.style.display = "none";
    });
    accessInput.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        submitAccessModal();
      }
      if (ev.key === "Escape") {
        ev.preventDefault();
        closeAccessModal();
      }
    });
  }
});

// Modo Campanha L2/L3: implementações originais preservadas sem mudanças de tela/cálculo.
function buildCampaignStatusHtmlLegacy() {
  const level = getCampaignLevel(state.campaign?.levelId || 1);
  return `
    <div class="campaign-canvas-card campaign-status-card">
      <div class="campaign-canvas-title">STATUS DO LEVEL</div>
      <div class="campaign-status-block"><span>Contexto geral:</span> book vendido CFR China para ${level.shipmentMonth || 'março'}, com frete marítimo fixado em US$ ${Number(level.fixedFreightUsdT || 0).toFixed(0)}/t na rota ${level.fixedPortLabel || 'Santos'} → ${level.fixedDestination || 'N. China'}.</div>
      <div class="campaign-status-block"><span>Missão:</span> originar soja no interior, travar lotes competitivos e controlar o custo CFR equivalente do navio.</div>
      <div class="campaign-status-block"><span>Meta:</span> completar ${formatTon(level.targetVolumeT || 60000)} t em ${level.rounds || 5} rodadas com basis médio final ≤ +${Number(level.targetBasisCentBu || 0).toFixed(0)} c/bu.</div>
    </div>`;
}

function buildCampaignBookPanelHtmlLegacy() {
  const snap = calculateCampaignBookSnapshot();
  const progress = snap.level.targetVolumeT > 0 ? Math.min(100, (snap.totalUsedT / snap.level.targetVolumeT) * 100) : 0;
  return `
    <div class="campaign-canvas-card campaign-book-card">
      <div class="campaign-canvas-title">BOOK DO LEVEL / MTM</div>
      <div class="campaign-book-grid">
        <div><span>Venda CFR</span><strong>${formatCampaignSigned(snap.saleBasisCentBu, 0, ' c/bu')}</strong></div>
        <div><span>Volume</span><strong>${formatTon(snap.totalUsedT)} / ${formatTon(snap.level.targetVolumeT || 0)} t</strong></div>
        <div><span>Faltante</span><strong>${formatTon(snap.missingT)} t</strong></div>
        <div><span>Basis médio</span><strong>${snap.totalUsedT > 0 ? formatCampaignSigned(snap.basisAvg, 1, ' c/bu') : '—'}</strong></div>
        <div><span>MTM basis</span><strong>${snap.totalUsedT > 0 ? formatCampaignSigned(snap.mtmCentBu, 1, ' c/bu') : '—'}</strong></div>
        <div><span>PnL acum.</span><strong>${snap.totalUsedT > 0 ? formatCampaignUsd(snap.pnlUsd, 0) : '—'}</strong></div>
      </div>
      <div class="campaign-progress"><i style="width:${progress.toFixed(1)}%"></i></div>
      <div class="campaign-book-note">Leitura: venda CFR - basis comprado = margem de basis marcada a mercado.</div>
    </div>`;
}

function buildCampaignNewsPanelHtmlLegacy(roundNum = state.round) {
  const rd = getRoundData(roundNum) || {};
  const level = getCampaignLevel(state.campaign?.levelId || 1);
  const totalRounds = Number(level.rounds || 5);
  const rawHeadline = String(rd.market_headline || rd.news || '').trim();
  const headline = rawHeadline || 'Mercado sem manchete relevante nesta rodada.';
  const roundLabel = Number(roundNum || 1) >= totalRounds
    ? 'Leitura de fechamento'
    : `Impacta a rodada ${Number(roundNum || 1) + 1}`;
  return `
    <div class="campaign-canvas-card campaign-news-card">
      <div class="campaign-news-kicker">${escapeHtml(roundLabel)}</div>
      <div class="campaign-canvas-title">RADAR DA PRÓXIMA RODADA</div>
      <div class="campaign-news-headline">${escapeHtml(headline)}</div>
    </div>`;
}

function buildCampaignRoundSummaryHtmlLegacy(roundNum = state.round) {
  const exw = state.confirmed?.exw?.[roundNum];
  if (!exw) {
    return `<div class="campaign-round-summary"><p>Nenhuma compra foi confirmada nesta rodada. O book segue sem alteração operacional.</p></div>`;
  }
  const lot = calculateCampaignOfferBasisSnapshot(exw, roundNum);
  const book = calculateCampaignBookSnapshot();
  const isFirstRound = Number(roundNum || 1) === 1;
  const introHtml = isFirstRound
    ? `A origem entrou no book com basis de <strong>${formatCampaignSigned(lot.basisCentBu, 1, ' c/bu')}</strong>. Abaixo está a formação do custo CFR equivalente até o destino.`
    : `A origem entrou no book. Use os componentes abaixo para calcular o custo CFR equivalente e o basis no destino.`;
  const cfrValueHtml = isFirstRound
    ? `${lot.cfrCostCentBu.toFixed(1)} c/bu`
    : `???`;
  const basisLineHtml = isFirstRound
    ? `Basis no destino: <strong>${lot.cfrCostCentBu.toFixed(1)} - ${lot.cbotCentBu.toFixed(1)} = ${formatCampaignSigned(lot.basisCentBu, 1, ' c/bu')}</strong>`
    : `Basis no destino: <strong>Calcular o basis</strong>`;
  const mtmLineHtml = isFirstRound
    ? `Contra a venda CFR a <strong>${formatCampaignSigned(lot.saleBasisCentBu, 0, ' c/bu')}</strong>, a rodada marca <strong>${formatCampaignSigned(lot.marginCentBu, 1, ' c/bu')}</strong>, equivalente a <strong>${formatCampaignUsd(lot.pnlUsdT, 2)}/t</strong>.`
    : `Venda CFR referência: <strong>${formatCampaignSigned(lot.saleBasisCentBu, 0, ' c/bu')}</strong>`;
  return `
    <div class="campaign-round-summary">
      <div class="campaign-round-kicker">Resumo da rodada ${Number(roundNum || 1)}</div>
      <h3>${escapeHtml(lot.origin)}</h3>
      <p>${introHtml}</p>
      <div class="campaign-formula-box">
        <div><span>Soja interior</span><strong>${lot.interiorCentBu.toFixed(1)} c/bu</strong></div>
        <div><span>Logística interna</span><strong>${lot.inlandCentBu.toFixed(1)} c/bu</strong></div>
        <div><span>Frete marítimo</span><strong>${lot.maritimeCentBu.toFixed(1)} c/bu</strong></div>
        <div class="total"><span>Custo CFR equivalente</span><strong>${cfrValueHtml}</strong></div>
      </div>
      <div class="campaign-basis-line">${basisLineHtml}</div>
      <div class="campaign-mtm-line">${mtmLineHtml}</div>
      <div class="campaign-summary-grid">
        <div><span>Volume acumulado</span><strong>${formatTon(book.totalUsedT)} / ${formatTon(book.level.targetVolumeT || 0)} t</strong></div>
        <div><span>Basis médio</span><strong>${formatCampaignSigned(book.basisAvg, 1, ' c/bu')}</strong></div>
        <div><span>PnL acumulado</span><strong>${formatCampaignUsd(book.pnlUsd, 0)}</strong></div>
      </div>
    </div>`;
}

function renderCampaignResultScreenLegacy() {
  const result = buildCampaignLevel1Result();
  const rows = result.usedLots.length ? result.usedLots.map(lot => `
      <tr>
        <td>R${lot.round}</td>
        <td>${lot.origin}</td>
        <td>${formatTon(lot.usedVolumeT)} t</td>
        <td>${lot.interiorCentBu.toFixed(1)}</td>
        <td>${lot.inlandCentBu.toFixed(1)}</td>
        <td>${lot.maritimeCentBu.toFixed(1)}</td>
        <td>${lot.cfrCostCentBu.toFixed(1)}</td>
        <td>${lot.basisCentBu.toFixed(1)}</td>
      </tr>
    `).join('') : `<tr><td colspan="8">Nenhuma compra confirmada no level.</td></tr>`;

  const verdict = result.approved ? 'RESULTADO SATISFATÓRIO' : 'RESULTADO NÃO SATISFATÓRIO';
  const diagnosis = !result.totalUsedT
    ? 'Você não confirmou compras suficientes para formar a carga.'
    : result.totalUsedT < result.level.targetVolumeT
      ? `Você não completou o volume-alvo de ${formatTon(result.level.targetVolumeT)} t dentro das 5 rodadas.`
      : result.basisAvg > result.level.targetBasisCentBu
        ? `Você completou o navio, mas o basis médio final ficou acima da meta de ${result.level.targetBasisCentBu.toFixed(1)} ¢/bu.`
        : `Você completou o navio e manteve o basis médio final dentro da meta máxima de ${result.level.targetBasisCentBu.toFixed(1)} ¢/bu.`;

  screen.innerHTML = `
    <section class="campaign-shell">
      <div class="campaign-card campaign-card-xl">
        <div class="campaign-kicker">LEVEL 1 — RESULTADO FINAL</div>
        <h1>${verdict}</h1>
        <p class="campaign-lead">Venda referência: 110 ¢/bu CFR China • Frete marítimo fixo: US$ 37/t Santos → N. China</p>

        <div class="campaign-metrics">
          <div class="metric-box"><span>Volume-alvo</span><strong>${formatTon(result.level.targetVolumeT)} t</strong></div>
          <div class="metric-box"><span>Volume usado no navio</span><strong>${formatTon(result.totalUsedT)} t</strong></div>
          <div class="metric-box"><span>Basis médio final</span><strong>${result.basisAvg.toFixed(1)} ¢/bu</strong></div>
          <div class="metric-box"><span>Meta do level</span><strong>≤ ${result.level.targetBasisCentBu.toFixed(1)} ¢/bu</strong></div>
        </div>

        <div class="campaign-diagnosis">${diagnosis}</div>

        <div class="campaign-table-wrap">
          <table class="campaign-table">
            <thead>
              <tr>
                <th>Rodada</th><th>Origem</th><th>Volume usado</th><th>Soja interior</th><th>Logística interna</th><th>Frete marítimo</th><th>Custo CFR eq.</th><th>Basis</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>

        <div class="campaign-actions">
          <button class="campaign-btn campaign-btn-light" onclick="window.restartCampaignLevel()">Repetir level</button>
          <button class="campaign-btn campaign-btn-light" onclick="window.backToCampaignMenu()">Voltar ao menu campanha</button>
          ${result.approved ? '<button class="campaign-btn campaign-btn-dark" onclick="window.backToCampaignMenu()">Próximo level</button>' : ''}
        </div>
      </div>
    </section>
  `;
}
