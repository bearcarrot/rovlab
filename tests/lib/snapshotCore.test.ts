import { test } from "node:test";
import assert from "node:assert/strict";
import { entryFor, loadRows, rowsFrom, type SnapshotEntry } from "../../src/lib/snapshotCore.ts";
import { buildBody, DATASETS, mergeManifest } from "../../api/_publish/core.ts";

// Run: node --experimental-strip-types --test tests/lib/snapshotCore.test.ts

const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `id-${i}`, slug: `hero-${i}`, name: `Hero ${i}` }));

async function published(n = 60) {
  const b = await buildBody(DATASETS.heroes, rows(n));
  const manifest = mergeManifest(null, { heroes: { key: b.key, count: b.count, bytes: b.bytes, schema: 1 } }, "2026-10-31T00:00:00.000Z");
  return { manifest, body: JSON.parse(b.json), key: b.key };
}

test("publisher output is accepted by the client loader and equals the source rows", async () => {
  const p = await published();
  const out = await loadRows<{ id: string; slug: string }>("heroes", { manifest: async () => p.manifest, body: async (k) => (k === p.key ? p.body : null) });
  assert.ok(out);
  assert.equal(out.length, 60);
  assert.deepEqual(out.map((r) => r.slug), rows(60).map((r) => r.slug));
});

test("falls back (null) when the manifest or dataset is missing or unusable", async () => {
  const p = await published();
  const body = async () => p.body;
  assert.equal(await loadRows("heroes", { manifest: async () => null, body }), null);
  assert.equal(await loadRows("heroes", { manifest: async () => ({}), body }), null);
  assert.equal(await loadRows("hero-text", { manifest: async () => p.manifest, body }), null); // not published
  assert.equal(await loadRows("heroes", { manifest: async () => ({ ...p.manifest, schema: 2 }), body }), null);
  assert.equal(await loadRows("heroes", { manifest: async () => { throw new Error("404"); }, body }), null);
  assert.equal(await loadRows("heroes", { manifest: async () => p.manifest, body: async () => { throw new Error("network"); } }), null);
});

test("never trusts a snapshot partially", async () => {
  const p = await published();
  const entry = entryFor(p.manifest, "heroes") as SnapshotEntry;
  assert.ok(entry);
  assert.equal(rowsFrom({ ...p.body, rows: p.body.rows.slice(1) }, entry), null); // count differs from the manifest
  assert.equal(rowsFrom({ ...p.body, schema: 2 }, entry), null);
  assert.equal(rowsFrom({ schema: 1, rows: "x" }, entry), null);
  assert.equal(rowsFrom({ ...p.body, rows: [...p.body.rows.slice(1), { id: 1, slug: "x" }] }, entry), null); // id must be a string
  assert.equal(rowsFrom({ ...p.body, rows: [...p.body.rows.slice(1), null] }, entry), null);
  assert.equal(rowsFrom(null, entry), null);
});

test("rejects manifest keys that point outside the dataset folder", () => {
  const mk = (key: string) => ({ schema: 1, generation: 1, generatedAt: "x", datasets: { heroes: { key, count: 5, bytes: 1, schema: 1 } } });
  assert.ok(entryFor(mk("data/v/heroes/0123456789ab.json"), "heroes"));
  for (const bad of ["../x.json", "data/v/heroes/../../x.json", "https://evil.example/a.json", "data/v/other/0123456789ab.json", "data/v/heroes/xyz.json", "data/manifest.json"]) {
    assert.equal(entryFor(mk(bad), "heroes"), null, bad);
  }
  assert.equal(entryFor({ schema: 1, datasets: { heroes: { key: "data/v/heroes/0123456789ab.json", count: 0, schema: 1 } } }, "heroes"), null);
});
