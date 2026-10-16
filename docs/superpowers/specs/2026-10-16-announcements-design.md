# Announcements System — Design Spec (RoV LAB) — v2

Repo: bearcarrot/rovlab · Branch: `feat/announcements` · Path: `docs/superpowers/specs/2026-10-16-announcements-design.md`
Status: **v2, revised after QA review — still a design only.** No migration has been written or applied, no application code
exists, no test has been run, nothing has been deployed.

## 0. What changed in v2 (QA review → spec)

| QA item | Change |
|---|---|
| 1 Scheduled activation/expiry | New §6: schedule RPC + single boundary timer + visibility revalidation, ref-counted listeners, injected-clock tests |
| 2 Grants and RPC security | §3 rewritten with exact grants, column-level `SELECT`, exact RPC signatures, transition matrix, error codes; `is_admin()` inspected (§3.0) |
| 3 Dismissals | §7: no pruning, no delete, RPC-only inserts, explicit sign-in/sign-out reconciliation, honest failure reporting |
| 4 Storage | §8: unique UUID object names, no overwrite, ordering of upload/DB/cleanup, orphan handling, policy-creation risk and fallback |
| 5 Media validation | §5: one validation matrix, one SQL function used by CHECK + RPC, TS mirror, shared test vectors |
| 6 Preview/UI state | §9: `AnnouncementCard` is purely presentational with an explicit `mode`; existing components named |
| 7 Testing | §11: unit tests, SQL integration script (rolled back), REST/Storage verification script, manual checklist |
| Earlier open items | `supabase/schema.sql` is a stale MVP snapshot (no `admin_users`, roles, etc.) → **do not edit it**. `created_by` is no longer readable by clients (§3.2) |

## 1. Goal

Admins publish announcements (text, image, video, link) that all visitors, including anonymous ones, see as a non-intrusive
banner in the app shell. Visitors can hide each dismissible announcement; the choice persists per announcement ID. Visibility
(status and schedule window) is enforced in the database, not only in the UI.

## 2. Decisions (agreed)

| Topic | Decision |
|---|---|
| Data access | Hybrid: RLS `SELECT` for reads; admin RPCs for writes; direct writes revoked |
| Images | Upload to new `announcements` bucket **and** https URL field |
| Direct video | Any https host, allowlisted extensions, click-to-play (`media-src 'self' https:`) |
| Embeds | YouTube (`youtube-nocookie.com`) and Vimeo only, click-to-play facade, URL rebuilt from a parsed ID |
| Dismissal | Per announcement ID; localStorage (device) + server table for signed-in users; never reset by the product |
| Placement | One `<AnnouncementBar/>` in `AppShell`; new "ประกาศ" tab in `AdminHub` |
| Roles | `public.is_admin()` (admin and super_admin). Moderators cannot manage announcements (open question Q2) |
| Dependencies | None added |

## 3. Database — `supabase/migrations/20261016c_announcements.sql` (additive; header says NOT APPLIED until it is)

### 3.0 Inspected existing security primitives (from the repo, not assumed)
- `public.is_admin()` = `exists (select 1 from public.admin_users where user_id = auth.uid() and role in ('admin','super_admin'))`;
  `language sql stable security definer set search_path = public` (migration `20261010_admin_roles_creator_verification.sql`).
  Moderators are **not** admins. It is deliberately executable by `anon` and `authenticated` (`20261006_auth_security_hardening.sql`).
  Its `search_path = public` (not empty) is pre-existing; not changed here.
- Repo RPC convention: `security definer`, `set search_path = ''`, fully qualified names, `raise exception using message = '<Thai>',
  detail = '<CODE>', errcode = 'P0001'`, then `revoke ... from public, anon` and `grant execute ... to authenticated`.
- Existing catalog tables use admin RLS policies written as `(select public.is_admin())`; policy-less tables use `using (false)`.
- Per-table touch trigger convention: `<table>_touch()` with `set search_path = ''` (`20261016_item_builds_updated_at.sql`).
- No migration in the repo creates policies on `storage.objects`; the `avatars` bucket is created by migration and written by an Edge
  Function with the service role (`20260930_profiles_public_and_avatars.sql`).
- Supabase may grant default privileges on new public tables/functions to `anon`/`authenticated`; therefore every new object gets
  explicit `REVOKE` first, then the minimal `GRANT`.

