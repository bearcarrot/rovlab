-- Community comments v2 — ADDITIVE on top of the live schema
-- (existing: comments, profiles, admin_users, is_admin(), comments_rate_limit_trg, list_hero_comments)
-- Dry-run validated in a rolled-back transaction against the live project (see docs/community.md).
-- NOT applied automatically: review, then run via `supabase db push` or the SQL editor.

begin;

-- ===== profiles.handle (unique @name used for mentions) =====
alter table public.profiles add column if not exists handle text;
update public.profiles set handle = 'user_' || substr(replace(id::text, '-', ''), 1, 8) where handle is null;
alter table public.profiles alter column handle set not null;
create unique index if not exists profiles_handle_lower_key on public.profiles (lower(handle));
alter table public.profiles drop constraint if exists profiles_handle_format;
alter table public.profiles add constraint profiles_handle_format check (handle ~ '^[A-Za-z0-9_]{3,20}$');

create or replace function public.trg_profiles_default_handle() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.handle is null then new.handle := 'user_' || substr(replace(new.id::text, '-', ''), 1, 8); end if;
  return new;
end $$;
drop trigger if exists profiles_default_handle on public.profiles;
create trigger profiles_default_handle before insert on public.profiles
  for each row execute function public.trg_profiles_default_handle();

-- ===== profanity filter (server-side) =====
-- DATA SOURCE REQUIRED: the word list is intentionally empty. Insert words yourself (see docs/community.md).
create table if not exists public.banned_words (
  id uuid primary key default gen_random_uuid(),
  word text not null unique,
  lang text not null default 'th' check (lang in ('th','en')),
  created_at timestamptz not null default now(),
  constraint banned_words_chars check (word ~ '^[A-Za-z0-9\u0E01-\u0E4E]+$')
);
alter table public.banned_words enable row level security;
drop policy if exists "admin manage banned_words" on public.banned_words;
create policy "admin manage banned_words" on public.banned_words
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.banned_words from anon;

-- Returns the banned words found in t.
--  en: whole-word match, each letter may repeat (fuuuck); checked on the plain text and two leetspeak foldings
--  th: substring match after stripping tone marks / spaces / symbols (Thai has no word spaces); letters may repeat
create or replace function public.profanity_matches(t text) returns text[]
language plpgsql stable security definer set search_path = '' as $$
declare
  variants text[]; v text; th text; res text[] := '{}'; w record;
begin
  variants := array[
    regexp_replace(lower(t), '[^a-z0-9]+', ' ', 'g'),
    regexp_replace(translate(lower(t), '@$0134', 'asoiea'), '[^a-z0-9]+', ' ', 'g'),
    regexp_replace(translate(lower(t), '@$0134!', 'asoieai'), '[^a-z0-9]+', ' ', 'g')
  ];
  th := regexp_replace(regexp_replace(lower(t), '[\u0E47-\u0E4E]', '', 'g'), '[^\u0E01-\u0E46]', '', 'g');
  for w in select word, lang from public.banned_words loop
    if w.lang = 'en' then
      foreach v in array variants loop
        if v ~ ('\m' || regexp_replace(lower(w.word), '(.)', '\1+', 'g') || '\M') then
          res := res || w.word;
          exit;
        end if;
      end loop;
    else
      if th ~ regexp_replace(regexp_replace(w.word, '[\u0E47-\u0E4E]', '', 'g'), '(.)', '\1+', 'g') then
        res := res || w.word;
      end if;
    end if;
  end loop;
  return res;
end $$;
revoke execute on function public.profanity_matches(text) from public, anon, authenticated;

-- profile edits only (never on INSERT: sign-up must not fail because of an email-derived name)
create or replace function public.trg_profiles_filter() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.handle is distinct from old.handle and cardinality(public.profanity_matches(new.handle)) > 0 then
    raise exception using message = 'ชื่อผู้ใช้มีคำที่ไม่เหมาะสม', detail = 'HANDLE_BLOCKED', errcode = 'P0001';
  end if;
  if new.display_name is distinct from old.display_name and new.display_name is not null
     and cardinality(public.profanity_matches(new.display_name)) > 0 then
    raise exception using message = 'ชื่อที่แสดงมีคำที่ไม่เหมาะสม', detail = 'DISPLAY_NAME_BLOCKED', errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists profiles_filter on public.profiles;
create trigger profiles_filter before update of handle, display_name on public.profiles
  for each row execute function public.trg_profiles_filter();

