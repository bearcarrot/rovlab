-- Items the user bought in a saved match, as shown on the scoreboard: 6 slots in the order shown, a NULL element = empty slot.
-- Values are public.items.slug. Nullable: existing rows and manually entered matches have none.
-- Additive only. NOT APPLIED YET: run this BEFORE deploying the app change that inserts my_items, otherwise saving a match
-- that has items fails (the app does not select this column, so reading matches is unaffected either way).
alter table public.match_results add column if not exists my_items text[];

alter table public.match_results
  add constraint match_results_my_items_len check (my_items is null or array_length(my_items, 1) = 6);
