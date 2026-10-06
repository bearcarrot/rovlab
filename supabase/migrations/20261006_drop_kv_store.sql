-- APPLIED to project mttcdaiwuasnkqlxbeqs on 2026-10-06 as migration `drop_kv_store_b2992ca8`.
-- Legacy Figma Make KV table: empty (0 rows), no views/FKs/functions depend on it,
-- and its only consumer (edge function make-server-b2992ca8) has been retired.
drop table if exists public.kv_store_b2992ca8;
