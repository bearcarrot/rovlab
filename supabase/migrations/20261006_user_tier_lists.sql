-- My Tier Lists + Community Tier List (addendum to the Global Ban Pick brief)
--
-- NOTE: the existing public.tier_lists / tier_list_entries are the OFFICIAL, admin-managed tier lists
-- (unique per patch + rank + lane, public read, admin write). They are intentionally NOT reused for
-- user lists: different ownership, key and RLS. User lists live in new tables, mirroring the draft design:
--   user_tier_lists                owner's editable lists (RLS: own rows only)
--   community_tier_lists           immutable published snapshots, written only by triggers / publish_tier_list()
--   community_tier_list_reactions  one like(1)/dislike(-1) row per user per snapshot
-- Hero keys are hero ids (same as the local "Tier List ของฉัน" editor, see features/tierlist/customTierList.ts).
-- Publish-time checks (non-empty, profanity) live in sync_community_tier_list(), so editing a public list
-- never touches its snapshot; the owner pushes a new version with publish_tier_list().
--
-- Verified on the live project inside a rolled-back transaction (RLS as owner / other user / anon).

-- 1) validation helpers
-- data shape: { "S+": [heroId...], "S": [...], "A": [...], "B": [...], "C": [...] }
create or replace function public.valid_tier_data(p jsonb)
returns boolean language sql immutable set search_path to '' as $$
  select case
    when p is null or jsonb_typeof(p) <> 'object' or pg_column_size(p) > 65536 then false
    else
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
  select coalesce((select count(*)::int from jsonb_each(p) e, jsonb_array_elements(e.value)), 0)
$$;

-- first n hero ids in tier order (S+, S, A, B, C) for list-card thumbnails
create or replace function public.tier_preview(p jsonb, n integer default 6)
returns jsonb language sql immutable set search_path to '' as $$
  select coalesce(jsonb_agg(h.id order by h.ord, h.pos), '[]'::jsonb)
  from (
    select x.id, x.pos, array_position(array['S+', 'S', 'A', 'B', 'C'], t.key) as ord
    from jsonb_each(p) t, jsonb_array_elements_text(t.value) with ordinality as x(id, pos)
    order by array_position(array['S+', 'S', 'A', 'B', 'C'], t.key), x.pos
    limit greatest(n, 0)
  ) h
$$;

