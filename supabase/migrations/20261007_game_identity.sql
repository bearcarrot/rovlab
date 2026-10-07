-- APPLIED to project mttcdaiwuasnkqlxbeqs on 2026-10-07 as migration `game_identity`.
--
-- RoV LAB - In-game identity: player enters their RoV OpenID, the `game-id` Edge Function looks up the in-game name
-- and stores it. Clients can never write these tables (service role only), so the name cannot be edited by hand.
-- Additive: profiles.game_name (old free text) is left untouched but is no longer shown.
--
-- ROLLBACK:
--   drop table if exists public.game_lookups, public.game_identities;
--   drop function if exists public.admin_release_game_identity(text);
--   then restore get_public_profile to read p.game_name instead of gi.ign (see 20260930_profiles_public_and_avatars.sql)
--   and delete the `game-id` Edge Function.

-- 1) One verified identity per user, one user per OpenID ------------------------------------------------------
create table if not exists public.game_identities (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  player_id text not null,
  ign text not null,
  server text,
  verified_at timestamptz not null default now(),
  refreshed_at timestamptz not null default now(),
  constraint game_identities_player_id_format check (player_id ~ '^[0-9]{8,20}$'),
  constraint game_identities_ign_length check (char_length(ign) between 1 and 40),
  constraint game_identities_server_length check (server is null or char_length(server) <= 40)
);
create unique index if not exists game_identities_player_id_key on public.game_identities (player_id);

alter table public.game_identities enable row level security;
revoke all on public.game_identities from anon, authenticated;
grant select on public.game_identities to authenticated;
drop policy if exists "read own game identity" on public.game_identities;
create policy "read own game identity" on public.game_identities
  for select to authenticated using ((select auth.uid()) = user_id);

-- 2) Lookup log for rate limiting (service role only: RLS on, no policies) ------------------------------------
create table if not exists public.game_lookups (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('link', 'refresh', 'unlink')),
  ok boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists game_lookups_user_idx on public.game_lookups (user_id, created_at desc);
alter table public.game_lookups enable row level security;
revoke all on public.game_lookups from anon, authenticated;

-- 3) Public profile: the game name now comes from the verified identity (signed-in viewers only) ---------------
create or replace function public.get_public_profile(p_id uuid)
returns table (
  id uuid, display_name text, avatar_url text, bio text, preferred_roles text[], preferred_heroes uuid[],
  game_name text, contact_links jsonb, created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.display_name, p.avatar_url, p.bio, p.preferred_roles, p.preferred_heroes,
         case when auth.uid() is not null then gi.ign end,
         case when auth.uid() is not null then p.contact_links else '[]'::jsonb end,
         p.created_at
  from public.profiles p
  left join public.game_identities gi on gi.user_id = p.id
  where p.id = p_id;
$$;

-- 4) Admin: release an OpenID that someone else linked (the OpenID is public, so squatting is possible) ------
create or replace function public.admin_release_game_identity(p_player_id text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare n int;
begin
  if not public.is_admin() then
    raise exception using message = 'คุณไม่มีสิทธิ์ทำรายการนี้', detail = 'FORBIDDEN', errcode = 'P0001';
  end if;
  delete from public.game_identities where player_id = btrim(p_player_id);
  get diagnostics n = row_count;
  return n > 0;
end;
$$;
revoke execute on function public.admin_release_game_identity(text) from public, anon;
grant execute on function public.admin_release_game_identity(text) to authenticated;
