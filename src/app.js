// app.js — UI app agihan tugas jawatankuasa (JK Takwim).
// Satu halaman: log masuk, papan beban, urus lantikan/guru/JK/pemberat, cetak surat.
// Keselamatan data dikawal oleh RLS di Supabase: guru biasa hanya menerima data sendiri.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_KEY, MAKLUMAT_SEKOLAH, PENGURUSAN_TERTINGGI } from "./config.js";
import { muatConfig } from "./supabaseData.js";
import { kiraBebanGuru, kiraPemberat, binaIndeks } from "./pengiraanBeban.js";
import { agihSeimbang, semakKesesuaian } from "./penyeimbang.js";
import { dataSurat, suratHTML } from "./suratLantikan.js";

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
const app = document.getElementById("app");
const $ = (s, el = document) => el.querySelector(s);

const S = {
  session: null,
  saya: null,
  config: null,
  guru: [],
  jk: [],
  jawatan: [],
  lantikan: [],
  guruLengkap: [],
  jkMap: new Map(),
  jwMap: new Map(),
  tab: "beban",
  kecualiPengurusan: true,
  jkPilih: null,
  jkTapis: "",
  guruEdit: null,
  guruCari: "",
  guruUnit: "",
  bebanKumpulan: "",
  bebanGred: "",
  bebanCari: "",
  bebanUmur: "",
  guruTapis: { gred: "", jawatan: "", peranan: "", jk: "", umur: "" },
  jkEdit: null,
  surat: {
    sesi: MAKLUMAT_SEKOLAH.sesi,
    tarikh: new Date().toISOString().slice(0, 10),
    penandatangan: MAKLUMAT_SEKOLAH.penandatangan,
    lindungKP: false,
    paparPemberat: false,
    guru: "semua",
  },
};

// ---------- Utiliti ----------

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const nf = (n) => String(Math.round(Number(n || 0) * 100) / 100);
const semak = (r) => {
  if (r.error) throw r.error;
  return r.data;
};
const kosongJadiNull = (v) => {
  const t = String(v ?? "").trim();
  return t === "" ? null : t;
};
const topengKP = (kp) => (kp ? String(kp).replace(/\d(?=\d{4})/g, "*") : "-");
const normNama = (n) => String(n || "").toUpperCase().replace(/\s+/g, " ").trim();
const PENGURUSAN_MAP = new Map(Object.entries(PENGURUSAN_TERTINGGI || {}).map(([n, j]) => [normNama(n), j]));
const catatanPengurusan = (g) => PENGURUSAN_MAP.get(normNama(g?.nama)) || "";
const tagPengurusan = (g) => {
  const c = catatanPengurusan(g);
  return c ? `<span class="tag pengurusan">${esc(c)}</span>` : "";
};

function kodSort(a = "", b = "") {
  const pa = /^([A-Za-z]+)(\d+)/.exec(a || "") || [null, a || "", "0"];
  const pb = /^([A-Za-z]+)(\d+)/.exec(b || "") || [null, b || "", "0"];
  return pa[1].localeCompare(pb[1]) || Number(pa[2]) - Number(pb[2]);
}

function toast(mesej, jenis = "ok") {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    document.body.appendChild(el);
  }
  el.textContent = mesej;
  el.className = `toast ${jenis} papar`;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("papar"), 3500);
}

function mesejRalat(e) {
  if (/invalid login credentials/i.test(e?.message || "")) return "Email atau kata laluan salah.";
  if (e?.code === "23505") return "Rekod bertindih: data yang sama sudah wujud.";
  if (e?.code === "23503") return "Tidak boleh dipadam: rekod ini masih digunakan oleh lantikan.";
  return e?.message || String(e);
}

async function cuba(fn, berjaya) {
  try {
    await fn();
    if (berjaya) toast(berjaya);
  } catch (e) {
    console.error(e);
    toast(mesejRalat(e), "ralat");
  }
}

// ---------- Data ----------

async function muatSemua() {
  const [g, jk, jw, l, config, kongsi] = await Promise.all([
    sb.from("guru").select("*").order("nama"),
    sb.from("jawatankuasa").select("*"),
    sb.from("jawatan").select("*").order("asas", { ascending: false }),
    sb.from("lantikan").select("*"),
    muatConfig(sb),
    sb.from("tetapan").select("nilai").eq("kunci", "perkongsian_dibuka").maybeSingle(),
  ]);
  S.perkongsianDibuka = semak(kongsi)?.nilai === true;
  S.guru = semak(g);
  S.jk = semak(jk).sort((a, b) => kodSort(a.kod, b.kod));
  S.jawatan = semak(jw);
  S.lantikan = semak(l);
  S.config = config;
  S.jkMap = new Map(S.jk.map((x) => [x.id, x]));
  S.jwMap = new Map(S.jawatan.map((x) => [x.id, x]));
  kiraSemula();
}

function kiraSemula() {
  S.guruLengkap = S.guru.map((gr) => {
    const lantikan = S.lantikan
      .filter((x) => x.guru_id === gr.id)
      .map((x) => ({ x, jk: S.jkMap.get(x.jk_id), jw: S.jwMap.get(x.jawatan_id) }))
      .filter((o) => o.jk && o.jw && o.jk.aktif)
      .sort((a, b) => kodSort(a.jk.kod, b.jk.kod))
      .map((o) => ({
        id: o.x.id,
        jk_id: o.jk.id,
        jk: o.jk.nama,
        kod: o.jk.kod,
        kategori: o.jk.kategori,
        jawatan: o.jw.nama,
        tempoh: o.jk.tempoh,
        skala: o.jk.skala,
        fizikal: o.jk.fizikal,
      }));
    const g2 = { ...gr, lantikan };
    const b = kiraBebanGuru(g2, S.config, { kecualiPengurusan: S.kecualiPengurusan });
    return { ...g2, beban: b.jumlahBeban, butiran: b.butiran, amaran: semakKesesuaian(g2, S.config) };
  });
}

async function segarkan() {
  await muatSemua();
  render();
}

// ---------- Aliran log masuk ----------

async function mula() {
  const { data } = await sb.auth.getSession();
  S.session = data.session;
  sb.auth.onAuthStateChange((_peristiwa, session) => {
    const bertukar = (session?.user?.id || null) !== (S.session?.user?.id || null);
    S.session = session;
    // Elak panggil Supabase terus dalam callback (boleh tersekat); jadualkan selepasnya.
    if (bertukar) setTimeout(laluan, 0);
  });
  laluan();
}

async function laluan() {
  if (!S.session) return paparLogin();
  app.innerHTML = `<div class="memuat">Memuatkan data…</div>`;
  try {
    const saya = semak(
      await sb.from("guru").select("*").eq("auth_id", S.session.user.id).maybeSingle()
    );
    S.saya = saya;
    if (!saya || saya.peranan !== "admin") return paparBukanAdmin();
    await muatSemua();
    render();
  } catch (e) {
    console.error(e);
    app.innerHTML = `<div class="login-wrap"><div class="kad login"><h2>Ralat memuatkan data</h2>
      <p>${esc(mesejRalat(e))}</p><button class="sekunder" id="b-keluar">Log keluar</button></div></div>`;
    $("#b-keluar").onclick = () => sb.auth.signOut();
  }
}

// Config minimum untuk surat yang dicetak oleh guru (tanpa log masuk):
// guru tidak mempunyai akses kepada jadual pemberat, dan surat guru tidak memaparkan pemberat.
const LOGO_ATAS = `<div class="logo-atas">
  <img src="assets/logo-mara.png" alt="Logo MARA" width="66" height="80">
  <img src="assets/logo-mrsm.png" alt="Logo MRSM" width="96" height="80">
</div>`;
const LOGO_KAKI = `<div class="logo-kaki"><img src="assets/logo-ads.png" alt="Apple Distinguished School" width="184" height="30"></div>`;

