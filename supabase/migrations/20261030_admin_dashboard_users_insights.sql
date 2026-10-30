-- Admin Dashboard + Users insights. READ-ONLY additions: no new table, no new event writes, no policy changes.
-- NOT APPLIED. Review, dry-run inside a rolled-back transaction, then apply.
--
-- Low-load design (Supabase Log Ingestion / Egress are being reduced):
--   * admin_dashboard_extras(): ONE rpc, ONE scan of user_activity_events (last 30 days, index on created_at),
--     everything else is count(*) over small tables or the small comment_reports table. Output is a few KB of JSON.
--     Called once when an admin opens the Dashboard tab (no polling).
--   * Combo / Item Build usage is derived from user_combos / user_builds (created_at, owner_id) instead of new
--     tracking events, so there are zero extra inserts from clients.
--   * admin_list_users: new sort option + combo/build counts. The per-profile report subquery is replaced by one
--     pre-aggregated join, so the function does less work than before. Sorting by "last active" is intentionally NOT
--     offered (it would need a scan of user_activity_events for every profile); "last sign in" is used instead.
--   * admin_user_detail: adds Combo / Build / match counts, hidden-content counts and the 5 most recent items per kind
--     (title cut to 80 chars) for ONE user only.
-- Signature change: admin_list_users gets an 8th argument p_sort with a default, so the existing client (7 named
-- arguments) keeps working both before and after the new client is deployed.

-- ===== 1. Dashboard extras =====
create or replace function public.admin_dashboard_extras()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  t0  timestamptz := date_trunc('day', now() at time zone 'Asia/Bangkok') at time zone 'Asia/Bangkok';
  w7  timestamptz;
  w14 timestamptz;
  w30 timestamptz;
  d0  timestamp := (date_trunc('day', now() at time zone 'Asia/Bangkok'));
  r   jsonb;
