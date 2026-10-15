-- วันที่บันทึก/แก้ไขจริงของบิลด์ (item_builds มีแค่ created_at ซึ่งเป็นวันที่ลงแถวตอนนำเข้า)
-- Additive: เพิ่มคอลัมน์ updated_at, ย้อนค่าเดิมเป็น created_at, แล้วอัปเดตเองเมื่อแก้บิลด์หรือรายการลูกของบิลด์
alter table public.item_builds add column if not exists updated_at timestamptz;
update public.item_builds set updated_at = created_at where updated_at is null;
alter table public.item_builds alter column updated_at set default now();
alter table public.item_builds alter column updated_at set not null;

-- ตัวบิลด์เอง (patch/source/รูน/สกิล ฯลฯ เปลี่ยน)
create or replace function public.item_builds_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists item_builds_touch on public.item_builds;
create trigger item_builds_touch before update on public.item_builds
  for each row execute function public.item_builds_touch();

-- รายการลูก (ไอเทม/รูน/พลังแฝงในบิลด์) เปลี่ยน = บิลด์ถูกแก้
create or replace function public.item_builds_touch_parent() returns trigger
language plpgsql set search_path = '' as $$
begin
  update public.item_builds set updated_at = now() where id = coalesce(new.build_id, old.build_id);
  return null;
end $$;
drop trigger if exists item_build_items_touch on public.item_build_items;
create trigger item_build_items_touch after insert or update or delete on public.item_build_items
  for each row execute function public.item_builds_touch_parent();
drop trigger if exists item_build_rune_touch on public.item_build_rune;
create trigger item_build_rune_touch after insert or update or delete on public.item_build_rune
  for each row execute function public.item_builds_touch_parent();
drop trigger if exists item_build_enchantments_touch on public.item_build_enchantments;
create trigger item_build_enchantments_touch after insert or update or delete on public.item_build_enchantments
  for each row execute function public.item_builds_touch_parent();
