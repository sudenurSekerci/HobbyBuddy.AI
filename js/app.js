import {
  buildCompletionInsightCopy,
  buildInsightCopy,
  buildJourneyContinuationFeedback,
  buildProgramFeedbackForApi,
  clearProgress,
  computeInsight,
  computeXpAndStreak,
  dismissWeeklyPulse,
  getCompletionPrimaryAction,
  getFocusWeekNumber,
  getJourneyAutoStage,
  getTaskCounts,
  initProgressForHobby,
  isPathComplete,
  isWeekUnlocked,
  listBadgeStates,
  loadLastPlan,
  loadProfileSnapshot,
  loadProgress,
  persistLastPlan,
  resolveWeekNumber,
  saveWeeklyPulse,
  setTaskDone,
  xpTierLabelTr,
} from "./program-tracking.js";

const MIN_INTEREST_LENGTH = 8;
const WEEKLY_HOURS_MIN = 0.5;
const WEEKLY_HOURS_MAX = 80;
const BUDGET_MIN = 0;
const BUDGET_MAX = 500_000;

const PROGRAM_KEY = "hobbybuddy-active-program";
const ANALYZE_URL = "/api/analyze";
const VERIFY_URLS_URL = "/api/verify-urls";
/** Zengin JSON planları için ~55 sn; ağ yavaşsa nadiren yine dolabilir. */
const REQUEST_TIMEOUT_MS = 55_000;

/** Geçmiş haftaya göz at (null = canlı akış) */
let journeyBrowseWeek = null;
/** Rozet kazanma bildirimi için önceki kazanılmış id'ler */
let prevEarnedBadgeIds = new Set();

const form = document.getElementById("profile-form");
const interestsEl = document.getElementById("interests");
const weeklyHoursEl = document.getElementById("weekly-hours");
const monthlyBudgetEl = document.getElementById("monthly-budget");
const successEl = document.getElementById("form-success");
const successMsgEl = document.getElementById("form-success-msg");
const submitBtn = document.getElementById("submit-btn");
const loadingOverlay = document.getElementById("loading-overlay");
const lottiePlayer = document.getElementById("loading-lottie");
const apiErrorEl = document.getElementById("api-error");
const resultsSection = document.getElementById("results-section");
const onboardingSection = document.getElementById("onboarding-section");
const editProfileBtn = document.getElementById("edit-profile-btn");
const resultHobbyEl = document.getElementById("result-hobby");
const resultWeeksEl = document.getElementById("result-weeks");
const resultMaterialsEl = document.getElementById("result-materials");
const resultMaterialsTotalEl = document.getElementById("result-materials-total");
const resultBudgetNoteEl = document.getElementById("result-budget-note");
const resultAnalysisEl = document.getElementById("result-analysis");
const resultProgramCta = document.getElementById("result-program-cta");
const resultJourneyWrap = document.getElementById("result-journey-wrap");
const startProgramBtn = document.getElementById("start-program-btn");
const resultLearningSection = document.getElementById("result-learning-section");
const resultLearningEl = document.getElementById("result-learning");
const resultHobbyOptionsEl = document.getElementById("result-hobby-options");
const resultPlanDetail = document.getElementById("result-plan-detail");
const resultsHeadingPlan = document.getElementById("results-heading-plan");
const resultsHeadingProgram = document.getElementById("results-heading-program");
const resultProgramFocusHobby = document.getElementById("result-program-focus-hobby");
const togglePlanDetailBtn = document.getElementById("toggle-plan-detail-btn");
const togglePlanDetailLabel = document.getElementById("toggle-plan-detail-label");
const journeyTracker = document.getElementById("journey-tracker");
const journeyWeekLabel = document.getElementById("journey-week-label");
const journeyProgressFill = document.getElementById("journey-progress-fill");
const journeyTaskCount = document.getElementById("journey-task-count");
const journeyXp = document.getElementById("journey-xp");
const journeyTier = document.getElementById("journey-tier");
const journeyStreak = document.getElementById("journey-streak");
const journeyNavShell = document.getElementById("journey-nav-shell");
const badgeDrawerBtn = document.getElementById("badge-drawer-btn");
const badgeDrawer = document.getElementById("badge-drawer");
const badgeDrawerBackdrop = document.getElementById("badge-drawer-backdrop");
const badgeDrawerClose = document.getElementById("badge-drawer-close");
const badgeDrawerList = document.getElementById("badge-drawer-list");
const badgeToastRoot = document.getElementById("badge-toast-root");
const journeyInsightCard = document.getElementById("journey-insight-card");
const journeyInsightTitle = document.getElementById("journey-insight-title");
const journeyInsightBody = document.getElementById("journey-insight-body");
const journeyInsightBullets = document.getElementById("journey-insight-bullets");
const journeyInsightActions = document.getElementById("journey-insight-actions");
const resultWeeksAnchor = document.getElementById("result-weeks-anchor");
const resultWeeksProgramHint = document.getElementById("result-weeks-program-hint");

const errors = {
  interests: document.getElementById("interests-error"),
  weeklyHours: document.getElementById("weekly-hours-error"),
  monthlyBudget: document.getElementById("monthly-budget-error"),
};

const INTEREST_CHIP_CLASS =
  "interest-suggestion-chip hb-btn-press rounded-full border border-violet-300/90 bg-violet-50/95 px-3 py-1.5 text-xs font-semibold text-violet-950 transition hover:border-accent hover:bg-accent/15 dark:border-accent/30 dark:bg-midnight-900/80 dark:text-violet-100 dark:hover:bg-accent/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 dark:focus-visible:ring-offset-midnight-850";

const INTEREST_TAB_BASE =
  "hb-btn-press shrink-0 rounded-full border-2 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide transition";
const INTEREST_TAB_OFF =
  "border-violet-200/80 bg-white/90 text-ink-600 hover:border-accent/40 dark:border-midnight-600 dark:bg-midnight-900/60 dark:text-slate-300";
const INTEREST_TAB_ON =
  "border-accent bg-accent/20 text-accent-dark shadow-brand-sm dark:border-accent-light dark:bg-accent/25 dark:text-accent-light";

let planRequestSeq = 0;
/** @type {object | null} */
let currentPlan = null;
let pendingProgramFeedback = "";
/** Son tamamlanma geçişinde öneri kartına kaydırma için */
let prevJourneyPathComplete = false;

const INTEREST_GROUPS = [
  {
    title: "Sanat & el işi",
    items: [
      "Seramik",
      "Yağlı boya",
      "Eskiz",
      "Dijital illüstrasyon",
      "Örgü",
      "Dikiş",
      "Takı tasarımı",
      "Ahşap oyma",
      "Origami",
      "Kolaj",
      "Kaligrafi",
      "Maket",
    ],
  },
  {
    title: "Müzik & performans",
    items: [
      "Gitar",
      "Piyano",
      "Ukulele",
      "Şan",
      "Bateri",
      "DJ mix",
      "Hip-hop dans",
      "Salsa / latin dans",
      "Keman",
      "Blok flüt",
    ],
  },
  {
    title: "Teknoloji & dijital",
    items: [
      "Kodlama side-project",
      "Oyun geliştirme",
      "3D modelleme",
      "Drone",
      "Fotoğrafçılık",
      "Video kurgu",
      "Podcast",
      "Blog / yazı",
      "Arduino",
    ],
  },
  {
    title: "Doğa & beden",
    items: [
      "Doğa yürüyüşü",
      "Bisiklet",
      "Kamp",
      "Bahçecilik",
      "Yoga",
      "Pilates",
      "Bouldering",
      "Yüzme",
      "Koşu",
      "Balık tutma",
      "Kayak",
    ],
  },
  {
    title: "Zihin & sosyal",
    items: [
      "Satranç",
      "Go",
      "Bulmaca / sudoku",
      "Kitap kulübü",
      "Yaratıcı yazarlık",
      "Gönüllülük",
      "Board game",
      "Dil öğrenme",
      "Tarih okumaları",
    ],
  },
  {
    title: "Ev & yaşam",
    items: [
      "Yemek / tarif",
      "Kahve demleme",
      "Kokteyl / mocktail",
      "Ev düzenleme",
      "Bitki yetiştirme",
      "Akvaryum",
      "Ekmek yapımı",
      "Fermente mutfak",
    ],
  },
];

function appendInterest(label) {
  const raw = interestsEl.value.trim();
  if (raw.toLowerCase().includes(label.toLowerCase())) return;
  const next = raw ? `${raw}, ${label}` : label;
  interestsEl.value = next.slice(0, 2000);
  interestsEl.dispatchEvent(new Event("input", { bubbles: true }));
  interestsEl.focus();
}

