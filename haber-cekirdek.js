// Re:Zero haber toplayıcısının çekirdeği (P12, kullanıcı 2026-11-14; P15 ücretsiz hat: GitHub Actions + OPUS-MT). Dış pakete bağlı değil:
// ayrıştırma, süzme, tekrar engeli, kurallı kategori, çevrilecek kısa özet. is.mjs ve testler (test/) bunu kullanır.
import { createHash } from "node:crypto";

// Kaynaklar: yalnızca RSS ya da resmî sayfa. Robots/RSS kuralına uyulur, makale metni saklanmaz.
export const KAYNAKLAR = [
  { id: "ann", ad: "Anime News Network", tur: "rss", url: "https://www.animenewsnetwork.com/all/rss.xml?ann-edition=w", dil: "en", gecikme: 2000 },
  { id: "crn", ad: "Crunchyroll News", tur: "rss", url: "https://cr-news-api-service.prd.crunchyrollsvc.com/v1/en-US/rss", dil: "en", gecikme: 1000 },
  { id: "resmi", ad: "Re:Zero resmî sitesi", tur: "resmi", url: "https://re-zero-anime.jp/news/", dil: "ja", gecikme: 1000 },
  { id: "aa", ad: "Anime!Anime!", tur: "rss", url: "https://animeanime.jp/rss/index.rdf", dil: "ja", gecikme: 1000 },
];
export const KATEGORILER = ["Anime", "Manga", "Light Novel", "Oyun", "Etkinlik"];

