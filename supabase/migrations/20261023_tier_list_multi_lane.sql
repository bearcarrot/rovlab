-- Multi-lane custom tier lists (My Tier Lists / Community snapshots). ADDITIVE and backward compatible.
-- NOT applied anywhere by this commit: review, then apply deliberately (staging first).
--
-- New shape (v3), written by the editor only when a list has more than one lane or a lane other than "all":
--   { "v": 3, "lanes": [ { "id": "jungle", "rows": [ <same row objects as v2> ] }, ... ] }
--   lane id: one of all | slayer | jungle | mid | abyssal | roaming (the hero_lanes codes + "all"), unique per list.
-- Limits (per lane = same as the v2 board): 1-20 rows, label 1-12 chars, color #RRGGBB, hero ids 1-64 chars,
--   each hero at most once on a lane's board, at most 200 heroes per lane. The same hero MAY appear on different lanes.
--   1-6 lanes, whole document <= 262144 bytes for v3 (legacy / v2 keep the 65536 cap).
-- Legacy shape { "S+": [...], ... } and v2 { "v": 2, "rows": [...] } stay valid and are NOT rewritten.
-- A single-lane "all" list is still written as v2 by the client, so existing flows keep working before and after this runs.
-- Tables, RLS policies, triggers, grants and RPC signatures are unchanged. sync_community_tier_list() and
-- list_community_tier_lists() are not redefined: they call tier_hero_count / tier_labels / tier_preview, which are updated below.
-- Every CASE branch is nested so a malformed document returns false instead of raising.

