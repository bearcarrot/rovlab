-- Item-level community observations (supersedes the "6 filled slots only" rule of 20261016b_match_item_obs.sql).
-- NOT APPLIED. Run in the Supabase SQL editor (try a dev branch first) BEFORE deploying the app change.
-- Additive only: no table/column is dropped, existing matches and observations are untouched, RLS and grants are unchanged.
-- Old app versions keep working: a save without provenance still follows the old whole-build-or-nothing rule.
--
-- Model (unchanged): one row per player observation in match_item_obs, six slot columns.
--   slotN is set ONLY for a verified item; NULL = empty, unreadable, unknown slug or not verified. NULL never means "not bought".
--   verified = ocr_confident (margin >= item_ocr_confident_margin()) | user_selected | user_corrected | user_confirmed.
--   slot_src / slot_margin keep the provenance per slot; slot_src IS NULL = legacy row (provenance unknown).
--   Legacy rows stay in the table but are excluded from the new statistics: their slots may include unconfirmed guesses.

alter table public.match_results
  add column if not exists my_items_src text[],
  add column if not exists my_items_margin real[];

alter table public.match_results
  add constraint match_results_my_items_src_chk check (
    my_items_src is null or (
      my_items is not null
      and cardinality(my_items_src) = 6
      and cardinality(my_items_margin) = 6
      and my_items_src <@ array['ocr_confident','ocr_unsure','user_selected','user_corrected','user_confirmed','none']::text[]
    )
  ),
  add constraint match_results_my_items_margin_chk check (my_items_margin is null or my_items_src is not null);

alter table public.match_item_obs
  add column if not exists slot_src text[],
  add column if not exists slot_margin real[],
  add column if not exists verified_count smallint generated always as (
    ((slot1 is not null)::int + (slot2 is not null)::int + (slot3 is not null)::int
     + (slot4 is not null)::int + (slot5 is not null)::int + (slot6 is not null)::int)::smallint
  ) stored;

-- Must equal CONFIDENT_MARGIN in src/features/matches/itemMatch.ts (best-vs-second distance; below = "not sure").
create or replace function public.item_ocr_confident_margin() returns real
language sql immutable set search_path = '' as $$ select 0.12::real $$;
revoke all on function public.item_ocr_confident_margin() from public, anon, authenticated;

-- Same trigger (already attached to match_results), new body. The server re-checks every slot itself.
create or replace function public.match_item_obs_from_match() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_ids uuid[] := array[null,null,null,null,null,null]::uuid[];
  v_src text[] := array['unverified','unverified','unverified','unverified','unverified','unverified'];
  v_mar real[] := array[null,null,null,null,null,null]::real[];
  v_item uuid;
  v_n int := 0;
  v_idx int;
  p int;
begin
  if not new.share_items or new.my_items is null or new.my_hero_id is null then
    return new;
  end if;

  if new.my_items_src is null then
    -- app version without provenance: whole catalogue-valid build or nothing; slot_src stays NULL (legacy)
    for p in 1..6 loop
      select i.id into v_item from public.items i where i.slug = new.my_items[p];
      exit when v_item is null;
      v_ids[p] := v_item;
      v_n := v_n + 1;
    end loop;
    if v_n <> 6 then
      return new;
    end if;
    v_src := null;
    v_mar := null;
  else
    for p in 1..6 loop
      if new.my_items[p] is null then continue; end if;
      if new.my_items_src[p] not in ('ocr_confident','user_selected','user_corrected','user_confirmed') then continue; end if;
      if new.my_items_src[p] = 'ocr_confident'
         and coalesce(new.my_items_margin[p], -1) < public.item_ocr_confident_margin() then continue; end if;
      select i.id into v_item from public.items i where i.slug = new.my_items[p];
      if v_item is null then continue; end if;
      v_ids[p] := v_item;
      v_src[p] := new.my_items_src[p];
      v_mar[p] := new.my_items_margin[p];
      v_n := v_n + 1;
    end loop;
    if v_n = 0 then
      return new;
    end if;
  end if;

  select (e.ord - 1)::int into v_idx
    from jsonb_array_elements(new.players) with ordinality as e(p, ord)
   where (e.p ->> 'is_me')::boolean
   limit 1;
  if v_idx is null then
    return new;
  end if;

  insert into public.match_item_obs
    (match_id, player_idx, team, hero_id, slot1, slot2, slot3, slot4, slot5, slot6, slot_src, slot_margin)
  values
    (new.id, v_idx, new.my_team, new.my_hero_id, v_ids[1], v_ids[2], v_ids[3], v_ids[4], v_ids[5], v_ids[6], v_src, v_mar)
  on conflict (match_id, player_idx) do nothing;
  return new;
