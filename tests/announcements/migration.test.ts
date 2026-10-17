import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Run: node --experimental-strip-types --test tests/announcements/migration.test.ts  (Node >= 22.6)
// STATIC TEXT CHECKS ONLY. They prove the migration says the right things, NOT that Postgres behaves that way.
// Behaviour is proven by supabase/tests/announcements.sql and scripts/verify-announcements-api.mjs on a dev branch (see the spec, section 11.2).
const sql = readFileSync(new URL("../../supabase/migrations/20261016c_announcements.sql", import.meta.url), "utf8");
const flat = sql.replace(/--.*$/gm, "").replace(/\s+/g, " ");
const COLUMNS = ["id", "title", "content", "media_type", "media_url", "link_url", "link_label", "status", "priority", "is_dismissible", "starts_at", "ends_at", "created_at", "updated_at"];

test("G1 header states the migration is NOT APPLIED and is additive", () => {
  assert.match(sql.split("\n").slice(0, 8).join("\n"), /NOT APPLIED/);
});
test("G2 dollar-quoted function bodies are balanced", () => {
  assert.equal((sql.match(/\$fn\$/g) ?? []).length % 2, 0);
});
test("G3 RLS is enabled on both tables and direct privileges are revoked from every client role", () => {
  for (const t of ["announcements", "announcement_dismissals"]) {
    assert.ok(flat.includes(`alter table public.${t} enable row level security;`), `${t} rls`);
    assert.ok(flat.includes(`revoke all on table public.${t} from public, anon, authenticated;`), `${t} revoke`);
  }
});
test("G4 clients may SELECT exactly the 14 public columns of announcements and never created_by", () => {
  const m = /grant select \(([^)]*)\) on table public\.announcements to anon, authenticated;/.exec(flat);
  assert.ok(m, "column-level grant present");
  const cols = m![1].split(",").map((c) => c.trim());
  assert.deepEqual([...cols].sort(), [...COLUMNS].sort());
  assert.equal(cols.includes("created_by"), false);
  for (const g of flat.matchAll(/grant (.*?) on (?:table|function) /gi)) {
    const privileges = g[1].replace(/\([^)]*\)/g, ""); // drop column lists such as (..., updated_at)
    assert.equal(/\b(insert|update|delete|truncate|all)\b/i.test(privileges), false, `write grant: ${g[0]}`);
  }
});
test("G5 public read policy enforces status and the schedule window; admin read policy uses is_admin()", () => {
  assert.match(flat, /create policy "announcements public read active" on public\.announcements for select to anon, authenticated using \( status = 'published' and \(starts_at is null or starts_at <= now\(\)\) and \(ends_at is null or ends_at > now\(\)\) \);/);
  assert.match(flat, /create policy "announcements admin read all" on public\.announcements for select to authenticated using \(\(select public\.is_admin\(\)\)\);/);
});
test("G6 no INSERT/UPDATE/DELETE policy exists on the tables", () => {
  assert.equal(/create policy "[^"]*" on public\.\w+ for (insert|update|delete|all)/i.test(flat), false);
});
test("G7 dismissals: composite primary key, cascades, own-row select only", () => {
  assert.ok(flat.includes("primary key (user_id, announcement_id)"));
  assert.ok(flat.includes("references auth.users(id) on delete cascade"));
  assert.ok(flat.includes("references public.announcements(id) on delete cascade"));
  assert.ok(flat.includes("grant select on table public.announcement_dismissals to authenticated;"));
  assert.match(flat, /create policy "dismissals read own" on public\.announcement_dismissals for select to authenticated using \(user_id = \(select auth\.uid\(\)\)\);/);
});
test("G8 media validation lives in one SQL function used by the CHECK constraint", () => {
  assert.ok(flat.includes("check (public.announcement_media_error(media_type, media_url, link_url, link_label) is null)"));
});
test("G9 other constraints: lengths, enums, schedule window", () => {
  assert.ok(flat.includes("char_length(btrim(title)) between 1 and 120"));
  assert.ok(flat.includes("char_length(content) <= 4000"));
  assert.ok(flat.includes("media_type in ('none', 'image', 'video', 'link')"));
  assert.ok(flat.includes("status in ('draft', 'published', 'archived')"));
  assert.ok(flat.includes("priority in ('normal', 'important', 'urgent')"));
  assert.ok(flat.includes("starts_at is null or ends_at is null or ends_at > starts_at"));
});
test("G10 partial index for published announcements", () => {
  assert.match(flat, /create index if not exists announcements_published_idx on public\.announcements \(priority, \(coalesce\(starts_at, created_at\)\) desc\) where status = 'published';/);
});
test("G11 every function pins an empty search_path and internal helpers are revoked from client roles", () => {
  const chunks = flat.split(/create or replace function /).slice(1);
  assert.ok(chunks.length >= 5);
  for (const c of chunks) assert.ok(c.includes("set search_path = ''"), c.slice(0, 60));
  for (const sig of ["announcement_clean(text)", "announcement_https_url_ok(text)", "announcement_video_ok(text)", "announcement_media_error(text, text, text, text)", "announcements_touch()"]) {
    assert.ok(flat.includes(`revoke all on function public.${sig} from public, anon, authenticated;`), sig);
  }
});
test("G12 additive only: no DROP TABLE / TRUNCATE / DELETE FROM, and ALTER TABLE only touches the new tables", () => {
  assert.equal(/drop table|truncate|delete from/i.test(flat.replace(/delete from public\.announcements where id = p_id/g, "")), false); // the single allowed DELETE is admin_delete_announcement
  for (const m of flat.matchAll(/alter table (\S+)/g)) assert.ok(["public.announcements", "public.announcement_dismissals"].includes(m[1]), m[1]);
});