begin
  if not public.is_admin() then
    raise exception using message = 'คุณไม่มีสิทธิ์ทำรายการนี้', detail = 'FORBIDDEN', errcode = 'P0001';
  end if;
  w7  := t0 - interval '6 days';
  w14 := t0 - interval '13 days';
  w30 := t0 - interval '29 days';

  with ev as materialized (
    select e.user_id, e.created_at,
           case
             when e.event_type = 'ai_coach_used' then 'ai_coach'
             when e.event_type like 'draft\_%' then 'draft'
             when e.event_type like 'tier\_list\_%' then 'tier_list'
             when e.event_type = 'hero_viewed' then 'hero'
             when e.event_type = 'stats_viewed' then 'stats'
             when e.event_type = 'matchup_viewed' then 'matchup'
             when e.event_type = 'counter_pick_used' then 'counter_pick'
             when e.event_type like 'match\_%' then 'match_analysis'
             else e.event_type
           end as feature
    from public.user_activity_events e
    where e.created_at >= w30
  )
  select jsonb_build_object(
    -- last 14 Bangkok days, zero-filled
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object('day', to_char(s.d, 'YYYY-MM-DD'), 'users', coalesce(x.users, 0), 'activities', coalesce(x.acts, 0)) order by s.d)
      from generate_series(d0 - interval '13 days', d0, interval '1 day') as s(d)
      left join (
        select (ev.created_at at time zone 'Asia/Bangkok')::date as day, count(distinct ev.user_id) as users, count(*) as acts
        from ev
        where ev.created_at >= w14
        group by 1
      ) x on x.day = s.d::date
    ), '[]'::jsonb),
    'yesterday', (select jsonb_build_object('active_users', count(distinct ev.user_id), 'activities', count(*))
                  from ev where ev.created_at >= t0 - interval '1 day' and ev.created_at < t0),
    'prev7', (select jsonb_build_object('active_users', count(distinct ev.user_id), 'activities', count(*))
              from ev where ev.created_at >= w14 and ev.created_at < w7),
    -- distinct users per feature group (events are counted by the existing admin_activity_summary)
    'feature_users', coalesce((
      select jsonb_agg(jsonb_build_object('feature', f.feature, 'today', f.u0, 'd7', f.u7, 'd30', f.u30) order by f.u30 desc)
      from (
        select ev.feature,
               count(distinct ev.user_id) filter (where ev.created_at >= t0) as u0,
               count(distinct ev.user_id) filter (where ev.created_at >= w7) as u7,
               count(distinct ev.user_id) as u30
        from ev group by ev.feature
      ) f
    ), '[]'::jsonb),
    -- Combo / Item Build creation, derived from the tables themselves (no tracking events)
    'created', jsonb_build_object(
      'combo', (select jsonb_build_object(
                  'today', count(*) filter (where c.created_at >= t0), 'd7', count(*) filter (where c.created_at >= w7), 'd30', count(*),
                  'users_today', count(distinct c.owner_id) filter (where c.created_at >= t0),
                  'users_d7', count(distinct c.owner_id) filter (where c.created_at >= w7),
                  'users_d30', count(distinct c.owner_id))
                from public.user_combos c where c.owner_id is not null and c.created_at >= w30),
      'build', (select jsonb_build_object(
                  'today', count(*) filter (where b.created_at >= t0), 'd7', count(*) filter (where b.created_at >= w7), 'd30', count(*),
                  'users_today', count(distinct b.owner_id) filter (where b.created_at >= t0),
                  'users_d7', count(distinct b.owner_id) filter (where b.created_at >= w7),
                  'users_d30', count(distinct b.owner_id))
                from public.user_builds b where b.created_at >= w30)
    ),
    'totals', jsonb_build_object(
      'users', (select count(*) from public.profiles),
      'drafts', (select count(*) from public.saved_drafts),
      'public_drafts', (select count(*) from public.community_drafts d where not d.hidden),
      'tier_lists', (select count(*) from public.user_tier_lists),
      'public_tier_lists', (select count(*) from public.community_tier_lists t where not t.hidden),
      'combos', (select count(*) from public.user_combos c where c.owner_id is not null),
      'builds', (select count(*) from public.user_builds),
      'matches', (select count(*) from public.match_results)
    ),
    -- things an admin may need to look at. Draft / Tier List / Combo / Build have no reporting feature,
    -- so "disliked" (dislikes >= 5 and more than likes) is the only signal for community drafts and tier lists.
    'moderation', jsonb_build_object(
      'reported_visible', (select count(distinct rp.comment_id) from public.comment_reports rp join public.comments c on c.id = rp.comment_id where not c.hidden),
      'reported_hidden', (select count(distinct rp.comment_id) from public.comment_reports rp join public.comments c on c.id = rp.comment_id where c.hidden),
      'disliked_drafts', (select count(*) from public.community_drafts d where not d.hidden and d.dislike_count >= 5 and d.dislike_count > d.like_count),
      'disliked_tier_lists', (select count(*) from public.community_tier_lists t where not t.hidden and t.dislike_count >= 5 and t.dislike_count > t.like_count),
      'hidden_drafts', (select count(*) from public.community_drafts d where d.hidden),
      'hidden_tier_lists', (select count(*) from public.community_tier_lists t where t.hidden),
      'hidden_combos', (select count(*) from public.user_combos c where c.hidden),
      'hidden_builds', (select count(*) from public.user_builds b where b.hidden)
    )
  )
  into r;
  return r;
end;
$$;
revoke execute on function public.admin_dashboard_extras() from public, anon;
grant execute on function public.admin_dashboard_extras() to authenticated;

-- ===== 2. Users list: sort + combo/build counts =====
drop function if exists public.admin_list_users(text, text, integer, integer, text, text, text);
create or replace function public.admin_list_users(
  p_q text default null, p_filter text default 'all', p_limit integer default 20, p_offset integer default 0,
  p_role text default null, p_verified text default null, p_status text default null,
  p_sort text default 'newest')
