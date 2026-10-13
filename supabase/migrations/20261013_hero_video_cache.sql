-- Server-side cache of the latest YouTube guide videos per hero (written/read only by the `hero-videos` Edge Function).
-- NOT YET APPLIED to project mttcdaiwuasnkqlxbeqs — apply it before deploying the function.
-- One row per hero keeps YouTube Data API quota low (search.list = 100 units/call, default 10,000 units/day).
-- fetched_at = when WE last asked YouTube; each video's own publishedAt (inside videos) is YouTube's publish time.
-- To force a refresh without redeploying: delete from public.hero_video_cache where hero_id = '<hero uuid>';  (or the whole table)
-- The refresh interval is the Edge Function secret YOUTUBE_CACHE_TTL_HOURS (default 24).

create table if not exists public.hero_video_cache (
  hero_id uuid primary key references public.heroes (id) on delete cascade,
  query text not null,
  videos jsonb not null default '[]'::jsonb,
  fetched_at timestamptz not null default now()
);

alter table public.hero_video_cache enable row level security;
revoke all on public.hero_video_cache from anon, authenticated;
-- no policies on purpose: clients never touch the table; the Edge Function uses the service role
