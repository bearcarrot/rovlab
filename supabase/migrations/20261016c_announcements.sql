-- 20261016c_announcements.sql
-- Announcements system for RoV LAB. Spec: docs/superpowers/specs/2026-10-16-announcements-design.md (v2).
-- STATUS: APPLIED TO PRODUCTION (Supabase project mttcdaiwuasnkqlxbeqs) on 2026-10-18 09:17 UTC as migration "announcements_20261016c",
-- applied manually by the repo owner. NOT applied to any dev branch: spec section 11.2 dev-branch verification has NOT been done. Additive only.
-- Do not edit the SQL below (production already has it); any change must be a new follow-up migration.
--
-- Contents: validation helpers -> tables -> RLS / grants -> (RPCs, schedule, dismissals) -> (storage bucket + policies).
-- TS mirror of the validation rules: src/features/announcements/media.ts (shared vectors: tests/announcements/media-vectors.json).

-- ---------------------------------------------------------------------------------------------
-- 1. Validation helpers (internal: no client role can execute them directly)
-- ---------------------------------------------------------------------------------------------

-- trim ALL surrounding whitespace (btrim only removes spaces) and map '' to NULL
create or replace function public.announcement_clean(p text)
returns text
language sql
immutable
set search_path = ''
as $fn$
  select nullif(regexp_replace(p, '^[[:space:]]+|[[:space:]]+$', '', 'g'), '')
$fn$;

