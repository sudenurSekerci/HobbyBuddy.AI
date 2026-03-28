# HobbyBuddy AI — Geliştirme Görev Listesi


## Faz 0 — Proje ve altyapı

- [ ] **0.1** Git deposu oluştur; `.gitignore` (API anahtarları, `node_modules` vb.) ekle.
- [ ] **0.2** Proje klasör yapısını netleştir (ör. `index.html`, `css/`, `js/`, `README` içinde kurulum notları).
- [ ] **0.3** Google AI Studio’da Gemini API anahtarı al; **yalnızca ortam değişkeni veya Vercel env** ile kullan (istemciye gömme).

---

## Faz 1 — Arayüz (PRD: Giriş + Input)

- [ ] **1.1** Temiz, modern bir giriş ekranı ve ana sayfa iskeleti (HTML).
- [ ] **1.2** Kullanıcı girdi formu: ilgi alanları, haftalık ayırılabilir saat, aylık bütçe (doğrulama + boş alan kontrolü).
- [ ] **1.3** Temel stil ve tipografi (CSS); mobil öncelikli düzen başlangıcı.

---

## Faz 2 — AI entegrasyonu (PRD: Analiz)

- [ ] **2.1** Gemini API çağrısı için güvenli katman: tercihen **sunucusuz fonksiyon** (Vercel Serverless) veya proxy; API anahtarının tarayıcıda görünmemesi.
- [ ] **2.2** Form verilerini JSON olarak modele uygun prompt’a dönüştür.
- [ ] **2.3** Prompt tasarımı: tek yanıtta **(a)** önerilen hobi, **(b)** 4 haftalık hafta bazlı görevler, **(c)** bütçe dahilinde malzeme listesi, **(d)** gelişim / motivasyon analizi — mümkünse **yapılandırılmış çıktı** (JSON şeması veya net bölüm başlıkları) ile parse kolaylığı.

---

## Faz 3 — Çıktı (PRD: Çıktı özellikleri)

- [ ] **3.1** 4 haftalık yol haritasını okunaklı bileşenlerde göster (hafta → görevler).
- [ ] **3.2** Malzeme listesini bütçe bağlamıyla sun (PRD: bütçeyi aşmama vurgusu).
- [ ] **3.3** AI gelişim analiz raporunu ayrı bölümde göster.
- [ ] **3.4** Yükleme durumu, hata mesajları ve zaman aşımı (hedef: ~30 sn içinde tutarlı yanıt; gerekirse kullanıcıya bilgi).

---

## Faz 4 — Kalite ve MVP başarı kriterleri

- [ ] **4.1** **Responsive:** Telefon ve masaüstünde form + sonuç düzeni testi.
- [ ] **4.2** Form → API akışının uçtan uca testi; boş/yanlış girdi senaryoları.
- [ ] **4.3** Yanıt süresi ve tutarlılık gözlemi; prompt / model ayarı ile iyileştirme.
- [ ] **4.4** Erişilebilirlik temelleri: etiketler, kontrast, odak sırası.

---

## Faz 5 — Yayınlama (PRD: Vercel + GitHub)

- [ ] **5.1** GitHub’a push; Vercel’e bağla.
- [ ] **5.2** Production ortamında `GEMINI_API_KEY` (veya kullanılan isim) tanımla.
- [ ] **5.3** Canlı URL’de smoke test: form gönderimi ve sonuç ekranı.

---

## MVP kontrol listesi (PRD §6)

| Kriter | Görev referansı |
|--------|-----------------|
| Form sorunsuz; veriler AI katmanına iletilir | 1.2, 2.1–2.2 |
| ~30 sn içinde tutarlı 4 haftalık plan | 2.3, 3.1, 4.3 |
| Mobil uyumlu tasarım | 1.3, 4.1 |

---

## Notlar

- Teknik yığın PRD ile uyumlu: **HTML, CSS, JavaScript**; AI **Gemini**; deploy **Vercel**; sürüm kontrol **GitHub**.
- İleride eklenebilecekler (MVP dışı): kullanıcı hesabı, plan geçmişi, çoklu dil, offline önbellek.
