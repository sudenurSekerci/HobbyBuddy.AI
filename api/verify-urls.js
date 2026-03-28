/**
 * Toplu URL kontrolü (HEAD → gerekirse GET). Yalnızca net ölü yanıtları false döner;
 * engellenen / zaman aşımı durumunda false dönmeyerek yanlış negatif azaltılır.
 */

function badRequest(res, message) {
  res.status(400).json({ error: message });
}

function clampUrls(urls) {
  if (!Array.isArray(urls)) return [];
  const out = [];
  const seen = new Set();
  for (const u of urls) {
    const s = String(u ?? "").trim().slice(0, 2048);
    if (!s || seen.has(s)) continue;
    seen.add(s);
    try {
      const parsed = new URL(s);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") continue;
      out.push(s);
      if (out.length >= 20) break;
    } catch {
      /* skip */
    }
  }
  return out;
}

async function probeUrl(urlStr) {
  const run = async (method, extraHeaders = {}) => {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 4500);
    try {
      const r = await fetch(urlStr, {
        method,
        signal: ac.signal,
        redirect: "follow",
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; HobbyBuddy-LinkCheck/1.0)",
          ...extraHeaders,
        },
      });
      clearTimeout(t);
      const s = r.status;
      if (s === 404 || s === 410) return false;
      if (s >= 200 && s < 400) return true;
      return null;
    } catch {
      clearTimeout(t);
      return null;
    }
  };

  let x = await run("HEAD");
  if (x === false) return false;
  if (x === true) return true;
  x = await run("GET", { Range: "bytes=0-0" });
  if (x === false) return false;
  if (x === true) return true;
  x = await run("GET");
  if (x === false) return false;
  if (x === true) return true;
  return null;
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

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      badRequest(res, "Geçersiz JSON gövdesi.");
      return;
    }
  }

  const list = clampUrls(body?.urls);
  if (!list.length) {
    badRequest(res, "urls dizisi gerekli (en az bir geçerli http/https URL).");
    return;
  }

  const CONCURRENCY = 5;
  const results = [];
  for (let i = 0; i < list.length; i += CONCURRENCY) {
    const chunk = list.slice(i, i + CONCURRENCY);
    const part = await Promise.all(
      chunk.map(async (url) => {
        const verdict = await probeUrl(url);
        return { url, ok: verdict !== false };
      })
    );
    results.push(...part);
  }

  res.status(200).json({ results });
};
