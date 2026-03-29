/**
 * Vercel Serverless: Gemini çağrısı. GEMINI_API_KEY yalnızca ortam değişkeninden okunur.
 * Yerelde: proje kökünde `npx vercel dev` ( .env otomatik yüklenir ).
 */

/**
 * systemInstruction + generationConfig.responseMimeType/responseSchema yalnızca v1beta JSON’da desteklenir;
 * v1 bu alanları reddeder ("Unknown name systemInstruction" vb.).
 * @see https://ai.google.dev/api/rest/v1beta/models/generateContent
 */
const GEMINI_API_VERSION = process.env.GEMINI_API_VERSION || "v1beta";
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

/**
 * Şema mümkün olduğunca sade: Gemini, minItems/maxItems ve uzun açıklamalarla iç içe
 * dizilerde "too many states" hatası verebiliyor. Sayı ve içerik kuralları userPrompt'ta.
 */
const RESOURCE_ITEM = {
  type: "OBJECT",
  properties: {
    kind: { type: "STRING" },
    title: { type: "STRING" },
    url: { type: "STRING" },
    note: { type: "STRING" },
  },
  required: ["kind", "title", "url", "note"],
};

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    hobbyOptions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          howItMatchesUser: { type: "STRING" },
          oneLineTeaser: { type: "STRING" },
        },
        required: ["name", "howItMatchesUser", "oneLineTeaser"],
      },
    },
    recommendedHobby: { type: "STRING" },
    weeks: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          weekNumber: { type: "INTEGER" },
          learningObjective: { type: "STRING" },
          tasks: { type: "ARRAY", items: { type: "STRING" } },
          resourcesThisWeek: { type: "ARRAY", items: RESOURCE_ITEM },
        },
        required: ["weekNumber", "learningObjective", "tasks", "resourcesThisWeek"],
      },
    },
    learningResources: {
      type: "OBJECT",
      properties: {
        books: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              title: { type: "STRING" },
              author: { type: "STRING" },
              url: { type: "STRING" },
              whyRelevant: { type: "STRING" },
            },
            required: ["title", "url", "whyRelevant"],
          },
        },
        youtubeVideos: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              title: { type: "STRING" },
              channelName: { type: "STRING" },
              url: { type: "STRING" },
              whyRelevant: { type: "STRING" },
            },
            required: ["title", "url", "whyRelevant"],
          },
        },
        onlineCommunities: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              name: { type: "STRING" },
              platform: { type: "STRING" },
              url: { type: "STRING" },
              howToJoin: { type: "STRING" },
            },
            required: ["name", "platform", "url", "howToJoin"],
          },
        },
      },
      required: ["books", "youtubeVideos", "onlineCommunities"],
    },
    materials: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          approxCostTry: { type: "NUMBER" },
          notes: { type: "STRING" },
          url: { type: "STRING" },
          retailerHint: { type: "STRING" },
        },
        required: ["name", "approxCostTry", "url"],
      },
    },
    materialsTotalEstimateTry: { type: "NUMBER" },
    journeyReflectionGuide: { type: "STRING" },
    budgetComplianceNote: { type: "STRING" },
  },
  required: [
    "hobbyOptions",
    "recommendedHobby",
    "weeks",
    "learningResources",
    "materials",
    "materialsTotalEstimateTry",
    "journeyReflectionGuide",
    "budgetComplianceNote",
  ],
};

function badRequest(res, message) {
  res.status(400).json({ error: message });
}

function clampStr(s, max) {
  return String(s ?? "").slice(0, max);
}

/** Kitapyurdu /kitap/{slug}/{sayı}.html çoğu zaman yanlış ürüne gider (model uydurur). Aramaya çevir. */
function isKitapyurduNumericProductPath(urlStr) {
  try {
    const u = new URL(String(urlStr));
    const h = u.hostname.replace(/^www\./i, "").toLowerCase();
    if (!h.endsWith("kitapyurdu.com")) return false;
    return /\/kitap\/[^/]+\/\d+(?:\.html)?\/?$/i.test(u.pathname);
  } catch {
    return false;
  }
}

function kitapyurduSearchUrl(title, author) {
  const q = [title, author].filter(Boolean).join(" ").trim() || String(title || "kitap").trim();
  return `https://www.kitapyurdu.com/index.php?route=product/search&search=${encodeURIComponent(q)}`;
}

