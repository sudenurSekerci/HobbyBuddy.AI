import {
  buildCompletionInsightCopy,
  buildInsightCopy,
  buildJourneyContinuationFeedback,
  buildProgramFeedbackForApi,
  clearProgress,
  computeInsight,
  computeXpAndStreak,
  dismissWeeklyPulse,
  getFocusWeekNumber,
  getTaskCounts,
  initProgressForHobby,
  isPathComplete,
  isWeekUnlocked,
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

const THEME_KEY = "hobbybuddy-theme";
const PROGRAM_KEY = "hobbybuddy-active-program";
const ANALYZE_URL = "/api/analyze";
const VERIFY_URLS_URL = "/api/verify-urls";
/** Zengin JSON planları için ~55 sn; ağ yavaşsa nadiren yine dolabilir. */
const REQUEST_TIMEOUT_MS = 55_000;

const form = document.getElementById("profile-form");
const interestsEl = document.getElementById("interests");
const weeklyHoursEl = document.getElementById("weekly-hours");
const monthlyBudgetEl = document.getElementById("monthly-budget");
const successEl = document.getElementById("form-success");
const successMsgEl = document.getElementById("form-success-msg");
const submitBtn = document.getElementById("submit-btn");
const themeToggle = document.getElementById("theme-toggle");
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
const journeyInsightCard = document.getElementById("journey-insight-card");
const journeyInsightTitle = document.getElementById("journey-insight-title");
const journeyInsightBody = document.getElementById("journey-insight-body");
const journeyInsightBullets = document.getElementById("journey-insight-bullets");
const journeyInsightActions = document.getElementById("journey-insight-actions");

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

function getStoredTheme() {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch {
    return null;
  }
}

function applyTheme(mode) {
  const root = document.documentElement;
  if (mode === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
  themeToggle?.setAttribute("aria-pressed", mode === "dark" ? "true" : "false");
}

function initTheme() {
  const stored = getStoredTheme();
  if (stored === "dark" || stored === "light") {
    applyTheme(stored);
    return;
  }
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(prefersDark ? "dark" : "light");
}

function initLoadingMotion() {
  if (!lottiePlayer) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    lottiePlayer.classList.add("hidden");
  }
}

function toggleTheme() {
  const next = document.documentElement.classList.contains("dark") ? "light" : "dark";
  applyTheme(next);
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    /* ignore */
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
 * @param {HTMLElement} card
 * @param {number} weekNumber
 * @param {string} hobby
 * @param {boolean} trackingOn
 */
function appendOptionalWeekPulse(card, weekNumber, hobby, trackingOn) {
  if (!trackingOn) return;
  const progress = loadProgress();
  if (!progress || progress.hobby !== hobby) return;
  const wk = String(weekNumber);
  const existing = progress.weeklyPulse[wk];

  const wrap = document.createElement("details");
  wrap.className =
    "mt-4 rounded-xl border border-violet-200/60 bg-violet-50/30 p-3 dark:border-midnight-600 dark:bg-midnight-900/40";

  const sum = document.createElement("summary");
  sum.className =
    "cursor-pointer select-none text-xs font-bold uppercase tracking-wide text-ink-700 dark:text-slate-300";
  sum.textContent = "İsteğe bağlı mini anket (zorunlu değil)";
  wrap.appendChild(sum);

  const body = document.createElement("div");
  body.className = "mt-3 space-y-3";

  const ta = document.createElement("textarea");
  ta.id = `week-pulse-comment-${weekNumber}`;
  ta.rows = 3;
  ta.setAttribute(
    "aria-label",
    "Bu hafta hakkında isteğe bağlı serbest yorum (en fazla birkaç cümle)"
  );
  ta.placeholder =
    "İstersen bu haftayı kendi cümlelerinle özetle (zorunlu değil). Örn: en çok ne zorladı, neyi sevdin…";
  ta.maxLength = 620;
  ta.className =
    "mt-1 w-full rounded-lg border border-violet-200/80 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 dark:border-midnight-600 dark:bg-midnight-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-accent-light";
  ta.value = String(existing?.comment ?? "");

  const taLbl = document.createElement("label");
  taLbl.className = "block text-xs font-medium text-ink-700 dark:text-slate-300";
  taLbl.setAttribute("for", ta.id);
  taLbl.textContent = "Serbest yorum (isteğe bağlı)";

  if (existing) {
    const note = document.createElement("p");
    note.className = "text-xs text-ink-600 dark:text-slate-400";
    note.textContent = `Kayıtlı yanıt: keyif ${existing.enjoyment}/5, çaba veya zorluk ${existing.effort}/5. Aşağıdan güncelleyebilirsin.`;
    body.appendChild(note);
  } else if (progress.dismissedPulse[wk]) {
    const note = document.createElement("p");
    note.className = "text-xs text-ink-600 dark:text-slate-400";
    note.textContent = "Bu hafta için anketi atlamayı seçtin; istersen yine doldurabilirsin.";
    body.appendChild(note);
  }

  /**
   * @param {string} labelText
   * @param {number} initial
   * @param {"enjoyment" | "effort"} kind
   */
  function addLabeledSelect(labelText, initial, kind) {
    const row = document.createElement("div");
    row.className = "flex flex-wrap items-center gap-2";
    const lbl = document.createElement("span");
    lbl.className = "text-xs font-medium text-ink-700 dark:text-slate-300";
    lbl.textContent = labelText;
    row.appendChild(lbl);
    const sel = document.createElement("select");
    sel.className =
      "max-w-full rounded-lg border border-violet-200/80 bg-white px-2 py-1 text-sm dark:border-midnight-600 dark:bg-midnight-900 dark:text-slate-100";
    const scale =
      kind === "effort"
        ? ["", "çok kolay", "kolay", "orta", "zor", "çok zor"]
        : ["", "çok düşük", "düşük", "orta", "iyi", "çok iyi"];
    for (let i = 1; i <= 5; i += 1) {
      const opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = `${i} — ${scale[i]}`;
      sel.appendChild(opt);
    }
    sel.value = String(initial);
    row.appendChild(sel);
    body.appendChild(row);
    return sel;
  }

  const selEnjoy = addLabeledSelect("Keyif:", existing?.enjoyment ?? 3, "enjoyment");
  const selEffort = addLabeledSelect("Çaba / zorluk:", existing?.effort ?? 3, "effort");

  body.appendChild(taLbl);
  body.appendChild(ta);

  const btnRow = document.createElement("div");
  btnRow.className = "flex flex-wrap gap-2 pt-1";
  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className =
    "hb-btn-press rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-white shadow-brand-sm dark:shadow-none";
  saveBtn.textContent = "Kaydet";
  saveBtn.addEventListener("click", () => {
    saveWeeklyPulse(hobby, weekNumber, Number(selEnjoy.value), Number(selEffort.value), ta.value);
    if (currentPlan) renderPlan(currentPlan);
  });
  const skipBtn = document.createElement("button");
  skipBtn.type = "button";
  skipBtn.className =
    "hb-btn-press rounded-lg border border-violet-200/80 bg-white px-3 py-1.5 text-xs font-semibold text-ink-700 dark:border-midnight-600 dark:bg-midnight-800 dark:text-slate-200";
  skipBtn.textContent = "Şimdi değil";
  skipBtn.addEventListener("click", () => {
    dismissWeeklyPulse(hobby, weekNumber);
    if (currentPlan) renderPlan(currentPlan);
  });
  btnRow.appendChild(saveBtn);
  btnRow.appendChild(skipBtn);
  body.appendChild(btnRow);

  wrap.appendChild(body);
  card.appendChild(wrap);
}

function updateProgramChrome() {
  if (!currentPlan) return;
  const hobby = String(currentPlan.recommendedHobby ?? "").trim();
  const st = readProgramCommitment();
  const started = Boolean(hobby && st && st.hobby === hobby);
  const progress = loadProgress();

  journeyTracker?.classList.toggle("hidden", !started);
  journeyInsightCard?.classList.toggle("hidden", !started);

  if (!started) return;

  const counts = getTaskCounts(currentPlan, progress);
  const { xp, activeWeeks } = computeXpAndStreak(currentPlan, progress);
  const pct = counts.total ? Math.round((counts.done / counts.total) * 100) : 0;
  if (journeyProgressFill) journeyProgressFill.style.width = `${pct}%`;
  if (journeyTaskCount) {
    journeyTaskCount.textContent = `Görevler: ${counts.done} / ${counts.total} (${pct}%)`;
  }
  if (journeyXp) journeyXp.textContent = String(xp);
  if (journeyTier) journeyTier.textContent = xpTierLabelTr(xp);
  if (journeyStreak) journeyStreak.textContent = `${activeWeeks} / 4`;

  const complete = isPathComplete(currentPlan, progress);
  const focusWeek = getFocusWeekNumber(currentPlan, progress);
  if (journeyWeekLabel) {
    if (counts.total && counts.done >= counts.total) {
      journeyWeekLabel.textContent = "Tebrikler — dört haftalık görev listesini tamamladın";
    } else {
      journeyWeekLabel.textContent = `Sıradaki odak: ${focusWeek}. hafta`;
    }
  }

  const insight = computeInsight(currentPlan, progress);
  const copy = complete ? buildCompletionInsightCopy(insight, hobby) : buildInsightCopy(insight, hobby);
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
    if (complete) {
      const wrap = document.createElement("div");
      wrap.className = "flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap";
      const adv = document.createElement("button");
      adv.type = "button";
      adv.className =
        "hb-btn-press inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-white shadow-brand-sm dark:shadow-none";
      adv.innerHTML =
        '<i class="fa-solid fa-stairs" aria-hidden="true"></i> İleri seviye 4 haftalık plan';
      adv.addEventListener("click", () => {
        void requestJourneyContinuation("advance");
      });
      const piv = document.createElement("button");
      piv.type = "button";
      piv.className =
        "hb-btn-press inline-flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-violet-200/90 bg-white px-4 py-2.5 text-sm font-semibold text-ink-800 dark:border-midnight-600 dark:bg-midnight-800 dark:text-slate-200";
      piv.innerHTML =
        '<i class="fa-solid fa-compass" aria-hidden="true"></i> Farklı hobi / yön öner';
      piv.addEventListener("click", () => {
        void requestJourneyContinuation("pivot");
      });
      wrap.appendChild(adv);
      wrap.appendChild(piv);
      journeyInsightActions.appendChild(wrap);
      const sub = document.createElement("p");
      sub.className = "mt-2 text-xs text-ink-600 dark:text-slate-400";
      sub.textContent =
        "İkisi de yeni plan üretir; ilki aynı hobide derinleştirir, ikincisi farklı bir öneri için kilidi kaldırır. Başlangıç bilgilerin (süre, bütçe) aynı kalır.";
      journeyInsightActions.appendChild(sub);
    } else if (insight.path === "explore") {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "hb-btn-press rounded-xl border-2 border-accent/50 bg-accent/10 px-4 py-2 text-sm font-semibold text-accent-dark dark:border-accent-light/50 dark:bg-accent/15 dark:text-accent-light";
      btn.textContent = "Yeni hobi önerisi için geri bildirimi forma ekle";
      btn.addEventListener("click", () => {
        pendingProgramFeedback = buildProgramFeedbackForApi(currentPlan, loadProgress());
        const marker = "\n\n--- Program geri bildirimi (otomatik) ---\n";
        const block = `${marker}${pendingProgramFeedback}`;
        const cur = interestsEl.value.trim();
        const next = cur.includes(marker) ? cur : `${cur}${block}`.slice(0, 2000);
        interestsEl.value = next;
        showOnboarding();
        onboardingSection?.scrollIntoView({ behavior: "smooth", block: "start" });
        interestsEl?.focus();
      });
      journeyInsightActions.appendChild(btn);
    } else if (insight.path === "specialize") {
      const hint = document.createElement("p");
      hint.className = "text-xs text-ink-600 dark:text-slate-400";
      hint.textContent =
        "Tüm görevleri bitirince burada ileri seviye veya farklı yön için tek tıkla yeni plan seçenekleri çıkar.";
      journeyInsightActions.appendChild(hint);
    }
  }
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

function externalLinkOrSpan(url, text) {
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
      const span = document.createElement("span");
      span.className = "font-medium text-ink-800 dark:text-slate-200";
      span.textContent = a.textContent;
      a.replaceWith(span);
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
      titleRow.appendChild(externalLinkOrSpan(b.url, String(b.title || "—")));
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
      titleRow.appendChild(externalLinkOrSpan(v.url, String(v.title || "—")));
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
      titleRow.appendChild(externalLinkOrSpan(c.url, String(c.name || "—")));
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
    let addedSequentialHint = false;
    sorted.forEach((w, wi) => {
      const wnRaw = Number(w.weekNumber);
      const wn = Number.isFinite(wnRaw) ? wnRaw : wi + 1;
      if (trackingOn && progress && progress.hobby === hobby && !addedSequentialHint) {
        const seqHint = document.createElement("p");
        seqHint.className =
          "mb-4 rounded-xl border border-violet-200/70 bg-violet-50/60 px-3 py-2 text-xs font-medium leading-relaxed text-ink-700 dark:border-midnight-600 dark:bg-midnight-800/60 dark:text-slate-300";
        seqHint.innerHTML =
          '<i class="fa-solid fa-route mr-1.5 text-accent dark:text-accent-light" aria-hidden="true"></i><strong>Sıralı akış:</strong> Önce 1. haftayı tamamla; ardından 2., 3. ve 4. hafta sırayla açılır. Kilidi açılmayan haftanın görevleri gizlenir.';
        resultWeeksEl.appendChild(seqHint);
        addedSequentialHint = true;
      }

      const card = document.createElement("div");
      card.className =
        "rounded-2xl border-2 border-violet-200/70 bg-white p-5 dark:border-midnight-600 dark:bg-midnight-800/90";
      const title = document.createElement("p");
      title.className =
        "mb-3 font-display text-base font-semibold text-accent-dark dark:text-accent-light";
      title.textContent = `${Number.isFinite(wnRaw) ? w.weekNumber : wn}. hafta`;
      card.appendChild(title);

      const seqLocked =
        Boolean(trackingOn && progress && progress.hobby === hobby) &&
        !isWeekUnlocked(sorted, progress, wi);

      if (seqLocked) {
        card.classList.add("border-dashed", "opacity-95");
        const prevIdx = Math.max(0, wi - 1);
        const prevWn = resolveWeekNumber(sorted[prevIdx], prevIdx);
        const lock = document.createElement("p");
        lock.className =
          "flex items-start gap-2 text-sm font-medium leading-relaxed text-ink-600 dark:text-slate-400";
        lock.innerHTML = `<i class="fa-solid fa-lock mt-0.5 shrink-0 text-accent dark:text-accent-light" aria-hidden="true"></i><span>Bu hafta kilitli. Görmek ve işaretlemek için önce <strong>${prevWn}. haftadaki</strong> tüm görevleri tamamla.</span>`;
        card.appendChild(lock);
        resultWeeksEl.appendChild(card);
        return;
      }

      if (w.learningObjective) {
        const obj = document.createElement("p");
        obj.className =
          "mb-3 text-sm font-medium leading-relaxed text-ink-800 dark:text-slate-200";
        obj.textContent = String(w.learningObjective);
        card.appendChild(obj);
      }
      const ul = document.createElement("ul");
      ul.className =
        trackingOn && progress && progress.hobby === hobby
          ? "list-none space-y-2 text-sm text-ink-800 dark:text-slate-200"
          : "list-inside list-disc space-y-2 text-sm text-ink-800 dark:text-slate-200";
      const tasks = Array.isArray(w.tasks) ? w.tasks : [];
      tasks.forEach((t, idx) => {
        if (trackingOn && progress && progress.hobby === hobby) {
          const li = document.createElement("li");
          const label = document.createElement("label");
          label.className =
            "flex cursor-pointer items-start gap-3 rounded-lg py-0.5 transition hover:bg-violet-50/80 dark:hover:bg-midnight-800/50";
          const cb = document.createElement("input");
          cb.type = "checkbox";
          cb.className =
            "hb-task-check mt-0.5 h-4 w-4 shrink-0 rounded border-violet-300 text-accent focus:ring-accent dark:border-midnight-500 dark:bg-midnight-900";
          cb.checked = Boolean(progress.tasks[`${wn}:${idx}`]);
          const span = document.createElement("span");
          span.textContent = String(t);
          span.className = cb.checked
            ? "text-ink-500 line-through dark:text-slate-500"
            : "text-ink-800 dark:text-slate-200";
          cb.addEventListener("change", () => {
            if (!currentPlan) return;
            setTaskDone(currentPlan, hobby, wn, idx, cb.checked);
            span.className = cb.checked
              ? "text-ink-500 line-through dark:text-slate-500"
              : "text-ink-800 dark:text-slate-200";
            updateProgramChrome();
          });
          label.appendChild(cb);
          label.appendChild(span);
          li.appendChild(label);
          ul.appendChild(li);
        } else {
          const li = document.createElement("li");
          li.textContent = String(t);
          ul.appendChild(li);
        }
      });
      card.appendChild(ul);

      const resWeek = Array.isArray(w.resourcesThisWeek) ? w.resourcesThisWeek : [];
      if (resWeek.length) {
        const resWrap = document.createElement("div");
        resWrap.className =
          "mt-4 space-y-3 rounded-xl border border-violet-200/60 bg-violet-50/40 p-4 dark:border-midnight-600 dark:bg-midnight-900/50";
        const resHeading = document.createElement("p");
        resHeading.className =
          "text-xs font-bold uppercase tracking-wide text-accent-dark dark:text-accent-light";
        resHeading.textContent = "Bu haftanın kaynakları";
        resWrap.appendChild(resHeading);
        resWeek.forEach((r) => {
          const row = document.createElement("div");
          row.className = "text-sm";
          const top = document.createElement("div");
          top.className = "flex flex-wrap items-baseline gap-2";
          const kind = document.createElement("span");
          kind.className =
            "inline-block rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-dark dark:text-accent-light";
          kind.textContent = String(r.kind || "link");
          top.appendChild(kind);
          top.appendChild(externalLinkOrSpan(r.url, String(r.title || "Bağlantı")));
          row.appendChild(top);
          if (r.note) {
            const note = document.createElement("p");
            note.className = "mt-1 text-xs text-ink-600 dark:text-slate-400";
            note.textContent = String(r.note);
            row.appendChild(note);
          }
          resWrap.appendChild(row);
        });
        card.appendChild(resWrap);
      }

      appendOptionalWeekPulse(card, wn, hobby, trackingOn);
      resultWeeksEl.appendChild(card);
    });
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
        shopRow.appendChild(externalLinkOrSpan(m.url, "Mağazada görüntüle"));
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

initInterestSuggestions();
initTheme();
initLoadingMotion();
tryRestoreLastPlan();
themeToggle?.addEventListener("click", toggleTheme);

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
    resultJourneyWrap?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
});

startProgramBtn?.addEventListener("click", () => {
  const hobby = resultsSection?.dataset.activeHobby?.trim();
  if (!hobby || !currentPlan) return;
  commitProgram(hobby);
  initProgressForHobby(hobby);
  renderPlan(currentPlan);
  resultJourneyWrap?.scrollIntoView({ behavior: "smooth", block: "start" });
});

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