-- ===== comments: extra columns =====
alter table public.comments
  add column if not exists parent_id uuid references public.comments(id) on delete cascade,
  add column if not exists reply_to_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists edited_at timestamptz,
  add column if not exists pinned boolean not null default false,
  add column if not exists hidden boolean not null default false,
  add column if not exists like_count int not null default 0,
  add column if not exists dislike_count int not null default 0,
  add column if not exists reply_count int not null default 0,
  add column if not exists emoji_counts jsonb not null default '{}'::jsonb;
create index if not exists comments_hero_idx on public.comments (hero_slug, parent_id, created_at desc);
create index if not exists comments_parent_idx on public.comments (parent_id, created_at);
create index if not exists comments_user_idx on public.comments (user_id, created_at desc);

-- ===== new tables =====
create table if not exists public.comment_reactions (
  comment_id uuid not null references public.comments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  value smallint not null check (value in (1, -1)),
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);
create table if not exists public.comment_emojis (
  comment_id uuid not null references public.comments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null check (emoji in ('fire','laugh','clap')),
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id, emoji)
);
create table if not exists public.comment_mentions (
  comment_id uuid not null references public.comments(id) on delete cascade,
  mentioned_user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (comment_id, mentioned_user_id)
);
create table if not exists public.comment_reports (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (reason in ('spam','abuse','hate','sexual','other')),
  detail text check (detail is null or char_length(detail) <= 500),
  created_at timestamptz not null default now(),
  unique (comment_id, reporter_id)
);
create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followee_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index if not exists follows_followee_idx on public.follows (followee_id);
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('mention','reply','like','follow')),
  comment_id uuid references public.comments(id) on delete cascade,
  hero_slug text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications (user_id) where read_at is null;
create unique index if not exists notifications_comment_dedupe on public.notifications (user_id, actor_id, type, comment_id) where comment_id is not null;
create unique index if not exists notifications_follow_dedupe on public.notifications (user_id, actor_id) where type = 'follow';

