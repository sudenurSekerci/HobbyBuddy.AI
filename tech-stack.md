# HobbyBuddy AI — Tech Stack

Projede kullanılan teknolojiler ve rolleri.

---

## Özet tablo

| Teknoloji | Rol |
|-----------|-----|
| **HTML** | Tek sayfa yapı, anlamsal bölgeler, form ve sonuç alanları |
| **Tailwind CSS** | CDN üzerinden utility-first düzen (koyu tema) |
| **CSS** | `custom.css` ile ek yardımcı stiller |
| **JavaScript (ES modül)** | `app.js`: form, `/api/analyze` ve `/api/verify-urls`, sonuç, program ve rozet UI |
| **JavaScript** | `program-tracking.js`: yerel depolama (son plan, form özeti, görev/anket ilerlemesi), özet metinleri |
| **Gemini API** | Yapılandırılmış JSON plan üretimi (`api/analyze.js`) |
| **Cursor** | Geliştirme ortamı |
| **Vercel** | Statik site + `api/*` serverless; `GEMINI_API_KEY` vb. ortam değişkenleri |

---

## Katmanlar

### İstemci (tarayıcı)

- **HTML + Tailwind + vanilla JS** — Tek sayfa; giriş, sonuç, program (yolculuk) modu; haftalık sihirbaz, rozet çekmecesi ve rozet bildirimi için `custom.css` animasyonları.
- API anahtarı tarayıcıda yok; istekler `api/analyze` ve `api/verify-urls` üzerinden gider.
- **localStorage** — Son plan, form özeti, aktif program, görev/anket durumu ve rozet ilerlemesi (sunucuya yazılmaz).

### Yapay zeka

- **Google Gemini API** — Google AI Studio üzerinden anahtar; metin üretimi ve yapılandırılmış yanıt için prompt tasarımı.

### Barındırma ve araçlar

- **Vercel** — Deploy, HTTPS, preview URL’leri; `GEMINI_API_KEY` gibi sırlar yalnızca Vercel Environment Variables içinde.
- **Cursor** — IDE; repo kökündeki `tasks.md`, `user-flow.md`, `tech-stack.md` ile süreç takibi.

---

## Versiyon kontrol

- **GitHub** (PRD ile uyumlu) — Kaynak kod, iş birliği ve Vercel entegrasyonu için önerilir.

---

## Güvenlik notu

Gemini API anahtarını yalnızca sunucu ortamında (ör. Vercel Serverless Function) kullan; istemci tarafı `.env` sızıntılarına karşı public repoda anahtar tutma.
