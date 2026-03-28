const MIN_INTEREST_LENGTH = 8;
const WEEKLY_HOURS_MIN = 0.5;
const WEEKLY_HOURS_MAX = 80;
const BUDGET_MIN = 0;
const BUDGET_MAX = 500_000;

const THEME_KEY = "hobbybuddy-theme";
const ANALYZE_URL = "/api/analyze";
const REQUEST_TIMEOUT_MS = 32_000;

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
const resultHobbyEl = document.getElementById("result-hobby");
const resultWeeksEl = document.getElementById("result-weeks");
const resultMaterialsEl = document.getElementById("result-materials");
const resultMaterialsTotalEl = document.getElementById("result-materials-total");
const resultBudgetNoteEl = document.getElementById("result-budget-note");
const resultAnalysisEl = document.getElementById("result-analysis");

const errors = {
  interests: document.getElementById("interests-error"),
  weeklyHours: document.getElementById("weekly-hours-error"),
  monthlyBudget: document.getElementById("monthly-budget-error"),
};

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

function hideResults() {
  resultsSection?.classList.add("hidden");
}

function formatTry(n) {
  if (!Number.isFinite(n)) return "—";
  return `${n.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} ₺`;
}

function renderPlan(plan) {
  if (!plan || typeof plan !== "object") return;

  if (resultHobbyEl) {
    resultHobbyEl.textContent = String(plan.recommendedHobby || "—");
  }

  if (resultWeeksEl) {
    resultWeeksEl.textContent = "";
    const weeks = Array.isArray(plan.weeks) ? plan.weeks : [];
    const sorted = [...weeks].sort((a, b) => (a.weekNumber || 0) - (b.weekNumber || 0));
    sorted.forEach((w) => {
      const card = document.createElement("div");
      card.className =
        "rounded-2xl border border-ink-200/90 bg-white p-5 dark:border-ink-700 dark:bg-ink-900/40";
      const title = document.createElement("p");
      title.className =
        "mb-3 font-display text-base font-semibold text-accent-dark dark:text-accent-light";
      title.textContent = `${w.weekNumber ?? "?"}. hafta`;
      card.appendChild(title);
      const ul = document.createElement("ul");
      ul.className = "list-inside list-disc space-y-2 text-sm text-ink-700 dark:text-ink-200";
      const tasks = Array.isArray(w.tasks) ? w.tasks : [];
      tasks.forEach((t) => {
        const li = document.createElement("li");
        li.textContent = String(t);
        ul.appendChild(li);
      });
      card.appendChild(ul);
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
        "flex flex-col gap-1 rounded-xl border border-ink-100 bg-ink-50/50 px-4 py-3 dark:border-ink-700 dark:bg-ink-800/40 sm:flex-row sm:items-start sm:justify-between";
      const left = document.createElement("div");
      const name = document.createElement("p");
      name.className = "font-medium text-ink-900 dark:text-white";
      name.textContent = String(m.name || "—");
      left.appendChild(name);
      if (m.notes) {
        const note = document.createElement("p");
        note.className = "mt-1 text-xs text-ink-500 dark:text-ink-400";
        note.textContent = String(m.notes);
        left.appendChild(note);
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
    resultAnalysisEl.textContent = String(plan.developmentAnalysis || "");
  }

  resultsSection?.classList.remove("hidden");
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

function buildPayload() {
  return {
    interests: interestsEl.value.trim(),
    weeklyHours: normalizeNumber(weeklyHoursEl.value),
    monthlyBudget: normalizeNumber(monthlyBudgetEl.value),
  };
}

async function requestPlan(payload) {
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
      throw new Error("Sunucudan geçersiz yanıt alındı.");
    }
    if (!res.ok) {
      const msg = typeof data?.error === "string" ? data.error : "İstek başarısız oldu.";
      throw new Error(msg);
    }
    if (!data?.plan || typeof data.plan !== "object") {
      throw new Error("Plan verisi alınamadı.");
    }
    return data.plan;
  } finally {
    window.clearTimeout(t);
  }
}

initTheme();
initLoadingMotion();
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

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  successEl.classList.add("hidden");
  if (successMsgEl) successMsgEl.textContent = "";
  hideApiError();
  hideResults();

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
    renderPlan(plan);
    resultsSection?.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    const aborted = err?.name === "AbortError";
    const msg = aborted
      ? "İstek zaman aşımına uğradı (~30 sn). Bağlantını kontrol edip tekrar dene."
      : err instanceof Error
        ? err.message
        : "Beklenmeyen bir hata oluştu.";
    showApiError(msg);
  } finally {
    hideLoadingOverlay();
    submitBtn.disabled = false;
  }
});
