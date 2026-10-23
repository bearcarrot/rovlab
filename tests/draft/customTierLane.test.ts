import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveCustomTiers } from "../../src/features/draft/customTier.ts";
import { parseLanes, type TierLanes } from "../../src/features/tierlist/tierData.ts";

const lane = (id: string, rows: { id: string; label: string; color: string; heroes: string[] }[]) => ({ id, rows });
const multi: TierLanes = parseLanes({
  v: 3,
  lanes: [
    lane("jungle", [{ id: "s", label: "S", color: "#FF0000", heroes: ["h1", "h2"] }]),
    lane("mid", [{ id: "a", label: "A", color: "#00FF00", heroes: ["h2", "h3"] }]),
  ],
});

test("single lane (incl. an old list opened as lane \"all\") works with no lane choice, like before", () => {
  const legacy = parseLanes({ "S+": ["h1"], A: ["h2"] });
  const r = resolveCustomTiers(legacy, null);
  assert.equal(r.needsLane, false);
  assert.equal(r.map?.get("h1")?.label, "S+");
  assert.equal(r.map?.get("h2")?.label, "A");
  assert.equal(resolveCustomTiers(legacy, "jungle").map?.get("h1")?.label, "S+"); // a stale lane choice is irrelevant
});

test("multi-lane without a chosen lane: no silent first-lane pick, no merged ranking", () => {
  const r = resolveCustomTiers(multi, null);
  assert.equal(r.map, null);
  assert.equal(r.needsLane, true);
  assert.equal(resolveCustomTiers(multi, "roaming").needsLane, true); // lane that does not exist in this list
});

test("mapping uses only the selected lane and changes when the lane changes", () => {
  const jungle = resolveCustomTiers(multi, "jungle").map!;
  const mid = resolveCustomTiers(multi, "mid").map!;
  assert.equal(jungle.get("h1")?.label, "S");
  assert.equal(mid.get("h1"), undefined); // h1 is ranked only in jungle: mid does not borrow it
  assert.equal(jungle.get("h3"), undefined);
  assert.equal(jungle.get("h2")?.color, "#FF0000"); // same hero, different tier per lane
  assert.equal(mid.get("h2")?.label, "A");
  assert.equal(mid.get("h2")?.color, "#00FF00");
  assert.equal(mid.get("h3")?.label, "A");
});

test("empty list of lanes degrades to stats (no map, no lane prompt)", () => {
  assert.deepEqual(resolveCustomTiers([], null), { map: null, needsLane: false });
});
