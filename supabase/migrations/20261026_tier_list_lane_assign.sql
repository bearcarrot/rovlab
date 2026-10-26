-- Independent per-lane Tier placements for custom tier lists (My Tier Lists / Community snapshots). ADDITIVE and backward compatible.
-- NOT applied anywhere by this commit: review, then apply deliberately (staging first), BEFORE the client that can write "lanes" is deployed
-- (until then the CHECK rejects a save that contains "lanes"; lists without it are unaffected).
-- Builds on 20261023_tier_list_allow_duplicates.sql (valid_tier_data here replaces that version and keeps its dup rules).
--
-- Why: valid_tier_data (CHECK on user_tier_lists.data and community_tier_lists.data) allows only the keys {v, rows[, dup]}, and a Tier is a
-- single row per board, so "Astrid S in Jungle and A in Slayer" cannot be stored.
--
-- Shape (v2) + one more optional key:
--   { "v": 2, "rows": [...], "lanes": { "<lane>": { "<rowId>": ["heroId", ...] } } }
-- rows keeps defining the Tiers (id/label/color/order) and the traditional board. lanes is an independent layer: lane codes
-- ^[a-z0-9_-]{1,32}$ (any code, NOT checked against hero_lanes / hero role metadata), at most 12 lanes, every <rowId> must be an existing row id,
-- hero ids 1-64 chars, a hero at most once per lane (one Tier per hero per lane, any number of lanes), at most 600 placements in all lanes,
-- 64 KiB cap unchanged. "lanes" is only written after the user edits a lane, so every existing row and every list saved without lane edits is unchanged.
-- tier_hero_count counts distinct heroes over rows AND lanes (a list that only has lane placements can still be published);
-- tier_preview falls back to lane heroes after the row heroes. sync_community_tier_list / list_community_tier_lists copy/return data as-is (not redefined).
--
-- Existing records: nothing is rewritten; every stored document stays valid (same keys, same rules).
-- Rollback: re-apply 20261023_tier_list_allow_duplicates.sql (+ 20261014b for tier_preview). Any row already saved with "lanes" must have
-- that key removed first (update ... set data = data - 'lanes'), otherwise the older CHECK rejects it when the constraint is re-validated.

