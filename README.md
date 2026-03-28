# HobbyBuddy.AI

HobbyBuddy AI: Hobisizleşme sorununa karşı yapay zeka destekli, kişiselleştirilmiş 4 haftalık yol haritası ve bütçe dostu malzeme asistanı.

#AIBuildathon

## Bu proje nasıl çalışıyor?

1. **Tarayıcı** formu ve (isteğe bağlı) program takip verisini kullanır; **Gemini API anahtarı istemciye gelmez.**
2. **`api/analyze.js`** — `GEMINI_API_KEY` ile Gemini’ye yapılandırılmış JSON (şema) isteği; yanıtta hobi seçenekleri, 4 hafta, kaynaklar, malzemeler ve yolculuk rehberi metni üretilir. İsteğe bağlı gövde alanları: önceki program özeti (`programFeedback`), yol sonrası istek (`journeyContinuation`: `advance` | `pivot`).
3. **`api/verify-urls.js`** — Sonuçtaki dış bağlantılar için sunucudan HEAD/GET kontrolü (ölü linkleri metne çevirmek için).
4. **Ön yüz** — `js/app.js` + `js/program-tracking.js`: son plan ve form özeti `localStorage`’da saklanır; kullanıcı “Programı başlat” ile 4 haftayı **sırayla** açılan görevler, isteğe bağlı mini anket (1–5 + serbest yorum), basit puan/özet ve yol **%100 bitince** “ileri seviye plan” / “farklı hobi yönü” ile yeni analiz isteğini yönetir.

Yerelde yalnızca `npx serve .` kullanırsan `/api/*` olmadığı için AI ve link doğrulama çalışmaz; **`npx vercel dev`** kullan.

## Proje yapısı

| Yol | Açıklama |
|-----|----------|
| `index.html` | Arayüz (Tailwind CDN, tek sayfa) |
| `css/custom.css` | Yardımcı stiller |
| `js/app.js` | Form, tema, API çağrıları, sonuç ve program modu UI |
| `js/program-tracking.js` | Yerel takip: görevler, anket, özet, API geri bildirim metni |
| `api/analyze.js` | Gemini proxy |
| `api/verify-urls.js` | Dış URL doğrulama |
| `vercel.json` | Sunucu fonksiyonu süre limiti vb. |
| `.env.example` | Ortam değişkeni şablonu |

## Kurulum (adım adım)

### 1) Google AI Studio — API anahtarı

1. [Google AI Studio](https://aistudio.google.com/) → **Get API key** ile anahtar oluştur.
2. Anahtarı **kaynak koda yazma**; yalnızca `.env` veya Vercel panelinde sakla.

### 2) Yerel ortam değişkeni

Proje kökünde `.env.example` dosyasını `.env` olarak kopyala ve doldur:

```env
GEMINI_API_KEY=buraya_anahtarın
```

`.gitignore` içinde `.env` zaten var; commit edilmez.

### 3) Yerelde hem site hem API: Vercel CLI

[Vercel CLI](https://vercel.com/docs/cli) yüklü olmalı (`npm i -g vercel` veya `npx vercel`).

Proje klasöründe:

```bash
npx vercel login
npx vercel link
npx vercel env pull .env.local
```

İlk kez bağlıyorsan `vercel link` sırasında projeyi oluştur veya mevcut repoyu seç. Sonra `.env` içindeki `GEMINI_API_KEY` ile uyumlu olması için Vercel panosundan da env ekleyebilir veya yerelde `.env` kullanabilirsin.

Geliştirme sunucusu (statik dosyalar + `api/*`):

```bash
npx vercel dev
```

Tarayıcıda CLI’nin verdiği adresi aç (genelde `http://localhost:3000`). Formu gönder; yükleme sonrası plan gelmeli.

### 4) Canlıya alma (Vercel)

1. Kodu GitHub’a pushla.
2. [Vercel](https://vercel.com)’de projeyi import et.
3. **Settings → Environment Variables** içine `GEMINI_API_KEY` ekle (Production / Preview).
4. Deploy sonrası sitede duman testi: form gönder → plan görünsün.

### 5) Model / süre notları

- Gemini çağrısı **REST v1beta** (yapılandırılmış JSON + `systemInstruction`). Varsayılan model `gemini-2.5-flash`. İstersen `GEMINI_MODEL` / `GEMINI_API_VERSION` ile override et.
- İstemci tarafında analiz isteği için hedef zaman aşımı yaklaşık **55 sn** (zengin JSON yanıtları için); ağ veya model yavaşsa tekrar denemek gerekebilir.
- Vercel **Hobby** planda sunucu fonksiyonu süresi kısıtlı olabilir; üretimde süre/limitleri kontrol et.

## Sadece statik önizleme (API olmadan)

```bash
npx --yes serve .
```

Bu modda **AI çağrısı çalışmaz**; yalnızca arayüzü kontrol etmek içindir.

## Git

İlk kurulumda depo yoksa: `git init`. `.gitignore` API anahtarları ve `node_modules` için yapılandırılmıştır.
