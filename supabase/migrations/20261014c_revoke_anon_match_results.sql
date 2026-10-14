-- match_results is own-rows-only for signed-in users (RLS). anon never needs write access, so drop the table-level grants too.
revoke insert, update, delete, truncate, references, trigger on public.match_results from anon;
