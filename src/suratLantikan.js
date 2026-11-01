// suratLantikan.js
// Jana SATU surat lantikan per guru, senaraikan semua lantikan + jumlah beban.
// Data boleh datang daripada muatDanKira() (supabaseData.js).

import { kiraBebanGuru } from "./pengiraanBeban.js";

// Hasilkan struktur data surat (untuk render ke HTML/PDF/templat lain).
export function dataSurat(guru, config, maklumatSekolah = {}) {
  const beban = kiraBebanGuru(guru, config);
  return {
    sekolah: maklumatSekolah.nama || "Maktab Rendah Sains MARA Taiping",
    tajuk: maklumatSekolah.tajuk || "SURAT LANTIKAN JAWATANKUASA",
    sesi: maklumatSekolah.sesi || "",
    tarikh: maklumatSekolah.tarikh || new Date().toISOString().slice(0, 10),
    guru: { nama: guru.nama, no_kp: guru.no_kp || "", no_gaji: guru.no_gaji || "" },
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
  };
}

// Render HTML ringkas, sedia cetak. Elak kebocoran: no. K/P boleh ditutup separa.
export function suratHTML(data, { lindungKP = false, paparPemberat = true } = {}) {
  const kp = lindungKP && data.guru.no_kp
    ? data.guru.no_kp.replace(/\d(?=\d{4})/g, "*")
    : data.guru.no_kp;

  const baris = data.lantikan.map((l) => `
      <tr>
        <td style="text-align:center">${l.bil}</td>
        <td>${l.kod ? escapeHtml(l.kod) + " — " : ""}${escapeHtml(l.jk)}</td>
        <td>${escapeHtml(l.jawatan)}</td>
        ${paparPemberat ? `<td style="text-align:center">${l.pemberat}</td>` : ""}
      </tr>`).join("");

  const kepalaPemberat = paparPemberat ? `<th style="width:70px">Pemberat</th>` : "";
  const kaki = paparPemberat
    ? `<tfoot><tr><td colspan="3" style="text-align:right">Jumlah Beban</td><td style="text-align:center">${data.jumlahBeban}</td></tr></tfoot>`
    : "";

  return `<!DOCTYPE html>
<html lang="ms"><head><meta charset="utf-8">
<style>
  body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;color:#1a1a1a;line-height:1.5}
  h1{font-size:18px;text-align:center;margin:0}
  .sekolah{text-align:center;font-weight:bold;margin-bottom:4px}
  .meta{margin:20px 0}
  table{width:100%;border-collapse:collapse;margin:16px 0}
  th,td{border:1px solid #999;padding:6px 8px;font-size:14px}
  th{background:#f0f0f0;text-align:left}
  tfoot td{font-weight:bold}
  .ttd{margin-top:60px}
</style></head><body>
  <div class="sekolah">${escapeHtml(data.sekolah)}</div>
  <h1>${escapeHtml(data.tajuk)}${data.sesi ? " SESI " + escapeHtml(data.sesi) : ""}</h1>
  <div class="meta">
    <div>Nama&nbsp;&nbsp;&nbsp;: <strong>${escapeHtml(data.guru.nama)}</strong></div>
    <div>No. K/P&nbsp;: ${escapeHtml(kp || "-")}</div>
    <div>No. Gaji&nbsp;: ${escapeHtml(data.guru.no_gaji || "-")}</div>
    <div>Tarikh&nbsp;&nbsp;: ${escapeHtml(data.tarikh)}</div>
  </div>
  <p>Dengan hormatnya tuan/puan dilantik memegang jawatan dalam jawatankuasa berikut:</p>
  <table>
    <thead><tr><th style="width:40px">Bil</th><th>Jawatankuasa / Program</th><th>Jawatan</th>${kepalaPemberat}</tr></thead>
    <tbody>${baris}</tbody>
    ${kaki}
  </table>
  <p>Segala kerjasama dan komitmen tuan/puan didahului dengan ucapan terima kasih.</p>
  <div class="ttd">
    .........................................<br>
    <strong>${escapeHtml(data.penandatangan)}</strong>
  </div>
</body></html>`;
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export default { dataSurat, suratHTML };
