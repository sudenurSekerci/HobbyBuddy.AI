# HobbyBuddy AI — Tech Stack

Projede kullanılan teknolojiler ve rolleri.

---

## Özet tablo

| Teknoloji | Rol |
|-----------|-----|
| **HTML** | Sayfa yapısı, anlamsal iskelet, form ve sonuç bölgeleri |
| **CSS** | Görünüm, responsive düzen, tutarlı tipografi ve renk |
| **JavaScript** | Form doğrulama, API çağrısı (proxy üzerinden), DOM güncelleme, yükleme/hata durumları |
| **Gemini API** | Kullanıcı girdisine göre hobi önerisi, 4 haftalık plan, malzeme listesi ve analiz metni üretimi |
| **Cursor** | Geliştirme ortamı; kod yazma, refaktör ve proje içi dokümantasyon |
| **Vercel** | Statik site + serverless fonksiyonlar ile barındırma; ortam değişkenleri ile API anahtarı yönetimi |

---

## Katmanlar

### İstemci (tarayıcı)

- **HTML / CSS / JavaScript** — Tek sayfa veya birkaç sayfalı minimal frontend; PRD’deki giriş, form ve sonuç akışını karşılar.
- API anahtarı tarayıcıya konmaz; istekler sunucu tarafı uç noktaya gider.

### Yapay zeka

- **Google Gemini API** — Google AI Studio üzerinden anahtar; metin üretimi ve yapılandırılmış yanıt için prompt tasarımı.

### Barındırma ve araçlar

- **Vercel** — Deploy, HTTPS, preview URL’leri; `GEMINI_API_KEY` gibi sırlar yalnızca Vercel Environment Variables içinde.
- **Cursor** — IDE; repo içi `tasks.md`, `user-flow.md`, `tech-stack.md` ile süreç takibi.

---

## Versiyon kontrol

- **GitHub** (PRD ile uyumlu) — Kaynak kod, iş birliği ve Vercel entegrasyonu için önerilir.

---

## Güvenlik notu

Gemini API anahtarını yalnızca sunucu ortamında (ör. Vercel Serverless Function) kullan; istemci tarafı `.env` sızıntılarına karşı public repoda anahtar tutma.
