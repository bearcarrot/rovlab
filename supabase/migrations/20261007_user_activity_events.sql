-- Lightweight activity tracking for the Admin Dashboard.
-- ALREADY APPLIED to project mttcdaiwuasnkqlxbeqs (migration "user_activity_events", 2026-10-07). Do not run again.
-- Authenticated users insert only their own meaningful feature events (whitelisted types, tiny metadata).
-- Only admins can read (is_admin()). 90-day retention via purge_old_user_activity() (not scheduled).

create table if not exists public.user_activity_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_type text not null check (event_type in (
    'ai_coach_used',
    'draft_created', 'draft_loaded', 'draft_shared',
    'tier_list_created', 'tier_list_shared',
    'hero_viewed', 'stats_viewed', 'matchup_viewed', 'counter_pick_used'
  )),
  metadata jsonb check (metadata is null or (jsonb_typeof(metadata) = 'object' and pg_column_size(metadata) <= 512)),
  created_at timestamptz not null default now()
);

-- Dashboard queries are all range scans on created_at (today / 7d / 30d / latest N).
create index if not exists user_activity_events_created_idx on public.user_activity_events (created_at desc);

alter table public.user_activity_events enable row level security;
revoke all on public.user_activity_events from anon, authenticated;
grant insert, select on public.user_activity_events to authenticated;

drop policy if exists "insert own activity" on public.user_activity_events;
create policy "insert own activity" on public.user_activity_events
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "admin read activity" on public.user_activity_events;
create policy "admin read activity" on public.user_activity_events
  for select to authenticated
  using ((select public.is_admin()));

-- "Today" = calendar day in Thailand time. Internal helper (not callable by clients).
create or replace function public._activity_window(p_from timestamptz)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'active_users', count(distinct e.user_id),
    'activities',   count(*),
    'ai_coach',     count(*) filter (where e.event_type = 'ai_coach_used'),
    'draft',        count(*) filter (where e.event_type like 'draft\_%'),
    'tier_list',    count(*) filter (where e.event_type like 'tier\_list\_%'),
    'new_users',    (select count(*) from public.profiles p where p.created_at >= p_from)
  )
  from public.user_activity_events e
  where e.created_at >= p_from;
$$;
revoke execute on function public._activity_window(timestamptz) from public, anon, authenticated;

create or replace function public.admin_activity_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  t0  timestamptz := date_trunc('day', now() at time zone 'Asia/Bangkok') at time zone 'Asia/Bangkok';
  w7  timestamptz;
  w30 timestamptz;
begin
  if not public.is_admin() then
    raise exception using message = 'คุณไม่มีสิทธิ์ทำรายการนี้', detail = 'FORBIDDEN', errcode = 'P0001';
  end if;
  w7  := t0 - interval '6 days';
  w30 := t0 - interval '29 days';
  return jsonb_build_object(
    'today', public._activity_window(t0),
    'd7',    public._activity_window(w7),
    'd30',   public._activity_window(w30),
    'features', coalesce((
      select jsonb_agg(jsonb_build_object('event_type', f.event_type, 'today', f.c_today, 'd7', f.c_7, 'd30', f.c_30)
                       order by f.c_30 desc)
      from (
        select e.event_type,
               count(*) filter (where e.created_at >= t0)  as c_today,
               count(*) filter (where e.created_at >= w7)  as c_7,
               count(*)                                    as c_30
        from public.user_activity_events e
        where e.created_at >= w30
        group by e.event_type
      ) f
    ), '[]'::jsonb)
  );
end;
$$;
revoke execute on function public.admin_activity_summary() from public, anon;
grant execute on function public.admin_activity_summary() to authenticated;

create or replace function public.admin_recent_activity(p_limit integer default 30)
returns table (
  id uuid, created_at timestamptz, event_type text, metadata jsonb,
  user_id uuid, display_name text, handle text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception using message = 'คุณไม่มีสิทธิ์ทำรายการนี้', detail = 'FORBIDDEN', errcode = 'P0001';
  end if;
  return query
    select e.id, e.created_at, e.event_type, e.metadata, e.user_id, p.display_name, p.handle
    from public.user_activity_events e
    left join public.profiles p on p.id = e.user_id
    order by e.created_at desc
    limit least(greatest(coalesce(p_limit, 30), 1), 50);
end;
$$;
revoke execute on function public.admin_recent_activity(integer) from public, anon;
grant execute on function public.admin_recent_activity(integer) to authenticated;

-- Retention (target 90 days). Not scheduled: run manually (admin) or from pg_cron if it is ever enabled.
-- Never deletes anything newer than 30 days regardless of the argument.
create or replace function public.purge_old_user_activity(p_days integer default 90)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare n bigint;
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception using message = 'คุณไม่มีสิทธิ์ทำรายการนี้', detail = 'FORBIDDEN', errcode = 'P0001';
  end if;
  delete from public.user_activity_events
   where created_at < now() - make_interval(days => greatest(coalesce(p_days, 90), 30));
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke execute on function public.purge_old_user_activity(integer) from public, anon;
grant execute on function public.purge_old_user_activity(integer) to authenticated;
