-- Draft Series + Community Draft (Global Ban Pick brief, phases 2-3)
--
-- Reuses the existing public.saved_drafts table (RLS: own rows only, 0 rows at time of writing)
-- instead of creating a parallel "my drafts" table. Existing columns my_team / enemy_team are kept
-- (the client keeps writing game 1 there for backward compatibility); the full series lives in `series`.
--
-- Community Draft = immutable snapshot (public.community_drafts) of a published saved draft.
-- Clients can never write community_drafts directly: snapshots are created/updated/removed by
-- triggers and the publish_draft() RPC, which copy from the owner's own saved_drafts row.
-- Publish-time checks (title, profanity) live in sync_community_snapshot(), so editing a public
-- draft never touches its snapshot; the owner pushes a new version with publish_draft().
--
-- Verified on the live project inside a rolled-back transaction (RLS as owner / other user / anon).

-- 1) saved_drafts: series metadata + visibility
alter table public.saved_drafts
  add column if not exists description     text,
  add column if not exists format          text        not null default 'single',
  add column if not exists global_ban_pick boolean     not null default false,
  add column if not exists game7_rule      text        not null default 'normal',
  add column if not exists series          jsonb,
  add column if not exists visibility      text        not null default 'private',
  add column if not exists updated_at      timestamptz not null default now();

alter table public.saved_drafts
  alter column my_team    set default '[]'::jsonb,
  alter column enemy_team set default '[]'::jsonb;

alter table public.saved_drafts drop constraint if exists saved_drafts_format_chk;
alter table public.saved_drafts drop constraint if exists saved_drafts_game7_chk;
alter table public.saved_drafts drop constraint if exists saved_drafts_visibility_chk;
alter table public.saved_drafts drop constraint if exists saved_drafts_name_len_chk;
alter table public.saved_drafts drop constraint if exists saved_drafts_desc_len_chk;
alter table public.saved_drafts drop constraint if exists saved_drafts_series_chk;
alter table public.saved_drafts
  add constraint saved_drafts_format_chk     check (format in ('single', 'bo3', 'bo5', 'bo7')),
  add constraint saved_drafts_game7_chk      check (game7_rule in ('normal', 'global', 'ultimate')),
  add constraint saved_drafts_visibility_chk check (visibility in ('private', 'public')),
  add constraint saved_drafts_name_len_chk   check (name is null or char_length(name) <= 80),
  add constraint saved_drafts_desc_len_chk   check (description is null or char_length(description) <= 500),
  add constraint saved_drafts_series_chk     check (series is null or (jsonb_typeof(series) = 'object' and pg_column_size(series) <= 65536));

create index if not exists saved_drafts_user_updated_idx on public.saved_drafts (user_id, updated_at desc);

-- 2) community_drafts (published snapshots) + reactions
create table if not exists public.community_drafts (
  id               uuid primary key default gen_random_uuid(),
  source_draft_id  uuid not null unique references public.saved_drafts (id) on delete cascade,
  owner_id         uuid not null references public.profiles (id) on delete cascade,
  title            text not null check (char_length(title) between 1 and 80),
  description      text check (description is null or char_length(description) <= 500),
  format           text not null check (format in ('single', 'bo3', 'bo5', 'bo7')),
  global_ban_pick  boolean not null,
  game7_rule       text not null check (game7_rule in ('normal', 'global', 'ultimate')),
  series           jsonb not null check (jsonb_typeof(series) = 'object'),
  version          integer not null default 1,
  like_count       integer not null default 0,
  dislike_count    integer not null default 0,
  hidden           boolean not null default false,
  published_at     timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists community_drafts_published_idx on public.community_drafts (published_at desc) where hidden = false;
create index if not exists community_drafts_liked_idx     on public.community_drafts (like_count desc) where hidden = false;

create table if not exists public.community_draft_reactions (
  draft_id    uuid not null references public.community_drafts (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  value       smallint not null check (value in (-1, 1)),
  created_at  timestamptz not null default now(),
  primary key (draft_id, user_id)
);

alter table public.community_drafts          enable row level security;
alter table public.community_draft_reactions enable row level security;

drop policy if exists "read visible community drafts" on public.community_drafts;
create policy "read visible community drafts" on public.community_drafts
  for select to anon, authenticated
  using (hidden = false or owner_id = auth.uid() or public.is_admin());

drop policy if exists "admin delete community drafts" on public.community_drafts;
create policy "admin delete community drafts" on public.community_drafts
  for delete to authenticated
  using (public.is_admin());

drop policy if exists "own draft reactions" on public.community_draft_reactions;
create policy "own draft reactions" on public.community_draft_reactions
  for all to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.community_drafts d where d.id = draft_id and d.hidden = false)
  );

