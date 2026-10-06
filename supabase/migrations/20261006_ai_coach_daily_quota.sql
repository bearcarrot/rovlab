-- APPLIED to project mttcdaiwuasnkqlxbeqs on 2026-10-06 as migration `ai_coach_daily_quota`.
-- Per-user daily quota for the ai-coach edge function (protects the Gemini quota/bill from a single account).
-- Only service_role (the edge function) can touch this; clients have no access.
create table if not exists public.ai_coach_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default ((now() at time zone 'utc')::date),
  n integer not null default 0,
  primary key (user_id, day)
);
alter table public.ai_coach_usage enable row level security;
revoke all on table public.ai_coach_usage from anon, authenticated;
drop policy if exists "no client access" on public.ai_coach_usage;
create policy "no client access" on public.ai_coach_usage for all to anon, authenticated using (false) with check (false);

create or replace function public.consume_ai_quota(p_user uuid, p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v integer;
begin
  insert into public.ai_coach_usage as u (user_id, day, n)
  values (p_user, (now() at time zone 'utc')::date, 1)
  on conflict (user_id, day) do update set n = u.n + 1 where u.n < p_limit
  returning u.n into v;

  if random() < 0.02 then
    delete from public.ai_coach_usage where day < (now() at time zone 'utc')::date - 14;
  end if;

  return v is not null;
end;
$$;
revoke all on function public.consume_ai_quota(uuid, integer) from public, anon, authenticated;
grant execute on function public.consume_ai_quota(uuid, integer) to service_role;
