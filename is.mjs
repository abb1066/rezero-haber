// Re:Zero haber işi (P15, kullanıcı 2026-11-14: "çeviriyi Claude yerine ücretsiz opsiyonla yapamaz mıyız" → "Yap").
// GitHub Actions'ta 3 saatte bir (.github/workflows/haber.yml), ücretsiz: Firebase Blaze ve Claude gerekmez.
//   node is.mjs topla        kaynakları okur, haberler.json/atla.json'dakileri eler, en çok 8 adayı is/adaylar.json'a yazar
//   python cevir.py          OPUS-MT (açık kaynak) ile Türkçe başlık + kısa özet → is/ceviri.json
//   node is.mjs yaz [--kuru] çeviriyi haberler.json'a yazar (--kuru: yazmaz, ekrana döker); iş akışı değişikliği depoya commit'ler
// Google/Firebase bağlantısı YOK (kullanıcı 2026-11-15 "C"): depo herkese açık, site haberler.json'u raw.githubusercontent.com'dan okur.
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { KAYNAKLAR, adaylar as adaySec, kategoriKural, ozetKaynak, belge, haberId, olayKimlik } from "./haber-cekirdek.js";
import { topla, ogGorsel, bekle } from "./haber-getir.js";
import { dosyaDepo, DOSYA_FV } from "./dosya-depo.mjs";

export const TUR_EN_COK = 8;  // bir turda en çok yeni haber (kaynaklara saygı, çeviri süresi)
export const YAS_GUN = 60;    // 60 günden eski haber eklenmez
// Sitedeki başlangıç listesi (elle çevrilmiş ilk 5 haber): bunlar ve "diğer kaynakları" yeniden eklenmez
export const TOHUM_URL = "https://re-zero-takip.web.app/haberler-ilk.json";
export async function tohumOku(url = TOHUM_URL) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(15000) }); if (!r.ok) return { idler: [], basliklar: [] };
    const l = await r.json(); if (!Array.isArray(l)) return { idler: [], basliklar: [] };
    return { idler: l.flatMap(h => [h.url, ...((h.digerKaynaklar || []).map(d => d.url))]).filter(Boolean).map(u => haberId(u)), basliklar: l.map(h => String(h.orijinalBaslik || "")).filter(Boolean) };
  } catch { return { idler: [], basliklar: [] }; }
}

export async function toplaIs({ db, simdi = Date.now(), kaynaklar = KAYNAKLAR, gorselGetir = ogGorsel, bekleMs = 1000, tohumUrl = TOHUM_URL }) {
  const { hamlar, durum } = await topla(kaynaklar);
  const son = await db.collection("haberler").orderBy("tarih", "desc").limit(200).get();
  const atla = await db.collection("haberAtla").limit(1000).get();
  const tohum = tohumUrl ? await tohumOku(tohumUrl) : { idler: [], basliklar: [] };
  const mevcut = { idler: new Set([...son.docs.map(d => d.id), ...atla.docs.map(d => d.id), ...tohum.idler]), basliklar: [...son.docs.map(d => d.get("orijinalBaslik") || ""), ...tohum.basliklar] };
  const liste = adaySec(hamlar, mevcut).filter(h => !h.tarih || Date.parse(h.tarih) > simdi - YAS_GUN * 864e5).slice(0, TUR_EN_COK);
  const cikti = [];
  for (const h of liste) {
    if (!h.gorsel && h.kaynakId !== "resmi") { h.gorsel = await gorselGetir(h.url); await bekle(bekleMs); }
    cikti.push({ id: h.id, kaynak: h.kaynak, kaynakId: h.kaynakId, dil: h.dil, baslik: h.baslik, url: h.url, tarih: h.tarih, gorsel: h.gorsel || "",
      kategori: kategoriKural(h), ozetKaynak: ozetKaynak(h), metin: String(h.metin || "").slice(0, 1200) });
  }
  return { durum, adaylar: cikti };
}

