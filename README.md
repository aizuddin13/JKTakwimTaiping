# JK Takwim Taiping

App agihan tugas jawatankuasa sekolah — agih tugas guru merentas jawatankuasa (kod A–E) berdasarkan sistem pemberat beban, dan jana surat lantikan automatik.

## App

Laman: **https://aizuddin13.github.io/JKTakwimTaiping/**

- **Admin**: Papan Beban, Lantikan (dengan cadangan guru beban terendah), Guru (termasuk import dari Excel), Jawatankuasa, Pemberat, Surat Lantikan (cetak seorang atau semua).
- **Guru**: Lantikan Saya + cetak surat lantikan sendiri.
- Log masuk melalui pautan email atau kata laluan. Guru mesti didaftarkan oleh admin (ikut email) sebelum boleh melihat data.

Backend: Supabase projek `jk-takwim-taiping`.

## Struktur

```
index.html                   UI (GitHub Pages)
src/app.js                   Logik UI
src/config.js                URL & kunci publishable Supabase
data/pemberat_jawatan.json   Config pemberat (sumber tunggal nilai)
src/pengiraanBeban.js        Kira pemberat jawatan & jumlah beban guru
src/penyeimbang.js           Auto-balance slot kosong + kekangan umur/fizikal
src/supabaseData.js          Jambatan data Supabase -> fungsi pengiraan
src/suratLantikan.js         Jana surat lantikan (HTML, topeng No. K/P)
supabase/schema.sql          Migration 1–2: jadual + RLS + seed pemberat
supabase/pautan_login.sql    Migration 3: pautan login ikut email + admin pertama
supabase/seed_jawatankuasa.sql  96 jawatankuasa A1–E36
contoh/                      Contoh output
```

## Formula pemberat

```
pemberat_akhir = asas_jawatan × faktor_tempoh × faktor_skala
faktor_tempoh : tahunan = 1.0 , one-off = 0.7
faktor_skala  : besar = 1.2 , sederhana = 1.0 , kecil = 0.8   (one-off sahaja)
beban_guru    = Σ semua pemberat jawatan guru
```

Nilai asas pemberat (Penyelaras = 10 hingga Penasihat = 2) ditala dalam `data/pemberat_jawatan.json` atau jadual `jawatan` di Supabase.

## Keselamatan data

- RLS: guru hanya nampak rekod & lantikan **sendiri**; admin urus semua.
- No. K/P & No. Gaji dilindungi di peringkat pangkalan data.
- Jawatankuasa & pemberat boleh ditambah/dibuang/dinamakan semula oleh admin.

## Fungsi utama

| Fungsi | Fail | Guna |
|---|---|---|
| `kiraBebanGuru` | pengiraanBeban.js | Jumlah beban seorang guru |
| `agihSeimbang` | penyeimbang.js | Agih slot kosong secara rata |
| `semakKesesuaian` | penyeimbang.js | Amaran JK fizikal vs umur |
| `muatDanKira` | supabaseData.js | Muat data Supabase + kira |
| `suratHTML` | suratLantikan.js | Jana surat lantikan |

## Tetapan Supabase yang perlu dibuat secara manual

Dashboard Supabase → Authentication → URL Configuration:
- **Site URL**: `https://aizuddin13.github.io/JKTakwimTaiping/`
- **Redirect URLs**: tambah `https://aizuddin13.github.io/JKTakwimTaiping/**`

Tanpa ini, pautan log masuk dalam email akan menghala ke `localhost`.
