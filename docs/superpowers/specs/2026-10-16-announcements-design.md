# Announcements System — Design Spec (RoV LAB)

Repo: bearcarrot/rovlab · Target path in repo: `docs/superpowers/specs/2026-10-16-announcements-design.md`
Status: **draft for review** — nothing below has been implemented, applied or committed.

## 1. Goal

Admins publish announcements (text, image, video, link) that visitors, including anonymous ones, see as a
non-intrusive banner in the app shell. Visitors can hide each dismissible announcement; the choice persists per
announcement ID. Visibility rules are enforced in the database, not only in the UI.

## 2. Decisions (agreed in review)

| Topic | Decision |
|---|---|
| Data access | **Hybrid (approach C):** RLS select policy for reads; admin RPCs for writes; direct writes revoked |
| Images | Both: upload to a new `announcements` Storage bucket **and** an https URL field |
| Direct video | Any https host (`media-src 'self' https:`), click-to-play, `preload="none"` |
| Embeds | YouTube (`youtube-nocookie.com`) and Vimeo only, via click-to-play facade |
| Dismissal (signed in) | `announcement_dismissals` table, own-row RLS |
| Dismissal (anonymous) | localStorage set of announcement IDs |
| Placement | One `<AnnouncementBar/>` in `AppShell`, above `<Outlet/>` |
| Admin placement | New "ประกาศ" tab in `AdminHub` |
| Dependencies | None added |

## 3. Database (`supabase/migrations/20261016c_announcements.sql`, additive)

Header comment follows repo convention; it is **not** marked "ALREADY APPLIED" until it really is.

### 3.1 `public.announcements`
- `id uuid pk default gen_random_uuid()`
- `title text not null` (1–120), `content text not null default ''` (≤ 4000)
- `media_type text not null default 'none'` in (`none`,`image`,`video`,`link`)
- `media_url text`, `link_url text`, `link_label text` (≤ 40)
- `status text not null default 'draft'` in (`draft`,`published`,`archived`)
- `priority text not null default 'normal'` in (`normal`,`important`,`urgent`)
- `is_dismissible boolean not null default true`
- `starts_at timestamptz`, `ends_at timestamptz`; check `ends_at is null or starts_at is null or ends_at > starts_at`
- `created_by uuid references public.profiles(id) on delete set null`
- `created_at`, `updated_at timestamptz not null default now()`; `updated_at` maintained by trigger
- URL checks: `media_url`/`link_url` null or `~ '^https://[^\s]+$'` (length ≤ 2048); `media_type = 'none'` ⇒ `media_url is null`;
  `media_type in ('image','video')` ⇒ `media_url is not null`
- Index: partial `(priority, starts_at, created_at desc) where status = 'published'`

### 3.2 RLS and grants on `announcements`
- RLS enabled. `revoke insert, update, delete` from `anon, authenticated`.
- Select policy (public): `status = 'published' and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now())`
- Select policy (admin): `public.is_admin()` — sees drafts and archived.
- The window is evaluated on every read, so no cron job is needed for expiry.

### 3.3 Admin RPCs (`security definer`, `set search_path = ''`, `is_admin()` check, `FORBIDDEN`/`P0001`, Thai messages)
- `admin_save_announcement(p_id uuid, p_title, p_content, p_media_type, p_media_url, p_link_url, p_link_label, p_priority, p_is_dismissible, p_starts_at, p_ends_at) returns uuid` — insert when `p_id` is null, else update (never changes `id`, so dismissals survive edits); sets `created_by = auth.uid()` on insert; validates input
- `admin_set_announcement_status(p_id uuid, p_status text)` — publish / unpublish (→ `draft`) / archive
- `admin_delete_announcement(p_id uuid)`
- All: `revoke execute ... from public, anon; grant execute ... to authenticated`.

### 3.4 `public.announcement_dismissals`
- `user_id uuid references auth.users on delete cascade`, `announcement_id uuid references announcements on delete cascade`,
  `created_at`, **primary key (user_id, announcement_id)** (no duplicates).
- RLS: users select/insert/delete only rows where `user_id = auth.uid()`. No update. Anonymous has no access.

### 3.5 Storage
- Bucket `announcements`: public read, `file_size_limit` 2 MB, mime `image/jpeg|png|webp`.
- `storage.objects` insert (and delete) policy restricted to `bucket_id = 'announcements' and public.is_admin()`.
- No existing admin-write storage policy was found, so this is new. Bucket creation and policy are part of the migration but
  must be applied through the project's normal workflow (see §9).

## 4. CSP (`vercel.json`)
- `frame-src`: add `https://www.youtube-nocookie.com https://player.vimeo.com` (keep the Google entry).
- Add `media-src 'self' https:`.
- Nothing else changes. `img-src https:` already allows images; `connect-src` already allows the Supabase host.
- Extend `tests/security/csp.test.ts`: `frame-src` has no wildcard or bare `https:`; existing `script-src` assertions still pass.

## 5. Frontend

