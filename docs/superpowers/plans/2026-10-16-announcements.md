# Announcements System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admins publish scheduled, dismissible announcements (text/image/video/link) that every visitor sees as one banner in the app shell, with visibility enforced by the database.

**Architecture:** One additive migration (table + RLS + column grants + admin RPCs + schedule RPC + dismissals + storage bucket). Client logic lives in dependency-free pure modules (testable with `node --experimental-strip-types`), a thin store/hook/React layer on top, and an admin tab in `AdminHub`.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind, Radix, Supabase (Postgres/RLS/Storage), `node:test`. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-16-announcements-design.md` (v2, approved). Section numbers below (§) refer to it; where a task says "per §3.2" the SQL there is used verbatim.

## Global Constraints

- Branch `feat/announcements`; migration file `supabase/migrations/20261016c_announcements.sql`; header says NOT APPLIED. **Never apply it, never touch project ref `mttcdaiwuasnkqlxbeqs`, never edit `supabase/schema.sql`.**
- No new dependency. No new UI framework; reuse `ConfirmDialog` (`@/components/ui/confirm-dialog`), `useToast`, `useAsync`, `Skeleton`, `ErrorState`, `EmptyState`, `Chip`.
- Unit tests: `node --experimental-strip-types --test tests/announcements/<file>.test.ts` (Node ≥ 22.6). Pure modules under `src/features/announcements/` have **no runtime imports** (only `import type`), no enums/namespaces/parameter properties, so strip-types can run them.
- Clients always select an explicit column list; `created_by` is never readable by clients; never `select("*")` on announcements.
- Admin = `public.is_admin()` (admin, super_admin); moderators excluded. Every privileged function: `security definer`, `set search_path = ''`, qualified names, `FORBIDDEN` first, `errcode 'P0001'`, Thai message, `detail` = code, then `revoke all … from public, anon, authenticated` + the grant in §3.3.
- Times stored UTC; admin inputs are Asia/Bangkok (UTC+7, no DST) regardless of browser zone.
- Constants: 3 visible cards; dismissal cap 1000; stale 60 000 ms; jitter 250–3000 ms; timer cap 2 147 483 647 ms; upload ≤ 2 097 152 bytes; MIME `image/jpeg|png|webp`; title 1–120, content ≤ 4000, label ≤ 40, URL ≤ 2048, dismiss batch ≤ 200 (code points, not UTF-16 units).
- Error codes: `FORBIDDEN NOT_FOUND INVALID_TITLE INVALID_CONTENT INVALID_PRIORITY INVALID_SCHEDULE INVALID_STATUS INVALID_TRANSITION ALREADY_EXPIRED TOO_MANY_IDS MEDIA_NOT_ALLOWED MEDIA_URL_REQUIRED MEDIA_URL_INVALID VIDEO_UNSUPPORTED LINK_URL_NOT_ALLOWED LABEL_WITHOUT_LINK LABEL_TOO_LONG`. Media check order: type-specific presence → URL validity → video support → `link_url` rule → label rules.
- Nothing is reported as passing unless it was actually run; steps marked **[HUMAN]** need a Supabase dev branch or browser and are not run by the agent.

## Review Focus

1. Title/label length counted in UTF-16 units vs Postgres `char_length` (Thai combining marks, emoji) → UI rejects what the DB accepts. Pinned in Task 4.
2. URLs/labels pasted with leading/trailing whitespace or newlines → must be trimmed before validation. Pinned in Tasks 2 and 4.
3. Two dismissals in quick succession or from another tab → read-modify-write must not clobber the other write. Pinned in Task 5.
4. Announcement text containing `<script>` / HTML → shown as text; no `dangerouslySetInnerHTML` anywhere in the feature. Pinned in Task 12 (static test).
5. Loading/error/zero-announcement states → the bar renders nothing (no empty box, no layout shift) and never throws into the page. Pinned in Task 13 (error boundary + manual step 4; React rendering is not unit-testable under strip-types).

---

### Task 1: Types and Bangkok time helpers

**Files:**
- Create: `src/features/announcements/types.ts`, `src/features/announcements/time.ts`
- Test: `tests/announcements/time.test.ts`

**Interfaces:**
- Produces (`types.ts`): `Announcement = { id: string; title: string; content: string; media_type: "none"|"image"|"video"|"link"; media_url: string|null; link_url: string|null; link_label: string|null; status: "draft"|"published"|"archived"; priority: "normal"|"important"|"urgent"; is_dismissible: boolean; starts_at: string|null; ends_at: string|null; created_at: string; updated_at: string }`; `MediaErrorCode` (union of the media codes in Global Constraints); `Priority`, `MediaType`, `Status`.
- Produces (`time.ts`): `bangkokLocalToIso(local: string): string` (`"YYYY-MM-DDTHH:mm"` → UTC ISO with `.000Z`); `isoToBangkokLocal(iso: string): string`.

- [ ] **Step 1: Write the failing test** — `bangkokLocalToIso("2026-10-17T00:00") === "2026-10-16T17:00:00.000Z"`; `"2026-10-16T23:59"` → `"2026-10-16T16:59:00.000Z"`; `"2026-10-17T00:30"` → `"2026-10-16T17:30:00.000Z"`; `isoToBangkokLocal("2026-10-16T17:00:00.000Z") === "2026-10-17T00:00"`; round trip over a list of 6 values; malformed input (`""`, `"2026-13-01T00:00"`) throws.
- [ ] **Step 2: Run** `node --experimental-strip-types --test tests/announcements/time.test.ts` — Expected: FAIL (module not found).
- [ ] **Step 3: Implement** both functions in `time.ts` with fixed +7 h arithmetic on `Date.UTC` (no `Intl`, no local-zone getters); `types.ts` is types only.
- [ ] **Step 4: Run** the default and `TZ=America/New_York` variants — Expected: PASS both.
- [ ] **Step 5: Commit** `feat(announcements): types and Bangkok time helpers`

### Task 2: Media validation and parsing

**Files:**
- Create: `src/features/announcements/media.ts`, `tests/announcements/media-vectors.json`
- Test: `tests/announcements/media.test.ts`

**Interfaces:**
- Consumes: `MediaErrorCode`, `MediaType` (Task 1, `import type`).
- Produces: `mediaError(i: { mediaType: MediaType; mediaUrl: string|null; linkUrl: string|null; linkLabel: string|null }): MediaErrorCode | null` (trims inputs first; implements §5 and the check order in Global Constraints); `parseVideo(url: string): { kind: "youtube"|"vimeo"; id: string } | { kind: "direct"; url: string } | null`; `embedUrl(v: { kind: "youtube"|"vimeo"; id: string }): string` (constants from §5, `autoplay=1`); `isOwnBucketUrl(url: string): boolean` (path starts `/storage/v1/object/public/announcements/`).

- [ ] **Step 1: Write `media-vectors.json`** — array of `{ name, mediaType, mediaUrl, linkUrl, linkLabel, expected }` (the SQL integration script in Task 8 reads the same file). Must include: `none`+null → `null`; `none`+url → `MEDIA_NOT_ALLOWED`; image `https://example.com/a.png` → `null`; `http://…` / `javascript:alert(1)` / `data:text/html,x` / `//example.com/a.png` / `https://user@example.com/a.png` / `https://127.0.0.1/a.png` / `https://localhost/a.png` / `https://exa mple.com/a.png` → `MEDIA_URL_INVALID`; own-bucket URL ending `.gif` → `MEDIA_URL_INVALID`, ending `.webp` → `null`; image with null url → `MEDIA_URL_REQUIRED`; video `https://www.youtube.com/watch?v=dQw4w9WgXcQ`, `https://youtu.be/dQw4w9WgXcQ`, `https://vimeo.com/76979871`, `https://cdn.example.com/v.mp4?sig=abc` → `null`; `watch?v=short`, `https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ`, `https://cdn.example.com/v.mov`, `…/v.mp4.exe` → `VIDEO_UNSUPPORTED`; link with `link_url` set → `LINK_URL_NOT_ALLOWED`; `none` with label and no link → `LABEL_WITHOUT_LINK`; 41-character label → `LABEL_TOO_LONG`; URL padded with `"  https://example.com/a.png\n"` → `null`.
- [ ] **Step 2: Write the failing test** — loop over vectors asserting `mediaError(...) === expected`; assert `parseVideo` ids; assert `embedUrl({kind:"youtube",id:"dQw4w9WgXcQ"}) === "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0"` and Vimeo `https://player.vimeo.com/video/76979871?autoplay=1`; assert `parseVideo` returns `null` for non-video hosts.
- [ ] **Step 3: Run** `node --experimental-strip-types --test tests/announcements/media.test.ts` — Expected: FAIL.
- [ ] **Step 4: Implement** per signatures; keep regexes as named constants with a comment pointing to the SQL function they mirror.
- [ ] **Step 5: Run** — Expected: PASS.
- [ ] **Step 6: Commit** `feat(announcements): media validation with shared vectors`

