import { test } from "node:test";
import assert from "node:assert/strict";
import { saveWithImageCleanup, deleteWithImageCleanup, type CleanupDeps } from "../../src/features/announcements/cleanup.ts";

// Run: node --experimental-strip-types --test tests/announcements/cleanup.test.ts  (Node >= 22.6)
// Spec section 8: never lose the old image before the record is safe; a failed cleanup must never fail or corrupt the save/delete.
const OWN = (n: string) => `https://abc.supabase.co/storage/v1/object/public/announcements/${n}.png`;
const OLD = OWN("11111111-1111-4111-8111-111111111111");
const NEW = OWN("22222222-2222-4222-8222-222222222222");

function env(opts: { refs?: number; removeResult?: boolean | "throw"; countThrows?: boolean } = {}) {
  const log: string[] = [];
  const deps: CleanupDeps = {
    isOwnUrl: (u) => u.includes("/storage/v1/object/public/announcements/"),
    countReferences: async (u, ex) => { log.push(`count:${u === OLD ? "old" : u === NEW ? "new" : u}:${ex}`); if (opts.countThrows) throw new Error("db"); return opts.refs ?? 0; },
    removeImage: async (u) => { log.push(`remove:${u === OLD ? "old" : u === NEW ? "new" : u}`); if (opts.removeResult === "throw") throw new Error("storage"); return opts.removeResult ?? true; },
  };
  return { log, deps };
}

test("C1 replace: the old image is removed only AFTER the save succeeded, and only if nothing else references it", async () => {
  const { log, deps } = env();
  const r = await saveWithImageCleanup({ oldUrl: OLD, newUrl: NEW, uploadedUrl: NEW, save: async () => { log.push("save"); return "row-1"; } }, deps);
  assert.deepEqual(r, { id: "row-1", cleanup: "ok" });
  assert.deepEqual(log, ["save", "count:old:row-1", "remove:old"]);
});
test("C2 replace: if the save fails, the freshly uploaded object is removed, the old one is never touched, and the error propagates", async () => {
  const { log, deps } = env();
  await assert.rejects(saveWithImageCleanup({ oldUrl: OLD, newUrl: NEW, uploadedUrl: NEW, save: async () => { log.push("save"); throw new Error("INVALID_TITLE"); } }, deps), /INVALID_TITLE/);
  assert.deepEqual(log, ["save", "remove:new"]);
});
test("C3 replace: a failing cleanup of the uploaded object after a failed save does not mask the save error", async () => {
  const { deps } = env({ removeResult: "throw" });
  await assert.rejects(saveWithImageCleanup({ oldUrl: null, newUrl: NEW, uploadedUrl: NEW, save: async () => { throw new Error("FORBIDDEN"); } }, deps), /FORBIDDEN/);
});
test("C4 replace: an old image still referenced by another announcement is kept", async () => {
  const { log, deps } = env({ refs: 1 });
  const r = await saveWithImageCleanup({ oldUrl: OLD, newUrl: NEW, uploadedUrl: NEW, save: async () => "row-1" }, deps);
  assert.deepEqual(r, { id: "row-1", cleanup: "none" });
  assert.equal(log.some((l) => l.startsWith("remove:")), false);
});
test("C5 replace: external (non-bucket) old URLs and unchanged URLs are never touched", async () => {
  const a = env();
  const ext = await saveWithImageCleanup({ oldUrl: "https://example.com/a.png", newUrl: NEW, uploadedUrl: NEW, save: async () => "row-1" }, a.deps);
  assert.deepEqual(ext, { id: "row-1", cleanup: "none" });
  assert.deepEqual(a.log, []);
  const b = env();
  const same = await saveWithImageCleanup({ oldUrl: OLD, newUrl: OLD, uploadedUrl: null, save: async () => "row-1" }, b.deps);
  assert.deepEqual(same, { id: "row-1", cleanup: "none" });
  assert.deepEqual(b.log, []);
  const c = env();
  const noOld = await saveWithImageCleanup({ oldUrl: null, newUrl: NEW, uploadedUrl: NEW, save: async () => "row-1" }, c.deps);
  assert.deepEqual(noOld, { id: "row-1", cleanup: "none" });
});
test("C6 replace: a failed cleanup after a successful save reports 'failed' but the save still succeeds (record intact)", async () => {
  for (const o of [{ removeResult: false as const }, { removeResult: "throw" as const }, { countThrows: true }]) {
    const { deps } = env(o);
    const r = await saveWithImageCleanup({ oldUrl: OLD, newUrl: NEW, uploadedUrl: NEW, save: async () => "row-1" }, deps);
    assert.deepEqual(r, { id: "row-1", cleanup: "failed" });
  }
});
test("C7 pasting an external URL (no upload) over an old bucket image removes the old image after the save", async () => {
  const { log, deps } = env();
  const r = await saveWithImageCleanup({ oldUrl: OLD, newUrl: "https://example.com/new.png", uploadedUrl: null, save: async () => "row-1" }, deps);
  assert.equal(r.cleanup, "ok");
  assert.deepEqual(log, ["count:old:row-1", "remove:old"]);
});
test("C8 failed save without an upload removes nothing", async () => {
  const { log, deps } = env();
  await assert.rejects(saveWithImageCleanup({ oldUrl: OLD, newUrl: OLD, uploadedUrl: null, save: async () => { throw new Error("x"); } }, deps));
  assert.deepEqual(log, []);
});
test("C9 delete: the row is deleted first, then the image only if unreferenced; cleanup problems never fail the delete", async () => {
  const a = env();
  const ok = await deleteWithImageCleanup({ remove: async () => { a.log.push("delete-row"); return OLD; } }, a.deps);
  assert.deepEqual(ok, { cleanup: "ok" });
  assert.deepEqual(a.log, ["delete-row", "count:old:null", "remove:old"]);
  const b = env({ refs: 2 });
  assert.deepEqual(await deleteWithImageCleanup({ remove: async () => OLD }, b.deps), { cleanup: "none" });
  const c = env({ removeResult: "throw" });
  assert.deepEqual(await deleteWithImageCleanup({ remove: async () => OLD }, c.deps), { cleanup: "failed" });
  const d = env();
  assert.deepEqual(await deleteWithImageCleanup({ remove: async () => null }, d.deps), { cleanup: "none" });
  assert.deepEqual(await deleteWithImageCleanup({ remove: async () => "https://example.com/x.png" }, d.deps), { cleanup: "none" });
  await assert.rejects(deleteWithImageCleanup({ remove: async () => { throw new Error("NOT_FOUND"); } }, d.deps), /NOT_FOUND/);
});
