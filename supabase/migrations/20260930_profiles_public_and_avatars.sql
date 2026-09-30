-- Applied to the production project via Supabase MCP on 2026-09-30
-- (migration name: profiles_public_profile_and_avatars). Kept here so the repo matches the database.

-- 1) New profile fields
alter table public.profiles
  add column if not exists bio text,
  add column if not exists game_name text,
  add column if not exists contact text,
  add column if not exists avatar_updated_at timestamptz;

alter table public.profiles
  add constraint profiles_display_name_length check (display_name is null or char_length(btrim(display_name)) between 2 and 30),
  add constraint profiles_bio_length check (bio is null or char_length(bio) <= 200),
  add constraint profiles_game_name_length check (game_name is null or char_length(game_name) <= 40),
  add constraint profiles_contact_length check (contact is null or char_length(contact) <= 80),
  add constraint profiles_preferred_heroes_max3 check (cardinality(preferred_heroes) <= 3);

-- 2) Column-level UPDATE: users may edit their own text fields, but NOT avatar_url / avatar_updated_at
--    (only the moderated `avatar` Edge Function, using the service role, sets those).
revoke update on public.profiles from anon, authenticated;
grant update (display_name, bio, game_name, contact, preferred_roles, preferred_heroes)
  on public.profiles to authenticated;

-- 3) Avatar bucket: public read, no client write policies (service role only).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 512000, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- 4) New signups get a neutral default display name instead of the email prefix.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v text := left(btrim(coalesce(new.raw_user_meta_data->>'display_name', '')), 30);
begin
  if char_length(v) < 2 then
    v := 'ผู้เล่น' || substr(md5(new.id::text), 1, 4);
  end if;
  insert into public.profiles (id, display_name) values (new.id, v)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- 5) Public profile lookup. profiles RLS only allows reading your own row, so this goes through a
--    security-definer function. game_name / contact are returned to signed-in users only.
create or replace function public.get_public_profile(p_id uuid)
returns table (
  id uuid,
  display_name text,
  avatar_url text,
  bio text,
  preferred_roles text[],
  preferred_heroes uuid[],
  game_name text,
  contact text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.display_name, p.avatar_url, p.bio, p.preferred_roles, p.preferred_heroes,
         case when auth.uid() is not null then p.game_name end,
         case when auth.uid() is not null then p.contact end,
         p.created_at
  from public.profiles p
  where p.id = p_id;
$$;

revoke all on function public.get_public_profile(uuid) from public;
grant execute on function public.get_public_profile(uuid) to anon, authenticated;
