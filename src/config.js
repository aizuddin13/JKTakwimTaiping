// Konfigurasi sambungan Supabase.
// Kunci "publishable" memang selamat untuk didedahkan di browser:
// akses data dikawal oleh RLS di pangkalan data, bukan oleh kunci ini.
export const SUPABASE_URL = "https://fuwzgoivwjurtrwqkfqk.supabase.co";
export const SUPABASE_KEY = "sb_publishable_WAdGrVTJ8Fi3Dc1bSy5jSg_V5Boftet";

// Maklumat lalai untuk surat lantikan (boleh diubah dalam tab Surat Lantikan).
export const MAKLUMAT_SEKOLAH = {
  nama: "Maktab Rendah Sains MARA Taiping",
  sesi: "2027",
  penandatangan: "Pengetua",
};

// Pengurusan tertinggi — catatan dipaparkan di bawah nama (padanan nama, tak sensitif huruf besar/kecil).
export const PENGURUSAN_TERTINGGI = {
  "ARIFAH ILYANA BINTI ABDUL RAHMAN": "Pengetua",
  "AHMAD SYUKRI BIN AHMAD HARIRI": "Timbalan Pengetua Kecemerlangan Akademik",
  "ROZAIDI BIN ISHAK": "Timbalan Pengetua Pembangunan Pelajar",
  "MOHAMAD KHAIRUL AIZUDDIN BIN KHASIM": "Timbalan Pengetua Pembangunan Bakat",
  "SITI AMINAH BINTI ABDULLAH": "Penolong Pegawai Tadbir Kanan",
};
