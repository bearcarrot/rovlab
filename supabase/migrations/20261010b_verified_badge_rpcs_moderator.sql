-- Verified badge in public RPCs, moderator scope, suspension enforcement for comments.
-- ALREADY APPLIED to production (project mttcdaiwuasnkqlxbeqs) on 2026-10-10 as:
--   verified_badge_in_public_rpcs_and_moderator, restore_profiles_account_status_select
-- Kept here so repo history matches. Re-runnable.

-- Public RPCs also return verified_category (appended as the LAST column; consumers read by name).
drop function if exists public.list_comments(text, uuid, text, integer, integer, uuid);
create function public.list_comments(p_hero_slug text, p_parent_id uuid default null, p_sort text default 'top',
  p_limit integer default 20, p_offset integer default 0, p_only_id uuid default null)
returns table(id uuid, parent_id uuid, user_id uuid, author_name text, handle text, avatar_url text, is_admin boolean,
  reply_to_name text, reply_to_handle text, body text, created_at timestamptz, edited_at timestamptz, pinned boolean,
  hidden boolean, like_count integer, dislike_count integer, reply_count integer, emoji_counts jsonb,
  my_value smallint, my_emojis text[], verified_category text)
language sql stable security definer set search_path to '' as $function$
  select c.id, c.parent_id, c.user_id, p.display_name, p.handle, p.avatar_url,
         exists (select 1 from public.admin_users a where a.user_id = c.user_id and a.role in ('admin', 'super_admin')),
         rp.display_name, rp.handle, c.body, c.created_at, c.edited_at, c.pinned, c.hidden,
         c.like_count, c.dislike_count, c.reply_count, c.emoji_counts,
         (select r.value from public.comment_reactions r where r.comment_id = c.id and r.user_id = auth.uid()),
         coalesce((select array_agg(e.emoji) from public.comment_emojis e where e.comment_id = c.id and e.user_id = auth.uid()), '{}'::text[]),
         p.verified_category
  from public.comments c
  join public.profiles p on p.id = c.user_id
  left join public.profiles rp on rp.id = c.reply_to_user_id
  where c.hero_slug = p_hero_slug
    and (
      (p_only_id is not null and c.id = p_only_id)
      or (p_only_id is null and ((p_parent_id is null and c.parent_id is null) or c.parent_id = p_parent_id))
    )
    and (c.hidden = false or c.user_id = auth.uid() or public.is_moderator())
    and not exists (select 1 from public.user_blocks b where b.blocker_id = auth.uid() and b.blocked_id = c.user_id)
  order by
    (c.pinned and p_parent_id is null) desc,
    case when p_parent_id is null and p_sort = 'top' then (c.like_count - c.dislike_count) end desc nulls last,
    case when p_parent_id is not null then c.created_at end asc nulls last,
    c.created_at desc
  limit least(greatest(p_limit, 1), 101) offset greatest(p_offset, 0)
$function$;
grant execute on function public.list_comments(text, uuid, text, integer, integer, uuid) to public, anon, authenticated;

drop function if exists public.following_feed(integer, integer);
create function public.following_feed(p_limit integer default 20, p_offset integer default 0)
returns table(id uuid, hero_slug text, body text, created_at timestamptz, parent_id uuid, user_id uuid,
  author_name text, handle text, avatar_url text, verified_category text)
language sql stable security definer set search_path to '' as $function$
  select c.id, c.hero_slug, c.body, c.created_at, c.parent_id, c.user_id, p.display_name, p.handle, p.avatar_url,
         p.verified_category
  from public.comments c
  join public.follows f on f.followee_id = c.user_id and f.follower_id = auth.uid()
  join public.profiles p on p.id = c.user_id
  where c.hidden = false and c.hero_slug is not null
  order by c.created_at desc
  limit least(greatest(p_limit, 1), 50) offset greatest(p_offset, 0)
$function$;
revoke all on function public.following_feed(integer, integer) from public, anon;
grant execute on function public.following_feed(integer, integer) to authenticated;

drop function if exists public.search_handles(text);
create function public.search_handles(p_q text)
returns table(id uuid, handle text, display_name text, avatar_url text, verified_category text)
language sql stable security definer set search_path to '' as $function$
  select p.id, p.handle, p.display_name, p.avatar_url, p.verified_category
  from public.profiles p
  where auth.uid() is not null
    and length(regexp_replace(p_q, '[^A-Za-z0-9_]', '', 'g')) > 0
    and lower(p.handle) like lower(replace(regexp_replace(p_q, '[^A-Za-z0-9_]', '', 'g'), '_', '\_')) || '%'
  order by p.handle
  limit 6