function initInterestSuggestions() {
  const root = document.getElementById("interest-suggestions-root");
  if (!root) return;

  const header = document.createElement("div");
  header.className = "mb-3 flex flex-wrap items-center justify-between gap-2";
  const titleRow = document.createElement("div");
  titleRow.className = "flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-ink-700 dark:text-slate-300";
  const titleIcon = document.createElement("i");
  titleIcon.className = "fa-solid fa-filter text-accent dark:text-accent-light";
  titleIcon.setAttribute("aria-hidden", "true");
  titleRow.appendChild(titleIcon);
  titleRow.appendChild(document.createTextNode(" Önerileri filtrele"));
  header.appendChild(titleRow);
  const hint = document.createElement("span");
  hint.className = "text-[11px] font-medium normal-case tracking-normal text-ink-500 dark:text-slate-500";
  hint.textContent = "Kategori + arama → tıkla, metne eklenir";
  header.appendChild(hint);
  root.appendChild(header);

  const searchWrap = document.createElement("div");
  searchWrap.className = "relative mb-3";
  const searchIcon = document.createElement("i");
  searchIcon.className =
    "fa-solid fa-magnifying-glass pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-400 dark:text-slate-500";
  searchIcon.setAttribute("aria-hidden", "true");
  const searchInput = document.createElement("input");
  searchInput.type = "search";
  searchInput.id = "interest-filter-search";
  searchInput.setAttribute("aria-label", "Önerilen ilgi alanlarında ara");
  searchInput.setAttribute("autocomplete", "off");
  searchInput.placeholder = "Örn. gitar, yoga, kod, seramik…";
  searchInput.className =
    "w-full rounded-xl border-2 border-violet-200/80 bg-white py-2.5 pl-10 pr-3 text-sm text-ink-900 placeholder:text-ink-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 dark:border-midnight-600 dark:bg-midnight-900/70 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-accent-light";
  searchWrap.appendChild(searchIcon);
  searchWrap.appendChild(searchInput);
  root.appendChild(searchWrap);

  const tabScroll = document.createElement("div");
  tabScroll.className =
    "interest-tab-scroll mb-3 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";
  tabScroll.setAttribute("role", "tablist");
  tabScroll.setAttribute("aria-label", "İlgi kategorisi");

  const chipViewport = document.createElement("div");
  chipViewport.className =
    "max-h-[11rem] overflow-y-auto rounded-xl border-2 border-violet-200/60 bg-white/80 p-3 dark:border-midnight-600 dark:bg-midnight-900/50 sm:max-h-[12.5rem]";
  const chipInner = document.createElement("div");
  chipInner.className = "flex flex-wrap gap-2";
  const emptyMsg = document.createElement("p");
  emptyMsg.className =
    "hidden w-full py-6 text-center text-sm font-medium text-ink-500 dark:text-slate-400";
  emptyMsg.textContent = "Bu filtreyle eşleşen öneri yok. Aramayı veya kategoriyi değiştir.";
  chipInner.appendChild(emptyMsg);

  const chips = [];
  const tabButtons = [];
  let activeCategory = "all";

  function applyTabStyles() {
    tabButtons.forEach((tb) => {
      const on = tb.dataset.category === activeCategory;
      tb.className = `${INTEREST_TAB_BASE} ${on ? INTEREST_TAB_ON : INTEREST_TAB_OFF}`;
      tb.setAttribute("aria-pressed", on ? "true" : "false");
      tb.setAttribute("aria-selected", on ? "true" : "false");
    });
  }

  function updateVisibility() {
    const q = searchInput.value.trim().toLowerCase();
    let any = false;
    chips.forEach((btn) => {
      const group = btn.dataset.group || "";
      const label = (btn.dataset.label || "").toLowerCase();
      const catOk = activeCategory === "all" || group === activeCategory;
      const searchOk = !q || label.includes(q);
      const show = catOk && searchOk;
      btn.classList.toggle("hidden", !show);
      if (show) any = true;
    });
    emptyMsg.classList.toggle("hidden", any);
  }

  function addTab(id, label) {
    const tb = document.createElement("button");
    tb.type = "button";
    tb.setAttribute("role", "tab");
    tb.dataset.category = id;
    tb.textContent = label;
    tb.addEventListener("click", () => {
      activeCategory = id;
      applyTabStyles();
      updateVisibility();
    });
    tabScroll.appendChild(tb);
    tabButtons.push(tb);
  }

  addTab("all", "Tümü");
  INTEREST_GROUPS.forEach((g) => addTab(g.title, g.title));
  applyTabStyles();

  INTEREST_GROUPS.forEach((group) => {
    group.items.forEach((item) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = INTEREST_CHIP_CLASS;
      btn.textContent = item;
      btn.dataset.group = group.title;
      btn.dataset.label = item.toLowerCase();
      btn.addEventListener("click", () => appendInterest(item));
      chipInner.appendChild(btn);
      chips.push(btn);
    });
  });

  chipViewport.appendChild(chipInner);
  root.appendChild(tabScroll);
  root.appendChild(chipViewport);

  searchInput.addEventListener("input", updateVisibility);
  updateVisibility();
}

function initLoadingMotion() {
  if (!lottiePlayer) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    lottiePlayer.classList.add("hidden");
  }
}

function showLoadingOverlay() {
  if (!loadingOverlay) return;
  loadingOverlay.classList.remove("hidden", "pointer-events-none");
  loadingOverlay.setAttribute("aria-hidden", "false");
  document.body.classList.add("overflow-hidden");
  if (lottiePlayer && !lottiePlayer.classList.contains("hidden")) {
    lottiePlayer.play?.();
  }
}

function hideLoadingOverlay() {
  if (!loadingOverlay) return;
  loadingOverlay.classList.add("hidden", "pointer-events-none");
  loadingOverlay.setAttribute("aria-hidden", "true");
  document.body.classList.remove("overflow-hidden");
  lottiePlayer?.stop?.();
}

function hideApiError() {
  if (!apiErrorEl) return;
  apiErrorEl.textContent = "";
  apiErrorEl.classList.add("hidden");
}

function showApiError(message) {
  if (!apiErrorEl) return;
  apiErrorEl.textContent = message;
  apiErrorEl.classList.remove("hidden");
}

function hideOnboarding() {
  onboardingSection?.classList.add("hidden");
}

function showOnboarding() {
  onboardingSection?.classList.remove("hidden");
}

