# Share link previews (Draft + Tier List)

Problem: `/draft/:shareId` and `/tier-list/:shareId` were rewritten to the SPA's static `index.html`, so crawlers (no JavaScript) always saw the generic site metadata.

## How it works

- `vercel.json` rewrites `/draft/:shareId` and `/tier-list/:shareId` to the edge function `api/share-meta.ts` (`kind=draft|tier-list`). Everyone (people and crawlers) gets the built `index.html`; the function only swaps the `<head>` tags (title, description, canonical, `og:*`, `twitter:*`, `og:image` -> `/api/share-image`). Visitors still boot React exactly as before.
- `/tier-list` (official list) and `/tier-list?view=official&...` are not matched by the rewrite and stay on the SPA with the default metadata.
- Data: one anon-key PostgREST read of `community_drafts` / `community_tier_lists` (public columns only, no author). RLS hides hidden/unpublished rows. Invalid, deleted or unpublished ids keep the default metadata plus `noindex`; the SPA shows its own not-found state.
- `api/share-image.ts` renders a 1200x630 PNG with `@vercel/og`, dispatching on `kind` to `api/_share/draftImage.ts` or `api/_share/tierImage.ts`. Shared helpers (Thai font, icon loading incl. WebP -> PNG proxy, tiles) are in `api/_share/imageKit.ts`. The `v=<version>` query makes a republished item a new image URL.
- Cache: HTML `s-maxage=300`, image `s-maxage=86400` (keyed by version). Failures are cached for seconds only.
- `src/components/RouteMeta.tsx` skips its client-side default meta when the server already wrote the matching `share-meta` marker.

## Adding another kind (e.g. Item Build)

1. `api/_share/resolvers.ts`: add the kind to `ShareKind` / `SHARE_PATH` and a resolver reading its community table (public columns only).
2. Add an image renderer next to `tierImage.ts` and register it in `RENDERERS` in `api/share-image.ts`.
3. `vercel.json`: add `/<path>/:shareId` -> `/api/share-meta?kind=<kind>&id=:shareId` before the catch-all, and extend the regexes in `api/share-meta.ts` (`parseTarget`) and `RouteMeta.tsx`.

## Requirements / limits

- Vercel env `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (already used by `scripts/prerender-meta.mjs`) must also be available at runtime.
- satori cannot draw WebP: hero icons are converted to PNG through the public `wsrv.nl` proxy; if that fails the tile shows the hero's initials.
- The Thai font is fetched from Google Fonts at render time; if that fails the card uses a generic title.
- Tier cards show up to 12/12/10/8/6 heroes for S+/S/A/B/C and "+N" for the rest.