### 3.1 Tables
`public.announcements`
- `id uuid primary key default gen_random_uuid()`
- `title text not null` (1–120 after trim), `content text not null default ''` (≤ 4000)
- `media_type text not null default 'none'` ∈ (`none`,`image`,`video`,`link`)
- `media_url text`, `link_url text`, `link_label text` (≤ 40)
- `status text not null default 'draft'` ∈ (`draft`,`published`,`archived`)
- `priority text not null default 'normal'` ∈ (`normal`,`important`,`urgent`)
- `is_dismissible boolean not null default true`
- `starts_at timestamptz`, `ends_at timestamptz` (stored as UTC instants)
- `created_by uuid references auth.users(id) on delete set null`
- `created_at`, `updated_at timestamptz not null default now()`; `announcements_touch()` before-update trigger sets `updated_at`
- Constraints: `ends_at is null or starts_at is null or ends_at > starts_at`;
  `public.announcement_media_error(media_type, media_url, link_url, link_label) is null` (see §5)
- Index: partial `(priority, coalesce(starts_at, created_at) desc) where status = 'published'`

`public.announcement_dismissals`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `announcement_id uuid not null references public.announcements(id) on delete cascade`
- `created_at timestamptz not null default now()`; `primary key (user_id, announcement_id)`

### 3.2 Privileges and RLS (exact)
```sql
alter table public.announcements enable row level security;
revoke all on table public.announcements from public, anon, authenticated;
-- created_by is intentionally NOT readable by clients (no admin identity leak)
grant select (id, title, content, media_type, media_url, link_url, link_label, status, priority,
              is_dismissible, starts_at, ends_at, created_at, updated_at)
  on public.announcements to anon, authenticated;

create policy "announcements public read active" on public.announcements
  for select to anon, authenticated
  using (status = 'published'
         and (starts_at is null or starts_at <= now())
         and (ends_at   is null or ends_at   >  now()));

create policy "announcements admin read all" on public.announcements
  for select to authenticated
  using ((select public.is_admin()));
-- No INSERT/UPDATE/DELETE policy exists and no INSERT/UPDATE/DELETE privilege is granted to anyone but service_role.

alter table public.announcement_dismissals enable row level security;
revoke all on table public.announcement_dismissals from public, anon, authenticated;
grant select on table public.announcement_dismissals to authenticated;
create policy "dismissals read own" on public.announcement_dismissals
  for select to authenticated using (user_id = (select auth.uid()));
-- Inserts only via dismiss_announcements(); no UPDATE/DELETE (no reset feature; rows go away only by cascade).
```
Consequences that must be reflected in code and tests:
- Clients must always use an **explicit column list** (`select=id,title,...`). `select=*` fails because `created_by` has no grant.
  A static test forbids `select("*")` in `src/services/announcements.ts`.
- The public window is evaluated by the database on every read; no cron job is needed for expiry.
- Admin drafts/archived rows are visible only through the admin policy (`authenticated` and `is_admin()`).

### 3.3 Functions — exact signatures
All: `language plpgsql`, `security definer`, `set search_path = ''`, every object schema-qualified, then
`revoke all on function <signature> from public, anon, authenticated;` followed by the grant listed below.
Errors use `errcode 'P0001'`, a Thai `message`, and the `detail` code shown.

