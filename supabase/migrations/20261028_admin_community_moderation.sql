-- Admin moderation of Community Draft / Community Tier List: hide, unhide, permanent delete (all audited).
--   * Both snapshot tables already have `hidden` + an admin DELETE policy, but no way for an admin to set `hidden`
--     (no UPDATE grant/policy) and no UI. Rather than opening UPDATE on the tables, admins go through SECURITY DEFINER RPCs
--     that check is_admin() on the server and write admin_audit_log (same pattern as admin_set_comment_flags).
--   * Item Build (user_builds) and Combo (user_combos) already support admin hide/delete through RLS + guard trigger; untouched.
--   * Permanent delete removes the community snapshot (and its reactions via ON DELETE CASCADE) and sets the owner's source
--     row (saved_drafts / user_tier_lists) back to 'private'. Otherwise the owner's "Update Community" would silently
--     re-create the snapshot. The owner keeps their private original; nothing outside the snapshot is deleted.
-- Additive only: 3 new functions + 6 new allowed admin_audit_log actions. No table, policy or row is changed.
-- Dry-run verified on production inside rolled-back transactions (admin / non-admin / counts unchanged). NOT yet applied.

alter table public.admin_audit_log drop constraint if exists admin_audit_log_action_check;
alter table public.admin_audit_log add constraint admin_audit_log_action_check check (action = any (array[
  'grant_admin','revoke_admin','remove_avatar','clear_bio','clear_game_name','clear_contacts','hide_comments','unhide_comments',
  'set_role','grant_verification','update_verification','revoke_verification','suspend_account','reinstate_account',
  'pin_comment','unpin_comment','hide_comment','unhide_comment',
  'hide_community_draft','unhide_community_draft','delete_community_draft',
  'hide_tier_list','unhide_tier_list','delete_tier_list']));

-- Admin listing (includes hidden rows and the flag itself; author names come from profiles, which admins cannot read directly).
-- p_kind: 'draft' | 'tier_list'. detail = draft format / tier list patch; hero_count is tier lists only.
create or replace function public.admin_list_community_content(p_kind text, p_q text default null, p_limit integer default 30, p_offset integer default 0)
returns table (id uuid, owner_id uuid, author_name text, handle text, title text, description text, detail text, hero_count integer, version integer, hidden boolean, like_count integer, dislike_count integer, published_at timestamptz)
language plpgsql stable security definer set search_path to '' as $fn$
declare
  v_q text := nullif(btrim(coalesce(p_q, '')), '');
  v_like text;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception using message = 'ไม่มีสิทธิ์ทำรายการนี้', detail = 'FORBIDDEN', errcode = 'P0001';
  end if;
  if v_q is not null then
    v_like := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;
  if p_kind = 'draft' then
    return query
      select c.id, c.owner_id, p.display_name, p.handle, c.title, c.description, c.format, null::integer, c.version, c.hidden, c.like_count, c.dislike_count, c.published_at
      from public.community_drafts c
      left join public.profiles p on p.id = c.owner_id
      where v_like is null or c.title ilike v_like or coalesce(p.handle, '') ilike v_like or coalesce(p.display_name, '') ilike v_like
      order by c.published_at desc
      limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0);
  elsif p_kind = 'tier_list' then
    return query
      select c.id, c.owner_id, p.display_name, p.handle, c.title, c.description, nullif(c.patch, ''), public.tier_hero_count(c.data), c.version, c.hidden, c.like_count, c.dislike_count, c.published_at
      from public.community_tier_lists c
      left join public.profiles p on p.id = c.owner_id
      where v_like is null or c.title ilike v_like or coalesce(c.patch, '') ilike v_like or coalesce(p.handle, '') ilike v_like or coalesce(p.display_name, '') ilike v_like
      order by c.published_at desc
      limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0);
  else
    raise exception using message = 'ชนิดเนื้อหาไม่ถูกต้อง', detail = 'INVALID_KIND', errcode = 'P0001';
  end if;
end $fn$;
revoke all on function public.admin_list_community_content(text, text, integer, integer) from public, anon;
grant execute on function public.admin_list_community_content(text, text, integer, integer) to authenticated;

