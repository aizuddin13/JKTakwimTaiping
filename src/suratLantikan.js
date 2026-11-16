// suratLantikan.js
// Jana SATU surat lantikan per guru, senaraikan semua lantikan + jumlah beban.
// Format mengikut memograf rasmi MARA (kepala "mara memograf", jadual rujukan,
// cogan kata, "Saya yang menjalankan amanah," dan kaki "Amanah Rakyat").
// Data boleh datang daripada muatDanKira() (supabaseData.js).

import { kiraBebanGuru } from "./pengiraanBeban.js";

// Logo ulang tahun MARA (kaki surat) — URL mutlak supaya sah dalam iframe pratonton
// dan tetingkap cetak (about:blank) yang dibuka oleh app.
const LOGO_KAKI = new URL("../assets/logo-mara-60.png", import.meta.url).href;

const BULAN_MASIHI = ["Januari", "Februari", "Mac", "April", "Mei", "Jun", "Julai", "Ogos", "September", "Oktober", "November", "Disember"];
const BULAN_HIJRAH = ["Muharam", "Safar", "Rabiulawal", "Rabiulakhir", "Jamadilawal", "Jamadilakhir", "Rejab", "Syaaban", "Ramadan", "Syawal", "Zulkaedah", "Zulhijjah"];

const dd = (n) => String(n).padStart(2, "0");

// Terima "YYYY-MM-DD" atau objek Date; pulangkan Date tempatan (atau null jika tidak sah).
function keDate(t) {
  if (t instanceof Date) return isNaN(t) ? null : t;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(t || ""));
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

// Tarikh Masihi mengikut format memograf: 14.01.2026
export function tarikhMasihi(t) {
  const d = keDate(t);
  return d ? `${dd(d.getDate())}.${dd(d.getMonth() + 1)}.${d.getFullYear()}` : "";
}

// Tarikh Masihi panjang: 14 Januari 2026 (digunakan dalam isi surat)
export function tarikhPanjang(t) {
  const d = keDate(t);
  return d ? `${d.getDate()} ${BULAN_MASIHI[d.getMonth()]} ${d.getFullYear()}` : "";
}

// Anggaran tarikh Hijrah: 24 Rejab 1447H.
// Kalendar Hijrah Malaysia boleh berbeza ±1 hari daripada pengiraan — admin boleh
// menimpa nilai ini dalam tetapan surat.
export function tarikhHijrah(t) {
  const d = keDate(t);
  if (!d) return "";
  try {
    const parts = new Intl.DateTimeFormat("en-u-ca-islamic-civil", { day: "numeric", month: "numeric", year: "numeric" })
      .formatToParts(d);
    const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
    const bulan = BULAN_HIJRAH[Number(p.month) - 1];
    if (!bulan) return "";
    return `${dd(p.day)} ${bulan} ${p.year}H`;
  } catch {
    return "";
  }
}

// Hasilkan struktur data surat (untuk render ke HTML/PDF/templat lain).
export function dataSurat(guru, config, maklumatSekolah = {}) {
  const beban = kiraBebanGuru(guru, config);
  const sesi = maklumatSekolah.sesi || "";
  const sekolah = maklumatSekolah.nama || "Maktab Rendah Sains MARA Taiping";
  const negeri = maklumatSekolah.negeri || "Perak";
  const tarikh = maklumatSekolah.tarikh || new Date().toISOString().slice(0, 10);
  return {
    sekolah,
    negeri,
    tajuk: maklumatSekolah.tajuk
      || `LANTIKAN JAWATANKUASA${sesi ? " SESI " + sesi : ""} ${sekolah.toUpperCase()}, ${negeri.toUpperCase()}`,
    sesi,
    tarikh,
    tarikhMasihi: tarikhMasihi(tarikh),
    tarikhHijrah: maklumatSekolah.tarikhHijrah || tarikhHijrah(tarikh),
    rujukan: maklumatSekolah.rujukan || "MRSMTPG.100-4/1/1 (   )",
    daripada: maklumatSekolah.daripada || `Pengetua ${sekolah}, ${negeri}`,
    salinan: maklumatSekolah.salinan || "",
    guru: { nama: guru.nama, no_kp: guru.no_kp || "", no_gaji: guru.no_gaji || "", jawatan: guru.jawatan_hakiki || "" },
    lantikan: beban.butiran.map((b, i) => ({
      bil: i + 1,
      jk: guru.lantikan[i]?.jk || b.jawatan,
      kod: guru.lantikan[i]?.kod || "",
      jawatan: b.jumpa ? b.jawatan : guru.lantikan[i]?.jawatan,
      pemberat: b.pemberat,
    })),
    jumlahBeban: beban.jumlahBeban,
    jumlahLantikan: beban.bilanganLantikan,
    penandatangan: maklumatSekolah.penandatangan || "Pengetua",
    jawatanPenandatangan: maklumatSekolah.jawatanPenandatangan || "Pengetua",
    bagiPihak: maklumatSekolah.bagiPihak || "",
  };
}

