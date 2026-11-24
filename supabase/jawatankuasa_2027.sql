-- Migration 8: selaraskan senarai jawatankuasa dengan MEMO Senarai Jawatankuasa MRSM Taiping Sesi 2027.
-- Selamat dijalankan berulang kali (idempotent). Lantikan sedia ada dikekalkan
-- (baris dikemas kini ikut kod / dianjak kod, bukan dipadam).

begin;

-- 1. C12 "Pembangunan Sahsiah Pelajar" dianjak ke C13 (FAST). Lantikan ikut sekali (jk_id sama).
update jawatankuasa
   set kod = 'C13', nama = 'Pembangunan Sahsiah Pelajar (FAST)'
 where kod = 'C12'
   and nama ilike '%sahsiah%'
   and not exists (select 1 from jawatankuasa where kod = 'C13');

-- 2. Jawatankuasa baharu Sesi 2027.
insert into jawatankuasa (kod, nama, kategori, tempoh, skala, fizikal) values
  ('C12', 'Senarai Guru Homeroom',                     'C', 'tahunan', 'sederhana', false),
  ('C13', 'Pembangunan Sahsiah Pelajar (FAST)',        'C', 'tahunan', 'sederhana', false),
  ('D11', 'Khidmat Masyarakat dan Pengantarabangsaan', 'D', 'tahunan', 'sederhana', false)
on conflict (kod) do nothing;

-- 3. Nama dikemas kini ikut memo 2027 (tempoh/skala/fizikal tidak disentuh).
update jawatankuasa j set nama = v.nama
  from (values
    ('A11', 'Jawatankuasa MARA Emergency Response Team (MERT) & Taskforce Maktab'),
    ('A12', 'Jawatankuasa Pengurusan Hasil dan Piawai/Kos Pusat (JPHPKPP)'),
    ('A16', 'Jawatankuasa MARA Ecosystem Quality Standard (MQS)'),
    ('A17', 'Jawatankuasa Tatakelola (JTK) MARA'),
    ('A19', 'Jawatankuasa Kelab Pencegahan Jenayah'),
    ('E36', 'Jawatankuasa Kejohanan Sukan MRSM Negeri/Kebangsaan/Program BPM (Kem OSEM)')
  ) as v(kod, nama)
 where j.kod = v.kod;

commit;
