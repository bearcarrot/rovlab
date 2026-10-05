-- NOT yet applied to any Supabase project. Apply this BEFORE deploying the matching frontend:
-- the profile save will fail with "column contact_links does not exist" otherwise.
--
-- Structured contact links on profiles: [{"app": "line", "url": "https://line.me/ti/p/~xxx"}, ...]
-- The allowed apps / official hosts live in TWO places that must stay in sync:
--   here (contact_url_ok)  and  src/features/profile/contactApps.ts

-- 1) URL check per app: https only, official hosts only, path only (no ?query / #fragment / port / userinfo),
--    except Facebook's profile.php?id=<digits>. Not allowing queries also blocks redirect shims such as
--    facebook.com/l.php?u=... and youtube.com/redirect?q=...
create or replace function public.contact_url_ok(p_app text, p_url text)
returns boolean
language sql
immutable
as $$
  select p_url is not null
    and char_length(p_url) <= 200
    and case p_app
      when 'line' then
        p_url ~* '^https://(line\.me|lin\.ee)/[/]*[A-Za-z0-9@%~][A-Za-z0-9._~%@:+=,/-]*$'
      when 'facebook' then
        p_url ~* '^https://((www\.|m\.)?facebook\.com|(www\.)?fb\.com|fb\.me)/[/]*[A-Za-z0-9@%~][A-Za-z0-9._~%@:+=,/-]*$'
        or p_url ~* '^https://(www\.|m\.)?facebook\.com/profile\.php\?id=[0-9]{5,25}$'
      when 'discord' then
        p_url ~* '^https://(discord\.gg|(www\.)?discord\.com)/[/]*[A-Za-z0-9@%~][A-Za-z0-9._~%@:+=,/-]*$'
      when 'instagram' then
        p_url ~* '^https://(www\.)?instagram\.com/[/]*[A-Za-z0-9@%~][A-Za-z0-9._~%@:+=,/-]*$'
      when 'tiktok' then
        p_url ~* '^https://(www\.)?tiktok\.com/[/]*[A-Za-z0-9@%~][A-Za-z0-9._~%@:+=,/-]*$'
      when 'youtube' then
        p_url ~* '^https://((www\.|m\.)?youtube\.com|youtu\.be)/[/]*[A-Za-z0-9@%~][A-Za-z0-9._~%@:+=,/-]*$'
      when 'x' then
        p_url ~* '^https://(www\.)?(x\.com|twitter\.com)/[/]*[A-Za-z0-9@%~][A-Za-z0-9._~%@:+=,/-]*$'
      when 'twitch' then
        p_url ~* '^https://(www\.)?twitch\.tv/[/]*[A-Za-z0-9@%~][A-Za-z0-9._~%@:+=,/-]*$'
      when 'telegram' then
        p_url ~* '^https://(t\.me|telegram\.me)/[/]*[A-Za-z0-9@%~][A-Za-z0-9._~%@:+=,/-]*$'
      else false
    end;
$$;

-- 2) Whole-array check: array of {app,url} objects, one entry per app, nothing else.
create or replace function public.valid_contact_links(p jsonb)
returns boolean
language plpgsql
immutable
as $$
declare
  item jsonb;
  seen text[] := '{}';
begin
  if p is null then return false; end if;
  if jsonb_typeof(p) <> 'array' or jsonb_array_length(p) > 9 then return false; end if;
  for item in select e from jsonb_array_elements(p) as e loop
    if jsonb_typeof(item) <> 'object' then return false; end if;
    if (select count(*) from jsonb_object_keys(item)) <> 2 then return false; end if;
    if coalesce(jsonb_typeof(item->'app'), '') <> 'string' or coalesce(jsonb_typeof(item->'url'), '') <> 'string' then
      return false;
    end if;
    if (item->>'app') = any (seen) then return false; end if;
    seen := seen || (item->>'app');
    if not public.contact_url_ok(item->>'app', item->>'url') then return false; end if;
  end loop;
  return true;
end;
$$;

-- 3) Column + constraint (enforced for every writer, not just the app)
alter table public.profiles
  add column if not exists contact_links jsonb not null default '[]'::jsonb;

alter table public.profiles drop constraint if exists profiles_contact_links_valid;
alter table public.profiles
  add constraint profiles_contact_links_valid check (public.valid_contact_links(contact_links));

-- 4) Users edit contact_links; the old free-text `contact` is no longer writable (it could hold any link).
--    The column and its existing data are kept, just not shown or editable anymore.
grant update (contact_links) on public.profiles to authenticated;
revoke update (contact) on public.profiles from authenticated;

-- 5) Public profile lookup: contact_links replaces contact; still signed-in users only.
drop function if exists public.get_public_profile(uuid);
create function public.get_public_profile(p_id uuid)
returns table (
  id uuid,
  display_name text,
  avatar_url text,
  bio text,
  preferred_roles text[],
  preferred_heroes uuid[],
  game_name text,
  contact_links jsonb,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.display_name, p.avatar_url, p.bio, p.preferred_roles, p.preferred_heroes,
         case when auth.uid() is not null then p.game_name end,
         case when auth.uid() is not null then p.contact_links else '[]'::jsonb end,
         p.created_at
  from public.profiles p
  where p.id = p_id;
$$;

revoke all on function public.get_public_profile(uuid) from public;
grant execute on function public.get_public_profile(uuid) to anon, authenticated;
