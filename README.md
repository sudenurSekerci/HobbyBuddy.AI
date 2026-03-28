# HobbyBuddy.AI

HobbyBuddy AI: Hobisizleşme sorununa karşı yapay zeka destekli, kişiselleştirilmiş 4 haftalık yol haritası ve bütçe dostu malzeme asistanı.

#AIBuildathon

## Bu proje nasıl çalışıyor? (Faz 2 özeti)

1. **Tarayıcı** yalnızca form verisini sunucuya gönderir. **Google Gemini API anahtarı asla istemciye gitmez.**
2. **Vercel Serverless** fonksiyonu `api/analyze.js` ortam değişkeninden `GEMINI_API_KEY` okur, Gemini’ye yapılandırılmış JSON (şema) ile istek atar.
3. Dönen plan (önerilen hobi, 4 hafta, malzemeler, analiz) JSON olarak parse edilir ve sayfada gösterilir.

Yerelde yalnızca `npx serve .` çalıştırırsan `/api/analyze` yolu olmadığı için istek başarısız olur; aşağıdaki **Vercel CLI** adımını kullan.

## Proje yapısı

| Yol | Açıklama |
|-----|----------|
| `index.html` | Arayüz |
| `css/custom.css` | Yardımcı stiller |
| `js/app.js` | Form, tema, `/api/analyze` çağrısı, sonuç render |
| `api/analyze.js` | Gemini proxy (sunucu tarafı) |
| `vercel.json` | Sunucu fonksiyonu süre limiti (ücretli planda daha uzun) |
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

- Varsayılan model `api/analyze.js` içinde `gemini-2.0-flash`. Erişim hatası alırsan aynı dosyada `MODEL` değerini örneğin `gemini-1.5-flash` yapmayı dene.
- Vercel **Hobby** planda sunucu fonksiyonu süresi kısıtlı olabilir; yavaş yanıtta zaman aşımı yaşanırsa plan yükseltme veya daha hızlı model kullanma gerekebilir.

## Sadece statik önizleme (API olmadan)

```bash
npx --yes serve .
```

Bu modda **AI çağrısı çalışmaz**; yalnızca arayüzü kontrol etmek içindir.

## Git

İlk kurulumda depo yoksa: `git init`. `.gitignore` API anahtarları ve `node_modules` için yapılandırılmıştır.