-- https only, <= 2048 chars, ASCII (punycode) host with at least one dot, no userinfo, no IPv4 host,
-- path/query/fragment limited to RFC 3986 characters minus quotes (no whitespace, <, >, ", ', backslash)
create or replace function public.announcement_https_url_ok(p text)
returns boolean
language sql
immutable
set search_path = ''
as $fn$
  select coalesce(
    char_length(p) <= 2048
    and p ~ '^https://[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)+(:[0-9]{1,5})?([/?#][][A-Za-z0-9._~:/?#@!$&()*+,;=%-]*)?$'
    and p !~ '^https://[0-9.]+([:/?#]|$)',
    false)
$fn$;

-- YouTube / Vimeo / direct video file, decided by plain regexes on the raw string (no decoding)
create or replace function public.announcement_video_ok(p text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $fn$
declare
  h text;
  pth text;
  q text;
  v text;
begin
  if p is null or not public.announcement_https_url_ok(p) then
    return false;
  end if;
  h := lower(substring(p from '^https://([^/?#:]+)'));
  pth := substring(p from '^https://[^/?#]+([^?#]*)');
  q := substring(p from '^https://[^/?#]+[^?#]*\?([^#]*)');
  if h in ('youtube.com', 'www.youtube.com', 'm.youtube.com') then
    if pth ~ '^/watch/?$' and q is not null then
      v := substring(q from '(?:^|&)v=([^&]*)');
      if v ~ '^[A-Za-z0-9_-]{11}$' then
        return true;
      end if;
    end if;
    if pth ~ '^/(embed|shorts)/[A-Za-z0-9_-]{11}/?$' then
      return true;
    end if;
  elsif h in ('youtube-nocookie.com', 'www.youtube-nocookie.com') then
    if pth ~ '^/embed/[A-Za-z0-9_-]{11}/?$' then
      return true;
    end if;
  elsif h = 'youtu.be' then
    if pth ~ '^/[A-Za-z0-9_-]{11}/?$' then
      return true;
    end if;
  elsif h in ('vimeo.com', 'www.vimeo.com') then
    if pth ~ '^/[0-9]{1,12}/?$' then
      return true;
    end if;
  elsif h = 'player.vimeo.com' then
    if pth ~ '^/video/[0-9]{1,12}/?$' then
      return true;
    end if;
  end if;
  return pth ~* '\.(mp4|webm|ogv)$';
end
$fn$;

-- NULL = valid, otherwise one error code. Check order: presence -> URL validity -> video support -> link_url rule -> label rules.
create or replace function public.announcement_media_error(p_media_type text, p_media_url text, p_link_url text, p_link_label text)
returns text
language plpgsql
immutable
set search_path = ''
as $fn$
declare
  mu text := public.announcement_clean(p_media_url);
  lu text := public.announcement_clean(p_link_url);
  ll text := public.announcement_clean(p_link_label);
  mpath text;
begin
  if p_media_type = 'none' and mu is not null then
    return 'MEDIA_NOT_ALLOWED';
  end if;
  if p_media_type <> 'none' and mu is null then
    return 'MEDIA_URL_REQUIRED';
  end if;
  if mu is not null and not public.announcement_https_url_ok(mu) then
    return 'MEDIA_URL_INVALID';
  end if;
  if lu is not null and not public.announcement_https_url_ok(lu) then
    return 'MEDIA_URL_INVALID';
  end if;
  if p_media_type = 'image' and mu ~ '^https://[^/?#]+/storage/v1/object/public/announcements/' then
    mpath := substring(mu from '^https://[^/?#]+([^?#]*)');
    if mpath !~* '\.(jpg|jpeg|png|webp)$' then
      return 'MEDIA_URL_INVALID';
    end if;
  end if;
  if p_media_type = 'video' and not public.announcement_video_ok(mu) then
    return 'VIDEO_UNSUPPORTED';
  end if;
  if p_media_type = 'link' and lu is not null then
    return 'LINK_URL_NOT_ALLOWED';
  end if;
  if ll is not null and char_length(ll) > 40 then
    return 'LABEL_TOO_LONG';
  end if;
  if ll is not null and lu is null and p_media_type <> 'link' then
    return 'LABEL_WITHOUT_LINK';
  end if;
  return null;
end
$fn$;

revoke all on function public.announcement_clean(text) from public, anon, authenticated;
revoke all on function public.announcement_https_url_ok(text) from public, anon, authenticated;
revoke all on function public.announcement_video_ok(text) from public, anon, authenticated;
revoke all on function public.announcement_media_error(text, text, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------------------------------

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null default '',
  media_type text not null default 'none',
  media_url text,
  link_url text,
  link_label text,
  status text not null default 'draft',
  priority text not null default 'normal',
  is_dismissible boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint announcements_title_len check (char_length(btrim(title)) between 1 and 120),
  constraint announcements_content_len check (char_length(content) <= 4000),
  constraint announcements_media_type_chk check (media_type in ('none', 'image', 'video', 'link')),
  constraint announcements_status_chk check (status in ('draft', 'published', 'archived')),
  constraint announcements_priority_chk check (priority in ('normal', 'important', 'urgent')),
  constraint announcements_window_chk check (starts_at is null or ends_at is null or ends_at > starts_at),
  constraint announcements_media_chk check (public.announcement_media_error(media_type, media_url, link_url, link_label) is null)
);

create table if not exists public.announcement_dismissals (
  user_id uuid not null references auth.users(id) on delete cascade,
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, announcement_id)
);

create index if not exists announcements_published_idx
  on public.announcements (priority, (coalesce(starts_at, created_at)) desc)
  where status = 'published';

create or replace function public.announcements_touch()
returns trigger
language plpgsql
set search_path = ''
as $fn$
begin
  new.updated_at := now();
  return new;
end
$fn$;

revoke all on function public.announcements_touch() from public, anon, authenticated;

drop trigger if exists announcements_touch on public.announcements;
create trigger announcements_touch
  before update on public.announcements
  for each row execute function public.announcements_touch();

-- ---------------------------------------------------------------------------------------------
-- 3. RLS and privileges (clients can only READ; every write goes through the admin RPCs below)
-- ---------------------------------------------------------------------------------------------

alter table public.announcements enable row level security;
revoke all on table public.announcements from public, anon, authenticated;
-- created_by is intentionally NOT readable by clients (no admin identity leak). Clients must select an explicit column list.
grant select (id, title, content, media_type, media_url, link_url, link_label, status, priority, is_dismissible, starts_at, ends_at, created_at, updated_at)
  on table public.announcements to anon, authenticated;

drop policy if exists "announcements public read active" on public.announcements;
create policy "announcements public read active" on public.announcements
  for select to anon, authenticated
  using (
    status = 'published'
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now())
  );

drop policy if exists "announcements admin read all" on public.announcements;
create policy "announcements admin read all" on public.announcements
  for select to authenticated
  using ((select public.is_admin()));

alter table public.announcement_dismissals enable row level security;
revoke all on table public.announcement_dismissals from public, anon, authenticated;
grant select on table public.announcement_dismissals to authenticated;

drop policy if exists "dismissals read own" on public.announcement_dismissals;
create policy "dismissals read own" on public.announcement_dismissals
  for select to authenticated
  using (user_id = (select auth.uid()));
-- Dismissal rows are written only by public.dismiss_announcements(); there is no UPDATE/DELETE path (no reset feature).