### Task 3: Visibility and ordering

**Files:**
- Create: `src/features/announcements/visibility.ts`
- Test: `tests/announcements/visibility.test.ts`

**Interfaces:**
- Consumes: `Announcement` (Task 1).
- Produces: `isVisible(a: Announcement, nowMs: number, dismissed: ReadonlySet<string>): boolean`; `sortAnnouncements(list: Announcement[]): Announcement[]` (urgent → important → normal, then `starts_at ?? created_at` descending, then `id` ascending); `selectVisible(list: Announcement[], nowMs: number, dismissed: ReadonlySet<string>): { shown: Announcement[]; more: Announcement[] }` (`shown` ≤ 3).

- [ ] **Step 1: Write the failing test** — lifecycle matrix of §10 (draft, archived, future `starts_at`, past `ends_at`, `ends_at === now` hidden, `starts_at === now` shown, null dates shown); dismissed id hidden while a new id stays; dismissal still applies after `status` toggles draft→published (same id); `is_dismissible` has no effect inside `isVisible` (the dismissed set alone decides; the UI simply never offers dismissal for non-dismissible items); ordering with equal priorities and equal timestamps is deterministic; 5 visible items → `shown.length === 3`, `more.length === 2`.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement** the three functions; `selectVisible` = filter → sort → split.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat(announcements): visibility and ordering`

### Task 4: Admin form logic

**Files:**
- Create: `src/features/announcements/form.ts`
- Test: `tests/announcements/form.test.ts`

**Interfaces:**
- Consumes (injected, not imported): `mediaError` (Task 2) and `bangkokLocalToIso` (Task 1) via a `deps` argument, so `form.ts` keeps zero runtime imports.
- Produces: `FormValues = { title; content; mediaType; mediaUrl; linkUrl; linkLabel; priority; isDismissible; startsLocal; endsLocal }` (strings except booleans); `SaveInput` = the RPC parameters of `admin_save_announcement` without `p_id` (camelCase, ISO strings or null); `codePointLength(s: string): number`; `switchMediaType(v: FormValues, next: MediaType): FormValues` (clears fields not allowed for `next`); `validateForm(v: FormValues, deps: { mediaError: …; bangkokLocalToIso: (s: string) => string }): { ok: true; input: SaveInput } | { ok: false; errors: Partial<Record<keyof FormValues, string>> }`.

- [ ] **Step 1: Write the failing test** — `codePointLength("😀")===1`, Thai string with combining marks counted by code points (equals `Array.from(s).length`); a 120-code-point title containing emoji is valid, 121 invalid; title padded with spaces/newlines is trimmed; `switchMediaType` image→none clears `mediaUrl`, image→link keeps `mediaUrl` and clears `linkUrl`; end ≤ start → `errors.endsLocal`; empty start/end → `null` in input; Bangkok conversion applied (`"2026-10-17T00:00"` → `"2026-10-16T17:00:00.000Z"`); media errors surface under `mediaUrl`/`linkUrl`/`linkLabel`.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement** per signatures; Thai error strings live in one `ERROR_TH: Record<string,string>` map keyed by the codes in Global Constraints (also used by Tasks 11–12).
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat(announcements): form validation and media-type switching`

