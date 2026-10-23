-- "Allow a hero in multiple tiers" for custom tier lists (My Tier Lists / Community snapshots). ADDITIVE and backward compatible.
-- NOT applied anywhere by this commit: review, then apply deliberately (staging first), BEFORE the client that can write dup:true is deployed.
--
-- Why a migration is needed: valid_tier_data (CHECK on user_tier_lists.data and community_tier_lists.data) requires exactly the keys
-- {v, rows} and rejects a hero id that occurs more than once on the board, so neither the setting nor a duplicate placement can be stored.
--
-- Shape (v2, unchanged) + one optional key:
--   { "v": 2, "rows": [ ... ] }                 -- setting OFF (what every existing row and every OFF save looks like): rules unchanged,
--                                               --   each hero at most once on the whole board
--   { "v": 2, "rows": [ ... ], "dup": true }    -- setting ON: a hero may appear in different rows, but at most once per row
-- "dup" must be the JSON literal true (false / other types are rejected; the client never writes false).
-- Everything else is preserved: 1-20 rows, row id/label/color rules, hero id 1-64 chars, <= 200 placements in total, 64 KiB cap.
-- Legacy fixed-tier documents are untouched. Tables, RLS, grants, triggers and RPC signatures are unchanged.
-- tier_hero_count now counts DISTINCT heroes (identical result for every list that exists today, since those have no duplicates).
-- sync_community_tier_list / list_community_tier_lists are not redefined (they call tier_hero_count / tier_labels / tier_preview).
-- Every CASE branch is nested so a malformed document returns false instead of raising.

create or replace function public.valid_tier_data(p jsonb)
returns boolean language sql immutable set search_path to '' as $$
  select case
    when p is null or jsonb_typeof(p) <> 'object' or pg_column_size(p) > 65536 then false
    when (p -> 'v') is not null then
      case
        when p -> 'v' is distinct from '2'::jsonb
          or jsonb_typeof(p -> 'rows') is distinct from 'array'
          or (select count(*) from jsonb_object_keys(p)) <> (case when (p -> 'dup') is not null then 3 else 2 end)
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

-- number of different heroes on the board (a hero placed in two rows counts once)
create or replace function public.tier_hero_count(p jsonb)
returns integer language sql immutable set search_path to '' as $$
  select coalesce(
    case when (p -> 'v') is not null
      then (select count(distinct x)::int from jsonb_array_elements(p -> 'rows') r, jsonb_array_elements_text(r -> 'heroes') x)
      else (select count(distinct x)::int from jsonb_each(p) e, jsonb_array_elements_text(e.value) x)
    end, 0)
$$;
