-- Migration 9: intensiti beban JK (daripada KPI memo Sesi 2027) + tarikh program & amaran tarikh.
-- Selamat dijalankan berulang kali.
--
-- 1) skala kini dikira untuk SEMUA JK (src/pengiraanBeban.js):
--      one-off : saiz program
--      tahunan : intensiti kerja, ditetapkan ikut kekerapan/skop KPI dalam memo
--    KPI teks tidak disimpan — ia kekal dalam memo.
-- 2) tarikh      : julat tarikh pelaksanaan, cth '11/1/2027 - 15/1/2027' atau '29/1/2027; 16/3/2027'
--    tarikh_nota : rujukan tanpa tarikh tepat, cth 'Kalendar PG'
--    App memberi amaran jika guru dilantik dalam program yang bertindan / jaraknya < jarak_minimum_hari.

alter table jawatankuasa add column if not exists tarikh      text;
alter table jawatankuasa add column if not exists tarikh_nota text;

insert into tetapan (kunci, nilai) values ('jarak_minimum_hari', '7'::jsonb)
on conflict (kunci) do nothing;

-- Intensiti JK tahunan A–D ikut KPI
update jawatankuasa set skala = case
  when kod in ('A1','A10','A13','A16','B2','B7','C1','C2','C5','C6','C8','C12','D2','D4','D5','D8') then 'besar'
  when kod in ('A2','A3','A5','A6','A7','A17','A19','A20','B4','B5','B10','B12','C4','C10','D7','D10') then 'kecil'
  else 'sederhana' end
where kategori in ('A','B','C','D');

-- Tarikh program rasmi maktab (E)
update jawatankuasa j set tarikh = v.tarikh, tarikh_nota = v.nota from (values
  ('E1',  '11/1/2027 - 15/1/2027', null),
  ('E2',  '21/1/2027',             null),
  ('E3',  '25/1/2027',             null),
  ('E4',  '24/4/2027',             null),
  ('E5',  null,                    'Kalendar PG'),
  ('E8',  '1/10/2027',             null),
  ('E9',  '6/12/2027 - 8/12/2027', null),
  ('E10', null,                    'Kalendar PG'),
  ('E11', null,                    'Kalendar PG'),
  ('E12', null,                    'Kalendar PG'),
  ('E13', null,                    'Kalendar LPM'),
  ('E14', '3/1/2027 - 6/1/2027',   null),
  ('E15', '5/1/2027 - 8/1/2027',   null),
  ('E16', '4/3/2027 - 5/3/2027',   null),
  ('E17', '26/3/2027',             null),
  ('E18', '14/5/2027',             null),
  ('E19', '15/9/2027',             null),
  ('E20', '30/1/2027',             null),
  ('E22', '23/8/2027 - 27/8/2027', null),
  ('E25', '29/1/2027; 16/3/2027',  'Merentas Desa 29 Jan; SUPER 16 Mac'),
  ('E26', '16/3/2027',             'SUPER/KEJORA'),
  ('E29', '22/3/2027 - 26/3/2027', null),
  ('E35', null,                    'MARA Perak'),
  ('E36', '23/4/2027 - 25/4/2027', null)
) as v(kod, tarikh, nota) where j.kod = v.kod;
