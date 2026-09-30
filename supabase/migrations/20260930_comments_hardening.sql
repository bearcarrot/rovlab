-- Applied to the production project via Supabase MCP on 2026-09-30 (migration name: comments_hardening).
-- Kept here so the schema in the repo matches the database.

-- 1) Backfill profiles for users that signed up without one.
--    comments.user_id references profiles(id), so a user with no profile row cannot comment.
insert into public.profiles (id, display_name)
select u.id, coalesce(u.raw_user_meta_data->>'display_name', split_part(u.email, '@', 1))
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

-- 2) Body length limit (1-500 chars after trimming).
alter table public.comments
  add constraint comments_body_length check (char_length(btrim(body)) between 1 and 500);

-- 3) List query: newest comments for a hero.
create index if not exists comments_hero_slug_created_idx
  on public.comments (hero_slug, created_at desc);

-- 4) Admins can remove any comment (moderation). Own-comment delete policy already exists.
create policy "admin delete comments" on public.comments
  for delete to authenticated using (public.is_admin());

-- 5) Basic spam guard: one comment per user per 10 seconds.
create or replace function public.comments_rate_limit()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if exists (
    select 1 from public.comments
    where user_id = new.user_id and created_at > now() - interval '10 seconds'
  ) then
    raise exception 'comment_rate_limited';
  end if;
  return new;
end;
$$;

create trigger comments_rate_limit_trg
  before insert on public.comments
  for each row execute function public.comments_rate_limit();

-- 6) Read comments together with the author's public display name / avatar.
--    profiles RLS only lets a user read their own row, so this goes through a
--    security-definer function that exposes just those two fields.
create or replace function public.list_hero_comments(p_hero_slug text, p_limit int default 50)
returns table (id uuid, user_id uuid, body text, created_at timestamptz, author_name text, avatar_url text)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.user_id, c.body, c.created_at, p.display_name, p.avatar_url
  from public.comments c
  left join public.profiles p on p.id = c.user_id
  where c.hero_slug = p_hero_slug
  order by c.created_at desc
  limit least(greatest(p_limit, 1), 100);
$$;

revoke all on function public.list_hero_comments(text, int) from public;
grant execute on function public.list_hero_comments(text, int) to anon, authenticated;