### Task 5: Dismissal store and reconciliation

**Files:**
- Create: `src/features/announcements/dismissals.ts`
- Test: `tests/announcements/dismissals.test.ts`

**Interfaces:**
- Produces: `StorageLike = { getItem(k: string): string|null; setItem(k: string, v: string): void }`; `createDismissalStore(storage: StorageLike|null, now?: () => number): DismissalStore` with `ids(): Set<string>`, `has(id: string): boolean`, `add(id: string): "ok"|"failed"`, `mirror(ids: Iterable<string>): void`, `pending(): string[]`, `addPending(id: string): void`, `clearPending(ids: string[]): void`; `dismissAnnouncement(id: string, deps: { store: DismissalStore; signedIn: boolean; push: (ids: string[]) => Promise<void> }): Promise<{ local: "ok"|"failed"; server: "ok"|"failed"|"skipped" }>`; `syncOnSignIn(deps: { store: DismissalStore; fetchServerIds: () => Promise<string[]>; push: (ids: string[]) => Promise<void> }): Promise<Set<string>>`.
- Storage key `rovlab:announcements:dismissed:v1`, shape `{"v":1,"ids":{"<id>":"<iso>"},"pending":["<id>"]}`; `storage === null` or throwing → in-memory map (`add` returns `"failed"` for persistence but still hides in memory).

