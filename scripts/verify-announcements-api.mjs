#!/usr/bin/env node
// scripts/verify-announcements-api.mjs -- HTTP-level verification of the announcements migration (PostgREST + Storage).
// STATUS: WRITTEN, NEVER RUN. Run only against a Supabase DEV BRANCH / dev project where 20261016c_announcements.sql has been applied.
// Env: SUPABASE_URL, SUPABASE_ANON_KEY, ADMIN_JWT (a signed-in admin's access token), USER_JWT (a signed-in non-admin's access token).
// Refuses to run against the production project. Creates rows/objects prefixed "verify-" and removes them at the end (best effort).
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const PROD_REF = "mttcdaiwuasnkqlxbeqs";
const { SUPABASE_URL, SUPABASE_ANON_KEY, ADMIN_JWT, USER_JWT } = process.env;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !ADMIN_JWT || !USER_JWT) {
  console.error("Set SUPABASE_URL, SUPABASE_ANON_KEY, ADMIN_JWT and USER_JWT.");
  process.exit(2);
}
if (SUPABASE_URL.includes(PROD_REF)) {
  console.error("Refusing to run against the production project.");
  process.exit(2);
}

const base = SUPABASE_URL.replace(/\/$/, "");
const vectors = JSON.parse(readFileSync(new URL("../tests/announcements/media-vectors.json", import.meta.url), "utf8"));
const PNG = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64"));

const results = [];
const check = async (name, fn) => {
  try {
    const detail = await fn();
    if (detail === false) throw new Error("assertion false");
    results.push({ name, ok: true });
    console.log(`PASS  ${name}`);
  } catch (e) {
    results.push({ name, ok: false });
    console.log(`FAIL  ${name} -- ${e.message}`);
  }
};

