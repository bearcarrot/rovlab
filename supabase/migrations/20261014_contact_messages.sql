-- Contact form messages (/contact). Guests and signed-in users can send; only admins/service role can read.
-- ALREADY APPLIED to project mttcdaiwuasnkqlxbeqs (migration "contact_messages", 2026-10-14). Do not run again.
-- Clients never touch the table directly: they call submit_contact_message() (validated + rate-limited).
-- No policies on purpose: nobody reads or writes the table through the API; read it in the Supabase dashboard
-- (or add admin RPCs like admin_list_coach_feedback later when an in-app inbox is wanted).

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  -- null for guests; kept (set null) if the account is deleted so the message is not lost
  user_id uuid references public.profiles (id) on delete set null,
  name text not null check (char_length(name) between 1 and 80),
  email text not null check (char_length(email) between 5 and 254),
  topic text not null check (topic in ('feedback', 'data_error', 'privacy', 'copyright', 'other')),
  message text not null check (char_length(message) between 10 and 2000),
  page text check (page is null or char_length(page) <= 300),
  status text not null default 'new' check (status in ('new', 'replied', 'closed')),
  admin_note text check (admin_note is null or char_length(admin_note) <= 1000),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists contact_messages_status_created_idx on public.contact_messages (status, created_at desc);
create index if not exists contact_messages_email_created_idx on public.contact_messages (lower(email), created_at desc);
create index if not exists contact_messages_user_created_idx on public.contact_messages (user_id, created_at desc);

alter table public.contact_messages enable row level security;
revoke all on public.contact_messages from anon, authenticated;

-- Rolling 24h limits: 3 per email, 5 per signed-in user, 200 site-wide (stops one source flooding the inbox).
create or replace function public.submit_contact_message(
  p_name text,
  p_email text,
  p_topic text,
  p_message text,
  p_page text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := btrim(coalesce(p_name, ''));
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_message text := btrim(coalesce(p_message, ''));
  v_id uuid;
begin
  if char_length(v_name) < 1 or char_length(v_name) > 80 then
    raise exception using message = 'กรุณากรอกชื่อ (ไม่เกิน 80 ตัวอักษร)', detail = 'INVALID_NAME', errcode = 'P0001';
  end if;
  if char_length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception using message = 'รูปแบบอีเมลไม่ถูกต้อง', detail = 'INVALID_EMAIL', errcode = 'P0001';
  end if;
  if p_topic is null or p_topic not in ('feedback', 'data_error', 'privacy', 'copyright', 'other') then
    raise exception using message = 'กรุณาเลือกหัวข้อ', detail = 'INVALID_TOPIC', errcode = 'P0001';
  end if;
  if char_length(v_message) < 10 or char_length(v_message) > 2000 then
    raise exception using message = 'ข้อความต้องยาว 10–2000 ตัวอักษร', detail = 'INVALID_MESSAGE', errcode = 'P0001';
  end if;

  if (select count(*) from public.contact_messages m
       where lower(m.email) = v_email and m.created_at > now() - interval '24 hours') >= 3
     or (v_uid is not null and (select count(*) from public.contact_messages m
          where m.user_id = v_uid and m.created_at > now() - interval '24 hours') >= 5)
     or (select count(*) from public.contact_messages m
          where m.created_at > now() - interval '24 hours') >= 200 then
    raise exception using message = 'ส่งข้อความบ่อยเกินไป กรุณาลองใหม่ภายหลัง', detail = 'RATE_LIMITED', errcode = 'P0001';
  end if;

  insert into public.contact_messages (user_id, name, email, topic, message, page)
  values (
    v_uid,
    v_name,
    v_email,
    p_topic,
    v_message,
    case when p_page ~ '^/[^/]' or p_page = '/' then left(p_page, 300) else null end
  )
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.submit_contact_message(text, text, text, text, text) from public;
grant execute on function public.submit_contact_message(text, text, text, text, text) to anon, authenticated;
