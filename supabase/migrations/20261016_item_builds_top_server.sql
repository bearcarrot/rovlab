-- Provenance for item builds: 'top_server' = copied from the in-game Top 10 Server build of that hero.
-- Additive only. Existing rows stay 'curated'/'heuristic' (none is verified as Top Server, so none is relabelled).
alter table public.item_builds drop constraint item_builds_source_check;
alter table public.item_builds add constraint item_builds_source_check check (source in ('top_server','curated','heuristic'));

alter table public.item_builds
  add column if not exists server_rank smallint check (server_rank between 1 and 10),
  add column if not exists captured_at timestamptz,
  add column if not exists source_note text;

-- A Top Server build must say which of the Top 10 it is and when it was captured (the in-game list changes in real time).
alter table public.item_builds add constraint item_builds_top_server_meta
  check (source <> 'top_server' or (server_rank is not null and captured_at is not null)) not valid;

create or replace function public.item_builds_stamp_captured_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.source = 'top_server' and new.captured_at is null then new.captured_at := now(); end if;
  return new;
end $$;
drop trigger if exists item_builds_stamp_captured_at on public.item_builds;
create trigger item_builds_stamp_captured_at before insert or update on public.item_builds
  for each row execute function public.item_builds_stamp_captured_at();