// Render HTML sedia cetak mengikut format memograf. Elak kebocoran: no. K/P boleh ditutup separa.
export function suratHTML(data, { lindungKP = false, paparPemberat = true } = {}) {
  const kp = lindungKP && data.guru.no_kp
    ? data.guru.no_kp.replace(/\d(?=\d{4})/g, "*")
    : data.guru.no_kp;

  const baris = data.lantikan.map((l) => `
      <tr>
        <td class="t">${l.bil}.</td>
        <td>${l.kod ? `<span class="kod">${escapeHtml(l.kod)}</span> ` : ""}${escapeHtml(l.jk)}</td>
        <td>${escapeHtml(l.jawatan)}</td>
        ${paparPemberat ? `<td class="t">${l.pemberat}</td>` : ""}
      </tr>`).join("");

  const kepalaPemberat = paparPemberat ? `<th class="t" style="width:60px">Pemberat</th>` : "";
  const kaki = paparPemberat
    ? `<tfoot><tr><td colspan="3" class="r"><strong>Jumlah Beban</strong></td><td class="t"><strong>${data.jumlahBeban}</strong></td></tr></tfoot>`
    : "";

  const sesi = data.sesi ? ` bagi Sesi ${escapeHtml(data.sesi)}` : "";
  const bil = data.lantikan.length;

  return `<!DOCTYPE html>
<html lang="ms"><head><meta charset="utf-8">
<title>${escapeHtml(data.tajuk)} — ${escapeHtml(data.guru.nama)}</title>
<style>
  @page{size:Letter;margin:16mm 20mm 12mm 20mm}
  *{box-sizing:border-box}
  html,body{margin:0;padding:0}
  body{font-family:Arial,Helvetica,sans-serif;font-size:11pt;color:#000;line-height:1.3;background:#fff}
  .surat{max-width:178mm;margin:0 auto;padding:12mm 10mm 10mm}
  @media print{.surat{max-width:none;margin:0;padding:0}}
  p{margin:0 0 8pt;text-align:justify}

  /* Kepala memograf */
  .kepala{display:flex;align-items:flex-end;justify-content:space-between;border-bottom:2.25pt solid #000;padding:0 2pt 0 0}
  .kepala .mara{font-family:"Times New Roman",Times,serif;font-weight:bold;font-size:28pt;line-height:1;letter-spacing:.5pt;padding-bottom:3pt}
  .kepala .memograf{font-family:"Times New Roman",Times,serif;font-size:11pt;padding-bottom:3pt}

  /* Jadual rujukan */
  table.rujukan{width:100%;border-collapse:collapse;table-layout:fixed;margin:0 0 14pt}
  table.rujukan td{border:0;padding:3pt 5pt;vertical-align:top;font-size:11pt}
  table.rujukan tr{border-bottom:.75pt solid #000}
  table.rujukan .bil{border-left:.75pt solid #000}
  table.rujukan tr.ruj td{border-left:.75pt solid #000;text-align:center;height:36pt}
  table.rujukan tr.ruj td:first-child{border-left:0}
  table.rujukan tr.ruj .nilai{display:block;margin-top:8pt;white-space:pre}
  table.rujukan tr.ruj .nilai.dua{margin-top:0;white-space:normal}
  table.rujukan .lbl{display:inline-block;min-width:92pt}

  h1{font-size:11pt;font-weight:bold;text-transform:uppercase;margin:0 0 12pt;text-align:left}

  /* Jadual lantikan */
  table.lantikan{width:100%;border-collapse:collapse;margin:2pt 0 10pt;font-size:10.5pt}
  table.lantikan th,table.lantikan td{border:.75pt solid #000;padding:3pt 6pt;vertical-align:top}
  table.lantikan th{background:#eaeaea;text-align:left;font-weight:bold}
  table.lantikan .t{text-align:center}
  table.lantikan .r{text-align:right}
  table.lantikan .kod{font-weight:bold}

  .cogan{margin:8pt 0 8pt;font-weight:bold}
  .cogan div{margin:0}
  .ttd{margin-top:8pt}
  .ttd .ruang{height:24pt}
  .ttd .nama{font-weight:bold;text-transform:uppercase}
  .ttd div{line-height:1.3}
  .kaki{text-align:center;margin-top:8pt}
  .kaki img{width:18mm;height:18mm;display:block;margin:0 auto 1pt}
  .kaki .amanah{font-size:11pt}
  .janaan{font-style:italic;font-size:9.5pt;margin:8pt 0 0}
  .nota{font-size:8.5pt;color:#444;margin:4pt 0 0}
</style></head><body>
<div class="surat">
  <div class="kepala"><span class="mara">mara</span><span class="memograf">memograf</span></div>
  <table class="rujukan">
    <colgroup><col style="width:31%"><col style="width:26%"><col style="width:11%"><col style="width:13%"><col style="width:19%"></colgroup>
    <tr><td colspan="5"><span class="lbl">Kepada</span>: <strong>${escapeHtml(data.guru.nama)}</strong>${data.guru.jawatan ? `, ${escapeHtml(data.guru.jawatan)}` : ""}</td></tr>
    <tr><td colspan="5"><span class="lbl">Daripada</span>: ${escapeHtml(data.daripada)}</td></tr>
    <tr><td colspan="3"><span class="lbl">Salinan Kepada</span>: ${escapeHtml(data.salinan)}</td><td colspan="2" class="bil">Bilangan</td></tr>
    <tr class="ruj">
      <td>Rujuk Kami<span class="nilai">${escapeHtml(data.rujukan)}</span></td>
      <td>Tarikh<span class="nilai dua">${escapeHtml(data.tarikhMasihi)}<br>${escapeHtml(data.tarikhHijrah)}</span></td>
      <td colspan="2">Rujuk Tuan</td>
      <td>Tarikh</td>
    </tr>
  </table>

  <h1>${escapeHtml(data.tajuk)}</h1>

  <p>Dengan segala hormatnya perkara di atas adalah dirujuk.</p>
  <p>Sukacita dimaklumkan bahawa tuan/puan telah dilantik untuk memegang jawatan dalam ${bil === 1 ? "jawatankuasa" : `${bil} jawatankuasa`} berikut${sesi}:</p>
  <table class="lantikan">
    <thead><tr><th class="t" style="width:32px">Bil.</th><th>Jawatankuasa / Program</th><th style="width:30%">Jawatan</th>${kepalaPemberat}</tr></thead>
    <tbody>${baris}</tbody>
    ${kaki}
  </table>
  <p>Segala kerjasama dan perhatian daripada pihak tuan/puan dalam menjayakan tanggungjawab ini amatlah dihargai dan didahului dengan ucapan terima kasih.</p>
  <p>Sekian.</p>

  <div class="cogan">
    <div>&ldquo;MALAYSIA MADANI&rdquo;</div>
    <div>&ldquo;BERKHIDMAT UNTUK NEGARA&rdquo;</div>
    <div>&ldquo;LUAR BANDAR SEJAHTERA&rdquo;</div>
  </div>

  <div class="ttd">
    <div>Saya yang menjalankan amanah,</div>
    <div class="ruang"></div>
    <div class="nama">${escapeHtml(data.penandatangan)}</div>
    <div>${escapeHtml(data.jawatanPenandatangan)}</div>
    ${data.bagiPihak ? `<div>b.p. ${escapeHtml(data.bagiPihak)}</div>` : ""}
    <div>${escapeHtml(data.sekolah)}</div>
    <div>${escapeHtml(data.negeri)}</div>
  </div>
  <p class="janaan">Surat ini adalah cetakan komputer dan tidak memerlukan tandatangan.</p>
  <p class="nota">Nama: ${escapeHtml(data.guru.nama)} &nbsp;|&nbsp; No. K/P: ${escapeHtml(kp || "-")} &nbsp;|&nbsp; No. Gaji: ${escapeHtml(data.guru.no_gaji || "-")}</p>

  <div class="kaki">
    <img src="${LOGO_KAKI}" alt="MARA 60 Tahun, Menjunjung Amanah">
    <div class="amanah">&ldquo;Amanah Rakyat&rdquo;</div>
  </div>
</div>
</body></html>`;
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export default { dataSurat, suratHTML, tarikhMasihi, tarikhPanjang, tarikhHijrah };
