/**
 * Vercel Serverless: Gemini çağrısı. GEMINI_API_KEY yalnızca ortam değişkeninden okunur.
 * Yerelde: proje kökünde `npx vercel dev` ( .env otomatik yüklenir ).
 */

/** Ücretsiz kotada 2.0-flash bazen "quota 0" verir; 1.5-flash genelde daha stabil. İstersen GEMINI_MODEL ile override et. */
const MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    recommendedHobby: {
      type: "STRING",
      description: "Kullanıcıya önerilen tek, somut hobi adı (Türkçe).",
    },
    weeks: {
      type: "ARRAY",
      description: "Tam 4 hafta; her hafta haftalık süreye uygun görevler.",
      items: {
        type: "OBJECT",
        properties: {
          weekNumber: { type: "INTEGER", description: "1–4" },
          tasks: {
            type: "ARRAY",
            items: { type: "STRING" },
            description: "O hafta için 3–6 adımlı, uygulanabilir görevler (Türkçe).",
          },
        },
        required: ["weekNumber", "tasks"],
      },
    },
    materials: {
      type: "ARRAY",
      description: "Bütçe dahilinde tahmini malzeme listesi (Türkçe).",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          approxCostTry: {
            type: "NUMBER",
            description: "Tahmini birim veya toplam ₺ (0 olabilir).",
          },
          notes: { type: "STRING", description: "İsteğe bağlı kısa not." },
        },
        required: ["name", "approxCostTry"],
      },
    },
    materialsTotalEstimateTry: {
      type: "NUMBER",
      description: "Malzemeler için kabaca toplam ₺ tahmini; aylık bütçeyi aşmamalı.",
    },
    developmentAnalysis: {
      type: "STRING",
      description: "Motivasyon ve gelişim odaklı kısa analiz (Türkçe, 2–5 paragraf ölçeğinde tek metin).",
    },
    budgetComplianceNote: {
      type: "STRING",
      description: "Bütçe ve süreyle uyum hakkında 1–2 cümle (Türkçe).",
    },
  },
  required: [
    "recommendedHobby",
    "weeks",
    "materials",
    "materialsTotalEstimateTry",
    "developmentAnalysis",
    "budgetComplianceNote",
  ],
};

function badRequest(res, message) {
  res.status(400).json({ error: message });
}

function clampStr(s, max) {
  return String(s ?? "").slice(0, max);
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

  const userJson = JSON.stringify(
    {
      interests,
      weeklyHoursAvailable: weeklyHours,
      monthlyBudgetTRY: monthlyBudget,
    },
    null,
    0
  );

  const systemInstruction = `Sen HobbyBuddy AI adında bir hobi koçusun. Kullanıcı verisine göre tek bir somut hobi öner, 4 haftalık uygulanabilir plan ve bütçe dahilinde malzeme listesi üret. Yanıtı yalnızca istenen JSON şemasına uygun üret; başka metin ekleme. Türkçe yaz.`;

  const userPrompt = `Kullanıcı verisi (JSON): ${userJson}

Kurallar:
- recommendedHobby: tek ve net bir hobi (ör. "Analog fotoğrafçılık", "Seramik mini vazo").
- weeks: tam 4 eleman; weekNumber 1,2,3,4; görevler haftalık süreye uygun olsun.
- materials: başlangıç için gerçekçi ürünler; approxCostTry tahmini ₺; toplam maliyet monthlyBudgetTRY değerini aşmasın (0 bütçede ücretsiz/eldeki malzemeler öner).
- materialsTotalEstimateTry: malzemelerin kabaca toplamı (₺).
- developmentAnalysis: kullanıcının bu hobide neden ilerleyebileceğine dair sıcak, motive edici analiz.
- budgetComplianceNote: bütçe ve süreyle uyumu tek cümlede özetle.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(key)}`;

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
      temperature: 0.7,
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
    },
  };

  try {
    const geminiRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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

    res.status(200).json({ plan });
  } catch (err) {
    console.error("analyze error", err);
    res.status(500).json({ error: "Sunucu hatası. Lütfen tekrar dene." });
  }
};