function readProgramCommitment() {
  try {
    const raw = localStorage.getItem(PROGRAM_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (!o || typeof o.hobby !== "string") return null;
    const hobby = o.hobby.trim();
    return hobby ? { hobby } : null;
  } catch {
    return null;
  }
}

function commitProgram(hobby) {
  const h = String(hobby ?? "").trim();
  if (!h) return;
  try {
    localStorage.setItem(PROGRAM_KEY, JSON.stringify({ hobby: h, at: Date.now() }));
  } catch {
    /* ignore */
  }
}

function clearProgramCommitment() {
  try {
    localStorage.removeItem(PROGRAM_KEY);
  } catch {
    /* ignore */
  }
}

function setPlanDetailVisible(show) {
  document.querySelectorAll(".result-plan-collapsible").forEach((el) => {
    el.classList.toggle("hidden", !show);
  });
  if (resultsSection) {
    resultsSection.dataset.planDetailExpanded = show ? "true" : "false";
  }
  if (togglePlanDetailLabel) {
    togglePlanDetailLabel.textContent = show ? "Planı gizle" : "Plan ve malzemeleri göster";
  }
}

function applyProgramPhaseUi(plan) {
  const hobby = String(plan?.recommendedHobby ?? "").trim();
  if (resultsSection) {
    resultsSection.dataset.activeHobby = hobby;
  }
  const st = readProgramCommitment();
  const started = Boolean(hobby && st && st.hobby === hobby);

  if (resultProgramFocusHobby) {
    resultProgramFocusHobby.textContent = hobby || "—";
  }
  resultsHeadingPlan?.classList.toggle("hidden", started);
  resultsHeadingProgram?.classList.toggle("hidden", !started);
  togglePlanDetailBtn?.classList.toggle("hidden", !started);

  if (!started) {
    setPlanDetailVisible(true);
  } else {
    setPlanDetailVisible(false);
  }

  resultProgramCta?.classList.toggle("hidden", started);
  resultJourneyWrap?.classList.toggle("hidden", !started);
  startProgramBtn?.setAttribute("aria-expanded", started ? "true" : "false");
  resultWeeksProgramHint?.classList.toggle("hidden", !started);
}

function readProfileFromForm() {
  return {
    interests: interestsEl.value.trim(),
    weeklyHours: weeklyHoursEl.value,
    monthlyBudget: monthlyBudgetEl.value,
  };
}

function applyProfileSnapshot() {
  const snap = loadProfileSnapshot();
  if (!snap) return;
  if (snap.interests) interestsEl.value = snap.interests;
  if (snap.weeklyHours !== undefined && snap.weeklyHours !== "")
    weeklyHoursEl.value = snap.weeklyHours;
  if (snap.monthlyBudget !== undefined && snap.monthlyBudget !== "")
    monthlyBudgetEl.value = snap.monthlyBudget;
}

/**
 * @param {"enjoyment" | "effort"} kind
 * @param {number} initial 1–5
 * @param {(v: number) => void} onPick
 */
function createPulseRatingRow(kind, initial, onPick) {
  const row = document.createElement("div");
  row.className = "flex flex-wrap gap-2";
  const enjoy = [
    { v: 1, emoji: "😕", cap: "Az" },
    { v: 2, emoji: "😐", cap: "Idare" },
    { v: 3, emoji: "🙂", cap: "Tamam" },
    { v: 4, emoji: "😄", cap: "İyi" },
    { v: 5, emoji: "🤩", cap: "Harika" },
  ];
  const effort = [
    { v: 1, emoji: "🪶", cap: "Çok kolay" },
    { v: 2, emoji: "🌿", cap: "Kolay" },
    { v: 3, emoji: "⚖️", cap: "Orta" },
    { v: 4, emoji: "🔥", cap: "Zor" },
    { v: 5, emoji: "⛰️", cap: "Çok zor" },
  ];
  const opts = kind === "enjoyment" ? enjoy : effort;
  let current = Math.min(5, Math.max(1, Math.round(initial)));
  const buttons = [];

  const setSelected = (v) => {
    current = v;
    onPick(v);
    buttons.forEach((b) => {
      const on = Number(b.dataset.value) === v;
      b.classList.toggle("hb-pulse-rating-btn--on", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
  };

  opts.forEach((o) => {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.value = String(o.v);
    b.className =
      "hb-pulse-rating-btn hb-btn-press flex min-w-[4.5rem] flex-1 flex-col items-center gap-0.5 rounded-xl border border-violet-500/25 bg-midnight-950/60 px-2 py-2 text-center text-[10px] font-semibold text-slate-300 transition hover:border-fuchsia-400/40 hover:bg-midnight-900 sm:min-w-[5rem]";
    b.innerHTML = `<span class="text-lg leading-none" aria-hidden="true">${o.emoji}</span><span>${o.cap}</span>`;
    b.addEventListener("click", () => setSelected(o.v));
    b.setAttribute("aria-pressed", o.v === current ? "true" : "false");
    if (o.v === current) b.classList.add("hb-pulse-rating-btn--on");
    buttons.push(b);
    row.appendChild(b);
  });

  setSelected(current);
  return { row, getValue: () => current };
}

function appendOptionalWeekPulse(card, weekNumber, hobby, trackingOn) {
  if (!trackingOn) return;
  const progress = loadProgress();
  if (!progress || progress.hobby !== hobby) return;
  const wk = String(weekNumber);
  const existing = progress.weeklyPulse[wk];

  const shell = document.createElement("div");
  shell.className =
    "hb-pulse-shell mt-5 overflow-hidden rounded-2xl border-2 border-fuchsia-500/25 bg-gradient-to-br from-fuchsia-600/15 via-midnight-950/80 to-amber-500/10 p-[1px] shadow-joy-sm";

  const inner = document.createElement("div");
  inner.className = "rounded-[0.9rem] bg-midnight-900/95 p-4 sm:p-5";

  const head = document.createElement("div");
  head.className = "mb-4 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between";
  const headLeft = document.createElement("div");
  headLeft.innerHTML = `<p class="text-xs font-bold uppercase tracking-wide text-fuchsia-300/90"><i class="fa-solid fa-wand-magic-sparkles mr-1.5 text-amber-300" aria-hidden="true"></i>Haftanın nabzı</p>
    <p class="mt-1 font-display text-base font-bold text-slate-50">Bu hafta senin için nasıl geçti?</p>
    <p class="mt-0.5 text-xs text-slate-400">İsteğe bağlı — yaklaşık 30 saniye. Cevapların sadece sende kalır.</p>`;
  head.appendChild(headLeft);
  shell.appendChild(inner);
  inner.appendChild(head);

  const body = document.createElement("div");
  body.className = "space-y-4";

  if (existing) {
    const note = document.createElement("p");
    note.className = "rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100/90";
    note.textContent = `Kayıtlı: keyif ${existing.enjoyment}/5 · zorluk ${existing.effort}/5 — aşağıdan güncelleyebilirsin.`;
    body.appendChild(note);
  } else if (progress.dismissedPulse[wk]) {
    const note = document.createElement("p");
    note.className = "text-xs text-slate-400";
    note.textContent = "Bu hafta anketi atlamıştın; istersen şimdi doldurabilirsin.";
    body.appendChild(note);
  }

  const enjoyLbl = document.createElement("p");
  enjoyLbl.className = "text-[11px] font-bold uppercase tracking-wide text-amber-200/80";
  enjoyLbl.textContent = "Keyif seviyesi";
  body.appendChild(enjoyLbl);
  const enjoyPick = createPulseRatingRow("enjoyment", existing?.enjoyment ?? 3, () => {});
  body.appendChild(enjoyPick.row);

  const effLbl = document.createElement("p");
  effLbl.className = "text-[11px] font-bold uppercase tracking-wide text-amber-200/80";
  effLbl.textContent = "Ne kadar zorladı?";
  body.appendChild(effLbl);
  const effPick = createPulseRatingRow("effort", existing?.effort ?? 3, () => {});
  body.appendChild(effPick.row);

  const ta = document.createElement("textarea");
  ta.id = `week-pulse-comment-${weekNumber}`;
  ta.rows = 3;
  ta.setAttribute("aria-label", "Bu hafta için isteğe bağlı kısa not");
  ta.placeholder =
    "İstersen bir cümle: en çok ne yakaladı, ne sürpriz oldu? (Boş bırakılabilir.)";
  ta.maxLength = 620;
  ta.className =
    "mt-1 w-full rounded-xl border border-violet-500/30 bg-midnight-950/80 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-fuchsia-400/50 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/20";
  ta.value = String(existing?.comment ?? "");

  const taLbl = document.createElement("label");
  taLbl.className = "block text-xs font-medium text-slate-400";
  taLbl.setAttribute("for", ta.id);
  taLbl.textContent = "Kısa not (isteğe bağlı)";
  body.appendChild(taLbl);
  body.appendChild(ta);

  const btnRow = document.createElement("div");
  btnRow.className = "flex flex-wrap gap-2 pt-1";
  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className =
    "hb-btn-press flex-1 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2.5 text-sm font-bold text-white shadow-joy-sm sm:flex-none";
  saveBtn.innerHTML = '<i class="fa-solid fa-paper-plane mr-2" aria-hidden="true"></i>Kaydet';
  saveBtn.addEventListener("click", () => {
    saveWeeklyPulse(hobby, weekNumber, enjoyPick.getValue(), effPick.getValue(), ta.value);
    if (currentPlan) renderPlan(currentPlan);
  });
  const skipBtn = document.createElement("button");
  skipBtn.type = "button";
  skipBtn.className =
    "hb-btn-press rounded-xl border border-slate-500/40 bg-midnight-950/60 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:border-slate-400/60";
  skipBtn.textContent = "Şimdi değil";
  skipBtn.addEventListener("click", () => {
    dismissWeeklyPulse(hobby, weekNumber);
    if (currentPlan) renderPlan(currentPlan);
  });
  btnRow.appendChild(saveBtn);
  btnRow.appendChild(skipBtn);
  body.appendChild(btnRow);

  inner.appendChild(body);
  card.appendChild(shell);
}

function getMaxBrowseWeekNumber(plan, progress, auto) {
  if (auto.phase === "complete") return 4;
  return Math.max(0, auto.week - 1);
}

function setBadgeDrawerOpen(open) {
  if (!badgeDrawer) return;
  badgeDrawer.classList.toggle("hidden", !open);
  badgeDrawerBtn?.setAttribute("aria-expanded", open ? "true" : "false");
  document.body.classList.toggle("overflow-hidden", Boolean(open));
  if (open) renderBadgeDrawerList();
}

function renderBadgeDrawerList() {
  if (!badgeDrawerList || !currentPlan) return;
  const progress = loadProgress();
  badgeDrawerList.replaceChildren();
  const states = listBadgeStates(currentPlan, progress);
  states.forEach((b) => {
    const row = document.createElement("div");
    row.className = [
      "mb-3 flex gap-3 rounded-xl border p-3",
      b.earned
        ? "border-fuchsia-400/35 bg-gradient-to-r from-accent/15 to-amber-500/10"
        : "border-midnight-600 bg-midnight-950/50 opacity-75",
    ].join(" ");
    const ic = document.createElement("div");
    ic.className = `flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${b.earned ? "bg-fuchsia-500/20 text-amber-300" : "bg-midnight-800 text-slate-500"}`;
    ic.innerHTML = `<i class="fa-solid ${b.icon}" aria-hidden="true"></i>`;
    const tx = document.createElement("div");
    tx.className = "min-w-0 flex-1";
    tx.innerHTML = `<p class="font-semibold text-slate-100">${b.label}${b.earned ? "" : ' <i class="fa-solid fa-lock text-xs text-slate-500" aria-hidden="true"></i>'}</p><p class="text-xs text-slate-400">${b.desc}</p>`;
    row.appendChild(ic);
    row.appendChild(tx);
    badgeDrawerList.appendChild(row);
  });
}

function syncBadgeToasts(states) {
  const earned = states.filter((s) => s.earned).map((s) => s.id);
  const next = new Set(earned);
  if (prevEarnedBadgeIds.size === 0) {
    prevEarnedBadgeIds = next;
    return;
  }
  earned.forEach((id) => {
    if (prevEarnedBadgeIds.has(id)) return;
    const b = states.find((x) => x.id === id);
    if (!b || !badgeToastRoot) return;
    const el = document.createElement("div");
    el.className =
      "hb-badge-toast pointer-events-auto flex items-center gap-3 rounded-xl border border-fuchsia-400/40 bg-gradient-to-r from-accent/40 via-fuchsia-600/25 to-amber-500/20 px-4 py-3 text-sm font-semibold text-white shadow-joy";
    el.setAttribute("role", "status");
    el.innerHTML = `<i class="fa-solid ${b.icon} text-2xl text-amber-300" aria-hidden="true"></i><span>Rozet: <strong>${b.label}</strong></span>`;
    badgeToastRoot.appendChild(el);
    window.setTimeout(() => {
      el.classList.add("hb-badge-toast--out");
      window.setTimeout(() => el.remove(), 400);
    }, 3200);
  });
  prevEarnedBadgeIds = next;
}

function appendWeekPulseReadonly(card, weekNumber, progress) {
  const wk = String(weekNumber);
  const p = progress?.weeklyPulse?.[wk];
  const skipped = progress?.dismissedPulse?.[wk];
  const box = document.createElement("div");
  box.className =
    "mt-4 rounded-xl border border-slate-500/30 bg-midnight-950/50 px-3 py-2 text-xs text-slate-400";
  if (p) {
    box.textContent = `Nabız kaydı: keyif ${p.enjoyment}/5 · zorluk ${p.effort}/5${p.comment ? ` — "${String(p.comment).slice(0, 120)}${String(p.comment).length > 120 ? "…" : ""}"` : ""}`;
  } else if (skipped) {
    box.textContent = "Bu hafta anket atlanmış.";
  } else {
    box.textContent = "Henüz nabız kaydı yok.";
  }
  card.appendChild(box);
}

function renderJourneyNav(plan, sorted, progress, hobby, auto) {
  if (!journeyNavShell) return;
  const maxBrowse = getMaxBrowseWeekNumber(plan, progress, auto);
  const browsing = journeyBrowseWeek != null;
  const displayWn = browsing ? journeyBrowseWeek : auto.week;
  const journeyComplete = auto.phase === "complete";

  journeyNavShell.classList.remove("hidden");
  journeyNavShell.replaceChildren();

  const row = document.createElement("div");
  row.className = "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between";

  const label = document.createElement("p");
  label.className = "text-center text-sm font-semibold text-slate-200 sm:text-left";
  if (browsing) {
    label.textContent = `Geçmiş hafta: ${displayWn}. hafta (salt okunur)`;
  } else if (journeyComplete) {
    label.textContent = "Yolculuk tamamlandı — geçmiş haftalara göz atabilirsin.";
  } else if (auto.phase === "tasks") {
    label.textContent = `Hafta ${auto.week} / 4 — önce görevleri bitir`;
  } else {
    label.textContent = `Hafta ${auto.week} / 4 — görevler tamam, nabız anketi`;
  }

  const btnRow = document.createElement("div");
  btnRow.className = "flex flex-wrap items-center justify-center gap-2 sm:justify-end";

  const backBtn = document.createElement("button");
  backBtn.type = "button";
  backBtn.className =
    "hb-btn-press inline-flex items-center gap-2 rounded-lg border border-violet-500/40 bg-midnight-900 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-fuchsia-400/50";
  backBtn.innerHTML = '<i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Geri';
  const canBack = browsing || (!browsing && maxBrowse >= 1);
  backBtn.disabled = !canBack;
  backBtn.classList.toggle("opacity-40", !canBack);
  backBtn.addEventListener("click", () => {
    if (browsing && journeyBrowseWeek > 1) {
      journeyBrowseWeek -= 1;
    } else if (browsing && journeyBrowseWeek === 1) {
      journeyBrowseWeek = null;
    } else if (!browsing && maxBrowse >= 1) {
      journeyBrowseWeek = maxBrowse;
    }
    if (currentPlan) renderPlan(currentPlan);
  });

  const fwdBtn = document.createElement("button");
  fwdBtn.type = "button";
  fwdBtn.className =
    "hb-btn-press inline-flex items-center gap-2 rounded-lg border border-violet-500/40 bg-midnight-900 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-fuchsia-400/50";
  fwdBtn.innerHTML = 'İleri <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>';
  const canFwd = browsing && journeyBrowseWeek != null && journeyBrowseWeek < maxBrowse;
  fwdBtn.disabled = !canFwd;
  fwdBtn.classList.toggle("opacity-40", !canFwd);
  fwdBtn.addEventListener("click", () => {
    if (browsing && journeyBrowseWeek != null && journeyBrowseWeek < maxBrowse) {
      journeyBrowseWeek += 1;
      if (currentPlan) renderPlan(currentPlan);
    }
  });

  const liveBtn = document.createElement("button");
  liveBtn.type = "button";
  liveBtn.className =
    "hb-btn-press inline-flex items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-200 hover:bg-amber-500/20";
  liveBtn.textContent = "Şu anki haftaya dön";
  liveBtn.hidden = !browsing;
  liveBtn.addEventListener("click", () => {
    journeyBrowseWeek = null;
    if (currentPlan) renderPlan(currentPlan);
  });

  btnRow.appendChild(backBtn);
  btnRow.appendChild(fwdBtn);
  btnRow.appendChild(liveBtn);

  row.appendChild(label);
  row.appendChild(btnRow);
  journeyNavShell.appendChild(row);
}

function appendResourcesCollapsible(card, resWeek, wn) {
  if (!Array.isArray(resWeek) || !resWeek.length) return;
  const det = document.createElement("details");
  det.className = "group mt-4 rounded-xl border border-violet-500/20 bg-midnight-950/40";
  const sum = document.createElement("summary");
  sum.className =
    "cursor-pointer list-none px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-fuchsia-300/90 marker:content-none";
  sum.innerHTML =
    '<span class="mr-2 inline-block transition group-open:rotate-90"><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></span>Bu haftanın kaynakları (isteğe bağlı)';
  det.appendChild(sum);
  const inner = document.createElement("div");
  inner.className = "space-y-3 border-t border-violet-500/15 px-3 pb-3 pt-1";
  resWeek.forEach((r) => {
    const row = document.createElement("div");
    row.className = "text-sm";
    const top = document.createElement("div");
    top.className = "flex flex-wrap items-baseline gap-2";
    const kind = document.createElement("span");
    kind.className =
      "inline-block rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-light";
    kind.textContent = String(r.kind || "link");
    top.appendChild(kind);
    top.appendChild(
      externalLinkOrSpan(
        r.url,
        String(r.title || "Bağlantı"),
        [r.title, r.kind, r.note].filter(Boolean).join(" ").trim() || String(r.title || "")
      )
    );
    row.appendChild(top);
    if (r.note) {
      const note = document.createElement("p");
      note.className = "mt-1 text-xs text-slate-500";
      note.textContent = String(r.note);
      row.appendChild(note);
    }
    inner.appendChild(row);
  });
  det.appendChild(inner);
  card.appendChild(det);
}

function renderJourneyWeekWizard(plan, sorted, progress, hobby, container) {
  const auto = getJourneyAutoStage(plan, progress);
  const maxBrowse = getMaxBrowseWeekNumber(plan, progress, auto);
  if (journeyBrowseWeek != null) {
    if (journeyBrowseWeek < 1 || journeyBrowseWeek > maxBrowse) {
      journeyBrowseWeek = null;
    }
  }

  const browsing = journeyBrowseWeek != null;
  const journeyComplete = auto.phase === "complete";

  renderJourneyNav(plan, sorted, progress, hobby, auto);

  if (journeyComplete && !browsing) {
    const msg = document.createElement("div");
    msg.className =
      "rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-8 text-center shadow-inner";
    msg.innerHTML =
      '<p class="font-display text-xl font-bold text-emerald-100">Dört haftayı tamamladın</p><p class="mt-2 text-sm text-emerald-200/85">Özet ve sonraki adımlar aşağıdaki kutuda. Geçmiş haftalara <strong>Geri</strong> ile bakabilirsin.</p>';
    container.appendChild(msg);
    return;
  }

  const displayWn = browsing ? journeyBrowseWeek : auto.week;
  const wi = sorted.findIndex((w, i) => resolveWeekNumber(w, i) === displayWn);
  if (wi < 0) return;
  const w = sorted[wi];
  const wn = resolveWeekNumber(w, wi);
  const seqLocked = !isWeekUnlocked(sorted, progress, wi);
  if (seqLocked) {
    const p = document.createElement("p");
    p.className = "text-sm text-slate-400";
    p.textContent = "Bu hafta henüz kilitli.";
    container.appendChild(p);
    return;
  }

  const phase = browsing ? "browse" : auto.phase;
  const showPulseOnly = phase === "pulse" && !browsing;
  const showTasks = phase === "tasks" || phase === "browse";

  const card = document.createElement("div");
  card.className =
    "max-h-[min(78vh,720px)] overflow-y-auto rounded-2xl border-2 border-amber-400/25 bg-gradient-to-b from-midnight-900/90 to-midnight-950 p-4 shadow-joy-sm sm:p-6";

  if (!browsing && auto.phase === "tasks" && wn === auto.week) {
    const ribbon = document.createElement("div");
    ribbon.className =
      "mb-3 flex items-center gap-2 rounded-xl border border-amber-400/35 bg-gradient-to-r from-amber-500/20 via-fuchsia-500/10 to-violet-600/15 px-3 py-2 text-sm font-bold text-amber-100";
    ribbon.innerHTML =
      '<i class="fa-solid fa-bullseye text-amber-300" aria-hidden="true"></i><span>Bu haftanın odak noktası — önce bu görevleri bitir</span>';
    card.appendChild(ribbon);
  }

  if (!browsing && auto.phase === "pulse" && wn === auto.week) {
    const ribbon2 = document.createElement("div");
    ribbon2.className =
      "mb-3 flex items-center gap-2 rounded-xl border border-fuchsia-400/35 bg-fuchsia-500/10 px-3 py-2 text-sm font-bold text-fuchsia-100";
    ribbon2.innerHTML =
      '<i class="fa-solid fa-wand-magic-sparkles text-amber-300" aria-hidden="true"></i><span>Görevler tamam — şimdi haftanın nabzını kaydet</span>';
    card.appendChild(ribbon2);
  }

  if (browsing) {
    const b = document.createElement("div");
    b.className =
      "mb-3 rounded-lg border border-slate-500/30 bg-midnight-950/60 px-2 py-1.5 text-center text-[11px] text-slate-400";
    b.textContent = "Salt okunur özet";
    card.appendChild(b);
  }

  const title = document.createElement("p");
  title.className = "font-display text-xl font-bold text-white";
  title.textContent = `${wn}. hafta`;
  card.appendChild(title);

  if (w.learningObjective) {
    const obj = document.createElement("p");
    obj.className =
      "mt-2 rounded-xl border border-violet-500/20 bg-midnight-950/50 p-3 text-sm font-medium leading-relaxed text-slate-200";
    obj.textContent = String(w.learningObjective);
    card.appendChild(obj);
  }

  const tasks = Array.isArray(w.tasks) ? w.tasks : [];
  if (showTasks) {
    const ul = document.createElement("ul");
    ul.className = "mt-4 space-y-2";
    const readOnly = browsing;
    tasks.forEach((t, idx) => {
      const li = document.createElement("li");
      li.className =
        "rounded-xl border border-violet-500/15 bg-midnight-950/50 px-3 py-2.5 text-sm leading-snug text-slate-200";
      if (readOnly) {
        const done = Boolean(progress.tasks[`${wn}:${idx}`]);
        li.innerHTML = `<span class="mr-2 inline-flex h-5 w-5 items-center justify-center rounded border ${done ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-300" : "border-slate-600 text-slate-500"}"><i class="fa-solid fa-check text-[10px]" aria-hidden="true"></i></span>${String(t)}`;
        li.classList.add(done ? "opacity-80" : "");
      } else {
        const label = document.createElement("label");
        label.className = "flex cursor-pointer items-start gap-3";
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.className =
          "hb-task-check mt-0.5 h-5 w-5 shrink-0 rounded border-violet-400 text-accent focus:ring-accent";
        cb.checked = Boolean(progress.tasks[`${wn}:${idx}`]);
        const span = document.createElement("span");
        span.textContent = String(t);
        span.className = cb.checked ? "text-slate-500 line-through" : "text-slate-100";
        cb.addEventListener("change", () => {
          if (!currentPlan) return;
          setTaskDone(currentPlan, hobby, wn, idx, cb.checked);
          span.className = cb.checked ? "text-slate-500 line-through" : "text-slate-100";
          updateProgramChrome();
          if (currentPlan) renderPlan(currentPlan);
        });
        label.appendChild(cb);
        label.appendChild(span);
        li.appendChild(label);
      }
      ul.appendChild(li);
    });
    card.appendChild(ul);
    appendResourcesCollapsible(card, w.resourcesThisWeek, wn);
  }

  if (showPulseOnly) {
    appendOptionalWeekPulse(card, wn, hobby, true);
  } else if (phase === "browse") {
    appendWeekPulseReadonly(card, wn, progress);
  }

  container.appendChild(card);
}

function updateProgramChrome() {
  if (!currentPlan) return;
  const hobby = String(currentPlan.recommendedHobby ?? "").trim();
  const st = readProgramCommitment();
  const started = Boolean(hobby && st && st.hobby === hobby);
  const progress = loadProgress();

  journeyTracker?.classList.toggle("hidden", !started);
  const auto = started && getJourneyAutoStage(currentPlan, progress);
  const journeyComplete = Boolean(auto && auto.phase === "complete");
  journeyInsightCard?.classList.toggle("hidden", !started || !journeyComplete);
  resultAnalysisEl?.classList.toggle("hidden", started && !journeyComplete);

  if (!started) {
    prevJourneyPathComplete = false;
    return;
  }

  const counts = getTaskCounts(currentPlan, progress);
  const { xp, activeWeeks } = computeXpAndStreak(currentPlan, progress);
  const badgeStates = listBadgeStates(currentPlan, progress);
  syncBadgeToasts(badgeStates);
  const pct = counts.total ? Math.round((counts.done / counts.total) * 100) : 0;
  if (journeyProgressFill) journeyProgressFill.style.width = `${pct}%`;
  if (journeyTaskCount) {
    journeyTaskCount.textContent = `Görevler: ${counts.done} / ${counts.total} (${pct}%)`;
  }
  if (journeyXp) journeyXp.textContent = String(xp);
  if (journeyTier) journeyTier.textContent = xpTierLabelTr(xp);
  if (journeyStreak) journeyStreak.textContent = `${activeWeeks} / 4`;

  if (journeyWeekLabel && auto) {
    if (journeyComplete) {
      journeyWeekLabel.textContent = "Yolculuk tamam — özet aşağıda";
    } else if (auto.phase === "pulse") {
      journeyWeekLabel.textContent = `Hafta ${auto.week} / 4 — nabız anketi`;
    } else {
      journeyWeekLabel.textContent = `Hafta ${auto.week} / 4 — görevler`;
    }
  }

  const insight = computeInsight(currentPlan, progress);
  if (!journeyComplete) {
    if (journeyInsightTitle) journeyInsightTitle.textContent = "";
    if (journeyInsightBody) journeyInsightBody.textContent = "";
    if (journeyInsightBullets) journeyInsightBullets.replaceChildren();
    if (journeyInsightActions) journeyInsightActions.replaceChildren();
  } else {
  const copy = buildCompletionInsightCopy(insight, hobby);
  if (journeyInsightTitle) journeyInsightTitle.textContent = copy.title;
  if (journeyInsightBody) journeyInsightBody.textContent = copy.body;
  if (journeyInsightBullets) {
    journeyInsightBullets.replaceChildren();
    copy.bullets.forEach((b) => {
      const li = document.createElement("li");
      li.textContent = b;
      journeyInsightBullets.appendChild(li);
    });
  }
  if (journeyInsightActions) {
    journeyInsightActions.replaceChildren();
      const rec = getCompletionPrimaryAction(insight);
      const callout = document.createElement("div");
      callout.className =
        "mb-4 rounded-xl border-2 border-accent/45 bg-gradient-to-br from-accent/15 to-violet-50/40 p-4 dark:border-accent-light/40 dark:from-accent/20 dark:to-midnight-900/50";
      const callTitle = document.createElement("p");
      callTitle.className =
        "font-display text-base font-bold text-ink-950 dark:text-white";
      callTitle.textContent = rec.headline;
      const callDetail = document.createElement("p");
      callDetail.className = "mt-2 text-sm leading-relaxed text-ink-700 dark:text-slate-300";
      callDetail.textContent = rec.detail;
      callout.appendChild(callTitle);
      callout.appendChild(callDetail);
      journeyInsightActions.appendChild(callout);

      const primaryKind = rec.primary;
      const primaryBtn = document.createElement("button");
      primaryBtn.type = "button";
      primaryBtn.className =
        "hb-btn-press w-full rounded-xl bg-accent px-4 py-3.5 text-sm font-bold text-white shadow-brand transition hover:brightness-110 dark:shadow-none";
      if (primaryKind === "advance") {
        primaryBtn.innerHTML =
          '<i class="fa-solid fa-stairs mr-2" aria-hidden="true"></i> İleri seviye 4 haftalık plan (önerilen)';
        primaryBtn.addEventListener("click", () => {
          void requestJourneyContinuation("advance");
        });
      } else {
        primaryBtn.innerHTML =
          '<i class="fa-solid fa-compass mr-2" aria-hidden="true"></i> Farklı hobi / yön öner (önerilen)';
        primaryBtn.addEventListener("click", () => {
          void requestJourneyContinuation("pivot");
        });
      }
      journeyInsightActions.appendChild(primaryBtn);

      const secondaryBtn = document.createElement("button");
      secondaryBtn.type = "button";
      secondaryBtn.className =
        "hb-btn-press mt-2 w-full rounded-xl border border-violet-200/90 bg-transparent px-3 py-2 text-xs font-semibold text-ink-600 underline-offset-2 hover:bg-violet-50/50 hover:text-ink-800 dark:border-midnight-600 dark:text-slate-400 dark:hover:bg-midnight-800/60 dark:hover:text-slate-200";
      secondaryBtn.textContent = rec.secondaryLabel;
      secondaryBtn.addEventListener("click", () => {
        void requestJourneyContinuation(primaryKind === "advance" ? "pivot" : "advance");
      });
      journeyInsightActions.appendChild(secondaryBtn);

      const sub = document.createElement("p");
      sub.className = "mt-3 text-xs text-ink-600 dark:text-slate-400";
      sub.textContent =
        "Her iki seçenek de yeni dört haftalık plan üretir ve yerel program verisini sıfırlar. Süre ve bütçe formdaki değerlerle kalır.";
      journeyInsightActions.appendChild(sub);

      if (!prevJourneyPathComplete) {
        prevJourneyPathComplete = true;
        requestAnimationFrame(() => {
          journeyInsightCard?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        });
      }
  }
  }

  if (!journeyComplete) prevJourneyPathComplete = false;
}

function formatTry(n) {
  if (!Number.isFinite(n)) return "—";
  return `${n.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} ₺`;
}

function sanitizeHttpsUrl(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    if (u.protocol === "https:" || u.protocol === "http:") return u.href;
  } catch {
    /* ignore */
  }
  return null;
}

function googleSearchUrlFromQuery(query) {
  const q = String(query ?? "")
    .trim()
    .slice(0, 300);
  return `https://www.google.com/search?q=${encodeURIComponent(q || "hobi")}`;
}

function externalLinkOrSpan(url, text, fallbackQuery) {
  const safe = sanitizeHttpsUrl(url);
  const linkClasses =
    "hb-external-link font-medium text-accent-dark underline decoration-accent/40 underline-offset-2 hover:decoration-accent dark:text-accent-light";
  if (safe) {
    const a = document.createElement("a");
    a.href = safe;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.className = linkClasses;
    a.dataset.externalUrl = safe;
    if (fallbackQuery != null && String(fallbackQuery).trim()) {
      a.dataset.fallbackQuery = String(fallbackQuery).trim().slice(0, 400);
    }
    a.textContent = text;
    return a;
  }
  const span = document.createElement("span");
  span.className = "font-medium text-ink-900 dark:text-white";
  span.textContent = text;
  return span;
}

async function verifyExternalLinksIn(root) {
  if (!root) return;
  const nodes = [...root.querySelectorAll("a.hb-external-link[data-external-url]")];
  if (!nodes.length) return;
  const urls = [...new Set(nodes.map((a) => a.dataset.externalUrl).filter(Boolean))];
  if (!urls.length) return;
  try {
    const res = await fetch(VERIFY_URLS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls }),
    });
    let data;
    try {
      data = await res.json();
    } catch {
      return;
    }
    if (!res.ok) return;
    const dead = new Set(
      (Array.isArray(data.results) ? data.results : []).filter((r) => r && r.ok === false).map((r) => r.url)
    );
    if (!dead.size) return;
    nodes.forEach((a) => {
      const u = a.dataset.externalUrl;
      if (!u || !dead.has(u)) return;
      const wrap = document.createElement("span");
      wrap.className = "inline-flex max-w-full flex-col gap-1 sm:inline-flex sm:max-w-none sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-2";
      const label = document.createElement("span");
      label.className = "font-medium text-ink-800 dark:text-slate-200";
      label.textContent = a.textContent;
      wrap.appendChild(label);
      const hint = document.createElement("span");
      hint.className = "text-xs font-medium text-ink-500 dark:text-slate-500";
      hint.textContent = "Bağlantı doğrulanamadı.";
      wrap.appendChild(hint);
      const q = a.dataset.fallbackQuery || a.textContent || "";
      const searchA = document.createElement("a");
      searchA.href = googleSearchUrlFromQuery(q);
      searchA.target = "_blank";
      searchA.rel = "noopener noreferrer";
      searchA.className =
        "hb-external-link shrink-0 text-sm font-semibold text-accent-dark underline decoration-accent/50 underline-offset-2 hover:decoration-accent dark:text-accent-light";
      searchA.textContent = "Google'da ara";
      wrap.appendChild(searchA);
      a.replaceWith(wrap);
    });
  } catch {
    /* ağ / CORS: linkleri olduğu gibi bırak */
  }
}

