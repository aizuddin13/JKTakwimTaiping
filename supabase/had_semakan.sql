-- Migration 7: pengukuhan had cubaan semak_lantikan().
--
-- Masalah: versi sebelum ini mengambil elemen PERTAMA header x-forwarded-for sebagai IP
-- pemanggil. Elemen pertama ditetapkan oleh pelanggan sendiri (proksi hanya MENAMBAH IP sebenar
-- di hujung), jadi penyerang boleh menukar header palsu setiap permintaan dan mendapat kuota
-- 10 cubaan yang baru setiap kali -> No. Gaji boleh diteka tanpa had.
--
-- Pembetulan:
--   1) IP diambil daripada header yang ditetapkan oleh infrastruktur, bukan pelanggan:
--      cf-connecting-ip (Cloudflare) dahulu, jika tiada elemen TERAKHIR x-forwarded-for.
--      Jika kedua-duanya tiada, semua pemanggil berkongsi satu baldi 'tidak-diketahui'
--      (lebih ketat, bukan lebih longgar).
--   2) Had GLOBAL yang tidak bergantung pada IP: jika jumlah cubaan gagal daripada SEMUA IP
--      dalam 5 minit terakhir mencapai 100, semakan ditolak sementara. Ini menghadkan tekaan
--      walaupun IP dipalsukan dengan cara lain.
-- Logik lain (suis perkongsian, had 10 gagal / 15 minit / IP, topeng No. K/P) tidak berubah.
--
-- Jalankan di Supabase -> SQL Editor. Selamat dijalankan berulang kali.

create index if not exists cubaan_semak_gagal_masa
  on private.cubaan_semak (masa) where not berjaya;

create or replace function public.semak_lantikan(p_no_gaji text)
returns jsonb
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_hdr         json;
  v_xff         text;
  v_ip          text;
  v_gagal       int;
  v_gagal_semua int;
  v_guru        guru%rowtype;
  v_kunci       text := lower(trim(coalesce(p_no_gaji, '')));
  v_buka        boolean;
begin
  select coalesce((nilai #>> '{}')::boolean, false) into v_buka
  from tetapan where kunci = 'perkongsian_dibuka';
  if not coalesce(v_buka, false) then
    raise exception 'Agihan tugas jawatankuasa belum dikongsi. Sila semak semula kemudian.' using errcode = 'P0001';
  end if;

  -- IP pemanggil daripada header yang boleh dipercayai (nama header huruf kecil dalam PostgREST).
  begin
    v_hdr := (current_setting('request.headers', true))::json;
  exception when others then
    v_hdr := null;
  end;
  v_xff := coalesce(v_hdr ->> 'x-forwarded-for', '');
  v_ip := coalesce(
    nullif(trim(v_hdr ->> 'cf-connecting-ip'), ''),
    nullif(trim(reverse(split_part(reverse(v_xff), ',', 1))), ''),   -- elemen TERAKHIR
    'tidak-diketahui');

  -- Had global (semua IP): 100 cubaan gagal / 5 minit.
  select count(*) into v_gagal_semua from private.cubaan_semak
  where not berjaya and masa > now() - interval '5 minutes';
  if v_gagal_semua >= 100 then
    raise exception 'Sistem semakan sedang sibuk. Sila cuba lagi selepas beberapa minit.' using errcode = 'P0001';
  end if;

  -- Had per IP: 10 cubaan gagal / 15 minit.
  select count(*) into v_gagal from private.cubaan_semak
  where ip = v_ip and not berjaya and masa > now() - interval '15 minutes';
  if v_gagal >= 10 then
    raise exception 'Terlalu banyak cubaan. Sila cuba lagi selepas 15 minit.' using errcode = 'P0001';
  end if;

  if length(v_kunci) < 3 then
    return null;
  end if;

  select * into v_guru from guru where lower(trim(no_gaji)) = v_kunci limit 1;

  delete from private.cubaan_semak where masa < now() - interval '1 day';
  insert into private.cubaan_semak (ip, berjaya) values (v_ip, v_guru.id is not null);

  if v_guru.id is null then
    return null;
  end if;

  return jsonb_build_object(
    'nama', v_guru.nama,
    'no_gaji', v_guru.no_gaji,
    'no_kp', case when v_guru.no_kp is null then null
                  else repeat('*', greatest(length(v_guru.no_kp) - 4, 0)) || right(v_guru.no_kp, 4) end,
    'lantikan', coalesce((
      select jsonb_agg(jsonb_build_object(
               'kod', j.kod, 'jk', j.nama, 'kategori', j.kategori, 'jawatan', w.nama,
               'tempoh', j.tempoh, 'skala', j.skala, 'fizikal', j.fizikal)
             order by j.kategori, nullif(substring(j.kod from '\d+'), '')::int, j.nama)
      from lantikan l
      join jawatankuasa j on j.id = l.jk_id and j.aktif
      join jawatan w on w.id = l.jawatan_id
      where l.guru_id = v_guru.id), '[]'::jsonb)
  );
end $$;

revoke execute on function public.semak_lantikan(text) from public;
grant execute on function public.semak_lantikan(text) to anon, authenticated;
