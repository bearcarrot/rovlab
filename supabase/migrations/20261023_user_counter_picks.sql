-- Counter Pick ของฉัน: private, per-user counter recommendations (enemy hero -> hero the user picks against it).
-- Same shape as hero_counters (hero_id = the hero being countered, counter_hero_id = the hero that wins) so Draft Assistant can
-- swap one dataset for the other. Strictly owner-only: there is no public/admin read path and nothing is shared with Community.
-- Additive only: hero_counters, user_combos and every existing policy are untouched.

create table if not exists public.user_counter_picks (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  enemy_hero_id   uuid not null references public.heroes (id) on delete cascade,  -- the hero being countered
  counter_hero_id uuid not null references public.heroes (id) on delete cascade,  -- the hero the user picks against it
  strength        text not null check (strength in ('best', 'good', 'situational')), -- same values as hero_counters.strength
  reason          text check (reason is null or char_length(reason) <= 300),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint user_counter_picks_distinct_heroes check (enemy_hero_id <> counter_hero_id),
  constraint user_counter_picks_unique unique (owner_id, enemy_hero_id, counter_hero_id)
);
-- the unique constraint already indexes (owner_id, enemy_hero_id, ...); these cover FK cascades and the owner's list ordering
create index if not exists user_counter_picks_owner_updated_idx on public.user_counter_picks (owner_id, updated_at desc);
create index if not exists user_counter_picks_enemy_idx on public.user_counter_picks (enemy_hero_id);
create index if not exists user_counter_picks_counter_idx on public.user_counter_picks (counter_hero_id);

alter table public.user_counter_picks enable row level security;
revoke all on public.user_counter_picks from anon, authenticated;
grant select, insert, update, delete on public.user_counter_picks to authenticated;

-- Owner only, enforced here and not in the UI. WITH CHECK on update stops a row being handed to another account.
drop policy if exists "select own user_counter_picks" on public.user_counter_picks;
create policy "select own user_counter_picks" on public.user_counter_picks for select to authenticated
  using (owner_id = (select auth.uid()));
drop policy if exists "insert own user_counter_picks" on public.user_counter_picks;
create policy "insert own user_counter_picks" on public.user_counter_picks for insert to authenticated
  with check (owner_id = (select auth.uid()));
drop policy if exists "update own user_counter_picks" on public.user_counter_picks;
create policy "update own user_counter_picks" on public.user_counter_picks for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
drop policy if exists "delete own user_counter_picks" on public.user_counter_picks;
create policy "delete own user_counter_picks" on public.user_counter_picks for delete to authenticated
  using (owner_id = (select auth.uid()));

-- Same guard as user_combos: suspended accounts cannot write, free text is profanity-checked, per-user cap, updated_at maintained.
-- Hero existence is already enforced by the foreign keys (23503) and the duplicate rule by the unique constraint (23505).
create or replace function public.trg_user_counter_picks_guard() returns trigger
language plpgsql security definer set search_path = '' as $fn$
begin
  if exists (select 1 from public.profiles p where p.id = new.owner_id and p.account_status = 'suspended') then
    raise exception using message = 'บัญชีของคุณถูกระงับ ไม่สามารถสร้างหรือแก้ไข Counter ได้', detail = 'ACCOUNT_SUSPENDED', errcode = 'P0001';
  end if;
  new.reason := nullif(btrim(coalesce(new.reason, '')), '');
  if new.reason is not null and cardinality(public.profanity_matches(new.reason)) > 0 then
    raise exception using message = 'เหตุผลมีคำที่ไม่เหมาะสม กรุณาแก้ไขก่อนบันทึก', detail = 'PROFANITY_BLOCKED', errcode = 'P0001';
  end if;
  if tg_op = 'INSERT' then
    if (select count(*) from public.user_counter_picks c where c.owner_id = new.owner_id) >= 300 then
      raise exception using message = 'บันทึก Counter ได้สูงสุด 300 รายการ ลบรายการเก่าก่อน', detail = 'COUNTER_LIMIT', errcode = 'P0001';
    end if;
  elsif new.owner_id is distinct from old.owner_id then
    raise exception using message = 'ไม่มีสิทธิ์เปลี่ยนเจ้าของรายการ', detail = 'FORBIDDEN', errcode = 'P0001';
  end if;
  new.updated_at := now();
  return new;
end $fn$;
revoke all on function public.trg_user_counter_picks_guard() from public, anon, authenticated;

drop trigger if exists user_counter_picks_guard on public.user_counter_picks;
create trigger user_counter_picks_guard before insert or update on public.user_counter_picks
  for each row execute function public.trg_user_counter_picks_guard();
