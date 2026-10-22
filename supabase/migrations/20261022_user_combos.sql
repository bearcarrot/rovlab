-- Combo: 2-5 heroes that work well together. Same model as user_builds / user_build_reactions:
--   * recommended = is_featured (admin-curated; seeded once from hero_synergies, owner_id null)
--   * mine        = owner_id = caller (private or published)
--   * community   = is_public and not hidden and not is_featured
-- Likes/dislikes are aggregated on read by a SECURITY DEFINER RPC (owners can UPDATE their rows, so counts are not stored on them).
-- Additive only: no existing table, policy or data is changed (hero_synergies stays as the source for the hero detail page).

create or replace function public.combo_hero_ids_ok(ids uuid[]) returns boolean
language sql immutable set search_path = '' as $fn$
  select ids is not null
     and cardinality(ids) between 2 and 5
     and array_position(ids, null::uuid) is null
     and cardinality(ids) = (select count(distinct x) from unnest(ids) as x)
$fn$;

create table if not exists public.user_combos (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid references public.profiles (id) on delete cascade, -- null = curated by the team
  name         text not null check (char_length(btrim(name)) between 1 and 60),
  note         text check (note is null or char_length(note) <= 500),
  hero_ids     uuid[] not null check (public.combo_hero_ids_ok(hero_ids)), -- ordered; existence of each hero is checked by the guard trigger
  is_public    boolean not null default false,
  hidden       boolean not null default false,
  is_featured  boolean not null default false,
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists user_combos_owner_idx on public.user_combos (owner_id, updated_at desc);
create index if not exists user_combos_listing_idx on public.user_combos (is_featured, published_at desc) where is_public and not hidden;
create index if not exists user_combos_heroes_idx on public.user_combos using gin (hero_ids);

alter table public.user_combos enable row level security;
revoke all on public.user_combos from anon, authenticated;
grant select on public.user_combos to anon, authenticated;
grant insert, update, delete on public.user_combos to authenticated;

drop policy if exists "read visible user_combos" on public.user_combos;
create policy "read visible user_combos" on public.user_combos for select
  using ((is_public and not hidden) or owner_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "insert own user_combos" on public.user_combos;
create policy "insert own user_combos" on public.user_combos for insert to authenticated
  with check (owner_id = (select auth.uid()));
drop policy if exists "admin insert user_combos" on public.user_combos;
create policy "admin insert user_combos" on public.user_combos for insert to authenticated
  with check ((select public.is_admin()));
drop policy if exists "update own user_combos" on public.user_combos;
create policy "update own user_combos" on public.user_combos for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
drop policy if exists "admin update user_combos" on public.user_combos;
create policy "admin update user_combos" on public.user_combos for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "delete own or admin user_combos" on public.user_combos;
create policy "delete own or admin user_combos" on public.user_combos for delete to authenticated
  using (owner_id = (select auth.uid()) or (select public.is_admin()));

-- One-time seed of the recommended list from the existing 2-hero synergies (before the guard trigger exists, so is_featured sticks).
insert into public.user_combos (owner_id, name, note, hero_ids, is_public, is_featured, published_at)
select null, h.name || ' + ' || p.name, nullif(btrim(s.reason), ''), array[s.hero_id, s.partner_hero_id], true, true, now()
from public.hero_synergies s
join public.heroes h on h.id = s.hero_id
join public.heroes p on p.id = s.partner_hero_id
where s.hero_id <> s.partner_hero_id
  and not exists (select 1 from public.user_combos c where c.is_featured and c.owner_id is null);

create or replace function public.trg_user_combos_guard() returns trigger
language plpgsql security definer set search_path = '' as $fn$
begin
  if new.owner_id is not null and exists (select 1 from public.profiles p where p.id = new.owner_id and p.account_status = 'suspended') then
    raise exception using message = 'บัญชีของคุณถูกระงับ ไม่สามารถสร้างหรือแก้ไข Combo ได้', detail = 'ACCOUNT_SUSPENDED', errcode = 'P0001';
  end if;
  new.name := btrim(new.name);
  new.note := nullif(btrim(coalesce(new.note, '')), '');
  if cardinality(public.profanity_matches(new.name || ' ' || coalesce(new.note, ''))) > 0 then
    raise exception using message = 'ชื่อหรือโน้ตมีคำที่ไม่เหมาะสม กรุณาแก้ไขก่อนบันทึก', detail = 'PROFANITY_BLOCKED', errcode = 'P0001';
  end if;
  if (select count(*) from public.heroes h where h.id = any (new.hero_ids)) <> cardinality(new.hero_ids) then
    raise exception using message = 'ไม่พบฮีโร่ที่เลือก', detail = 'INVALID_HEROES', errcode = 'P0001';
  end if;
  if tg_op = 'INSERT' then
    if new.owner_id is not null and (select count(*) from public.user_combos c where c.owner_id = new.owner_id) >= 30 then
      raise exception using message = 'สร้าง Combo ได้สูงสุด 30 รายการ ลบรายการเก่าก่อน', detail = 'COMBO_LIMIT', errcode = 'P0001';
    end if;
    if (new.hidden or new.is_featured) and not (select public.is_admin()) then new.hidden := false; new.is_featured := false; end if;
  elsif (new.hidden is distinct from old.hidden or new.is_featured is distinct from old.is_featured) and not (select public.is_admin()) then
    raise exception using message = 'ไม่มีสิทธิ์เปลี่ยนสถานะนี้', detail = 'FORBIDDEN', errcode = 'P0001';
  end if;
  if new.is_public and (tg_op = 'INSERT' or not old.is_public) then new.published_at := now();
  elsif not new.is_public then new.published_at := null; end if;
  new.updated_at := now();
  return new;
end $fn$;

drop trigger if exists user_combos_guard on public.user_combos;
create trigger user_combos_guard before insert or update on public.user_combos
  for each row execute function public.trg_user_combos_guard();

create table if not exists public.user_combo_reactions (
  combo_id   uuid not null references public.user_combos (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  value      smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (combo_id, user_id)
);
create index if not exists user_combo_reactions_user_idx on public.user_combo_reactions (user_id);

alter table public.user_combo_reactions enable row level security;
drop policy if exists "own combo reactions" on public.user_combo_reactions;
create policy "own combo reactions" on public.user_combo_reactions for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.user_combos c where c.id = combo_id and c.is_public and not c.hidden)
  );
revoke all on public.user_combo_reactions from anon, authenticated;
grant select, insert, update, delete on public.user_combo_reactions to authenticated;

-- Likes/dislikes, the caller's own reaction and the author's public name for a page of combos (<= 100 ids).
-- Only combos the caller may see (public and not hidden, or own) are returned.
create or replace function public.get_user_combo_meta(p_ids uuid[])
returns table (combo_id uuid, like_count integer, dislike_count integer, my_value smallint, author_handle text, author_name text)
language sql stable security definer set search_path = '' as $fn$
  select c.id,
         (count(*) filter (where r.value = 1))::int,
         (count(*) filter (where r.value = -1))::int,
         max(r.value) filter (where r.user_id = (select auth.uid())),
         max(p.handle),
         max(p.display_name)
  from public.user_combos c
  left join public.user_combo_reactions r on r.combo_id = c.id
  left join public.profiles p on p.id = c.owner_id
  where c.id = any (p_ids)
    and ((c.is_public and not c.hidden) or c.owner_id = (select auth.uid()))
  group by c.id
  limit 100
$fn$;
revoke all on function public.get_user_combo_meta(uuid[]) from public;
grant execute on function public.get_user_combo_meta(uuid[]) to anon, authenticated;