function rewriteSuspectProductUrls(plan) {
  if (!plan || typeof plan !== "object") return;

  const fixBook = (item) => {
    if (!item?.url || !item?.title) return;
    if (isKitapyurduNumericProductPath(item.url)) {
      item.url = kitapyurduSearchUrl(item.title, item.author);
    }
  };

  const books = plan.learningResources?.books;
  if (Array.isArray(books)) {
    books.forEach(fixBook);
  }

  const weeks = plan.weeks;
  if (Array.isArray(weeks)) {
    weeks.forEach((w) => {
      const arr = w?.resourcesThisWeek;
      if (!Array.isArray(arr)) return;
      arr.forEach((r) => {
        if (!r?.url || !r?.title) return;
        const k = String(r.kind || "").toLowerCase();
        if (k === "book" && isKitapyurduNumericProductPath(r.url)) {
          r.url = kitapyurduSearchUrl(r.title, "");
        }
      });
    });
  }

  const mats = plan.materials;
  if (Array.isArray(mats)) {
    mats.forEach((m) => {
      if (!m?.url || !m?.name) return;
      if (isKitapyurduNumericProductPath(m.url)) {
        m.url = kitapyurduSearchUrl(m.name, m.retailerHint || "");
      }
    });
  }
}

function googleSearchUrl(query) {
  const q = String(query ?? "")
    .trim()
    .slice(0, 280);
  return `https://www.google.com/search?q=${encodeURIComponent(q || "hobi")}`;
}

function youtubeSearchUrl(query) {
  const q = String(query ?? "")
    .trim()
    .slice(0, 180);
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q || "video")}`;
}

/** Uydurma watch linklerini ele: yalnızca geçerli video ID veya zaten arama sayfası. */
function normalizeYoutubeUrl(url, title, channelName) {
  const q = [title, channelName].filter(Boolean).join(" ").trim() || String(title || "video").trim();
  const raw = String(url ?? "").trim();
  if (!raw) return youtubeSearchUrl(q);
  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    if (host === "youtu.be") {
      const id = u.pathname.replace(/^\//, "").split(/[/?&#]/)[0];
      if (/^[a-zA-Z0-9_-]{11}$/.test(id)) return raw;
      return youtubeSearchUrl(q);
    }
    if (host === "youtube.com" || host === "m.youtube.com") {
      if (u.pathname.startsWith("/results")) return raw;
      if (u.pathname.startsWith("/watch")) {
        const v = u.searchParams.get("v");
        if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return raw;
        return youtubeSearchUrl(q);
      }
      if (u.pathname.startsWith("/shorts/")) {
        const id = (u.pathname.split("/")[2] || "").split("?")[0];
        if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) return raw;
        return youtubeSearchUrl(q);
      }
      return youtubeSearchUrl(q);
    }
  } catch {
    /* fallthrough */
  }
  return youtubeSearchUrl(q);
}

function normalizeBookUrl(url, title, author) {
  const t = String(title || "kitap").trim();
  const a = String(author || "").trim();
  const raw = String(url ?? "").trim();
  if (!raw) return kitapyurduSearchUrl(t, a);
  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    if (host.endsWith("goodreads.com") && u.pathname.includes("/book/show")) {
      return `https://www.goodreads.com/search?q=${encodeURIComponent(`${t} ${a}`.trim())}`;
    }
    if (host.endsWith("goodreads.com") && u.pathname.includes("/search")) return raw;
    if (host.endsWith("kitapyurdu.com")) {
      if (u.searchParams.get("route") === "product/search" || u.pathname.includes("/search")) return raw;
      if (isKitapyurduNumericProductPath(raw)) return kitapyurduSearchUrl(t, a);
      return kitapyurduSearchUrl(t, a);
    }
    if (host.includes("amazon.") && (u.pathname.includes("/dp/") || u.pathname.includes("/gp/product"))) {
      return googleSearchUrl(`${t} ${a} kitap`.trim());
    }
    const q = u.searchParams.get("q") || u.searchParams.get("search");
    if (q || raw.includes("route=product/search") || u.pathname.includes("/search")) return raw;
  } catch {
    /* fallthrough */
  }
  return googleSearchUrl(`${t} ${a} kitap`.trim());
}

