-- Migration 3: pautkan akaun log masuk (auth.users) ke rekod guru melalui email.
-- Sudah dipasang di projek jk-takwim-taiping.

alter table guru add column if not exists email text unique;

-- Bila pengguna baru log masuk kali pertama: pautkan ke rekod guru ikut email
create or replace function private.pautkan_auth_baru()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.guru set auth_id = new.id
  where lower(email) = lower(new.email) and auth_id is null;
  return new;
end $$;

drop trigger if exists on_auth_user_created_jk on auth.users;
create trigger on_auth_user_created_jk
  after insert on auth.users
  for each row execute function private.pautkan_auth_baru();

-- Bila admin tambah/ubah email guru: pautkan ke akaun log masuk sedia ada (jika ada)
create or replace function private.pautkan_guru_email()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.email is distinct from old.email then
    new.auth_id := null;
  end if;
  if new.email is not null and new.auth_id is null then
    select u.id into new.auth_id from auth.users u
    where lower(u.email) = lower(new.email) limit 1;
  end if;
  return new;
end $$;

drop trigger if exists guru_pautkan_email on guru;
create trigger guru_pautkan_email
  before insert or update of email on guru
  for each row execute function private.pautkan_guru_email();

revoke execute on function private.pautkan_auth_baru() from public;
revoke execute on function private.pautkan_guru_email() from public;

-- Admin pertama: tetapkan email log masuk admin (jalankan di SQL Editor Supabase).
-- Gantikan EMAIL_ADMIN_ANDA dengan email yang mahu digunakan untuk log masuk.
-- update guru set email = lower('EMAIL_ADMIN_ANDA') where id = 1 and peranan = 'admin';
