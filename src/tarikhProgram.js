// tarikhProgram.js
// Tarikh pelaksanaan program (lajur jawatankuasa.tarikh) + semakan tarikh bertindan / terlalu dekat
// bagi lantikan seorang guru.
//
// Format teks tarikh (boleh lebih daripada satu julat, dipisah ";"):
//   "11/1/2027"                 satu hari
//   "11/1/2027 - 15/1/2027"     julat
//   "29/1/2027; 16/3/2027"      dua tarikh berasingan (cth Merentas Desa & SUPER)
// Format ISO "2027-01-11" juga diterima.

const BULAN = ["Jan", "Feb", "Mac", "Apr", "Mei", "Jun", "Jul", "Ogo", "Sep", "Okt", "Nov", "Dis"];

// Tarikh -> nombor hari (UTC) supaya bebas zon masa.
function keHari(teks) {
  const t = String(teks).trim();
  let d, m, y;
  let r = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (r) [, y, m, d] = r.map(Number);
  else {
    r = t.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/);
    if (!r) return null;
    [, d, m, y] = r.map(Number);
  }
  const ms = Date.UTC(y, m - 1, d);
  const dt = new Date(ms);
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return Math.round(ms / 86400000);
}

function hariKeTeks(h) {
  const dt = new Date(h * 86400000);
  return { d: dt.getUTCDate(), m: dt.getUTCMonth(), y: dt.getUTCFullYear() };
}

// Pulangkan { julat: [{mula, tamat}], ralat: string|null }. Teks kosong -> julat kosong.
export function parseTarikh(teks) {
  const julat = [];
  const bahagian = String(teks || "").split(";").map((x) => x.trim()).filter(Boolean);
  for (const b of bahagian) {
    const [a, z] = b.split(/\s+-\s+|\s*–\s*|\s+hingga\s+/i);
    const mula = keHari(a);
    const tamat = z === undefined ? mula : keHari(z);
    if (mula === null || tamat === null) return { julat: [], ralat: `Tarikh tidak sah: "${b}". Guna format 11/1/2027 atau 11/1/2027 - 15/1/2027.` };
    if (tamat < mula) return { julat: [], ralat: `Tarikh tamat sebelum tarikh mula: "${b}".` };
    julat.push({ mula, tamat });
  }
  return { julat, ralat: null };
}

// "11–15 Jan 2027", "30 Jan – 2 Feb 2027", "29 Jan 2027; 16 Mac 2027"
export function formatTarikh(teks) {
  const { julat, ralat } = parseTarikh(teks);
  if (ralat) return String(teks || "");
  return julat
    .map(({ mula, tamat }) => {
      const a = hariKeTeks(mula), z = hariKeTeks(tamat);
      if (mula === tamat) return `${a.d} ${BULAN[a.m]} ${a.y}`;
      if (a.y === z.y && a.m === z.m) return `${a.d}–${z.d} ${BULAN[a.m]} ${a.y}`;
      if (a.y === z.y) return `${a.d} ${BULAN[a.m]} – ${z.d} ${BULAN[z.m]} ${a.y}`;
      return `${a.d} ${BULAN[a.m]} ${a.y} – ${z.d} ${BULAN[z.m]} ${z.y}`;
    })
    .join("; ");
}

// Jarak (hari) antara dua julat; negatif / 0 = bertindan.
function jarak(p, q) {
  if (p.mula <= q.tamat && q.mula <= p.tamat) return 0;
  return p.tamat < q.mula ? q.mula - p.tamat : p.mula - q.tamat;
}

// lantikan : [{ kod, jk, jawatan, tarikh }]  (lantikan aktif seorang guru)
// hariMin  : jarak minimum (hari) antara dua program sebelum diberi amaran
// Pulangkan [{ a, b, jenis: "bertindan"|"dekat", jarak, mesej }]
export function semakTarikh(lantikan, hariMin = 7) {
  // satu entri bagi setiap JK (guru mungkin ada >1 jawatan dalam JK sama)
  const ikutJK = new Map();
  for (const l of lantikan || []) {
    if (!l.tarikh || ikutJK.has(l.kod)) continue;
    const { julat, ralat } = parseTarikh(l.tarikh);
    if (!ralat && julat.length) ikutJK.set(l.kod, { ...l, julat });
  }
  const senarai = [...ikutJK.values()];
  const amaran = [];
  for (let i = 0; i < senarai.length; i++) {
    for (let j = i + 1; j < senarai.length; j++) {
      const a = senarai[i], b = senarai[j];
      let terdekat = Infinity;
      for (const p of a.julat) for (const q of b.julat) terdekat = Math.min(terdekat, jarak(p, q));
      if (terdekat === 0 || terdekat < hariMin) {
        const jenis = terdekat === 0 ? "bertindan" : "dekat";
        amaran.push({
          a, b, jenis, jarak: terdekat,
          mesej: jenis === "bertindan"
            ? `${a.kod} (${formatTarikh(a.tarikh)}) bertindan dengan ${b.kod} (${formatTarikh(b.tarikh)})`
            : `${a.kod} (${formatTarikh(a.tarikh)}) hanya ${terdekat} hari dari ${b.kod} (${formatTarikh(b.tarikh)})`,
        });
      }
    }
  }
  return amaran;
}

export default { parseTarikh, formatTarikh, semakTarikh };
