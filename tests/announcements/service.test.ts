import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Run: node --experimental-strip-types --test tests/announcements/service.test.ts  (Node >= 22.6)
// STATIC CHECKS on src/services/announcements.ts (it imports the Supabase client via the "@/" alias, so it cannot be executed here).
const src = readFileSync(new URL("../../src/services/announcements.ts", import.meta.url), "utf8");
const code = src.replace(/\/\/.*$/gm, "");
const uploadApi = readFileSync(new URL("../../api/upload.ts", import.meta.url), "utf8");
const COLUMNS = ["id", "title", "content", "media_type", "media_url", "link_url", "link_label", "status", "priority", "is_dismissible", "starts_at", "ends_at", "created_at", "updated_at"];

test("SV1 explicit column list: the 14 granted columns, never created_by, never select('*')", () => {
  const m = /export const ANNOUNCEMENT_COLUMNS =\s*"([^"]+)"/.exec(code);
  assert.ok(m, "ANNOUNCEMENT_COLUMNS constant");
  assert.deepEqual(m![1].split(",").sort(), [...COLUMNS].sort());
  assert.equal(/select\(\s*["'`]\*["'`]/.test(code), false, "no select('*')");
  assert.equal(code.includes("created_by"), false, "created_by is never referenced");
});
test("SV2 announcements and dismissals are only ever READ through the table API; every write goes through an RPC", () => {
  assert.equal(/\.from\(\s*["']announcements["']\s*\)\s*\.(insert|update|upsert|delete)\b/.test(code), false);
  assert.equal(/\.from\(\s*["']announcement_dismissals["']\s*\)\s*\.(insert|update|upsert|delete)\b/.test(code), false);
  for (const rpc of ["admin_save_announcement", "admin_set_announcement_status", "admin_delete_announcement", "get_announcement_schedule", "dismiss_announcements"]) {
    assert.ok(code.includes(`.rpc("${rpc}"`), rpc);
  }
});
test("SV3 uploads go through the R2 endpoint (never Supabase Storage), are validated first, and only our own URLs can be removed", () => {
  assert.equal(code.includes(".storage"), false, "no Supabase Storage calls left in the announcements service");
  assert.ok(code.includes("uploadAnnouncementFile("), "upload goes through /api/upload");
  assert.ok(code.includes("removeAnnouncementFile("), "removal goes through /api/upload");
  assert.ok(code.includes("checkImageFile("), "client-side validation first");
  assert.ok(code.includes("objectNameFromUrl("), "only objects with our own naming scheme can be removed");
});
test("SV3b no-overwrite + unique names are enforced SERVER-side (replaces the old client-side upsert:false check)", () => {
  assert.ok(uploadApi.includes('"if-none-match": "*"'), "R2 PUT refuses to overwrite an existing object");
  const core = readFileSync(new URL("../../api/_upload/core.ts", import.meta.url), "utf8");
  assert.ok(core.includes("announcements/${d.uuid()}."), "announcement keys are server-generated UUIDs");
});
test("SV4 errors expose the machine-readable code (PostgREST details) and a Thai message", () => {
  assert.ok(code.includes("class AnnouncementError"));
  assert.ok(code.includes(".details"));
  assert.ok(code.includes("ERROR_TH"));
});
test("SV5 the service uses the repo's Supabase client and keeps no secrets or service-role usage", () => {
  assert.ok(code.includes('from "@/lib/supabase"'));
  assert.equal(/service_role|SERVICE_ROLE|serviceRole/i.test(code), false);
});
