import { test } from "node:test";
import assert from "node:assert/strict";
import { handleUpload, safeStem, announcementKeyFromUrl, type Deps, type AdminCheck } from "../../api/_upload/core.ts";

// Run: node --experimental-strip-types --test tests/uploads/*.test.ts
const BASE = "https://assets.rovlab.app";
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]);
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
const UUID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

function setup(who: AdminCheck = "admin", putOk = true) {
  const puts: { key: string; type: string }[] = [];
  const removed: string[] = [];
  const d: Deps = {
    publicBase: BASE,
    checkAdmin: async () => who,
    put: async (key, _b, type) => (putOk ? (puts.push({ key, type }), true) : false),
    remove: async (key) => (removed.push(key), true),
    now: () => 1792800000000,
    uuid: () => UUID,
  };
  return { d, puts, removed };
}
const post = (qs: string, body: Uint8Array, type: string, auth: string | null = "Bearer tok") =>
  new Request(`https://x.test/api/upload?${qs}`, { method: "POST", body, headers: { "content-type": type, ...(auth ? { authorization: auth } : {}) } });

test("admin catalog upload -> R2 key under hero-icons/<folder>/ and assets.rovlab.app URL", async () => {
  const { d, puts } = setup();
  const res = await handleUpload(post("kind=catalog&folder=heroes&name=Dirak%20Icon.PNG", PNG, "image/png"), d);
  assert.equal(res.status, 200);
  const { url } = (await res.json()) as { url: string };
  assert.equal(url, `${BASE}/hero-icons/heroes/1792800000000-Dirak_Icon.png`);
  assert.deepEqual(puts, [{ key: "hero-icons/heroes/1792800000000-Dirak_Icon.png", type: "image/png" }]);
});
test("announcement upload -> announcements/<uuid>.<ext>, client name ignored", async () => {
  const { d, puts } = setup();
  const res = await handleUpload(post("kind=announcement&name=../../evil", JPEG, "image/jpeg"), d);
  assert.equal(((await res.json()) as { url: string }).url, `${BASE}/announcements/${UUID}.jpg`);
  assert.equal(puts[0].key, `announcements/${UUID}.jpg`);
});
test("no token -> 401, non-admin -> 403, expired token -> 401, auth outage -> 503; nothing is stored", async () => {
  for (const [who, auth, status] of [["admin", null, 401], ["member", "Bearer t", 403], ["anon", "Bearer t", 401], ["error", "Bearer t", 503]] as const) {
    const { d, puts } = setup(who);
    const res = await handleUpload(post("kind=catalog&folder=items", PNG, "image/png", auth), d);
    assert.equal(res.status, status, `${who}/${auth}`);
    assert.equal(puts.length, 0);
  }
});
test("non-admin cannot delete either", async () => {
  const { d, removed } = setup("member");
  const res = await handleUpload(new Request(`https://x.test/api/upload?url=${encodeURIComponent(`${BASE}/announcements/${UUID}.png`)}`, { method: "DELETE", headers: { authorization: "Bearer t" } }), d);
  assert.equal(res.status, 403);
  assert.equal(removed.length, 0);
});
test("rejects unknown folder, path traversal folder, unknown kind", async () => {
  for (const qs of ["kind=catalog&folder=avatars", "kind=catalog&folder=../avatars", "kind=catalog", "kind=nope&folder=items", "folder=items"]) {
    const { d, puts } = setup();
    assert.equal((await handleUpload(post(qs, PNG, "image/png"), d)).status, 400, qs);
    assert.equal(puts.length, 0);
  }
});
test("rejects wrong type, MIME/bytes mismatch, empty, oversize", async () => {
  const { d, puts } = setup();
  assert.equal((await handleUpload(post("kind=catalog&folder=items", PNG, "image/gif"), d)).status, 415);
  assert.equal((await handleUpload(post("kind=catalog&folder=items", PNG, "image/jpeg"), d)).status, 415);
  assert.equal((await handleUpload(post("kind=catalog&folder=items", new TextEncoder().encode("<script>alert(1)</script>"), "image/png"), d)).status, 415);
  assert.equal((await handleUpload(post("kind=catalog&folder=items", new Uint8Array(0), "image/png"), d)).status, 400);
  assert.equal((await handleUpload(post("kind=announcement", new Uint8Array(2_097_153).fill(0).map((_, i) => PNG[i] ?? 0), "image/png"), d)).status, 413);
  assert.equal((await handleUpload(post("kind=announcement", new TextEncoder().encode("<svg xmlns='x'/>"), "image/svg+xml"), d)).status, 415, "svg not allowed for announcements");
  assert.equal(puts.length, 0);
});
test("SVG: plain icon accepted for catalog, script/handler SVG rejected", async () => {
  const { d } = setup();
  const ok = new TextEncoder().encode('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>');
  assert.equal((await handleUpload(post("kind=catalog&folder=enchantment_trees&name=t.svg", ok, "image/svg+xml"), d)).status, 200);
  for (const bad of ['<svg xmlns="x"><script>alert(1)</script></svg>', '<svg onload="alert(1)"/>', '<svg><a href="javascript:alert(1)"/></svg>', "<html><svg/></html>"]) {
    assert.equal((await handleUpload(post("kind=catalog&folder=items", new TextEncoder().encode(bad), "image/svg+xml"), d)).status, 415, bad);
  }
});
test("R2 failure -> 502 and NO url in the response", async () => {
  const { d } = setup("admin", false);
  const res = await handleUpload(post("kind=catalog&folder=items", PNG, "image/png"), d);
  assert.equal(res.status, 502);
  assert.equal(((await res.json()) as Record<string, unknown>).url, undefined);
});
test("DELETE removes only our own announcements/<uuid>.<ext> keys", async () => {
  const del = async (url: string) => {
    const { d, removed } = setup();
    const res = await handleUpload(new Request(`https://x.test/api/upload?url=${encodeURIComponent(url)}`, { method: "DELETE", headers: { authorization: "Bearer t" } }), d);
    return { status: res.status, removed };
  };
  assert.deepEqual(await del(`${BASE}/announcements/${UUID}.webp?v=1`), { status: 200, removed: [`announcements/${UUID}.webp`] });
  for (const bad of [`${BASE}/avatars/${UUID}/1792601038213.jpg`, `${BASE}/hero-icons/heroes/x.png`, `${BASE}/announcements/../avatars/a.jpg`, `${BASE}/announcements/${UUID}.gif`,
    `https://evil.test/announcements/${UUID}.png`, `https://abc.supabase.co/storage/v1/object/public/announcements/${UUID}.png`, "not a url", ""]) {
    assert.deepEqual(await del(bad), { status: 400, removed: [] }, bad);
  }
});
test("safeStem / announcementKeyFromUrl edge cases", () => {
  assert.equal(safeStem("../../etc/passwd.png"), "etc_passwd");
  assert.equal(safeStem("ไอคอน.png"), "image");
  assert.equal(safeStem(null), "image");
  assert.equal(safeStem("a".repeat(200)).length, 60);
  assert.equal(announcementKeyFromUrl(`${BASE}/announcements/${UUID}.png`, BASE), `announcements/${UUID}.png`);
});
