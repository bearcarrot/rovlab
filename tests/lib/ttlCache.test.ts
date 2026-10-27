import { test } from "node:test";
import assert from "node:assert/strict";
import { cached, peek, setCacheBypass } from "../../src/lib/ttlCache.ts";

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

const HOUR = 60 * 60 * 1000;
// pre-seed a persisted entry written `ageMs` ago, as an earlier page view would have left it
const seed = (key: string, ageMs: number, v: unknown) => mem.set(`rovlab:cache:v2:${key}`, JSON.stringify({ at: Date.now() - ageMs, v }));

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

test("hero list and draft relations stay cached for hours, not 15 minutes", async () => {
  for (const key of ["heroes:t-fresh", "draft-relations"]) {
    seed(key, 3 * HOUR, ["old"]);
    let calls = 0;
    const v = await cached(key, 1000, async () => {
      calls++;
      return ["new"];
    });
    assert.deepEqual(v, ["old"], `${key} aged 3 h should still be served from storage`);
    assert.equal(calls, 0);
  }
});

test("hero list older than 6 hours is reloaded", async () => {
  seed("heroes:t-stale", 7 * HOUR, ["old"]);
  let calls = 0;
  const v = await cached("heroes:t-stale", 1000, async () => {
    calls++;
    return ["new"];
  });
  assert.deepEqual(v, ["new"]);
  assert.equal(calls, 1);
});

test("other persisted keys keep the 15 minute limit", async () => {
  seed("guide:t-old", 3 * HOUR, ["old"]);
  let calls = 0;
  const v = await cached("guide:t-old", 1000, async () => {
    calls++;
    return ["new"];
  });
  assert.deepEqual(v, ["new"]);
  assert.equal(calls, 1);
});

test("peek returns a persisted hero list older than the in-memory TTL, but never for non-persisted keys", () => {
  seed("heroes:t-peek", 3 * HOUR, ["listed"]);
  assert.deepEqual(peek("heroes:t-peek", 5 * 60 * 1000), ["listed"]);
  assert.equal(peek("heroes:t-missing", 5 * 60 * 1000), undefined);
  assert.equal(peek("not-persisted-key", 5 * 60 * 1000), undefined);
});
