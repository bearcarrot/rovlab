-- Admin roles (member / moderator / admin / super_admin) + Verified Creator.
-- ALREADY APPLIED to production (project mttcdaiwuasnkqlxbeqs) on 2026-10-10 as three migrations:
--   admin_roles_creator_verification, profiles_protected_column_grants, admin_audit_log_new_actions
-- Kept here so the repo history matches. Safe to re-run (idempotent).

-- ===== 1. System roles on admin_users (member = no row) =====
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'admin_users' and column_name = 'role') then
    alter table public.admin_users add column role text not null default 'admin';
    -- existing admins predate roles: keep their full powers
    update public.admin_users set role = 'super_admin';
  end if;
end $$;

alter table public.admin_users drop constraint if exists admin_users_role_check;
alter table public.admin_users add constraint admin_users_role_check
  check (role in ('moderator', 'admin', 'super_admin'));

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_users
                 where user_id = auth.uid() and role in ('admin', 'super_admin'));
$$;

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_users
                 where user_id = auth.uid() and role = 'super_admin');
$$;

create or replace function public.is_moderator()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_users
                 where user_id = auth.uid() and role in ('moderator', 'admin', 'super_admin'));
$$;

-- ===== 2. Public profile fields (verified is independent of role) =====
alter table public.profiles add column if not exists account_status text not null default 'active';
alter table public.profiles add column if not exists verified_category text;

alter table public.profiles drop constraint if exists profiles_account_status_check;
alter table public.profiles add constraint profiles_account_status_check
  check (account_status in ('active', 'suspended'));
alter table public.profiles drop constraint if exists profiles_verified_category_check;
alter table public.profiles add constraint profiles_verified_category_check
  check (verified_category is null
         or verified_category in ('streamer', 'pro_player', 'public_figure', 'community_creator'));

-- Only trusted roles (SECURITY DEFINER owner / service) may touch these columns.
-- Not SECURITY DEFINER on purpose: current_user is then the real caller.
create or replace function public.trg_profiles_protect()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      if new.verified_category is not null or new.account_status <> 'active' then
        raise exception using message = 'ไม่อนุญาตให้ตั้งค่าฟิลด์นี้', detail = 'PROTECTED_COLUMN', errcode = 'P0001';
      end if;
    elsif new.verified_category is distinct from old.verified_category
       or new.account_status is distinct from old.account_status then
      raise exception using message = 'ไม่อนุญาตให้แก้ไขฟิลด์นี้', detail = 'PROTECTED_COLUMN', errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists profiles_protect on public.profiles;
create trigger profiles_protect before insert or update on public.profiles
  for each row execute function public.trg_profiles_protect();

-- column grants: clients can never write or read the protected columns directly
revoke insert (account_status, verified_category) on public.profiles from authenticated, anon;
revoke update (account_status, verified_category) on public.profiles from authenticated, anon;
revoke select (account_status) on public.profiles from authenticated, anon;

-- ===== 3. Private verification record (no client access at all) =====
create table if not exists public.creator_verifications (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  category text not null check (category in ('streamer', 'pro_player', 'public_figure', 'community_creator')),
  public_links jsonb not null default '[]'::jsonb,
  reason text not null,
  evidence_ref text,
  approved_by uuid,
  verified_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid,
  revoke_reason text
);
alter table public.creator_verifications enable row level security;
drop policy if exists "no client access" on public.creator_verifications;
create policy "no client access" on public.creator_verifications for all using (false) with check (false);
revoke all on public.creator_verifications from anon, authenticated;

-- ===== 3b. Audit action names =====
alter table public.admin_audit_log drop constraint if exists admin_audit_log_action_check;
alter table public.admin_audit_log add constraint admin_audit_log_action_check check (action = any (array[
  'grant_admin','revoke_admin','remove_avatar','clear_bio','clear_game_name','clear_contacts','hide_comments','unhide_comments',
  'set_role','grant_verification','update_verification','revoke_verification','suspend_account','reinstate_account']));