function renderLearningResources(lr) {
  if (!resultLearningSection || !resultLearningEl) return;
  resultLearningEl.textContent = "";

  const books = lr && typeof lr === "object" && Array.isArray(lr.books) ? lr.books : [];
  const vids =
    lr && typeof lr === "object" && Array.isArray(lr.youtubeVideos) ? lr.youtubeVideos : [];
  const comms =
    lr && typeof lr === "object" && Array.isArray(lr.onlineCommunities) ? lr.onlineCommunities : [];

  if (!books.length && !vids.length && !comms.length) {
    resultLearningSection.classList.add("hidden");
    return;
  }

  resultLearningSection.classList.remove("hidden");

  const grid = document.createElement("div");
  grid.className = "grid gap-6 lg:grid-cols-3";

  const colClass =
    "rounded-2xl border-2 border-violet-200/70 bg-white p-5 dark:border-midnight-600 dark:bg-midnight-800/90 sm:p-6";
  const h4Class = "font-display text-base font-semibold text-ink-900 dark:text-white";

  if (books.length) {
    const col = document.createElement("div");
    col.className = colClass;
    const h = document.createElement("h4");
    h.className = h4Class;
    h.innerHTML =
      '<i class="fa-solid fa-book mr-2 text-accent dark:text-accent-light" aria-hidden="true"></i>Kitaplar';
    const ul = document.createElement("ul");
    ul.className = "mt-4 list-none space-y-4";
    books.forEach((b) => {
      const li = document.createElement("li");
      li.className =
        "rounded-xl border border-violet-200/60 bg-violet-50/30 p-3 dark:border-midnight-600 dark:bg-midnight-900/40";
      const titleRow = document.createElement("div");
      titleRow.appendChild(
        externalLinkOrSpan(
          b.url,
          String(b.title || "—"),
          [b.title, b.author].filter(Boolean).join(" ").trim() || String(b.title || "")
        )
      );
      li.appendChild(titleRow);
      if (b.author) {
        const au = document.createElement("p");
        au.className = "mt-1 text-xs text-ink-600 dark:text-slate-400";
        au.textContent = String(b.author);
        li.appendChild(au);
      }
      if (b.whyRelevant) {
        const why = document.createElement("p");
        why.className = "mt-2 text-xs leading-relaxed text-ink-700 dark:text-slate-300";
        why.textContent = String(b.whyRelevant);
        li.appendChild(why);
      }
      ul.appendChild(li);
    });
    col.appendChild(h);
    col.appendChild(ul);
    grid.appendChild(col);
  }

  if (vids.length) {
    const col = document.createElement("div");
    col.className = colClass;
    const h = document.createElement("h4");
    h.className = h4Class;
    h.innerHTML =
      '<i class="fa-brands fa-youtube mr-2 text-red-600 dark:text-red-400" aria-hidden="true"></i>YouTube';
    const ul = document.createElement("ul");
    ul.className = "mt-4 list-none space-y-4";
    vids.forEach((v) => {
      const li = document.createElement("li");
      li.className =
        "rounded-xl border border-violet-200/60 bg-violet-50/30 p-3 dark:border-midnight-600 dark:bg-midnight-900/40";
      const titleRow = document.createElement("div");
      titleRow.appendChild(
        externalLinkOrSpan(
          v.url,
          String(v.title || "—"),
          [v.title, v.channelName].filter(Boolean).join(" ").trim() || String(v.title || "")
        )
      );
      li.appendChild(titleRow);
      if (v.channelName) {
        const ch = document.createElement("p");
        ch.className = "mt-1 text-xs text-ink-600 dark:text-slate-400";
        ch.textContent = String(v.channelName);
        li.appendChild(ch);
      }
      if (v.whyRelevant) {
        const why = document.createElement("p");
        why.className = "mt-2 text-xs leading-relaxed text-ink-700 dark:text-slate-300";
        why.textContent = String(v.whyRelevant);
        li.appendChild(why);
      }
      ul.appendChild(li);
    });
    col.appendChild(h);
    col.appendChild(ul);
    grid.appendChild(col);
  }

  if (comms.length) {
    const col = document.createElement("div");
    col.className = colClass;
    const h = document.createElement("h4");
    h.className = h4Class;
    h.innerHTML =
      '<i class="fa-solid fa-users mr-2 text-accent dark:text-accent-light" aria-hidden="true"></i>Topluluklar';
    const ul = document.createElement("ul");
    ul.className = "mt-4 list-none space-y-4";
    comms.forEach((c) => {
      const li = document.createElement("li");
      li.className =
        "rounded-xl border border-violet-200/60 bg-violet-50/30 p-3 dark:border-midnight-600 dark:bg-midnight-900/40";
      const titleRow = document.createElement("div");
      titleRow.appendChild(
        externalLinkOrSpan(
          c.url,
          String(c.name || "—"),
          [c.name, c.platform, "topluluk"].filter(Boolean).join(" ").trim() || String(c.name || "")
        )
      );
      li.appendChild(titleRow);
      if (c.platform) {
        const pl = document.createElement("p");
        pl.className = "mt-1 text-xs font-medium text-ink-600 dark:text-slate-400";
        pl.textContent = String(c.platform);
        li.appendChild(pl);
      }
      if (c.howToJoin) {
        const hj = document.createElement("p");
        hj.className = "mt-2 text-xs leading-relaxed text-ink-700 dark:text-slate-300";
        hj.textContent = String(c.howToJoin);
        li.appendChild(hj);
      }
      ul.appendChild(li);
    });
    col.appendChild(h);
    col.appendChild(ul);
    grid.appendChild(col);
  }

  resultLearningEl.appendChild(grid);
}