const CONFIG_SURAT_GURU = {
  faktor_tempoh: { tahunan: 1.0, one_off: 0.7 },
  faktor_skala: { besar: 1.2, sederhana: 1.0, kecil: 0.8 },
  tetapan: {},
  jawatan_utama: [],
  jawatan_kokurikulum: [],
  subtugas_one_off: [],
};

function paparLogin(mod = "guru") {
  app.innerHTML = `
  <div class="login-wrap"><div class="kad login">
    ${LOGO_ATAS}
    <h1>JK Takwim</h1>
    <p class="sub">Agihan Tugas Jawatankuasa · ${esc(MAKLUMAT_SEKOLAH.nama)}</p>
    <div class="tab-kecil" role="tablist">
      <button type="button" data-mod="guru" class="${mod === "guru" ? "aktif" : ""}">Semak Lantikan</button>
      <button type="button" data-mod="admin" class="${mod === "admin" ? "aktif" : ""}">Admin</button>
    </div>
    ${mod === "guru"
      ? `<form id="f-semak">
          <label>No. Gaji<input name="no_gaji" required autocomplete="off" placeholder="Masukkan nombor gaji anda"></label>
          <button class="utama penuh" type="submit">Semak lantikan saya</button>
        </form>
        <p class="mesej" id="mesej"></p>
        <p class="nota">Masukkan nombor gaji untuk melihat dan mencetak surat lantikan jawatankuasa anda.</p>`
      : `<form id="f-admin">
          <label>Email<input type="email" name="email" required autocomplete="username"></label>
          <label>Kata laluan<input type="password" name="kata" required autocomplete="current-password"></label>
          <button class="utama penuh" type="submit">Log masuk admin</button>
        </form>
        <p class="mesej" id="mesej"></p>
        <p class="nota">Untuk pentadbir sistem sahaja.</p>`}
    ${LOGO_KAKI}
  </div></div>`;

  const tetapMesej = (t, j = "") => {
    const m = $("#mesej");
    m.textContent = t;
    m.className = `mesej ${j}`;
  };

  app.querySelectorAll("[data-mod]").forEach((b) => {
    b.onclick = () => paparLogin(b.dataset.mod);
  });

  const borang = $("#f-semak") || $("#f-admin");
  borang.querySelector("input").focus();

  borang.onsubmit = async (e) => {
    e.preventDefault();
    const butang = borang.querySelector("button[type=submit]");
    butang.disabled = true;
    tetapMesej("");
    try {
      if (mod === "guru") {
        const data = semak(await sb.rpc("semak_lantikan", { p_no_gaji: borang.no_gaji.value }));
        if (!data) tetapMesej("No. gaji tidak dijumpai. Semak semula atau hubungi admin.", "ralat");
        else paparHasilGuru(data);
      } else {
        semak(await sb.auth.signInWithPassword({ email: borang.email.value.trim(), password: borang.kata.value }));
      }
    } catch (err) {
      tetapMesej(mesejRalat(err), "ralat");
    } finally {
      butang.disabled = false;
    }
  };
}

function paparHasilGuru(d) {
  const lantikan = d.lantikan || [];
  app.innerHTML = `
  <div class="login-wrap"><div class="kad hasil">
    ${LOGO_ATAS}
    <div class="bar-alat">
      <div><span class="sub">Lantikan jawatankuasa</span><h2>${esc(d.nama)}</h2></div>
      <button class="sekunder kecil" id="b-kembali">Semak nombor lain</button>
    </div>
    <p class="info">${lantikan.length} lantikan · Sesi ${esc(MAKLUMAT_SEKOLAH.sesi)}</p>
    <table class="jadual">
      <thead><tr><th>Kod</th><th>Jawatankuasa / Program</th><th>Jawatan</th></tr></thead>
      <tbody>${lantikan
        .map((l) => `<tr><td><strong>${esc(l.kod)}</strong></td><td>${esc(l.jk)}</td><td>${esc(l.jawatan)}</td></tr>`)
        .join("") || `<tr><td colspan="3" class="kosong">Tiada lantikan direkodkan untuk anda.</td></tr>`}</tbody>
    </table>
    <div class="baris-butang">
      <button class="utama" id="b-cetak" ${lantikan.length ? "" : "disabled"}>Cetak surat lantikan</button>
    </div>
    ${LOGO_KAKI}
  </div></div>`;

  $("#b-kembali").onclick = () => paparLogin("guru");
  $("#b-cetak").onclick = () =>
    cetak(binaSurat(
      [{ nama: d.nama, no_kp: d.no_kp, no_gaji: d.no_gaji, lantikan }],
      { lindungKP: false, paparPemberat: false },
      CONFIG_SURAT_GURU
    ));
}

function paparBukanAdmin() {
  app.innerHTML = `<div class="login-wrap"><div class="kad login">
    ${LOGO_ATAS}
    <h2>Bukan akaun admin</h2>
    <p>Akaun <strong>${esc(S.session.user.email)}</strong> tidak didaftarkan sebagai admin dalam sistem ini.</p>
    <p class="nota">Guru boleh menyemak lantikan menggunakan No. Gaji tanpa log masuk.</p>
    <div class="baris-butang"><button class="utama" id="b-keluar">Log keluar</button></div>
  </div></div>`;
  $("#b-keluar").onclick = () => sb.auth.signOut();
}

// ---------- Kerangka utama ----------

const TAB_ADMIN = [
  ["beban", "Papan Beban"],
  ["lantikan", "Lantikan"],
  ["guru", "Guru"],
  ["jk", "Jawatankuasa"],
  ["pemberat", "Pemberat"],
  ["surat", "Surat Lantikan"],
];

function render() {
  const admin = true;
  const tabs = TAB_ADMIN;
  if (!tabs.some(([k]) => k === S.tab)) S.tab = tabs[0][0];

  app.innerHTML = `
  <header class="atas">
    <div class="jenama"><img src="assets/logo-mara.png" alt="MARA" class="logo-kepala"><img src="assets/logo-mrsm.png" alt="MRSM" class="logo-kepala"><div><strong>JK Takwim</strong><span class="sub">${esc(MAKLUMAT_SEKOLAH.nama)}</span></div></div>
    <div class="pengguna">
      <button id="b-kongsi" class="kongsi ${S.perkongsianDibuka ? "buka" : "tutup"}" title="Kawal sama ada guru boleh menyemak lantikan dengan No. Gaji">
        <i></i>${S.perkongsianDibuka ? "Perkongsian: DIBUKA" : "Perkongsian: DITUTUP"}</button>
      <span>${esc(S.saya.nama)}</span><span class="lencana">${admin ? "Admin" : "Guru"}</span>
      <button id="b-kata" class="sekunder kecil">Tukar kata laluan</button>
      <button id="b-keluar" class="sekunder kecil">Log keluar</button></div>
  </header>
  <nav class="tabs">${tabs
    .map(([k, v]) => `<button data-tab="${k}" class="${S.tab === k ? "aktif" : ""}">${v}</button>`)
    .join("")}</nav>
  <main id="isi"></main>
  <footer class="kaki-admin">${LOGO_KAKI}</footer>`;

  $("#b-keluar").onclick = () => sb.auth.signOut();
  $("#b-kata").onclick = bukaTukarKataLaluan;
  $("#b-kongsi").onclick = () => {
    const buka = !S.perkongsianDibuka;
    const soalan = buka
      ? "Buka perkongsian? Semua guru akan dapat menyemak dan mencetak surat lantikan mereka dengan No. Gaji."
      : "Tutup perkongsian? Guru tidak lagi dapat menyemak lantikan sehingga dibuka semula.";
    if (!confirm(soalan)) return;
    cuba(async () => {
      semak(await sb.from("tetapan").upsert({ kunci: "perkongsian_dibuka", nilai: buka }));
      S.perkongsianDibuka = buka;
      render();
    }, buka ? "Perkongsian dibuka. Guru kini boleh menyemak lantikan." : "Perkongsian ditutup.");
  };
  app.querySelectorAll("[data-tab]").forEach((b) => {
    b.onclick = () => {
      S.tab = b.dataset.tab;
      render();
    };
  });

  ({
    beban: viewBeban,
    lantikan: viewLantikan,
    guru: viewGuru,
    jk: viewJK,
    pemberat: viewPemberat,
    surat: viewSurat,
  })[S.tab]();
}