| Function | Grant | Behaviour |
|---|---|---|
| `public.announcement_https_url_ok(p text) returns boolean` (immutable) | none (internal; revoked from all) | https only, ≤ 2048 chars, hostname with ≥ 1 dot, no userinfo, no IP-literal/IPv4 host, no whitespace/`<>"'\` |
| `public.announcement_media_error(p_media_type text, p_media_url text, p_link_url text, p_link_label text) returns text` (immutable) | none (internal) | `null` when valid, else a code from §5 |
| `public.admin_save_announcement(p_id uuid, p_title text, p_content text, p_media_type text, p_media_url text, p_link_url text, p_link_label text, p_priority text, p_is_dismissible boolean, p_starts_at timestamptz, p_ends_at timestamptz) returns uuid` | `authenticated` | `FORBIDDEN` unless `auth.uid() is not null and public.is_admin()`; trims text; validates length/priority/schedule/media; `p_id is null` → insert as `draft` with `created_by = auth.uid()`; else update (never touches `id`, `status`, `created_*`); `NOT_FOUND` if missing |
| `public.admin_set_announcement_status(p_id uuid, p_status text) returns void` | `authenticated` | `FORBIDDEN`/`INVALID_STATUS`/`NOT_FOUND`; `select ... for update`; transitions in §3.4; same status = silent no-op |
| `public.admin_delete_announcement(p_id uuid) returns text` | `authenticated` | `FORBIDDEN`/`NOT_FOUND`; deletes row (dismissals cascade); returns the old `media_url` (may be null) so the client can clean storage |
| `public.get_announcement_schedule() returns table(server_now timestamptz, next_change timestamptz)` (stable) | `anon`, `authenticated` | returns only two timestamps (no content): `next_change` = earliest future instant at which the public set changes (see §6) |
| `public.dismiss_announcements(p_ids uuid[]) returns integer` | `authenticated` | `FORBIDDEN` if `auth.uid()` is null; `TOO_MANY_IDS` if null/empty/> 200; inserts `(auth.uid(), id)` for ids that exist, `on conflict do nothing`; unknown ids are ignored (no existence oracle); returns rows inserted |

Error codes: `FORBIDDEN`, `NOT_FOUND`, `INVALID_TITLE`, `INVALID_CONTENT`, `INVALID_PRIORITY`, `INVALID_SCHEDULE`, `INVALID_STATUS`,
`INVALID_TRANSITION`, `ALREADY_EXPIRED`, `TOO_MANY_IDS`, plus the media codes in §5 (as `detail`).

### 3.4 Status transitions
| From → To | draft | published | archived |
|---|---|---|---|
| **draft** | no-op | allowed (`ALREADY_EXPIRED` if `ends_at <= now()`) | allowed |
| **published** | allowed (unpublish) | no-op | allowed |
| **archived** | allowed (restore as draft) | **`INVALID_TRANSITION`** (restore, review, then publish) | no-op |

### 3.5 Verification that ordinary users cannot use privileged RPCs even by bypassing the UI
`EXECUTE` is granted to `authenticated` (admins are authenticated), so safety comes from the in-body `is_admin()` check, which is
the first statement of every privileged function. Proof is by the SQL integration script and REST script in §11, run as: anon,
ordinary user, moderator, admin. Expected: anon → permission denied for function; ordinary user and moderator → `FORBIDDEN`; admin → success.
Also assert with `has_function_privilege` / `has_table_privilege` that `anon` has no EXECUTE on the admin RPCs and no write
privilege on either table.

## 4. CSP (`vercel.json`)
- `frame-src`: add `https://www.youtube-nocookie.com https://player.vimeo.com` (keep the Google entry).
- Add `media-src 'self' https:`. `img-src https:` and `connect-src` (Supabase host) already cover images and API calls.
- Extend `tests/security/csp.test.ts`: `frame-src` has no wildcard / bare `https:`; existing `script-src` assertions still pass.
- Confirm in a Vercel preview deployment; production CSP is not validated by unit tests.

## 5. Media validation (one rule set; DB constraint, RPC, and UI agree)
Implemented once in SQL (`announcement_media_error`) and mirrored in `media.ts`. A shared fixture
`tests/announcements/media-vectors.json` (input → expected code) is consumed by both the TS unit test and the SQL integration script,
so the two implementations cannot drift silently.

| `media_type` | `media_url` | `link_url` | `link_label` |
|---|---|---|---|
| `none` | must be null → `MEDIA_NOT_ALLOWED` | optional https URL (CTA) | optional; only with a link, else `LABEL_WITHOUT_LINK` |
| `image` | required https URL; own-bucket URLs must end `.jpg/.jpeg/.png/.webp`; external URLs: any https (content type cannot be proven server-side — render falls back to placeholder) | optional (CTA) | as above |
| `video` | required https URL that is **one of**: YouTube (`youtube.com/watch?v=ID`, `youtu.be/ID`, `youtube.com/embed/ID`, `youtube.com/shorts/ID`, `youtube-nocookie.com/embed/ID`; ID = 11 chars `[A-Za-z0-9_-]`), Vimeo (`vimeo.com/<digits>`, `player.vimeo.com/video/<digits>`), or a direct file whose path (before `?`/`#`) ends `.mp4`, `.webm` or `.ogv`; otherwise `VIDEO_UNSUPPORTED` | optional (CTA) | as above |
| `link` | required https destination (the link card) | must be null → `LINK_URL_NOT_ALLOWED` (single destination) | optional card button text |