function renderHobbyOptions(plan) {
  if (!resultHobbyOptionsEl) return;
  resultHobbyOptionsEl.replaceChildren();
  const opts = Array.isArray(plan.hobbyOptions) ? plan.hobbyOptions : [];
  const active = String(plan.recommendedHobby || "").trim();

  if (opts.length === 0) {
    const fallback = document.createElement("p");
    fallback.className = "text-sm text-ink-600 dark:text-slate-400";
    fallback.textContent = "Bu yanıtta hobi seçenekleri listelenemedi.";
    resultHobbyOptionsEl.appendChild(fallback);
    return;
  }

  opts.forEach((o) => {
    const name = String(o.name || "").trim();
    if (!name) return;

    const isActive = name === active;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("data-hobby-option", name);
    btn.setAttribute("aria-pressed", isActive ? "true" : "false");
    btn.className = [
      "hb-btn-press w-full rounded-2xl border-2 p-4 text-left transition",
      isActive
        ? "border-accent bg-accent/15 shadow-brand-sm dark:border-accent-light dark:bg-accent/20"
        : "border-violet-200/80 bg-white/90 hover:border-accent/50 dark:border-midnight-600 dark:bg-midnight-800/80 dark:hover:border-accent/40",
    ].join(" ");

    if (isActive) {
      const badge = document.createElement("span");
      badge.className =
        "mb-2 inline-block rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white dark:text-midnight-900";
      badge.textContent = "Şu anki plan";
      btn.appendChild(badge);
    }

    const title = document.createElement("p");
    title.className = "font-display text-base font-semibold text-ink-950 dark:text-white";
    title.textContent = name;
    btn.appendChild(title);

    if (o.howItMatchesUser) {
      const match = document.createElement("p");
      match.className = "mt-2 text-xs leading-relaxed text-ink-700 dark:text-slate-300";
      match.textContent = String(o.howItMatchesUser);
      btn.appendChild(match);
    }
    if (o.oneLineTeaser) {
      const teaser = document.createElement("p");
      teaser.className = "mt-2 text-xs italic text-ink-600 dark:text-slate-400";
      teaser.textContent = String(o.oneLineTeaser);
      btn.appendChild(teaser);
    }

    btn.addEventListener("click", () => {
      if (name === String(plan.recommendedHobby || "").trim()) return;
      void switchToHobbyPlan(name);
    });

    resultHobbyOptionsEl.appendChild(btn);
  });
}