function normalizeRetailUrl(url, name, retailerHint) {
  const q = [name, retailerHint].filter(Boolean).join(" ").trim() || String(name || "ürün").trim();
  const fallback = googleSearchUrl(`${q} satın al`);
  const raw = String(url ?? "").trim();
  if (!raw) return fallback;
  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    if (host.includes("trendyol.com")) {
      if (u.pathname.startsWith("/sr")) return raw;
      return `https://www.trendyol.com/sr?q=${encodeURIComponent(q.slice(0, 120))}`;
    }
    if (host.includes("hepsiburada.com")) {
      if (u.pathname.includes("/ara")) return raw;
      return `https://www.hepsiburada.com/ara?q=${encodeURIComponent(q.slice(0, 120))}`;
    }
    if (host.includes("amazon.com.tr") || host === "amazon.tr") {
      if (u.pathname.startsWith("/s") && u.searchParams.has("k")) return raw;
      return `https://www.amazon.com.tr/s?k=${encodeURIComponent(q.slice(0, 120))}`;
    }
    if (host.endsWith("n11.com")) {
      if (u.search.includes("q=") || u.search.includes("searchText")) return raw;
      return `https://www.n11.com/arama?q=${encodeURIComponent(q.slice(0, 120))}`;
    }
    if (host.endsWith("kitapyurdu.com")) {
      if (u.searchParams.get("route") === "product/search" || u.pathname.includes("/search")) return raw;
      if (isKitapyurduNumericProductPath(raw)) return kitapyurduSearchUrl(name, retailerHint);
      return kitapyurduSearchUrl(name, retailerHint);
    }
  } catch {
    /* fallthrough */
  }
  return fallback;
}

function normalizeCommunityUrl(url, name, platform) {
  const raw = String(url ?? "").trim();
  const label = [name, platform].filter(Boolean).join(" ").trim() || String(name || "topluluk");
  const fallback = googleSearchUrl(`${label} forum topluluk`);
  if (!raw) return fallback;
  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    if (host === "reddit.com" || host.endsWith(".reddit.com")) {
      const pathOnly = u.pathname.split("?")[0];
      if (/^\/r\/[A-Za-z0-9_]+\/?$/.test(pathOnly)) return raw;
      return `https://www.reddit.com/search/?q=${encodeURIComponent(label.slice(0, 120))}`;
    }
    if (host === "discord.gg" && u.pathname.length > 2) return raw;
    if (host === "discord.com" && u.pathname.startsWith("/invite/")) return raw;
  } catch {
    /* fallthrough */
  }
  return fallback;
}

function normalizeArticleUrl(url, title) {
  const t = String(title || "makale").trim();
  const raw = String(url ?? "").trim();
  if (!raw) return googleSearchUrl(t);
  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    if (host === "medium.com" || host.endsWith(".medium.com")) return raw;
    if (host.endsWith("wikipedia.org")) return raw;
  } catch {
    /* fallthrough */
  }
  return googleSearchUrl(t);
}

/**
 * Model çıktısındaki şüpheli / uydurma URL'leri arama ve güvenilir kalıplara çevirir.
 */
