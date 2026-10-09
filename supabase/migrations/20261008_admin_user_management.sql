-- Admin user management (phase 1 + 2): list/detail (with full email), grant/revoke admin, content moderation, audit log.
-- ALREADY APPLIED to project mttcdaiwuasnkqlxbeqs (migration "admin_user_management", 2026-10-08). Do not run again.
-- Everything goes through SECURITY DEFINER RPCs that check public.is_admin(); no service role in the frontend.

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references auth.users (id) on delete set null,
  action text not null check (action in (
    'grant_admin', 'revoke_admin',
    'remove_avatar', 'clear_bio', 'clear_game_name', 'clear_contacts',
    'hide_comments', 'unhide_comments'
  )),
  target_user_id uuid references auth.users (id) on delete set null,
  meta jsonb check (meta is null or pg_column_size(meta) <= 2048),
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_log_target_idx on public.admin_audit_log (target_user_id, created_at desc);

alter table public.admin_audit_log enable row level security;
revoke all on public.admin_audit_log from anon, authenticated;
grant select on public.admin_audit_log to authenticated;
drop policy if exists "admin read audit" on public.admin_audit_log;
create policy "admin read audit" on public.admin_audit_log
  for select to authenticated
  using ((select public.is_admin()));
-- no insert/update/delete policy: rows are written only by the functions below (append-only)

create or replace function public.admin_list_users(
  p_q text default null,
  p_filter text default 'all',
  p_limit integer default 20,
  p_offset integer default 0)
returns table (
  id uuid, display_name text, handle text, avatar_url text, email text,
  created_at timestamptz, last_sign_in_at timestamptz, is_admin boolean, last_active_at timestamptz,
  draft_count bigint, tier_list_count bigint, comment_count bigint, report_count bigint, total_count bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_q text := nullif(btrim(coalesce(p_q, '')), '');
  v_like text;
begin
  if not public.is_admin() then
    raise exception using message = 'คุณไม่มีสิทธิ์ทำรายการนี้', detail = 'FORBIDDEN', errcode = 'P0001';
  end if;
  if v_q is not null then
    v_like := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;
  return query
  with base as (
    select p.id as uid, p.display_name as dn, p.handle as hd, p.avatar_url as av, u.email::text as em,
           p.created_at as ca, u.last_sign_in_at as ls,
           exists (select 1 from public.admin_users a where a.user_id = p.id) as adm,
           (select count(*) from public.comment_reports r
              join public.comments c on c.id = r.comment_id where c.user_id = p.id) as rep
    from public.profiles p
    left join auth.users u on u.id = p.id
    where v_like is null
       or p.display_name ilike v_like or p.handle ilike v_like or u.email ilike v_like
  ), filtered as (
    select b.*, count(*) over () as tot
    from base b
    where case coalesce(p_filter, 'all')
            when 'admin' then b.adm
            when 'new7' then b.ca >= now() - interval '7 days'
            when 'reported' then b.rep > 0
            else true
          end
  )
  select f.uid, f.dn, f.hd, f.av, f.em, f.ca, f.ls, f.adm,
         (select max(e.created_at) from public.user_activity_events e where e.user_id = f.uid),
         (select count(*) from public.saved_drafts d where d.user_id = f.uid),
         (select count(*) from public.user_tier_lists t where t.user_id = f.uid),
         (select count(*) from public.comments c where c.user_id = f.uid),
         f.rep, f.tot
  from filtered f
  order by f.ca desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

create or replace function public.admin_user_detail(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare r jsonb;
begin
  if not public.is_admin() then
    raise exception using message = 'คุณไม่มีสิทธิ์ทำรายการนี้', detail = 'FORBIDDEN', errcode = 'P0001';
  end if;
  select jsonb_build_object(
    'id', p.id,
    'display_name', p.display_name,
    'handle', p.handle,
    'avatar_url', p.avatar_url,
    'bio', p.bio,
    'game_name', p.game_name,
    'contact_links', coalesce(p.contact_links, '[]'::jsonb),
    'created_at', p.created_at,
    'email', u.email,
    'email_confirmed_at', u.email_confirmed_at,
    'last_sign_in_at', u.last_sign_in_at,
    'is_admin', exists (select 1 from public.admin_users a where a.user_id = p.id),
    'last_active_at', (select max(e.created_at) from public.user_activity_events e where e.user_id = p.id),
    'counts', jsonb_build_object(
      'drafts', (select count(*) from public.saved_drafts d where d.user_id = p.id),
      'public_drafts', (select count(*) from public.saved_drafts d where d.user_id = p.id and d.visibility = 'public'),
      'tier_lists', (select count(*) from public.user_tier_lists t where t.user_id = p.id),
      'public_tier_lists', (select count(*) from public.user_tier_lists t where t.user_id = p.id and t.visibility = 'public'),
      'comments', (select count(*) from public.comments c where c.user_id = p.id),
      'hidden_comments', (select count(*) from public.comments c where c.user_id = p.id and c.hidden),
      'reports_received', (select count(*) from public.comment_reports rr
                             join public.comments cc on cc.id = rr.comment_id where cc.user_id = p.id)
    ),
    'activity_30d', coalesce((
      select jsonb_object_agg(x.event_type, x.n)
      from (select e.event_type, count(*) as n
              from public.user_activity_events e
             where e.user_id = p.id and e.created_at >= now() - interval '30 days'
             group by e.event_type) x
    ), '{}'::jsonb),
    'recent_comments', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', c.id, 'body', left(c.body, 300), 'hero_slug', c.hero_slug,
               'hidden', c.hidden, 'created_at', c.created_at) order by c.created_at desc)
      from (select c0.* from public.comments c0 where c0.user_id = p.id order by c0.created_at desc limit 10) c
    ), '[]'::jsonb),
    'reports', coalesce((
      select jsonb_agg(jsonb_build_object(
               'comment_id', q.comment_id, 'reason', q.reason,
               'detail', left(coalesce(q.detail, ''), 300), 'created_at', q.created_at) order by q.created_at desc)
      from (select rr.* from public.comment_reports rr
              join public.comments cc on cc.id = rr.comment_id
             where cc.user_id = p.id order by rr.created_at desc limit 10) q
    ), '[]'::jsonb)
  )
  into r
  from public.profiles p
  left join auth.users u on u.id = p.id
  where p.id = p_id;

  if r is null then
    raise exception using message = 'ไม่พบผู้ใช้', detail = 'NOT_FOUND', errcode = 'P0001';
  end if;
  return r;
