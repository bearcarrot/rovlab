-- Custom tier rows for My Tier Lists / Community snapshots.
-- Additive and backward compatible: existing rows keep the legacy shape { "S+": [...], "S": [...], "A": [...], "B": [...], "C": [...] }
-- and stay valid; nothing is rewritten. New shape (written by the editor):
--   { "v": 2, "rows": [ { "id": "r1", "label": "SS", "color": "#EF4444", "heroes": ["heroId", ...] }, ... ] }
-- Limits: 1-20 rows, unique row ids [A-Za-z0-9_-]{1,32}, label 1-12 chars, color #RRGGBB, hero ids 1-64 chars,
-- each hero at most once on the whole board, at most 200 heroes in total. Tables, RLS and RPC signatures are unchanged.
-- Every CASE branch is nested so a malformed document returns false instead of raising.

create or replace function public.valid_tier_data(p jsonb)
returns boolean language sql immutable set search_path to '' as $$
  select case
    when p is null or jsonb_typeof(p) <> 'object' or pg_column_size(p) > 65536 then false
    when (p -> 'v') is not null then
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

create or replace function public.tier_hero_count(p jsonb)
returns integer language sql immutable set search_path to '' as $$
  select coalesce(
    case when (p -> 'v') is not null
      then (select count(*)::int from jsonb_array_elements(p -> 'rows') r, jsonb_array_elements(r -> 'heroes') x)
      else (select count(*)::int from jsonb_each(p) e, jsonb_array_elements(e.value) x)
    end, 0)
$$;

-- first n hero ids in row order (legacy: S+, S, A, B, C) for list-card thumbnails
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
    ) t, jsonb_array_elements_text(t.heroes) with ordinality as x(id, pos)
    order by t.ord, x.pos
    limit greatest(n, 0)
  ) h
$$;

-- row labels are user-written public text: they get the same profanity check as title/description at publish time
create or replace function public.tier_labels(p jsonb)
returns text language sql immutable set search_path to '' as $$
  select case when (p -> 'v') is not null
    then coalesce((select string_agg(r ->> 'label', ' ') from jsonb_array_elements(p -> 'rows') r), '')
    else '' end
$$;

create or replace function public.sync_community_tier_list(p_id uuid)
returns void language plpgsql security definer set search_path to '' as $$
declare t record;
begin
  select * into t from public.user_tier_lists where id = p_id and visibility = 'public';
  if not found then return; end if;
  if public.tier_hero_count(t.data) = 0 then
    raise exception using message = 'เพิ่มฮีโร่เข้า Tier อย่างน้อย 1 ตัวก่อนเผยแพร่', detail = 'TIER_LIST_EMPTY', errcode = 'P0001';
  end if;
  if cardinality(public.profanity_matches(t.name || ' ' || coalesce(t.description, '') || ' ' || public.tier_labels(t.data))) > 0 then
    raise exception using message = 'ข้อความมีคำที่ไม่เหมาะสม กรุณาแก้ไขก่อนเผยแพร่', detail = 'PROFANITY_BLOCKED', errcode = 'P0001';
  end if;
  insert into public.community_tier_lists (source_id, owner_id, title, description, patch, data)
  values (t.id, t.user_id, t.name, t.description, t.patch, t.data)
  on conflict (source_id) do update
    set title       = excluded.title,
        description = excluded.description,
        patch       = excluded.patch,
        data        = excluded.data,
        version     = public.community_tier_lists.version + 1,
        updated_at  = now();
end $$;
revoke all on function public.sync_community_tier_list(uuid) from public, anon, authenticated;
revoke all on function public.tier_labels(jsonb) from public, anon, authenticated;
