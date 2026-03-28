# 📝 PRD (Product Requirement Document): HobbyBuddy AI

## 1. Ürün Vizyonu
HobbyBuddy AI, günümüzün "hobisizleşme" sorununa karşı; kullanıcıların bütçe, zaman ve ilgi alanlarına göre onlara özel, sürdürülebilir bir hobi deneyimi sunan yapay zeka tabanlı bir rehberdir.

## 2. Hedef Kitle
* Yeni bir uğraş arayan ama nereden başlayacağını bilmeyen üniversite öğrencileri ve çalışanlar.
* Kısıtlı bütçesi olan veya vaktini verimli kullanmak isteyen bireyler.
* Somut bir ilerleme takibi ve yapılandırılmış bir plan isteyen kullanıcılar.

## 3. Kullanıcı Akışı (User Flow)
1. **Giriş:** Kullanıcı temiz ve modern bir arayüzle karşılanır.
2. **Input:** İlgi alanları, haftalık ayırabileceği saat ve aylık bütçe bilgilerini girer.
3. **Analiz:** Gemini AI, bu verileri işleyerek en uygun hobi eşleşmesini yapar.
4. **Çıktı:** Kullanıcıya 4 haftalık adım adım plan, gerekli malzeme listesi ve AI analiz raporu sunulur.

## 4. Temel Özellikler (Features)
* **AI Hobi Eşleştirme:** Kullanıcı verilerine dayalı nokta atışı hobi önerisi.
* **4 Haftalık Yol Haritası:** Her hafta için spesifik görevler içeren yapılandırılmış rehber.
* **Akıllı Malzeme Asistanı:** Belirlenen bütçeyi aşmayan, temel ihtiyaç listesi.
* **Gelişim Analiz Raporu:** Kullanıcının bu hobide neden başarılı olabileceğine dair AI tarafından hazırlanan motivasyonel rapor.

## 5. Teknik Gereksinimler (Tech Stack)
* **Frontend:** HTML, CSS, JavaScript.
* **AI Entegrasyonu:** Google AI Studio üzerinden **Gemini API**.
* **Yayınlama (Deploy):** **Vercel**.
* **Versiyon Kontrol:** **GitHub**.

## 6. Başarı Kriterleri (MVP)
* Formun sorunsuz çalışması ve verilerin AI'ya iletilmesi.
* AI'nın 30 saniye içinde tutarlı bir 4 haftalık plan üretmesi.
* Uygulamanın mobil uyumlu (responsive) bir tasarıma sahip olması.
