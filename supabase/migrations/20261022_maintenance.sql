-- 20261022_maintenance.sql
-- Full Maintenance Mode (one-time scheduled window). Additive only; no rows are inserted, so applying it cannot activate maintenance.
-- STATUS: NOT APPLIED to any database. Apply first to a Supabase dev branch, never to production without the repo owner's approval.
-- TS mirror of the window rule: src/features/maintenance/schedule.ts  (active = enabled and starts_at <= now < ends_at; Asia/Bangkok is a UI concern, storage is timestamptz).

-- ---------------------------------------------------------------------------------------------
-- 1. Table: exactly one row (id = 1). Clients get NO direct table access; reads and writes go through the RPCs below.
-- ---------------------------------------------------------------------------------------------

create table if not exists public.site_maintenance (
  id smallint primary key default 1,
  enabled boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  message text not null default '',
  eta_note text not null default '',
  updated_at timestamptz not null default now(),
  constraint site_maintenance_singleton check (id = 1),
  constraint site_maintenance_window_chk check (starts_at is null or ends_at is null or ends_at > starts_at),
  constraint site_maintenance_enabled_chk check (not enabled or (starts_at is not null and ends_at is not null)),
  constraint site_maintenance_message_len check (char_length(message) <= 1000),
  constraint site_maintenance_eta_len check (char_length(eta_note) <= 200)
);

alter table public.site_maintenance enable row level security;
revoke all on table public.site_maintenance from public, anon, authenticated;
-- No policies on purpose: with RLS enabled and no grants, only the SECURITY DEFINER functions below can touch the table.

-- ---------------------------------------------------------------------------------------------
-- 2. Public read: the config plus the server clock (so a wrong device clock cannot shift the window). Always returns one row.
-- ---------------------------------------------------------------------------------------------

create or replace function public.get_maintenance()
returns table (enabled boolean, starts_at timestamptz, ends_at timestamptz, message text, eta_note text, server_now timestamptz)
language sql
stable
security definer
set search_path = ''
as $fn$
  select
    coalesce(m.enabled, false),
    m.starts_at,
    m.ends_at,
    coalesce(m.message, ''),
    coalesce(m.eta_note, ''),
    now()
  from (select 1) one
  left join public.site_maintenance m on m.id = 1
$fn$;

-- ---------------------------------------------------------------------------------------------
-- 3. Admin writes. EXECUTE is granted to every signed-in user, so the FIRST statement is the admin check.
--    Errors: errcode P0001, Thai message, detail = machine-readable code (same convention as the announcement RPCs).
-- ---------------------------------------------------------------------------------------------

create or replace function public.admin_save_maintenance(
  p_enabled boolean,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_message text,
  p_eta_note text
)
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_msg text := btrim(coalesce(p_message, ''));
  v_eta text := btrim(coalesce(p_eta_note, ''));
  v_enabled boolean := coalesce(p_enabled, false);
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception using message = 'ไม่มีสิทธิ์ทำรายการนี้', detail = 'FORBIDDEN', errcode = 'P0001';
  end if;

  if char_length(v_msg) > 1000 or char_length(v_eta) > 200 then
    raise exception using message = 'ข้อความยาวเกินกำหนด', detail = 'INVALID_TEXT', errcode = 'P0001';
  end if;
  if p_starts_at is not null and p_ends_at is not null and p_ends_at <= p_starts_at then
    raise exception using message = 'เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม', detail = 'INVALID_SCHEDULE', errcode = 'P0001';
  end if;
  if v_enabled then
    if p_starts_at is null or p_ends_at is null then
      raise exception using message = 'ต้องระบุเวลาเริ่มและเวลาสิ้นสุด', detail = 'INVALID_SCHEDULE', errcode = 'P0001';
    end if;
    if p_ends_at <= now() then
      raise exception using message = 'เวลาสิ้นสุดผ่านไปแล้ว', detail = 'ALREADY_ENDED', errcode = 'P0001';
    end if;
  end if;

  insert into public.site_maintenance (id, enabled, starts_at, ends_at, message, eta_note, updated_at)
  values (1, v_enabled, p_starts_at, p_ends_at, v_msg, v_eta, now())
  on conflict (id) do update
    set enabled = excluded.enabled,
        starts_at = excluded.starts_at,
        ends_at = excluded.ends_at,
        message = excluded.message,
        eta_note = excluded.eta_note,
        updated_at = now();
end
$fn$;

-- Turns the schedule off but keeps the times and texts, so the admin can re-enable it without retyping.
create or replace function public.admin_disable_maintenance()
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception using message = 'ไม่มีสิทธิ์ทำรายการนี้', detail = 'FORBIDDEN', errcode = 'P0001';
  end if;
  update public.site_maintenance set enabled = false, updated_at = now() where id = 1;
end
$fn$;

revoke all on function public.get_maintenance() from public, anon, authenticated;
grant execute on function public.get_maintenance() to anon, authenticated;

revoke all on function public.admin_save_maintenance(boolean, timestamptz, timestamptz, text, text) from public, anon, authenticated;
grant execute on function public.admin_save_maintenance(boolean, timestamptz, timestamptz, text, text) to authenticated;

revoke all on function public.admin_disable_maintenance() from public, anon, authenticated;
grant execute on function public.admin_disable_maintenance() to authenticated;
