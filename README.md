# JK Takwim Taiping

App agihan tugas jawatankuasa sekolah — agih tugas guru merentas jawatankuasa (kod A–E) berdasarkan sistem pemberat beban, dan jana surat lantikan automatik.

## Struktur

```
data/pemberat_jawatan.json   Config pemberat (sumber tunggal nilai)
src/pengiraanBeban.js        Kira pemberat jawatan & jumlah beban guru
src/penyeimbang.js           Auto-balance slot kosong + kekangan umur/fizikal
src/supabaseData.js          Jambatan data Supabase -> fungsi pengiraan
src/suratLantikan.js         Jana surat lantikan (HTML, topeng No. K/P)
supabase/schema.sql          Jadual + RLS + seed pemberat
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

## Status

Rangka kerja pengiraan siap & teruji. Seterusnya: sambung klien Supabase sebenar, bina UI agihan & cetak surat lantikan.
