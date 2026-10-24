import { test } from "node:test";
import assert from "node:assert/strict";

// Run: node --experimental-strip-types --test tests/security/ttlCachePersist.test.ts
// Persisted keys must survive a "reload" (fresh in-memory store); non-persisted keys must not (tiers: holds Maps, which JSON cannot round-trip).
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

test("P1 draft-relations, videos:, builds:, patch:latest are served from storage after a reload (1 load)", async () => {
  for (const key of ["draft-relations", "videos:airi", "builds:abc", "patch:latest"]) {
    assert.equal(await loadsAfterReload(key), 1, key);
  }
});

test("P2 tiers: is never persisted (2 loads)", async () => {
  assert.equal(await loadsAfterReload("tiers:all"), 2);
});
