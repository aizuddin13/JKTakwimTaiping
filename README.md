# JK Takwim Taiping

App agihan tugas jawatankuasa sekolah — agih tugas guru merentas jawatankuasa (kod A–E) berdasarkan sistem pemberat beban, dan jana surat lantikan automatik.

## App

Laman: **https://aizuddin13.github.io/JKTakwimTaiping/**

- **Guru**: tiada log masuk. Masukkan No. Gaji untuk melihat lantikan sendiri dan mencetak surat lantikan (No. K/P bertopeng, tanpa pemberat). Had 10 cubaan gagal / 15 minit / IP, dan had global 100 cubaan gagal / 5 minit.
- **Admin**: log masuk dengan email + kata laluan. Akaun admin didaftarkan secara manual (lihat di bawah). Tab: Papan Beban, Lantikan (dengan cadangan guru beban terendah), Guru (termasuk import dari Excel), Jawatankuasa, Pemberat, Surat Lantikan.

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
supabase/pautan_login.sql    Migration 3: pautan login ikut email
supabase/semak_lantikan.sql  Migration 4: semakan guru ikut No. Gaji + had cubaan
supabase/perkongsian.sql     Migration 6: suis perkongsian lantikan kepada guru
supabase/had_semakan.sql     Migration 7: IP dipercayai + had global untuk semakan (JALANKAN di SQL Editor)
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
- Semakan No. Gaji (tanpa log masuk) dihadkan ikut IP yang dipercayai (`cf-connecting-ip` / elemen terakhir `x-forwarded-for`) dan had global — lihat `supabase/had_semakan.sql`.
- Pustaka `supabase-js` dipin pada versi tepat di `src/app.js`; `index.html` menetapkan Content Security Policy (skrip hanya dari laman ini & esm.sh, sambungan hanya ke Supabase). Jika URL Supabase ditukar di `src/config.js`, kemas kini juga `connect-src` dalam `index.html`.

## Fungsi utama

| Fungsi | Fail | Guna |
|---|---|---|
| `kiraBebanGuru` | pengiraanBeban.js | Jumlah beban seorang guru |
| `agihSeimbang` | penyeimbang.js | Agih slot kosong secara rata |
| `semakKesesuaian` | penyeimbang.js | Amaran JK fizikal vs umur |
| `muatDanKira` | supabaseData.js | Muat data Supabase + kira |
| `suratHTML` | suratLantikan.js | Jana surat lantikan |

## Daftar akaun admin (manual)

1. Supabase → **Authentication → Sign In / Providers**: matikan **Allow new users to sign up**.
2. Supabase → **Authentication → Users → Add user → Create new user**: isi email + kata laluan, tanda **Auto Confirm User**.
3. Supabase → **SQL Editor**, jalankan (ganti email):
   ```sql
   update guru set email = lower('email-admin@contoh.com') where id = 1 and peranan = 'admin';
   ```
   Untuk admin tambahan:
   ```sql
   insert into guru (nama, email, peranan) values ('Nama Admin', lower('email@contoh.com'), 'admin');
   ```
Akaun log masuk dipautkan ke rekod admin secara automatik ikut email (urutan langkah 2 dan 3 tidak penting).