// ---------- Tukar kata laluan ----------

function bukaTukarKataLaluan() {
  const lapik = document.createElement("div");
  lapik.className = "lapik";
  lapik.innerHTML = `
  <div class="kad modal" role="dialog" aria-modal="true" aria-labelledby="tajuk-kata">
    <h3 id="tajuk-kata">Tukar kata laluan</h3>
    <p class="nota">Akaun: ${esc(S.session.user.email)}</p>
    <form id="f-kata">
      <label>Kata laluan semasa<input type="password" name="semasa" required autocomplete="current-password"></label>
      <label>Kata laluan baru<input type="password" name="baru" required minlength="8" autocomplete="new-password"></label>
      <label>Sahkan kata laluan baru<input type="password" name="sahkan" required minlength="8" autocomplete="new-password"></label>
      <p class="nota">Minimum 8 aksara. Gunakan gabungan huruf, nombor dan simbol.</p>
      <p class="mesej" id="mesej-kata"></p>
      <div class="baris-butang">
        <button type="button" class="sekunder" id="b-batal-kata">Batal</button>
        <button type="submit" class="utama">Simpan</button>
      </div>
    </form>
  </div>`;
  document.body.appendChild(lapik);

  const form = $("#f-kata", lapik);
  const tutup = () => {
    lapik.remove();
    document.removeEventListener("keydown", kekunci);
  };
  const kekunci = (e) => e.key === "Escape" && tutup();
  document.addEventListener("keydown", kekunci);
  lapik.addEventListener("mousedown", (e) => e.target === lapik && tutup());
  $("#b-batal-kata", lapik).onclick = tutup;
  form.semasa.focus();

  const tetapMesej = (t, j = "ralat") => {
    const m = $("#mesej-kata", lapik);
    m.textContent = t;
    m.className = `mesej ${j}`;
  };

  form.onsubmit = async (e) => {
    e.preventDefault();
    const semasa = form.semasa.value;
    const baru = form.baru.value;
    if (baru !== form.sahkan.value) return tetapMesej("Kata laluan baru dan pengesahan tidak sama.");
    if (baru.length < 8) return tetapMesej("Kata laluan baru mesti sekurang-kurangnya 8 aksara.");
    if (baru === semasa) return tetapMesej("Kata laluan baru mesti berbeza daripada kata laluan semasa.");

    const butang = form.querySelector("button[type=submit]");
    butang.disabled = true;
    try {
      const sah = await sb.auth.signInWithPassword({ email: S.session.user.email, password: semasa });
      if (sah.error) return tetapMesej("Kata laluan semasa salah.");
      const { error } = await sb.auth.updateUser({ password: baru });
      if (error) {
        if (/different from the old/i.test(error.message)) return tetapMesej("Kata laluan baru mesti berbeza daripada kata laluan lama.");
        if (/weak|pwned|leaked|compromised/i.test(error.message)) return tetapMesej("Kata laluan ini terlalu lemah atau pernah bocor. Pilih kata laluan lain.");
        return tetapMesej(error.message);
      }
      tutup();
      toast("Kata laluan berjaya ditukar.");
    } catch (err) {
      tetapMesej(mesejRalat(err));
    } finally {
      butang.disabled = false;
    }
  };
}

const stat = (label, nilai) => `<div class="stat"><span>${label}</span><strong>${nilai}</strong></div>`;

// ---------- Tab: Papan Beban ----------

function viewBeban() {
  const isi = $("#isi");
  const isGuruDG = (g) => /^DG/i.test(String(g.gred || "").trim());
  const ikutKumpulan = S.guruLengkap.filter((g) =>
    !S.bebanKumpulan || (S.bebanKumpulan === "guru" ? isGuruDG(g) : !isGuruDG(g)));
  const senaraiGred = [...new Set(ikutKumpulan.map((g) => g.gred).filter(Boolean))]
    .sort((a, b) => String(a).localeCompare(String(b), "ms", { numeric: true }));
  if (S.bebanGred && !senaraiGred.includes(S.bebanGred)) S.bebanGred = "";
  const cari = (S.bebanCari || "").trim().toLowerCase();
  const julatUmur = { "<30": [0, 29], "30-39": [30, 39], "40-49": [40, 49], "50+": [50, 999] };
  const senarai = ikutKumpulan.filter((g) => {
    const j = julatUmur[S.bebanUmur];
    return (!S.bebanGred || g.gred === S.bebanGred) &&
      (!cari || String(g.nama || "").toLowerCase().includes(cari)) &&
      (!j || (typeof g.umur === "number" && g.umur >= j[0] && g.umur <= j[1]));
  }).sort((a, b) => b.beban - a.beban);
  const adaTapis = !!(S.bebanCari || S.bebanGred || S.bebanUmur);
  const bilDG = S.guruLengkap.filter(isGuruDG).length;
  const kumpulan = [["", "Semua", S.guruLengkap.length], ["guru", "Guru (DG)", bilDG],
    ["sokongan", "Kakitangan sokongan", S.guruLengkap.length - bilDG]];
  const labelBil = S.bebanKumpulan === "guru" ? "Guru" : S.bebanKumpulan === "sokongan" ? "Kakitangan" : "Guru & staf";
  const beban = senarai.map((g) => g.beban);
  const maks = beban.length ? Math.max(...beban) : 0;
  const min = beban.length ? Math.min(...beban) : 0;
  const purata = beban.length ? beban.reduce((a, b) => a + b, 0) / beban.length : 0;
  const amaran = senarai.flatMap((g) => g.amaran);

  isi.innerHTML = `
  <div class="bar-alat">
    <div class="segmen">${kumpulan
      .map(([v, t, n]) => `<button type="button" data-kumpulan="${v}" class="${S.bebanKumpulan === v ? "aktif" : ""}">${t} <small>${n}</small></button>`)
      .join("")}</div>
    <div class="penapis">
      <input id="i-beban-cari" type="search" placeholder="Cari nama…" value="${esc(S.bebanCari || "")}">
      <select id="s-beban-gred" class="${S.bebanGred ? "aktif" : ""}"><option value="">Semua gred</option>${senaraiGred
        .map((v) => `<option value="${esc(v)}" ${S.bebanGred === v ? "selected" : ""}>${esc(v)}</option>`).join("")}</select>
      <select id="s-beban-umur" class="${S.bebanUmur ? "aktif" : ""}"><option value="">Semua umur</option>${[["<30", "Bawah 30 thn"], ["30-39", "30–39 thn"], ["40-49", "40–49 thn"], ["50+", "50 thn ke atas"]]
        .map(([v, t]) => `<option value="${v}" ${S.bebanUmur === v ? "selected" : ""}>${t}</option>`).join("")}</select>
      ${adaTapis ? '<button type="button" class="sekunder kecil" id="b-beban-reset">Set semula</button>' : ""}
    </div>
  </div>
  <div class="statistik">
    ${stat(labelBil, senarai.length)}${stat("Purata beban", nf(purata))}${stat("Tertinggi", nf(maks))}${stat("Terendah", nf(min))}${stat("Jurang", nf(maks - min))}
  </div>
  ${amaran.length ? `<div class="amaran"><strong>${amaran.length} amaran umur / JK fizikal</strong><ul>${amaran
    .map((a) => `<li>${esc(a.mesej)}</li>`)
    .join("")}</ul></div>` : ""}
  <div class="kad">
    <div class="petunjuk"><span><i class="tinggi"></i>Melebihi 125% purata</span><span><i></i>Sekitar purata</span><span><i class="rendah"></i>Bawah 75% purata</span></div>
    <table class="jadual">
      <thead><tr><th>Nama</th><th>Gred</th><th>Umur</th><th class="n">Lantikan</th><th class="n">Beban</th><th class="lebar">Taburan</th></tr></thead>
      <tbody>${senarai
        .map((g) => {
          const kelas = g.beban > purata * 1.25 ? "tinggi" : g.beban < purata * 0.75 ? "rendah" : "";
          return `<tr><td>${esc(g.nama)}${catatanPengurusan(g) ? `<span class="sub">${tagPengurusan(g)}</span>` : ""}</td><td class="nowrap">${esc(g.gred || "-")}</td><td>${g.umur ?? "-"}</td><td class="n">${g.lantikan.length}</td>
          <td class="n"><strong>${nf(g.beban)}</strong></td>
          <td><div class="palang"><span class="${kelas}" style="width:${maks ? (g.beban / maks) * 100 : 0}%"></span></div></td></tr>`;
        })
        .join("") || `<tr><td colspan="6" class="kosong">${S.guruLengkap.length ? "Tiada padanan untuk penapis ini." : "Tiada guru lagi. Tambah guru di tab Guru."}</td></tr>`}</tbody>
    </table>
  </div>`;

  isi.querySelectorAll("[data-kumpulan]").forEach((b) => {
    b.onclick = () => {
      S.bebanKumpulan = b.dataset.kumpulan;
      viewBeban();
    };
  });
  $("#s-beban-gred").onchange = (e) => {
    S.bebanGred = e.target.value;
    viewBeban();
  };

  const iCari = $("#i-beban-cari");
  iCari.oninput = () => {
    S.bebanCari = iCari.value;
    const pos = iCari.selectionStart;
    viewBeban();
    const baru = $("#i-beban-cari");
    baru.focus();
    baru.setSelectionRange(pos, pos);
  };
  $("#s-beban-umur").onchange = (e) => {
    S.bebanUmur = e.target.value;
    viewBeban();
  };
  const bReset = $("#b-beban-reset");
  if (bReset) bReset.onclick = () => {
    S.bebanCari = "";
    S.bebanGred = "";
    S.bebanUmur = "";
    viewBeban();
  };
}

