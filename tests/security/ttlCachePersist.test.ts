import { test } from "node:test";
import assert from "node:assert/strict";

// Run: node --experimental-strip-types --test tests/security/ttlCachePersist.test.ts
// Persisted keys must survive a "reload" (fresh in-memory store); keys not on the allow-list (anything per-user) must not.
// Maps/Sets cannot round-trip through JSON, so tiers: / balance:recent cache plain rows and rebuild the Map on read.
const mem = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
    key: (i: number) => Array.from(mem.keys())[i] ?? null,
    get length() {
      return mem.size;
    },
  },
});

const { cached, clearCache } = await import("../../src/lib/ttlCache.ts");

async function loadsAfterReload(key: string): Promise<number> {
  let calls = 0;
  const load = async () => ({ n: ++calls });
  await cached(key, 60_000, load);
  // simulate a page reload: drop the in-memory store only, keep what was written to storage
  const saved = new Map(mem);
  clearCache("");
  mem.clear();
  for (const [k, v] of saved) mem.set(k, v);
  await cached(key, 60_000, load);
  return calls;
}

test("P1 public reference keys are served from storage after a reload (1 load)", async () => {
  const keys = ["draft-relations", "videos:airi", "builds:abc", "patch:latest", "tiers:all", "balance:recent", "items:all", "runes:all"];
  for (const key of keys) {
    assert.equal(await loadsAfterReload(key), 1, key);
  }
});

test("P2 keys outside the allow-list (per-user data) are never persisted (2 loads)", async () => {
  for (const key of ["profile:me", "favorites:u1"]) {
    assert.equal(await loadsAfterReload(key), 2, key);
  }
});

test("P3 clearCache('tiers:') also drops the persisted copy (admin edits show up at once)", async () => {
  await cached("tiers:all", 60_000, async () => ({ n: 1 }));
  assert.ok(Array.from(mem.keys()).some((k) => k.endsWith("tiers:all")));
  clearCache("tiers:");
  assert.ok(!Array.from(mem.keys()).some((k) => k.endsWith("tiers:all")));
});