-- Hide / unhide. A hidden snapshot stays hidden when the owner pushes a new version (sync keeps the flag).
create or replace function public.admin_set_community_hidden(p_kind text, p_id uuid, p_hidden boolean)
returns void language plpgsql security definer set search_path to '' as $fn$
declare r record;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception using message = 'ไม่มีสิทธิ์ทำรายการนี้', detail = 'FORBIDDEN', errcode = 'P0001';
  end if;
  if p_kind = 'draft' then
    select c.owner_id, c.title, c.hidden into r from public.community_drafts c where c.id = p_id;
    if not found then
      raise exception using message = 'ไม่พบ Draft นี้ (อาจถูกลบแล้ว)', detail = 'NOT_FOUND', errcode = 'P0001';
    end if;
    update public.community_drafts set hidden = p_hidden where id = p_id;
  elsif p_kind = 'tier_list' then
    select c.owner_id, c.title, c.hidden into r from public.community_tier_lists c where c.id = p_id;
    if not found then
      raise exception using message = 'ไม่พบ Tier List นี้ (อาจถูกลบแล้ว)', detail = 'NOT_FOUND', errcode = 'P0001';
    end if;
    update public.community_tier_lists set hidden = p_hidden where id = p_id;
  else
    raise exception using message = 'ชนิดเนื้อหาไม่ถูกต้อง', detail = 'INVALID_KIND', errcode = 'P0001';
  end if;
  if r.hidden is distinct from p_hidden then
    insert into public.admin_audit_log (admin_id, action, target_user_id, meta)
    values (
      auth.uid(),
      (case when p_hidden then 'hide_' else 'unhide_' end) || (case when p_kind = 'draft' then 'community_draft' else 'tier_list' end),
      r.owner_id,
      jsonb_build_object('content_id', p_id, 'title', left(r.title, 80))
    );
  end if;
end $fn$;
revoke all on function public.admin_set_community_hidden(text, uuid, boolean) from public, anon;
grant execute on function public.admin_set_community_hidden(text, uuid, boolean) to authenticated;

-- Permanent delete (irreversible). Resetting the source to 'private' fires the existing trigger that deletes the snapshot;
-- the explicit delete below covers the case where that update is rejected by a legacy row's validation trigger,
-- so moderation never fails on the owner's data.
create or replace function public.admin_delete_community_content(p_kind text, p_id uuid)
returns void language plpgsql security definer set search_path to '' as $fn$
declare r record;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception using message = 'ไม่มีสิทธิ์ทำรายการนี้', detail = 'FORBIDDEN', errcode = 'P0001';
  end if;
  if p_kind = 'draft' then
    select c.source_draft_id as source_id, c.owner_id, c.title into r from public.community_drafts c where c.id = p_id;
    if not found then
      raise exception using message = 'ไม่พบ Draft นี้ (อาจถูกลบแล้ว)', detail = 'NOT_FOUND', errcode = 'P0001';
    end if;
    begin
      update public.saved_drafts set visibility = 'private' where id = r.source_id and visibility = 'public';
    exception when others then
      null;
    end;
    delete from public.community_drafts where id = p_id;
  elsif p_kind = 'tier_list' then
    select c.source_id, c.owner_id, c.title into r from public.community_tier_lists c where c.id = p_id;
    if not found then
      raise exception using message = 'ไม่พบ Tier List นี้ (อาจถูกลบแล้ว)', detail = 'NOT_FOUND', errcode = 'P0001';
    end if;
    begin
      update public.user_tier_lists set visibility = 'private' where id = r.source_id and visibility = 'public';
    exception when others then
      null;
    end;
    delete from public.community_tier_lists where id = p_id;
  else
    raise exception using message = 'ชนิดเนื้อหาไม่ถูกต้อง', detail = 'INVALID_KIND', errcode = 'P0001';
  end if;
  insert into public.admin_audit_log (admin_id, action, target_user_id, meta)
  values (
    auth.uid(),
    'delete_' || (case when p_kind = 'draft' then 'community_draft' else 'tier_list' end),
    r.owner_id,
    jsonb_build_object('content_id', p_id, 'title', left(r.title, 80))
  );
end $fn$;
revoke all on function public.admin_delete_community_content(text, uuid) from public, anon;
grant execute on function public.admin_delete_community_content(text, uuid) to authenticated;
