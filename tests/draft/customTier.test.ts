import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCustomTierMap, textColorFor } from "../../src/features/draft/customTier.ts";

test("textColorFor picks readable text for any row color", () => {
  assert.equal(textColorFor("#EAB308"), "#000000"); // yellow
  assert.equal(textColorFor("#FFFFFF"), "#000000");
  assert.equal(textColorFor("#1E3A8A"), "#FFFFFF"); // dark blue
  assert.equal(textColorFor("#000000"), "#FFFFFF");
  assert.equal(textColorFor("red"), "#FFFFFF"); // not #RRGGBB
});

test("buildCustomTierMap maps hero id to its row; unlisted heroes are absent", () => {
  const m = buildCustomTierMap([
    { id: "s", label: "S", color: "#F97316", heroes: ["a", "b"] },
    { id: "x", label: "ตัวเลือก", color: "#1E3A8A", heroes: ["c"] },
  ]);
  assert.equal(m.get("a")?.label, "S");
  assert.equal(m.get("a")?.fg, "#000000");
  assert.equal(m.get("c")?.label, "ตัวเลือก");
  assert.equal(m.get("c")?.fg, "#FFFFFF");
  assert.equal(m.get("d"), undefined);
});

test("a hero listed twice keeps the first (higher) row", () => {
  const m = buildCustomTierMap([
    { id: "s", label: "S", color: "#F97316", heroes: ["a"] },
    { id: "b", label: "B", color: "#22C55E", heroes: ["a"] },
  ]);
  assert.equal(m.get("a")?.label, "S");
});
