-- Sponsors shown in the Home support section, managed from /admin (tab "ผู้สนับสนุน"). Modeled on 20261016c_announcements.sql.
-- NOT APPLIED. Review, then apply to the production project yourself.
-- Clients can only READ published rows inside their schedule window (explicit column list; created_by is not granted).
-- Every write goes through the admin RPCs below, whose first statement is the is_admin() check.
-- The public site does NOT query this table from the browser: api/public-sponsors.ts reads it with the anon key and the CDN caches the answer.
-- Logos are uploaded through the existing admin upload (R2, https://assets.rovlab.app/...); only that host is accepted.
-- Additive only (new table, helper, RPCs). Reuses announcement_clean / announcement_https_url_ok from 20261016c.

create or replace function public.sponsor_logo_ok(p text)
returns boolean
language sql
immutable
set search_path = ''
as $fn$
  select coalesce(
    public.announcement_https_url_ok(p)
    and p ~ '^https://assets\.rovlab\.app/[^?#]+$'
    and p ~* '\.(jpg|jpeg|png|webp)$',
    false)
$fn$;
revoke all on function public.sponsor_logo_ok(text) from public, anon, authenticated;

create table if not exists public.sponsors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tagline text not null default '',
  logo_url text,
  link_url text not null,
  status text not null default 'draft',
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sponsors_name_len check (char_length(btrim(name)) between 1 and 80),
  constraint sponsors_tagline_len check (char_length(tagline) <= 140),
  constraint sponsors_status_chk check (status in ('draft', 'published', 'archived')),
  constraint sponsors_window_chk check (starts_at is null or ends_at is null or ends_at > starts_at),
  constraint sponsors_link_chk check (public.announcement_https_url_ok(link_url)),
  constraint sponsors_logo_chk check (logo_url is null or public.sponsor_logo_ok(logo_url))
);

create index if not exists sponsors_published_idx on public.sponsors (created_at) where status = 'published';

create or replace function public.sponsors_touch()
returns trigger
language plpgsql
set search_path = ''
as $fn$
begin
  new.updated_at := now();
  return new;
end
$fn$;
revoke all on function public.sponsors_touch() from public, anon, authenticated;

drop trigger if exists sponsors_touch on public.sponsors;
create trigger sponsors_touch
  before update on public.sponsors
  for each row execute function public.sponsors_touch();

alter table public.sponsors enable row level security;
revoke all on table public.sponsors from public, anon, authenticated;
grant select (id, name, tagline, logo_url, link_url, status, starts_at, ends_at, created_at, updated_at)
  on table public.sponsors to anon, authenticated;

drop policy if exists "sponsors public read active" on public.sponsors;
create policy "sponsors public read active" on public.sponsors
  for select to anon, authenticated
  using (
    status = 'published'
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now())
  );

drop policy if exists "sponsors admin read all" on public.sponsors;
create policy "sponsors admin read all" on public.sponsors
  for select to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------------------------------
-- Admin RPCs (errors: errcode P0001, Thai message, detail = machine-readable code)
-- ---------------------------------------------------------------------------------------------

create or replace function public.admin_save_sponsor(
  p_id uuid,
  p_name text,
  p_tagline text,
  p_logo_url text,
  p_link_url text,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_name text;
  v_tag text;
  v_logo text;
  v_link text;
  v_id uuid;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception using message = 'ไม่มีสิทธิ์ทำรายการนี้', detail = 'FORBIDDEN', errcode = 'P0001';
  end if;

  v_name := public.announcement_clean(p_name);
  if v_name is null or char_length(v_name) > 80 then
    raise exception using message = 'ชื่อผู้สนับสนุนต้องมี 1-80 ตัวอักษร', detail = 'INVALID_NAME', errcode = 'P0001';
  end if;
  v_tag := coalesce(public.announcement_clean(p_tagline), '');
  if char_length(v_tag) > 140 then
    raise exception using message = 'ข้อความสั้นยาวเกิน 140 ตัวอักษร', detail = 'INVALID_TAGLINE', errcode = 'P0001';
  end if;
  v_link := public.announcement_clean(p_link_url);
  if v_link is null or not public.announcement_https_url_ok(v_link) then
    raise exception using message = 'ลิงก์ปลายทางต้องเป็น https:// ที่ถูกต้อง', detail = 'INVALID_LINK', errcode = 'P0001';
  end if;
  v_logo := public.announcement_clean(p_logo_url);
  if v_logo is not null and not public.sponsor_logo_ok(v_logo) then
    raise exception using message = 'โลโก้ต้องอัปโหลดผ่านระบบ (JPG/PNG/WebP)', detail = 'INVALID_LOGO', errcode = 'P0001';
  end if;
  if p_starts_at is not null and p_ends_at is not null and p_ends_at <= p_starts_at then
    raise exception using message = 'เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม', detail = 'INVALID_SCHEDULE', errcode = 'P0001';
  end if;

  if p_id is null then
    insert into public.sponsors (name, tagline, logo_url, link_url, starts_at, ends_at, created_by)
    values (v_name, v_tag, v_logo, v_link, p_starts_at, p_ends_at, auth.uid())
    returning id into v_id;
  else
    update public.sponsors
       set name = v_name, tagline = v_tag, logo_url = v_logo, link_url = v_link, starts_at = p_starts_at, ends_at = p_ends_at
     where id = p_id
    returning id into v_id;
    if v_id is null then
      raise exception using message = 'ไม่พบผู้สนับสนุน', detail = 'NOT_FOUND', errcode = 'P0001';
    end if;
  end if;
  return v_id;
end
$fn$;

create or replace function public.admin_set_sponsor_status(p_id uuid, p_status text)
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

  select status, ends_at into v_old, v_ends from public.sponsors where id = p_id for update;
  if not found then
    raise exception using message = 'ไม่พบผู้สนับสนุน', detail = 'NOT_FOUND', errcode = 'P0001';
  end if;

  if v_old = p_status then return; end if;
  if v_old = 'archived' and p_status = 'published' then
    raise exception using message = 'ต้องกู้คืนเป็นฉบับร่างก่อนจึงจะเผยแพร่ได้', detail = 'INVALID_TRANSITION', errcode = 'P0001';
  end if;
  if p_status = 'published' and v_ends is not null and v_ends <= now() then
    raise exception using message = 'ช่วงเวลาของผู้สนับสนุนนี้หมดอายุแล้ว', detail = 'ALREADY_EXPIRED', errcode = 'P0001';
  end if;

  update public.sponsors set status = p_status where id = p_id;
end
$fn$;

-- Returns the deleted row's logo_url so the client can remove the stored file after the row is gone.
create or replace function public.admin_delete_sponsor(p_id uuid)
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
  delete from public.sponsors where id = p_id returning logo_url, id into v_url, v_deleted;
  if v_deleted is null then
    raise exception using message = 'ไม่พบผู้สนับสนุน', detail = 'NOT_FOUND', errcode = 'P0001';
  end if;
  return v_url;
end
$fn$;

revoke all on function public.admin_save_sponsor(uuid, text, text, text, text, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.admin_save_sponsor(uuid, text, text, text, text, timestamptz, timestamptz) to authenticated;

revoke all on function public.admin_set_sponsor_status(uuid, text) from public, anon, authenticated;
grant execute on function public.admin_set_sponsor_status(uuid, text) to authenticated;

revoke all on function public.admin_delete_sponsor(uuid) from public, anon, authenticated;
grant execute on function public.admin_delete_sponsor(uuid) to authenticated;
