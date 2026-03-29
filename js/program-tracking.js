/**
 * 4 haftalık program: görev tamamlama, isteğe bağlı haftalık nabız anketi,
 * basit gamification (XP, haftalık seri) ve kural tabanlı öneri özeti.
 */

export const LAST_PLAN_KEY = "hobbybuddy-last-plan";
export const PROGRESS_KEY = "hobbybuddy-program-progress";

const SCHEMA_V = 1;
const MAX_PULSE_COMMENT = 600;

/**
 * @param {unknown} plan
 * @returns {object | null}
 */
export function loadLastPlan() {
  try {
    const raw = localStorage.getItem(LAST_PLAN_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (!o || typeof o !== "object" || !o.plan || typeof o.plan !== "object") return null;
    return o;
  } catch {
    return null;
  }
}

/**
 * @param {object} plan
 */
/**
 * @param {object} plan
 * @param {{ interests?: string, weeklyHours?: string | number, monthlyBudget?: string | number } | null} [profile]
 */
export function persistLastPlan(plan, profile = null) {
  try {
    const payload = { v: SCHEMA_V, savedAt: Date.now(), plan };
    if (profile && typeof profile === "object") {
      payload.profile = {
        interests: String(profile.interests ?? "").slice(0, 2000),
        weeklyHours: profile.weeklyHours,
        monthlyBudget: profile.monthlyBudget,
      };
    }
    localStorage.setItem(LAST_PLAN_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

/**
 * @returns {{ interests: string, weeklyHours: string, monthlyBudget: string } | null}
 */
export function loadProfileSnapshot() {
  try {
    const pack = loadLastPlan();
    const p = pack?.profile;
    if (!p || typeof p !== "object") return null;
    return {
      interests: String(p.interests ?? ""),
      weeklyHours: String(p.weeklyHours ?? ""),
      monthlyBudget: String(p.monthlyBudget ?? ""),
    };
  } catch {
    return null;
  }
}

export function clearLastPlan() {
  try {
    localStorage.removeItem(LAST_PLAN_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * @returns {{ v: number, hobby: string, startedAt: number, tasks: Record<string, boolean>, weeklyPulse: Record<string, { enjoyment: number, effort: number, at: number, comment?: string }>, dismissedPulse: Record<string, boolean> } | null}
 */
export function loadProgress() {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (!o || o.v !== SCHEMA_V || typeof o.hobby !== "string") return null;
    if (!o.tasks || typeof o.tasks !== "object") o.tasks = {};
    if (!o.weeklyPulse || typeof o.weeklyPulse !== "object") o.weeklyPulse = {};
    if (!o.dismissedPulse || typeof o.dismissedPulse !== "object") o.dismissedPulse = {};
    return o;
  } catch {
    return null;
  }
}

function saveProgress(state) {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

/**
 * @param {string} hobby
 */
export function initProgressForHobby(hobby) {
  const h = String(hobby ?? "").trim();
  if (!h) return null;
  const existing = loadProgress();
  if (existing && existing.hobby === h) return existing;
  const fresh = {
    v: SCHEMA_V,
    hobby: h,
    startedAt: Date.now(),
    tasks: {},
    weeklyPulse: {},
    dismissedPulse: {},
  };
  saveProgress(fresh);
  return fresh;
}

export function clearProgress() {
  try {
    localStorage.removeItem(PROGRESS_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * @param {object} plan
 * @param {string} hobby
 * @param {number} weekNumber
 * @param {number} taskIndex
 * @param {boolean} done
 */
export function setTaskDone(_plan, hobby, weekNumber, taskIndex, done) {
  const h = String(hobby ?? "").trim();
  const p = loadProgress();
  if (!p || p.hobby !== h) return loadProgress();
  const key = `${weekNumber}:${taskIndex}`;
  if (done) p.tasks[key] = true;
  else delete p.tasks[key];
  saveProgress(p);
  return p;
}

function clampPulseComment(raw) {
  return String(raw ?? "")
    .trim()
    .slice(0, MAX_PULSE_COMMENT);
}

/**
 * @param {string} hobby
 * @param {number} weekNumber
 * @param {number} enjoyment 1–5
 * @param {number} effort 1–5
 * @param {string} [comment]
 */
export function saveWeeklyPulse(hobby, weekNumber, enjoyment, effort, comment) {
  const p = loadProgress();
  if (!p || p.hobby !== String(hobby ?? "").trim()) return;
  const wk = String(weekNumber);
  const c = clampPulseComment(comment);
  const next = {
    enjoyment: Math.min(5, Math.max(1, Math.round(enjoyment))),
    effort: Math.min(5, Math.max(1, Math.round(effort))),
    at: Date.now(),
  };
  if (c) next.comment = c;
  p.weeklyPulse[wk] = next;
  delete p.dismissedPulse[wk];
  saveProgress(p);
}

/**
 * @param {string} hobby
 * @param {number} weekNumber
 */
export function dismissWeeklyPulse(hobby, weekNumber) {
  const p = loadProgress();
  if (!p || p.hobby !== String(hobby ?? "").trim()) return;
  p.dismissedPulse[String(weekNumber)] = true;
  saveProgress(p);
}

/**
 * @param {object} plan
 * @param {object | null} progress
 */
/**
 * @param {object} w
 * @param {number} fallbackIndex 0-based
 */
export function resolveWeekNumber(w, fallbackIndex) {
  const wnRaw = Number(w?.weekNumber);
  return Number.isFinite(wnRaw) ? wnRaw : fallbackIndex + 1;
}

/**
 * @param {object[]} sortedWeeks
 * @param {object | null} progress
 * @param {number} weekIndex 0-based in sortedWeeks
 */
export function weekFullyComplete(sortedWeeks, progress, weekIndex) {
  const w = sortedWeeks[weekIndex];
  if (!w) return false;
  const wn = resolveWeekNumber(w, weekIndex);
  const list = Array.isArray(w.tasks) ? w.tasks : [];
  if (!list.length) return true;
  const tasksMap = progress?.tasks && typeof progress.tasks === "object" ? progress.tasks : {};
  return list.every((_, i) => Boolean(tasksMap[`${wn}:${i}`]));
}

/**
 * Önceki haftanın tüm görevleri bitmeden bu hafta açılmaz (sıralı akış).
 * @param {object[]} sortedWeeks
 * @param {object | null} progress
 * @param {number} weekIndex
 */
export function isWeekUnlocked(sortedWeeks, progress, weekIndex) {
  if (weekIndex <= 0) return true;
  for (let j = 0; j < weekIndex; j += 1) {
    if (!weekFullyComplete(sortedWeeks, progress, j)) return false;
  }
  return true;
}

export function getTaskCounts(plan, progress) {
  const weeks = Array.isArray(plan?.weeks) ? plan.weeks : [];
  let total = 0;
  let done = 0;
  const tasksMap = progress?.tasks && typeof progress.tasks === "object" ? progress.tasks : {};
  weeks.forEach((w, wi) => {
    const wn = resolveWeekNumber(w, wi);
    const list = Array.isArray(w.tasks) ? w.tasks : [];
    list.forEach((_, i) => {
      total += 1;
      if (tasksMap[`${wn}:${i}`]) done += 1;
    });
  });
  return { total, done };
}

/**
 * @param {object} plan
 * @param {object | null} progress
 */
export function isPathComplete(plan, progress) {
  const { total, done } = getTaskCounts(plan, progress);
  return total > 0 && done >= total;
}

/**
 * @param {object} plan
 * @param {object | null} progress
 */
export function getFocusWeekNumber(plan, progress) {
  const sorted = [...(Array.isArray(plan?.weeks) ? plan.weeks : [])].sort(
    (a, b) => (a.weekNumber || 0) - (b.weekNumber || 0)
  );
  if (!sorted.length) return 1;
  for (let i = 0; i < sorted.length; i += 1) {
    if (!isWeekUnlocked(sorted, progress, i)) {
      for (let j = 0; j < i; j += 1) {
        if (!weekFullyComplete(sorted, progress, j)) {
          return resolveWeekNumber(sorted[j], j);
        }
      }
      return resolveWeekNumber(sorted[i], i);
    }
    const wn = resolveWeekNumber(sorted[i], i);
    if (!weekFullyComplete(sorted, progress, i)) return wn;
  }
  return resolveWeekNumber(sorted[sorted.length - 1], sorted.length - 1);
}

/**
 * @param {object | null} progress
 * @returns {"positive" | "negative" | null}
 */
export function summarizePulseComments(progress) {
  const texts = Object.values(progress?.weeklyPulse || {})
    .map((p) => String(p?.comment || "").toLowerCase())
    .join(" ");
  if (!texts.trim()) return null;
  const neg = /(sıkıldım|sıkılıyorum|berbat|sevmedim|sevmiyorum|bırak|vazgeç|istemiyorum|zor geldi|çok zor|uyumsuz)/.test(
    texts
  );
  const pos = /(sevdim|harika|süper|devam|keyifli|bağlandım|mutlu|heyecan|seviyorum)/.test(texts);
  if (neg && !pos) return "negative";
  if (pos && !neg) return "positive";
  return null;
}

/**
 * @param {object} plan
 * @param {object | null} progress
 */
export function computeXpAndStreak(plan, progress) {
  const weeks = [...(Array.isArray(plan?.weeks) ? plan.weeks : [])].sort(
    (a, b) => (a.weekNumber || 0) - (b.weekNumber || 0)
  );
  const tasksMap = progress?.tasks && typeof progress.tasks === "object" ? progress.tasks : {};
  let xp = 0;
  let activeWeeks = 0;

  weeks.forEach((w, wi) => {
    const wn = resolveWeekNumber(w, wi);
    const list = Array.isArray(w.tasks) ? w.tasks : [];
    let weekDone = 0;
    list.forEach((_, i) => {
      if (tasksMap[`${wn}:${i}`]) {
        weekDone += 1;
        xp += 10;
      }
    });
    if (weekDone > 0) activeWeeks += 1;
    if (list.length > 0 && weekDone === list.length) xp += 30;
  });

  return { xp, activeWeeks };
}

/**
 * @param {number} xp
 */
export function xpTierLabelTr(xp) {
  if (xp < 50) return "Keşif";
  if (xp < 120) return "Ritim";
  return "Derinlemesine";
}

/**
 * @param {object} plan
 * @param {object | null} progress
 */
export function computeInsight(plan, progress) {
  const { total, done } = getTaskCounts(plan, progress);
  const rate = total > 0 ? done / total : 0;
  const pulses = Object.entries(progress?.weeklyPulse || {})
    .map(([w, p]) => ({
      week: Number(w),
      enjoyment: p?.enjoyment,
      effort: p?.effort,
    }))
    .filter((x) => Number.isFinite(x.enjoyment));

  let avgEnjoy = null;
  let avgEffort = null;
  if (pulses.length) {
    avgEnjoy = pulses.reduce((s, p) => s + p.enjoyment, 0) / pulses.length;
    avgEffort = pulses.reduce((s, p) => s + (p.effort ?? 0), 0) / pulses.length;
  }

  const commentTone = summarizePulseComments(progress);
  const complete = total > 0 && done >= total;

  let path = "neutral";
  if (total === 0) {
    path = "neutral";
  } else if (complete && commentTone === "negative") {
    path = "explore";
  } else if (complete && commentTone === "positive") {
    path = "specialize";
  } else if (rate >= 0.55 && (avgEnjoy == null || avgEnjoy >= 3.5)) {
    path = "specialize";
  } else if (rate >= 0.4 && avgEnjoy != null && avgEnjoy >= 4) {
    path = "specialize";
  } else if (rate < 0.32 || (avgEnjoy != null && avgEnjoy <= 2)) {
    path = "explore";
  } else if (avgEnjoy != null && avgEffort != null && avgEffort >= 4.5 && avgEnjoy <= 2.5) {
    path = "explore";
  }

  if (complete && path === "neutral" && avgEnjoy != null) {
    if (avgEnjoy < 3.25) path = "explore";
    else if (avgEnjoy > 3.75) path = "specialize";
  }

  return { path, rate, done, total, avgEnjoy, avgEffort, pulses, commentTone, complete };
}

/**
 * @param {object} insight
 * @param {string} hobby
 * @returns {{ title: string, body: string, bullets: string[] }}
 */
export function buildInsightCopy(insight, hobby) {
  const h = hobby || "bu hobi";
  const pct = insight.total ? Math.round(insight.rate * 100) : 0;
  const enjoyNote =
    insight.avgEnjoy != null
      ? ` İsteğe bağlı anket ortalamaların: keyif ${insight.avgEnjoy.toFixed(1)}/5.`
      : "";

  if (insight.path === "specialize") {
    return {
      title: "Bu hobi üzerinde derinleşmeye devam",
      body: `Tamamlanan görev oranın yaklaşık %${pct}.${enjoyNote} Verilerin, ${h} için bir sonraki aşama (ileri teknikler, proje veya topluluk) yolculuğuna devam etmenin mantıklı olduğunu gösteriyor.`,
      bullets: [
        "Bir sonraki 4 haftayı aynı hobi için daha zorlayıcı bir hedefle planlayabilirsin.",
        "Öğrenme kaynaklarından birini “haftalık sabit” yaparak ritmi koru.",
      ],
    };
  }
  if (insight.path === "explore") {
    return {
      title: "Yeni bir hobi yönü denemek için uygun bir dönem",
      body: `Tamamlanan görev oranın yaklaşık %${pct}.${enjoyNote} Bu, ilgi alanlarına daha yakın başka bir hobi veya alt dal ile denemeyi düşünebileceğin anlamına gelebilir; zorunluluk değil, seçenek.`,
      bullets: [
        "Başlangıç bilgilerinde ilgi alanını hafifçe güncelleyip yeni plan isteyebilirsin.",
        "İstersen aşağıdaki düğme geri bildirimini forma ekler; model daha uyumlu önerir.",
      ],
    };
  }
  return {
    title: "Takip özeti",
    body: `Tamamlanan görev oranın yaklaşık %${pct}.${enjoyNote} Haftalar sırayla açıldığı için önce bir haftayı bitirip sonrakine geçmen daha net bir ritim verir. İstersen haftalık kutuya kısa yorum yazarak (serbest metin) bir sonraki özetin daha sana özel olmasını sağlayabilirsin.`,
    bullets: [
      "Açık uçlu yorumlar, sadece 1–5 ortalamadan daha iyi yön gösterir.",
      "Keyif düşük haftalarda görevleri küçültmek tamamen normal.",
    ],
  };
}

/**
 * Dört haftalık görev listesi %100 tamamlandığında gösterilecek net sonuç metni.
 * @param {object} insight
 * @param {string} hobby
 */
export function buildCompletionInsightCopy(insight, hobby) {
  const h = hobby || "bu hobi";
  const pct = insight.total ? Math.round(insight.rate * 100) : 0;
  const enjoyNote =
    insight.avgEnjoy != null
      ? ` İsteğe bağlı anket ortalamaların: keyif ${insight.avgEnjoy.toFixed(1)}/5.`
      : "";
  const commentHint =
    insight.commentTone === "negative"
      ? " Serbest yorumlarında daha çok zorlandığın veya uyum sağlamadığın izlenimi var."
      : insight.commentTone === "positive"
        ? " Serbest yorumlarında genelde olumlu bir ton var."
        : "";

  let lean = "Metrik ve yorum özetin aşağıdaki birincil öneriyle uyumlu hale getirildi; istersen alternatif düğmeyi kullanabilirsin.";
  if (insight.path === "specialize") {
    lean = `${h} üzerinde üst seviye / derin proje rotasına devam etmek özetle uyumlu görünüyor.`;
  } else if (insight.path === "explore") {
    lean = `Benzer ilgi alanlarında farklı bir hobi veya alt dal denemek özetle daha uygun görünüyor.`;
  }

  return {
    title: "Yol tamam — özet ve önerilen adım",
    body: `Dört haftalık görev listeni tamamladın; tamamlanma yaklaşık %${pct}.${enjoyNote}${commentHint} ${lean}`,
    bullets: [
      "Aşağıda vurgulanan düğme, özetine göre birincil öneridir; diğeri isteğe bağlı alternatiftir.",
    ],
  };
}

/**
 * Tamamlanma sonrası birincil eylem (advance = aynı hobi ileri, pivot = farklı yön).
 * @param {object} insight computeInsight çıktısı
 */
export function getCompletionPrimaryAction(insight) {
  if (insight.path === "specialize") {
    return {
      primary: "advance",
      headline: "Önerimiz: aynı hobide bir üst seviyeye geç",
      detail:
        "Görev tamamlaman ve geri bildirim özeti, bu hobi üzerinde derinleşmeyi destekliyor. Ana düğmeyle ileri seviye dört haftalık plan iste.",
      secondaryLabel: "Yine de farklı bir hobi yönü dene",
    };
  }
  if (insight.path === "explore") {
    return {
      primary: "pivot",
      headline: "Önerimiz: yeni bir hobi veya belirgin farklı bir alt yön dene",
      detail:
        "Keyif, çaba veya yorum tonun benzer ilgi alanlarında başka bir denemeyi mantıklı gösteriyor. Ana düğmeyle farklı yön planı iste.",
      secondaryLabel: "Yine de aynı hobide ileri seviye plan iste",
    };
  }
  const ae = insight.avgEnjoy;
  if (ae != null && ae < 3.25) {
    return {
      primary: "pivot",
      headline: "Önerimiz: önce yön veya hobi çeşitlendirmesi",
      detail: `Ortalama keyif ${ae.toFixed(1)}/5; benzer ilgilere yakın farklı bir uğraş denemek genelde daha tatmin edici olur.`,
      secondaryLabel: "Yine de aynı hobide ileri seviye plan iste",
    };
  }
  if (ae != null && ae > 3.75) {
    return {
      primary: "advance",
      headline: "Önerimiz: aynı çizgide derinleş",
      detail: `Ortalama keyif ${ae.toFixed(1)}/5; ritmi korumak için ileri seviye dört haftalık plan uygun görünüyor.`,
      secondaryLabel: "Yine de farklı bir hobi yönü dene",
    };
  }
  return {
    primary: "pivot",
    headline: "Önerimiz: hafif yön değişikliği ile devam",
    detail:
      "Sinyaller net ayrışmıyor; yine de yeni bir alt yön denemek keşfi artırır. İkna olmazsan ileri seviye seçeneğine bakabilirsin.",
    secondaryLabel: "Yine de aynı hobide ileri seviye plan iste",
  };
}

/**
 * @param {object} plan
 * @param {object | null} progress
 * @returns {string}
 */
export function buildProgramFeedbackForApi(plan, progress) {
  const insight = computeInsight(plan, progress);
  const hobby = String(plan?.recommendedHobby ?? "").trim();
  const lines = [
    `Önceki odak hobi: ${hobby || "—"}.`,
    `Görev tamamlama: ${insight.done}/${insight.total} (yaklaşık %${insight.total ? Math.round(insight.rate * 100) : 0}).`,
    `Öneri eğilimi (istemci özeti): ${insight.path}.`,
  ];
  if (insight.avgEnjoy != null) {
    lines.push(`Anket ort. keyif: ${insight.avgEnjoy.toFixed(1)}/5.`);
  }
  if (insight.avgEffort != null) {
    lines.push(`Anket ort. çaba/zorluk: ${insight.avgEffort.toFixed(1)}/5.`);
  }
  if (insight.commentTone) {
    lines.push(`Serbest yorum tonu (kaba sınıflama): ${insight.commentTone}.`);
  }
  const notes = Object.entries(progress?.weeklyPulse || {})
    .map(([wk, p]) => {
      const c = String(p?.comment || "").trim();
      if (!c) return null;
      return `Hafta ${wk}: ${c.slice(0, 220)}${c.length > 220 ? "…" : ""}`;
    })
    .filter(Boolean);
  if (notes.length) {
    lines.push(`Kullanıcı haftalık serbest yorumları: ${notes.join(" | ")}`);
  }
  return lines.join(" ");
}

/**
 * Tamamlama sonrası tek seferlik API özeti (düğme akışları için).
 * @param {object} plan
 * @param {object | null} progress
 * @param {"advance" | "pivot"} intent
 */
export function buildJourneyContinuationFeedback(plan, progress, intent) {
  const base = buildProgramFeedbackForApi(plan, progress);
  const tag =
    intent === "advance"
      ? "Kullanıcı isteği: AYNI hobi için İLERİ SEVİYE yeni 4 haftalık yol haritası."
      : "Kullanıcı isteği: FARKLI hobi veya yön (önceki seçili hobiden ayrışan) yeni öneriler ve 4 haftalık plan.";
  return `${base} ${tag}`;
}