-- Supabase grants everything to anon/authenticated by default; community_drafts has no write policies,
-- but we also remove the privileges so nothing depends on RLS alone.
revoke all on public.community_drafts          from anon, authenticated;
revoke all on public.community_draft_reactions from anon, authenticated;
grant select on public.community_drafts to anon, authenticated;
grant delete on public.community_drafts to authenticated; -- admin policy only
grant select, insert, update, delete on public.community_draft_reactions to authenticated;

-- 3) triggers
create or replace function public.trg_saved_drafts_before()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  new.name        := nullif(btrim(new.name), '');
  new.description := nullif(btrim(new.description), '');
  if tg_op = 'INSERT' then
    if (select count(*) from public.saved_drafts d where d.user_id = new.user_id) >= 50 then
      raise exception using message = 'บันทึก Draft ได้สูงสุด 50 รายการ', detail = 'DRAFT_LIMIT_REACHED', errcode = 'P0001';
    end if;
  else
    new.user_id    := old.user_id; -- owner is immutable
    new.updated_at := now();
  end if;
  if new.series is not null
     and (jsonb_typeof(new.series -> 'games') is distinct from 'array'
          or jsonb_array_length(new.series -> 'games') not between 1 and 7) then
    raise exception using message = 'ข้อมูล Draft ไม่ถูกต้อง', detail = 'DRAFT_INVALID', errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists saved_drafts_before on public.saved_drafts;
create trigger saved_drafts_before before insert or update on public.saved_drafts
  for each row execute function public.trg_saved_drafts_before();

-- Copies the owner's current draft into the community snapshot. Re-running it = new version
-- (likes/dislikes are kept). Internal only: not callable by clients.
create or replace function public.sync_community_snapshot(p_id uuid)
returns void language plpgsql security definer set search_path to '' as $$
declare d record;
begin
  select * into d from public.saved_drafts where id = p_id and visibility = 'public';
  if not found then return; end if;
  if d.name is null then
    raise exception using message = 'กรุณาตั้งชื่อ Draft ก่อนเผยแพร่', detail = 'DRAFT_TITLE_REQUIRED', errcode = 'P0001';
  end if;
  if d.series is null then
    raise exception using message = 'ข้อมูล Draft ไม่ถูกต้อง', detail = 'DRAFT_INVALID', errcode = 'P0001';
  end if;
  if cardinality(public.profanity_matches(d.name || ' ' || coalesce(d.description, ''))) > 0 then
    raise exception using message = 'ข้อความมีคำที่ไม่เหมาะสม กรุณาแก้ไขก่อนเผยแพร่', detail = 'PROFANITY_BLOCKED', errcode = 'P0001';
  end if;
  insert into public.community_drafts
    (source_draft_id, owner_id, title, description, format, global_ban_pick, game7_rule, series)
  values (d.id, d.user_id, d.name, d.description, d.format, d.global_ban_pick, d.game7_rule, d.series)
  on conflict (source_draft_id) do update
    set title           = excluded.title,
        description     = excluded.description,
        format          = excluded.format,
        global_ban_pick = excluded.global_ban_pick,
        game7_rule      = excluded.game7_rule,
        series          = excluded.series,
        version         = public.community_drafts.version + 1,
        updated_at      = now();
end $$;
revoke all on function public.sync_community_snapshot(uuid) from public, anon, authenticated;

create or replace function public.trg_saved_drafts_after()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if new.visibility = 'public' and (tg_op = 'INSERT' or old.visibility is distinct from 'public') then
    perform public.sync_community_snapshot(new.id);
  elsif tg_op = 'UPDATE' and new.visibility = 'private' and old.visibility = 'public' then
    delete from public.community_drafts where source_draft_id = new.id;
  end if;
  return null;
end $$;

drop trigger if exists saved_drafts_after on public.saved_drafts;
create trigger saved_drafts_after after insert or update of visibility on public.saved_drafts
  for each row execute function public.trg_saved_drafts_after();