-- 2) tables
create table if not exists public.user_tier_lists (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  name         text not null default 'Tier List ของฉัน' check (char_length(name) between 1 and 60),
  description  text check (description is null or char_length(description) <= 500),
  patch        text not null default '' check (char_length(patch) <= 20),
  data         jsonb not null default '{}'::jsonb check (public.valid_tier_data(data)),
  visibility   text not null default 'private' check (visibility in ('private', 'public')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists user_tier_lists_user_updated_idx on public.user_tier_lists (user_id, updated_at desc);

create table if not exists public.community_tier_lists (
  id             uuid primary key default gen_random_uuid(),
  source_id      uuid not null unique references public.user_tier_lists (id) on delete cascade,
  owner_id       uuid not null references public.profiles (id) on delete cascade,
  title          text not null check (char_length(title) between 1 and 60),
  description    text check (description is null or char_length(description) <= 500),
  patch          text not null default '' check (char_length(patch) <= 20),
  data           jsonb not null check (public.valid_tier_data(data)),
  version        integer not null default 1,
  like_count     integer not null default 0,
  dislike_count  integer not null default 0,
  hidden         boolean not null default false,
  published_at   timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists community_tier_lists_published_idx on public.community_tier_lists (published_at desc) where hidden = false;
create index if not exists community_tier_lists_liked_idx     on public.community_tier_lists (like_count desc) where hidden = false;

create table if not exists public.community_tier_list_reactions (
  list_id     uuid not null references public.community_tier_lists (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  value       smallint not null check (value in (-1, 1)),
  created_at  timestamptz not null default now(),
  primary key (list_id, user_id)
);

-- 3) RLS + privileges
alter table public.user_tier_lists               enable row level security;
alter table public.community_tier_lists          enable row level security;
alter table public.community_tier_list_reactions enable row level security;

drop policy if exists "own user_tier_lists" on public.user_tier_lists;
create policy "own user_tier_lists" on public.user_tier_lists
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "read visible community tier lists" on public.community_tier_lists;
create policy "read visible community tier lists" on public.community_tier_lists
  for select to anon, authenticated
  using (hidden = false or owner_id = auth.uid() or public.is_admin());

drop policy if exists "admin delete community tier lists" on public.community_tier_lists;
create policy "admin delete community tier lists" on public.community_tier_lists
  for delete to authenticated using (public.is_admin());

drop policy if exists "own tier list reactions" on public.community_tier_list_reactions;
create policy "own tier list reactions" on public.community_tier_list_reactions
  for all to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.community_tier_lists c where c.id = list_id and c.hidden = false)
  );

revoke all on public.user_tier_lists               from anon, authenticated;
revoke all on public.community_tier_lists          from anon, authenticated;
revoke all on public.community_tier_list_reactions from anon, authenticated;
grant select, insert, update, delete on public.user_tier_lists to authenticated;
grant select on public.community_tier_lists to anon, authenticated;
grant delete on public.community_tier_lists to authenticated; -- admin policy only
grant select, insert, update, delete on public.community_tier_list_reactions to authenticated;

-- 4) triggers
create or replace function public.trg_user_tier_lists_before()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  new.name        := coalesce(nullif(btrim(new.name), ''), 'Tier List ของฉัน');
  new.description := nullif(btrim(new.description), '');
  new.patch       := btrim(coalesce(new.patch, ''));
  if tg_op = 'INSERT' then
    if (select count(*) from public.user_tier_lists t where t.user_id = new.user_id) >= 20 then
      raise exception using message = 'บันทึก Tier List ได้สูงสุด 20 รายการ', detail = 'TIER_LIST_LIMIT_REACHED', errcode = 'P0001';
    end if;
  else
    new.user_id    := old.user_id; -- owner is immutable
    new.updated_at := now();
  end if;
  return new;
end $$;

drop trigger if exists user_tier_lists_before on public.user_tier_lists;
create trigger user_tier_lists_before before insert or update on public.user_tier_lists
  for each row execute function public.trg_user_tier_lists_before();

-- Internal: copy the owner's current list into the snapshot (re-run = new version, reactions kept).
create or replace function public.sync_community_tier_list(p_id uuid)
returns void language plpgsql security definer set search_path to '' as $$
declare t record;
begin
  select * into t from public.user_tier_lists where id = p_id and visibility = 'public';
  if not found then return; end if;
  if public.tier_hero_count(t.data) = 0 then
    raise exception using message = 'เพิ่มฮีโร่เข้า Tier อย่างน้อย 1 ตัวก่อนเผยแพร่', detail = 'TIER_LIST_EMPTY', errcode = 'P0001';
  end if;
  if cardinality(public.profanity_matches(t.name || ' ' || coalesce(t.description, ''))) > 0 then
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

create or replace function public.trg_user_tier_lists_after()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if new.visibility = 'public' and (tg_op = 'INSERT' or old.visibility is distinct from 'public') then
    perform public.sync_community_tier_list(new.id);
  elsif tg_op = 'UPDATE' and new.visibility = 'private' and old.visibility = 'public' then
    delete from public.community_tier_lists where source_id = new.id;
  end if;
  return null;
end $$;

drop trigger if exists user_tier_lists_after on public.user_tier_lists;
create trigger user_tier_lists_after after insert or update of visibility on public.user_tier_lists
  for each row execute function public.trg_user_tier_lists_after();

create or replace function public.trg_tier_list_reaction_counts()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if tg_op in ('DELETE', 'UPDATE') then
    update public.community_tier_lists
       set like_count    = greatest(like_count    - (old.value = 1)::int, 0),
           dislike_count = greatest(dislike_count - (old.value = -1)::int, 0)
     where id = old.list_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    update public.community_tier_lists
       set like_count    = like_count    + (new.value = 1)::int,
           dislike_count = dislike_count + (new.value = -1)::int
     where id = new.list_id;
  end if;
  return null;