// ---------- Tab: Lantikan ----------

function viewLantikan() {
  const isi = $("#isi");
  const jkAktif = S.jk.filter((j) => j.aktif);
  if (!jkAktif.some((j) => j.id === S.jkPilih)) S.jkPilih = jkAktif[0]?.id ?? null;
  const jk = S.jkMap.get(S.jkPilih);
  const indeks = binaIndeks(S.config);
  const had = S.config.tetapan.had_umur_fizikal;

  if (!jk) {
    isi.innerHTML = `<div class="kad kosong">Tiada jawatankuasa aktif. Tambah di tab Jawatankuasa.</div>`;
    return;
  }

  const ahli = S.lantikan
    .filter((l) => l.jk_id === jk.id)
    .map((l) => ({ l, g: S.guru.find((x) => x.id === l.guru_id), jw: S.jwMap.get(l.jawatan_id) }))
    .sort((a, b) => (b.jw?.asas || 0) - (a.jw?.asas || 0));
  const idAhli = new Set(ahli.map((a) => a.l.guru_id));

  const opsJK = ["A", "B", "C", "D", "E"]
    .map((k) => {
      const ops = jkAktif.filter((j) => j.kategori === k);
      if (!ops.length) return "";
      return `<optgroup label="Kategori ${k}">${ops
        .map((j) => `<option value="${j.id}" ${j.id === jk.id ? "selected" : ""}>${esc(j.kod)} — ${esc(j.nama)}</option>`)
        .join("")}</optgroup>`;
    })
    .join("");

  const guruSusun = [...S.guruLengkap].sort((a, b) => a.beban - b.beban);
  const opsGuru = (senarai) => `<option value="">${senarai.length ? "Pilih guru…" : "Tiada padanan"}</option>${senarai
    .map((g) => {
      const sekat = jk.fizikal && typeof g.umur === "number" && g.umur >= had;
      const sudah = idAhli.has(g.id);
      return `<option value="${g.id}">${esc(g.nama)}${catatanPengurusan(g) ? ` (${esc(catatanPengurusan(g))})` : ""}${g.gred ? ` · ${esc(g.gred)}` : ""} · beban ${nf(g.beban)}${g.umur ? ` · ${g.umur} thn` : ""}${
        sudah ? " · sudah dalam JK ini" : ""}${sekat ? " · ⚠ melebihi had umur fizikal" : ""}</option>`;
    })
    .join("")}`;
  const padanGuru = (q) => {
    const k = q.trim().toLowerCase();
    if (!k) return guruSusun;
    return guruSusun.filter((g) => [g.nama, g.no_gaji, g.gred].some((v) => String(v || "").toLowerCase().includes(k)));
  };

  isi.innerHTML = `
  <div class="dua-lajur">
    <section class="kad">
      <label>Jawatankuasa<select id="s-jk">${opsJK}</select></label>
      <p class="info">${jk.tempoh === "one_off" ? `One-off · skala ${esc(jk.skala)}` : "Sepanjang tahun"}
        ${jk.fizikal ? ' · <span class="tag fizikal">Fizikal</span>' : ""} · ${ahli.length} ahli</p>
      <table class="jadual">
        <thead><tr><th>Jawatan</th><th>Guru</th><th class="n">Pemberat</th><th></th></tr></thead>
        <tbody>${ahli
          .map(({ l, g, jw }) => {
            const p = kiraPemberat({ jawatan: jw?.nama, tempoh: jk.tempoh, skala: jk.skala }, S.config, indeks).pemberat;
            return `<tr><td>${esc(jw?.nama)}</td><td>${esc(g?.nama)}</td><td class="n">${nf(p)}</td>
              <td class="n"><button class="bahaya kecil" data-buang="${l.id}">Buang</button></td></tr>`;
          })
          .join("") || `<tr><td colspan="4" class="kosong">Belum ada ahli dalam jawatankuasa ini.</td></tr>`}</tbody>
      </table>
    </section>
    <section class="kad">
      <h3>Tambah lantikan</h3>
      <form id="f-lantik">
        <label>Jawatan<select name="jawatan" required>${S.jawatan
          .map((j) => `<option value="${j.id}">${esc(j.nama)} (asas ${nf(j.asas)})</option>`)
          .join("")}</select></label>
        <label>Guru
          <input type="search" id="i-cari-guru" placeholder="Cari nama, no. gaji atau gred…" autocomplete="off">
          <select name="guru" required>${opsGuru(guruSusun)}</select></label>
        <p class="nota" id="nota-padanan"></p>
        <div class="baris-butang">
          <button type="button" id="b-cadang" class="sekunder">Cadang guru</button>
          <button class="utama" type="submit">Lantik</button>
        </div>
        <p class="nota" id="nota-cadang">Senarai guru disusun dari beban terendah. "Cadang guru" memilih guru dengan beban terendah yang belum dalam JK ini dan layak dari segi umur bagi JK fizikal.</p>
      </form>
    </section>
  </div>`;

  $("#s-jk").onchange = (e) => {
    S.jkPilih = Number(e.target.value);
    viewLantikan();
  };

  isi.querySelectorAll("[data-buang]").forEach((b) => {
    b.onclick = () => {
      if (!confirm("Buang lantikan ini?")) return;
      cuba(async () => {
        semak(await sb.from("lantikan").delete().eq("id", Number(b.dataset.buang)));
        await segarkan();
      }, "Lantikan dibuang.");
    };
  });

  const form = $("#f-lantik");
  const iCariGuru = $("#i-cari-guru");
  const tapisGuru = () => {
    const pilih = form.guru.value;
    const padan = padanGuru(iCariGuru.value);
    form.guru.innerHTML = opsGuru(padan);
    if (padan.some((g) => String(g.id) === pilih)) form.guru.value = pilih;
    else if (padan.length === 1) form.guru.value = String(padan[0].id);
    $("#nota-padanan").textContent = iCariGuru.value.trim()
      ? `${padan.length} padanan${padan.length === 1 ? " — dipilih automatik" : ""}` : "";
  };
  iCariGuru.oninput = tapisGuru;
  iCariGuru.onkeydown = (e) => { if (e.key === "Enter") e.preventDefault(); };
  $("#b-cadang").onclick = () => {
    const jw = S.jwMap.get(Number(form.jawatan.value));
    const calon = S.guruLengkap
      .filter((g) => !idAhli.has(g.id))
      .map((g) => ({ nama: String(g.id), umur: g.umur, lantikan: g.lantikan }));
    if (!calon.length) return toast("Semua guru sudah berada dalam JK ini.", "ralat");
    const slot = { jk: jk.nama, jawatan: jw.nama, tempoh: jk.tempoh, skala: jk.skala, fizikal: jk.fizikal };
    const hasil = agihSeimbang(calon, [slot], S.config, { kecualiPengurusan: S.kecualiPengurusan });
    if (!hasil.agihan.length) return toast("Tiada guru layak (had umur bagi JK fizikal).", "ralat");
    if (![...form.guru.options].some((o) => o.value === hasil.agihan[0].guru)) {
      iCariGuru.value = "";
      tapisGuru();
    }
    form.guru.value = hasil.agihan[0].guru;
    const g = S.guru.find((x) => String(x.id) === hasil.agihan[0].guru);
    $("#nota-cadang").textContent = `Cadangan: ${g?.nama}. Tekan "Lantik" untuk sahkan.`;
  };

  form.onsubmit = (e) => {
    e.preventDefault();
    cuba(async () => {
      semak(await sb.from("lantikan").insert({
        guru_id: Number(form.guru.value),
        jk_id: jk.id,
        jawatan_id: Number(form.jawatan.value),
      }));
      await segarkan();
    }, "Lantikan disimpan.");
  };
}

