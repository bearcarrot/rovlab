# R2 data snapshots (heroes pilot)

Public game data can be served as static JSON from R2 (`assets.rovlab.app`) instead of Supabase. Supabase stays the source of truth;
an admin publishes snapshots. Off by default and fully reversible. Image uploads and their cache policy (`docs/r2-uploads.md`) are untouched.

```
Supabase (anon read, approved columns) -> /api/publish-data (admin only) -> R2 data/ -> Cloudflare CDN -> browser
```

## Objects (bucket `rovlab-assets`)
| Key | Cache-Control | Written |
|---|---|---|
| `data/v/<dataset>/<sha256-12>.json` | `public, max-age=31536000, immutable` | once per distinct content (`If-None-Match: *`) |
| `data/manifest.json` | `public, max-age=60, stale-while-revalidate=300` | replaced last, conditional on the ETag that was read |
| `data/manifest-history/<generation>.json` | `public, max-age=300` | copy of the manifest before each replacement |

Manifest: `{ schema: 1, generation, generatedAt, datasets: { heroes: { key, count, bytes, schema } } }`.
Data file: `{ schema: 1, rows: [ ... ] }`, rows use the DB column names in a fixed order.

| Dataset | Columns | Replaces |
|---|---|---|
| `heroes` | id, slug, name, name_th, role, lane, roles, lanes, difficulty, icon_url, phase (`order=name.asc`) | `loadHeroes` list query |
| `hero-text` | id, slug, description, strengths, weaknesses | `heroes?slug=eq.<slug>` on Hero Detail |

Stats, tier lists, abilities, counters and everything user-specific still come from Supabase.

## Why it cannot show half-published data
Data files are content-addressed and never overwritten, so uploading them changes nothing visitors read. Only the manifest write does, and it
happens after every file succeeded. A failed upload, a refused count check or a lost race leaves the old manifest in place.
The publisher refuses an empty or truncated read (fewer than 50 rows, or under half the published count unless `force`).

## Client behaviour (`src/lib/snapshots.ts`, `snapshotCore.ts`)
Only when `VITE_R2_SNAPSHOTS=1`, the visitor is not an admin, and the manifest lists the dataset. It validates the schema, the key shape
(must be `data/v/<dataset>/<hash>.json`), the row count against the manifest and every row's `id`/`slug`. Any problem (network, CORS, 404, mismatch)
returns null and the original Supabase query runs; after a failure snapshots are skipped for 60 s. A hero that is missing from the snapshot
(new, not yet published) is looked up in Supabase, never reported as not found. The manifest is cached in memory for 5 min, data bodies in
localStorage by hash (`snap:data:`), so an unchanged dataset is never downloaded twice.

## Operating it
1. Vercel env: nothing new on the server (`R2_*` already exist). Client flag `VITE_R2_SNAPSHOTS=1` (Preview first).
2. Admin > Publish card (`PublishDataCard`): publish `heroes` + `hero-text`; the card lists what is live.
3. Check: `SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/verify-snapshot.mjs` (read-only, exits 1 on any difference).
4. After editing heroes in the admin, publish again. Visitors see it within about 1 to 6 minutes (manifest cache), admins always see live data.

## Rollback
- Dataset misbehaves: `disable` it (card button, or `POST /api/publish-data {"action":"disable","dataset":"heroes"}`). Clients fall back to Supabase after the manifest refreshes.
- Bad publish: `{"action":"rollback","generation":N}` restores `manifest-history/N.json` as a new generation (old data files are kept).
- Everything: unset `VITE_R2_SNAPSHOTS` and redeploy, or revert the PR. The Supabase code path was never removed.

## Checklist before enabling in production
- Cloudflare cache rule for `assets.rovlab.app` caches `.json` and respects per-object `Cache-Control` (see `docs/r2-uploads.md`); responses are compressed.
- R2 CORS allows `GET` from every origin that should use snapshots (production origins are already listed; previews/localhost fall back to Supabase otherwise).
- R2 honours `If-Match` / `If-None-Match` on PutObject (first publish on a preview environment; if not, publishing still works but is not race-safe).
- The early prefetch in `index.html` still requests the hero list through `/api/sb`; changing it needs the CSP script hash in `vercel.json` updated at the same time, so it is a separate step.