returns table(id uuid, display_name text, handle text, avatar_url text, email text, created_at timestamptz,
  last_sign_in_at timestamptz, is_admin boolean, last_active_at timestamptz, draft_count bigint,
  tier_list_count bigint, comment_count bigint, report_count bigint, total_count bigint,
  role text, verified_category text, account_status text, combo_count bigint, build_count bigint)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_q text := nullif(btrim(coalesce(p_q, '')), '');
  v_like text;
  v_sort text := case when p_sort in ('oldest', 'sign_in', 'reported') then p_sort else 'newest' end;
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
           coalesce(rp.n, 0) as rep
    from public.profiles p
    left join auth.users u on u.id = p.id
    left join public.admin_users ar on ar.user_id = p.id
    left join (
      select c.user_id as uid, count(*) as n
      from public.comment_reports r join public.comments c on c.id = r.comment_id
      group by c.user_id
    ) rp on rp.uid = p.id
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
         f.rep, f.tot, f.rl, f.vc, f.st,
         (select count(*) from public.user_combos x where x.owner_id = f.uid),
         (select count(*) from public.user_builds x where x.owner_id = f.uid)
  from filtered f
  order by
    case when v_sort = 'oldest' then f.ca end asc nulls last,
    case when v_sort = 'sign_in' then f.ls end desc nulls last,
    case when v_sort = 'reported' then f.rep end desc nulls last,
    f.ca desc, f.uid
  limit least(greatest(coalesce(p_limit, 20), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;
revoke all on function public.admin_list_users(text, text, integer, integer, text, text, text, text) from public, anon;
grant execute on function public.admin_list_users(text, text, integer, integer, text, text, text, text) to authenticated;

-- ===== 3. User detail: Combo / Build / match counts, hidden content, recent content =====
-- Same body as 20261010_admin_roles_creator_verification.sql plus the new keys (counts.*, recent_content).
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
                             join public.comments cc on cc.id = rr.comment_id where cc.user_id = p.id),
      'combos', (select count(*) from public.user_combos x where x.owner_id = p.id),
      'public_combos', (select count(*) from public.user_combos x where x.owner_id = p.id and x.is_public and not x.hidden),
      'hidden_combos', (select count(*) from public.user_combos x where x.owner_id = p.id and x.hidden),
      'builds', (select count(*) from public.user_builds x where x.owner_id = p.id),
      'public_builds', (select count(*) from public.user_builds x where x.owner_id = p.id and x.is_public and not x.hidden),
      'hidden_builds', (select count(*) from public.user_builds x where x.owner_id = p.id and x.hidden),
      'hidden_drafts', (select count(*) from public.community_drafts x where x.owner_id = p.id and x.hidden),
      'hidden_tier_lists', (select count(*) from public.community_tier_lists x where x.owner_id = p.id and x.hidden),
      'matches', (select count(*) from public.match_results m where m.user_id = p.id)
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
    'recent_content', coalesce((
      select jsonb_agg(jsonb_build_object(
               'kind', z.kind, 'id', z.id, 'title', z.title, 'public', z.is_pub, 'hidden', z.hid, 'created_at', z.ts)
             order by z.ts desc nulls last)
      from (
        (select 'combo'::text as kind, c.id, left(c.name, 80) as title, c.is_public as is_pub, c.hidden as hid, c.created_at as ts
           from public.user_combos c where c.owner_id = p.id order by c.created_at desc limit 5)
        union all
        (select 'build'::text, b.id, left(b.name, 80), b.is_public, b.hidden, b.created_at
           from public.user_builds b where b.owner_id = p.id order by b.created_at desc limit 5)
        union all
        (select 'draft'::text, d.id, left(d.title, 80), true, d.hidden, d.published_at
           from public.community_drafts d where d.owner_id = p.id order by d.published_at desc limit 5)
        union all
        (select 'tier_list'::text, t.id, left(t.title, 80), true, t.hidden, t.published_at
           from public.community_tier_lists t where t.owner_id = p.id order by t.published_at desc limit 5)
      ) z
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
-- create or replace keeps the existing grants on admin_user_detail(uuid); restated so a fresh database matches.
revoke all on function public.admin_user_detail(uuid) from public, anon;
grant execute on function public.admin_user_detail(uuid) to authenticated;
