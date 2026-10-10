-- Admin tooling to attach a challenger spell + enchantments to a build (public Item Build page reads them).
-- Additive. item_build_enchantments previously had only public SELECT, so admins could not write.

create policy "admin insert item_build_enchantments" on public.item_build_enchantments for insert to authenticated with check ((select public.is_admin()));
create policy "admin update item_build_enchantments" on public.item_build_enchantments for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin delete item_build_enchantments" on public.item_build_enchantments for delete to authenticated using ((select public.is_admin()));

-- Atomic replace of a build's spell + enchantments in one transaction (SECURITY INVOKER: RLS still applies,
-- plus an explicit is_admin() guard). p_enchantments = [{"enchantment_id": uuid, "selection_type": "primary"|"secondary"}, ...]
-- in display order; sort_order is derived per selection_type.
create or replace function public.set_build_extras(p_build_id uuid, p_spell_id uuid, p_enchantments jsonb)
returns void language plpgsql security invoker set search_path = '' as $fn$
begin
  if not (select public.is_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.item_builds set challenger_spell_id = p_spell_id where id = p_build_id;
  if not found then
    raise exception 'build not found' using errcode = 'P0002';
  end if;
  delete from public.item_build_enchantments where build_id = p_build_id;
  insert into public.item_build_enchantments (build_id, enchantment_id, selection_type, sort_order)
  select p_build_id,
         (t.x ->> 'enchantment_id')::uuid,
         t.x ->> 'selection_type',
         (row_number() over (partition by t.x ->> 'selection_type' order by t.ord) - 1)::int
  from jsonb_array_elements(coalesce(p_enchantments, '[]'::jsonb)) with ordinality as t(x, ord);
end
$fn$;
revoke all on function public.set_build_extras(uuid, uuid, jsonb) from public, anon;
grant execute on function public.set_build_extras(uuid, uuid, jsonb) to authenticated;
