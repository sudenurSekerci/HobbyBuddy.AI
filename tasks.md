# HobbyBuddy AI — Görev / durum notları

Bu dosya eski faz bazlı “yapılacaklar” listesinin yerini alır: **tamamlanan işler silindi**, aşağıda **şu anki sistem** ve isteğe bağlı iyileştirme başlıkları var.

---

## Şu anki sistem (özet)

- **Giriş:** İlgi alanları, haftalık süre, aylık bütçe; doğrulama; ilgi öneri paneli.
- **Analiz:** `POST /api/analyze` — Gemini yapılandırılmış plan (hobi seçenekleri, önerilen hobi, 4 hafta, kaynaklar, malzemeler, yolculuk rehberi). Ek gövde: `programFeedback`, `journeyContinuation` (`advance` | `pivot`), `chosenHobby`.
- **Sonuç:** Hobi kartları arası geçişle yeniden plan; dış linkler için `POST /api/verify-urls`.
- **Program modu:** “Programı başlat” → yerel takip (`localStorage`): görev checkbox’ları, haftalar **sıralı kilit** (önceki hafta bitmeden sonrakiler açılmaz), isteğe bağlı haftalık anket (1–5 + serbest yorum), puan/özet kartı.
- **Yol tamamlanınca:** Özet + “İleri seviye 4 haftalık plan” / “Farklı hobi yönü” ile yeni analiz (program ve takip verisi sıfırlanır, yeni plan gelir).
- **Oturum:** Son plan + form özeti saklanır; sayfa yenilense sonuç ve (uyumluysa) program durumu geri yüklenir.

---

## İsteğe bağlı sonraki işler (backlog)

- Sunucu tarafı kullanıcı hesabı / senkron plan geçmişi (şu an tamamen yerel).
- Analiz özetini tamamen modele taşımak (şu an kural tabanlı özet + API’ye metin).
- Çoklu dil, paylaşım, yazdırma.

---

## Dokümantasyon

- Akış ve ürün özeti: `user-flow.md`, `pdr.md`, `idea.md`, `tech-stack.md`, `README.md`.
