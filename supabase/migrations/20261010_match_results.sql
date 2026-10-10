-- Match results read from post-match scoreboard screenshots (OCR) + daily quota for the scoreboard-ocr Edge Function.
-- NOT APPLIED YET. Run in the Supabase SQL editor, then deploy the `scoreboard-ocr` function (see docs/MATCH_OCR.md).
--
-- Privacy: the screenshot itself is never stored, and other players' nicknames are not stored
-- (match_results.players holds hero + stats only).

-- ========== match_results ==========
create table if not exists public.match_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  result text not null check (result in ('victory', 'defeat')),
  score_blue smallint not null check (score_blue between 0 and 200),
  score_red smallint not null check (score_red between 0 and 200),
  duration_sec integer not null check (duration_sec between 30 and 7200),
  -- wall-clock time printed on the scoreboard (no time zone is shown in the game)
  played_at timestamp not null,
  my_team text not null default 'blue' check (my_team in ('blue', 'red')),
  my_hero_id uuid references public.heroes(id) on delete set null,
  my_hero_name text not null check (char_length(my_hero_name) between 1 and 60),
  my_kills smallint not null check (my_kills between 0 and 200),
  my_deaths smallint not null check (my_deaths between 0 and 200),
  my_assists smallint not null check (my_assists between 0 and 300),
  my_gold integer not null check (my_gold between 0 and 100000),
  my_rating numeric(4, 1) not null check (my_rating between 0 and 30),
  my_mvp boolean not null default false,
  -- 10 rows: {team, hero, hero_id, kills, deaths, assists, gold, rating, mvp, is_me}
  players jsonb not null check (jsonb_typeof(players) = 'array' and jsonb_array_length(players) = 10),
  -- true when the user changed what the OCR returned before saving (lets us measure OCR accuracy)
  ocr_edited boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, played_at, duration_sec)
);

create index if not exists match_results_user_played_idx on public.match_results (user_id, played_at desc);

alter table public.match_results enable row level security;

drop policy if exists "own match_results select" on public.match_results;
create policy "own match_results select" on public.match_results
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "own match_results insert" on public.match_results;
create policy "own match_results insert" on public.match_results
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "own match_results delete" on public.match_results;
create policy "own match_results delete" on public.match_results
  for delete to authenticated using ((select auth.uid()) = user_id);
-- no UPDATE policy on purpose: to fix a row, delete it and save again.

-- ========== OCR quota ==========
-- Day boundary = midnight America/Los_Angeles, which is when the Gemini API daily quota (RPD) resets.
create table if not exists public.ocr_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  n integer not null default 0,
  last_at timestamptz not null default now(),
  primary key (user_id, day)
);
create table if not exists public.ocr_usage_global (
  day date primary key,
  n integer not null default 0
);

alter table public.ocr_usage enable row level security;
alter table public.ocr_usage_global enable row level security;
revoke all on table public.ocr_usage from anon, authenticated;
revoke all on table public.ocr_usage_global from anon, authenticated;
drop policy if exists "no client access" on public.ocr_usage;
create policy "no client access" on public.ocr_usage for all to anon, authenticated using (false) with check (false);
drop policy if exists "no client access" on public.ocr_usage_global;
create policy "no client access" on public.ocr_usage_global for all to anon, authenticated using (false) with check (false);

-- Atomically checks cooldown + per-user limit + global limit and counts one scan.
-- Returns {status: ok|cooldown|user_limit|global_limit, resets_at, user_remaining?}.
create or replace function public.consume_ocr_quota(
  p_user uuid,
  p_user_limit integer,
  p_global_limit integer,
  p_cooldown_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day date := (now() at time zone 'America/Los_Angeles')::date;
  v_resets timestamptz := ((v_day + 1)::timestamp) at time zone 'America/Los_Angeles';
  v_last timestamptz;
  v_u integer;
  v_g integer;
begin
  select last_at into v_last from public.ocr_usage where user_id = p_user and day = v_day;
  if v_last is not null and now() - v_last < make_interval(secs => p_cooldown_seconds) then
    return jsonb_build_object('status', 'cooldown', 'resets_at', v_resets);
  end if;

  insert into public.ocr_usage as u (user_id, day, n, last_at)
  values (p_user, v_day, 1, now())
  on conflict (user_id, day) do update set n = u.n + 1, last_at = now() where u.n < p_user_limit
  returning u.n into v_u;
  if v_u is null then
    return jsonb_build_object('status', 'user_limit', 'resets_at', v_resets);
  end if;

  insert into public.ocr_usage_global as g (day, n)
  values (v_day, 1)
  on conflict (day) do update set n = g.n + 1 where g.n < p_global_limit
  returning g.n into v_g;
  if v_g is null then
    update public.ocr_usage set n = n - 1 where user_id = p_user and day = v_day;
    return jsonb_build_object('status', 'global_limit', 'resets_at', v_resets);
  end if;

  if random() < 0.02 then
    delete from public.ocr_usage where day < v_day - 7;
    delete from public.ocr_usage_global where day < v_day - 7;
  end if;

  return jsonb_build_object('status', 'ok', 'resets_at', v_resets, 'user_remaining', p_user_limit - v_u);
end;
$$;

-- Gives back one scan when Gemini itself failed (the user got nothing) and clears the cooldown.
create or replace function public.refund_ocr_quota(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day date := (now() at time zone 'America/Los_Angeles')::date;
begin
  update public.ocr_usage
     set n = greatest(n - 1, 0), last_at = now() - interval '1 day'
   where user_id = p_user and day = v_day;
  update public.ocr_usage_global set n = greatest(n - 1, 0) where day = v_day;
end;
$$;

revoke all on function public.consume_ocr_quota(uuid, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.refund_ocr_quota(uuid) from public, anon, authenticated;
grant execute on function public.consume_ocr_quota(uuid, integer, integer, integer) to service_role;
grant execute on function public.refund_ocr_quota(uuid) to service_role;
