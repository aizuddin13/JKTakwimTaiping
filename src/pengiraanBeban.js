// pengiraanBeban.js
// Modul pengiraan beban tugas guru berdasarkan pemberat jawatankuasa.
// Boleh guna di browser (ES module) atau Node.
//
// Sumber tunggal nilai: pemberat_jawatan.json
// Formula: pemberat_akhir = asas_jawatan * faktor_tempoh * faktor_skala
//   faktor_tempoh : tahunan = 1.0 , one-off = 0.7
//   faktor_skala  : besar = 1.2 , sederhana = 1.0 , kecil = 0.8  (one-off sahaja)

// ---------- 1. Bina indeks carian daripada config ----------

function normalisasi(teks) {
  return String(teks || "")
    .toLowerCase()
    .replace(/timb\.?/g, "timbalan")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Bina peta: nama/alias ternormalisasi -> rekod jawatan
export function binaIndeks(config) {
  const indeks = new Map();
  const kumpulan = [
    ...(config.jawatan_utama || []),
    ...(config.jawatan_kokurikulum || []),
    ...(config.subtugas_one_off || []),
  ];
  for (const rekod of kumpulan) {
    const kunci = [rekod.jawatan, ...(rekod.alias || [])];
    for (const k of kunci) {
      indeks.set(normalisasi(k), rekod);
    }
  }
  return indeks;
}

// ---------- 2. Cari jawatan (dengan padanan separa) ----------

export function cariJawatan(namaJawatan, indeks) {
  const n = normalisasi(namaJawatan);
  if (indeks.has(n)) return indeks.get(n);
  // padanan separa: ambil kunci terpanjang yang terkandung dalam input
  let padananTerbaik = null;
  let panjangTerbaik = 0;
  for (const [kunci, rekod] of indeks) {
    if ((n.includes(kunci) || kunci.includes(n)) && kunci.length > panjangTerbaik) {
      padananTerbaik = rekod;
      panjangTerbaik = kunci.length;
    }
  }
  return padananTerbaik; // null jika tiada
}

// ---------- 3. Kira pemberat untuk satu lantikan ----------

// lantikan = { jawatan, tempoh: "tahunan"|"one_off", skala?: "besar"|"sederhana"|"kecil" }
export function kiraPemberat(lantikan, config, indeks = binaIndeks(config)) {
  const rekod = cariJawatan(lantikan.jawatan, indeks);
  if (!rekod) {
    return { jumpa: false, jawatan: lantikan.jawatan, pemberat: 0, amaran: "Jawatan tidak dikenali" };
  }

  // Jika rekod ada tempoh tetap (cth kokurikulum = tahunan), guna itu.
  const tempoh = rekod.tempoh || lantikan.tempoh || "tahunan";
  const faktorTempoh = config.faktor_tempoh?.[tempoh] ?? 1.0;

  // Faktor skala hanya untuk one-off.
  let faktorSkala = 1.0;
  if (tempoh === "one_off") {
    const skala = lantikan.skala || "sederhana";
    faktorSkala = config.faktor_skala?.[skala] ?? 1.0;
  }

  const pemberat = Math.round(rekod.asas * faktorTempoh * faktorSkala * 100) / 100;

  return {
    jumpa: true,
    jawatan: rekod.jawatan,
    kategori: rekod.kategori || "kokurikulum/subtugas",
    asas: rekod.asas,
    tempoh,
    faktorTempoh,
    faktorSkala,
    pemberat,
  };
}

// ---------- 4. Kira jumlah beban seorang guru ----------

// guru = { nama, lantikan: [ {jawatan, tempoh, skala}, ... ] }
// opsyen = { kecualiPengurusan: boolean }
export function kiraBebanGuru(guru, config, opsyen = {}) {
  const indeks = binaIndeks(config);
  const butiran = [];
  let jumlah = 0;

  for (const lantikan of guru.lantikan || []) {
    const hasil = kiraPemberat(lantikan, config, indeks);
    if (opsyen.kecualiPengurusan && hasil.kategori === "pengurusan") {
      butiran.push({ ...hasil, dikira: false, sebab: "pengurusan dikecualikan" });
      continue;
    }
    jumlah += hasil.pemberat;
    butiran.push({ ...hasil, dikira: true });
  }

  return {
    nama: guru.nama,
    bilanganLantikan: (guru.lantikan || []).length,
    jumlahBeban: Math.round(jumlah * 100) / 100,
    butiran,
  };
}

// ---------- 5. Ringkasan agihan untuk semua guru ----------

export function ringkasanAgihan(senaraiGuru, config, opsyen = {}) {
  const hasil = senaraiGuru.map((g) => kiraBebanGuru(g, config, opsyen));
  const beban = hasil.map((h) => h.jumlahBeban);
  const jumlah = beban.reduce((a, b) => a + b, 0);
  const purata = beban.length ? jumlah / beban.length : 0;

  return {
    bilanganGuru: hasil.length,
    jumlahBebanKeseluruhan: Math.round(jumlah * 100) / 100,
    purataBeban: Math.round(purata * 100) / 100,
    maksimum: Math.max(0, ...beban),
    minimum: beban.length ? Math.min(...beban) : 0,
    jurang: Math.round((Math.max(0, ...beban) - (beban.length ? Math.min(...beban) : 0)) * 100) / 100,
    guru: hasil.sort((a, b) => b.jumlahBeban - a.jumlahBeban),
  };
}

export default { binaIndeks, cariJawatan, kiraPemberat, kiraBebanGuru, ringkasanAgihan };
