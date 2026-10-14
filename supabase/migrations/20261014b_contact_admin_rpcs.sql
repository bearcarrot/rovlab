-- Admin inbox for /contact messages: counts (menu badge), list, triage. Only admins (public.is_admin()) can call these.
-- ALREADY APPLIED to project mttcdaiwuasnkqlxbeqs (migration "contact_admin_rpcs", 2026-10-14). Do not run again.
-- Follows the admin_*_coach_feedback pattern; contact_messages itself stays closed to API clients (see 20261014_contact_messages.sql).

create or replace function public.admin_contact_counts()
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
      'new',   count(*) filter (where status = 'new'),
      'total', count(*)
    )
    from public.contact_messages
  );
end;
$$;
revoke execute on function public.admin_contact_counts() from public, anon;
grant execute on function public.admin_contact_counts() to authenticated;

create or replace function public.admin_list_contact_messages(
  p_status text default 'new',
  p_limit integer default 20,
  p_offset integer default 0)
returns table (
  id uuid, created_at timestamptz, name text, email text, topic text, message text,
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
    select m.id, m.created_at, m.name, m.email, m.topic, m.message,
           m.status, m.admin_note, m.reviewed_at,
           m.user_id, p.display_name, p.handle,
           count(*) over () as total_count
    from public.contact_messages m
    left join public.profiles p on p.id = m.user_id
    where (coalesce(p_status, 'all') = 'all' or m.status = p_status)
    order by m.created_at desc
    limit least(greatest(coalesce(p_limit, 20), 1), 50)
    offset greatest(coalesce(p_offset, 0), 0);
end;
$$;
revoke execute on function public.admin_list_contact_messages(text, integer, integer) from public, anon;
grant execute on function public.admin_list_contact_messages(text, integer, integer) to authenticated;

create or replace function public.admin_update_contact_message(
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
  if p_status is null or p_status not in ('new', 'replied', 'closed') then
    raise exception using message = 'สถานะไม่ถูกต้อง', detail = 'INVALID_STATUS', errcode = 'P0001';
  end if;
  update public.contact_messages
     set status = p_status,
         admin_note = left(nullif(btrim(coalesce(p_note, '')), ''), 1000),
         reviewed_at = case when p_status = 'new' then null else now() end
   where id = p_id;
  if not found then
    raise exception using message = 'ไม่พบรายการนี้', detail = 'NOT_FOUND', errcode = 'P0001';
  end if;
end;
$$;
revoke execute on function public.admin_update_contact_message(uuid, text, text) from public, anon;
grant execute on function public.admin_update_contact_message(uuid, text, text) to authenticated;
