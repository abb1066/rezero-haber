// Kuru çalıştırma (P12/P15): gerçek kaynakları okur, süzer, tekrarları eler, kategori ve çevrilecek özeti gösterir. Firestore'a ve modele GİTMEZ.
// Çalıştır: cd firebase-site/haber-is && node kuru.mjs
import { topla } from "./haber-getir.js";
import { adaylar, kategoriKural, ozetKaynak } from "./haber-cekirdek.js";
const { hamlar, durum } = await topla();
console.log("Kaynaklar:"); durum.forEach(d => console.log("  " + d.kaynak + ": " + (d.hata ? "HATA " + d.hata : d.adet + " kayıt")));
const a = adaylar(hamlar);
console.log("\nRe:Zero adayları (tekrarlar elenmiş, en yeni üstte): " + a.length);
a.slice(0, 15).forEach(h => console.log("  " + (h.tarih || "").slice(0, 10) + " · " + h.kaynak + " · " + kategoriKural(h) + " · " + h.baslik.slice(0, 90) + (h.gorsel ? " · [görsel]" : "")));
