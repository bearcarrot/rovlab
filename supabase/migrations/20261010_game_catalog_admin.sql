-- Admin Game Database Manager: items / rune / challenger_spells / enchantments
-- Additive and non-destructive. No existing row is modified.
--
-- 1) verified_at / verified_by on the four catalogs. NULL = "needs verification".
--    Existing rows are NOT marked verified.
-- 2) Trigger: marking verified records the acting admin; ANY content change to a
--    verified row clears the verification (it must be re-checked against the game).
-- 3) Admin-only write RLS for challenger_spells and enchantments (they only had public SELECT,
--    so the admin UI could not write). Same is_admin() pattern as items / rune.
-- 4) Grant hardening: anon/authenticated had TRUNCATE/REFERENCES/TRIGGER (and anon had DML)
--    on the enchantment/spell tables. RLS does not apply to TRUNCATE, so revoke it.

alter table public.items             add column if not exists verified_at timestamptz, add column if not exists verified_by uuid references auth.users(id) on delete set null;
alter table public.rune              add column if not exists verified_at timestamptz, add column if not exists verified_by uuid references auth.users(id) on delete set null;
alter table public.challenger_spells add column if not exists verified_at timestamptz, add column if not exists verified_by uuid references auth.users(id) on delete set null;
alter table public.enchantments      add column if not exists verified_at timestamptz, add column if not exists verified_by uuid references auth.users(id) on delete set null;

create or replace function public.catalog_verification_guard()
returns trigger language plpgsql set search_path = '' as $fn$
declare
  v_old jsonb; v_new jsonb;
begin
  if tg_op = 'INSERT' then
    if new.verified_at is not null then new.verified_by := auth.uid(); else new.verified_by := null; end if;
    return new;
  end if;
  v_old := to_jsonb(old) - 'verified_at' - 'verified_by' - 'updated_at';
  v_new := to_jsonb(new) - 'verified_at' - 'verified_by' - 'updated_at';
  if new.verified_at is distinct from old.verified_at then
    new.verified_by := case when new.verified_at is null then null else auth.uid() end;
  elsif v_new is distinct from v_old then
    new.verified_at := null;
    new.verified_by := null;
  end if;
  return new;
end
$fn$;
revoke all on function public.catalog_verification_guard() from public, anon, authenticated;

create trigger items_verification_guard before insert or update on public.items for each row execute function public.catalog_verification_guard();
create trigger rune_verification_guard before insert or update on public.rune for each row execute function public.catalog_verification_guard();
create trigger challenger_spells_verification_guard before insert or update on public.challenger_spells for each row execute function public.catalog_verification_guard();
create trigger enchantments_verification_guard before insert or update on public.enchantments for each row execute function public.catalog_verification_guard();

create policy "admin insert challenger_spells" on public.challenger_spells for insert to authenticated with check ((select public.is_admin()));
create policy "admin update challenger_spells" on public.challenger_spells for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin delete challenger_spells" on public.challenger_spells for delete to authenticated using ((select public.is_admin()));
create policy "admin insert enchantments" on public.enchantments for insert to authenticated with check ((select public.is_admin()));
create policy "admin update enchantments" on public.enchantments for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin delete enchantments" on public.enchantments for delete to authenticated using ((select public.is_admin()));

revoke truncate, references, trigger on public.challenger_spells, public.enchantments, public.enchantment_trees, public.item_build_enchantments from anon, authenticated;
revoke insert, update, delete on public.challenger_spells, public.enchantments, public.enchantment_trees, public.item_build_enchantments from anon;