create or replace function public.trg_draft_reaction_counts()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if tg_op in ('DELETE', 'UPDATE') then
    update public.community_drafts
       set like_count    = greatest(like_count    - (old.value = 1)::int, 0),
           dislike_count = greatest(dislike_count - (old.value = -1)::int, 0)
     where id = old.draft_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    update public.community_drafts
       set like_count    = like_count    + (new.value = 1)::int,
           dislike_count = dislike_count + (new.value = -1)::int
     where id = new.draft_id;
  end if;
  return null;
end $$;

drop trigger if exists draft_reaction_counts on public.community_draft_reactions;
create trigger draft_reaction_counts after insert or update or delete on public.community_draft_reactions
  for each row execute function public.trg_draft_reaction_counts();

-- 4) RPCs
-- Publish (private -> public) or "Update Community" (already public -> new snapshot version).
create or replace function public.publish_draft(p_id uuid)
returns uuid language plpgsql security definer set search_path to '' as $$
declare d record; cid uuid;
begin
  if auth.uid() is null then
    raise exception using message = 'กรุณาเข้าสู่ระบบ', detail = 'AUTH_REQUIRED', errcode = 'P0001';
  end if;
  select s.id, s.visibility into d from public.saved_drafts s where s.id = p_id and s.user_id = auth.uid();
  if not found then
    raise exception using message = 'ไม่พบ Draft', detail = 'NOT_FOUND', errcode = 'P0001';
  end if;
  if d.visibility = 'public' then
    perform public.sync_community_snapshot(p_id);
  else
    update public.saved_drafts set visibility = 'public' where id = p_id; -- trigger creates version 1
  end if;
  select c.id into cid from public.community_drafts c where c.source_draft_id = p_id;
  return cid;
end $$;
revoke all on function public.publish_draft(uuid) from public, anon;
grant execute on function public.publish_draft(uuid) to authenticated;

-- Public listing. p_sort: 'new' (default) | 'popular' (likes - dislikes) | 'liked' (likes).
-- The heavy `series` column is only returned when a single draft is requested via p_only_id.
create or replace function public.list_community_drafts(
  p_sort text default 'new', p_q text default null,
  p_limit integer default 20, p_offset integer default 0, p_only_id uuid default null)
returns table (
  id uuid, owner_id uuid, author_name text, handle text, avatar_url text,
  title text, description text, format text, global_ban_pick boolean, game7_rule text,
  version integer, like_count integer, dislike_count integer, my_value smallint,
  published_at timestamptz, updated_at timestamptz, series jsonb)
language sql stable security definer set search_path to '' as $$
  select c.id, c.owner_id, p.display_name, p.handle, p.avatar_url,
         c.title, c.description, c.format, c.global_ban_pick, c.game7_rule,
         c.version, c.like_count, c.dislike_count,
         (select r.value from public.community_draft_reactions r where r.draft_id = c.id and r.user_id = auth.uid()),
         c.published_at, c.updated_at,
         case when p_only_id is not null then c.series end
  from public.community_drafts c
  join public.profiles p on p.id = c.owner_id
  where (p_only_id is null or c.id = p_only_id)
    and (c.hidden = false or c.owner_id = auth.uid() or public.is_admin())
    and not exists (select 1 from public.user_blocks b where b.blocker_id = auth.uid() and b.blocked_id = c.owner_id)
    and (
      p_q is null or btrim(p_q) = ''
      or c.title ilike '%' || replace(replace(replace(btrim(p_q), '\', '\\'), '%', '\%'), '_', '\_') || '%'
      or coalesce(c.description, '') ilike '%' || replace(replace(replace(btrim(p_q), '\', '\\'), '%', '\%'), '_', '\_') || '%'
      or coalesce(p.handle, '') ilike '%' || replace(replace(replace(btrim(p_q), '\', '\\'), '%', '\%'), '_', '\_') || '%'
    )
  order by
    case when p_sort = 'liked'   then c.like_count end desc nulls last,
    case when p_sort = 'popular' then c.like_count - c.dislike_count end desc nulls last,
    c.published_at desc
  limit least(greatest(p_limit, 1), 51) offset greatest(p_offset, 0)
$$;
revoke all on function public.list_community_drafts(text, text, integer, integer, uuid) from public;
grant execute on function public.list_community_drafts(text, text, integer, integer, uuid) to anon, authenticated;
