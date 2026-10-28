-- Adds the 'advertising' topic to the /contact form (sponsor / advertising inquiries).
-- NOT APPLIED. Apply BEFORE deploying the frontend change, otherwise choosing the new topic returns INVALID_TOPIC.
-- Only the topic whitelist changes; the body of submit_contact_message is otherwise identical to 20261014_contact_messages.sql
-- (validation, rate limits, page handling). Existing rows are unaffected.

alter table public.contact_messages drop constraint if exists contact_messages_topic_check;
alter table public.contact_messages
  add constraint contact_messages_topic_check
  check (topic in ('feedback', 'data_error', 'privacy', 'copyright', 'advertising', 'other'));

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
  if p_topic is null or p_topic not in ('feedback', 'data_error', 'privacy', 'copyright', 'advertising', 'other') then
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
