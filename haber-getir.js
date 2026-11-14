// Kaynakları ağdan okur (P12). Bağımlılık yok: Node 20 fetch. Makale metni saklanmaz; yalnızca RSS/sayfa özeti ve og:image okunur.
import { KAYNAKLAR, rssAyristir, resmiAyristir, guvenliHttps } from "./haber-cekirdek.js";

const UA = "ReZeroTakipHaber/1.0 (+https://re-zero-takip.web.app)";
export const bekle = ms => new Promise(r => setTimeout(r, ms));

export async function getir(url) {
  const r = await fetch(url, { headers: { "User-Agent": UA, "Accept": "application/rss+xml, application/xml, text/html;q=0.9" }, signal: AbortSignal.timeout(15000), redirect: "follow" });
  if (!r.ok) throw new Error(url + " → HTTP " + r.status);
  return await r.text();
}

// Bütün kaynaklar; biri düşerse ötekiler sürer. { hamlar, durum: [{kaynak, adet|hata}] }
export async function topla(kaynaklar = KAYNAKLAR) {
  const hamlar = [], durum = [];
  for (const k of kaynaklar) {
    try {
      const metin = await getir(k.url);
      const l = k.tur === "resmi" ? resmiAyristir(metin, k) : rssAyristir(metin, k);
      hamlar.push(...l); durum.push({ kaynak: k.ad, adet: l.length });
    } catch (e) { durum.push({ kaynak: k.ad, hata: String(e.message || e).slice(0, 200) }); }
    await bekle(k.gecikme || 1000); // robots.txt Crawl-delay (ANN 2 sn)
  }
  return { hamlar, durum };
}

// Haber sayfasının paylaşım görseli (kullanıcı kararı 2026-11-14: kaynak görseli gösterilir, kaynağa bağlanır)
export async function ogGorsel(url) {
  try {
    const h = await getir(url);
    const m = h.match(/<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i) || h.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    return m ? guvenliHttps(new URL(m[1].replace(/&amp;/g, "&"), url).href) : "";
  } catch { return ""; }
}
