# Image uploads (Cloudflare R2)

App-managed images live in R2 bucket `rovlab-assets`, public at `https://assets.rovlab.app/{key}`.
Supabase is still used for Auth and Database only. Existing Supabase Storage objects are never touched.

## Flows
| Workflow | Path | Key | Who |
|---|---|---|---|
| Admin catalog icons (heroes, roles, lanes, abilities, items, rune, guides, challenger_spells, enchantments, enchantment_trees) | `POST /api/upload?kind=catalog&folder=<table>&name=<file>` | `hero-icons/<folder>/<ts>-<name>.<ext>` | `is_admin()` |
| Announcement images | `POST /api/upload?kind=announcement` | `announcements/<uuid>.<ext>` | `is_admin()` |
| Announcement image delete | `DELETE /api/upload?url=<public url>` | only `announcements/<uuid>.<ext>` on our domain | `is_admin()` |
| Avatars | Supabase Edge Function `avatar` (moderation + 20 s cooldown) | `avatars/<userId>/<ts>.<ext>` | signed-in user, own folder only |

## Authorization
`/api/upload` forwards the caller's Supabase JWT to `rpc/is_admin` (no service-role key). 401 = bad token, false = 403.
Requests to R2 are signed with a small WebCrypto SigV4 helper (`supabase/functions/_shared/r2.ts`, tested against the official AWS example) so no npm dependency is needed. Auth is checked before the body is read. Keys are built server-side from validated MIME (never client paths); PUT uses `If-None-Match: *`.
Limits: catalog 4 MB (Vercel body cap ~4.5 MB), announcements 2 MB, avatars 500 KB. Types: JPEG/PNG/WebP (+ SVG for catalog only, script-free).
DB order for replacements: upload -> save record -> only then delete the old object (announcements). A failed save removes the new object, never the old one.

## Env vars (server-only, never `VITE_*`)
Vercel (Production + Preview) **and** Supabase function secrets (`supabase secrets set ...`, for `avatar`):
`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME=rovlab-assets`, `R2_PUBLIC_BASE_URL=https://assets.rovlab.app`.
Create an R2 API token scoped to the `rovlab-assets` bucket with Object Read & Write only.
Local: put them in `.env.local` (git-ignored) and run `vercel dev` (plain `vite dev` does not serve `/api/*`).

## Diagnosing failures
- 503 `NOT_CONFIGURED`: an env var above is missing (Vercel function logs list names, never values).
- 401/403: session expired / user is not admin. 503 `AUTH_UNAVAILABLE`: Supabase `rpc/is_admin` unreachable.
- 502 `UPLOAD_FAILED`: see `r2 put failed <status>` in logs. 403 = token lacks write on the bucket; 412 = key already exists; 404 = wrong bucket/account id.
- Image uploaded but not visible: check the custom domain on the bucket, not `r2.dev`.

## Keeping Cloudflare CDN requests low (dashboard checklist)
Objects are already uploaded with `Cache-Control: public, max-age=31536000, immutable` and never overwritten, so they can be cached as long as possible. In the Cloudflare dashboard for `rovlab.app` (not configurable from this repo):
- Caching > Cache Rules: for hostname `assets.rovlab.app` set **Eligible for cache**, Edge TTL = *Use cache-control header if present*, Browser TTL = *Respect origin*.
- Caching > Tiered Cache: enable **Smart Tiered Cache** (fewer origin/R2 reads on a miss).
- Do not add a "Bypass cache" or short Edge/Browser TTL override for this hostname, and do not purge everything on deploy: keys are unique, so there is nothing to purge.
- Check Analytics > Cache: a healthy `assets.rovlab.app` shows a high cache-hit ratio; misses on repeated keys point to a rule overriding the origin headers.

## CORS (needed for share-image export)
The share-image canvas loads icons with `crossOrigin="anonymous"`, so `assets.rovlab.app` must answer with `Access-Control-Allow-Origin` for the site origins (`https://rovlab.vercel.app`, `https://rovlab.app`). Without it share images draw placeholders instead of hero icons. R2 bucket > Settings > CORS policy: allow `GET`/`HEAD` from those origins. Quick check: `curl -sI -H "Origin: https://rovlab.vercel.app" https://assets.rovlab.app/<any key> | grep -i access-control`.
