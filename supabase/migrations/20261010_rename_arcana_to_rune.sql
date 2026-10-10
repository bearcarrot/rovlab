-- Rename arcana -> rune (already applied to production via Supabase MCP as `rename_arcana_to_rune`).
-- Kept here so the migration history matches the live database.
alter table arcana rename to rune;
alter table item_build_arcana rename to item_build_rune;
alter table item_builds rename column arcana_id to rune_id;
alter table item_build_rune rename column arcana_id to rune_id;
alter table saved_builds rename column arcana to rune;

alter table rune rename constraint arcana_pkey to rune_pkey;
alter table rune rename constraint arcana_color_check to rune_color_check;
alter table item_build_rune rename constraint item_build_arcana_pkey to item_build_rune_pkey;
alter table item_build_rune rename constraint item_build_arcana_quantity_check to item_build_rune_quantity_check;
alter table item_build_rune rename constraint item_build_arcana_arcana_id_fkey to item_build_rune_rune_id_fkey;
alter table item_build_rune rename constraint item_build_arcana_build_id_fkey to item_build_rune_build_id_fkey;
alter table item_builds rename constraint item_builds_arcana_id_fkey to item_builds_rune_id_fkey;

alter index item_build_arcana_build_idx rename to item_build_rune_build_idx;
alter index idx_item_build_arcana_arcana_id rename to idx_item_build_rune_rune_id;
alter index idx_item_builds_arcana_id rename to idx_item_builds_rune_id;

alter policy "public read arcana" on rune rename to "public read rune";
alter policy "admin insert arcana" on rune rename to "admin insert rune";
alter policy "admin update arcana" on rune rename to "admin update rune";
alter policy "admin delete arcana" on rune rename to "admin delete rune";
alter policy "public read item_build_arcana" on item_build_rune rename to "public read item_build_rune";
alter policy "admin insert item_build_arcana" on item_build_rune rename to "admin insert item_build_rune";
alter policy "admin update item_build_arcana" on item_build_rune rename to "admin update item_build_rune";
alter policy "admin delete item_build_arcana" on item_build_rune rename to "admin delete item_build_rune";
