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

  const systemInstruction = `Sen HobbyBuddy AI adında bir hobi koçusun. Kullanıcıya tıklanabilir ve güvenilir yönlendirme vermek zorundasın.

KRİTİK — URL dürstlüğü:
- Kitap, e-ticaret ürünü veya benzersiz ID içeren detay sayfası URL'sini ASLA tahmin etme veya uydurma. Slug + sayı (ör. kitapyurdu.com/kitap/.../10368.html) genelde yanlış ürüne gider.
- Kitap için: yalnızca arama sonucu URL'si kullan — örn. kitapyurdu.com index.php?route=product/search&search= ile kitap adı + yazar (URL-encode); veya goodreads.com/search?q= ; veya google.com/search?q= kitap adı yazar.
- Video: emin değilsen youtube.com/results?search_query=
- Malzeme (Trendyol, Hepsiburada, Amazon TR): uydurma /dp/ veya ürün ID'li yol kullanma; site içi arama URL'si veya google arama tercih et.
- Topluluk: gerçek subreddit/discord davet URL'si; emin değilsen arama URL'si.

Genel: https tercih; uydurma alan adı yok. journeyReflectionGuide analiz iddiası taşımasın; süreç rehberliği ver. Yanıt yalnızca JSON şeması, Türkçe.`;

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
- learningResources.books: en az 3; her kitap url'si mutlaka ARAMA sayfası olsun (kitap adı + yazar sorgusu); kitapyurdu ürün detay yolu (/kitap/slug/sayı.html) YASAK — yanlış kitaba götürür. youtubeVideos: en az 4; doğrudan video veya arama URL. onlineCommunities: en az 3.
- materials: url zorunlu; ürün ID'si uydurma — arama veya kategori arama URL'si (ürün adı sorguda).
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
      temperature: 0.55,
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

    res.status(200).json({ plan });
  } catch (err) {
    console.error("analyze error", err);
    res.status(500).json({ error: "Sunucu hatası. Lütfen tekrar dene." });
  }
};