-- one board (array of rows): identical rules to the v2 "rows" check
create or replace function public.valid_tier_rows(p jsonb)
returns boolean language sql immutable set search_path to '' as $$
  select case
    when jsonb_typeof(p) is distinct from 'array' then false
    when jsonb_array_length(p) not between 1 and 20 then false
    when exists (select 1 from jsonb_array_elements(p) r where jsonb_typeof(r) <> 'object') then false
    when exists (
      select 1 from jsonb_array_elements(p) r
      where (select count(*) from jsonb_object_keys(r)) <> 4
         or jsonb_typeof(r -> 'id') is distinct from 'string'
         or jsonb_typeof(r -> 'label') is distinct from 'string'
         or jsonb_typeof(r -> 'color') is distinct from 'string'
         or jsonb_typeof(r -> 'heroes') is distinct from 'array'
    ) then false
    when exists (
      select 1 from jsonb_array_elements(p) r
      where (r ->> 'id') !~ '^[A-Za-z0-9_-]{1,32}$'
         or char_length(btrim(r ->> 'label')) not between 1 and 12
         or (r ->> 'color') !~ '^#[0-9A-Fa-f]{6}$'
    ) then false
    when (select count(distinct r ->> 'id') from jsonb_array_elements(p) r) <> jsonb_array_length(p) then false
    when exists (
      select 1 from jsonb_array_elements(p) r, jsonb_array_elements(r -> 'heroes') x
      where jsonb_typeof(x) <> 'string' or char_length(x #>> '{}') not between 1 and 64
    ) then false
    else
      (select count(*) from jsonb_array_elements(p) r, jsonb_array_elements_text(r -> 'heroes') x) <= 200
      and (select count(*) from jsonb_array_elements(p) r, jsonb_array_elements_text(r -> 'heroes') x)
        = (select count(distinct x) from jsonb_array_elements(p) r, jsonb_array_elements_text(r -> 'heroes') x)
  end
$$;

create or replace function public.valid_tier_data(p jsonb)
returns boolean language sql immutable set search_path to '' as $$
  select case
    when p is null or jsonb_typeof(p) <> 'object'
      or pg_column_size(p) > case when (p -> 'v') = '3'::jsonb then 262144 else 65536 end then false
    when (p -> 'v') is not null then
      case
        when (p -> 'v') = '3'::jsonb then
          case
            when jsonb_typeof(p -> 'lanes') is distinct from 'array'
              or (select count(*) from jsonb_object_keys(p)) <> 2 then false
            when jsonb_array_length(p -> 'lanes') not between 1 and 6 then false
            when exists (select 1 from jsonb_array_elements(p -> 'lanes') l where jsonb_typeof(l) <> 'object') then false
            when exists (
              select 1 from jsonb_array_elements(p -> 'lanes') l
              where (select count(*) from jsonb_object_keys(l)) <> 2
                 or jsonb_typeof(l -> 'id') is distinct from 'string'
                 or (l ->> 'id') not in ('all', 'slayer', 'jungle', 'mid', 'abyssal', 'roaming')
            ) then false
            when (select count(distinct l ->> 'id') from jsonb_array_elements(p -> 'lanes') l) <> jsonb_array_length(p -> 'lanes') then false
            else not exists (select 1 from jsonb_array_elements(p -> 'lanes') l where not public.valid_tier_rows(l -> 'rows'))
          end
        else
          -- v2 (unchanged)
          case
            when p -> 'v' is distinct from '2'::jsonb
              or jsonb_typeof(p -> 'rows') is distinct from 'array'
              or (select count(*) from jsonb_object_keys(p)) <> 2 then false
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
            else
              (select count(*) from jsonb_array_elements(p -> 'rows') r, jsonb_array_elements_text(r -> 'heroes') x) <= 200
              and (select count(*) from jsonb_array_elements(p -> 'rows') r, jsonb_array_elements_text(r -> 'heroes') x)
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

-- v3: number of DISTINCT heroes across all lanes (a hero used on two lanes counts once)
create or replace function public.tier_hero_count(p jsonb)
returns integer language sql immutable set search_path to '' as $$
  select coalesce(
    case
      when (p -> 'v') = '3'::jsonb
        then (select count(distinct x)::int
              from jsonb_array_elements(p -> 'lanes') l, jsonb_array_elements(l -> 'rows') r, jsonb_array_elements_text(r -> 'heroes') x)
      when (p -> 'v') is not null
        then (select count(*)::int from jsonb_array_elements(p -> 'rows') r, jsonb_array_elements(r -> 'heroes') x)
      else (select count(*)::int from jsonb_each(p) e, jsonb_array_elements(e.value) x)
    end, 0)
$$;

-- first n hero ids in row order for list-card thumbnails. v3: always the FIRST lane in the document (stable, no merging).
create or replace function public.tier_preview(p jsonb, n integer default 6)
returns jsonb language sql immutable set search_path to '' as $$
  select coalesce(jsonb_agg(h.id order by h.ord, h.pos), '[]'::jsonb)
  from (
    select x.id, x.pos, t.ord
    from (
      select r.value -> 'heroes' as heroes, r.ord::int as ord
      from jsonb_array_elements(
        case
          when (p -> 'v') = '3'::jsonb then coalesce(p -> 'lanes' -> 0 -> 'rows', '[]'::jsonb)
          when (p -> 'v') is not null then p -> 'rows'
          else '[]'::jsonb
        end) with ordinality as r(value, ord)
      union all
      select e.value, array_position(array['S+', 'S', 'A', 'B', 'C'], e.key)
      from jsonb_each(case when (p -> 'v') is null then p else '{}'::jsonb end) e
    ) t, jsonb_array_elements_text(t.heroes) with ordinality as x(id, pos)
    order by t.ord, x.pos
    limit greatest(n, 0)
  ) h
$$;

-- row labels of every lane are user-written public text: same profanity check as title/description at publish time
create or replace function public.tier_labels(p jsonb)
returns text language sql immutable set search_path to '' as $$
  select case
    when (p -> 'v') = '3'::jsonb
      then coalesce((select string_agg(r ->> 'label', ' ')
                     from jsonb_array_elements(p -> 'lanes') l, jsonb_array_elements(l -> 'rows') r), '')
    when (p -> 'v') is not null
      then coalesce((select string_agg(r ->> 'label', ' ') from jsonb_array_elements(p -> 'rows') r), '')
    else '' end
$$;
revoke all on function public.tier_labels(jsonb) from public, anon, authenticated;
