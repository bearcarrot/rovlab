-- APPLIED to project mttcdaiwuasnkqlxbeqs on 2026-10-07 as migration `rollback_game_identity`.
--
-- Rollback of 20261007_game_identity.sql + 20261007_admin_game_identities_search.sql: termgame.com answers HTTP 403
-- (DataDome bot protection) to server-side requests, so the OpenID -> in-game name lookup cannot work.
-- Restores get_public_profile to the manually-entered profiles.game_name.
-- Nothing was lost: game_identities was empty (0 rows), game_lookups only held 3 failed attempts.
-- The two original migration files stay in the repo as history.

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
         case when auth.uid() is not null then p.game_name end,
         case when auth.uid() is not null then p.contact_links else '[]'::jsonb end,
         p.created_at
  from public.profiles p
  where p.id = p_id;
$$;

drop function if exists public.admin_search_game_identities(text);
drop function if exists public.admin_release_game_identity(text);
drop table if exists public.game_lookups;
drop table if exists public.game_identities;
