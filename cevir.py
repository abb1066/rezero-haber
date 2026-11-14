# Re:Zero haber çevirisi (P15, kullanıcı 2026-11-14): Claude yerine ücretsiz, açık kaynak OPUS-MT modelleri (Helsinki-NLP).
# GitHub Actions'ta CPU'da çalışır; metin hiçbir dış servise gönderilmez (model yalnızca Hugging Face'ten indirilir, önbelleğe alınır).
#   İngilizce → Türkçe: Helsinki-NLP/opus-mt-tc-big-en-tr (CC-BY 4.0)
#   Japonca  → İngilizce → Türkçe: Helsinki-NLP/opus-mt-ja-en (Apache 2.0) + yukarıdaki
# Kullanım: python cevir.py is/adaylar.json is/ceviri.json
# Çıktı: { "<id>": {"baslik": "...", "ozet": "..."} }. Bir dil yolunda hata olursa o haberler çıktıya girmez (sonraki turda yeniden denenir).
import json
import sys

MODELLER = {
    "en-tr": "Helsinki-NLP/opus-mt-tc-big-en-tr",
    "ja-en": "Helsinki-NLP/opus-mt-ja-en",
}
_yuklu = {}


def yukle(ad):
    if ad not in _yuklu:
        from transformers import MarianMTModel, MarianTokenizer
        tok = MarianTokenizer.from_pretrained(MODELLER[ad])
        mod = MarianMTModel.from_pretrained(MODELLER[ad])
        mod.eval()
        _yuklu[ad] = (tok, mod)
    return _yuklu[ad]


def cevir(metinler, ad):
    """Boş metinler boş döner; diğerleri 8'erli gruplar hâlinde çevrilir."""
    import torch
    dolu = [(i, m) for i, m in enumerate(metinler) if m and m.strip()]
    sonuc = [""] * len(metinler)
    if not dolu:
        return sonuc
    tok, mod = yukle(ad)
    with torch.no_grad():
        for b in range(0, len(dolu), 8):
            parca = dolu[b:b + 8]
            girdi = tok([m for _, m in parca], return_tensors="pt", padding=True, truncation=True, max_length=256)
            cikti = mod.generate(**girdi, num_beams=4, max_new_tokens=220)
            for (i, _), t in zip(parca, tok.batch_decode(cikti, skip_special_tokens=True)):
                sonuc[i] = t.strip()
    return sonuc


def main(giris, cikis):
    with open(giris, encoding="utf-8") as f:
        adaylar = json.load(f)
    sonuc = {}
    for dil in ("en", "ja"):
        grup = [a for a in adaylar if a.get("dil") == dil]
        if not grup:
            continue
        metin = []
        for a in grup:
            metin += [a.get("baslik", ""), a.get("ozetKaynak", "")]
        try:
            if dil == "ja":
                metin = cevir(metin, "ja-en")
            tr = cevir(metin, "en-tr")
        except Exception as e:  # bir yol bozulursa öteki dil yine yazılsın
            print("çeviri hatası (" + dil + "): " + repr(e), file=sys.stderr)
            continue
        for k, a in enumerate(grup):
            sonuc[a["id"]] = {"baslik": tr[2 * k], "ozet": tr[2 * k + 1]}
            print("[" + dil + "] " + a.get("baslik", "")[:80] + "\n   -> " + tr[2 * k][:120])
    with open(cikis, "w", encoding="utf-8") as f:
        json.dump(sonuc, f, ensure_ascii=False, indent=1)
    print("çevrilen: " + str(len(sonuc)) + "/" + str(len(adaylar)))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "is/adaylar.json", sys.argv[2] if len(sys.argv) > 2 else "is/ceviri.json")