function renderPlan(plan) {
  if (!plan || typeof plan !== "object") return;

  currentPlan = plan;
  persistLastPlan(plan, readProfileFromForm());

  if (resultHobbyEl) {
    resultHobbyEl.textContent = String(plan.recommendedHobby || "—");
  }

  renderHobbyOptions(plan);

  if (resultWeeksEl) {
    resultWeeksEl.textContent = "";
    const weeks = Array.isArray(plan.weeks) ? plan.weeks : [];
    const sorted = [...weeks].sort((a, b) => (a.weekNumber || 0) - (b.weekNumber || 0));
    const hobby = String(plan.recommendedHobby ?? "").trim();
    const st = readProgramCommitment();
    const trackingOn = Boolean(hobby && st && st.hobby === hobby);
    const progress = trackingOn ? loadProgress() : null;

    if (trackingOn && progress && progress.hobby === hobby && sorted.length) {
      renderJourneyWeekWizard(plan, sorted, progress, hobby, resultWeeksEl);
    } else {
      journeyNavShell?.classList.add("hidden");
      journeyNavShell?.replaceChildren();
      sorted.forEach((w, wi) => {
        const wnRaw = Number(w.weekNumber);
        const wn = Number.isFinite(wnRaw) ? wnRaw : wi + 1;
        const card = document.createElement("div");
        card.className =
          "rounded-2xl border-2 border-violet-200/70 bg-white p-5 dark:border-midnight-600 dark:bg-midnight-800/90";
        const title = document.createElement("p");
        title.className =
          "mb-3 font-display text-base font-semibold text-accent-dark dark:text-accent-light";
        title.textContent = `${wn}. hafta`;
        card.appendChild(title);
        if (w.learningObjective) {
          const obj = document.createElement("p");
          obj.className = "mb-3 text-sm font-medium leading-relaxed text-ink-800 dark:text-slate-200";
          obj.textContent = String(w.learningObjective);
          card.appendChild(obj);
        }
        const ul = document.createElement("ul");
        ul.className =
          "list-inside list-disc space-y-2 text-sm text-ink-800 dark:text-slate-200";
        (Array.isArray(w.tasks) ? w.tasks : []).forEach((t) => {
          const li = document.createElement("li");
          li.textContent = String(t);
          ul.appendChild(li);
        });
        card.appendChild(ul);
        resultWeeksEl.appendChild(card);
      });
    }
  }

  if (resultBudgetNoteEl) {
    resultBudgetNoteEl.textContent = String(plan.budgetComplianceNote || "");
    resultBudgetNoteEl.classList.toggle("hidden", !plan.budgetComplianceNote);
  }

  if (resultMaterialsEl) {
    resultMaterialsEl.textContent = "";
    const mats = Array.isArray(plan.materials) ? plan.materials : [];
    mats.forEach((m) => {
      const li = document.createElement("li");
      li.className =
        "flex flex-col gap-1 rounded-xl border border-violet-200/60 bg-violet-50/40 px-4 py-3 dark:border-midnight-600 dark:bg-midnight-900/50 sm:flex-row sm:items-start sm:justify-between";
      const left = document.createElement("div");
      const name = document.createElement("p");
      name.className = "font-medium text-ink-900 dark:text-white";
      name.textContent = String(m.name || "—");
      left.appendChild(name);
      if (m.notes) {
        const note = document.createElement("p");
        note.className = "mt-1 text-xs text-ink-600 dark:text-slate-400";
        note.textContent = String(m.notes);
        left.appendChild(note);
      }
      if (m.url) {
        const shopRow = document.createElement("div");
        shopRow.className = "mt-2 flex flex-wrap items-center gap-2";
        if (m.retailerHint) {
          const tag = document.createElement("span");
          tag.className =
            "rounded-md border border-violet-200/80 bg-white/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-600 dark:border-midnight-600 dark:bg-midnight-900/80 dark:text-slate-400";
          tag.textContent = String(m.retailerHint);
          shopRow.appendChild(tag);
        }
        shopRow.appendChild(
          externalLinkOrSpan(
            m.url,
            "Mağazada görüntüle",
            [m.name, m.retailerHint].filter(Boolean).join(" ").trim() || String(m.name || "")
          )
        );
        left.appendChild(shopRow);
      }
      const price = document.createElement("p");
      price.className =
        "shrink-0 text-sm font-semibold text-accent-dark dark:text-accent-light sm:text-right";
      price.textContent = formatTry(Number(m.approxCostTry));
      li.appendChild(left);
      li.appendChild(price);
      resultMaterialsEl.appendChild(li);
    });
  }

  if (resultMaterialsTotalEl) {
    const total = Number(plan.materialsTotalEstimateTry);
    resultMaterialsTotalEl.textContent = Number.isFinite(total)
      ? `Tahmini malzeme toplamı: ${formatTry(total)}`
      : "";
    resultMaterialsTotalEl.classList.toggle("hidden", !Number.isFinite(total));
  }

  if (resultAnalysisEl) {
    const guideText = plan.journeyReflectionGuide ?? plan.developmentAnalysis ?? "";
    resultAnalysisEl.textContent = String(guideText);
  }

  renderLearningResources(plan.learningResources);

  applyProgramPhaseUi(plan);

  hideOnboarding();
  resultsSection?.classList.remove("hidden");

  updateProgramChrome();

  void verifyExternalLinksIn(resultsSection);
}

