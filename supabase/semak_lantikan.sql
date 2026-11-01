-- Migration 4: semakan lantikan oleh guru menggunakan No. Gaji (tanpa log masuk).
-- Sudah dipasang di projek jk-takwim-taiping.
-- Fungsi ini sengaja boleh dipanggil oleh anon. Ia hanya memulangkan nama,
-- No. K/P bertopeng dan senarai lantikan, dengan had 10 cubaan gagal / 15 minit / IP.

alter table guru add constraint guru_no_gaji_unik unique (no_gaji);

create table if not exists private.cubaan_semak (
  ip      text not null,
  masa    timestamptz not null default now(),
  berjaya boolean not null
);
create index if not exists cubaan_semak_ip_masa on private.cubaan_semak (ip, masa);

create or replace function public.semak_lantikan(p_no_gaji text)
returns jsonb
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_ip    text;
  v_gagal int;
  v_guru  guru%rowtype;
  v_kunci text := lower(trim(coalesce(p_no_gaji, '')));
begin
  v_ip := coalesce(
    nullif(trim(split_part((current_setting('request.headers', true))::json ->> 'x-forwarded-for', ',', 1)), ''),
    'tidak-diketahui');

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
