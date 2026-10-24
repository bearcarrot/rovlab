import { test } from "node:test";
import assert from "node:assert/strict";

// Run: node --experimental-strip-types --test tests/heroes/heroDetailReuse.test.ts
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
const { cached, peek, clearCache, setCacheBypass } = await import("../../src/lib/ttlCache.ts");
const { relationsForHero } = await import("../../src/lib/heroRelations.ts");
const TTL = 60_000;

test("R1 peek never starts a load and ignores in-flight values", async () => {
  clearCache("");
  assert.equal(peek("draft-relations", TTL), undefined);
  let release!: (v: number) => void;
  const p = cached("draft-relations", TTL, () => new Promise<number>((r) => (release = r)));
  assert.equal(peek("draft-relations", TTL), undefined); // still loading
  release(7);
  await p;
  assert.equal(peek("draft-relations", TTL), 7);
});

test("R2 concurrent callers share one load; a failure is retried and never peeked", async () => {
  clearCache("");
  let calls = 0;
  const load = async () => {
    calls++;
    if (calls === 1) throw new Error("boom");
    return "ok";
  };
  const [a, b] = await Promise.allSettled([cached("heroes:all", TTL, load), cached("heroes:all", TTL, load)]);
  assert.equal(calls, 1);
  assert.equal(a.status, "rejected");
  assert.equal(b.status, "rejected");
  assert.equal(peek("heroes:all", TTL), undefined);
  assert.equal(await cached("heroes:all", TTL, load), "ok");
  assert.equal(calls, 2);
});

test("R3 keep() veto, bypass and clearCache all hide the value from peek", async () => {
  clearCache("");
  await cached("heroes:all", TTL, async () => null, (v) => v !== null);
  assert.equal(peek("heroes:all", TTL), undefined);
  await cached("heroes:all", TTL, async () => ["x"]);
  assert.deepEqual(peek("heroes:all", TTL), ["x"]);
  setCacheBypass(true);
  assert.equal(peek("heroes:all", TTL), undefined);
  setCacheBypass(false);
  clearCache("heroes:");
  assert.equal(peek("heroes:all", TTL), undefined);
});

test("R4 peek reads a persisted public key after a reload, but never a per-user key", async () => {
  clearCache("");
  await cached("draft-relations", TTL, async () => ({ n: 1 }));
  await cached("favorites:u1", TTL, async () => ({ n: 2 }));
  const saved = new Map(mem);
  clearCache("");
  mem.clear();
  for (const [k, v] of saved) mem.set(k, v);
  assert.deepEqual(peek("draft-relations", TTL), { n: 1 });
  assert.equal(peek("favorites:u1", TTL), undefined);
});

const heroes = ["a", "b", "c"].map((id) => ({ id, slug: `s-${id}`, name: `N${id}`, icon: id === "c" ? "" : `i-${id}` }));
const rel = {
  counters: [
    { victimId: "a", counterId: "b", strength: "best" as const, reason: "r1", laneTip: "t1" },
    { victimId: "c", counterId: "a", strength: "good" as const, reason: "r2", laneTip: "" },
  ],
  synergies: [
    { heroId: "a", partnerId: "c", reason: "s1" },
    { heroId: "b", partnerId: "a", reason: "s2" }, // other direction: not hero a's row
  ],
};

test("R5 relationsForHero maps one hero's rows like the per-hero queries", () => {
  const r = relationsForHero("a", rel, heroes)!;
  assert.deepEqual(r.counteredBy, [{ heroSlug: "s-b", heroNameTh: "Nb", heroIcon: "i-b", strength: "best", reason: "r1", laneTip: "t1" }]);
  assert.deepEqual(r.countersAgainst, [{ heroSlug: "s-c", heroNameTh: "Nc", heroIcon: undefined, strength: "good", reason: "r2", laneTip: "" }]);
  assert.deepEqual(r.synergies, [{ heroSlug: "s-c", heroNameTh: "Nc", heroIcon: undefined, reason: "s1" }]);
});

test("R6 relationsForHero returns null when a hero is missing from the list (caller falls back to queries)", () => {
  assert.equal(relationsForHero("a", rel, heroes.filter((h) => h.id !== "b")), null);
});