function sanitizePlanUrls(plan) {
  if (!plan || typeof plan !== "object") return;

  const books = plan.learningResources?.books;
  if (Array.isArray(books)) {
    books.forEach((b) => {
      if (!b || typeof b !== "object") return;
      b.url = normalizeBookUrl(b.url, b.title, b.author);
    });
  }

  const vids = plan.learningResources?.youtubeVideos;
  if (Array.isArray(vids)) {
    vids.forEach((v) => {
      if (!v || typeof v !== "object") return;
      v.url = normalizeYoutubeUrl(v.url, v.title, v.channelName);
    });
  }

  const comms = plan.learningResources?.onlineCommunities;
  if (Array.isArray(comms)) {
    comms.forEach((c) => {
      if (!c || typeof c !== "object") return;
      c.url = normalizeCommunityUrl(c.url, c.name, c.platform);
    });
  }

  const weeks = plan.weeks;
  if (Array.isArray(weeks)) {
    weeks.forEach((w) => {
      const arr = w?.resourcesThisWeek;
      if (!Array.isArray(arr)) return;
      arr.forEach((r) => {
        if (!r || typeof r !== "object" || !r.url) return;
        const k = String(r.kind || "").toLowerCase();
        if (k === "video" || k === "youtube") {
          r.url = normalizeYoutubeUrl(r.url, r.title, "");
        } else if (k === "book") {
          r.url = normalizeBookUrl(r.url, r.title, "");
        } else if (k === "community") {
          r.url = normalizeCommunityUrl(r.url, r.title, r.note || "");
        } else if (k === "article") {
          r.url = normalizeArticleUrl(r.url, r.title);
        } else {
          r.url = googleSearchUrl(r.title || r.note || "kaynak");
        }
      });
    });
  }

  const mats = plan.materials;
  if (Array.isArray(mats)) {
    mats.forEach((m) => {
      if (!m || typeof m !== "object") return;
      m.url = normalizeRetailUrl(m.url, m.name, m.retailerHint);
    });
  }
}

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    res.status(405).json({ error: "Yalnızca POST desteklenir." });
    return;
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key || !String(key).trim()) {
    res.status(503).json({
      error: "Sunucuda API anahtarı tanımlı değil. .env veya Vercel ortam değişkeni GEMINI_API_KEY ekleyin.",
    });
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      badRequest(res, "Geçersiz JSON gövdesi.");
      return;
    }
  }

  const interests = clampStr(body?.interests, 2000);
  const weeklyHours = Number(body?.weeklyHours);
  const monthlyBudget = Number(body?.monthlyBudget);
  const chosenHobby = clampStr(body?.chosenHobby, 160).trim();
  const programFeedback = clampStr(body?.programFeedback, 1500).trim();
  const jcRaw = clampStr(body?.journeyContinuation, 16).trim().toLowerCase();
  const journeyContinuation = jcRaw === "advance" || jcRaw === "pivot" ? jcRaw : "";

  if (!interests.trim()) {
    badRequest(res, "İlgi alanları gerekli.");
    return;
  }
  if (!Number.isFinite(weeklyHours) || weeklyHours < 0.5 || weeklyHours > 80) {
    badRequest(res, "Haftalık süre 0,5–80 saat arasında olmalı.");
    return;
  }
  if (!Number.isFinite(monthlyBudget) || monthlyBudget < 0 || monthlyBudget > 500000) {
    badRequest(res, "Aylık bütçe 0–500000 ₺ arasında olmalı.");
    return;
  }

  const userPayload = {
    interests,
    weeklyHoursAvailable: weeklyHours,
    monthlyBudgetTRY: monthlyBudget,
  };
  if (chosenHobby) {
    userPayload.chosenHobby = chosenHobby;
  }
  if (programFeedback) {
    userPayload.previousFourWeekProgramFeedback = programFeedback;
  }
  if (journeyContinuation) {
    userPayload.journeyContinuation = journeyContinuation;
  }
  const userJson = JSON.stringify(userPayload, null, 0);

  const systemInstruction = `Sen HobbyBuddy AI adında bir hobi koçusun. Bağlantılar tıklanınca çalışmalı; uydurma URL verme.

KRİTİK — URL dürstlüğü (bunlara uy; sunucu sonra yine de güvenli arama URL'lerine çevirir):
- YouTube: Doğrudan watch?v= veya kısa youtu.be linki VERME (çoğu uydurmadır). Başlık + kanal adına göre arama sayfası kullan: https://www.youtube.com/results?search_query= (sorgu URL-encode).
- Kitap: Ürün detay veya /book/show/... gibi spesifik yol verme. Kitapyurdu için: index.php?route=product/search&search= kitap adı ve yazar. İstersen goodreads.com/search?q=
- Malzeme (TR e-ticaret): Ürün ID'li /dp/... yolu verme. trendyol.com/sr?q= veya hepsiburada.com/ara?q= veya amazon.com.tr/s?k= gibi site içi ARAMA URL'si; sorguda ürün adı.
- Topluluk: Şüpheliyse reddit.com/search/?q= veya google.com/search?q= reddit + konu. Discord için yalnızca gerçek davet linki formatında emin değilsen arama.
- Makale: Bilinçsiz alan adı uydurma; emin değilsen google.com/search?q= başlık.

Genel: https; journeyReflectionGuide analiz iddiası taşımasın; süreç rehberliği ver. Yanıt yalnızca JSON şeması, Türkçe.`;

  const selectionRule = chosenHobby
    ? `Kullanıcı "${chosenHobby}" hobisini seçti. recommendedHobby metni bu string ile karakter olarak birebir aynı olmalı. hobbyOptions içinde bu tam name ile bir öğe olmalı; ilk öğe seçilen hobi olsun, ardından 2–3 farklı alternatif (kullanıcı ilgilerinden). weeks, learningResources ve materials yalnızca seçilen hobi için.`
    : `Kullanıcı henüz hobi seçmedi. hobbyOptions ile 3–4 somut, birbirinden farklı hobi öner; hepsi kullanıcının ilgi metnine dayansın. recommendedHobby, bu seçeneklerden birinin name alanı ile karakter dizisi olarak birebir aynı olsun (modelin en mantıklı bulduğu varsayılan).`;

  const feedbackRule = programFeedback
    ? `Kullanıcıda previousFourWeekProgramFeedback alanı var: dört haftalık takip / görev, isteğe bağlı anket (1–5 ve serbest metin yorumlar). Hobileri ve 4 haftalık planı bu geri bildirimi dikkate alarak uyumlu ve destekleyici şekilde yeniden çerçevele; kullanıcıyı yargılama.`
    : "";

  const journeyRule =
    journeyContinuation === "advance"
      ? `ÖNEMLİ — journeyContinuation=advance: Kullanıcı aynı hobide önceki dört haftalık programı TAMAMLADI ve İLERİ SEVİYE yeni dört hafta istiyor. weeks içindeki görevler başlangıç planına göre belirgin şekilde daha ileri teknik, proje veya derin pratik içermeli (tekrar eden “başlangıç” görevlerinden kaçın). journeyReflectionGuide bu yeni aşamaya uygun olsun.`
      : journeyContinuation === "pivot"
        ? `ÖNEMLİ — journeyContinuation=pivot: Kullanıcı önceki dört haftalık deneyimi tamamladı ve FARKLI bir hobi veya belirgin farklı bir alt yön denemek istiyor. recommendedHobby, önceki seçilen hobiden anlamlı şekilde farklı veya farklı bir alt dal olmalı; hobbyOptions ilk öğede bu yeni yön, diğerleri kullanıcı ilgilerine yakın alternatifler.`
        : "";

  const userPrompt = `Kullanıcı verisi (JSON): ${userJson}

${selectionRule}
${feedbackRule ? `\n${feedbackRule}\n` : ""}
${journeyRule ? `\n${journeyRule}\n` : ""}

Kurallar (öncelik: hobiyi gerçekten başlatmak). Şemada uzunluk sabitlenmediği için sayıları kesin tut:
- hobbyOptions: tam 3 veya 4 öğe. Her biri name, howItMatchesUser, oneLineTeaser.
- recommendedHobby: hobbyOptions[].name değerlerinden biriyle tam eşleşmeli.
- weeks: tam 4 öğe; weekNumber sırayla 1,2,3,4. Her hafta learningObjective; tasks içinde 3–6 somut görev; resourcesThisWeek içinde en az 2 kaynak (kind: book|video|community|article; title, url, note).
- learningResources.books: en az 3; her kitap url'si arama (kitap adı + yazar). youtubeVideos: en az 4; her biri youtube.com/results?search_query= (video başlığı ± kanal). onlineCommunities: en az 3; mümkünse reddit arama veya google arama; şüpheli sabit sayfa URL'si verme.
- materials: url zorunlu; site içi arama URL'si (ürün adı sorguda), ürün ID'li yol yok.
- materialsTotalEstimateTry ve budgetComplianceNote: monthlyBudgetTRY ile uyumlu.
- journeyReflectionGuide: dört haftalık süreç + son hafta öz-değerlendirme çerçevesi; destekleyici ton, kesin hüküm yok.`;

  const url = `https://generativelanguage.googleapis.com/${GEMINI_API_VERSION}/models/${MODEL}:generateContent`;

  const payload = {
    systemInstruction: {
      parts: [{ text: systemInstruction }],
    },
    contents: [
      {
        role: "user",
        parts: [{ text: userPrompt }],
      },
    ],
    generationConfig: {
      temperature: 0.42,
      maxOutputTokens: 12_288,
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
    },
  };

  try {
    const geminiRes = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify(payload),
    });

    const rawText = await geminiRes.text();
    let geminiJson;
    try {
      geminiJson = JSON.parse(rawText);
    } catch {
      res.status(502).json({ error: "Model yanıtı işlenemedi." });
      return;
    }

    if (!geminiRes.ok) {
      const msg =
        geminiJson?.error?.message ||
        (geminiRes.status === 429 ? "Çok fazla istek. Biraz sonra tekrar dene." : "Model isteği başarısız.");
      res.status(geminiRes.status >= 400 && geminiRes.status < 600 ? geminiRes.status : 502).json({
        error: msg,
      });
      return;
    }

    const text =
      geminiJson?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";

    if (!text.trim()) {
      const reason = geminiJson?.candidates?.[0]?.finishReason;
      res.status(502).json({
        error: reason ? `Yanıt üretilemedi (${reason}).` : "Model boş yanıt döndü.",
      });
      return;
    }

    let plan;
    try {
      plan = JSON.parse(text);
    } catch {
      res.status(502).json({ error: "Model geçerli JSON üretmedi." });
      return;
    }

    rewriteSuspectProductUrls(plan);
    sanitizePlanUrls(plan);

    res.status(200).json({ plan });
  } catch (err) {
    console.error("analyze error", err);
    res.status(500).json({ error: "Sunucu hatası. Lütfen tekrar dene." });
  }
};
