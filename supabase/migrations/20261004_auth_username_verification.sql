-- NOT yet applied to any Supabase project. Review, then run in the SQL editor (or `supabase db push`).
-- Adds username/rank/main_role to profiles, hardens handle_new_user, and requires a verified email to comment.

-- 1) New profile columns -------------------------------------------------
alter table public.profiles
  add column if not exists username text,
  add column if not exists rank text,
  add column if not exists main_role text,
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.is_reserved_username(p text)
returns boolean
language sql
immutable
as $$
  select lower(p) = any (array[
    'admin','administrator','moderator','support','system','rovlab','coachai'
  ]);
$$;

-- Existing users get a neutral generated username (they can be renamed later by an admin).
update public.profiles
set username = 'player_' || substr(md5(id::text), 1, 8)
where username is null;

alter table public.profiles alter column username set not null;

alter table public.profiles
  add constraint profiles_username_format check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  add constraint profiles_username_not_reserved check (not public.is_reserved_username(username)),
  add constraint profiles_rank_length check (rank is null or char_length(rank) <= 40),
  add constraint profiles_main_role_length check (main_role is null or char_length(main_role) <= 20);

-- Unique + case-insensitive
create unique index if not exists profiles_username_lower_key on public.profiles (lower(username));

-- Users may edit rank / main_role themselves. username stays immutable from the client.
grant update (rank, main_role) on public.profiles to authenticated;

create or replace function public.touch_profiles_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_profiles_updated_at();

-- 2) New-user trigger: validate username from sign-up metadata -----------
--    Google sign-ins have no username metadata, so they get a generated one.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_display text := left(btrim(coalesce(new.raw_user_meta_data->>'display_name', '')), 30);
  v_user text := btrim(coalesce(new.raw_user_meta_data->>'username', ''));
begin
  if char_length(v_display) < 2 then
    v_display := 'ผู้เล่น' || substr(md5(new.id::text), 1, 4);
  end if;

  if v_user = '' then
    v_user := 'player_' || substr(md5(new.id::text), 1, 8);
  elsif v_user !~ '^[A-Za-z0-9_]{3,20}$' or public.is_reserved_username(v_user) then
    raise exception 'username_invalid';
  elsif exists (select 1 from public.profiles where lower(username) = lower(v_user)) then
    raise exception 'username_taken';
  end if;

  insert into public.profiles (id, display_name, username)
  values (new.id, v_display, v_user)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- 3) Username availability check for the register form -------------------
create or replace function public.username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_username ~ '^[A-Za-z0-9_]{3,20}$'
    and not public.is_reserved_username(p_username)
    and not exists (select 1 from public.profiles where lower(username) = lower(p_username));
$$;

revoke all on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;

-- 4) Only verified emails may write community content --------------------
--    Google accounts have email_confirmed_at set by Supabase.
create or replace function public.is_email_verified()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from auth.users u
    where u.id = auth.uid() and u.email_confirmed_at is not null
  );
$$;

revoke all on function public.is_email_verified() from public;
grant execute on function public.is_email_verified() to authenticated;

drop policy if exists "insert own comments" on public.comments;
create policy "insert own comments" on public.comments
  for insert to authenticated
  with check (auth.uid() = user_id and public.is_email_verified());
