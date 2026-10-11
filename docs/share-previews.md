# Share link previews (Draft; Tier List next)

Problem: `/draft/:shareId` was rewritten to the SPA's static `index.html`, so crawlers (no JavaScript) always saw the generic site metadata.

## How it works

- `vercel.json` rewrites `/draft/:shareId` to the edge function `api/share-meta.ts`. Everyone (people and crawlers) gets the built `index.html`; the function only swaps the `<head>` tags (title, description, canonical, `og:*`, `twitter:*`, `og:image` -> `/api/share-image`). Visitors still boot React exactly as before.
- Data: one anon-key PostgREST read of `community_drafts` (public columns only, no author). RLS hides hidden/unpublished rows. Invalid, deleted or unpublished ids keep the default metadata plus `noindex`; the SPA shows its own not-found state.
- `api/share-image.ts` renders a 1200x630 PNG with `@vercel/og`. The `v=<community_drafts.version>` query makes a republished Draft a new image URL.
- Cache: HTML `s-maxage=300`, image `s-maxage=86400` (keyed by version). Failures are cached for seconds only.
- `src/components/RouteMeta.tsx` skips its client-side default meta when the server already wrote the matching `share-meta` marker.

## Adding Tier List

1. `api/_share/resolvers.ts`: add `"tier-list"` to `ShareKind` / `SHARE_PATH` and a `resolveTierList()` reading `community_tier_lists` (public columns only).
2. Add a tier image renderer next to `api/_share/draftImage.ts` and dispatch on `kind` in `api/share-image.ts`.
3. `vercel.json`: add `/tier-list/:shareId` -> `/api/share-meta?kind=tier-list&id=:shareId` before the catch-all (leave `/tier-list` and `?view=official` on the SPA).

## Requirements / limits

- Vercel env `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (already used by `scripts/prerender-meta.mjs`) must also be available at runtime.
- satori cannot draw WebP: hero icons that are not PNG/JPEG/GIF show initials tiles.
- The Thai font is fetched from Google Fonts at render time (cached after first render); if that fails the card uses a generic title.