Other codes: `MEDIA_URL_REQUIRED`, `MEDIA_URL_INVALID` (malformed or non-https), `LABEL_TOO_LONG`.
- Rejected: `javascript:`, `data:`, `http:`, protocol-relative, userinfo (`https://a@b`), IPs/localhost, whitespace, control chars,
  non-punycode IDN hosts, > 2048 chars.
- When the admin switches `media_type` in the form, fields that are not allowed are cleared in the UI; the RPC **rejects** (never silently drops) them.
- Rendering never uses raw input as an iframe `src`: YouTube/Vimeo URLs are parsed to an ID and the embed URL is rebuilt from constants
  (`https://www.youtube-nocookie.com/embed/<ID>?autoplay=1&rel=0`, `https://player.vimeo.com/video/<id>?autoplay=1`), iframe has
  `sandbox="allow-scripts allow-same-origin allow-presentation"`, `referrerpolicy="strict-origin-when-cross-origin"`, `loading="lazy"`,
  and exists only after the viewer clicks the facade. No HTML is ever injected; body text is React text with `whitespace-pre-wrap`.

## 6. Scheduled activation and expiry while the app stays open
Problem: RLS hides rows whose `starts_at` is in the future, so the client cannot know when to look again.
Solution: `get_announcement_schedule()` (§3.3) returns `server_now` and `next_change` — the earliest instant `t > now()` at which a
published row becomes active (`starts_at = t`) or an active row expires (`ends_at = t`). It leaks only a timestamp, no content.

Client store (`store.ts`, a React-free module singleton wired to injected `fetchItems`, `fetchSchedule`, `now`, `setTimeout`,
`clearTimeout`, `random`, and a visibility source so it is unit-testable):
1. **Load**: one fetch of items (explicit columns) + one schedule call, in parallel. Compute `offset = server_now − Date.now()`; all
   visibility checks use `Date.now() + offset` (immune to a wrong device clock).
