// penyeimbang.js
// Langkah 1 (auto-balance) + Langkah 2 (faktor umur / JK fizikal).
// Bergantung pada pengiraanBeban.js.

import { kiraPemberat, kiraBebanGuru, binaIndeks } from "./pengiraanBeban.js";

// ---------- Langkah 2: Semak kesesuaian umur vs JK fizikal ----------

// guru = { nama, umur, lantikan: [ { jawatan, tempoh, skala, fizikal?, jk? } ] }
export function semakKesesuaian(guru, config) {
  const had = config.tetapan?.had_umur_fizikal ?? 50;
  const amaran = [];
  for (const l of guru.lantikan || []) {
    if (l.fizikal && typeof guru.umur === "number" && guru.umur >= had) {
      amaran.push({
        jk: l.jk || null,
        jawatan: l.jawatan,
        mesej: `Guru ${guru.nama} (umur ${guru.umur}) dipadankan dengan JK fizikal "${l.jk || l.jawatan}" — melebihi had umur ${had}.`,
      });
    }
  }
  return amaran;
}

function layakFizikal(guru, slot, had) {
  if (!slot.fizikal) return true;
  if (typeof guru.umur !== "number") return true; // tiada data umur -> tak sekat
  return guru.umur < had;
}

// ---------- Langkah 1: Auto-balance slot kosong ----------

// senaraiGuru : [ { nama, umur?, lantikan:[...] } ]  (lantikan sedia ada)
// slotKosong  : [ { jk, jawatan, tempoh, skala?, fizikal? } ]  (slot nak diisi)
// opsyen      : { maksLantikan?, kecualiPengurusan? }
export function agihSeimbang(senaraiGuru, slotKosong, config, opsyen = {}) {
  const indeks = binaIndeks(config);
  const had = config.tetapan?.had_umur_fizikal ?? 50;

  // Beban semasa setiap guru (daripada lantikan sedia ada)
  const keadaan = senaraiGuru.map((g) => {
    const beban = kiraBebanGuru(g, config, opsyen);
    return {
      nama: g.nama,
      umur: g.umur,
      beban: beban.jumlahBeban,
      bilangan: (g.lantikan || []).length,
      guru: g,
    };
  });

  // Slot berat didahulukan supaya diagih dulu
  const slotDiisih = [...slotKosong]
    .map((s) => ({ ...s, pemberat: kiraPemberat(s, config, indeks).pemberat }))
    .sort((a, b) => b.pemberat - a.pemberat);

  const agihan = [];
  const tidakDiisi = [];

  for (const slot of slotDiisih) {
    // Calon yang layak (umur-fizikal + had bilangan lantikan)
    let calon = keadaan.filter((k) => layakFizikal(k.guru, slot, had));
    if (opsyen.maksLantikan) {
      calon = calon.filter((k) => k.bilangan < opsyen.maksLantikan);
    }
    if (calon.length === 0) {
      tidakDiisi.push({ ...slot, sebab: "Tiada guru layak (had umur/bilangan)" });
      continue;
    }
    // Pilih beban paling rendah; seri -> bilangan lantikan paling sedikit
    calon.sort((a, b) => a.beban - b.beban || a.bilangan - b.bilangan);
    const pilih = calon[0];

    pilih.beban = Math.round((pilih.beban + slot.pemberat) * 100) / 100;
    pilih.bilangan += 1;
    agihan.push({ guru: pilih.nama, jk: slot.jk, jawatan: slot.jawatan, pemberat: slot.pemberat });
  }

  const beban = keadaan.map((k) => k.beban);
  const maks = Math.max(...beban), min = Math.min(...beban);

  return {
    agihan,
    tidakDiisi,
    bebanAkhir: keadaan
      .map((k) => ({ nama: k.nama, beban: k.beban, bilangan: k.bilangan }))
      .sort((a, b) => b.beban - a.beban),
    statistik: {
      maksimum: maks,
      minimum: min,
      jurang: Math.round((maks - min) * 100) / 100,
      purata: Math.round((beban.reduce((a, b) => a + b, 0) / beban.length) * 100) / 100,
    },
  };
}

export default { semakKesesuaian, agihSeimbang };