- [ ] **Step 1: Write the failing test** — per-id add/has; dismissal persists when the id is absent from any list (no pruning); cap: adding 1001 ids evicts only the oldest; corrupt JSON is ignored and rewritten; throwing storage → `add` returns `"failed"` yet `has(id)` is true; **two stores on one fake storage**: `a.add("x")` then `b.add("y")` → both persist (re-read before write); `dismissAnnouncement` signed-out → `{local:"ok",server:"skipped"}`; signed-in push rejects → `{local:"ok",server:"failed"}` and id appears in `pending()`; local failure + signed-out → `{local:"failed",server:"skipped"}`; `syncOnSignIn` pushes only local-only + pending ids in chunks ≤ 200, mirrors server ids, returns the union, and leaves local ids intact (sign-out retention = no clearing API exists).
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement** per signatures; every `add` re-reads storage before writing.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat(announcements): dismissal store and sign-in reconciliation`

### Task 6: Schedule-driven store

**Files:**
- Create: `src/features/announcements/schedule.ts`
- Test: `tests/announcements/schedule.test.ts`

**Interfaces:**
- Consumes: `Announcement` (Task 1).
- Produces: constants `MAX_TIMER_MS`, `STALE_MS`, `JITTER_MIN_MS`, `JITTER_MAX_MS`; `StoreDeps = { fetchItems(): Promise<Announcement[]>; fetchSchedule(): Promise<{ serverNow: string; nextChange: string|null }>; now(): number; setTimer(fn: () => void, ms: number): unknown; clearTimer(h: unknown): void; random(): number; onVisible(cb: () => void): () => void; onOnline(cb: () => void): () => void }`; `Snapshot = { status: "idle"|"loading"|"ready"|"error"; items: Announcement[]; nowMs: number }`; `createAnnouncementStore(deps: StoreDeps): { subscribe(l: () => void): () => void; getSnapshot(): Snapshot; invalidate(): Promise<void> }` (snapshot object identity changes only when content changes).

- [ ] **Step 1: Write the failing test** with a fake clock/timer queue and manual promises — activation: item hidden by server, `nextChange = T`; advancing the fake clock to `T + jitter` fires the timer, refetch returns the item, snapshot contains it with no navigation; expiry: loaded item with `ends_at = T` disappears from `nowMs` filtering at the tick before the refetch resolves; exactly **one** pending timer after `invalidate()` ×3; delay uses `serverNow` offset (device clock +1 h skew still fires at the right server instant); jitter always in [250, 3000] given `random()` 0 and 0.999; `nextChange` beyond 2 147 483 647 ms → timer set to the cap, then re-armed on fire; `nextChange === null` → no timer; last unsubscribe clears timer and calls both unsub functions, first subscribe registers them once even when `subscribe` is called twice; `onVisible` refetches when `now ≥ nextChange` or last fetch older than 60 000 ms, otherwise only re-filters; `onOnline` refetches only after a failed fetch; a slow first response arriving after a second fetch is ignored; fetch failure → `status:"error"` without throwing and keeps previous items.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement** per §6 steps 1–8 (single timer handle, in-flight de-dup, generation counter, ref-counted listeners).
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat(announcements): schedule-driven store with single timer`