-- ===== notification helper =====
create or replace function public.create_notification(p_user uuid, p_actor uuid, p_type text, p_comment uuid, p_hero text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_user is null or p_actor is null or p_user = p_actor then return; end if;
  if exists (select 1 from public.user_blocks b where b.blocker_id = p_user and b.blocked_id = p_actor) then return; end if;
  insert into public.notifications (user_id, actor_id, type, comment_id, hero_slug)
  values (p_user, p_actor, p_type, p_comment, p_hero) on conflict do nothing;
end $$;
revoke execute on function public.create_notification(uuid, uuid, text, uuid, text) from public, anon, authenticated;

-- ===== comment triggers (the existing comments_rate_limit_trg stays as is) =====
create or replace function public.trg_comments_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare par record;
begin
  new.body := btrim(new.body);
  if new.parent_id is not null then
    select c.id, c.parent_id, c.user_id, c.hero_slug, c.guide_id into par from public.comments c where c.id = new.parent_id;
    if not found then
      raise exception using message = 'ไม่พบความคิดเห็นที่ต้องการตอบกลับ (อาจถูกลบแล้ว)', detail = 'PARENT_NOT_FOUND', errcode = 'P0001';
    end if;
    new.reply_to_user_id := par.user_id;
    if par.parent_id is not null then new.parent_id := par.parent_id; end if; -- one level of nesting
    new.hero_slug := par.hero_slug;
    new.guide_id := par.guide_id;
  end if;
  if cardinality(public.profanity_matches(new.body)) > 0 then
    raise exception using message = 'ข้อความมีคำที่ไม่เหมาะสม กรุณาแก้ไขก่อนส่ง', detail = 'PROFANITY_BLOCKED', errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists comments_before_insert on public.comments;
create trigger comments_before_insert before insert on public.comments
  for each row execute function public.trg_comments_before_insert();

create or replace function public.trg_comments_before_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.body is distinct from old.body then
    new.body := btrim(new.body);
    if cardinality(public.profanity_matches(new.body)) > 0 then
      raise exception using message = 'ข้อความมีคำที่ไม่เหมาะสม กรุณาแก้ไขก่อนส่ง', detail = 'PROFANITY_BLOCKED', errcode = 'P0001';
    end if;
    new.edited_at := now();
  end if;
  return new;
end $$;
drop trigger if exists comments_before_update on public.comments;
create trigger comments_before_update before update on public.comments
  for each row execute function public.trg_comments_before_update();

-- mentions + reply notifications (edits do not re-notify)
create or replace function public.trg_comments_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare m record;
begin
  if new.parent_id is not null then
    update public.comments set reply_count = reply_count + 1 where id = new.parent_id;
  end if;
  for m in
    select distinct p.id
    from regexp_matches(new.body, '@([A-Za-z0-9_]{3,20})', 'g') as r(g)
    join public.profiles p on lower(p.handle) = lower(r.g[1])
    limit 5
  loop
    insert into public.comment_mentions (comment_id, mentioned_user_id) values (new.id, m.id) on conflict do nothing;
    perform public.create_notification(m.id, new.user_id, 'mention', new.id, new.hero_slug);
  end loop;
  if new.reply_to_user_id is not null and not exists (
    select 1 from public.comment_mentions cm where cm.comment_id = new.id and cm.mentioned_user_id = new.reply_to_user_id
  ) then
    perform public.create_notification(new.reply_to_user_id, new.user_id, 'reply', new.id, new.hero_slug);
  end if;
  return null;
end $$;
drop trigger if exists comments_after_insert on public.comments;
create trigger comments_after_insert after insert on public.comments
  for each row execute function public.trg_comments_after_insert();

create or replace function public.trg_comments_after_delete() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.parent_id is not null then
    update public.comments set reply_count = greatest(reply_count - 1, 0) where id = old.parent_id;
  end if;
  return null;
end $$;
drop trigger if exists comments_after_delete on public.comments;
create trigger comments_after_delete after delete on public.comments
  for each row execute function public.trg_comments_after_delete();

-- ===== reaction / emoji / report / follow triggers =====
create or replace function public.trg_reaction_counts() returns trigger
language plpgsql security definer set search_path = '' as $$
declare c record;
begin
  if tg_op in ('DELETE', 'UPDATE') then
    update public.comments
       set like_count = greatest(like_count - (old.value = 1)::int, 0),
           dislike_count = greatest(dislike_count - (old.value = -1)::int, 0)
     where id = old.comment_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    update public.comments
       set like_count = like_count + (new.value = 1)::int,
           dislike_count = dislike_count + (new.value = -1)::int
     where id = new.comment_id;
    if new.value = 1 then
      select cm.user_id, cm.hero_slug into c from public.comments cm where cm.id = new.comment_id;
      perform public.create_notification(c.user_id, new.user_id, 'like', new.comment_id, c.hero_slug);
    end if;
  end if;
  return null;
end $$;
drop trigger if exists comment_reactions_counts on public.comment_reactions;
create trigger comment_reactions_counts after insert or update or delete on public.comment_reactions
  for each row execute function public.trg_reaction_counts();

create or replace function public.trg_emoji_counts() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update public.comments
       set emoji_counts = jsonb_set(emoji_counts, array[new.emoji], to_jsonb(coalesce((emoji_counts ->> new.emoji)::int, 0) + 1), true)
     where id = new.comment_id;
  elsif tg_op = 'DELETE' then
    update public.comments
       set emoji_counts = jsonb_set(emoji_counts, array[old.emoji], to_jsonb(greatest(coalesce((emoji_counts ->> old.emoji)::int, 0) - 1, 0)), true)
     where id = old.comment_id;
  end if;
  return null;
end $$;
drop trigger if exists comment_emojis_counts on public.comment_emojis;
create trigger comment_emojis_counts after insert or delete on public.comment_emojis
  for each row execute function public.trg_emoji_counts();

-- auto-hide a comment once 3 different people reported it (admins can unhide)
create or replace function public.trg_reports_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.comment_reports r where r.comment_id = new.comment_id) >= 3 then
    update public.comments set hidden = true where id = new.comment_id;
  end if;
  return null;
end $$;
drop trigger if exists comment_reports_after_insert on public.comment_reports;
create trigger comment_reports_after_insert after insert on public.comment_reports
  for each row execute function public.trg_reports_after_insert();

create or replace function public.trg_follows_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.create_notification(new.followee_id, new.follower_id, 'follow', null, null);
  return null;
end $$;
drop trigger if exists follows_after_insert on public.follows;
create trigger follows_after_insert after insert on public.follows
  for each row execute function public.trg_follows_after_insert();

revoke execute on function
  public.trg_profiles_default_handle(), public.trg_profiles_filter(),
  public.trg_comments_before_insert(), public.trg_comments_before_update(),
  public.trg_comments_after_insert(), public.trg_comments_after_delete(),
  public.trg_reaction_counts(), public.trg_emoji_counts(),
  public.trg_reports_after_insert(), public.trg_follows_after_insert()
  from public, anon, authenticated;