function setFieldError(fieldId, message) {
  const err = errors[fieldId];
  const input =
    fieldId === "interests"
      ? interestsEl
      : fieldId === "weeklyHours"
        ? weeklyHoursEl
        : monthlyBudgetEl;
  if (!err || !input) return;
  if (message) {
    err.textContent = message;
    err.classList.remove("hidden");
    input.setAttribute("aria-invalid", "true");
    input.classList.add(
      "border-red-400",
      "ring-1",
      "ring-red-200",
      "dark:border-red-500",
      "dark:ring-red-900/50"
    );
  } else {
    err.textContent = "";
    err.classList.add("hidden");
    input.setAttribute("aria-invalid", "false");
    input.classList.remove(
      "border-red-400",
      "ring-1",
      "ring-red-200",
      "dark:border-red-500",
      "dark:ring-red-900/50"
    );
  }
}

function clearAllErrors() {
  setFieldError("interests", "");
  setFieldError("weeklyHours", "");
  setFieldError("monthlyBudget", "");
}

function normalizeNumber(value) {
  const n = Number.parseFloat(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

function validateInterests(value) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "İlgi alanlarını yazman gerekiyor.";
  }
  if (trimmed.length < MIN_INTEREST_LENGTH) {
    return `En az ${MIN_INTEREST_LENGTH} karakter gir.`;
  }
  return "";
}

