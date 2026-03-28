# 📝 PRD (Product Requirement Document): HobbyBuddy AI

## 1. Ürün Vizyonu
HobbyBuddy AI, günümüzün "hobisizleşme" sorununa karşı; kullanıcıların bütçe, zaman ve ilgi alanlarına göre onlara özel, sürdürülebilir bir hobi deneyimi sunan yapay zeka tabanlı bir rehberdir.

## 2. Hedef Kitle
* Yeni bir uğraş arayan ama nereden başlayacağını bilmeyen üniversite öğrencileri ve çalışanlar.
* Kısıtlı bütçesi olan veya vaktini verimli kullanmak isteyen bireyler.
* Somut bir ilerleme takibi ve yapılandırılmış bir plan isteyen kullanıcılar.

## 3. Kullanıcı Akışı (User Flow)
1. **Giriş:** Kullanıcı arayüzle karşılanır.
2. **Input:** İlgi alanları, haftalık süre, aylık bütçe (doğrulamalı form).
3. **Analiz:** Sunucu üzerinden Gemini; yapılandırılmış plan (hobi seçenekleri, önerilen hobi, 4 hafta, kaynaklar, malzemeler, yolculuk rehberi).
4. **Çıktı:** Plan, malzemeler ve rehber metni; isteğe bağlı hobi kartı ile aynı profille yeniden plan.
5. **Program (yolculuk):** Kullanıcı programı başlatır; haftalar sırayla açılır, görevler ve isteğe bağlı anket yerelde tutulur. Yol tamamlanınca ileri seviye veya farklı yön için yeni analiz istenebilir.

## 4. Temel Özellikler (Features)
* **AI Hobi Eşleştirme:** İlgi, süre ve bütçeye göre hobi seçenekleri ve varsayılan öneri.
* **4 Haftalık Yol Haritası:** Haftalık görevler ve haftalık kaynak linkleri (sunucu tarafı URL dürüstlük kuralları).
* **Akıllı Malzeme Asistanı:** Bütçe bağlamında malzeme listesi (tahmini tutar notları).
* **Yolculuk rehberi:** `journeyReflectionGuide` — süreç / öz-değerlendirme çerçevesi (kesin teşhis iddiası taşımaz).
* **Program takibi:** Sıralı hafta kilidi, görev tamamlama, isteğe bağlı mini anket (ölçek + serbest yorum), yerel özet; yol sonu yeni plan tetikleyicileri.
* **Bağlantı doğrulama:** Sonuç linklerinde isteğe bağlı sunucu kontrolü.

## 5. Teknik Gereksinimler (Tech Stack)
* **Frontend:** HTML, CSS, JavaScript.
* **AI Entegrasyonu:** Google AI Studio üzerinden **Gemini API**.
* **Yayınlama (Deploy):** **Vercel**.
* **Versiyon Kontrol:** **GitHub**.

## 6. Başarı Kriterleri (MVP)
* Formun sorunsuz çalışması ve verilerin güvenli API katmanına iletilmesi.
* Tutarlı 4 haftalık plan ve malzeme çıktısı (yanıt süresi ağ/model ile değişebilir; istemde ~55 sn hedef zaman aşımı).
* Mobil uyumlu (responsive) arayüz.
* Program modunda sıralı hafta ve yerel takibin çalışması; yol sonunda yeni plan isteğinin mümkün olması.
