-- APPLIED to project mttcdaiwuasnkqlxbeqs on 2026-10-12 as migration `ocr_multi_image_quota`.
-- Multi-image OCR quota: the per-user limit counts IMAGES, the global limit counts REQUESTS (Gemini RPD counts requests).
-- Both functions keep working for the old single-image Edge Function call because the new parameters have defaults.

drop function if exists public.consume_ocr_quota(uuid, integer, integer, integer);
drop function if exists public.refund_ocr_quota(uuid);

-- p_images = how many screenshots this request carries.
create or replace function public.consume_ocr_quota(
  p_user uuid,
  p_user_limit integer,
  p_global_limit integer,
  p_cooldown_seconds integer,
  p_images integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day date := (now() at time zone 'America/Los_Angeles')::date;
  v_resets timestamptz := ((v_day + 1)::timestamp) at time zone 'America/Los_Angeles';
  v_n integer := greatest(coalesce(p_images, 1), 1);
  v_last timestamptz;
  v_u integer;
  v_g integer;
begin
  if v_n > p_user_limit then
    return jsonb_build_object('status', 'user_limit', 'resets_at', v_resets);
  end if;

  select last_at into v_last from public.ocr_usage where user_id = p_user and day = v_day;
  if v_last is not null and now() - v_last < make_interval(secs => p_cooldown_seconds) then
    return jsonb_build_object('status', 'cooldown', 'resets_at', v_resets);
  end if;

  insert into public.ocr_usage as u (user_id, day, n, last_at)
  values (p_user, v_day, v_n, now())
  on conflict (user_id, day) do update set n = u.n + v_n, last_at = now() where u.n + v_n <= p_user_limit
  returning u.n into v_u;
  if v_u is null then
    return jsonb_build_object('status', 'user_limit', 'resets_at', v_resets);
  end if;

  insert into public.ocr_usage_global as g (day, n)
  values (v_day, 1)
  on conflict (day) do update set n = g.n + 1 where g.n < p_global_limit
  returning g.n into v_g;
  if v_g is null then
    update public.ocr_usage set n = n - v_n where user_id = p_user and day = v_day;
    return jsonb_build_object('status', 'global_limit', 'resets_at', v_resets);
  end if;

  if random() < 0.02 then
    delete from public.ocr_usage where day < v_day - 7;
    delete from public.ocr_usage_global where day < v_day - 7;
  end if;

  return jsonb_build_object('status', 'ok', 'resets_at', v_resets, 'user_remaining', p_user_limit - v_u);
end;
$$;

-- Gives back images (and optionally the request) when Gemini did not deliver; also clears the cooldown.
create or replace function public.refund_ocr_quota(p_user uuid, p_images integer default 1, p_request boolean default true)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day date := (now() at time zone 'America/Los_Angeles')::date;
begin
  update public.ocr_usage
     set n = greatest(n - greatest(coalesce(p_images, 0), 0), 0), last_at = now() - interval '1 day'
   where user_id = p_user and day = v_day;
  if p_request then
    update public.ocr_usage_global set n = greatest(n - 1, 0) where day = v_day;
  end if;
end;
$$;

revoke all on function public.consume_ocr_quota(uuid, integer, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.refund_ocr_quota(uuid, integer, boolean) from public, anon, authenticated;
grant execute on function public.consume_ocr_quota(uuid, integer, integer, integer, integer) to service_role;
grant execute on function public.refund_ocr_quota(uuid, integer, boolean) to service_role;
