-- RoV LAB - Auth + Supabase security hardening (supersedes 20261004_auth_username_verification.sql)
-- APPLIED to project mttcdaiwuasnkqlxbeqs on 2026-10-06 as migration `auth_security_hardening`.
--
-- Design decision: profiles.handle IS the username (@mention, /u/:handle, search_handles, resolve_handle).
-- No separate `username` column is created. Existing users / profiles / handles are NOT touched.
--
-- Sections
--   1. Pin search_path on the 3 functions flagged by the linter
--   2. Lock down policy-less tables (admin_users, image_url_backup, kv_store_b2992ca8)
--   3. Least privilege for the client roles (anon never writes; nobody needs TRUNCATE/REFERENCES/TRIGGER)
--   4. Sign-up username -> profiles.handle (+ username_available RPC, reserved names, profanity, Google avatar)
--   5. Reserved handles cannot be taken through a later rename
--   6. Only verified emails may post comments (server-side, in addition to the client check)
--
-- Intentionally unchanged (used by the frontend, each gates on auth.uid()/is_admin() itself):
--   is_admin, get_public_profile, list_comments, list_hero_comments, resolve_handle (anon + authenticated)
--   following_feed, list_notifications, search_handles, admin_* RPCs (authenticated only)
-- is_admin() must stay executable by anon: RLS policies call it with the caller's privileges.

-- 1) search_path ----------------------------------------------------------
alter function public.contact_url_ok(text, text) set search_path = '';
alter function public.valid_contact_links(jsonb) set search_path = '';
alter function public.heroes_sync_primary()      set search_path = '';

-- 2) policy-less tables: service_role / SECURITY DEFINER functions only -----
revoke all on table public.admin_users, public.image_url_backup, public.kv_store_b2992ca8
  from anon, authenticated;

drop policy if exists "no client access" on public.admin_users;
create policy "no client access" on public.admin_users
  for all to anon, authenticated using (false) with check (false);

drop policy if exists "no client access" on public.image_url_backup;
create policy "no client access" on public.image_url_backup
  for all to anon, authenticated using (false) with check (false);

drop policy if exists "no client access" on public.kv_store_b2992ca8;
create policy "no client access" on public.kv_store_b2992ca8
  for all to anon, authenticated using (false) with check (false);

-- 3) least privilege on existing tables ------------------------------------
-- anon can never pass a write policy (they all need auth.uid() / is_admin()), so the grants are dead weight.
revoke insert, update, delete, truncate, references, trigger on all tables in schema public from anon;
-- PostgREST never needs these for signed-in users either.
revoke truncate, references, trigger on all tables in schema public from authenticated;

-- 4) username == handle ----------------------------------------------------
create or replace function public.is_reserved_handle(p text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select lower(p) = any (array['admin','administrator','moderator','support','system','rovlab','coachai']);
$$;

create or replace function public.username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_username ~ '^[A-Za-z0-9_]{3,20}$'
    and not public.is_reserved_handle(p_username)
    and cardinality(public.profanity_matches(p_username)) = 0
    and not exists (select 1 from public.profiles where lower(handle) = lower(p_username));
$$;

revoke all on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;

-- raw_user_meta_data is client-controlled for email sign-ups: validate everything server-side.
-- Google sign-ins carry no `username`, so profiles_default_handle assigns user_xxxxxxxx (unchanged behaviour).
-- The Google picture is only accepted when Supabase itself says provider=google (raw_app_meta_data) AND the
-- URL is on Google's image CDN, so email sign-ups can never set an avatar (it would skip moderation).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_display text := left(btrim(coalesce(new.raw_user_meta_data->>'display_name', '')), 30);
  v_handle  text := btrim(coalesce(new.raw_user_meta_data->>'username', ''));
  v_avatar  text := coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture');
begin
  if char_length(v_display) < 2 then
    v_display := 'ผู้เล่น' || substr(md5(new.id::text), 1, 4);
  end if;

  if v_handle = '' then
    v_handle := null;
  elsif v_handle !~ '^[A-Za-z0-9_]{3,20}$' or public.is_reserved_handle(v_handle) then
    raise exception 'username_invalid';
  elsif cardinality(public.profanity_matches(v_handle)) > 0 then
    raise exception 'username_blocked';
  elsif exists (select 1 from public.profiles where lower(handle) = lower(v_handle)) then
    raise exception 'username_taken';
  end if;

  if (new.raw_app_meta_data->>'provider') is distinct from 'google'
     or v_avatar is null
     or char_length(v_avatar) > 500
     or v_avatar !~ '^https://lh[0-9]+\.googleusercontent\.com/' then
    v_avatar := null;
  end if;

  insert into public.profiles (id, display_name, handle, avatar_url)
  values (new.id, v_display, v_handle, v_avatar)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- 5) reserved handles can't be claimed by renaming (admin sessions / SQL editor / service role are exempt)
create or replace function public.trg_profiles_reserved_handle()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.handle is distinct from old.handle
     and public.is_reserved_handle(new.handle)
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception using message = 'ชื่อผู้ใช้นี้ถูกสงวนไว้', detail = 'HANDLE_BLOCKED', errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_reserved_handle on public.profiles;
create trigger profiles_reserved_handle
  before update of handle on public.profiles
  for each row execute function public.trg_profiles_reserved_handle();

-- 6) verified email required to comment ------------------------------------
-- Kept in a non-exposed schema so it is not an RPC endpoint. Google accounts have email_confirmed_at set by Supabase.
create schema if not exists private;
grant usage on schema private to authenticated;

create or replace function private.is_email_verified()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.users u
    where u.id = auth.uid() and u.email_confirmed_at is not null
  );
$$;

revoke all on function private.is_email_verified() from public;
grant execute on function private.is_email_verified() to authenticated;

drop policy if exists "insert own comments" on public.comments;
create policy "insert own comments" on public.comments
  for insert to authenticated
  with check (auth.uid() = user_id and (select private.is_email_verified()));
