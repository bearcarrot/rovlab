-- APPLIED to project mttcdaiwuasnkqlxbeqs on 2026-10-07 as migration `admin_game_identities_search`.
--
-- Admin page support: search linked in-game identities (by OpenID prefix, in-game name, @handle or display name).
-- Admin only (is_admin()); returns at most 20 rows, newest first. Releasing uses admin_release_game_identity().
-- ROLLBACK: drop function if exists public.admin_search_game_identities(text);
create or replace function public.admin_search_game_identities(p_query text default '')
returns table (
  user_id uuid, handle text, display_name text, player_id text, ign text, server text,
  verified_at timestamptz, refreshed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  q text := btrim(coalesce(p_query, ''));
  digits text := regexp_replace(btrim(coalesce(p_query, '')), '[^0-9]', '', 'g');
  pat text := '%' || replace(replace(replace(btrim(coalesce(p_query, '')), '\', '\\'), '%', '\%'), '_', '\_') || '%';
begin
  if not public.is_admin() then
    raise exception using message = 'คุณไม่มีสิทธิ์ทำรายการนี้', detail = 'FORBIDDEN', errcode = 'P0001';
  end if;
  return query
    select gi.user_id, p.handle, p.display_name, gi.player_id, gi.ign, gi.server, gi.verified_at, gi.refreshed_at
    from public.game_identities gi
    join public.profiles p on p.id = gi.user_id
    where q = ''
       or (digits <> '' and gi.player_id like digits || '%')
       or gi.ign ilike pat
       or p.handle ilike pat
       or p.display_name ilike pat
    order by gi.verified_at desc
    limit 20;
end;
$$;

revoke execute on function public.admin_search_game_identities(text) from public, anon;
grant execute on function public.admin_search_game_identities(text) to authenticated;
