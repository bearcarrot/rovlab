-- Opt-in community item statistics. NOT APPLIED YET: run in the Supabase SQL editor BEFORE deploying the app change
-- (the app sends share_items only when the user ticks the consent box, so existing saves are unaffected either way).
--
-- Model: one row per PLAYER OBSERVATION (match_item_obs) with six ordered item columns. Today only the user's own row is
-- written (the only row whose items are read); other players can be added later with the same table, no migration.
--   * Only fully read builds are stored: all 6 slots resolved to existing public.items. A NULL/unknown slot means the
--     observation is not stored at all (never a partial build, never a guessed item).
--   * Written by a trigger in the SAME transaction as the match insert, so there is no partial persistence.
--   * match_id ON DELETE CASCADE: deleting a match removes its observation. Matches cannot be updated by clients
--     (no UPDATE policy), so "edit" = delete + save and the observation is rebuilt from the new row.
--   * unique (match_id, player_idx) + the existing unique (user_id, played_at, duration_sec) stop duplicate ingestion.
--   * Privacy: no user id and no player name in the observation; opt-in per match (share_items, default false);
--     the table has no client access, only the aggregate RPC below can read it (suppressed under 5 distinct users).
--   * patch_id is NULL until a verified patch for the match exists; nothing is guessed. Filterable once filled.
--   * Historical matches are not backfilled (no consent was given).

alter table public.match_results add column if not exists share_items boolean not null default false;

create table if not exists public.match_item_obs (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.match_results(id) on delete cascade,
  player_idx smallint not null check (player_idx between 0 and 9), -- position in match_results.players
  team text not null check (team in ('blue', 'red')),
  hero_id uuid not null references public.heroes(id) on delete cascade,
  patch_id uuid references public.patches(id) on delete set null,
  slot1 uuid references public.items(id) on delete set null,
  slot2 uuid references public.items(id) on delete set null,
  slot3 uuid references public.items(id) on delete set null,
  slot4 uuid references public.items(id) on delete set null,
  slot5 uuid references public.items(id) on delete set null,
  slot6 uuid references public.items(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (match_id, player_idx)
);
create index if not exists match_item_obs_hero_patch_idx on public.match_item_obs (hero_id, patch_id);

alter table public.match_item_obs enable row level security;
revoke all on table public.match_item_obs from anon, authenticated;
drop policy if exists "no client access" on public.match_item_obs;
create policy "no client access" on public.match_item_obs for all to anon, authenticated using (false) with check (false);

-- Builds the observation for the user's own row when they opted in and all 6 slots are known catalogue items.
create or replace function public.match_item_obs_from_match() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_ids uuid[];
  v_idx int;
begin
  if not new.share_items or new.my_items is null or new.my_hero_id is null then
    return new;
  end if;
  -- the inner join drops NULL and unknown slugs, so fewer than 6 rows = incomplete build = store nothing
  select array_agg(i.id order by u.pos) into v_ids
    from unnest(new.my_items) with ordinality as u(slug, pos)
    join public.items i on i.slug = u.slug;
  if coalesce(array_length(v_ids, 1), 0) <> 6 then
    return new;
  end if;
  select (e.ord - 1)::int into v_idx
    from jsonb_array_elements(new.players) with ordinality as e(p, ord)
   where (e.p ->> 'is_me')::boolean
   limit 1;
  if v_idx is null then
    return new;
  end if;
  insert into public.match_item_obs (match_id, player_idx, team, hero_id, slot1, slot2, slot3, slot4, slot5, slot6)
  values (new.id, v_idx, new.my_team, new.my_hero_id, v_ids[1], v_ids[2], v_ids[3], v_ids[4], v_ids[5], v_ids[6])
  on conflict (match_id, player_idx) do nothing;
  return new;
end $$;
revoke all on function public.match_item_obs_from_match() from public, anon, authenticated;

drop trigger if exists match_results_item_obs on public.match_results;
create trigger match_results_item_obs after insert on public.match_results
  for each row execute function public.match_item_obs_from_match();

-- Item pick rate for one hero. Aggregates only. Each item counts once per observation however many slots hold it.
--   pick_rate = matches containing the item / eligible observations * 100   (eligible = all 6 slots known, opted in)
--   slots     = {"1": n, ...} observations with the item in that slot (slot share, not pick rate)
--   wins      = observations containing the item that were won (correlation only, not proof an item causes wins)
-- Result is suppressed (suppressed = true, no items) below p_min_users distinct users.
create or replace function public.hero_item_stats(
  p_hero uuid,
  p_from date default null,
  p_to date default null,
  p_patch uuid default null,
  p_min_users int default 5
)
returns jsonb
language sql stable security definer set search_path = '' as $$
  with obs as (
    select o.id, m.user_id,
           ((o.team = m.my_team) = (m.result = 'victory')) as won,
           array[o.slot1, o.slot2, o.slot3, o.slot4, o.slot5, o.slot6] as slots
      from public.match_item_obs o
      join public.match_results m on m.id = o.match_id
     where o.hero_id = p_hero
       and m.share_items
       and o.slot1 is not null and o.slot2 is not null and o.slot3 is not null
       and o.slot4 is not null and o.slot5 is not null and o.slot6 is not null
       and (p_from is null or m.played_at >= p_from)
       and (p_to is null or m.played_at < p_to + 1)
       and (p_patch is null or o.patch_id = p_patch)
  ),
  tot as (
    select count(*)::int n, count(distinct user_id)::int users, count(*) filter (where won)::int wins from obs
  ),
  slots as (
    select o.id, o.won, u.item_id, u.pos
      from obs o cross join lateral unnest(o.slots) with ordinality as u(item_id, pos)
  ),
  per_item as (
    select item_id, count(distinct id)::int matches, count(distinct id) filter (where won)::int wins
      from slots group by item_id
  ),
  per_slot as (
    select item_id, jsonb_object_agg(pos::text, n) dist
      from (select item_id, pos, count(*)::int n from slots group by item_id, pos) x
     group by item_id
  )
  select case
    when t.users < p_min_users then
      jsonb_build_object('eligible', t.n, 'users', t.users, 'suppressed', true, 'items', '[]'::jsonb)
    else
      jsonb_build_object('eligible', t.n, 'users', t.users, 'wins', t.wins, 'suppressed', false,
        'items', coalesce((
          select jsonb_agg(jsonb_build_object(
                   'item_id', p.item_id, 'slug', i.slug, 'matches', p.matches, 'wins', p.wins,
                   'pick_rate', round(p.matches * 100.0 / t.n, 1), 'slots', s.dist)
                 order by p.matches desc)
            from per_item p
            join per_slot s using (item_id)
            join public.items i on i.id = p.item_id
        ), '[]'::jsonb))
  end
  from tot t
$$;
revoke all on function public.hero_item_stats(uuid, date, date, uuid, int) from public, anon;
grant execute on function public.hero_item_stats(uuid, date, date, uuid, int) to authenticated;
