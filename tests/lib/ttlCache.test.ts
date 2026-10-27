import { test } from "node:test";
import assert from "node:assert/strict";
import { cached, setCacheBypass } from "../../src/lib/ttlCache.ts";

// Run: node --experimental-strip-types --test tests/lib/ttlCache.test.ts

// Minimal in-memory localStorage so the persisted-prefix test can run under plain node.
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

test("bypass (admin): concurrent callers share one in-flight load; a later call loads again", async () => {
  setCacheBypass(true);
  try {
    let calls = 0;
    const load = async () => {
      calls++;
      await Promise.resolve();
      return calls;
    };
    const [a, b, c] = await Promise.all([cached("k", 1000, load), cached("k", 1000, load), cached("k", 1000, load)]);
    assert.equal(calls, 1);
    assert.deepEqual([a, b, c], [1, 1, 1]);
    assert.equal(await cached("k", 1000, load), 2); // finished results are never reused while bypassed
    assert.equal(calls, 2);
  } finally {
    setCacheBypass(false);
  }
});

test("bypass: a failed load is not shared with later callers", async () => {
  setCacheBypass(true);
  try {
    let calls = 0;
    const load = async () => {
      calls++;
      if (calls === 1) throw new Error("boom");
      return calls;
    };
    await assert.rejects(cached("k2", 1000, load));
    assert.equal(await cached("k2", 1000, load), 2);
  } finally {
    setCacheBypass(false);
  }
});

test("guide list, categories and detail are persisted to localStorage (public data, survives a reload)", async () => {
  for (const key of ["guides", "guide-categories", "guide:macro-basics"]) {
    await cached(key, 1000, async () => [{ id: key }]);
    assert.ok(mem.has(`rovlab:cache:v2:${key}`), `${key} should be written to localStorage`);
  }
});

test("per-user style keys are not persisted", async () => {
  await cached("my-builds:u1", 1000, async () => [1]);
  assert.equal(mem.has("rovlab:cache:v2:my-builds:u1"), false);
});