-- ---------------------------------------------------------------------------------------------
-- 4. Admin RPCs (the only write path). EXECUTE is granted to every signed-in user, so the FIRST statement
--    of each function is the admin check: ordinary users, moderators and anon cannot get past it.
--    Errors: errcode P0001, Thai message, detail = machine-readable code.
-- ---------------------------------------------------------------------------------------------

create or replace function public.admin_save_announcement(
  p_id uuid,
  p_title text,
  p_content text,
  p_media_type text,
  p_media_url text,
  p_link_url text,
  p_link_label text,
  p_priority text,
  p_is_dismissible boolean,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_title text;
  v_content text;
  v_mu text;
  v_lu text;
  v_ll text;
  v_err text;
  v_id uuid;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception using message = 'ไม่มีสิทธิ์ทำรายการนี้', detail = 'FORBIDDEN', errcode = 'P0001';
  end if;

  v_title := public.announcement_clean(p_title);
  if v_title is null or char_length(v_title) > 120 then
    raise exception using message = 'ชื่อประกาศต้องมี 1-120 ตัวอักษร', detail = 'INVALID_TITLE', errcode = 'P0001';
  end if;
  v_content := coalesce(public.announcement_clean(p_content), '');
  if char_length(v_content) > 4000 then
    raise exception using message = 'เนื้อหายาวเกิน 4000 ตัวอักษร', detail = 'INVALID_CONTENT', errcode = 'P0001';
  end if;
  if p_priority is null or p_priority not in ('normal', 'important', 'urgent') then
    raise exception using message = 'ระดับความสำคัญไม่ถูกต้อง', detail = 'INVALID_PRIORITY', errcode = 'P0001';
  end if;
  if p_media_type is null or p_media_type not in ('none', 'image', 'video', 'link') then
    raise exception using message = 'ประเภทสื่อไม่ถูกต้อง', detail = 'INVALID_MEDIA_TYPE', errcode = 'P0001';
  end if;
  if p_starts_at is not null and p_ends_at is not null and p_ends_at <= p_starts_at then
    raise exception using message = 'เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม', detail = 'INVALID_SCHEDULE', errcode = 'P0001';
  end if;

  v_mu := public.announcement_clean(p_media_url);
  v_lu := public.announcement_clean(p_link_url);
  v_ll := public.announcement_clean(p_link_label);
  v_err := public.announcement_media_error(p_media_type, v_mu, v_lu, v_ll);
  if v_err is not null then
    raise exception using message = 'ข้อมูลสื่อหรือลิงก์ไม่ถูกต้อง', detail = v_err, errcode = 'P0001';
  end if;

  if p_id is null then
    insert into public.announcements (title, content, media_type, media_url, link_url, link_label, priority, is_dismissible, starts_at, ends_at, created_by)
    values (v_title, v_content, p_media_type, v_mu, v_lu, v_ll, p_priority, coalesce(p_is_dismissible, true), p_starts_at, p_ends_at, auth.uid())
    returning id into v_id;
  else
    update public.announcements set title = v_title, content = v_content, media_type = p_media_type, media_url = v_mu, link_url = v_lu, link_label = v_ll, priority = p_priority, is_dismissible = coalesce(p_is_dismissible, true), starts_at = p_starts_at, ends_at = p_ends_at where id = p_id
    returning id into v_id;
    if v_id is null then
      raise exception using message = 'ไม่พบประกาศ', detail = 'NOT_FOUND', errcode = 'P0001';
    end if;
  end if;
  return v_id;
end
$fn$;

create or replace function public.admin_set_announcement_status(p_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_old text;
  v_ends timestamptz;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception using message = 'ไม่มีสิทธิ์ทำรายการนี้', detail = 'FORBIDDEN', errcode = 'P0001';
  end if;

  if p_status is null or p_status not in ('draft', 'published', 'archived') then
    raise exception using message = 'สถานะไม่ถูกต้อง', detail = 'INVALID_STATUS', errcode = 'P0001';
  end if;

  select status, ends_at into v_old, v_ends from public.announcements where id = p_id for update;
  if not found then
    raise exception using message = 'ไม่พบประกาศ', detail = 'NOT_FOUND', errcode = 'P0001';
  end if;

  if v_old = p_status then return; end if; -- idempotent: a double click is not an error
  if v_old = 'archived' and p_status = 'published' then
    raise exception using message = 'ต้องกู้คืนเป็นฉบับร่างก่อนจึงจะเผยแพร่ได้', detail = 'INVALID_TRANSITION', errcode = 'P0001';
  end if;
  if p_status = 'published' and v_ends is not null and v_ends <= now() then
    raise exception using message = 'ประกาศนี้หมดอายุแล้ว', detail = 'ALREADY_EXPIRED', errcode = 'P0001';
  end if;

  update public.announcements set status = p_status where id = p_id;
end
$fn$;

create or replace function public.admin_delete_announcement(p_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_url text;
  v_deleted uuid;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception using message = 'ไม่มีสิทธิ์ทำรายการนี้', detail = 'FORBIDDEN', errcode = 'P0001';
  end if;

  delete from public.announcements where id = p_id returning media_url, id into v_url, v_deleted;
  if v_deleted is null then
    raise exception using message = 'ไม่พบประกาศ', detail = 'NOT_FOUND', errcode = 'P0001';
  end if;
  return v_url; -- lets the client remove the stored image after the row is gone (dismissals cascade)
end
$fn$;

-- ---------------------------------------------------------------------------------------------
-- 5. Public schedule hint + signed-in dismissals
-- ---------------------------------------------------------------------------------------------

-- RLS hides announcements whose start is in the future, so an open tab cannot know when to look again.
-- This returns ONLY two timestamps (no content): the server clock and the next instant at which the public set changes.
create or replace function public.get_announcement_schedule()
returns table (server_now timestamptz, next_change timestamptz)
language sql
stable
security definer
set search_path = ''
as $fn$
  select
    now() as server_now,
    (
      select min(t.ts) from (
        select a.starts_at as ts from public.announcements a where a.status = 'published' and a.starts_at > now()
        union all
        select a.ends_at as ts from public.announcements a where a.status = 'published' and a.ends_at > now() and (a.starts_at is null or a.starts_at <= now())
      ) t
    ) as next_change
$fn$;

create or replace function public.dismiss_announcements(p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_uid uuid;
  v_count integer;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception using message = 'ต้องเข้าสู่ระบบ', detail = 'FORBIDDEN', errcode = 'P0001';
  end if;
  if p_ids is null or coalesce(array_length(p_ids, 1), 0) = 0 or array_length(p_ids, 1) > 200 then
    raise exception using message = 'จำนวนรายการไม่ถูกต้อง (1-200)', detail = 'TOO_MANY_IDS', errcode = 'P0001';
  end if;

  -- unknown ids are ignored silently (no existence oracle); duplicates are ignored
  insert into public.announcement_dismissals (user_id, announcement_id)
  select v_uid, a.id from public.announcements a where a.id = any(p_ids)
  on conflict do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end
$fn$;

revoke all on function public.admin_save_announcement(uuid, text, text, text, text, text, text, text, boolean, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.admin_save_announcement(uuid, text, text, text, text, text, text, text, boolean, timestamptz, timestamptz) to authenticated;

revoke all on function public.admin_set_announcement_status(uuid, text) from public, anon, authenticated;
grant execute on function public.admin_set_announcement_status(uuid, text) to authenticated;

revoke all on function public.admin_delete_announcement(uuid) from public, anon, authenticated;
grant execute on function public.admin_delete_announcement(uuid) to authenticated;

revoke all on function public.get_announcement_schedule() from public, anon, authenticated;
grant execute on function public.get_announcement_schedule() to anon, authenticated;

revoke all on function public.dismiss_announcements(uuid[]) from public, anon, authenticated;
grant execute on function public.dismiss_announcements(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 6. Storage: public bucket for announcement images; only admins may upload or delete.
--    UNVERIFIED ASSUMPTION (spec Q1): the role that applies this migration may create policies on storage.objects.
--    No other migration in this repo does so. If this section fails on the dev branch, STOP: the planned fallback is an
--    Edge Function (service role, caller checked with is_admin()), which is a separate plan.
--    Design notes: no UPDATE policy => objects cannot be overwritten; no anon/public SELECT policy => the bucket cannot be listed
--    (public object URLs keep working because the bucket is public); the admin SELECT policy exists because the Storage API
--    reads an object row before deleting it. SVG/HTML are excluded from allowed_mime_types on purpose.
-- ---------------------------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('announcements', 'announcements', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "announcements admin insert" on storage.objects;
create policy "announcements admin insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'announcements'
    and (select public.is_admin())
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'
  );

drop policy if exists "announcements admin delete" on storage.objects;
create policy "announcements admin delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'announcements' and (select public.is_admin()));

drop policy if exists "announcements admin select" on storage.objects;
create policy "announcements admin select" on storage.objects
  for select to authenticated
  using (bucket_id = 'announcements' and (select public.is_admin()));