$function$;
revoke all on function public.search_handles(text) from public, anon;
grant execute on function public.search_handles(text) to authenticated;

drop function if exists public.list_hero_comments(text, integer);
create function public.list_hero_comments(p_hero_slug text, p_limit integer default 50)
returns table(id uuid, user_id uuid, body text, created_at timestamptz, author_name text, avatar_url text,
  verified_category text)
language sql stable security definer set search_path to 'public' as $function$
  select c.id, c.user_id, c.body, c.created_at, p.display_name, p.avatar_url, p.verified_category
  from public.comments c
  left join public.profiles p on p.id = c.user_id
  where c.hero_slug = p_hero_slug and c.parent_id is null and c.hidden = false
  order by c.created_at desc
  limit least(greatest(p_limit, 1), 100);
$function$;
revoke all on function public.list_hero_comments(text, integer) from public;
grant execute on function public.list_hero_comments(text, integer) to anon, authenticated;

drop function if exists public.list_community_drafts(text, text, integer, integer, uuid);
create function public.list_community_drafts(p_sort text default 'new', p_q text default null,
  p_limit integer default 20, p_offset integer default 0, p_only_id uuid default null)
returns table(id uuid, owner_id uuid, author_name text, handle text, avatar_url text, title text, description text,
  format text, global_ban_pick boolean, game7_rule text, version integer, like_count integer, dislike_count integer,
  my_value smallint, published_at timestamptz, updated_at timestamptz, series jsonb, verified_category text)
