// supabaseData.js
// Jambatan antara Supabase dan modul pengiraan.
// Terima klien @supabase/supabase-js yang sudah dimulakan & dilog masuk.
// RLS di server pastikan guru hanya dapat data sendiri.

import { kiraBebanGuru } from "./pengiraanBeban.js";

// Bina objek config (serasi pengiraanBeban) daripada jadual Supabase.
export async function muatConfig(supabase) {
  const [{ data: jawatan, error: e1 }, { data: tetapan, error: e2 }] = await Promise.all([
    supabase.from("jawatan").select("*"),
    supabase.from("tetapan").select("*"),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;

  const t = Object.fromEntries((tetapan || []).map((r) => [r.kunci, r.nilai]));

  const rekod = (jawatan || []).map((j) => ({
    jawatan: j.nama,
    asas: Number(j.asas),
    kategori: j.kategori,
    ...(j.tempoh_tetap ? { tempoh: j.tempoh_tetap } : {}),
    nota: j.nota || "",
    alias: [],
  }));

  return {
    faktor_tempoh: t.faktor_tempoh || { tahunan: 1.0, one_off: 0.7 },
    faktor_skala: t.faktor_skala || { besar: 1.2, sederhana: 1.0, kecil: 0.8 },
    tetapan: { had_umur_fizikal: Number(t.had_umur_fizikal ?? 50) },
    // semua rekod dimasukkan ke satu senarai; binaIndeks() tetap jumpa
    jawatan_utama: rekod,
    jawatan_kokurikulum: [],
    subtugas_one_off: [],
  };
}

// Muat seorang/semua guru + lantikan (join jawatankuasa & jawatan) ke bentuk pengiraan.
export async function muatGuru(supabase, guruId = null) {
  let q = supabase
    .from("guru")
    .select(`
      id, nama, no_kp, no_gaji, umur, peranan,
      lantikan (
        id, catatan,
        jawatankuasa:jk_id ( kod, nama, kategori, tempoh, skala, fizikal ),
        jawatan:jawatan_id ( nama )
      )
    `);
  if (guruId) q = q.eq("id", guruId);

  const { data, error } = await q;
  if (error) throw error;

  return (data || []).map((g) => ({
    id: g.id,
    nama: g.nama,
    no_kp: g.no_kp,
    no_gaji: g.no_gaji,
    umur: g.umur,
    peranan: g.peranan,
    lantikan: (g.lantikan || []).map((l) => ({
      jk: l.jawatankuasa?.nama,
      kod: l.jawatankuasa?.kod,
      kategori: l.jawatankuasa?.kategori,
      jawatan: l.jawatan?.nama,
      tempoh: l.jawatankuasa?.tempoh,
      skala: l.jawatankuasa?.skala,
      fizikal: l.jawatankuasa?.fizikal,
    })),
  }));
}

// Muat guru + terus kira beban.
export async function muatDanKira(supabase, guruId = null, opsyen = {}) {
  const [config, guru] = await Promise.all([muatConfig(supabase), muatGuru(supabase, guruId)]);
  return guru.map((g) => ({ ...g, ...kiraBebanGuru(g, config, opsyen) }));
}

export default { muatConfig, muatGuru, muatDanKira };