const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
export function varlikCoz(s) {
  return String(s || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&([a-z]+);/gi, (m, n) => (n.toLowerCase() in ENT ? ENT[n.toLowerCase()] : m));
}
export function duzMetin(html) {
  return varlikCoz(String(html || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1"))
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ").trim();
}
const etiket = (blok, ad) => {
  const m = blok.match(new RegExp("<" + ad + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + ad + ">", "i"));
  return m ? m[1] : "";
};
const nitelik = (blok, ad, nit) => {
  const m = blok.match(new RegExp("<" + ad + "\\s[^>]*" + nit + "=[\"']([^\"']+)[\"']", "i"));
  return m ? varlikCoz(m[1]) : "";
};
function tarihISO(s) {
  const t = Date.parse(String(s || "").trim());
  return Number.isFinite(t) ? new Date(t).toISOString() : "";
}

// RSS 2.0 (<item>), RDF/RSS 1.0 (<item rdf:about>) ve Atom (<entry>)
export function rssAyristir(xml, kaynak) {
  const out = [];
  const bloklar = String(xml || "").match(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi) || [];
  for (const b of bloklar) {
    const baslik = duzMetin(etiket(b, "title"));
    let link = duzMetin(etiket(b, "link")) || nitelik(b, "link", "href") || nitelik(b, "item", "rdf:about");
    const tarih = tarihISO(etiket(b, "pubDate") || etiket(b, "dc:date") || etiket(b, "updated") || etiket(b, "published"));
    const ham = etiket(b, "content:encoded") || etiket(b, "description") || etiket(b, "summary") || etiket(b, "content");
    const metin = duzMetin(ham).slice(0, 1200);
    const gorsel = nitelik(b, "media:thumbnail", "url") || nitelik(b, "media:content", "url") || nitelik(b, "enclosure", "url")
      || (varlikCoz(ham).match(/<img[^>]+src=["']([^"']+)["']/i) || [])[1] || "";
    if (!baslik || !/^https?:\/\//i.test(link)) continue;
    out.push({ kaynak: kaynak.ad, kaynakId: kaynak.id, dil: kaynak.dil, baslik, url: link, tarih, metin, gorsel: guvenliHttps(gorsel) });
  }
  return out;
}

// re-zero-anime.jp/news/: <section id="news-..." class="content-entry"> .entry-date (2026.11.14) .entry-title .entry-body
export function resmiAyristir(html, kaynak) {
  const out = [];
  const re = /<section\s+id="(news-[^"]+)"\s+class="content-entry"[\s\S]*?<\/section>/gi;
  let m;
  while ((m = re.exec(String(html || "")))) {
    const s = m[0], id = m[1];
    const d = (s.match(/class="entry-date">\s*([\d.]+)\s*</) || [])[1] || "";
    const baslik = duzMetin((s.match(/class="entry-title">([\s\S]*?)<\/div>/) || [])[1] || "");
    const govde = (s.match(/class="entry-body">([\s\S]*)$/) || [])[1] || "";
    const g = (govde.match(/<img[^>]+(?:data-src|src)=["']([^"']+)["']/i) || [])[1] || "";
    const [y, a, gun] = d.split(".").map(Number);
    if (!baslik || !y) continue;
    out.push({ kaynak: kaynak.ad, kaynakId: kaynak.id, dil: kaynak.dil, baslik,
      url: new URL("#" + id, kaynak.url).href,
      tarih: new Date(Date.UTC(y, (a || 1) - 1, gun || 1, 3)).toISOString(), // JST öğlen öncesi; gün bazında doğru
      metin: duzMetin(govde).slice(0, 1200), gorsel: g ? guvenliHttps(new URL(g, kaynak.url).href) : "" });
  }
  return out;
}

export function guvenliHttps(u) {
  try { const x = new URL(String(u || "").trim()); return x.protocol === "https:" && !x.username && !x.password ? x.href : ""; }
  catch { return ""; }
}

// Re:Zero süzgeci: başlık ya da metinde dizi adı. Resmî site zaten Re:Zero, hepsi geçer.
const RZ = /re\s*[:：]?\s*zero\b|re\s*[:：]\s*ゼロ|リゼロ|ゼロから始める異世界生活|starting life in another world/i;
export function rzIlgili(h) { return h.kaynakId === "resmi" || RZ.test(h.baslik) || RZ.test(h.metin); }

// Tekrar engeli 1: kanonik adres (izleme parametreleri, www, sondaki /) -> sha1 kimlik
export function kanonikUrl(u) {
  try {
    const x = new URL(u);
    x.hostname = x.hostname.toLowerCase().replace(/^www\./, "");
    [...x.searchParams.keys()].forEach(k => { if (/^(utm_|fbclid|gclid|ref$|ann-edition)/i.test(k)) x.searchParams.delete(k); });
    x.search = x.searchParams.toString() ? "?" + x.searchParams.toString() : "";
    if (!x.hash.startsWith("#news-")) x.hash = "";
    x.pathname = x.pathname.replace(/\/+$/, "") || "/";
    return x.href;
  } catch { return String(u || ""); }
}
export const haberId = u => createHash("sha1").update(kanonikUrl(u)).digest("hex").slice(0, 24);

// Tekrar engeli 2: farklı kaynaklarda aynı haber (başlık sözcüklerinin Jaccard benzerliği)
const sozcuk = s => new Set(String(s || "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(w => w.length > 2));
export function baslikBenzer(a, b) {
  const x = sozcuk(a), y = sozcuk(b);
  if (!x.size || !y.size) return 0;
  let o = 0; x.forEach(w => { if (y.has(w)) o++; });
  return o / (x.size + y.size - o);
}

// Bir toplama turunun aday listesi: süz, kimlik ver, tekrarları ayıkla, en yeni üstte
export function adaylar(hamlar, mevcut = { idler: new Set(), basliklar: [] }) {
  const sec = [], gorulen = new Set(mevcut.idler);
  const bas = [...mevcut.basliklar];
  for (const h of hamlar.filter(rzIlgili).sort((a, b) => (b.tarih || "").localeCompare(a.tarih || ""))) {
    const id = haberId(h.url);
    if (gorulen.has(id)) continue;
    if (bas.some(t => baslikBenzer(t, h.baslik) >= 0.8)) continue;
    gorulen.add(id); bas.push(h.baslik); sec.push({ ...h, id });
  }
  return sec;
}

// Kategori (P15, Claude yerine kurallar). Önce başlık (etkinlik, oyun, manga, light novel sırasıyla), sonra metin
// (etkinlik hariç: duyurular çoğu zaman "bir etkinlikte açıklandı" der). Hiçbiri değilse Anime.
const KURAL = {
  "Etkinlik": /\b(event|events|exhibition|caf[eé]|collab|collaboration|concert|live show|pop-?up|stage|screening|convention|expo|festival|panel|tickets?)\b|イベント|展示|』展|カフェ|コラボ|ライブ|上映|ポップアップ|フェス|パネル|抽選/i,
  "Oyun": /\b(game|games|gaming|gacha|switch|playstation|ps[45]|steam|rpg)\b|ゲーム|アプリ/i,
  "Manga": /\b(manga|comic|comics)\b|漫画|マンガ|コミカライズ|コミック/i,
  "Light Novel": /\b(light novel|novel|novels|bunko|web novel)\b|ライトノベル|小説|文庫/i,
};
export function kategoriKural(h) {
  const b = String(h.baslik || ""), m = String(h.metin || "").slice(0, 400);
  for (const k of ["Etkinlik", "Oyun", "Manga", "Light Novel"]) if (KURAL[k].test(b)) return k;
  for (const k of ["Oyun", "Manga", "Light Novel"]) if (KURAL[k].test(m)) return k;
  return "Anime";
}

// Çevrilecek kısa özet: kaynak metnin ilk 1–2 cümlesi, en çok 280 karakter (telif: kısa tut, kaynağa link verilir).
export function ozetKaynak(h) {
  const m = String(h.metin || "").replace(/\s+/g, " ").trim();
  if (!m) return "";
  const cumle = m.match(/[^.!?。！？]+[.!?。！？]+["'」』)]?/g) || [m];
  let o = "";
  let n = 0;
  for (const c of cumle) { if ((o + c).length > 280 || n === 2) break; o += c; n++; if (o.length >= 120) break; }
  if (!o) o = m.slice(0, 277).replace(/\s+\S*$/, "") + "…";
  return o.trim();
}

export const olayKimlik = s => String(s || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

// Firestore belgesi. c = makine çevirisi {baslik, ozet}. Çeviri boşsa belge yok (null).
export function belge(h, c) {
  const baslik = String(c && c.baslik || "").replace(/\s+/g, " ").trim().slice(0, 160);
  if (!baslik) return null;
  return {
    baslik, ozet: String(c.ozet || "").replace(/\s+/g, " ").trim().slice(0, 400),
    kategori: KATEGORILER.includes(h.kategori) ? h.kategori : kategoriKural(h),
    kaynak: h.kaynak, url: h.url, gorsel: guvenliHttps(h.gorsel), tarih: h.tarih || new Date().toISOString(),
    orijinalBaslik: String(h.baslik).slice(0, 200), dil: h.dil, ceviri: "makine",
    olay: "", digerKaynaklar: [],
  };
}