language sql stable security definer set search_path to '' as $function$
  select c.id, c.owner_id, p.display_name, p.handle, p.avatar_url,
         c.title, c.description, c.format, c.global_ban_pick, c.game7_rule,
         c.version, c.like_count, c.dislike_count,
         (select r.value from public.community_draft_reactions r where r.draft_id = c.id and r.user_id = auth.uid()),
         c.published_at, c.updated_at,
         case when p_only_id is not null then c.series end,
         p.verified_category
  from public.community_drafts c
  join public.profiles p on p.id = c.owner_id
  where (p_only_id is null or c.id = p_only_id)
    and (c.hidden = false or c.owner_id = auth.uid() or public.is_admin())
    and not exists (select 1 from public.user_blocks b where b.blocker_id = auth.uid() and b.blocked_id = c.owner_id)
    and (
      p_q is null or btrim(p_q) = ''
      or c.title ilike '%' || replace(replace(replace(btrim(p_q), '\', '\\'), '%', '\%'), '_', '\_') || '%'
      or coalesce(c.description, '') ilike '%' || replace(replace(replace(btrim(p_q), '\', '\\'), '%', '\%'), '_', '\_') || '%'
      or coalesce(p.handle, '') ilike '%' || replace(replace(replace(btrim(p_q), '\', '\\'), '%', '\%'), '_', '\_') || '%'
    )
  order by
    case when p_sort = 'liked'   then c.like_count end desc nulls last,
    case when p_sort = 'popular' then c.like_count - c.dislike_count end desc nulls last,
    c.published_at desc
  limit least(greatest(p_limit, 1), 51) offset greatest(p_offset, 0)
$function$;
revoke all on function public.list_community_drafts(text, text, integer, integer, uuid) from public;
grant execute on function public.list_community_drafts(text, text, integer, integer, uuid) to anon, authenticated;

drop function if exists public.list_community_tier_lists(text, text, integer, integer, uuid);
create function public.list_community_tier_lists(p_sort text default 'new', p_q text default null,
  p_limit integer default 20, p_offset integer default 0, p_only_id uuid default null)
returns table(id uuid, owner_id uuid, author_name text, handle text, avatar_url text, title text, description text,
  patch text, version integer, hero_count integer, preview jsonb, like_count integer, dislike_count integer,
  my_value smallint, published_at timestamptz, updated_at timestamptz, data jsonb, verified_category text)
language sql stable security definer set search_path to '' as $function$
  select c.id, c.owner_id, p.display_name, p.handle, p.avatar_url,
         c.title, c.description, c.patch, c.version, public.tier_hero_count(c.data), public.tier_preview(c.data, 6),
         c.like_count, c.dislike_count,
         (select r.value from public.community_tier_list_reactions r where r.list_id = c.id and r.user_id = auth.uid()),
         c.published_at, c.updated_at,
         case when p_only_id is not null then c.data end,
         p.verified_category
  from public.community_tier_lists c
  join public.profiles p on p.id = c.owner_id
  where (p_only_id is null or c.id = p_only_id)
    and (c.hidden = false or c.owner_id = auth.uid() or public.is_admin())
    and not exists (select 1 from public.user_blocks b where b.blocker_id = auth.uid() and b.blocked_id = c.owner_id)
    and (
      p_q is null or btrim(p_q) = ''
      or c.title ilike '%' || replace(replace(replace(btrim(p_q), '\', '\\'), '%', '\%'), '_', '\_') || '%'
      or coalesce(c.description, '') ilike '%' || replace(replace(replace(btrim(p_q), '\', '\\'), '%', '\%'), '_', '\_') || '%'
      or c.patch ilike '%' || replace(replace(replace(btrim(p_q), '\', '\\'), '%', '\%'), '_', '\_') || '%'
      or coalesce(p.handle, '') ilike '%' || replace(replace(replace(btrim(p_q), '\', '\\'), '%', '\%'), '_', '\_') || '%'
    )
  order by
    case when p_sort = 'liked'   then c.like_count end desc nulls last,
    case when p_sort = 'popular' then c.like_count - c.dislike_count end desc nulls last,
    c.published_at desc
  limit least(greatest(p_limit, 1), 51) offset greatest(p_offset, 0)
$function$;
revoke all on function public.list_community_tier_lists(text, text, integer, integer, uuid) from public;
grant execute on function public.list_community_tier_lists(text, text, integer, integer, uuid) to anon, authenticated;

-- Moderators may hide/pin comments (nothing else): scope is exactly this function.
create or replace function public.admin_set_comment_flags(p_id uuid, p_pinned boolean default null, p_hidden boolean default null)
returns void language plpgsql security definer set search_path to '' as $function$
begin
  if not public.is_moderator() then
    raise exception using message = 'คุณไม่มีสิทธิ์ทำรายการนี้', detail = 'FORBIDDEN', errcode = 'P0001';
  end if;
  update public.comments set pinned = coalesce(p_pinned, pinned), hidden = coalesce(p_hidden, hidden) where id = p_id;
end $function$;

-- Suspended accounts cannot post or edit comments.
create or replace function public.trg_comments_before_insert()
returns trigger language plpgsql security definer set search_path to '' as $function$
declare par record;
begin
  if exists (select 1 from public.profiles p where p.id = new.user_id and p.account_status = 'suspended') then
    raise exception using message = 'บัญชีของคุณถูกระงับ ไม่สามารถแสดงความคิดเห็นได้', detail = 'ACCOUNT_SUSPENDED', errcode = 'P0001';
  end if;
  new.body := btrim(new.body);
  if new.parent_id is not null then
    select c.id, c.parent_id, c.user_id, c.hero_slug, c.guide_id into par from public.comments c where c.id = new.parent_id;
    if not found then
      raise exception using message = 'ไม่พบความคิดเห็นที่ต้องการตอบกลับ (อาจถูกลบแล้ว)', detail = 'PARENT_NOT_FOUND', errcode = 'P0001';
    end if;
    new.reply_to_user_id := par.user_id;
    if par.parent_id is not null then new.parent_id := par.parent_id; end if; -- one level of nesting
    new.hero_slug := par.hero_slug;
    new.guide_id := par.guide_id;
  end if;
  if cardinality(public.profanity_matches(new.body)) > 0 then
    raise exception using message = 'ข้อความมีคำที่ไม่เหมาะสม กรุณาแก้ไขก่อนส่ง', detail = 'PROFANITY_BLOCKED', errcode = 'P0001';
  end if;
  return new;
end $function$;

create or replace function public.trg_comments_before_update()
returns trigger language plpgsql security definer set search_path to '' as $function$
begin
  if new.body is distinct from old.body then
    if exists (select 1 from public.profiles p where p.id = new.user_id and p.account_status = 'suspended') then
      raise exception using message = 'บัญชีของคุณถูกระงับ ไม่สามารถแก้ไขความคิดเห็นได้', detail = 'ACCOUNT_SUSPENDED', errcode = 'P0001';
    end if;
    new.body := btrim(new.body);
    if cardinality(public.profanity_matches(new.body)) > 0 then
      raise exception using message = 'ข้อความมีคำที่ไม่เหมาะสม กรุณาแก้ไขก่อนส่ง', detail = 'PROFANITY_BLOCKED', errcode = 'P0001';
    end if;
    new.edited_at := now();
  end if;
  return new;
end $function$;

-- `select *` on profiles (getProfile) needs SELECT on every column; RLS already limits reads to the user's own row.
-- (supersedes the `revoke select (account_status)` in the earlier migration file)
grant select (account_status) on public.profiles to authenticated, anon;