// ---- Task 8: RPCs, schedule, dismissals ------------------------------------------------------------------------------
const SAVE_SIG = "uuid, text, text, text, text, text, text, text, boolean, timestamptz, timestamptz";
const fnBlock = (name: string) => {
  const start = flat.indexOf(`create or replace function public.${name}(`);
  assert.ok(start >= 0, `${name} defined`);
  const next = flat.indexOf("create or replace function ", start + 10);
  return flat.slice(start, next === -1 ? undefined : next);
};
const FORBIDDEN_FIRST = /^[^$]*\$fn\$ (?:declare [^$]*? )?begin if auth\.uid\(\) is null or not public\.is_admin\(\) then raise exception using message = '[^']+', detail = 'FORBIDDEN', errcode = 'P0001'; end if;/;

test("R1 exact grants: admin RPCs and dismiss for authenticated only; schedule for anon + authenticated; all revoked first", () => {
  const sigs: Array<[string, string]> = [
    [`admin_save_announcement(${SAVE_SIG})`, "authenticated"],
    ["admin_set_announcement_status(uuid, text)", "authenticated"],
    ["admin_delete_announcement(uuid)", "authenticated"],
    ["get_announcement_schedule()", "anon, authenticated"],
    ["dismiss_announcements(uuid[])", "authenticated"],
  ];
  for (const [sig, who] of sigs) {
    const revoke = flat.indexOf(`revoke all on function public.${sig} from public, anon, authenticated;`);
    const grant = flat.indexOf(`grant execute on function public.${sig} to ${who};`);
    assert.ok(revoke >= 0, `revoke ${sig}`);
    assert.ok(grant > revoke, `grant after revoke ${sig}`);
  }
});
test("R2 every privileged function is SECURITY DEFINER with an empty search_path", () => {
  for (const n of ["admin_save_announcement", "admin_set_announcement_status", "admin_delete_announcement", "get_announcement_schedule", "dismiss_announcements"]) {
    const b = fnBlock(n);
    assert.ok(b.includes("security definer"), `${n} security definer`);
    assert.ok(b.includes("set search_path = ''"), `${n} search_path`);
  }
});
test("R3 the admin check is the first statement of each admin RPC", () => {
  for (const n of ["admin_save_announcement", "admin_set_announcement_status", "admin_delete_announcement"]) {
    assert.match(fnBlock(n), FORBIDDEN_FIRST, n);
  }
});
test("R4 save: validation order and error codes, insert as draft with created_by, update never touches status", () => {
  const b = fnBlock("admin_save_announcement");
  for (const code of ["INVALID_TITLE", "INVALID_CONTENT", "INVALID_PRIORITY", "INVALID_MEDIA_TYPE", "INVALID_SCHEDULE", "NOT_FOUND"]) assert.ok(b.includes(`detail = '${code}'`), code);
  assert.ok(b.includes("public.announcement_media_error("));
  assert.ok(b.includes("created_by") && b.includes("auth.uid()"));
  const update = /update public\.announcements set (.*?) where id = p_id/.exec(b);
  assert.ok(update, "update present");
  for (const forbidden of ["status =", "id =", "created_by =", "created_at ="]) assert.equal(update![1].includes(forbidden), false, forbidden);
});
test("R5 status: row lock, INVALID_STATUS, NOT_FOUND, archived->published is INVALID_TRANSITION, ALREADY_EXPIRED, same status is a no-op", () => {
  const b = fnBlock("admin_set_announcement_status");
  for (const code of ["INVALID_STATUS", "NOT_FOUND", "INVALID_TRANSITION", "ALREADY_EXPIRED"]) assert.ok(b.includes(`detail = '${code}'`), code);
  assert.ok(b.includes("for update"));
  assert.ok(b.includes("if v_old = p_status then return;"));
  assert.ok(b.includes("v_old = 'archived' and p_status = 'published'"));
  assert.ok(b.includes("v_ends <= now()"));
});
test("R6 delete returns the old media_url for storage cleanup and raises NOT_FOUND", () => {
  const b = fnBlock("admin_delete_announcement");
  assert.ok(b.includes("returns text"));
  assert.ok(b.includes("delete from public.announcements where id = p_id returning media_url, id into v_url, v_deleted"));
  assert.ok(b.includes("detail = 'NOT_FOUND'"));
});
test("R7 schedule RPC returns only two timestamps computed from published rows", () => {
  const b = fnBlock("get_announcement_schedule");
  assert.ok(b.includes("returns table (server_now timestamptz, next_change timestamptz)"));
  assert.ok(b.includes("status = 'published'"));
  assert.equal(/\b(title|content|media_url|link_url)\b/.test(b.replace(/create or replace function .*?returns table/, "")), false, "no content columns selected");
});
test("R8 dismiss: authenticated caller only, batch limit 200, only the caller's rows, duplicates ignored", () => {
  const b = fnBlock("dismiss_announcements");
  assert.ok(b.includes("v_uid := auth.uid();") && b.includes("detail = 'FORBIDDEN'"));
  assert.ok(b.includes("detail = 'TOO_MANY_IDS'") && b.includes("> 200"));
  assert.ok(b.includes("select v_uid, a.id from public.announcements a where a.id = any(p_ids) on conflict do nothing"));
});
test("R9 every raised error is a predictable P0001 with a detail code", () => {
  const raises = (flat.match(/raise exception using/g) ?? []).length;
  assert.ok(raises >= 14);
  assert.equal((flat.match(/errcode = 'P0001'/g) ?? []).length, raises);
  assert.equal((flat.match(/detail = ('[A-Z_]+'|v_err)/g) ?? []).length, raises); // v_err = a media code from announcement_media_error()
});