function validateWeeklyHours(value) {
  if (value === "" || value == null) {
    return "Haftalık süreyi gir.";
  }
  const n = normalizeNumber(value);
  if (!Number.isFinite(n)) {
    return "Geçerli bir sayı gir.";
  }
  if (n < WEEKLY_HOURS_MIN || n > WEEKLY_HOURS_MAX) {
    return `${WEEKLY_HOURS_MIN}–${WEEKLY_HOURS_MAX} saat arasında olmalı.`;
  }
  return "";
}

function validateMonthlyBudget(value) {
  if (value === "" || value == null) {
    return "Aylık bütçeyi gir.";
  }
  const n = normalizeNumber(value);
  if (!Number.isFinite(n) || n < 0) {
    return "Geçerli bir tutar (₺) gir.";
  }
  if (n < BUDGET_MIN || n > BUDGET_MAX) {
    return `Bütçe ${BUDGET_MIN}–${BUDGET_MAX.toLocaleString("tr-TR")} ₺ arasında olmalı.`;
  }
  return "";
}

function runValidation() {
  clearAllErrors();
  const iErr = validateInterests(interestsEl.value);
  const hErr = validateWeeklyHours(weeklyHoursEl.value);
  const bErr = validateMonthlyBudget(monthlyBudgetEl.value);
  setFieldError("interests", iErr);
  setFieldError("weeklyHours", hErr);
  setFieldError("monthlyBudget", bErr);
  return !iErr && !hErr && !bErr;
}

/**
 * @param {string | null | undefined} chosenHobby
 * @param {{ forceNoChosen?: boolean, journeyContinuation?: "advance" | "pivot" }} [options]
 */
function buildPayload(chosenHobby, options = {}) {
  const payload = {
    interests: interestsEl.value.trim(),
    weeklyHours: normalizeNumber(weeklyHoursEl.value),
    monthlyBudget: normalizeNumber(monthlyBudgetEl.value),
  };
  const forceNoChosen = Boolean(options.forceNoChosen);
  const ch =
    chosenHobby != null && !forceNoChosen ? String(chosenHobby).trim() : "";
  if (ch) {
    payload.chosenHobby = ch;
  }
  const fb = pendingProgramFeedback.trim();
  if (fb) {
    payload.programFeedback = fb.slice(0, 1500);
  }
  const jc = options.journeyContinuation;
  if (jc === "advance" || jc === "pivot") {
    payload.journeyContinuation = jc;
  }
  return payload;
}

/**
 * @param {"advance" | "pivot"} kind
 */
async function requestJourneyContinuation(kind) {
  hideApiError();
  if (!currentPlan) return;
  applyProfileSnapshot();
  if (!runValidation()) {
    showApiError(
      "Yeni plan için başlangıç bilgileri gerekli: ilgi alanı, haftalık süre ve bütçe. “Başlangıç bilgilerini göster” ile formu doldur veya önce bir kez plan oluşturmuş ol."
    );
    showOnboarding();
    onboardingSection?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  pendingProgramFeedback = buildJourneyContinuationFeedback(currentPlan, loadProgress(), kind);
  showLoadingOverlay();
  try {
    const hobbyName = String(currentPlan.recommendedHobby ?? "").trim();
    const plan = await requestPlan(
      buildPayload(kind === "advance" ? hobbyName : "", {
        forceNoChosen: kind === "pivot",
        journeyContinuation: kind === "advance" ? "advance" : "pivot",
      })
    );
    pendingProgramFeedback = "";
    if (!plan) return;
    clearProgramCommitment();
    clearProgress();
    renderPlan(plan);
    resultsSection?.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    const aborted = err?.name === "AbortError";
    const msg = aborted
      ? "İstek zaman aşımına uğradı (~55 sn). Bağlantını kontrol edip tekrar dene."
      : err instanceof Error
        ? err.message
        : "Beklenmeyen bir hata oluştu.";
    showApiError(msg);
  } finally {
    hideLoadingOverlay();
  }
}

async function requestPlan(payload) {
  const seq = ++planRequestSeq;
  const controller = new AbortController();
  const t = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(ANALYZE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    let data;
    try {
      data = await res.json();
    } catch {
      if (seq !== planRequestSeq) return null;
      throw new Error("Sunucudan geçersiz yanıt alındı.");
    }
    if (!res.ok) {
      if (seq !== planRequestSeq) return null;
      const msg = typeof data?.error === "string" ? data.error : "İstek başarısız oldu.";
      throw new Error(msg);
    }
    if (!data?.plan || typeof data.plan !== "object") {
      if (seq !== planRequestSeq) return null;
      throw new Error("Plan verisi alınamadı.");
    }
    if (seq !== planRequestSeq) return null;
    return data.plan;
  } catch (err) {
    if (seq !== planRequestSeq) return null;
    throw err;
  } finally {
    window.clearTimeout(t);
  }
}

async function switchToHobbyPlan(hobbyName) {
  const name = String(hobbyName || "").trim();
  if (!name) return;
  hideApiError();
  if (!runValidation()) {
    showApiError("Plan değiştirmek için ilgi alanı, süre ve bütçenin geçerli olması gerekir.");
    const firstInvalid = errors.interests.textContent
      ? interestsEl
      : errors.weeklyHours.textContent
        ? weeklyHoursEl
        : errors.monthlyBudget.textContent
          ? monthlyBudgetEl
          : null;
    firstInvalid?.focus();
    return;
  }
  showLoadingOverlay();
  try {
    const plan = await requestPlan(buildPayload(name));
    if (!plan) return;
    renderPlan(plan);
    resultsSection?.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    const aborted = err?.name === "AbortError";
    const msg = aborted
      ? "İstek zaman aşımına uğradı (~55 sn). Bağlantını kontrol edip tekrar dene."
      : err instanceof Error
        ? err.message
        : "Beklenmeyen bir hata oluştu.";
    showApiError(msg);
  } finally {
    hideLoadingOverlay();
  }
}

function tryRestoreLastPlan() {
  applyProfileSnapshot();
  const pack = loadLastPlan();
  if (!pack?.plan) return;
  renderPlan(pack.plan);
}

document.documentElement.classList.add("dark");

initInterestSuggestions();
initLoadingMotion();
tryRestoreLastPlan();

lottiePlayer?.addEventListener("error", () => {
  lottiePlayer.classList.add("hidden");
});

["input", "blur"].forEach((evt) => {
  interestsEl.addEventListener(evt, () => {
    if (!errors.interests.classList.contains("hidden")) {
      setFieldError("interests", validateInterests(interestsEl.value));
    }
  });
  weeklyHoursEl.addEventListener(evt, () => {
    if (!errors.weeklyHours.classList.contains("hidden")) {
      setFieldError("weeklyHours", validateWeeklyHours(weeklyHoursEl.value));
    }
  });
  monthlyBudgetEl.addEventListener(evt, () => {
    if (!errors.monthlyBudget.classList.contains("hidden")) {
      setFieldError("monthlyBudget", validateMonthlyBudget(monthlyBudgetEl.value));
    }
  });
});

editProfileBtn?.addEventListener("click", () => {
  showOnboarding();
  onboardingSection?.scrollIntoView({ behavior: "smooth", block: "start" });
});

togglePlanDetailBtn?.addEventListener("click", () => {
  const expanded = resultsSection?.dataset.planDetailExpanded === "true";
  setPlanDetailVisible(!expanded);
  if (!expanded) {
    resultPlanDetail?.scrollIntoView({ behavior: "smooth", block: "start" });
  } else {
    resultWeeksAnchor?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
});

startProgramBtn?.addEventListener("click", () => {
  const hobby = resultsSection?.dataset.activeHobby?.trim();
  if (!hobby || !currentPlan) return;
  journeyBrowseWeek = null;
  commitProgram(hobby);
  initProgressForHobby(hobby);
  renderPlan(currentPlan);
  resultWeeksAnchor?.scrollIntoView({ behavior: "smooth", block: "start" });
});

badgeDrawerBtn?.addEventListener("click", () => setBadgeDrawerOpen(true));
badgeDrawerBackdrop?.addEventListener("click", () => setBadgeDrawerOpen(false));
badgeDrawerClose?.addEventListener("click", () => setBadgeDrawerOpen(false));

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  successEl.classList.add("hidden");
  if (successMsgEl) successMsgEl.textContent = "";
  hideApiError();

  if (!runValidation()) {
    const firstInvalid =
      errors.interests.textContent
        ? interestsEl
        : errors.weeklyHours.textContent
          ? weeklyHoursEl
          : errors.monthlyBudget.textContent
            ? monthlyBudgetEl
            : null;
    firstInvalid?.focus();
    return;
  }

  submitBtn.disabled = true;
  showLoadingOverlay();

  try {
    const plan = await requestPlan(buildPayload());
    clearProgramCommitment();
    clearProgress();
    pendingProgramFeedback = "";
    renderPlan(plan);
    resultsSection?.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    const aborted = err?.name === "AbortError";
    const msg = aborted
      ? "İstek zaman aşımına uğradı (~55 sn). Bağlantını kontrol edip tekrar dene."
      : err instanceof Error
        ? err.message
        : "Beklenmeyen bir hata oluştu.";
    showApiError(msg);
  } finally {
    hideLoadingOverlay();
    submitBtn.disabled = false;
  }
});