// ---------- Tab: Guru ----------

// Umur daripada No. K/P (YYMMDD...) setakat hari ini.
function umurDariKP(kp) {
  const s = String(kp || "").replace(/\D/g, "");
  if (s.length !== 12) return null;
  const yy = Number(s.slice(0, 2)), mm = Number(s.slice(2, 4)), dd = Number(s.slice(4, 6));
  const kini = new Date();
  const tahun = yy > kini.getFullYear() % 100 ? 1900 + yy : 2000 + yy;
  const lahir = new Date(tahun, mm - 1, dd);
  if (lahir.getMonth() !== mm - 1) return null;
  let umur = kini.getFullYear() - tahun;
  if (kini.getMonth() < mm - 1 || (kini.getMonth() === mm - 1 && kini.getDate() < dd)) umur -= 1;
  return umur >= 18 && umur <= 75 ? umur : null;
}

function viewGuru() {
  const isi = $("#isi");
  const ed = S.guruEdit ? S.guru.find((g) => g.id === S.guruEdit) : null;
  const bilLantikan = (id) => S.lantikan.filter((l) => l.guru_id === id).length;
  const senaraiUnit = [...new Set(S.guru.map((g) => g.unit).filter(Boolean))].sort();
  const unik = (k) => [...new Set(S.guru.map((g) => g[k]).filter(Boolean))]
    .sort((a, b) => String(a).localeCompare(String(b), "ms", { numeric: true }));
  const senaraiGred = unik("gred");
  const senaraiJawatan = unik("jawatan_hakiki");
  const T = S.guruTapis;
  const had = S.config?.tetapan?.had_umur_fizikal ?? 50;
  const cari = (S.guruCari || "").toLowerCase();
  const senarai = S.guru.filter((g) => {
    const bil = bilLantikan(g.id);
    return (!S.guruUnit || g.unit === S.guruUnit) &&
      (!T.gred || g.gred === T.gred) &&
      (!T.jawatan || g.jawatan_hakiki === T.jawatan) &&
      (!T.peranan || (T.peranan === "admin" ? g.peranan === "admin" : g.peranan !== "admin")) &&
      (!T.jk || (T.jk === "0" ? bil === 0 : T.jk === "1-2" ? bil >= 1 && bil <= 2 : bil >= 3)) &&
      (!T.umur || (typeof g.umur === "number" && (T.umur === "bawah" ? g.umur < had : g.umur >= had))) &&
      (!cari || [g.nama, g.no_gaji, g.jawatan_hakiki, g.gred, g.email].some((v) => String(v || "").toLowerCase().includes(cari)));
  });
  const adaTapis = !!(S.guruCari || S.guruUnit || Object.values(T).some(Boolean));
  const pilihan = (id, label, nilai, ops) => `<select id="${id}" class="${nilai ? "aktif" : ""}"><option value="">${label}</option>${ops
    .map(([v, t]) => `<option value="${esc(v)}" ${nilai === v ? "selected" : ""}>${esc(t)}</option>`).join("")}</select>`;

  isi.innerHTML = `
  <div class="dua-lajur lebar-kiri">
    <section class="kad">
      <div class="bar-alat">
        <h3>Guru & staf (${senarai.length}${senarai.length !== S.guru.length ? ` daripada ${S.guru.length}` : ""})</h3>
        <div class="penapis">
          <input id="i-cari" type="search" placeholder="Cari nama, no. gaji, jawatan, gred…" value="${esc(S.guruCari || "")}">
        </div>
      </div>
      <div class="penapis tapis-guru">
        ${pilihan("s-unit", "Semua unit", S.guruUnit, senaraiUnit.map((u) => [u, u]))}
        ${pilihan("t-gred", "Semua gred", T.gred, senaraiGred.map((v) => [v, v]))}
        ${pilihan("t-jawatan", "Semua jawatan", T.jawatan, senaraiJawatan.map((v) => [v, v]))}
        ${pilihan("t-peranan", "Semua peranan", T.peranan, [["admin", "Admin"], ["guru", "Guru/Staf"]])}
        ${pilihan("t-jk", "Semua bil. JK", T.jk, [["0", "Tiada JK"], ["1-2", "1–2 JK"], ["3+", "3 JK ke atas"]])}
        ${pilihan("t-umur", "Semua umur", T.umur, [["bawah", `Bawah ${had} thn`], ["atas", `${had} thn ke atas`]])}
        ${adaTapis ? '<button type="button" class="sekunder kecil" id="b-reset-tapis">Set semula</button>' : ""}
      </div>
      <table class="jadual">
        <thead><tr><th>Nama</th><th>Jawatan</th><th>Gred</th><th>No. Gaji</th><th>No. K/P</th><th>Umur</th><th>Peranan</th><th class="n">JK</th><th></th></tr></thead>
        <tbody>${senarai
          .map((g) => `<tr>
            <td>${esc(g.nama)}<span class="sub">${tagPengurusan(g)}${catatanPengurusan(g) && g.unit ? " " : ""}${esc(g.unit || "")}</span></td>
            <td>${esc(g.jawatan_hakiki || "-")}</td>
            <td class="nowrap">${esc(g.gred || "-")}</td>
            <td>${esc(g.no_gaji || "-")}</td>
            <td>${esc(topengKP(g.no_kp))}</td>
            <td>${g.umur ?? "-"}</td>
            <td>${g.peranan === "admin"
              ? `<span class="tag">Admin</span> ${g.auth_id ? '<span class="tag ok">Akaun aktif</span>' : '<span class="tag">Tiada akaun</span>'}`
              : "Guru/Staf"}</td>
            <td class="n">${bilLantikan(g.id)}</td>
            <td class="n nowrap"><button class="sekunder kecil" data-edit="${g.id}">Edit</button>
              <button class="bahaya kecil" data-padam="${g.id}">Padam</button></td></tr>`)
          .join("") || `<tr><td colspan="9" class="kosong">Tiada padanan.</td></tr>`}</tbody>
      </table>
    </section>
    <div>
      <section class="kad">
        <h3>${ed ? "Edit guru / staf" : "Tambah guru / staf"}</h3>
        <form id="f-guru">
          <label>Nama penuh<input name="nama" required value="${esc(ed?.nama)}"></label>
          <label>Jawatan<input name="jawatan_hakiki" value="${esc(ed?.jawatan_hakiki)}" placeholder="cth GURU MATEMATIK"></label>
          <div class="grid-2">
            <label>Unit<input name="unit" list="dl-unit" value="${esc(ed?.unit)}"></label>
            <label>Gred<input name="gred" value="${esc(ed?.gred)}"></label>
          </div>
          <datalist id="dl-unit">${senaraiUnit.map((u) => `<option value="${esc(u)}">`).join("")}</datalist>
          <div class="grid-2">
            <label>No. Gaji (untuk semakan)<input name="no_gaji" required value="${esc(ed?.no_gaji)}"></label>
            <label>No. K/P<input name="no_kp" value="${esc(ed?.no_kp)}" inputmode="numeric"></label>
          </div>
          <div class="grid-2">
            <label>Umur<input name="umur" type="number" min="18" max="75" value="${esc(ed?.umur)}" placeholder="auto dari K/P"></label>
            <label>Peranan<select name="peranan">
              <option value="guru" ${ed?.peranan !== "admin" ? "selected" : ""}>Guru / Staf</option>
              <option value="admin" ${ed?.peranan === "admin" ? "selected" : ""}>Admin</option></select></label>
          </div>
          <label>Email<input name="email" type="email" value="${esc(ed?.email)}"></label>
          <p class="nota">Hanya peranan Admin boleh log masuk (akaun dicipta di Supabase). Guru/staf menyemak lantikan dengan No. Gaji.</p>
          <div class="baris-butang">
            ${ed ? '<button type="button" class="sekunder" id="b-batal">Batal</button>' : ""}
            <button class="utama" type="submit">${ed ? "Simpan" : "Tambah"}</button>
          </div>
        </form>
      </section>
      <section class="kad">
        <h3>Import ramai guru / staf</h3>
        <p class="nota">Satu orang setiap baris: <code>nama, no_gaji, no_kp, jawatan, unit, email, gred</code>. Boleh tampal terus dari Excel (dipisah tab). Umur dikira daripada No. K/P.</p>
        <textarea id="t-import" rows="5" placeholder="AHMAD BIN ALI&#9;212345&#9;850101015555&#9;GURU FIZIK&#9;JABATAN SAINS&#9;ahmad@mara.gov.my"></textarea>
        <div class="baris-butang"><button class="utama" id="b-import">Import</button></div>
      </section>
    </div>
  </div>`;

  const iCari = $("#i-cari");
  iCari.oninput = () => {
    S.guruCari = iCari.value;
    const pos = iCari.selectionStart;
    viewGuru();
    const baru = $("#i-cari");
    baru.focus();
    baru.setSelectionRange(pos, pos);
  };
  $("#s-unit").onchange = (e) => {
    S.guruUnit = e.target.value;
    viewGuru();
  };
  [["t-gred", "gred"], ["t-jawatan", "jawatan"], ["t-peranan", "peranan"], ["t-jk", "jk"], ["t-umur", "umur"]]
    .forEach(([id, k]) => {
      $("#" + id).onchange = (e) => {
        S.guruTapis[k] = e.target.value;
        viewGuru();
      };
    });
  const bReset = $("#b-reset-tapis");
  if (bReset) bReset.onclick = () => {
    S.guruCari = "";
    S.guruUnit = "";
    S.guruTapis = { gred: "", jawatan: "", peranan: "", jk: "", umur: "" };
    viewGuru();
  };

  isi.querySelectorAll("[data-edit]").forEach((b) => {
    b.onclick = () => {
      S.guruEdit = Number(b.dataset.edit);
      viewGuru();
      $("#f-guru").scrollIntoView({ behavior: "smooth", block: "start" });
    };
  });

  isi.querySelectorAll("[data-padam]").forEach((b) => {
    b.onclick = () => {
      const id = Number(b.dataset.padam);
      if (id === S.saya.id) return toast("Anda tidak boleh memadam akaun anda sendiri.", "ralat");
      const g = S.guru.find((x) => x.id === id);
      if (!confirm(`Padam ${g?.nama}? Semua lantikannya (${bilLantikan(id)}) juga akan dipadam.`)) return;
      cuba(async () => {
        semak(await sb.from("guru").delete().eq("id", id));
        if (S.guruEdit === id) S.guruEdit = null;
        await segarkan();
      }, "Rekod dipadam.");
    };
  });

  if (ed) {
    $("#b-batal").onclick = () => {
      S.guruEdit = null;
      viewGuru();
    };
  }

  const form = $("#f-guru");
  form.no_kp.addEventListener("change", () => {
    const u = umurDariKP(form.no_kp.value);
    if (u && !form.umur.value) form.umur.value = u;
  });

  form.onsubmit = (e) => {
    e.preventDefault();
    const no_kp = kosongJadiNull(form.no_kp.value)?.replace(/\D/g, "") || null;
    const rekod = {
      nama: form.nama.value.trim(),
      jawatan_hakiki: kosongJadiNull(form.jawatan_hakiki.value),
      unit: kosongJadiNull(form.unit.value),
      gred: kosongJadiNull(form.gred.value),
      no_gaji: kosongJadiNull(form.no_gaji.value),
      no_kp,
      umur: form.umur.value ? Number(form.umur.value) : umurDariKP(no_kp),
      email: kosongJadiNull(form.email.value)?.toLowerCase() ?? null,
      peranan: form.peranan.value,
    };
    if (ed && ed.id === S.saya.id && rekod.peranan !== "admin") {
      return toast("Anda tidak boleh menurunkan peranan admin anda sendiri.", "ralat");
    }
    if (rekod.peranan === "admin" && !rekod.email) {
      return toast("Admin mesti mempunyai email untuk log masuk.", "ralat");
    }
    cuba(async () => {
      if (ed) semak(await sb.from("guru").update(rekod).eq("id", ed.id));
      else semak(await sb.from("guru").insert(rekod));
      S.guruEdit = null;
      await segarkan();
    }, ed ? "Rekod dikemas kini." : "Rekod ditambah.");
  };

  $("#b-import").onclick = () => {
    const baris = $("#t-import").value.split(/\r?\n/).map((b) => b.trim()).filter(Boolean);
    if (!baris.length) return toast("Tiada data untuk diimport.", "ralat");
    const rekod = baris.map((b) => {
      const [nama, no_gaji, no_kp, jawatan, unit, email, gred] = b.split(/\t|,/).map((x) => x.trim());
      const kp = kosongJadiNull(no_kp)?.replace(/\D/g, "") || null;
      return {
        nama,
        no_gaji: kosongJadiNull(no_gaji),
        no_kp: kp,
        umur: umurDariKP(kp),
        jawatan_hakiki: kosongJadiNull(jawatan),
        unit: kosongJadiNull(unit),
        gred: kosongJadiNull(gred),
        email: kosongJadiNull(email)?.toLowerCase() ?? null,
      };
    }).filter((r) => r.nama);
    cuba(async () => {
      semak(await sb.from("guru").insert(rekod));
      $("#t-import").value = "";
      await segarkan();
    }, `${rekod.length} rekod diimport.`);
  };
}

