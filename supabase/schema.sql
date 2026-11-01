-- ============================================================
-- Skema: App Agihan Tugas Jawatankuasa (JK Takwim Taiping)
-- Supabase / PostgreSQL
-- Keselamatan: Row Level Security (RLS) — guru hanya nampak data sendiri,
-- admin/penyelaras urus semua. No. K/P & no. gaji dilindungi.
-- ============================================================

-- ---------- 1. Jadual ----------

-- Jenis jawatan + pemberat asas (boleh edit oleh admin)
create table if not exists jawatan (
  id          bigint generated always as identity primary key,
  nama        text not null unique,
  asas        numeric(4,1) not null check (asas >= 0),
  kategori    text not null default 'ahli'
              check (kategori in ('pengurusan','pelaksana','ahli','kokurikulum','subtugas')),
  tempoh_tetap text check (tempoh_tetap in ('tahunan','one_off')), -- paksa tempoh (cth kokurikulum)
  nota        text
);

-- Jawatankuasa / program (kod A1..E36). Boleh tambah/buang/namakan semula.
create table if not exists jawatankuasa (
  id        bigint generated always as identity primary key,
  kod       text unique,                 -- cth 'A1', 'E24'
  nama      text not null,
  kategori  text not null,               -- 'A'..'E'
  tempoh    text not null default 'tahunan' check (tempoh in ('tahunan','one_off')),
  skala     text default 'sederhana' check (skala in ('besar','sederhana','kecil')),
  fizikal   boolean not null default false,
  aktif     boolean not null default true
);

-- Guru. no_kp & no_gaji sensitif. auth_id pautkan ke pengguna login.
create table if not exists guru (
  id        bigint generated always as identity primary key,
  auth_id   uuid unique references auth.users(id) on delete set null,
  nama      text not null,
  no_kp     text unique,                 -- sensitif
  no_gaji   text,                        -- sensitif
  umur      int check (umur between 18 and 75),
  peranan   text not null default 'guru' check (peranan in ('admin','guru')),
  dicipta   timestamptz not null default now()
);

-- Lantikan: seorang guru -> satu jawatankuasa, dengan satu jawatan.
create table if not exists lantikan (
  id        bigint generated always as identity primary key,
  guru_id   bigint not null references guru(id) on delete cascade,
  jk_id     bigint not null references jawatankuasa(id) on delete cascade,
  jawatan_id bigint not null references jawatan(id),
  catatan   text,
  dicipta   timestamptz not null default now(),
  unique (guru_id, jk_id, jawatan_id)
);

-- Tetapan global (faktor tempoh/skala, had umur fizikal)
create table if not exists tetapan (
  kunci text primary key,
  nilai jsonb not null
);

-- ---------- 2. Fungsi bantu (schema private — tidak terdedah ke API) ----------

create schema if not exists private;
grant usage on schema private to authenticated;

-- Adakah pengguna semasa seorang admin?
create or replace function private.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from guru g
    where g.auth_id = auth.uid() and g.peranan = 'admin'
  );
$$;

-- id guru bagi pengguna semasa
create or replace function private.guru_saya()
returns bigint
language sql stable security definer
set search_path = public
as $$
  select g.id from guru g where g.auth_id = auth.uid() limit 1;
$$;

revoke execute on function private.is_admin() from public;
revoke execute on function private.guru_saya() from public;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.guru_saya() to authenticated;

-- ---------- 3. Aktifkan RLS ----------

alter table jawatan      enable row level security;
alter table jawatankuasa enable row level security;
alter table guru         enable row level security;
alter table lantikan     enable row level security;
alter table tetapan      enable row level security;

-- Rujukan (jawatan, jawatankuasa, tetapan): semua yang login boleh BACA; admin boleh UBAH.
create policy baca_jawatan on jawatan for select to authenticated using (true);
create policy urus_jawatan on jawatan for all to authenticated using (private.is_admin()) with check (private.is_admin());

create policy baca_jk on jawatankuasa for select to authenticated using (true);
create policy urus_jk on jawatankuasa for all to authenticated using (private.is_admin()) with check (private.is_admin());

create policy baca_tetapan on tetapan for select to authenticated using (true);
create policy urus_tetapan on tetapan for all to authenticated using (private.is_admin()) with check (private.is_admin());

-- Guru: nampak rekod SENDIRI sahaja; admin nampak semua. Tulis = admin sahaja.
create policy baca_guru on guru for select to authenticated
  using (auth_id = auth.uid() or private.is_admin());
create policy urus_guru on guru for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- Lantikan: guru nampak lantikan SENDIRI; admin semua. Tulis = admin sahaja.
create policy baca_lantikan on lantikan for select to authenticated
  using (guru_id = private.guru_saya() or private.is_admin());
create policy urus_lantikan on lantikan for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- ---------- 4. Seed tetapan + pemberat asas ----------

insert into tetapan (kunci, nilai) values
  ('faktor_tempoh', '{"tahunan":1.0,"one_off":0.7}'),
  ('faktor_skala',  '{"besar":1.2,"sederhana":1.0,"kecil":0.8}'),
  ('had_umur_fizikal', '50')
on conflict (kunci) do nothing;

insert into jawatan (nama, asas, kategori, tempoh_tetap, nota) values
  ('Penyelaras', 10, 'pelaksana', null, 'Nadi operasi'),
  ('Setiausaha', 9, 'pelaksana', null, 'Dokumentasi & minit'),
  ('Pengerusi', 8, 'pengurusan', null, 'Pimpin & akauntabel'),
  ('Bendahari', 8, 'pelaksana', null, 'Kewangan'),
  ('Ketua', 7, 'pelaksana', null, 'Pimpin sub-bidang'),
  ('Urus Setia', 6, 'pelaksana', null, 'Sekretariat'),
  ('Pendakwa', 6, 'pelaksana', 'tahunan', 'Disiplin'),
  ('Pencatat', 5, 'pelaksana', null, 'Minit'),
  ('Timbalan Pengerusi', 5, 'pengurusan', null, 'Timbal balik'),
  ('Timbalan Bendahari', 5, 'pelaksana', null, null),
  ('Juru Audit Dalaman', 4, 'pelaksana', null, 'Berkala'),
  ('Ahli', 4, 'ahli', null, 'Hadir & laksana'),
  ('Wakil', 3, 'ahli', null, 'Mewakili kumpulan'),
  ('Penasihat', 2, 'pengurusan', null, 'Honorari'),
  ('Ketua Guru Penasihat', 8, 'kokurikulum', 'tahunan', 'Kelab/UB/Sukan'),
  ('Guru Kelas', 7, 'kokurikulum', 'tahunan', 'Pastoral harian'),
  ('Guru Penasihat', 5, 'kokurikulum', 'tahunan', 'Pembantu penasihat'),
  ('Pembimbing Rakan Sebaya', 4, 'kokurikulum', 'tahunan', null),
  ('Penyelaras Unit Khusus', 5, 'subtugas', 'one_off', 'Pendaftaran/Logistik/Teknikal'),
  ('AJK Tugas Umum', 3, 'subtugas', 'one_off', 'Jamuan/Kawalan/Peralatan'),
  ('Pembantu Tadbir', 2, 'subtugas', 'one_off', 'Sokongan')
on conflict (nama) do nothing;
