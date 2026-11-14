// Claude özetleyici (kullanıcı 2026-11-15: OPUS-MT Japonca haberlerde anlamsız çeviri verdi → "Claude'u bağlayalım"; 100 $ kredi).
// Her aday için Haiku 5.5: Re:Zero ile ilgili mi, Türkçe başlık, kendi sözcükleriyle kısa özet, kategori, olay kimliği (aynı olayı tek kartta birleştirmek için).
// Anahtar yalnızca GitHub deposunun gizli değişkeninde (ANTHROPIC_API_KEY); koda ve siteye girmez.
// Ret ya da kesik çıktı yazılmaz (sonraki turda yeniden). Kota/kredi/anahtar hatasında tur durur; yazılmayanlar sonraki turda yeniden denenir.
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod/v4"; // SDK'nın zodOutputFormat yardımcısı zod 4 şeması ister (3.25 paketinde zod/v4)
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

export const MODEL = "claude-haiku-5-5";
const Ozet = z.object({
  ilgili: z.boolean(),
  baslik: z.string(),
  ozet: z.string(),
  kategori: z.enum(["Anime", "Manga", "Light Novel", "Oyun", "Etkinlik"]),
  olay: z.string(),
});
const SISTEM = "Bir Türk Re:Zero hayran sitesi için haber editörüsün. Yalnızca verilen metindeki bilgiyi kullan; tahmin, söylenti ya da olmayan bilgi ekleme. Kaynağın cümlelerini kopyalamadan kendi sözcüklerinle yaz.";

export function istem(h) {
  return `Aşağıdaki haber ${h.kaynak} kaynağından (${h.dil === "ja" ? "Japonca" : "İngilizce"}). Re:Zero (Re:Zero kara Hajimeru Isekai Seikatsu) takip sitesi için:
- ilgili: Haber gerçekten Re:Zero serisi hakkında mı (yalnızca adı geçen bir listede değil)?
- baslik: Türkçe, en çok 90 karakter, haberin özü; özgün cümle, çeviri kokusu olmasın. Özel adları (kişi, etkinlik, mekân) yaygın Latin yazımıyla doğru yaz (ör. ラグーナテンボス = Laguna Ten Bosch), uydurma. Türkçe cümle düzeni: yalnızca ilk harf ve özel adlar büyük (Her Kelime Büyük yazma). Japon adlarını Batı sırasıyla yaz (Satomi Arai, Yusuke Kobayashi). Başlıkta ve özette Japonca karakter kullanma (展 = sergi).
- ozet: Türkçe 2-3 cümle, en çok 320 karakter; kaynağın cümlelerini kopyalama, kendi sözcüklerinle anlat; olmayan bilgi ekleme; spoiler (hikâye olayları) verme. Metin kısaysa yalnızca bilineni 1 cümleyle yaz; metnin kısa ya da eksik olduğunu, neyin belirtilmediğini ASLA söyleme. Yabancı terimleri Türkçeleştir (can badge = rozet, goods = ürün, acrylic stand = akrilik stand).
- kategori: Anime, Manga, Light Novel, Oyun, Etkinlik içinden en uygun tek değer. Mağaza, kafe, sergi, sahne, konser, iş birliği etkinliktir. Re:Zero resmî anime sitesinden gelen görsel, bölüm, yayın, ürün haberleri aksi açıkça yazmadıkça Anime'dir; Light Novel yalnızca roman/cilt/yazarın kitabıyla ilgiliyse.
- olay: Bu haberin anlattığı olayın kısa kimliği; küçük harf İngilizce, tireli, en çok 6 sözcük (ör. anime-season-5-announced, ln-volume-47-release). Aynı olayı anlatan başka kaynak aynı kimliği üretmeli.

Başlık: ${h.baslik}
Tarih: ${h.tarih || "bilinmiyor"}
Metin: ${String(h.metin || h.ozetKaynak || "(yok)").slice(0, 1200)}`;
}

// Talimata rağmen kalabilen pürüzler kesin temizlenir (kullanıcı 2026-11-15 kuru çalıştırma): iç not cümleleri ("kaynakta yer almıyor",
// "kısa olduğundan … bilinmektedir", "belirtilemiyor"), Japonca/Çince karakterler, fazla boşluk.
const IC_NOT = /(kaynakta (yer )?(almıyor|bulunmuyor|yok)|metin(in)? (kısa|eksik)|kısa kesil|kısa olduğundan|yalnızca bu duyuru bilin|belirtil(e)?mi(yor|ştir)|ayrıntı(lar(ı)?)? (verilmemiş|verilmedi|yer almıyor|bilinmiyor)|gövde metni)/i;
const CJK = /[\u3040-\u30ff\u3400-\u9fff\uff66-\uff9f]/g;
export function temizle(z) {
  const duz = x => String(x || "").replace(CJK, "").replace(/\s+([.,;:!?])/g, "$1").replace(/\s{2,}/g, " ").trim();
  const cumleler = duz(z.ozet).match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [];
  return { ...z, baslik: duz(z.baslik), ozet: cumleler.map(c => c.trim()).filter(c => c && !IC_NOT.test(c)).join(" ") };
}

async function bir(client, h) {
  const r = await client.messages.parse({
    model: MODEL, max_tokens: 2000,
    output_config: { effort: "low", format: zodOutputFormat(Ozet) },
    system: SISTEM,
    messages: [{ role: "user", content: istem(h) }],
  });
  if (r.stop_reason === "refusal" || r.stop_reason === "max_tokens") return null;
  return r.parsed_output || null;
}

// { ceviri: {id: {ilgili, baslik, ozet, kategori, olay, yz:true}}, tamam, durdu }
export async function claudeOzetle({ client, adaylar }) {
  const ceviri = {}; let tamam = 0, durdu = false;
  if (!client) return { ceviri, tamam, durdu };
  for (const h of adaylar) {
    try {
      const z = await bir(client, h);
      if (z) { ceviri[h.id] = { ...temizle(z), yz: true }; tamam++; }
    } catch (e) {
      if (e instanceof Anthropic.RateLimitError || e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError || (e instanceof Anthropic.BadRequestError && /credit|balance/i.test(e.message))) {
        console.error("Claude durdu: " + (e.status || "") + " " + String(e.message).slice(0, 160)); durdu = true; break;
      }
      console.error("Claude hata (sonraki turda yeniden): " + String(e && e.message || e).slice(0, 160));
    }
  }
  return { ceviri, tamam, durdu };
}
