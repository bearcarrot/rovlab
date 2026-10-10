-- Suspension also blocks publishing; moderator pin/hide is audited; notification actor badge.
-- ALREADY APPLIED to production (project mttcdaiwuasnkqlxbeqs) on 2026-10-10 as:
--   suspension_publish_moderator_audit_notif_badge
-- Kept here so repo history matches. Re-runnable.

-- 1. Suspended accounts cannot publish drafts / tier lists (covers direct visibility updates and the publish RPCs).
create or replace function public.trg_block_suspended_publish()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_owner uuid;
begin
  if new.visibility = 'public' and (tg_op = 'INSERT' or old.visibility is distinct from 'public') then
    v_owner := new.user_id;
    if exists (select 1 from public.profiles p where p.id = v_owner and p.account_status = 'suspended') then
      raise exception using message = 'บัญชีของคุณถูกระงับ ไม่สามารถเผยแพร่เนื้อหาได้', detail = 'ACCOUNT_SUSPENDED', errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists aa_block_suspended_publish on public.saved_drafts;
create trigger aa_block_suspended_publish before insert or update on public.saved_drafts
  for each row execute function public.trg_block_suspended_publish();
drop trigger if exists aa_block_suspended_publish on public.user_tier_lists;
create trigger aa_block_suspended_publish before insert or update on public.user_tier_lists
  for each row execute function public.trg_block_suspended_publish();

create or replace function public.publish_draft(p_id uuid)
returns uuid language plpgsql security definer set search_path to '' as $function$
declare d record; cid uuid;
begin
  if auth.uid() is null then
    raise exception using message = 'กรุณาเข้าสู่ระบบ', detail = 'AUTH_REQUIRED', errcode = 'P0001';
  end if;
  if exists (select 1 from public.profiles p where p.id = auth.uid() and p.account_status = 'suspended') then
    raise exception using message = 'บัญชีของคุณถูกระงับ ไม่สามารถเผยแพร่เนื้อหาได้', detail = 'ACCOUNT_SUSPENDED', errcode = 'P0001';
  end if;
  select s.id, s.visibility into d from public.saved_drafts s where s.id = p_id and s.user_id = auth.uid();
  if not found then
    raise exception using message = 'ไม่พบ Draft', detail = 'NOT_FOUND', errcode = 'P0001';
  end if;
  if d.visibility = 'public' then
    perform public.sync_community_snapshot(p_id);
  else
    update public.saved_drafts set visibility = 'public' where id = p_id;
  end if;
  select c.id into cid from public.community_drafts c where c.source_draft_id = p_id;
  return cid;
end $function$;

create or replace function public.publish_tier_list(p_id uuid)
returns uuid language plpgsql security definer set search_path to '' as $function$
declare d record; cid uuid;
begin
  if auth.uid() is null then
    raise exception using message = 'กรุณาเข้าสู่ระบบ', detail = 'AUTH_REQUIRED', errcode = 'P0001';
  end if;
  if exists (select 1 from public.profiles p where p.id = auth.uid() and p.account_status = 'suspended') then
    raise exception using message = 'บัญชีของคุณถูกระงับ ไม่สามารถเผยแพร่เนื้อหาได้', detail = 'ACCOUNT_SUSPENDED', errcode = 'P0001';
  end if;
  select t.id, t.visibility into d from public.user_tier_lists t where t.id = p_id and t.user_id = auth.uid();
  if not found then
    raise exception using message = 'ไม่พบ Tier List', detail = 'NOT_FOUND', errcode = 'P0001';
  end if;
  if d.visibility = 'public' then
    perform public.sync_community_tier_list(p_id);
  else
    update public.user_tier_lists set visibility = 'public' where id = p_id;
  end if;
  select c.id into cid from public.community_tier_lists c where c.source_id = p_id;
  return cid;
end $function$;

-- 2. Audit moderator pin / hide actions.
alter table public.admin_audit_log drop constraint if exists admin_audit_log_action_check;
alter table public.admin_audit_log add constraint admin_audit_log_action_check check (action = any (array[
  'grant_admin','revoke_admin','remove_avatar','clear_bio','clear_game_name','clear_contacts','hide_comments','unhide_comments',
  'set_role','grant_verification','update_verification','revoke_verification','suspend_account','reinstate_account',
  'pin_comment','unpin_comment','hide_comment','unhide_comment']));

create or replace function public.admin_set_comment_flags(p_id uuid, p_pinned boolean default null, p_hidden boolean default null)
returns void language plpgsql security definer set search_path to '' as $function$
declare c record;
begin
  if not public.is_moderator() then
    raise exception using message = 'คุณไม่มีสิทธิ์ทำรายการนี้', detail = 'FORBIDDEN', errcode = 'P0001';
  end if;
  select cm.user_id, cm.pinned, cm.hidden into c from public.comments cm where cm.id = p_id;
  if not found then return; end if;
  update public.comments set pinned = coalesce(p_pinned, pinned), hidden = coalesce(p_hidden, hidden) where id = p_id;
  if p_pinned is not null and p_pinned is distinct from c.pinned then
    insert into public.admin_audit_log (admin_id, action, target_user_id, meta)
    values (auth.uid(), case when p_pinned then 'pin_comment' else 'unpin_comment' end, c.user_id, jsonb_build_object('comment_id', p_id));
  end if;
  if p_hidden is not null and p_hidden is distinct from c.hidden then
    insert into public.admin_audit_log (admin_id, action, target_user_id, meta)
    values (auth.uid(), case when p_hidden then 'hide_comment' else 'unhide_comment' end, c.user_id, jsonb_build_object('comment_id', p_id));
  end if;
end $function$;

-- 3. Notification actor badge (appended last column).
drop function if exists public.list_notifications(integer);
create function public.list_notifications(p_limit integer default 50)
returns table(id uuid, type text, actor_id uuid, actor_name text, actor_handle text, comment_id uuid, hero_slug text,
  created_at timestamptz, read_at timestamptz, actor_verified_category text)
language sql stable security definer set search_path to '' as $function$
  select n.id, n.type, n.actor_id, p.display_name, p.handle, n.comment_id, n.hero_slug, n.created_at, n.read_at,
         p.verified_category
  from public.notifications n
  join public.profiles p on p.id = n.actor_id
  where n.user_id = auth.uid()
  order by n.created_at desc
  limit least(greatest(p_limit, 1), 100)
$function$;
revoke all on function public.list_notifications(integer) from public, anon;
grant execute on function public.list_notifications(integer) to authenticated;
