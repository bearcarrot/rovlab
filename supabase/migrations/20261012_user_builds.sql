-- User builds ("Build ของฉัน" / Community Build). Applied to production after a rolled-back dry-run.
-- Owner-only write; public read only when is_public and not hidden (admin can hide/delete).
-- save_user_build validates that every referenced item/rune/spell/enchantment is verified against the game.

create table public.user_builds (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  hero_id uuid not null references public.heroes(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  note text check (note is null or char_length(note) <= 500),
  challenger_spell_id uuid references public.challenger_spells(id) on delete set null,
  is_public boolean not null default false,
  hidden boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index user_builds_owner_idx on public.user_builds (owner_id, updated_at desc);
create index user_builds_public_idx on public.user_builds (hero_id, published_at desc) where is_public and not hidden;

create table public.user_build_items (
  id uuid primary key default gen_random_uuid(),
  build_id uuid not null references public.user_builds(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  phase text not null check (phase in ('early','core','situational')),
  sort_order int not null default 0
);
create index user_build_items_build_idx on public.user_build_items (build_id);
create table public.user_build_runes (
  id uuid primary key default gen_random_uuid(),
  build_id uuid not null references public.user_builds(id) on delete cascade,
  rune_id uuid not null references public.rune(id) on delete cascade,
  quantity int not null check (quantity between 1 and 10),
  sort_order int not null default 0,
  unique (build_id, rune_id)
);
create index user_build_runes_build_idx on public.user_build_runes (build_id);
create table public.user_build_enchantments (
  id uuid primary key default gen_random_uuid(),
  build_id uuid not null references public.user_builds(id) on delete cascade,
  enchantment_id uuid not null references public.enchantments(id) on delete cascade,
  selection_type text not null check (selection_type in ('primary','secondary')),
  sort_order int not null default 0,
  unique (build_id, enchantment_id)
);
create index user_build_enchantments_build_idx on public.user_build_enchantments (build_id);

create or replace function public.trg_user_builds_guard() returns trigger
language plpgsql security definer set search_path = '' as $fn$
begin
  if exists (select 1 from public.profiles p where p.id = new.owner_id and p.account_status = 'suspended') then
    raise exception using message = 'บัญชีของคุณถูกระงับ ไม่สามารถสร้างหรือแก้ไขบิลด์ได้', detail = 'ACCOUNT_SUSPENDED', errcode = 'P0001';
  end if;
  new.name := btrim(new.name);
  new.note := nullif(btrim(coalesce(new.note, '')), '');
  if cardinality(public.profanity_matches(new.name || ' ' || coalesce(new.note, ''))) > 0 then
    raise exception using message = 'ชื่อหรือโน๊ตมีคำที่ไม่เหมาะสม กรุณาแก้ไขก่อนบันทึก', detail = 'PROFANITY_BLOCKED', errcode = 'P0001';
  end if;
  if tg_op = 'INSERT' then
    if (select count(*) from public.user_builds b where b.owner_id = new.owner_id) >= 30 then
      raise exception using message = 'สร้างบิลด์ได้สูงสุด 30 รายการ ลบรายการเก่าก่อน', detail = 'BUILD_LIMIT', errcode = 'P0001';
    end if;
    if new.hidden and not (select public.is_admin()) then new.hidden := false; end if;
  elsif new.hidden is distinct from old.hidden and not (select public.is_admin()) then
    raise exception using message = 'ไม่มีสิทธิ์เปลี่ยนสถานะซ่อน', detail = 'FORBIDDEN', errcode = 'P0001';
  end if;
  if new.is_public and (tg_op = 'INSERT' or not old.is_public) then new.published_at := now();
  elsif not new.is_public then new.published_at := null; end if;
  new.updated_at := now();
  return new;
end $fn$;
revoke all on function public.trg_user_builds_guard() from public, anon, authenticated;
create trigger user_builds_guard before insert or update on public.user_builds for each row execute function public.trg_user_builds_guard();

alter table public.user_builds enable row level security;
alter table public.user_build_items enable row level security;
alter table public.user_build_runes enable row level security;
alter table public.user_build_enchantments enable row level security;

create policy "read visible user_builds" on public.user_builds for select using ((is_public and not hidden) or owner_id = (select auth.uid()) or (select public.is_admin()));
create policy "insert own user_builds" on public.user_builds for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "update own user_builds" on public.user_builds for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "admin update user_builds" on public.user_builds for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "delete own or admin user_builds" on public.user_builds for delete to authenticated using (owner_id = (select auth.uid()) or (select public.is_admin()));

create policy "read visible user_build_items" on public.user_build_items for select using (exists (select 1 from public.user_builds b where b.id = build_id));
create policy "own write user_build_items" on public.user_build_items for all to authenticated using (exists (select 1 from public.user_builds b where b.id = build_id and b.owner_id = (select auth.uid()))) with check (exists (select 1 from public.user_builds b where b.id = build_id and b.owner_id = (select auth.uid())));
create policy "read visible user_build_runes" on public.user_build_runes for select using (exists (select 1 from public.user_builds b where b.id = build_id));
create policy "own write user_build_runes" on public.user_build_runes for all to authenticated using (exists (select 1 from public.user_builds b where b.id = build_id and b.owner_id = (select auth.uid()))) with check (exists (select 1 from public.user_builds b where b.id = build_id and b.owner_id = (select auth.uid())));
create policy "read visible user_build_enchantments" on public.user_build_enchantments for select using (exists (select 1 from public.user_builds b where b.id = build_id));
create policy "own write user_build_enchantments" on public.user_build_enchantments for all to authenticated using (exists (select 1 from public.user_builds b where b.id = build_id and b.owner_id = (select auth.uid()))) with check (exists (select 1 from public.user_builds b where b.id = build_id and b.owner_id = (select auth.uid())));

revoke truncate, references, trigger on public.user_builds, public.user_build_items, public.user_build_runes, public.user_build_enchantments from anon, authenticated;
revoke insert, update, delete on public.user_builds, public.user_build_items, public.user_build_runes, public.user_build_enchantments from anon;

-- Atomic create/replace (SECURITY INVOKER: RLS + triggers still apply). Order of arrays = display order.
create or replace function public.save_user_build(
  p_id uuid, p_hero_id uuid, p_name text, p_note text, p_spell_id uuid, p_is_public boolean,
  p_items jsonb, p_runes jsonb, p_enchantments jsonb
) returns uuid language plpgsql security invoker set search_path = '' as $fn$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_items jsonb := coalesce(p_items, '[]'::jsonb);
  v_runes jsonb := coalesce(p_runes, '[]'::jsonb);
  v_ench jsonb := coalesce(p_enchantments, '[]'::jsonb);
begin
  if v_uid is null then
    raise exception 'ต้องเข้าสู่ระบบก่อน' using errcode = '42501';
  end if;
  if jsonb_array_length(v_items) > 20 or jsonb_array_length(v_runes) > 30 or jsonb_array_length(v_ench) > 12 then
    raise exception using message = 'จำนวนรายการในบิลด์มากเกินไป', detail = 'TOO_MANY', errcode = 'P0001';
  end if;
  if exists (select 1 from jsonb_array_elements(v_items) x left join public.items i on i.id = (x ->> 'item_id')::uuid where i.id is null or i.verified_at is null)
     or exists (select 1 from jsonb_array_elements(v_runes) x left join public.rune r on r.id = (x ->> 'rune_id')::uuid where r.id is null or r.verified_at is null)
     or exists (select 1 from jsonb_array_elements(v_ench) x left join public.enchantments e on e.id = (x ->> 'enchantment_id')::uuid where e.id is null or e.verified_at is null or e.status not in ('active','seasonal'))
     or (p_spell_id is not null and not exists (select 1 from public.challenger_spells s where s.id = p_spell_id and s.verified_at is not null and s.status in ('active','seasonal'))) then
    raise exception using message = 'มีรายการที่ยังไม่ได้รับการยืนยันกับเกมจริง เลือกใหม่อีกครั้ง', detail = 'UNVERIFIED_REFERENCE', errcode = 'P0001';
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_runes) x join public.rune r on r.id = (x ->> 'rune_id')::uuid
    group by r.color having sum((x ->> 'quantity')::int) > 10
  ) then
    raise exception using message = 'รูนแต่ละสีใส่ได้สูงสุด 10 ช่อง', detail = 'RUNE_LIMIT', errcode = 'P0001';
  end if;

  if p_id is null then
    insert into public.user_builds (owner_id, hero_id, name, note, challenger_spell_id, is_public)
    values (v_uid, p_hero_id, p_name, p_note, p_spell_id, coalesce(p_is_public, false))
    returning id into v_id;
  else
    update public.user_builds
       set hero_id = p_hero_id, name = p_name, note = p_note, challenger_spell_id = p_spell_id, is_public = coalesce(p_is_public, false)
     where id = p_id and owner_id = v_uid
    returning id into v_id;
    if v_id is null then
      raise exception 'ไม่พบบิลด์นี้' using errcode = 'P0002';
    end if;
    delete from public.user_build_items where build_id = v_id;
    delete from public.user_build_runes where build_id = v_id;
    delete from public.user_build_enchantments where build_id = v_id;
  end if;

  insert into public.user_build_items (build_id, item_id, phase, sort_order)
  select v_id, (t.x ->> 'item_id')::uuid, t.x ->> 'phase', t.ord::int
  from jsonb_array_elements(v_items) with ordinality as t(x, ord);
  insert into public.user_build_runes (build_id, rune_id, quantity, sort_order)
  select v_id, (t.x ->> 'rune_id')::uuid, (t.x ->> 'quantity')::int, t.ord::int
  from jsonb_array_elements(v_runes) with ordinality as t(x, ord);
  insert into public.user_build_enchantments (build_id, enchantment_id, selection_type, sort_order)
  select v_id, (t.x ->> 'enchantment_id')::uuid, t.x ->> 'selection_type',
         (row_number() over (partition by t.x ->> 'selection_type' order by t.ord) - 1)::int
  from jsonb_array_elements(v_ench) with ordinality as t(x, ord);
  return v_id;
end $fn$;
revoke all on function public.save_user_build(uuid, uuid, text, text, uuid, boolean, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.save_user_build(uuid, uuid, text, text, uuid, boolean, jsonb, jsonb, jsonb) to authenticated;

-- Author names for public builds only (profiles itself stays owner-readable).
create or replace function public.get_public_authors(p_ids uuid[])
returns table (id uuid, handle text, display_name text, avatar_url text, verified_category text)
language sql stable security definer set search_path = '' as $fn$
  select p.id, p.handle, p.display_name, p.avatar_url, p.verified_category
  from public.profiles p
  where p.id = any (p_ids)
    and exists (select 1 from public.user_builds b where b.owner_id = p.id and b.is_public and not b.hidden)
  limit 100
$fn$;
revoke all on function public.get_public_authors(uuid[]) from public;
grant execute on function public.get_public_authors(uuid[]) to anon, authenticated;