// ---------- Tab: Jawatankuasa ----------

function viewJK() {
  const isi = $("#isi");
  const ed = S.jkEdit ? S.jkMap.get(S.jkEdit) : null;
  const senarai = S.jk.filter((j) => !S.jkTapis || j.kategori === S.jkTapis);
  const bilAhli = (id) => S.lantikan.filter((l) => l.jk_id === id).length;
  const opsKategori = (pilih) =>
    ["A", "B", "C", "D", "E"].map((k) => `<option ${pilih === k ? "selected" : ""}>${k}</option>`).join("");

  isi.innerHTML = `
  <div class="dua-lajur lebar-kiri">
    <section class="kad">
      <div class="bar-alat">
        <h3>Jawatankuasa (${senarai.length})</h3>
        <select id="s-tapis"><option value="">Semua kategori</option>${["A", "B", "C", "D", "E"]
          .map((k) => `<option value="${k}" ${S.jkTapis === k ? "selected" : ""}>Kategori ${k}</option>`)
          .join("")}</select>
      </div>
      <table class="jadual">
        <thead><tr><th>Kod</th><th>Nama</th><th>Tempoh</th><th>Skala</th><th></th><th class="n">Ahli</th><th></th></tr></thead>
        <tbody>${senarai
          .map((j) => `<tr class="${j.aktif ? "" : "pudar"}">
            <td><strong>${esc(j.kod)}</strong></td><td>${esc(j.nama)}</td>
            <td>${j.tempoh === "one_off" ? "One-off" : "Tahunan"}</td>
            <td>${j.tempoh === "one_off" ? esc(j.skala) : "-"}</td>
            <td>${j.fizikal ? '<span class="tag fizikal">Fizikal</span>' : ""}${j.aktif ? "" : ' <span class="tag">Tidak aktif</span>'}</td>
            <td class="n">${bilAhli(j.id)}</td>
            <td class="n nowrap"><button class="sekunder kecil" data-edit="${j.id}">Edit</button>
              <button class="bahaya kecil" data-padam="${j.id}">Padam</button></td></tr>`)
          .join("") || `<tr><td colspan="7" class="kosong">Tiada jawatankuasa.</td></tr>`}</tbody>
      </table>
    </section>
    <section class="kad">
      <h3>${ed ? `Edit ${esc(ed.kod)}` : "Tambah jawatankuasa / program"}</h3>
      <form id="f-jk">
        <div class="grid-2">
          <label>Kod<input name="kod" value="${esc(ed?.kod)}" placeholder="cth E37"></label>
          <label>Kategori<select name="kategori">${opsKategori(ed?.kategori || "E")}</select></label>
        </div>
        <label>Nama<input name="nama" required value="${esc(ed?.nama)}"></label>
        <div class="grid-2">
          <label>Tempoh<select name="tempoh">
            <option value="tahunan" ${ed?.tempoh === "tahunan" ? "selected" : ""}>Sepanjang tahun</option>
            <option value="one_off" ${!ed || ed.tempoh === "one_off" ? "selected" : ""}>One-off</option></select></label>
          <label>Skala (one-off)<select name="skala">
            ${["besar", "sederhana", "kecil"].map((s) => `<option ${(ed?.skala || "sederhana") === s ? "selected" : ""}>${s}</option>`).join("")}
          </select></label>
        </div>
        <label class="semak"><input type="checkbox" name="fizikal" ${ed?.fizikal ? "checked" : ""}> Program fizikal (sukan / kem lasak)</label>
        <label class="semak"><input type="checkbox" name="aktif" ${!ed || ed.aktif ? "checked" : ""}> Aktif (dikira dalam beban & surat)</label>
        <div class="baris-butang">
          ${ed ? '<button type="button" class="sekunder" id="b-batal">Batal</button>' : ""}
          <button class="utama" type="submit">${ed ? "Simpan" : "Tambah"}</button>
        </div>
      </form>
    </section>
  </div>`;

  $("#s-tapis").onchange = (e) => {
    S.jkTapis = e.target.value;
    viewJK();
  };
  isi.querySelectorAll("[data-edit]").forEach((b) => {
    b.onclick = () => {
      S.jkEdit = Number(b.dataset.edit);
      viewJK();
    };
  });
  isi.querySelectorAll("[data-padam]").forEach((b) => {
    b.onclick = () => {
      const id = Number(b.dataset.padam);
      const j = S.jkMap.get(id);
      if (!confirm(`Padam ${j.kod} ${j.nama}? ${bilAhli(id)} lantikan dalamnya juga akan dipadam.\n\nTip: nyahtanda "Aktif" jika hanya mahu menyembunyikannya.`)) return;
      cuba(async () => {
        semak(await sb.from("jawatankuasa").delete().eq("id", id));
        if (S.jkEdit === id) S.jkEdit = null;
        await segarkan();
      }, "Jawatankuasa dipadam.");
    };
  });
  if (ed) {
    $("#b-batal").onclick = () => {
      S.jkEdit = null;
      viewJK();
    };
  }

  const form = $("#f-jk");
  form.onsubmit = (e) => {
    e.preventDefault();
    const rekod = {
      kod: kosongJadiNull(form.kod.value)?.toUpperCase() ?? null,
      nama: form.nama.value.trim(),
      kategori: form.kategori.value,
      tempoh: form.tempoh.value,
      skala: form.skala.value,
      fizikal: form.fizikal.checked,
      aktif: form.aktif.checked,
    };
    cuba(async () => {
      if (ed) semak(await sb.from("jawatankuasa").update(rekod).eq("id", ed.id));
      else semak(await sb.from("jawatankuasa").insert(rekod));
      S.jkEdit = null;
      await segarkan();
    }, ed ? "Jawatankuasa dikemas kini." : "Jawatankuasa ditambah.");
  };
}

