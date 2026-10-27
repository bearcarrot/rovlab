import { test } from "node:test";
import assert from "node:assert/strict";
import { cached, setCacheBypass } from "../../src/lib/ttlCache.ts";

// Run: node --experimental-strip-types --test tests/lib/ttlCache.test.ts

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