2. **Arm exactly one timer** for `next_change`: `delay = next_change − server_now + jitter`, jitter ∈ [250 ms, 3000 ms] (never early, so the
   refetch can't land before the boundary; spreads load). `delay` is capped at 2³¹−1 ms; on a capped fire the store re-arms
   (and refetches). `next_change = null` → no timer. Arming always clears the previous timer first (never two timers).
3. **On timer fire**: bump a tick so the already-loaded list is re-filtered locally (an expired card disappears immediately even if the
   network is slow), then refetch (authoritative; picks up newly activated items) and re-arm.
4. **On `visibilitychange` → visible**: re-filter locally immediately; refetch if `now ≥ next_change` or the last fetch is older than 60 s;
   re-arm (background timers may have been throttled or missed).
5. **On `online`**: refetch if the last fetch failed.
6. **After any admin mutation**: `invalidateAnnouncements()` → refetch + re-arm.
7. **No polling.** Documented trade-off: an admin *unpublish/edit* reaches an already-open, continuously visible tab at the next boundary,
   next visibility change, or reload (open question Q5 asks whether to add a slow revalidate).
8. **Lifecycle**: listeners (`visibilitychange`, `online`) and the timer exist only while ≥ 1 component is subscribed (reference-counted via
   `useSyncExternalStore`); last unsubscribe clears the timer and removes listeners; safe under React StrictMode double-mount.
   In-flight fetches are de-duplicated; a generation counter drops stale responses. Route changes never refetch (singleton).

## 7. Dismissals
Rules: keyed by announcement ID only; nothing resets a dismissal; there is no reset feature (to show something again, create a new announcement).
- **No pruning.** IDs are never removed because an announcement is absent from the public response (unpublished, archived, expired, or
  republished later all keep their dismissal). Edits keep the ID. Only a hard cap of 1000 entries (oldest evicted) bounds storage.
- **Local store** `localStorage["rovlab:announcements:dismissed:v1"] = {"v":1,"ids":{"<uuid>":"<iso>"}}`. Every dismissal is written here
  (device-level cache), signed in or not. If `localStorage` throws, the store falls back to an in-memory map: dismissals survive navigation
  but not a reload, and the UI is told (see below). Corrupt JSON is ignored and rewritten.
- **Server** (signed in only): `dismiss_announcements(uuid[])`; reads via `select announcement_id from announcement_dismissals` (own rows).
- **Effective dismissed set** = local ∪ server (when signed in).
- **Sign-in**: fetch server IDs; call `dismiss_announcements` once with any local-only IDs (adopting dismissals made while signed out);
  mirror server IDs into local. **Sign-out**: local set is left intact, so the device keeps hiding what the user hid (dismissals are not
  sensitive; documented trade-off: on a shared device a later account inherits them). Per-user namespaces were rejected as extra complexity.
- **Dismiss flow**: hide immediately (in memory) → write local → if signed in, call the RPC. `dismiss()` returns
  `{ local: "ok"|"failed", server: "ok"|"failed"|"skipped" }`. The UI never shows a success message; it shows a non-blocking notice only
  when something failed ("ซ่อนได้เฉพาะรอบนี้" if local failed and not signed in; "ยังบันทึกบนบัญชีไม่สำเร็จ จะลองใหม่" if only server failed).
  Failed server writes stay in a local `pending` list and are retried on the next load, sign-in, or `online` event.

## 8. Storage lifecycle and upload security
- Bucket `announcements` (public read): `file_size_limit 2097152`, `allowed_mime_types {image/jpeg,image/png,image/webp}`; the migration uses
  `insert … on conflict (id) do update` so an existing bucket cannot keep looser settings. SVG is excluded (script risk).
- Object names are generated client-side as `<crypto.randomUUID()>.<ext>`; the extension comes from the validated MIME type, never from
  the file name. Upload uses `upsert: false`.
- `storage.objects` policies (all require `bucket_id = 'announcements'` and `(select public.is_admin())`, role `authenticated`):
  `INSERT` (with `name ~ '^[0-9a-f-]{36}\.(jpg|png|webp)$'`), `DELETE`, and an admin-only `SELECT` (the Storage API reads the row before
  deleting). **No UPDATE policy** → overwrite is impossible. **No anon SELECT** → bucket listing is closed; public object URLs still
  work because the bucket is public.
- Client checks before upload: MIME allowlist, size ≤ 2 MB, first-bytes sniff (JPEG `FFD8FF`, PNG `89504E47`, WebP `RIFF….WEBP`).
  Server enforcement = bucket limits + policies. Limitation: the Storage API trusts the client-sent content type; this is why SVG/HTML types
  are not allowed at all and objects are served with `nosniff`.
- **Ordering** (never lose the old image before the record is safe):
  1. upload new object → 2. `admin_save_announcement` with the new URL →
  3a. on success: best-effort delete the **old** object (only if its URL is in our bucket and no other announcement row still references it);
  3b. on failure: best-effort delete the **new** object, keep the old record untouched.
  Delete announcement: `admin_delete_announcement` first → then best-effort delete of the returned object (same reference check).
- A failed cleanup leaves an orphan file, never a broken record: the admin sees a warning toast. Orphan review is a documented manual
  step (compare bucket contents with `select media_url from announcements`); no scheduled job.
- Public URL behaviour: draft/archived images are fetchable by anyone who knows the (unguessable UUID) URL; deleting the object makes the
  URL 404; deleted announcements are gone from the API immediately.
- **Risk — unverified**: this repo has never created `storage.objects` policies by migration, and the bucket-creation path was only proven
  for `avatars`. Step 0 of §11 tests exactly this on a dev branch. **Fallback** if policy creation is not permitted: upload/delete through a
  new Edge Function using the service role after verifying the caller with `is_admin()` (same shape as the `avatar` function).

## 9. Frontend

New files (pure modules have **no runtime imports** so `node --experimental-strip-types` can test them; types are `import type`):
- `src/features/announcements/types.ts` — types only
- `media.ts` (§5 mirror, embed parsing) · `visibility.ts` (`isVisible`, `sortAnnouncements`, 3-card cap) · `time.ts` (Bangkok conversion) ·
  `dismissals.ts` (store with injected storage) · `schedule.ts` (timer math + store factory with injected clock/timers)
- `store.ts` (thin glue wiring the factory to services) · `useAnnouncements.ts` · `AnnouncementCard.tsx` · `MediaView.tsx` · `AnnouncementBar.tsx`
- `src/services/announcements.ts` — explicit column list constant, RPC wrappers, upload/cleanup, dismissal calls
- `src/pages/AdminAnnouncements.tsx`
Modified: `src/layouts/AppShell.tsx`, `src/pages/AdminHub.tsx`, `vercel.json`, `tests/security/csp.test.ts`. **Not** modified: `supabase/schema.sql`.

Public behaviour (unchanged from v1): order urgent → important → normal, then newest `starts_at ?? created_at`; at most 3 visible with an expander;
priority styles use existing tokens plus a text label and, for urgent, `role="alert"`; responsive stack/side-by-side; lazy images with placeholder
on error; facade for embeds; `<video controls preload="none">`; links `rel="noopener noreferrer" target="_blank"`.

**Preview mode.** `AnnouncementCard` is purely presentational: props `{ announcement, mode: "live" | "preview", onDismiss? }`. It imports no service, store
or hook (a static test asserts this). In `preview` mode the dismiss controls render but are inert (`aria-disabled`, no handler), a "ตัวอย่าง"
badge is shown, and nothing is written anywhere. Admin preview renders the **unsaved form values** through the same validator; if invalid it
shows the validation message instead of a card. Publish/archive/delete live only in the admin list/form actions, never in the card.

**Admin states** use existing components: `useAsync`, `Skeleton` (loading), `ErrorState` with retry (error), `EmptyState` (empty), `useToast`
(success/error), `Chip` (filters), `ConfirmDialog` from `@/components/ui/confirm-dialog` for delete (and archive), with `busy` blocking double submits.
After each mutation: refetch the admin list and call `invalidateAnnouncements()`.

**Time zone.** Admin `datetime-local` values are interpreted as **Asia/Bangkok (UTC+7, no DST)** regardless of the browser's zone, labelled
"เวลาไทย (UTC+7)", converted with fixed-offset math in `time.ts`, stored as UTC, displayed back in Bangkok time.

## 10. Lifecycle matrix
| State | Public sees it? |
|---|---|
| draft | No (admins only) |
| published, no dates | Yes |
| published, `starts_at` in future | No until the instant passes (client refreshes itself, §6) |
| published, `ends_at` passed | No (query excludes it; open tabs drop it at the boundary) |
| archived | No |
| dismissed (this user/device) | No — even after unpublish/republish or edits |

## 11. Testing and verification (nothing below has been run)

### 11.1 Unit tests (`node:test`, no new dependency)
Run: `node --experimental-strip-types --test tests/announcements/*.test.ts tests/security/csp.test.ts`
and `TZ=America/New_York node --experimental-strip-types --test tests/announcements/time.test.ts` (proves browser-zone independence).
Requires Node ≥ 22.6 (as the existing `tests/pro` header states). Timers are tested with `node:test` `mock.timers` plus injected clocks.
- `schedule.test.ts`: scheduled item activates with no navigation; active item disappears at `ends_at`; exactly one timer after repeated
  arm/invalidate; cleanup on last unsubscribe (timer cleared, listeners removed); 2³¹−1 cap re-arm; jitter bounds; stale response ignored;
  visibility-visible revalidation; skewed device clock (offset applied); `online` retry; `invalidate()` after a mutation refetches and re-arms.
- `visibility.test.ts`: lifecycle matrix, ordering, 3-card cap, dismissal interplay.
- `dismissals.test.ts`: per-ID; new stays visible; edit keeps dismissal; **dismissal persists through unpublish → republish and expire → extend**;
  no pruning when absent from the response; 1000-cap eviction; corrupt JSON; storage-throws fallback; `dismiss()` result honesty
  (server failure never reported as `ok`); sign-in adoption and sign-out retention; `pending` retry.
- `media.test.ts` + `media-vectors.json`: every cell of the §5 matrix, all unsafe protocols and lookalike hosts, ID parsing, rebuilt embed URLs.
- `time.test.ts`: `2026-10-17T00:00` Bangkok = `2026-10-16T17:00:00Z`; `23:59`/`00:00`/`00:30` around midnight; UTC-date-differs cases; round trip.
- `card.test.ts` (static): `AnnouncementCard.tsx` contains no import from services/store/hooks; preview mode has no handlers.
- `service.test.ts` (static): no `select("*")` on announcements; every privileged call goes through an RPC.
- `migration.test.ts` (static text): RLS enabled, `revoke all … from public, anon, authenticated`, column-level grant excludes `created_by`,
  each function signature present with `security definer` + `set search_path = ''` + matching `revoke`/`grant`, bucket and policies present.
  **These prove the text, not the behaviour.**
- `csp.test.ts` extended per §4.

### 11.2 Integration verification (required before merge; documented, run on a Supabase branch/dev project, never production)
0. **Feasibility**: apply the migration on a dev branch; confirm bucket + `storage.objects` policies were created. If not → §8 fallback.
1. `supabase/tests/announcements.sql` (plain SQL in a transaction that ends with `ROLLBACK`; fixtures: ordinary user, moderator, admin, super_admin):
   - as `anon`: can read only `published` rows inside the window (cover draft, archived, future start, past end, boundary equality); `select created_by` → permission denied;
     insert/update/delete → permission denied; `execute` on admin RPCs → permission denied; `get_announcement_schedule()` works and `next_change` is correct
   - as ordinary user and moderator: every admin RPC → `FORBIDDEN`; direct writes denied; cannot see drafts
   - as admin: save/publish/unpublish/archive/restore/delete succeed; every invalid transition and nonexistent id returns its code; `ALREADY_EXPIRED`;
     media-vectors fixture produces identical codes to the TS tests
   - dismissals: `dismiss_announcements` only inserts for `auth.uid()`; duplicates ignored; unknown ids ignored; > 200 ids rejected; users cannot read others' rows or delete rows;
     deleting an announcement cascades
   - `has_function_privilege` / `has_table_privilege` assertions for anon/authenticated
2. `scripts/verify-announcements-api.mjs` (Node fetch; env `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `ADMIN_JWT`, `USER_JWT`; **refuses to run against project ref `mttcdaiwuasnkqlxbeqs`**):
   PostgREST + Storage over real HTTP: anon/user/admin upload (anon 401/403, user 403, admin ok), overwrite attempt fails, wrong MIME and > 2 MB rejected,
   user delete does not remove the object (verify by public GET still 200), admin delete removes it (GET 404), explicit-column select works and `select=*` is denied.
3. Manual checklist: layouts at 375/768/1280 px in dark and light; keyboard and screen-reader pass on dismiss/expander/facade; YouTube, Vimeo, direct
   video, broken image, offline load; open the site, schedule an announcement 2 minutes ahead and watch it appear without navigation, then expire;
   unpublish → visit → dismiss → republish → still hidden; sign-in/sign-out dismissal behaviour; confirm CSP in a Vercel preview.
4. Gate commands before merge: `npm run lint`, `npm run typecheck`, `npm run build`, the unit command above.

## 12. Migration and security assumptions (explicit)
1. `public.admin_users` / `public.is_admin()` exist as inspected in §3.0 and `is_admin()` stays executable by `anon` and `authenticated`.
2. The migration role may insert into `storage.buckets` (proven by `avatars`) **and may create policies on `storage.objects` (NOT proven)**.
3. New public objects may carry default grants to `anon`/`authenticated`; the migration revokes explicitly.
4. PostgREST exposes the `public` schema and honours column-level grants (explicit column lists required).
5. `auth.uid()` is the caller inside `security definer` functions (as the existing admin RPCs rely on).
6. `now()` is the transaction time; policy windows are evaluated per statement/transaction.
7. Time stored as UTC `timestamptz`; display/input in Asia/Bangkok.
8. No existing table is altered; no existing data is touched; `admin_audit_log` is not modified (open question Q6).
9. The migration is applied by the project's usual workflow (dev branch first); nothing is applied by this work.

## 13. Open questions
- **Q1** Can the migration role create `storage.objects` policies on this project? (decides §8 primary path vs Edge Function fallback)
- **Q2** Should moderators manage announcements? Default: no (`is_admin()` only).
- **Q3** `is_admin()` uses `search_path = public` (pre-existing). Leave as is? Default: yes, out of scope.
- **Q4** Node version: `package.json` has no `engines`; tests assume ≥ 22.6. Repo has no CI config at the root, so tests run only manually.
- **Q5** Add a slow (e.g. 10 min) revalidate for long-open visible tabs? Default: no polling.
- **Q6** Record announcement actions in `admin_audit_log`? Needs widening its action `CHECK` (modifies an existing constraint). Default: no.
- **Q7** Add `test:*` scripts to `package.json`? The repo has none today. Default: no, document commands only.
- **Q8** Confirm no concurrent PR (e.g. #237) claims migration name `20261016c_…`.

## 14. Out of scope
Rich text/Markdown, targeting, video upload, analytics, email/push, cross-tab dismissal sync, a dismissal-reset feature, changes to unrelated pages.