### Task 7: Migration — tables, validation functions, RLS, grants

**Files:**
- Create: `supabase/migrations/20261016c_announcements.sql`
- Test: `tests/announcements/migration.test.ts`

**Interfaces:**
- Produces (SQL): tables `public.announcements`, `public.announcement_dismissals` (§3.1); functions `public.announcement_https_url_ok(p text) returns boolean`, `public.announcement_media_error(p_media_type text, p_media_url text, p_link_url text, p_link_label text) returns text`, trigger function `public.announcements_touch()`; RLS, policies and grants exactly as §3.2.

- [ ] **Step 1: Write the failing static test** reading the file: `enable row level security` for both tables; `revoke all on table public.announcements from public, anon, authenticated`; the column-level `grant select (…)` list does **not** contain `created_by`; both policies present with `to anon, authenticated` / `to authenticated`; `(select public.is_admin())`; CHECK uses `announcement_media_error(…) is null`; every function has `set search_path = ''`; header contains `NOT APPLIED`; no `drop table`, `alter table public.<existing>` or `delete from`.
- [ ] **Step 2: Run** `node --experimental-strip-types --test tests/announcements/migration.test.ts` — Expected: FAIL.
- [ ] **Step 3: Write the migration sections** (tables + constraints + index + trigger + the two helper functions + RLS/grants). `announcement_media_error` must implement the same rules, codes and order as Task 2; the regexes are those named in `media.ts`.
- [ ] **Step 4: Run** — Expected: PASS (text only).
- [ ] **Step 5: Commit** `feat(db): announcements tables, validation and RLS (not applied)`

### Task 8: Migration — RPCs, dismissals, schedule; SQL integration script

**Files:**
- Modify: `supabase/migrations/20261016c_announcements.sql`, `tests/announcements/migration.test.ts`
- Create: `supabase/tests/announcements.sql`

**Interfaces:**
- Produces (SQL, signatures verbatim from §3.3): `admin_save_announcement`, `admin_set_announcement_status`, `admin_delete_announcement`, `get_announcement_schedule`, `dismiss_announcements`; transition matrix §3.4.

