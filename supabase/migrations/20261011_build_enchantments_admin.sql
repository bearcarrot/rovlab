-- Admin editing for "พลังแฝงในบิลด์" (item_build_enchantments) and "สกิลชาเลนเจอร์ในบิลด์" (item_builds.challenger_spell_id)
-- Additive and non-destructive: no existing row is modified (item_build_enchantments is empty today).
--
-- 1) item_build_enchantments only had public SELECT, so the admin UI could not write.
--    Add admin-only insert/update/delete with the same is_admin() pattern as items / item_builds.
-- 2) Row-level rules trigger (defence in depth; the admin UI also checks the full set in src/lib/enchantmentRules.ts):
--      primary   : slot (sort_order) 1..3, slot n must hold a Tier n enchantment, all primaries from one tree
--      secondary : slot 1..2, Tier 1 or 2 only, never the same tree as the primary, at most one Tier 2
--      both      : only enchantments with status active / seasonal
--    "Tier 2 needs a same-tree Tier 1 in the other slot" depends on insert order, so it is enforced in the UI only.
-- 3) Grant hardening for item_build_enchantments was already done in 20261010_game_catalog_admin.sql.

create policy "admin insert item_build_enchantments" on public.item_build_enchantments for insert to authenticated with check ((select public.is_admin()));
create policy "admin update item_build_enchantments" on public.item_build_enchantments for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin delete item_build_enchantments" on public.item_build_enchantments for delete to authenticated using ((select public.is_admin()));

create or replace function public.item_build_enchantment_rules()
returns trigger language plpgsql set search_path = '' as $fn$
declare
  e_tree uuid;
  e_tier smallint;
  e_status text;
begin
  select tree_id, tier_level, status into e_tree, e_tier, e_status
  from public.enchantments where id = new.enchantment_id;

  if e_status is null or e_status not in ('active', 'seasonal') then
    raise exception 'พลังแฝงนี้ยังไม่เปิดใช้ในเกมจริง (status = %)', coalesce(e_status, 'ไม่พบ') using errcode = '23514';
  end if;

  if new.selection_type = 'primary' then
    if new.sort_order not between 1 and 3 or e_tier is distinct from new.sort_order::smallint then
      raise exception 'ช่องสายหลักที่ % ต้องเป็นพลังแฝง Tier %', new.sort_order, new.sort_order using errcode = '23514';
    end if;
    if exists (
      select 1 from public.item_build_enchantments x
      join public.enchantments xe on xe.id = x.enchantment_id
      where x.build_id = new.build_id and x.selection_type = 'primary' and x.id is distinct from new.id and xe.tree_id <> e_tree
    ) then
      raise exception 'พลังแฝงสายหลักต้องมาจากสายเดียวกันทั้งหมด' using errcode = '23514';
    end if;
    if exists (
      select 1 from public.item_build_enchantments x
      join public.enchantments xe on xe.id = x.enchantment_id
      where x.build_id = new.build_id and x.selection_type = 'secondary' and xe.tree_id = e_tree
    ) then
      raise exception 'สายรองต้องไม่ใช่สายเดียวกับสายหลัก' using errcode = '23514';
    end if;
  else
    if new.sort_order not between 1 and 2 or e_tier is null or e_tier not in (1, 2) then
      raise exception 'สายรองมี 2 ช่อง และเลือกได้เฉพาะ Tier 1 หรือ Tier 2' using errcode = '23514';
    end if;
    if exists (
      select 1 from public.item_build_enchantments x
      join public.enchantments xe on xe.id = x.enchantment_id
      where x.build_id = new.build_id and x.selection_type = 'primary' and xe.tree_id = e_tree
    ) then
      raise exception 'สายรองต้องไม่ใช่สายเดียวกับสายหลัก' using errcode = '23514';
    end if;
    if e_tier = 2 and exists (
      select 1 from public.item_build_enchantments x
      join public.enchantments xe on xe.id = x.enchantment_id
      where x.build_id = new.build_id and x.selection_type = 'secondary' and x.id is distinct from new.id and xe.tier_level = 2
    ) then
      raise exception 'สายรองมี Tier 2 ได้ไม่เกิน 1 อัน' using errcode = '23514';
    end if;
  end if;
  return new;
end
$fn$;
revoke all on function public.item_build_enchantment_rules() from public, anon, authenticated;

create trigger item_build_enchantments_rules before insert or update on public.item_build_enchantments
  for each row execute function public.item_build_enchantment_rules();