// ---------- Tab: Pemberat ----------

function viewPemberat() {
  const isi = $("#isi");
  const c = S.config;
  const opsKat = (pilih) =>
    ["pelaksana", "pengurusan", "ahli", "kokurikulum", "subtugas"]
      .map((k) => `<option ${pilih === k ? "selected" : ""}>${k}</option>`).join("");
  const opsTempoh = (pilih) =>
    [["", "Ikut JK"], ["tahunan", "Sentiasa tahunan"], ["one_off", "Sentiasa one-off"]]
      .map(([v, t]) => `<option value="${v}" ${(pilih || "") === v ? "selected" : ""}>${t}</option>`).join("");

  isi.innerHTML = `
  <div class="dua-lajur lebar-kiri">
    <section class="kad">
      <h3>Pemberat asas jawatan</h3>
      <p class="nota">Pemberat akhir = asas × faktor tempoh × faktor skala. Perubahan di sini terus mengubah beban semua guru.</p>
      <table class="jadual">
        <thead><tr><th>Jawatan</th><th>Asas</th><th>Kategori</th><th>Tempoh</th><th></th></tr></thead>
        <tbody>${S.jawatan
          .map((j) => `<tr data-baris="${j.id}">
            <td><input name="nama" value="${esc(j.nama)}"></td>
            <td><input name="asas" type="number" step="0.5" min="0" max="99" value="${nf(j.asas)}" class="kecil-input"></td>
            <td><select name="kategori">${opsKat(j.kategori)}</select></td>
            <td><select name="tempoh_tetap">${opsTempoh(j.tempoh_tetap)}</select></td>
            <td class="n nowrap"><button class="utama kecil" data-simpan="${j.id}">Simpan</button>
              <button class="bahaya kecil" data-padam="${j.id}">Padam</button></td></tr>`)
          .join("")}
          <tr data-baris="baru" class="baris-baru">
            <td><input name="nama" placeholder="Jawatan baru"></td>
            <td><input name="asas" type="number" step="0.5" min="0" max="99" value="4" class="kecil-input"></td>
            <td><select name="kategori">${opsKat("ahli")}</select></td>
            <td><select name="tempoh_tetap">${opsTempoh("")}</select></td>
            <td class="n"><button class="utama kecil" data-simpan="baru">Tambah</button></td></tr>
        </tbody>
      </table>
    </section>
    <section class="kad">
      <h3>Faktor & tetapan</h3>
      <form id="f-tetapan">
        <label>Faktor tempoh one-off<input name="one_off" type="number" step="0.05" min="0" max="2" value="${c.faktor_tempoh.one_off}"></label>
        <div class="grid-3">
          <label>Skala besar<input name="besar" type="number" step="0.05" min="0" max="3" value="${c.faktor_skala.besar}"></label>
          <label>Sederhana<input name="sederhana" type="number" step="0.05" min="0" max="3" value="${c.faktor_skala.sederhana}"></label>
          <label>Kecil<input name="kecil" type="number" step="0.05" min="0" max="3" value="${c.faktor_skala.kecil}"></label>
        </div>
        <label>Had umur JK fizikal<input name="had" type="number" min="18" max="75" value="${c.tetapan.had_umur_fizikal}"></label>
        <div class="baris-butang"><button class="utama" type="submit">Simpan tetapan</button></div>
      </form>
    </section>
  </div>`;

  isi.querySelectorAll("[data-simpan]").forEach((b) => {
    b.onclick = () => {
      const tr = isi.querySelector(`[data-baris="${b.dataset.simpan}"]`);
      const rekod = {
        nama: $("[name=nama]", tr).value.trim(),
        asas: Number($("[name=asas]", tr).value),
        kategori: $("[name=kategori]", tr).value,
        tempoh_tetap: $("[name=tempoh_tetap]", tr).value || null,
      };
      if (!rekod.nama) return toast("Nama jawatan diperlukan.", "ralat");
      cuba(async () => {
        if (b.dataset.simpan === "baru") semak(await sb.from("jawatan").insert(rekod));
        else semak(await sb.from("jawatan").update(rekod).eq("id", Number(b.dataset.simpan)));
        await segarkan();
      }, "Pemberat disimpan.");
    };
  });

  isi.querySelectorAll("[data-padam]").forEach((b) => {
    b.onclick = () => {
      if (!confirm("Padam jawatan ini?")) return;
      cuba(async () => {
        semak(await sb.from("jawatan").delete().eq("id", Number(b.dataset.padam)));
        await segarkan();
      }, "Jawatan dipadam.");
    };
  });

  const form = $("#f-tetapan");
  form.onsubmit = (e) => {
    e.preventDefault();
    const rekod = [
      { kunci: "faktor_tempoh", nilai: { tahunan: 1.0, one_off: Number(form.one_off.value) } },
      { kunci: "faktor_skala", nilai: { besar: Number(form.besar.value), sederhana: Number(form.sederhana.value), kecil: Number(form.kecil.value) } },
      { kunci: "had_umur_fizikal", nilai: Number(form.had.value) },
    ];
    cuba(async () => {
      semak(await sb.from("tetapan").upsert(rekod));
      await segarkan();
    }, "Tetapan disimpan.");
  };
}

