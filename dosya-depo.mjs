// Dosya deposu (kullanıcı 2026-11-15: Google Cloud yerine "C"): haberler depodaki haberler.json'da, atlananlar atla.json'da.
// toplaIs/yazIs'in kullandığı kadar Firestore benzeri arayüz (collection().orderBy().limit().get(), doc().set/create).
// haberler.json sitenin okuduğu biçimde: {id, baslik, ozet, kategori, kaynak, url, gorsel, tarihMs, orijinalBaslik, dil, ceviri, olay, digerKaynaklar, eklendi}.
// İçeride tarih = tarihMs (sayı). En yeni 200 haber tutulur; atla.json en çok 3000 kayıt.
import fs from "node:fs";

export const DOSYA_FV = { sunucu: () => new Date().toISOString(), zaman: d => d.getTime() };

export function dosyaDepo(klasor) {
  const yol = ad => new URL(ad, klasor);
  const oku = ad => { try { const j = JSON.parse(fs.readFileSync(yol(ad), "utf8")); return Array.isArray(j) ? j.filter(x => x && typeof x.id === "string") : []; } catch { return []; } };
  const t = {
    haberler: new Map(oku("haberler.json").map(({ tarihMs, ...h }) => [h.id, { ...h, tarih: +tarihMs || 0 }])),
    haberAtla: new Map(oku("atla.json").map(h => [h.id, h])),
  };
  const sorgu = (ad, sirala = null, n = Infinity) => ({
    orderBy: (f, yon) => sorgu(ad, (a, b) => (yon === "desc" ? -1 : 1) * ((+a[f] || 0) - (+b[f] || 0)), n),
    limit: k => sorgu(ad, sirala, k),
    get: async () => { const l = [...t[ad].values()]; if (sirala) l.sort(sirala); return { docs: l.slice(0, n).map(d => ({ id: d.id, get: f => d[f] })) }; },
  });
  return {
    t,
    collection: ad => sorgu(ad),
    doc: y => {
      const [ad, id] = y.split("/");
      return {
        set: async v => { t[ad].set(id, { ...v, id }); },
        create: async v => { if (t[ad].has(id)) { const e = new Error("zaten var"); e.code = 6; throw e; } t[ad].set(id, { ...v, id }); },
      };
    },
    kaydet() {
      const h = [...t.haberler.values()].sort((a, b) => (+b.tarih || 0) - (+a.tarih || 0)).slice(0, 200).map(({ tarih, ...x }) => ({ ...x, tarihMs: +tarih || 0 }));
      fs.writeFileSync(yol("haberler.json"), JSON.stringify(h, null, 1) + "\n");
      fs.writeFileSync(yol("atla.json"), JSON.stringify([...t.haberAtla.values()].slice(-3000), null, 1) + "\n");
    },
  };
}
