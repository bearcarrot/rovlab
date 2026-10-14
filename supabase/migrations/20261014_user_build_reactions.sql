-- Like / Dislike for Community Builds (same model as community_tier_list_reactions / draft reactions):
-- one like(1) / dislike(-1) row per user per build.
--
-- Unlike tier lists, user_builds is an editable live row (owners have UPDATE), so counts are NOT stored as
-- columns on user_builds (an owner could write them). They are aggregated on read by a SECURITY DEFINER RPC
-- that only exposes builds the caller may see (public and not hidden, or own).
-- Additive only: no existing table, policy or data is changed.

create table if not exists public.user_build_reactions (
  build_id    uuid not null references public.user_builds (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  value       smallint not null check (value in (-1, 1)),
  created_at  timestamptz not null default now(),
  primary key (build_id, user_id)
);
create index if not exists user_build_reactions_user_idx on public.user_build_reactions (user_id);

alter table public.user_build_reactions enable row level security;

drop policy if exists "own build reactions" on public.user_build_reactions;
create policy "own build reactions" on public.user_build_reactions
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.user_builds b where b.id = build_id and b.is_public and not b.hidden)
  );

revoke all on public.user_build_reactions from anon, authenticated;
grant select, insert, update, delete on public.user_build_reactions to authenticated;

-- Counts + the caller's own reaction for a page of builds (<= 100 ids).
create or replace function public.get_user_build_reaction_stats(p_ids uuid[])
returns table (build_id uuid, like_count integer, dislike_count integer, my_value smallint)
language sql stable security definer set search_path = '' as $fn$
  select b.id,
         (count(*) filter (where r.value = 1))::int,
         (count(*) filter (where r.value = -1))::int,
         max(r.value) filter (where r.user_id = (select auth.uid()))
  from public.user_builds b
  left join public.user_build_reactions r on r.build_id = b.id
  where b.id = any (p_ids)
    and ((b.is_public and not b.hidden) or b.owner_id = (select auth.uid()))
  group by b.id
  limit 100
$fn$;
revoke all on function public.get_user_build_reaction_stats(uuid[]) from public;
grant execute on function public.get_user_build_reaction_stats(uuid[]) to anon, authenticated;