// ---------- Surat lantikan ----------

function gabungSurat(halaman) {
  if (halaman.length === 1) return halaman[0];
  const kepala = halaman[0].split("<body>")[0];
  const badan = halaman.map((h) => h.split("<body>")[1].split("</body>")[0]);
  return `${kepala}<body>${badan
    .map((b, i) => `<div${i < badan.length - 1 ? ' style="page-break-after:always"' : ""}>${b}</div>`)
    .join("")}</body></html>`;
}

function binaSurat(senaraiGuru, opsyen, config = S.config) {
  const maklumat = {
    nama: MAKLUMAT_SEKOLAH.nama,
    sesi: S.surat.sesi,
    tarikh: S.surat.tarikh
      ? new Date(`${S.surat.tarikh}T00:00:00`).toLocaleDateString("ms-MY", { day: "numeric", month: "long", year: "numeric" })
      : "",
    penandatangan: S.surat.penandatangan,
  };
  return gabungSurat(senaraiGuru.map((g) => suratHTML(dataSurat(g, config, maklumat), opsyen)));
}

function cetak(html) {
  const w = window.open("", "_blank");
  if (!w) return toast("Tetingkap pop-up disekat. Benarkan pop-up untuk laman ini.", "ralat");
  w.document.open();
  w.document.write(html);
  w.document.close();
  setTimeout(() => {
    w.focus();
    w.print();
  }, 400);
}

function viewSurat() {
  const isi = $("#isi");
  const ada = S.guruLengkap.filter((g) => g.lantikan.length);
  const pilihan = S.surat.guru === "semua" ? ada : ada.filter((g) => String(g.id) === S.surat.guru);
  const opsyen = { lindungKP: S.surat.lindungKP, paparPemberat: S.surat.paparPemberat };
  const pratonton = pilihan.length ? binaSurat(pilihan.slice(0, 1), opsyen) : "";

  isi.innerHTML = `
  <div class="dua-lajur lebar-kanan">
    <section class="kad">
      <h3>Tetapan surat</h3>
      <form id="f-surat">
        <label>Guru<select name="guru">
          <option value="semua" ${S.surat.guru === "semua" ? "selected" : ""}>Semua guru yang ada lantikan (${ada.length})</option>
          ${ada.map((g) => `<option value="${g.id}" ${S.surat.guru === String(g.id) ? "selected" : ""}>${esc(g.nama)} (${g.lantikan.length})</option>`).join("")}
        </select></label>
        <div class="grid-2">
          <label>Sesi<input name="sesi" value="${esc(S.surat.sesi)}"></label>
          <label>Tarikh<input name="tarikh" type="date" value="${esc(S.surat.tarikh)}"></label>
        </div>
        <label>Penandatangan<input name="penandatangan" value="${esc(S.surat.penandatangan)}"></label>
        <label class="semak"><input type="checkbox" name="paparPemberat" ${S.surat.paparPemberat ? "checked" : ""}> Papar lajur pemberat & jumlah beban</label>
        <label class="semak"><input type="checkbox" name="lindungKP" ${S.surat.lindungKP ? "checked" : ""}> Tutup separa No. K/P</label>
        <div class="baris-butang"><button class="utama" type="button" id="b-cetak" ${pilihan.length ? "" : "disabled"}>
          Cetak ${pilihan.length > 1 ? `${pilihan.length} surat` : "surat"}</button></div>
        ${ada.length ? "" : '<p class="nota">Belum ada guru yang mempunyai lantikan.</p>'}
      </form>
    </section>
    <section class="kad">
      <h3>Pratonton${pilihan.length > 1 ? " (surat pertama)" : ""}</h3>
      ${pratonton ? `<iframe class="pratonton" id="ifr"></iframe>` : '<p class="kosong">Tiada surat untuk dipratonton.</p>'}
    </section>
  </div>`;

  if (pratonton) $("#ifr").srcdoc = pratonton;

  const form = $("#f-surat");
  form.onchange = () => {
    S.surat = {
      guru: form.guru.value,
      sesi: form.sesi.value,
      tarikh: form.tarikh.value,
      penandatangan: form.penandatangan.value,
      paparPemberat: form.paparPemberat.checked,
      lindungKP: form.lindungKP.checked,
    };
    viewSurat();
  };
  $("#b-cetak").onclick = () => cetak(binaSurat(pilihan, opsyen));
}

mula();