- [ ] **Step 1: Extend the static test** — each signature string from §3.3 appears with `security definer`, `set search_path = ''`, `revoke all on function <signature> from public, anon, authenticated`, and the exact grant (`authenticated`; `anon, authenticated` only for `get_announcement_schedule`); `is_admin()` check appears before any other statement in the three admin RPCs; `archived`→`published` raises `INVALID_TRANSITION`; `ALREADY_EXPIRED` present.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement** the five functions. `next_change` = `min` of future `starts_at` of published rows and future `ends_at` of currently-active published rows; return only timestamps.
- [ ] **Step 4: Run** the static test — Expected: PASS.
- [ ] **Step 5: Write `supabase/tests/announcements.sql`** — one transaction ending in `ROLLBACK`, fixtures for ordinary user, moderator, admin; `set local role` + `request.jwt.claims` per case; asserts for every bullet of §11.2 item 1 (anon window reads incl. boundary equality, `created_by` denied, direct writes denied, RPC execute denied for anon, `FORBIDDEN` for user/moderator, every transition and error code, media-vectors parity, dismissal rules, cascade, privilege checks).
- [ ] **Step 6: [HUMAN] Run the script on a Supabase dev branch** after applying the migration there. Expected: script finishes with no failed assertion. The agent does not run this.
- [ ] **Step 7: Commit** `feat(db): announcement RPCs, dismissals, schedule + SQL integration script`

### Task 9: Migration — storage bucket and policies

**Files:**
- Modify: `supabase/migrations/20261016c_announcements.sql`, `tests/announcements/migration.test.ts`
- Create: `scripts/verify-announcements-api.mjs`

**Interfaces:**
- Produces (SQL): bucket `announcements` (public, 2097152, three MIME types, `on conflict (id) do update`); `storage.objects` policies per §8: admin INSERT (UUID-name regex), admin DELETE, admin SELECT; no UPDATE, no anon SELECT.

