import { test } from "node:test";
import assert from "node:assert/strict";
import { buildForCoach, noBuildForCoach } from "../../src/features/heroes/buildCoachContext.ts";

// Run: node --experimental-strip-types --test tests/heroes/buildCoachContext.test.ts  (Node >= 22.6, no extra deps)
const item = (slug: string, nameTh: string, passive = "x".repeat(300)) => ({
  id: slug, slug, name: slug, nameTh, cost: 2000, stats: ["+60 พลังโจมตี", "+10% ลดคูลดาวน์"], passive, icon: "",
});
const items = [item("a-sword", "ดาบเอ"), item("b-boots", "รองเท้าบี")];
const build = {
  heroSlug: "h", patch: "13.08", source: "curated" as const, id: "b1", createdAt: "2026-08-13T10:00:00Z",
  items: [
    { itemSlug: "b-boots", reason: "เคลื่อนที่", phase: "early" as const },
    { itemSlug: "ghost-item", reason: "ไม่มีใน DB", phase: "core" as const }, // must be skipped, never invented
    { itemSlug: "a-sword", reason: "ดาเมจ", phase: "situational" as const },
  ],
  arcana: [{ name: "Sage", reason: "", color: "red" as const, quantity: 10 }],
};

test("C1 keeps item order, skips unknown slugs, uses Thai names and slug ids", () => {
  const ctx = buildForCoach(build, items, "27.09", { hero: "H" }) as any;
  assert.deepEqual(ctx.build.items.map((i: any) => [i.id, i.name]), [["b-boots", "รองเท้าบี"], ["a-sword", "ดาบเอ"]]);
  assert.equal(ctx.build.buildId, "b1");
  assert.equal(ctx.build.createdAt, "2026-08-13");
  assert.deepEqual(ctx.build.runes, [{ name: "Sage", color: "red", quantity: 10 }]);
  assert.equal(ctx.hero, "H");
});

test("C2 freshness: stale build is flagged, unknown latest patch is null", () => {
  assert.equal((buildForCoach(build, items, "27.09", {}) as any).build.patchIsLatest, false);
  assert.equal((buildForCoach(build, items, "13.08", {}) as any).build.patchIsLatest, true);
  assert.equal((buildForCoach(build, items, null, {}) as any).build.patchIsLatest, null);
});

test("C3 stays under the 7200-char budget without dropping items", () => {
  const bigItems = Array.from({ length: 60 }, (_, i) => item(`i${i}`, `ไอเทม${i}`));
  const bigBuild = { ...build, items: bigItems.map((it) => ({ itemSlug: it.slug, reason: "r".repeat(400), phase: "core" as const })) };
  const ctx = buildForCoach(bigBuild, bigItems, "13.08", { abilities: [] });
  assert.ok(JSON.stringify(ctx).length <= 7200, String(JSON.stringify(ctx).length));
  assert.equal((ctx as any).build.items.length, 60);
});

test("C4 no build: explicit available=false marker", () => {
  const ctx = noBuildForCoach({ hero: "H" }) as any;
  assert.equal(ctx.build.available, false);
  assert.equal(ctx.hero, "H");
});