-- ===== RLS + grants =====
alter table public.comment_reactions enable row level security;
alter table public.comment_emojis enable row level security;
alter table public.comment_mentions enable row level security;
alter table public.comment_reports enable row level security;
alter table public.user_blocks enable row level security;
alter table public.follows enable row level security;
alter table public.notifications enable row level security;

-- comments: hidden rows are only visible to their author and admins (replaces "public read comments")
drop policy if exists "public read comments" on public.comments;
drop policy if exists "read visible comments" on public.comments;
create policy "read visible comments" on public.comments for select
  using (hidden = false or user_id = auth.uid() or public.is_admin());
-- existing policies kept as is: insert own / update own / delete own / admin delete
-- clients can only write the columns they should (no counters / pinned / hidden / reply_to_user_id)
revoke insert, update, delete, truncate, references, trigger on public.comments from anon;
revoke insert, update on public.comments from authenticated;
grant insert (user_id, hero_slug, guide_id, body, parent_id) on public.comments to authenticated;
grant update (body) on public.comments to authenticated;

drop policy if exists "own reactions" on public.comment_reactions;
create policy "own reactions" on public.comment_reactions for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own emojis" on public.comment_emojis;
create policy "own emojis" on public.comment_emojis for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "read own mentions" on public.comment_mentions;
create policy "read own mentions" on public.comment_mentions for select to authenticated
  using (mentioned_user_id = auth.uid());
revoke insert, update, delete on public.comment_mentions from authenticated;
drop policy if exists "insert own report" on public.comment_reports;
drop policy if exists "read own or admin reports" on public.comment_reports;
create policy "insert own report" on public.comment_reports for insert to authenticated with check (auth.uid() = reporter_id);
create policy "read own or admin reports" on public.comment_reports for select to authenticated
  using (auth.uid() = reporter_id or public.is_admin());
revoke update, delete on public.comment_reports from authenticated;
drop policy if exists "own blocks" on public.user_blocks;
create policy "own blocks" on public.user_blocks for all to authenticated
  using (auth.uid() = blocker_id) with check (auth.uid() = blocker_id);
drop policy if exists "public read follows" on public.follows;
drop policy if exists "follow as self" on public.follows;
drop policy if exists "unfollow as self" on public.follows;
create policy "public read follows" on public.follows for select using (true);
create policy "follow as self" on public.follows for insert to authenticated with check (auth.uid() = follower_id);
create policy "unfollow as self" on public.follows for delete to authenticated using (auth.uid() = follower_id);
revoke insert, update, delete on public.follows from anon;
drop policy if exists "read own notifications" on public.notifications;
drop policy if exists "update own notifications" on public.notifications;
drop policy if exists "delete own notifications" on public.notifications;
create policy "read own notifications" on public.notifications for select to authenticated using (auth.uid() = user_id);
create policy "update own notifications" on public.notifications for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own notifications" on public.notifications for delete to authenticated using (auth.uid() = user_id);
revoke insert, update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;
revoke all on public.comment_reactions, public.comment_emojis, public.comment_mentions, public.comment_reports,
  public.user_blocks, public.notifications from anon;

-- ===== RPCs (security definer: profiles stays owner-only; these expose only display_name / handle / avatar, like list_hero_comments already does) =====
create or replace function public.list_comments(
  p_hero_slug text, p_parent_id uuid default null, p_sort text default 'top',
  p_limit int default 20, p_offset int default 0, p_only_id uuid default null
) returns table (
  id uuid, parent_id uuid, user_id uuid, author_name text, handle text, avatar_url text, is_admin boolean,
  reply_to_name text, reply_to_handle text, body text, created_at timestamptz, edited_at timestamptz,
  pinned boolean, hidden boolean, like_count int, dislike_count int, reply_count int, emoji_counts jsonb,
  my_value smallint, my_emojis text[]
) language sql stable security definer set search_path = '' as $$
  select c.id, c.parent_id, c.user_id, p.display_name, p.handle, p.avatar_url,
         exists (select 1 from public.admin_users a where a.user_id = c.user_id),
         rp.display_name, rp.handle, c.body, c.created_at, c.edited_at, c.pinned, c.hidden,
         c.like_count, c.dislike_count, c.reply_count, c.emoji_counts,
         (select r.value from public.comment_reactions r where r.comment_id = c.id and r.user_id = auth.uid()),
         coalesce((select array_agg(e.emoji) from public.comment_emojis e where e.comment_id = c.id and e.user_id = auth.uid()), '{}'::text[])
  from public.comments c
  join public.profiles p on p.id = c.user_id
  left join public.profiles rp on rp.id = c.reply_to_user_id
  where c.hero_slug = p_hero_slug
    and (
      (p_only_id is not null and c.id = p_only_id)
      or (p_only_id is null and ((p_parent_id is null and c.parent_id is null) or c.parent_id = p_parent_id))
    )
    and (c.hidden = false or c.user_id = auth.uid() or public.is_admin())
    and not exists (select 1 from public.user_blocks b where b.blocker_id = auth.uid() and b.blocked_id = c.user_id)
  order by
    (c.pinned and p_parent_id is null) desc,
    case when p_parent_id is null and p_sort = 'top' then (c.like_count - c.dislike_count) end desc nulls last,
    case when p_parent_id is not null then c.created_at end asc nulls last,
    c.created_at desc
  limit least(greatest(p_limit, 1), 101) offset greatest(p_offset, 0)
