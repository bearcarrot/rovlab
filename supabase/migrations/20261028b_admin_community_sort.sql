-- Sort option for the admin Community moderation list, so admins can surface the most disliked content.
--   p_sort: 'newest' (default, previous behaviour) | 'dislikes' (most disliked first; only rows with >= 1 dislike)
--           | 'ratio' (highest dislike share first; only rows with >= 3 votes so 1 dislike out of 1 vote does not top the list)
-- Sorting happens in SQL, not in the page, because the list is capped at 100 rows and old rows would otherwise never show up.
-- Replaces the 4-argument function from 20261028_admin_community_moderation.sql with a 5-argument one (p_sort has a default,
-- so calls from the already-deployed page that pass 4 named args keep working). Same is_admin() guard and grants; no data touched.
-- Dry-run verified on production inside a rolled-back transaction.

drop function if exists public.admin_list_community_content(text, text, integer, integer);

create or replace function public.admin_list_community_content(p_kind text, p_q text default null, p_limit integer default 30, p_offset integer default 0, p_sort text default 'newest')
returns table (id uuid, owner_id uuid, author_name text, handle text, title text, description text, detail text, hero_count integer, version integer, hidden boolean, like_count integer, dislike_count integer, published_at timestamptz)
language plpgsql stable security definer set search_path to '' as $fn$
declare
  v_q text := nullif(btrim(coalesce(p_q, '')), '');
  v_like text;
  v_sort text := coalesce(p_sort, 'newest');
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception using message = 'ไม่มีสิทธิ์ทำรายการนี้', detail = 'FORBIDDEN', errcode = 'P0001';
  end if;
  if v_sort not in ('newest', 'dislikes', 'ratio') then
    raise exception using message = 'รูปแบบการเรียงไม่ถูกต้อง', detail = 'INVALID_SORT', errcode = 'P0001';
  end if;
  if v_q is not null then
    v_like := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;
  if p_kind = 'draft' then
    return query
      select c.id, c.owner_id, p.display_name, p.handle, c.title, c.description, c.format, null::integer, c.version, c.hidden, c.like_count, c.dislike_count, c.published_at
      from public.community_drafts c
      left join public.profiles p on p.id = c.owner_id
      where (v_like is null or c.title ilike v_like or coalesce(p.handle, '') ilike v_like or coalesce(p.display_name, '') ilike v_like)
        and (v_sort = 'newest' or c.dislike_count > 0)
        and (v_sort <> 'ratio' or c.like_count + c.dislike_count >= 3)
      order by
        case when v_sort = 'ratio' then c.dislike_count::numeric / nullif(c.like_count + c.dislike_count, 0) end desc nulls last,
        case when v_sort <> 'newest' then c.dislike_count end desc nulls last,
        c.published_at desc
      limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0);
  elsif p_kind = 'tier_list' then
    return query
      select c.id, c.owner_id, p.display_name, p.handle, c.title, c.description, nullif(c.patch, ''), public.tier_hero_count(c.data), c.version, c.hidden, c.like_count, c.dislike_count, c.published_at
      from public.community_tier_lists c
      left join public.profiles p on p.id = c.owner_id
      where (v_like is null or c.title ilike v_like or coalesce(c.patch, '') ilike v_like or coalesce(p.handle, '') ilike v_like or coalesce(p.display_name, '') ilike v_like)
        and (v_sort = 'newest' or c.dislike_count > 0)
        and (v_sort <> 'ratio' or c.like_count + c.dislike_count >= 3)
      order by
        case when v_sort = 'ratio' then c.dislike_count::numeric / nullif(c.like_count + c.dislike_count, 0) end desc nulls last,
        case when v_sort <> 'newest' then c.dislike_count end desc nulls last,
        c.published_at desc
      limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0);
  else
    raise exception using message = 'ชนิดเนื้อหาไม่ถูกต้อง', detail = 'INVALID_KIND', errcode = 'P0001';
  end if;
end $fn$;
revoke all on function public.admin_list_community_content(text, text, integer, integer, text) from public, anon;
grant execute on function public.admin_list_community_content(text, text, integer, integer, text) to authenticated;