end $$;
revoke all on function public.match_item_obs_from_match() from public, anon, authenticated;

-- Item statistics for one hero, two separate scopes with their own denominators (suppressed under p_min_users distinct users each):
--   item_level: eligible = observations with >= 1 verified slot.   pick_rate = observations containing the item / eligible.
--               A LOWER BOUND: an empty/unverified slot is never evidence the item was not bought.
--   complete:   eligible = observations with all 6 slots verified. pick_rate = observations containing the item / eligible.
-- Each item counts once per observation however many slots hold it. slots = observations with the item in that slot (slot share,
-- not pick rate). wins = observations containing the item that were won (association only, not causation). Legacy rows are excluded.
create or replace function public.hero_item_usage(
  p_hero uuid,
  p_from date default null,
  p_to date default null,
  p_patch uuid default null,
  p_min_users int default 5
)
returns jsonb
language sql stable security definer set search_path = '' as $$
  with obs as (
    select o.id, m.user_id, o.verified_count,
           ((o.team = m.my_team) = (m.result = 'victory')) as won,
           array[o.slot1, o.slot2, o.slot3, o.slot4, o.slot5, o.slot6] as slots
      from public.match_item_obs o
      join public.match_results m on m.id = o.match_id
     where o.hero_id = p_hero
       and m.share_items
       and o.slot_src is not null
       and o.verified_count >= 1
       and (p_from is null or m.played_at >= p_from)
       and (p_to is null or m.played_at < p_to + 1)
       and (p_patch is null or o.patch_id = p_patch)
  ),
  scopes(scope, min_count) as (values ('item_level', 1), ('complete', 6)),
  scoped as (select s.scope, o.* from scopes s join obs o on o.verified_count >= s.min_count),
  tot as (
    select scope, count(*)::int n, count(distinct user_id)::int users, count(*) filter (where won)::int wins
      from scoped group by scope
  ),
  slots as (
    select s.scope, o.id, o.won, u.item_id, u.pos
      from scoped s join obs o on o.id = s.id
      cross join lateral unnest(o.slots) with ordinality as u(item_id, pos)
     where u.item_id is not null
  ),
  per_item as (
    select scope, item_id, count(distinct id)::int matches, count(distinct id) filter (where won)::int wins
      from slots group by scope, item_id
  ),
  per_slot as (
    select scope, item_id, jsonb_object_agg(pos::text, n) dist
      from (select scope, item_id, pos, count(*)::int n from slots group by scope, item_id, pos) x
     group by scope, item_id
  )
  select jsonb_object_agg(s.scope,
    case
      when coalesce(t.users, 0) < p_min_users then
        jsonb_build_object('eligible', coalesce(t.n, 0), 'users', coalesce(t.users, 0), 'suppressed', true, 'items', '[]'::jsonb)
      else
        jsonb_build_object('eligible', t.n, 'users', t.users, 'wins', t.wins, 'suppressed', false,
          'items', coalesce((
            select jsonb_agg(jsonb_build_object(
                     'item_id', p.item_id, 'slug', i.slug, 'matches', p.matches, 'wins', p.wins,
                     'pick_rate', round(p.matches * 100.0 / t.n, 1), 'slots', sl.dist)
                   order by p.matches desc, i.slug)
              from per_item p
              join per_slot sl on sl.scope = p.scope and sl.item_id = p.item_id
              join public.items i on i.id = p.item_id
             where p.scope = s.scope
          ), '[]'::jsonb))
    end)
  from scopes s
  left join tot t on t.scope = s.scope
$$;
revoke all on function public.hero_item_usage(uuid, date, date, uuid, int) from public, anon;
grant execute on function public.hero_item_usage(uuid, date, date, uuid, int) to authenticated;

-- ROLLBACK (manual; restore the previous trigger body from 20261016b_match_item_obs.sql first):
--   drop function if exists public.hero_item_usage(uuid, date, date, uuid, int);
--   drop function if exists public.item_ocr_confident_margin();
--   alter table public.match_results drop constraint match_results_my_items_src_chk, drop constraint match_results_my_items_margin_chk;
--   (dropping my_items_src / my_items_margin / slot_src / slot_margin / verified_count deletes provenance; keep them unless needed)