$$;

-- keep the old RPC working, but without replies / hidden comments
create or replace function public.list_hero_comments(p_hero_slug text, p_limit integer default 50)
returns table(id uuid, user_id uuid, body text, created_at timestamptz, author_name text, avatar_url text)
language sql stable security definer set search_path to 'public' as $$
  select c.id, c.user_id, c.body, c.created_at, p.display_name, p.avatar_url
  from public.comments c
  left join public.profiles p on p.id = c.user_id
  where c.hero_slug = p_hero_slug and c.parent_id is null and c.hidden = false
  order by c.created_at desc
  limit least(greatest(p_limit, 1), 100);
$$;

create or replace function public.following_feed(p_limit int default 20, p_offset int default 0)
returns table (id uuid, hero_slug text, body text, created_at timestamptz, parent_id uuid, user_id uuid, author_name text, handle text, avatar_url text)
language sql stable security definer set search_path = '' as $$
  select c.id, c.hero_slug, c.body, c.created_at, c.parent_id, c.user_id, p.display_name, p.handle, p.avatar_url
  from public.comments c
  join public.follows f on f.followee_id = c.user_id and f.follower_id = auth.uid()
  join public.profiles p on p.id = c.user_id
  where c.hidden = false and c.hero_slug is not null
  order by c.created_at desc
  limit least(greatest(p_limit, 1), 50) offset greatest(p_offset, 0)
$$;

create or replace function public.list_notifications(p_limit int default 50)
returns table (id uuid, type text, actor_id uuid, actor_name text, actor_handle text, comment_id uuid, hero_slug text, created_at timestamptz, read_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select n.id, n.type, n.actor_id, p.display_name, p.handle, n.comment_id, n.hero_slug, n.created_at, n.read_at
  from public.notifications n
  join public.profiles p on p.id = n.actor_id
  where n.user_id = auth.uid()
  order by n.created_at desc
  limit least(greatest(p_limit, 1), 100)
$$;

create or replace function public.search_handles(p_q text)
returns table (id uuid, handle text, display_name text, avatar_url text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.handle, p.display_name, p.avatar_url
  from public.profiles p
  where auth.uid() is not null
    and length(regexp_replace(p_q, '[^A-Za-z0-9_]', '', 'g')) > 0
    and lower(p.handle) like lower(replace(regexp_replace(p_q, '[^A-Za-z0-9_]', '', 'g'), '_', '\_')) || '%'
  order by p.handle
  limit 6
$$;

create or replace function public.resolve_handle(p_handle text) returns uuid
language sql stable security definer set search_path = '' as $$
  select p.id from public.profiles p where lower(p.handle) = lower(p_handle)
$$;

-- admin moderation (pin / hide) uses the existing is_admin() / admin_users
create or replace function public.admin_set_comment_flags(p_id uuid, p_pinned boolean default null, p_hidden boolean default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception using message = 'คุณไม่มีสิทธิ์ทำรายการนี้', detail = 'FORBIDDEN', errcode = 'P0001';
  end if;
  update public.comments set pinned = coalesce(p_pinned, pinned), hidden = coalesce(p_hidden, hidden) where id = p_id;
end $$;

revoke execute on function public.following_feed(int, int), public.list_notifications(int), public.search_handles(text),
  public.admin_set_comment_flags(uuid, boolean, boolean) from public, anon;
grant execute on function public.following_feed(int, int), public.list_notifications(int), public.search_handles(text),
  public.admin_set_comment_flags(uuid, boolean, boolean) to authenticated;

-- ===== realtime for the bell =====
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.notifications;
  end if;
exception when duplicate_object then null;
end $$;

commit;
