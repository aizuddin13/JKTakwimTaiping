// Konfigurasi sambungan Supabase.
// Kunci "publishable" memang selamat untuk didedahkan di browser:
// akses data dikawal oleh RLS di pangkalan data, bukan oleh kunci ini.
export const SUPABASE_URL = "https://fuwzgoivwjurtrwqkfqk.supabase.co";
export const SUPABASE_KEY = "sb_publishable_WAdGrVTJ8Fi3Dc1bSy5jSg_V5Boftet";

// Maklumat lalai untuk surat lantikan (boleh diubah dalam tab Surat Lantikan).
// Format surat mengikut memograf rasmi MARA (lihat src/suratLantikan.js).
export const MAKLUMAT_SEKOLAH = {
  nama: "Maktab Rendah Sains MARA Taiping",
  negeri: "Perak",
  sesi: "2027",
  rujukan: "MRSMTPG.100-4/1/1 (   )",          // Rujuk Kami
  penandatangan: "ARIFAH ILYANA BINTI ABDUL RAHMAN",
  jawatanPenandatangan: "Pengetua",
  bagiPihak: "",                                // cth. "Pengetua" jika ditandatangani b.p. (bagi pihak)
};

// Pengurusan tertinggi — catatan dipaparkan di bawah nama (padanan nama, tak sensitif huruf besar/kecil).
export const PENGURUSAN_TERTINGGI = {
  "ARIFAH ILYANA BINTI ABDUL RAHMAN": "Pengetua",
  "AHMAD SYUKRI BIN AHMAD HARIRI": "Timbalan Pengetua Kecemerlangan Akademik",
  "ROZAIDI BIN ISHAK": "Timbalan Pengetua Pembangunan Pelajar",
  "MOHAMAD KHAIRUL AIZUDDIN BIN KHASIM": "Timbalan Pengetua Pembangunan Bakat",
  "SITI AMINAH BINTI ABDULLAH": "Penolong Pegawai Tadbir Kanan",
};

// Pasangan program yang amaran tarikhnya DIABAIKAN (dirancang berlangsung serentak
// dengan jawatankuasa yang sama). Tambah/buang pasangan di sini.
export const ABAI_AMARAN_TARIKH = [
  ["E14", "E15"], // Pendaftaran T5 & T4
  ["E4", "E36"],  // Anugerah SPM & Kejohanan Sukan MRSM
  ["E17", "E29"], // Hari Raya Perdana & Minggu Aktiviti Sem 1
  ["E25", "E26"], // Kejohanan SUPER & Sukan Maktab (Rumah Sukan)
];
