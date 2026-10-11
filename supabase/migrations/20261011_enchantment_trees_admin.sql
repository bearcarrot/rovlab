-- Admin editing of enchantment_trees (สายพลังแฝง) so the admin UI can set each tree's icon_url.
-- Additive + idempotent: same is_admin() pattern as the other catalogs. No rows are modified.
-- Only update is granted (the 4 trees are fixed game data; no insert/delete from the UI).
drop policy if exists "admin update enchantment_trees" on public.enchantment_trees;
create policy "admin update enchantment_trees" on public.enchantment_trees
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
grant update (icon_url) on public.enchantment_trees to authenticated;