// ---- Task 9: storage bucket and policies -----------------------------------------------------------------------------
test("B1 bucket is public-read with a 2 MB limit and image MIME allowlist, and an existing bucket cannot keep looser settings", () => {
  assert.ok(flat.includes("insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('announcements', 'announcements', true, 2097152, array['image/jpeg', 'image/png', 'image/webp']) on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;"));
  assert.equal(/image\/svg|text\/html/i.test(flat), false);
});
test("B2 storage policies: admin-only INSERT / DELETE / SELECT on the announcements bucket", () => {
  for (const [name, op] of [["announcements admin insert", "insert"], ["announcements admin delete", "delete"], ["announcements admin select", "select"]]) {
    const m = new RegExp(`create policy "${name}" on storage\\.objects for ${op} to authenticated (using|with check) \\((.*?)\\);`).exec(flat);
    assert.ok(m, name);
    assert.ok(m![2].includes("bucket_id = 'announcements'"), `${name} bucket`);
    assert.ok(m![2].includes("(select public.is_admin())"), `${name} admin`);
  }
});
test("B3 uploads must use a UUID object name with a safe image extension (no overwrite: there is no UPDATE policy)", () => {
  assert.ok(flat.includes("name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(jpg|png|webp)$'"));
  assert.equal(/on storage\.objects for (update|all)/i.test(flat), false);
});
test("B4 no storage policy is granted to anon or public (bucket listing stays closed; public object URLs still work)", () => {
  for (const m of flat.matchAll(/create policy "[^"]*" on storage\.objects for \w+ to ([a-z, ]+?) (?:using|with check)/g)) assert.equal(m[1], "authenticated");
});
