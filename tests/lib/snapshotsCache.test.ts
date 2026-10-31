import { test } from "node:test";
import assert from "node:assert/strict";
import { cached } from "../../src/lib/ttlCache.ts";

// Run: node --experimental-strip-types --test tests/lib/snapshotsCache.test.ts

const mem = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => {
      mem.set(k, String(v));
    },
    removeItem: (k: string) => {
      mem.delete(k);
    },
    key: (i: number) => Array.from(mem.keys())[i] ?? null,
    get length() {
      return mem.size;
    },
  },
});

const HOUR = 60 * 60 * 1000;
const seed = (key: string, ageMs: number, v: unknown) => mem.set(`rovlab:cache:v2:${key}`, JSON.stringify({ at: Date.now() - ageMs, v }));

test("snapshot data bodies are persisted and stay for hours (their key is a content hash, so they cannot be stale)", async () => {
  const key = "snap:data:data/v/heroes/0123456789ab.json";
  await cached(key, 1000, async () => ({ schema: 1, rows: [] }));
  assert.ok(mem.has(`rovlab:cache:v2:${key}`));
  const key2 = "snap:data:data/v/heroes/ba9876543210.json";
  seed(key2, 3 * HOUR, { schema: 1, rows: ["old"] });
  let calls = 0;
  const v = await cached(key2, 1000, async () => {
    calls++;
    return { schema: 1, rows: ["new"] };
  });
  assert.deepEqual(v, { schema: 1, rows: ["old"] });
  assert.equal(calls, 0);
});

test("the snapshot manifest is never persisted, so a new publish is picked up within its short in-memory TTL", async () => {
  await cached("snapmanifest", 1000, async () => ({ schema: 1, generation: 1, datasets: {} }));
  assert.equal(mem.has("rovlab:cache:v2:snapmanifest"), false);
});