create or replace function public.valid_tier_data(p jsonb)
returns boolean language sql immutable set search_path to '' as $$
  select case
    when p is null or jsonb_typeof(p) <> 'object' or pg_column_size(p) > 65536 then false
    when (p -> 'v') is not null then
      case
        when p -> 'v' is distinct from '2'::jsonb
          or jsonb_typeof(p -> 'rows') is distinct from 'array'
          or (select count(*) from jsonb_object_keys(p)) <> 2 + (case when (p -> 'dup') is not null then 1 else 0 end) + (case when (p -> 'lanes') is not null then 1 else 0 end)
          or ((p -> 'dup') is not null and p -> 'dup' is distinct from 'true'::jsonb) then false
        when jsonb_array_length(p -> 'rows') not between 1 and 20 then false
        when exists (select 1 from jsonb_array_elements(p -> 'rows') r where jsonb_typeof(r) <> 'object') then false
        when exists (
          select 1 from jsonb_array_elements(p -> 'rows') r
          where (select count(*) from jsonb_object_keys(r)) <> 4
             or jsonb_typeof(r -> 'id') is distinct from 'string'
             or jsonb_typeof(r -> 'label') is distinct from 'string'
             or jsonb_typeof(r -> 'color') is distinct from 'string'
             or jsonb_typeof(r -> 'heroes') is distinct from 'array'
        ) then false
        when exists (
          select 1 from jsonb_array_elements(p -> 'rows') r
          where (r ->> 'id') !~ '^[A-Za-z0-9_-]{1,32}$'
             or char_length(btrim(r ->> 'label')) not between 1 and 12
             or (r ->> 'color') !~ '^#[0-9A-Fa-f]{6}$'
        ) then false
        when (select count(distinct r ->> 'id') from jsonb_array_elements(p -> 'rows') r) <> jsonb_array_length(p -> 'rows') then false
        when exists (
          select 1 from jsonb_array_elements(p -> 'rows') r, jsonb_array_elements(r -> 'heroes') x
          where jsonb_typeof(x) <> 'string' or char_length(x #>> '{}') not between 1 and 64
        ) then false
        -- lanes (optional): { "<lane>": { "<rowId>": [heroId, ...] } }. Checked in layers so a malformed document returns false.
        when (p -> 'lanes') is not null and (
          jsonb_typeof(p -> 'lanes') <> 'object'
          or (select count(*) from jsonb_object_keys(p -> 'lanes')) > 12
        ) then false
        when (p -> 'lanes') is not null and exists (
          select 1 from jsonb_each(p -> 'lanes') l
          where l.key !~ '^[a-z0-9_-]{1,32}$' or jsonb_typeof(l.value) <> 'object'
        ) then false
        when (p -> 'lanes') is not null and exists (
          select 1 from jsonb_each(p -> 'lanes') l, jsonb_each(l.value) c
          where jsonb_typeof(c.value) <> 'array'
             or c.key not in (select r ->> 'id' from jsonb_array_elements(p -> 'rows') r)
        ) then false
        when (p -> 'lanes') is not null and exists (
          select 1 from jsonb_each(p -> 'lanes') l, jsonb_each(l.value) c, jsonb_array_elements(c.value) x
          where jsonb_typeof(x) <> 'string' or char_length(x #>> '{}') not between 1 and 64
        ) then false
        when (p -> 'lanes') is not null and (
          -- at most one Tier per hero per lane
          exists (
            select 1 from jsonb_each(p -> 'lanes') l
            where (select count(*) from jsonb_each(l.value) c, jsonb_array_elements_text(c.value) x)
                <> (select count(distinct x) from jsonb_each(l.value) c, jsonb_array_elements_text(c.value) x)
          )
          or (select count(*) from jsonb_each(p -> 'lanes') l, jsonb_each(l.value) c, jsonb_array_elements_text(c.value) x) > 600
        ) then false
        else
          (select count(*) from jsonb_array_elements(p -> 'rows') r, jsonb_array_elements_text(r -> 'heroes') x) <= 200
          and case
            when (p -> 'dup') is not null then
              -- setting ON: unique per row only
              not exists (
                select 1 from jsonb_array_elements(p -> 'rows') r
                where (select count(*) from jsonb_array_elements_text(r -> 'heroes'))
                    <> (select count(distinct x) from jsonb_array_elements_text(r -> 'heroes') x)
              )
            else
              -- setting OFF (unchanged): unique on the whole board
              (select count(*) from jsonb_array_elements(p -> 'rows') r, jsonb_array_elements_text(r -> 'heroes') x)
                = (select count(distinct x) from jsonb_array_elements(p -> 'rows') r, jsonb_array_elements_text(r -> 'heroes') x)
          end
      end
    else
      -- legacy fixed-tier shape (unchanged)
      not exists (
        select 1 from jsonb_each(p) e
        where e.key not in ('S+', 'S', 'A', 'B', 'C')
           or jsonb_typeof(e.value) <> 'array'
           or jsonb_array_length(e.value) > 200
      )
      and not exists (
        select 1 from jsonb_each(p) e, jsonb_array_elements(e.value) x
        where jsonb_typeof(x) <> 'string' or char_length(x #>> '{}') not between 1 and 64
      )
      and (select count(*) from jsonb_each(p) e, jsonb_array_elements_text(e.value) x)
        = (select count(distinct x) from jsonb_each(p) e, jsonb_array_elements_text(e.value) x)
  end
$$;


-- number of different heroes on the board (rows and lanes; a hero in several places counts once)
create or replace function public.tier_hero_count(p jsonb)
returns integer language sql immutable set search_path to '' as $$
  select coalesce(
    case when (p -> 'v') is not null
      then (
        select count(distinct t.x)::int from (
          select x from jsonb_array_elements(p -> 'rows') r, jsonb_array_elements_text(r -> 'heroes') x
          union all
          select x from jsonb_each(coalesce(p -> 'lanes', '{}'::jsonb)) l, jsonb_each(l.value) c, jsonb_array_elements_text(c.value) x
        ) t(x)
      )
      else (select count(distinct x)::int from jsonb_each(p) e, jsonb_array_elements_text(e.value) x)
    end, 0)
$$;

-- first n hero ids in row order (legacy: S+, S, A, B, C), then lane heroes, for list-card thumbnails
create or replace function public.tier_preview(p jsonb, n integer default 6)
returns jsonb language sql immutable set search_path to '' as $$
  select coalesce(jsonb_agg(h.id order by h.ord, h.pos), '[]'::jsonb)
  from (
    select x.id, x.pos, t.ord
    from (
      select r.value -> 'heroes' as heroes, r.ord::int as ord
      from jsonb_array_elements(case when (p -> 'v') is not null then p -> 'rows' else '[]'::jsonb end) with ordinality as r(value, ord)
      union all
      select e.value, array_position(array['S+', 'S', 'A', 'B', 'C'], e.key)
      from jsonb_each(case when (p -> 'v') is null then p else '{}'::jsonb end) e
      union all
      select c.value, 1000
      from jsonb_each(case when (p -> 'v') is not null then coalesce(p -> 'lanes', '{}'::jsonb) else '{}'::jsonb end) l, jsonb_each(l.value) c
    ) t, jsonb_array_elements_text(t.heroes) with ordinality as x(id, pos)
    order by t.ord, x.pos
    limit greatest(n, 0)
  ) h
$$;