-- ===== 4. Mutations (trusted, audited) =====
create or replace function public.admin_set_role(p_id uuid, p_role text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_old text; n integer;
begin
  if not public.is_super_admin() then
    raise exception using message = 'ต้องเป็น Super Admin เท่านั้น', detail = 'FORBIDDEN', errcode = 'P0001';
  end if;
  if p_role is null or p_role not in ('member', 'moderator', 'admin', 'super_admin') then
    raise exception using message = 'บทบาทไม่ถูกต้อง', detail = 'BAD_ROLE', errcode = 'P0001';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_id) then
    raise exception using message = 'ไม่พบผู้ใช้', detail = 'NOT_FOUND', errcode = 'P0001';
  end if;
  if p_id = auth.uid() then
    raise exception using message = 'เปลี่ยนบทบาทของตัวเองไม่ได้', detail = 'SELF_CHANGE', errcode = 'P0001';
  end if;

  select a.role into v_old from public.admin_users a where a.user_id = p_id;
  v_old := coalesce(v_old, 'member');
  if v_old = p_role then return; end if;

  if v_old = 'super_admin' and (select count(*) from public.admin_users where role = 'super_admin') <= 1 then
    raise exception using message = 'ต้องมี Super Admin อย่างน้อย 1 คน', detail = 'LAST_SUPER_ADMIN', errcode = 'P0001';
  end if;

  if p_role = 'member' then
    delete from public.admin_users where user_id = p_id;
  else
    update public.admin_users set role = p_role where user_id = p_id;
    get diagnostics n = row_count;
    if n = 0 then
      insert into public.admin_users (user_id, role) values (p_id, p_role);
    end if;
  end if;

  insert into public.admin_audit_log (admin_id, action, target_user_id, meta)
  values (auth.uid(), 'set_role', p_id, jsonb_build_object('from', v_old, 'to', p_role));
end $$;