// ceviri = { id: {baslik, ozet} }. Çevirisi gelmeyen aday atlanır (sonraki turda yeniden denenir);
// çeviri geldi ama boşsa haberAtla'ya yazılır (sonsuz döngü olmasın). Var olan belgeye dokunulmaz (create).
// Claude çıktısında (yz): ilgili:false → haberAtla "ilgisiz"; aynı olay 10 gün içinde zaten varsa yeni kart yerine o karta "diğer kaynak".
export async function yazIs({ db, adaylar, ceviri, fv }) {
  let eklenen = 0, bos = 0, bekleyen = 0, ilgisiz = 0, birlesen = 0;
  const son = (await db.collection("haberler").orderBy("tarih", "desc").limit(200).get()).docs.map(d => ({ id: d.id, olay: d.get("olay") || "", ms: fv.ms ? fv.ms(d.get("tarih")) : 0 }));
  for (const h of adaylar) {
    const c = ceviri && ceviri[h.id];
    if (!c) { bekleyen++; continue; }
    if (c.ilgili === false) { await db.doc("haberAtla/" + h.id).set({ at: fv.sunucu(), neden: "ilgisiz", baslik: String(h.baslik).slice(0, 200) }); ilgisiz++; continue; }
    const b = belge(h, c);
    if (!b) { await db.doc("haberAtla/" + h.id).set({ at: fv.sunucu(), neden: "ceviri-bos", baslik: String(h.baslik).slice(0, 200) }); bos++; continue; }
    const ms = Date.parse(b.tarih) || 0, es = b.olay && son.find(x => x.olay === b.olay && Math.abs(x.ms - ms) < 10 * 864e5);
    if (es) { await db.doc("haberler/" + es.id).update({ digerKaynaklar: fv.ekle({ kaynak: h.kaynak, url: h.url }) }); await db.doc("haberAtla/" + h.id).set({ at: fv.sunucu(), neden: "ayni-olay", olay: b.olay }); birlesen++; continue; }
    try { await db.doc("haberler/" + h.id).create({ ...b, tarih: fv.zaman(new Date(b.tarih)), eklendi: fv.sunucu() }); eklenen++; son.unshift({ id: h.id, olay: b.olay, ms }); }
    catch (e) { if (e.code !== 6) throw e; } // 6 = ALREADY_EXISTS
  }
  return { eklenen, bos, bekleyen, ilgisiz, birlesen };
}

// ---- komut satırı ----
// Depo: haberler.json + atla.json bu klasörde (GitHub deposunun kökü). İş akışı yazdıktan sonra değişikliği depoya commit'ler; site oradan okur.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const kom = process.argv[2], kuru = process.argv.includes("--kuru");
  const klasor = new URL("./is/", import.meta.url); fs.mkdirSync(klasor, { recursive: true });
  const db = dosyaDepo(new URL("./", import.meta.url));
  if (kom === "topla") {
    const { durum, adaylar } = await toplaIs({ db });
    durum.forEach(d => console.log("kaynak " + d.kaynak + ": " + (d.hata ? "HATA " + d.hata : d.adet + " kayıt")));
    fs.writeFileSync(new URL("adaylar.json", klasor), JSON.stringify(adaylar, null, 1));
    console.log("yeni aday: " + adaylar.length); adaylar.forEach(a => console.log("  " + a.dil + " · " + a.kategori + " · " + a.baslik.slice(0, 90)));
    if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, "aday=" + adaylar.length + "\n");
  } else if (kom === "claude") {
    const adaylar = JSON.parse(fs.readFileSync(new URL("adaylar.json", klasor), "utf8"));
    const key = process.env.ANTHROPIC_API_KEY;
    const { claudeOzetle } = await import("./claude.mjs");
    let client = null; if (key) { const { default: Anthropic } = await import("@anthropic-ai/sdk"); client = new Anthropic({ apiKey: key }); }
    const r = await claudeOzetle({ client, adaylar });
    if (r.tamam) fs.writeFileSync(new URL("ceviri.json", klasor), JSON.stringify(r.ceviri, null, 1));
    console.log(key ? "Claude: " + r.tamam + "/" + adaylar.length + (r.durdu ? " (durdu)" : "") : "Claude anahtarı yok, yedek çeviriye geçilecek (yalnızca İngilizce)");
    if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, "tamam=" + r.tamam + "\n");
  } else if (kom === "yaz") {
    const adaylar = JSON.parse(fs.readFileSync(new URL("adaylar.json", klasor), "utf8"));
    let ceviri = {}; try { ceviri = JSON.parse(fs.readFileSync(new URL("ceviri.json", klasor), "utf8")); } catch {}
    if (kuru) {
      for (const h of adaylar) { const b = belge(h, ceviri[h.id]); console.log("\n[" + h.dil + "] " + h.baslik + "\n  → " + (b ? b.baslik + "\n  → " + b.ozet + "\n  EN: " + (b.baslikEn ? b.baslikEn + (b.ozetEn ? " | " + b.ozetEn : "") : "(yok: sitede Türkçe + TR notu)") + "\n  (" + b.kategori + ")" : "(çeviri yok)")); }
      console.log("\nkuru çalıştırma: haberler.json'a yazılmadı");
    } else {
      console.log("haber turu", await yazIs({ db, adaylar, ceviri, fv: DOSYA_FV }));
      db.kaydet();
    }
  } else { console.error("kullanım: node is.mjs topla | claude | yaz [--kuru]"); process.exit(2); }
}
