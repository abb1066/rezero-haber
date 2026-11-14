# Haber işi (Re:Zero Takip)

Bu depo 3 saatte bir Re:Zero haberlerini toplar. Haberleri açık kaynak OPUS-MT modeliyle Türkçeye çevirir ve **`veri` dalındaki** `haberler.json` dosyasına yazar. Site (https://re-zero-takip.web.app) haberleri bu dosyadan okur.

- `main` dalında yalnızca kod var.
- `veri` dalını iş kendisi oluşturur ve günceller; elle değiştirme.

- **Ücret:** Yok. GitHub Actions herkese açık depoda ücretsiz.
- **Bağlantı:** Google ya da Firebase hesabı gerekmez.
- **Anahtar:** Depoda gizli bilgi yok.

## Kurulum (bir kez)
1. Depo **herkese açık** olmalı: **Settings → General → Danger Zone → Change visibility → Make public**. Site dosyayı ancak böyle okuyabilir.
2. **Actions** sekmesinde iş akışları kapalıysa "I understand my workflows, go ahead and enable them" ile aç.
3. İlk deneme: **Actions → haber → Run workflow** (Kuru çalıştırma işaretli) → **Run**.
   - İlk seferde modeller indirildiği için 5–10 dakika sürer.
   - Bitince "node is.mjs yaz --kuru" adımında çeviriler görünür; dosyaya yazılmaz.
4. Çeviriler iyiyse **Run workflow** ile bir kez de **Kuru çalıştırma işaretini kaldırarak** çalıştır:
   - İş `veri` dalına `haberler.json`'u yazar ve "Haberler güncellendi" diye kaydeder.
   - Sonra her 3 saatte bir kendiliğinden çalışır.

## Notlar
- **60 gün kuralı:** GitHub, 60 gün hiç commit olmayan depolarda zamanlanmış işleri durdurur. Haber geldikçe iş kendisi commit attığı için bu genelde olmaz; olursa Actions sekmesinden yeniden aç.
- **Gecikme:** Site dosyayı en fazla birkaç dakika gecikmeyle görür (GitHub önbelleği).
- **Kod güncellemesi:** Kod sitenin deposundaki `firebase-site/haber-is` klasöründen gelir (`git subtree split` → bu depo `main`). Elle değiştirme; bir sonraki gönderimde üzerine yazılır. `haberler.json` ve `atla.json` yalnızca `veri` dalında, iş tarafından yazılır.