const headers = (jwt, extra = {}) => ({ apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${jwt ?? SUPABASE_ANON_KEY}`, ...extra });
const rpc = (fn, args, jwt) =>
  fetch(`${base}/rest/v1/rpc/${fn}`, { method: "POST", headers: headers(jwt, { "Content-Type": "application/json" }), body: JSON.stringify(args) });
const json = async (res) => { try { return await res.json(); } catch { return null; } };
const save = (o, jwt = ADMIN_JWT) =>
  rpc("admin_save_announcement", { p_id: null, p_title: "verify-x", p_content: "", p_media_type: "none", p_media_url: null, p_link_url: null, p_link_label: null, p_priority: "normal", p_is_dismissible: true, p_starts_at: null, p_ends_at: null, ...o }, jwt);

const created = [];
const uploaded = [];
const objectUrl = (name) => `${base}/storage/v1/object/announcements/${name}`;
const publicUrl = (name) => `${base}/storage/v1/object/public/announcements/${name}`;
const upload = (name, body, type, jwt, extra = {}) =>
  fetch(objectUrl(name), { method: "POST", headers: headers(jwt, { "Content-Type": type, ...extra }), body });

try {
  // ---- PostgREST: privileges and column grants ----
  await check("anon: explicit columns work", async () => (await fetch(`${base}/rest/v1/announcements?select=id,title,status&limit=1`, { headers: headers(null) })).ok);
  await check("anon: select=* is denied (created_by has no grant)", async () => !(await fetch(`${base}/rest/v1/announcements?select=*&limit=1`, { headers: headers(null) })).ok);
  await check("anon: created_by is denied", async () => !(await fetch(`${base}/rest/v1/announcements?select=created_by&limit=1`, { headers: headers(null) })).ok);
  await check("anon: direct insert is denied", async () => !(await fetch(`${base}/rest/v1/announcements`, { method: "POST", headers: headers(null, { "Content-Type": "application/json" }), body: JSON.stringify({ title: "verify-direct" }) })).ok);
  await check("user: direct insert is denied", async () => !(await fetch(`${base}/rest/v1/announcements`, { method: "POST", headers: headers(USER_JWT, { "Content-Type": "application/json" }), body: JSON.stringify({ title: "verify-direct" }) })).ok);
  await check("admin: direct insert is denied too (writes only via RPC)", async () => !(await fetch(`${base}/rest/v1/announcements`, { method: "POST", headers: headers(ADMIN_JWT, { "Content-Type": "application/json" }), body: JSON.stringify({ title: "verify-direct" }) })).ok);
  await check("anon: admin RPC is not executable", async () => !(await save({}, null)).ok);
  await check("user: admin RPC fails with FORBIDDEN", async () => { const r = await save({}, USER_JWT); const b = await json(r); return !r.ok && b?.details === "FORBIDDEN"; });
  await check("anon: schedule RPC works and exposes only two timestamps", async () => {
    const r = await rpc("get_announcement_schedule", {}, null);
    const b = await json(r);
    const row = Array.isArray(b) ? b[0] : b;
    return r.ok && row && Object.keys(row).sort().join(",") === "next_change,server_now";
  });
  await check("anon: server-side dismissal is not allowed", async () => !(await rpc("dismiss_announcements", { p_ids: [randomUUID()] }, null)).ok);
  await check("user: dismiss accepts unknown ids silently", async () => { const r = await rpc("dismiss_announcements", { p_ids: [randomUUID()] }, USER_JWT); return r.ok && (await json(r)) === 0; });

  // ---- media-vector parity with the TypeScript implementation (all vectors, real RPC) ----
  for (const v of vectors) {
    await check(`vector parity: ${v.name}`, async () => {
      const r = await save({ p_title: `verify-${v.name}`.slice(0, 100), p_media_type: v.mediaType, p_media_url: v.mediaUrl, p_link_url: v.linkUrl, p_link_label: v.linkLabel });
      const b = await json(r);
      if (v.expected === null) { if (r.ok && typeof b === "string") created.push(b); return r.ok; }
      return !r.ok && b?.details === v.expected;
    });
  }

  // ---- Storage ----
  const name = `${randomUUID()}.png`;
  await check("storage: anon upload denied", async () => !(await upload(name, PNG, "image/png", null)).ok);
  await check("storage: ordinary user upload denied", async () => !(await upload(name, PNG, "image/png", USER_JWT)).ok);
  await check("storage: admin upload allowed", async () => { const r = await upload(name, PNG, "image/png", ADMIN_JWT); if (r.ok) uploaded.push(name); return r.ok; });
  await check("storage: public URL serves the image to anon", async () => (await fetch(publicUrl(name))).ok);
  await check("storage: overwrite is refused (plain POST and upsert)", async () => !(await upload(name, PNG, "image/png", ADMIN_JWT)).ok && !(await upload(name, PNG, "image/png", ADMIN_JWT, { "x-upsert": "true" })).ok);
  await check("storage: non-UUID object name refused", async () => !(await upload("evil.png", PNG, "image/png", ADMIN_JWT)).ok);
  await check("storage: HTML content type refused", async () => !(await upload(`${randomUUID()}.png`, new TextEncoder().encode("<script>alert(1)</script>"), "text/html", ADMIN_JWT)).ok);
  await check("storage: SVG refused", async () => !(await upload(`${randomUUID()}.svg`, new TextEncoder().encode("<svg/>"), "image/svg+xml", ADMIN_JWT)).ok);
  await check("storage: file over 2 MB refused", async () => !(await upload(`${randomUUID()}.png`, new Uint8Array(2 * 1024 * 1024 + 1), "image/png", ADMIN_JWT)).ok);
  await check("storage: anon cannot list the bucket", async () => {
    const r = await fetch(`${base}/storage/v1/object/list/announcements`, { method: "POST", headers: headers(null, { "Content-Type": "application/json" }), body: JSON.stringify({ prefix: "", limit: 10 }) });
    const b = await json(r);
    return !r.ok || (Array.isArray(b) && b.length === 0);
  });
  await check("storage: ordinary user delete does not remove the object", async () => { await fetch(objectUrl(name), { method: "DELETE", headers: headers(USER_JWT) }); return (await fetch(publicUrl(name))).ok; });
  await check("storage: admin delete removes the object", async () => { await fetch(objectUrl(name), { method: "DELETE", headers: headers(ADMIN_JWT) }); const gone = (await fetch(publicUrl(name))).status === 400 || (await fetch(publicUrl(name))).status === 404; if (gone) uploaded.splice(uploaded.indexOf(name), 1); return gone; });
} finally {
  for (const id of created) await rpc("admin_delete_announcement", { p_id: id }, ADMIN_JWT).catch(() => {});
  for (const n of uploaded) await fetch(objectUrl(n), { method: "DELETE", headers: headers(ADMIN_JWT) }).catch(() => {});
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
