# RoV LAB — Hero Videos (YouTube)

Hero Detail shows the latest YouTube guide videos for the hero (`features/heroes/HeroVideos.tsx`).

## How it works

- The browser calls the Supabase Edge Function `hero-videos` with `{ slug }` (`services/heroVideos.ts`). The YouTube API key never reaches the client.
- The function validates the slug against `heroes`, then serves from `hero_video_cache` if the row is younger than the TTL.
- Otherwise it calls YouTube Data API `search.list` (`q = "<hero name> ROV"`, `order=date`, up to 50 results), filters with `supabase/functions/hero-videos/filter.ts`, and upserts the cache row.
- Filter: the title must name the hero (word boundary for Latin names, `heroes.name` or `heroes.name_th`) AND the title/description must mention RoV / AoV / Arena of Valor. Duplicates, upcoming live streams, invalid dates and non-https thumbnails are dropped. Result is sorted by YouTube's `publishedAt` (newest first), max 6.
- UI shows each video's publish date (from YouTube) separately from "ตรวจกับ YouTube ล่าสุด" (`hero_video_cache.fetched_at`).
- Quota/key/network failure: serves the cached row marked `stale` if there is one, else an "unavailable" empty state. After a failure the function waits 30 min before calling YouTube again (per instance).
- Missing `YOUTUBE_API_KEY`: the card shows a neutral "not enabled" message; the page keeps working.

## Setup (manual)

1. Apply `supabase/migrations/20261013_hero_video_cache.sql`.
2. Enable "YouTube Data API v3" in Google Cloud, create an API key (restrict it to that API).
3. Set Edge Function secrets: `YOUTUBE_API_KEY` (required), `YOUTUBE_CACHE_TTL_HOURS` (optional, default 24).
4. Deploy: `supabase functions deploy hero-videos`.

Quota: `search.list` costs 100 units; the default 10,000 units/day is about 100 refreshes per day across all heroes, so keep the TTL at 12h or more.

## Refreshing without redeploying

- Change `YOUTUBE_CACHE_TTL_HOURS` (applies on the next request that finds an older row).
- Force a hero: `delete from public.hero_video_cache where hero_id = '<hero uuid>';` (or delete all rows).

## Tests

`node --experimental-strip-types --test tests/videos/filter.test.ts`
