-- Item tier (T1/T2/T3). ALREADY APPLIED to project mttcdaiwuasnkqlxbeqs (migration "items_tier", 2026-10-08). Do not run again.
-- Nullable: there is no data source for existing items yet, so it is filled via Admin > ไอเทม.
-- Item "ประเภท" (physical/magic/defense/boots/jungle/support) already lives in items.role_tags, so no new column for it.
alter table public.items
  add column if not exists tier smallint;

alter table public.items drop constraint if exists items_tier_chk;
alter table public.items
  add constraint items_tier_chk check (tier is null or tier in (1, 2, 3));