- [ ] **Step 1: Extend the static test** — bucket row values; three policies exist and each contains `bucket_id = 'announcements'` and `(select public.is_admin())`; no `for update` policy on `storage.objects`.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement** the SQL.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Write `scripts/verify-announcements-api.mjs`** (Node fetch; env `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `ADMIN_JWT`, `USER_JWT`; exits non-zero if `SUPABASE_URL` contains `mttcdaiwuasnkqlxbeqs`) covering §11.2 item 2.
- [ ] **Step 6: [HUMAN] Feasibility gate (Q1)**: apply the migration on a dev branch; confirm the bucket and the three `storage.objects` policies exist. **If policy creation is refused, STOP and ask the owner** — the fallback is an Edge Function (spec §8) and is a new plan, not an improvisation. Then run the script; Expected: all checks print PASS.
- [ ] **Step 7: Commit** `feat(db): announcements storage bucket and policies + API verification script`

### Task 10: CSP

**Files:**
- Modify: `vercel.json`, `tests/security/csp.test.ts`

**Interfaces:**
- Produces: header with `frame-src` containing `https://www.youtube-nocookie.com https://player.vimeo.com` plus the existing Google entry, and `media-src 'self' https:`; nothing else changed.

- [ ] **Step 1: Extend `csp.test.ts` first** (read how it parses the header) — `frame-src` includes both hosts and the Google entry, has no `*` or bare `https:`; `media-src` equals `'self' https:`; existing `script-src` assertions unchanged.
- [ ] **Step 2: Run** `node --experimental-strip-types --test tests/security/csp.test.ts` — Expected: FAIL on the new assertions only.
- [ ] **Step 3: Edit `vercel.json`**.
- [ ] **Step 4: Run** — Expected: PASS (all tests in the file).
- [ ] **Step 5: Commit** `feat(security): CSP frame-src/media-src for announcement media`

### Task 11: Service layer

**Files:**
- Create: `src/services/announcements.ts`
- Test: `tests/announcements/service.test.ts` (static)

**Interfaces:**
- Consumes: Task 1 types; Task 2 `isOwnBucketUrl` (via the caller, not imported here).
- Produces: `ANNOUNCEMENT_COLUMNS` (the 14 granted columns, no `created_by`); `fetchActiveAnnouncements(): Promise<Announcement[]>`; `fetchSchedule(): Promise<{ serverNow: string; nextChange: string|null }>`; `fetchMyDismissals(): Promise<string[]>`; `pushDismissals(ids: string[]): Promise<void>`; admin: `listAllAnnouncements(): Promise<Announcement[]>`, `saveAnnouncement(id: string|null, input: SaveInput): Promise<string>`, `setAnnouncementStatus(id: string, status: Status): Promise<void>`, `deleteAnnouncement(id: string): Promise<string|null>`, `uploadAnnouncementImage(file: File): Promise<string>` (type/size/magic-byte checks, `<randomUUID>.<ext>`, `upsert:false`, returns public URL), `removeAnnouncementImage(url: string): Promise<boolean>`, `countMediaReferences(url: string, excludeId: string|null): Promise<number>`. Errors surface `detail` code → Thai via `ERROR_TH` (Task 4).

- [ ] **Step 1: Read the service used by `src/pages/AdminContact.tsx`** and follow its client import, error handling and naming.
- [ ] **Step 2: Write the failing static test** — file contains no `select("*")` / `select('*')`; every write goes through `.rpc(` (no `.insert(`/`.update(`/`.delete(` on `announcements`); `ANNOUNCEMENT_COLUMNS` excludes `created_by`; upload uses `upsert: false`.
- [ ] **Step 3: Run** — Expected: FAIL.
- [ ] **Step 4: Implement** per signatures; cleanup ordering of §8 is enforced by the page (Task 14), not here.
- [ ] **Step 5: Run** the test, then `npm run typecheck` — Expected: PASS / exit 0.
- [ ] **Step 6: Commit** `feat(announcements): service layer`

### Task 12: Presentational card and media view

**Files:**
- Create: `src/features/announcements/AnnouncementCard.tsx`, `src/features/announcements/MediaView.tsx`
- Test: `tests/announcements/card.test.ts` (static)

**Interfaces:**
- Consumes: `Announcement`; `parseVideo`, `embedUrl` (Task 2).
- Produces: `AnnouncementCard(props: { announcement: Announcement; mode: "live"|"preview"; onDismiss?: (id: string) => void })`; `MediaView(props: { announcement: Announcement })` (image with placeholder on error; YouTube/Vimeo click-to-play facade → sandboxed iframe from `embedUrl`; direct `<video controls preload="none">`; link card with `rel="noopener noreferrer" target="_blank"`).

- [ ] **Step 1: Write the failing static test** — neither file imports from `@/services`, `store`, or any hook; neither contains `dangerouslySetInnerHTML`; `AnnouncementCard.tsx` contains `whitespace-pre-wrap`, `role="alert"` (urgent branch) and a "ตัวอย่าง" badge branch for preview; in preview no `onClick` handler is bound to the dismiss controls (they carry `aria-disabled`).
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement** with the existing tokens (`bg-bg-surface`, `bg-bg-raised`, `border-border`, `accent`, `loss`), a text label per priority, dismiss X plus "ซ่อนประกาศนี้" checkbox only when `is_dismissible` and `mode === "live"` handlers exist; Thai/English aria-labels; mobile stack, side media from `sm`.
- [ ] **Step 4: Run** the static test and `npm run typecheck` — Expected: PASS / exit 0.
- [ ] **Step 5: Commit** `feat(announcements): presentational card and media view`

### Task 13: Hook, bar, and shell mount

**Files:**
- Create: `src/features/announcements/store.ts`, `src/features/announcements/useAnnouncements.ts`, `src/features/announcements/AnnouncementBar.tsx`
- Modify: `src/layouts/AppShell.tsx` (mount `<AnnouncementBar/>` above `<Outlet/>` inside `<main>`)

**Interfaces:**
- Consumes: Tasks 3, 5, 6, 11, 12; the existing auth hook used elsewhere (find it by reading `AppShell.tsx` / `AdminHub.tsx`).
- Produces: `store.ts` exports `announcementStore` (a `createAnnouncementStore` wired to the services, `document.visibilitychange`, `window.online`) and `invalidateAnnouncements(): Promise<void>`; `useAnnouncements(): { shown: Announcement[]; more: Announcement[]; dismiss(id: string): Promise<void> }` (uses `useSyncExternalStore`, runs `syncOnSignIn` when the user id appears, applies `selectVisible`); `AnnouncementBar` wrapped in the existing error boundary; renders `null` for loading, error, or zero visible items.

- [ ] **Step 1: Implement** the three files and the mount; non-blocking failure notice via `useToast` only when `dismissAnnouncement` reports `local:"failed"` or `server:"failed"` (Thai strings from spec §7); no success toast.
- [ ] **Step 2: Run** `npm run lint`, `npm run typecheck` — Expected: both exit 0 (confirm script names in `package.json`).
- [ ] **Step 3: Run** all unit tests (`node --experimental-strip-types --test tests/announcements/*.test.ts tests/security/csp.test.ts`) — Expected: PASS.
- [ ] **Step 4: [HUMAN] Manual check** with the dev branch: bar shows nothing when there are no announcements (no empty box), a failed network leaves the page usable, one bar across route changes.
- [ ] **Step 5: Commit** `feat(announcements): public banner mounted in AppShell`

### Task 14: Admin tab

**Files:**
- Create: `src/pages/AdminAnnouncements.tsx`
- Modify: `src/pages/AdminHub.tsx` (new "ประกาศ" tab following the existing tab pattern and `useIsAdmin` gating)

**Interfaces:**
- Consumes: Tasks 4, 11, 12, 13 (`invalidateAnnouncements`); `src/pages/AdminContact.tsx` as the pattern for state components.
- Produces: default-exported page: searchable list (title/body), `Chip` status filters, status/priority badges, schedule in Bangkok time (existing date formatter), create/edit form (`validateForm`, `switchMediaType`, label "เวลาไทย (UTC+7)"), preview via `AnnouncementCard mode="preview"` of the unsaved form values (validation message instead of a card when invalid), publish/unpublish/archive/delete with `ConfirmDialog` (`busy` blocks double submit), toasts.

- [ ] **Step 1: Implement** the page; image replace order exactly as §8 (upload → `saveAnnouncement` → on success delete old only if `isOwnBucketUrl` and `countMediaReferences(old, id) === 0`; on failure delete the new upload); delete order: `deleteAnnouncement` → best-effort `removeAnnouncementImage` with the same reference check; cleanup failure → warning toast, record untouched; after every mutation refetch the list and call `invalidateAnnouncements()`.
- [ ] **Step 2: Run** `npm run lint`, `npm run typecheck`, `npm run build` — Expected: all exit 0.
- [ ] **Step 3: Run** all unit tests — Expected: PASS.
- [ ] **Step 4: [HUMAN] Manual checklist (spec §11.2 item 3)** on the dev branch: create → preview → publish → appears on public site; schedule 2 minutes ahead and watch it appear and expire with no navigation; unpublish → dismiss → republish → still hidden; non-admin cannot see the tab or call the RPCs; layouts 375/768/1280 px dark and light; YouTube, Vimeo, direct video, broken image, offline.
- [ ] **Step 5: Commit** `feat(announcements): admin management tab`

### Task 15: Final gate and hand-off

**Files:**
- Modify: `docs/superpowers/specs/2026-10-16-announcements-design.md` (status line: implemented-on-branch, migration still NOT APPLIED)

- [ ] **Step 1: Run** `npm run lint`, `npm run typecheck`, `npm run build`, and the unit command — record the real outputs.
- [ ] **Step 2: [HUMAN] Confirm** SQL script and API script results (Tasks 8, 9) and the Vercel preview CSP check.
- [ ] **Step 3: Draft the summary** required by the original request: implemented features, changed/added files, migration file and setup, RLS/security changes, test and build results exactly as run, remaining manual steps.
- [ ] **Step 4: Commit** `docs(announcements): final status`; open a draft PR only if the owner asks.