end $$;

drop trigger if exists tier_list_reaction_counts on public.community_tier_list_reactions;
create trigger tier_list_reaction_counts after insert or update or delete on public.community_tier_list_reactions
  for each row execute function public.trg_tier_list_reaction_counts();

-- 5) RPCs
-- Publish (private -> public) or "Update Community" (already public -> new snapshot version).
create or replace function public.publish_tier_list(p_id uuid)
returns uuid language plpgsql security definer set search_path to '' as $$
declare d record; cid uuid;
begin
  if auth.uid() is null then
    raise exception using message = 'กรุณาเข้าสู่ระบบ', detail = 'AUTH_REQUIRED', errcode = 'P0001';
  end if;
  select t.id, t.visibility into d from public.user_tier_lists t where t.id = p_id and t.user_id = auth.uid();
  if not found then
    raise exception using message = 'ไม่พบ Tier List', detail = 'NOT_FOUND', errcode = 'P0001';
  end if;
  if d.visibility = 'public' then
    perform public.sync_community_tier_list(p_id);
  else
    update public.user_tier_lists set visibility = 'public' where id = p_id; -- trigger creates version 1
  end if;
  select c.id into cid from public.community_tier_lists c where c.source_id = p_id;
  return cid;
end $$;
revoke all on function public.publish_tier_list(uuid) from public, anon;
grant execute on function public.publish_tier_list(uuid) to authenticated;

-- p_sort: 'new' | 'popular' (likes - dislikes) | 'liked' (likes). `data` only when p_only_id is given.
create or replace function public.list_community_tier_lists(
  p_sort text default 'new', p_q text default null,
  p_limit integer default 20, p_offset integer default 0, p_only_id uuid default null)
returns table (
  id uuid, owner_id uuid, author_name text, handle text, avatar_url text,
  title text, description text, patch text, version integer, hero_count integer, preview jsonb,
  like_count integer, dislike_count integer, my_value smallint,
  published_at timestamptz, updated_at timestamptz, data jsonb)
language sql stable security definer set search_path to '' as $$
  select c.id, c.owner_id, p.display_name, p.handle, p.avatar_url,
         c.title, c.description, c.patch, c.version, public.tier_hero_count(c.data), public.tier_preview(c.data, 6),
         c.like_count, c.dislike_count,
         (select r.value from public.community_tier_list_reactions r where r.list_id = c.id and r.user_id = auth.uid()),
         c.published_at, c.updated_at,
         case when p_only_id is not null then c.data end
  from public.community_tier_lists c
  join public.profiles p on p.id = c.owner_id
  where (p_only_id is null or c.id = p_only_id)
    and (c.hidden = false or c.owner_id = auth.uid() or public.is_admin())
    and not exists (select 1 from public.user_blocks b where b.blocker_id = auth.uid() and b.blocked_id = c.owner_id)
    and (
      p_q is null or btrim(p_q) = ''
      or c.title ilike '%' || replace(replace(replace(btrim(p_q), '\', '\\'), '%', '\%'), '_', '\_') || '%'
      or coalesce(c.description, '') ilike '%' || replace(replace(replace(btrim(p_q), '\', '\\'), '%', '\%'), '_', '\_') || '%'
      or c.patch ilike '%' || replace(replace(replace(btrim(p_q), '\', '\\'), '%', '\%'), '_', '\_') || '%'
      or coalesce(p.handle, '') ilike '%' || replace(replace(replace(btrim(p_q), '\', '\\'), '%', '\%'), '_', '\_') || '%'
    )
  order by
    case when p_sort = 'liked'   then c.like_count end desc nulls last,
    case when p_sort = 'popular' then c.like_count - c.dislike_count end desc nulls last,
    c.published_at desc
  limit least(greatest(p_limit, 1), 51) offset greatest(p_offset, 0)
$$;
revoke all on function public.list_community_tier_lists(text, text, integer, integer, uuid) from public;
grant execute on function public.list_community_tier_lists(text, text, integer, integer, uuid) to anon, authenticated;
