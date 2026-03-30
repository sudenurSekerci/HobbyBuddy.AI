
## Problem

İnsanlar iş, okul ve ekran yoğunluğu yüzünden hobiye zaman ayırmakta zorlanıyor; yeni bir şeye başlamak isteyen çoğu kişi “neyden, ne kadar bütçeyle, hangi sırayla?” sorularına net cevap bulamayınca vazgeçiyor. Genel liste önerileri de tek başına yetmiyor: bütçe, malzeme ve hafta hafta izlenebilir bir yol olmadan süreç çoğu zaman yarım kalıyor.

## Çözüm

**HobbyBuddy.AI** sana ilgi alanlarını, haftalık süreni ve bütçeni soruyor; **Google Gemini** ile buna uygun **4 haftalık bir plan** çıkarıyor: haftalık görevler, okuma/video gibi kaynaklar, malzeme fikirleri ve kısa bir yolculuk metni. Anahtar **sunucuda** kalıyor; tarayıcıya API sırrı gitmiyor.

Uygulama tarafında haftaları tek tek ilerletiyorsun: önce görevleri bitiriyorsun, sonra kısa bir “nabız” anketi var, ardından sıradaki hafta açılıyor. İstersen geçmiş haftalara geri bakabiliyorsun; tamamladıkça **rozet** kazanıyorsun. Dört hafta bittiğinde özet geliyor; istersen **aynı hobide ileri seviye** ya da **başka bir yöne** yeni plan isteyebiliyorsun.

## Canlı Demo

**Canlı site:** https://hobbybuddyai.vercel.app/ 

**Demo videosu:** https://youtu.be/7U_kriwfjc0

## Kullanılan Teknolojiler

- Sayfa ve arayüz: HTML, Tailwind (CDN), düz JavaScript — kod `features/` klasöründe
- Yapay zekâ: Google Gemini; istekler `api/analyze.js` üzerinden gidiyor
- Yayın: Vercel (site + sunucusuz `api` fonksiyonları)
- İlerleme: Tarayıcıda `localStorage`; ayrıntılı takip `program-tracking.js` içinde

## Nasıl Çalıştırılır?

### 1. Ne lazım?

- [Node.js](https://nodejs.org/) 18 veya üzeri
- [Google AI Studio](https://aistudio.google.com/)’dan aldığın **Gemini API anahtarı** — bunu koda yazma; sadece `.env` veya Vercel ayarlarında tut

### 2. Anahtarı yerel dosyaya koy

Kökteki `.env.example` dosyasını kopyalayıp `.env` yap ve doldur:

```env
GEMINI_API_KEY=buraya_anahtarın
```

### 3. Hem site hem API ile çalıştır

Projeyi bilgisayarında tam denemek için **Vercel’in geliştirme sunucusu** en pratik yol. Kök klasörde:

```bash
npx vercel login
npx vercel link
npx vercel env pull .env.local
npx vercel dev
```

Açılan adresi tarayıcıda aç (genelde `http://localhost:3000`). Formu dene; plan geliyorsa her şey yolunda.

*(Not: `vercel.json` sayesinde kök adres, `features/` içindeki arayüze yönleniyor; API yolları yine `/api/...` olarak çalışıyor.)*

### 4. Sadece ekranı görmek istersen (API yok)

```bash
npx --yes serve features
```

Burada yapay zekâ çağrısı olmaz; sadece sayfanın açılıp açılmadığını kontrol etmek için yeterli.

### 5. İnternete çıkarmak

1. Kodu GitHub’a gönder  
2. [Vercel](https://vercel.com)’e bağla  
3. Ortam değişkenlerine `GEMINI_API_KEY` ekle (Production ve gerekirse Preview için)

---

## Ek: Klasörler ne işe yarıyor?

| Yol | Ne var? |
|-----|---------|
| `features/` | `index.html`, stiller, JS, görseller — gördüğün arayüz |
| `api/` | Gemini ve link kontrolü — sunucuda çalışır |
| `vercel.json` | Yayın ve yönlendirme ayarları |
| `idea.md`, `user-flow.md`, `tech-stack.md`, … | Ürünü anlatan notlar (kökte) |

Varsayılan model `gemini-2.5-flash`; analiz isteği tarafında yaklaşık **55 saniye** zaman aşımı hedefleniyor. Daha fazla teknik ayrıntı için `tech-stack.md` dosyasına bakabilirsin.

`.env` gibi dosyalar `.gitignore` sayesinde repoya yanlışlıkla gitmez.