New files
- `src/services/announcements.ts` — list active, admin list, save, set status, delete, dismissals CRUD, image upload (checks type and 2 MB client-side too)
- `src/features/announcements/visibility.ts` — pure `isVisible(a, now, dismissed)` and `sortAnnouncements`
- `src/features/announcements/media.ts` — pure URL validation, YouTube/Vimeo ID parsing, embed URL builder
- `src/features/announcements/dismissals.ts` — localStorage store (try/catch, prune stale IDs)
- `src/features/announcements/useAnnouncements.ts` — one fetch, module cache, `invalidate()` after admin changes, merges server + local dismissals
- `src/features/announcements/AnnouncementCard.tsx` — shared by the public bar and the admin preview
- `src/features/announcements/AnnouncementBar.tsx` — wrapped in `ErrorBoundary`; renders nothing on error
- `src/pages/AdminAnnouncements.tsx` — list, search, filters, form, preview, confirm-delete dialog (existing Radix dialog), toasts

Modified files: `src/layouts/AppShell.tsx` (mount bar), `src/pages/AdminHub.tsx` (new tab), `vercel.json`, `tests/security/csp.test.ts`,
`supabase/schema.sql` (if the repo keeps it in sync with migrations — to be confirmed during planning).

### 5.1 Public behaviour
- Order: urgent → important → normal, then newest `starts_at ?? created_at`. At most 3 cards visible, "ดูเพิ่มเติม" expands the rest.
- Priority styling: normal = `bg-bg-surface`/`border-border`; important = `accent` border and tint; urgent = `loss` colour, icon, `role="alert"`.
  Each level also carries a text label (colour is never the only cue).
- Text rendered as React text with `whitespace-pre-wrap`; no HTML injection anywhere.
- Image: fixed aspect ratio, `loading="lazy"`, placeholder on error. Embed: facade, iframe only after click, URL rebuilt from the parsed ID.
  Direct video: `<video controls preload="none">`. Link button: `rel="noopener noreferrer"`, `target="_blank"`.
- Mobile stacks vertically; media sits beside text from `sm` up.

### 5.2 Dismissal rules
1. Close button and "ซ่อนประกาศนี้" checkbox appear only when `is_dismissible`.
2. Dismiss hides immediately (optimistic), then persists.
3. Keyed per announcement ID; hiding one never hides another.
4. New announcements have new IDs, so they always show.
5. Edits keep the ID, so a dismissal is not reset.
6. Unpublished or expired announcements are excluded server-side, regardless of dismissal.
7. Non-dismissible announcements expose no dismissal control.
8. Signed in: row in `announcement_dismissals`, merged with any local IDs on load. Anonymous: localStorage. No login required.

### 5.3 Admin behaviour
List with search (title/body), status chips, status and priority badges, schedule shown in Asia/Bangkok. Form converts local
`datetime-local` input to UTC. Preview renders `AnnouncementCard`. Success/error via `useToast`; loading/empty/error via
`Skeleton`/`EmptyState`/`ErrorState`. After every mutation, `invalidate()` the public cache.

## 6. Lifecycle matrix

| State | Public sees it? |
|---|---|
| draft | No (admins only) |
| published, no dates | Yes |
| published, `starts_at` in future | No until start |
| published, `ends_at` in past | No |
| archived | No |
| dismissed (by this user/device) | No |

## 7. Error handling
Network or RLS error → bar renders nothing and logs quietly; rest of app unaffected. Storage or localStorage failure → falls back to
in-memory state. Broken media → placeholder. RPC errors surface their Thai message in a toast.

## 8. Testing (`node:test`, matching `tests/*`)
- `tests/announcements/visibility.test.ts` — lifecycle matrix, ordering, 3-card cap, dismissal interplay
- `tests/announcements/media.test.ts` — allowed hosts, https only, rejects `javascript:`/`data:`/lookalike hosts
- `tests/announcements/dismissals.test.ts` — per-ID, new stays visible, edit keeps dismissal, pruning, storage failure
- `tests/announcements/migration.test.ts` — static assertions on the SQL text (RLS on, writes revoked, constraints, policies)
- `tests/security/csp.test.ts` — extended as in §4
- How the existing tests are run (no `test` script in `package.json`) must be confirmed during planning; no test dependency is added.

## 9. Manual steps and what is not verified
Not executed by this work: migration, RLS/RPC behaviour, bucket creation, lint, typecheck, build, tests, responsive UI.
To do through the project's usual workflow:
1. Review and apply the migration on a Supabase branch or dev project first, then production.
2. Run a SQL check script as `anon`, a non-admin user and an admin (reads, writes, dismissals, storage).
3. Run `npm run lint`, `npm run typecheck`, `npm run build` and the test files.
4. Check layouts at 375 / 768 / 1280 px in dark and light themes, plus a YouTube embed, a direct video and a broken image URL.
5. Confirm the new CSP in a Vercel preview deployment.

## 10. Out of scope
Rich text/Markdown, per-user targeting, video upload, analytics, notification/email delivery, changes to unrelated pages.