end;
$$;

create or replace function public.admin_set_admin(p_id uuid, p_value boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare n integer;
begin
  if not public.is_admin() then
    raise exception using message = 'คุณไม่มีสิทธิ์ทำรายการนี้', detail = 'FORBIDDEN', errcode = 'P0001';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_id) then
    raise exception using message = 'ไม่พบผู้ใช้', detail = 'NOT_FOUND', errcode = 'P0001';
  end if;

  if p_value then
    insert into public.admin_users (user_id)
    select p_id where not exists (select 1 from public.admin_users a where a.user_id = p_id);
    get diagnostics n = row_count;
    if n > 0 then
      insert into public.admin_audit_log (admin_id, action, target_user_id) values (auth.uid(), 'grant_admin', p_id);
    end if;
  else
    if p_id = auth.uid() then
      raise exception using message = 'ถอดสิทธิ์แอดมินของตัวเองไม่ได้', detail = 'SELF_REVOKE', errcode = 'P0001';
    end if;
    if (select count(*) from public.admin_users) <= 1 then
      raise exception using message = 'ต้องมีแอดมินอย่างน้อย 1 คน', detail = 'LAST_ADMIN', errcode = 'P0001';
    end if;
    delete from public.admin_users where user_id = p_id;
    get diagnostics n = row_count;
    if n > 0 then
      insert into public.admin_audit_log (admin_id, action, target_user_id) values (auth.uid(), 'revoke_admin', p_id);
    end if;
  end if;
end;
$$;

-- Content moderation on a user. Returns how many rows changed.
create or replace function public.admin_moderate_user(p_id uuid, p_action text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare n integer := 0;
begin
  if not public.is_admin() then
    raise exception using message = 'คุณไม่มีสิทธิ์ทำรายการนี้', detail = 'FORBIDDEN', errcode = 'P0001';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_id) then
    raise exception using message = 'ไม่พบผู้ใช้', detail = 'NOT_FOUND', errcode = 'P0001';
  end if;

  if p_action = 'remove_avatar' then
    update public.profiles set avatar_url = null, avatar_updated_at = now() where id = p_id and avatar_url is not null;
  elsif p_action = 'clear_bio' then
    update public.profiles set bio = null where id = p_id and bio is not null;
  elsif p_action = 'clear_game_name' then
    update public.profiles set game_name = null where id = p_id and game_name is not null;
  elsif p_action = 'clear_contacts' then
    update public.profiles set contact_links = '[]'::jsonb, contact = null where id = p_id;
  elsif p_action = 'hide_comments' then
    update public.comments set hidden = true where user_id = p_id and hidden = false;
  elsif p_action = 'unhide_comments' then
    update public.comments set hidden = false where user_id = p_id and hidden = true;
  else
    raise exception using message = 'การกระทำไม่ถูกต้อง', detail = 'BAD_ACTION', errcode = 'P0001';
  end if;
  get diagnostics n = row_count;

  insert into public.admin_audit_log (admin_id, action, target_user_id, meta)
  values (auth.uid(), p_action, p_id, jsonb_build_object('affected', n));
  return n;
end;
$$;

create or replace function public.admin_audit_recent(p_user uuid default null, p_limit integer default 20)
returns table (
  id uuid, created_at timestamptz, action text, admin_name text,
  target_id uuid, target_name text, meta jsonb)
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
    select l.id, l.created_at, l.action, pa.display_name, l.target_user_id, pt.display_name, l.meta
    from public.admin_audit_log l
    left join public.profiles pa on pa.id = l.admin_id
    left join public.profiles pt on pt.id = l.target_user_id
    where p_user is null or l.target_user_id = p_user
    order by l.created_at desc
    limit least(greatest(coalesce(p_limit, 20), 1), 50);
end;
$$;

revoke execute on function public.admin_list_users(text, text, integer, integer) from public, anon;
revoke execute on function public.admin_user_detail(uuid) from public, anon;
revoke execute on function public.admin_set_admin(uuid, boolean) from public, anon;
revoke execute on function public.admin_moderate_user(uuid, text) from public, anon;
revoke execute on function public.admin_audit_recent(uuid, integer) from public, anon;
grant execute on function public.admin_list_users(text, text, integer, integer) to authenticated;
grant execute on function public.admin_user_detail(uuid) to authenticated;
grant execute on function public.admin_set_admin(uuid, boolean) to authenticated;
grant execute on function public.admin_moderate_user(uuid, text) to authenticated;
grant execute on function public.admin_audit_recent(uuid, integer) to authenticated;
