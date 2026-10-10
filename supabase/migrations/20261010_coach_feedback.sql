-- Coach Ai answer feedback (Like / Dislike + "what is wrong" report) for admin review.
-- ALREADY APPLIED to project mttcdaiwuasnkqlxbeqs (migration "coach_feedback", 2026-10-10). Do not run again.
-- Clients never touch the table directly: they call submit_coach_feedback() (own rows only, validated, rate-limited).
-- Only admins can read / triage, through SECURITY DEFINER RPCs that check public.is_admin().

create table if not exists public.coach_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  rating text not null check (rating in ('like', 'dislike')),
  question text not null check (char_length(question) between 1 and 500),
  answer text not null check (char_length(answer) between 1 and 8000),
  -- what the user typed when they disliked ("ผิดตรงไหน"); required for dislike (see submit_coach_feedback)
  comment text check (comment is null or char_length(comment) <= 1000),
  page text check (page is null or char_length(page) <= 300),
  -- the exact data the AI was given (same 8000-char cut the edge function applies); kept for dislikes so an admin
  -- can tell "AI made it up" apart from "our data is wrong". Never exposed to anyone but admins.
  context text check (context is null or char_length(context) <= 8000),
  status text not null default 'new' check (status in ('new', 'reviewed', 'fixed', 'dismissed')),
  admin_note text check (admin_note is null or char_length(admin_note) <= 1000),
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists coach_feedback_status_created_idx on public.coach_feedback (status, created_at desc);
create index if not exists coach_feedback_rating_created_idx on public.coach_feedback (rating, created_at desc);
create index if not exists coach_feedback_user_created_idx on public.coach_feedback (user_id, created_at desc);

alter table public.coach_feedback enable row level security;
revoke all on public.coach_feedback from anon, authenticated;
-- no policies on purpose: nobody reads or writes the table directly; everything goes through the RPCs below

-- ---- user: submit feedback ------------------------------------------------------------------------------------
-- 30 submissions per user per rolling 24h (stops one account flooding the admin queue).
create or replace function public.submit_coach_feedback(
  p_rating text,
  p_question text,
  p_answer text,
  p_comment text default null,
  p_page text default null,
  p_context text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_comment text := nullif(btrim(coalesce(p_comment, '')), '');
  v_id uuid;
begin
  if v_uid is null then
    raise exception using message = 'กรุณาเข้าสู่ระบบก่อน', detail = 'UNAUTHENTICATED', errcode = 'P0001';
  end if;
  if p_rating is null or p_rating not in ('like', 'dislike') then
    raise exception using message = 'ข้อมูลไม่ถูกต้อง', detail = 'INVALID_RATING', errcode = 'P0001';
  end if;
  if nullif(btrim(coalesce(p_question, '')), '') is null or nullif(btrim(coalesce(p_answer, '')), '') is null then
    raise exception using message = 'ข้อมูลไม่ถูกต้อง', detail = 'INVALID_INPUT', errcode = 'P0001';
  end if;
  if p_rating = 'dislike' and (v_comment is null or char_length(v_comment) < 3) then
    raise exception using message = 'กรุณาบอกด้วยว่าคำตอบผิดตรงไหน', detail = 'COMMENT_REQUIRED', errcode = 'P0001';
  end if;
  if (select count(*) from public.coach_feedback f
       where f.user_id = v_uid and f.created_at > now() - interval '24 hours') >= 30 then
    raise exception using message = 'ส่งรีวิวบ่อยเกินไป ลองใหม่พรุ่งนี้', detail = 'RATE_LIMITED', errcode = 'P0001';
  end if;

  insert into public.coach_feedback (user_id, rating, question, answer, comment, page, context)
  values (
    v_uid,
    p_rating,
    left(btrim(p_question), 500),
    left(p_answer, 8000),
    case when p_rating = 'dislike' then left(v_comment, 1000) else null end,
    -- internal paths only (the admin UI renders this as a link)
    case when p_page ~ '^/[^/]' or p_page = '/' then left(p_page, 300) else null end,
    case when p_rating = 'dislike' then left(nullif(p_context, ''), 8000) else null end
  )
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.submit_coach_feedback(text, text, text, text, text, text) from public, anon;
grant execute on function public.submit_coach_feedback(text, text, text, text, text, text) to authenticated;

-- ---- admin: counts, list, triage ------------------------------------------------------------------------------
create or replace function public.admin_coach_feedback_counts()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception using message = 'คุณไม่มีสิทธิ์ทำรายการนี้', detail = 'FORBIDDEN', errcode = 'P0001';
  end if;
  return (
    select jsonb_build_object(
      'likes',       count(*) filter (where rating = 'like'),
      'dislikes',    count(*) filter (where rating = 'dislike'),
      'new_reports', count(*) filter (where rating = 'dislike' and status = 'new')
    )
    from public.coach_feedback
  );
end;
$$;
revoke execute on function public.admin_coach_feedback_counts() from public, anon;
grant execute on function public.admin_coach_feedback_counts() to authenticated;

create or replace function public.admin_list_coach_feedback(
  p_status text default 'new',
  p_rating text default 'dislike',
  p_limit integer default 20,
  p_offset integer default 0)
returns table (
  id uuid, created_at timestamptz, rating text, question text, answer text, comment text, page text, context text,
  status text, admin_note text, reviewed_at timestamptz,
  user_id uuid, display_name text, handle text, total_count bigint)
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
    select f.id, f.created_at, f.rating, f.question, f.answer, f.comment, f.page, f.context,
           f.status, f.admin_note, f.reviewed_at,
           f.user_id, p.display_name, p.handle,
           count(*) over () as total_count
    from public.coach_feedback f
    left join public.profiles p on p.id = f.user_id
    where (coalesce(p_status, 'all') = 'all' or f.status = p_status)
      and (coalesce(p_rating, 'all') = 'all' or f.rating = p_rating)
    order by f.created_at desc
    limit least(greatest(coalesce(p_limit, 20), 1), 50)
    offset greatest(coalesce(p_offset, 0), 0);
end;
$$;
revoke execute on function public.admin_list_coach_feedback(text, text, integer, integer) from public, anon;
grant execute on function public.admin_list_coach_feedback(text, text, integer, integer) to authenticated;

create or replace function public.admin_update_coach_feedback(
  p_id uuid,
  p_status text,
  p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception using message = 'คุณไม่มีสิทธิ์ทำรายการนี้', detail = 'FORBIDDEN', errcode = 'P0001';
  end if;
  if p_status is null or p_status not in ('new', 'reviewed', 'fixed', 'dismissed') then
    raise exception using message = 'สถานะไม่ถูกต้อง', detail = 'INVALID_STATUS', errcode = 'P0001';
  end if;
  update public.coach_feedback
     set status = p_status,
         admin_note = left(nullif(btrim(coalesce(p_note, '')), ''), 1000),
         reviewed_by = case when p_status = 'new' then null else auth.uid() end,
         reviewed_at = case when p_status = 'new' then null else now() end
   where id = p_id;
  if not found then
    raise exception using message = 'ไม่พบรายการนี้', detail = 'NOT_FOUND', errcode = 'P0001';
  end if;
end;
$$;
revoke execute on function public.admin_update_coach_feedback(uuid, text, text) from public, anon;
grant execute on function public.admin_update_coach_feedback(uuid, text, text) to authenticated;