-- legacy entry point kept for the existing UI; now Super Admin only
create or replace function public.admin_set_admin(p_id uuid, p_value boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_super_admin() then
    raise exception using message = 'ต้องเป็น Super Admin เท่านั้น', detail = 'FORBIDDEN', errcode = 'P0001';
  end if;
  perform public.admin_set_role(p_id, case when p_value then 'admin' else 'member' end);
end $$;

create or replace function public.admin_set_verification(
  p_id uuid, p_category text, p_reason text,
  p_links jsonb default '[]'::jsonb, p_evidence text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_old text; v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if not public.is_admin() then
    raise exception using message = 'คุณไม่มีสิทธิ์ทำรายการนี้', detail = 'FORBIDDEN', errcode = 'P0001';
  end if;
  if v_reason is null then
    raise exception using message = 'ต้องระบุเหตุผล', detail = 'REASON_REQUIRED', errcode = 'P0001';
  end if;
  if length(v_reason) > 500 or length(coalesce(p_evidence, '')) > 300 then
    raise exception using message = 'ข้อความยาวเกินกำหนด', detail = 'TOO_LONG', errcode = 'P0001';
  end if;
  if p_category is not null and p_category not in ('streamer', 'pro_player', 'public_figure', 'community_creator') then
    raise exception using message = 'หมวดครีเอเตอร์ไม่ถูกต้อง', detail = 'BAD_CATEGORY', errcode = 'P0001';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_id) then
    raise exception using message = 'ไม่พบผู้ใช้', detail = 'NOT_FOUND', errcode = 'P0001';
  end if;

  select p.verified_category into v_old from public.profiles p where p.id = p_id;

  if p_category is null then
    if v_old is null then return; end if;
    update public.profiles set verified_category = null where id = p_id;
    update public.creator_verifications
       set revoked_at = now(), revoked_by = auth.uid(), revoke_reason = v_reason
     where user_id = p_id;
    insert into public.admin_audit_log (admin_id, action, target_user_id, meta)
    values (auth.uid(), 'revoke_verification', p_id, jsonb_build_object('from', v_old, 'reason', v_reason));
  else
    if p_links is null or jsonb_typeof(p_links) <> 'array' or jsonb_array_length(p_links) > 10 then
      raise exception using message = 'ลิงก์ไม่ถูกต้อง (สูงสุด 10 รายการ)', detail = 'BAD_LINKS', errcode = 'P0001';
    end if;
    update public.profiles set verified_category = p_category where id = p_id;
    insert into public.creator_verifications
      (user_id, category, public_links, reason, evidence_ref, approved_by, verified_at)
    values (p_id, p_category, p_links, v_reason, nullif(btrim(coalesce(p_evidence, '')), ''), auth.uid(), now())
    on conflict (user_id) do update
      set category = excluded.category, public_links = excluded.public_links, reason = excluded.reason,
          evidence_ref = excluded.evidence_ref, approved_by = excluded.approved_by, verified_at = now(),
          revoked_at = null, revoked_by = null, revoke_reason = null;
    insert into public.admin_audit_log (admin_id, action, target_user_id, meta)
    values (auth.uid(),
            case when v_old is null then 'grant_verification' else 'update_verification' end,
            p_id, jsonb_build_object('from', v_old, 'to', p_category, 'reason', v_reason));
  end if;
end $$;

create or replace function public.admin_set_account_status(p_id uuid, p_status text, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_old text; v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if not public.is_admin() then
    raise exception using message = 'คุณไม่มีสิทธิ์ทำรายการนี้', detail = 'FORBIDDEN', errcode = 'P0001';
  end if;
  if p_status is null or p_status not in ('active', 'suspended') then
    raise exception using message = 'สถานะไม่ถูกต้อง', detail = 'BAD_STATUS', errcode = 'P0001';
  end if;
  if v_reason is null or length(v_reason) > 500 then
    raise exception using message = 'ต้องระบุเหตุผล (ไม่เกิน 500 ตัวอักษร)', detail = 'REASON_REQUIRED', errcode = 'P0001';
  end if;
  select p.account_status into v_old from public.profiles p where p.id = p_id;
  if v_old is null then
    raise exception using message = 'ไม่พบผู้ใช้', detail = 'NOT_FOUND', errcode = 'P0001';
  end if;
  if p_id = auth.uid() then
    raise exception using message = 'เปลี่ยนสถานะบัญชีตัวเองไม่ได้', detail = 'SELF_CHANGE', errcode = 'P0001';
  end if;
  if exists (select 1 from public.admin_users a where a.user_id = p_id and a.role in ('admin', 'super_admin'))
     and not public.is_super_admin() then
    raise exception using message = 'ต้องเป็น Super Admin เพื่อระงับบัญชีผู้ดูแล', detail = 'FORBIDDEN', errcode = 'P0001';
  end if;
  if v_old = p_status then return; end if;

  update public.profiles set account_status = p_status where id = p_id;
  insert into public.admin_audit_log (admin_id, action, target_user_id, meta)
  values (auth.uid(),
          case when p_status = 'suspended' then 'suspend_account' else 'reinstate_account' end,
          p_id, jsonb_build_object('from', v_old, 'to', p_status, 'reason', v_reason));
end $$;

-- ===== 5. Reads =====
create or replace function public.admin_user_stats()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception using message = 'คุณไม่มีสิทธิ์ทำรายการนี้', detail = 'FORBIDDEN', errcode = 'P0001';
  end if;
  return jsonb_build_object(
    'total', (select count(*) from public.profiles),
    'verified', (select count(*) from public.profiles where verified_category is not null),
    'moderators', (select count(*) from public.admin_users where role = 'moderator'),
    'admins', (select count(*) from public.admin_users where role in ('admin', 'super_admin')),
    'suspended', (select count(*) from public.profiles where account_status = 'suspended')
  );
end $$;

drop function if exists public.admin_list_users(text, text, integer, integer);
create or replace function public.admin_list_users(
  p_q text default null, p_filter text default 'all', p_limit integer default 20, p_offset integer default 0,
  p_role text default null, p_verified text default null, p_status text default null)
returns table(id uuid, display_name text, handle text, avatar_url text, email text, created_at timestamptz,
  last_sign_in_at timestamptz, is_admin boolean, last_active_at timestamptz, draft_count bigint,
  tier_list_count bigint, comment_count bigint, report_count bigint, total_count bigint,
  role text, verified_category text, account_status text)
language plpgsql stable security definer set search_path = '' as $$
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
           coalesce(ar.role, 'member') as rl, p.verified_category as vc, p.account_status as st,
           (select count(*) from public.comment_reports r
              join public.comments c on c.id = r.comment_id where c.user_id = p.id) as rep
    from public.profiles p
    left join auth.users u on u.id = p.id
    left join public.admin_users ar on ar.user_id = p.id
    where v_like is null
       or p.display_name ilike v_like or p.handle ilike v_like or u.email ilike v_like
  ), filtered as (
    select b.*, count(*) over () as tot
    from base b
    where case coalesce(p_filter, 'all')
            when 'admin' then b.rl in ('admin', 'super_admin')
            when 'new7' then b.ca >= now() - interval '7 days'
            when 'reported' then b.rep > 0
            else true
          end
      and (p_role is null or b.rl = p_role)
      and (p_verified is null or (p_verified = 'yes' and b.vc is not null) or (p_verified = 'no' and b.vc is null))
      and (p_status is null or b.st = p_status)
  )
  select f.uid, f.dn, f.hd, f.av, f.em, f.ca, f.ls, (f.rl in ('admin', 'super_admin')),
         (select max(e.created_at) from public.user_activity_events e where e.user_id = f.uid),
         (select count(*) from public.saved_drafts d where d.user_id = f.uid),
         (select count(*) from public.user_tier_lists t where t.user_id = f.uid),
         (select count(*) from public.comments c where c.user_id = f.uid),
         f.rep, f.tot, f.rl, f.vc, f.st
  from filtered f
  order by f.ca desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

create or replace function public.admin_user_detail(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
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
    'auth_provider', u.raw_app_meta_data ->> 'provider',
    'is_admin', exists (select 1 from public.admin_users a where a.user_id = p.id and a.role in ('admin', 'super_admin')),
    'role', coalesce((select a.role from public.admin_users a where a.user_id = p.id), 'member'),
    'account_status', p.account_status,
    'verified_category', p.verified_category,
    'verification', (select jsonb_build_object(
        'category', v.category, 'public_links', v.public_links, 'reason', v.reason,
        'evidence_ref', v.evidence_ref, 'verified_at', v.verified_at, 'approved_by', v.approved_by,
        'approved_by_name', (select ap.display_name from public.profiles ap where ap.id = v.approved_by),
        'revoked_at', v.revoked_at, 'revoke_reason', v.revoke_reason)
      from public.creator_verifications v where v.user_id = p.id),
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

drop function if exists public.get_public_profile(uuid);
create or replace function public.get_public_profile(p_id uuid)
returns table(id uuid, display_name text, avatar_url text, bio text, preferred_roles text[],
  preferred_heroes uuid[], game_name text, contact_links jsonb, created_at timestamptz,
  verified_category text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.display_name, p.avatar_url, p.bio, p.preferred_roles, p.preferred_heroes,
         case when auth.uid() is not null then p.game_name end,
         case when auth.uid() is not null then p.contact_links else '[]'::jsonb end,
         p.created_at, p.verified_category
  from public.profiles p
  where p.id = p_id;
$$;

-- ===== 6. Least-privilege grants =====
revoke all on function public.is_super_admin() from public, anon;
revoke all on function public.is_moderator() from public, anon;
revoke all on function public.admin_set_role(uuid, text) from public, anon;
revoke all on function public.admin_set_admin(uuid, boolean) from public, anon;
revoke all on function public.admin_set_verification(uuid, text, text, jsonb, text) from public, anon;
revoke all on function public.admin_set_account_status(uuid, text, text) from public, anon;
revoke all on function public.admin_user_stats() from public, anon;
revoke all on function public.admin_list_users(text, text, integer, integer, text, text, text) from public, anon;
revoke all on function public.admin_user_detail(uuid) from public, anon;
grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.is_moderator() to authenticated;
grant execute on function public.admin_set_role(uuid, text) to authenticated;
grant execute on function public.admin_set_admin(uuid, boolean) to authenticated;
grant execute on function public.admin_set_verification(uuid, text, text, jsonb, text) to authenticated;
grant execute on function public.admin_set_account_status(uuid, text, text) to authenticated;
grant execute on function public.admin_user_stats() to authenticated;
grant execute on function public.admin_list_users(text, text, integer, integer, text, text, text) to authenticated;
grant execute on function public.admin_user_detail(uuid) to authenticated;
revoke all on function public.get_public_profile(uuid) from public;
grant execute on function public.get_public_profile(uuid) to anon, authenticated;
