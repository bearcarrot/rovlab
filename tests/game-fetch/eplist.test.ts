import { test } from "node:test";
import assert from "node:assert/strict";
import { epError, itopError, parseEpList as parseFn } from "../../supabase/functions/game-fetch/eplist.ts";
import { epAge, epExpired, epTail, parseEpList, parseEpText } from "../../src/lib/epList.ts";

// Run: node --experimental-strip-types --test tests/game-fetch/eplist.test.ts  (Node >= 22.6, no extra deps)
// ค่า EP ในเทสต์เป็นข้อความสมมติ ไม่ใช่ค่าจริง

for (const [name, parse] of [["function", parseFn], ["web", parseEpList]] as const) {
  test(`E1 [${name}] supports the three ep.json shapes of index.php`, () => {
    assert.deepEqual(parse(["aaa", " bbb "]).map((e) => [e.label, e.value]), [["EP 1", "aaa"], ["EP 2", "bbb"]]);
    assert.deepEqual(parse([{ label: "A", value: "x" }, { value: "y" }]).map((e) => [e.label, e.value]), [["A", "x"], ["EP 2", "y"]]);
    assert.deepEqual(parse({ A: "x", B: "y" }).map((e) => [e.label, e.value]), [["A", "x"], ["B", "y"]]);
  });

  test(`E2 [${name}] skips empty/invalid entries and reads "at" only when it is a positive number`, () => {
    const r = parse([{ label: "A", value: "x", at: 1760000000000 }, { label: "B", value: "y", at: "nope" }, { value: "  " }, "", 5, null]);
    assert.deepEqual(r.map((e) => [e.label, e.at]), [["A", 1760000000000], ["B", null]]);
    assert.deepEqual(parse("not a list"), []);
    assert.deepEqual(parse(null), []);
  });

  test(`E7 [${name}] keeps "itop" only when it is a non-empty string (key omitted otherwise)`, () => {
    const r = parse([
      { label: "A", value: "x", itop: " ii " },
      { label: "B", value: "y", itop: "  " },
      { label: "C", value: "z" },
      { label: "D", value: "w", itop: 5 },
      "plain",
    ]);
    assert.equal(r[0].itop, "ii");
    for (const e of r.slice(1)) assert.equal("itop" in e, false);
  });
}

test("E3 parseEpText stamps import time when ep.json has no 'at', keeps it when present", () => {
  const r = parseEpText('[{"label":"A","value":"x","at":1000},{"label":"B","value":"y"}]', 5000);
  assert.deepEqual(r, [{ label: "A", value: "x", at: 1000 }, { label: "B", value: "y", at: 5000, est: true }]);
});

test("E4 parseEpText fails with a readable error", () => {
  assert.throws(() => parseEpText("{oops"), /JSON/);
  assert.throws(() => parseEpText("[]"), /ไม่พบ/);
  assert.equal(parseEpText("\uFEFF[\"x\"]", 1).length, 1);
});

test("E5 age label and 24h expiry", () => {
  const now = 10_000_000_000;
  assert.equal(epAge(now - 5 * 60000, now), "5 นาที");
  assert.equal(epAge(now - 90 * 60000, now), "1.5 ชม.");
  assert.equal(epExpired(now - 23 * 3600000, now), false);
  assert.equal(epExpired(now - 25 * 3600000, now), true);
  assert.equal(epTail("abcdefghij"), "efghij");
});

test("E6 epError rejects empty, oversized and control characters", () => {
  assert.equal(epError("abc123"), null);
  assert.ok(epError(""));
  assert.ok(epError(undefined));
  assert.ok(epError("a".repeat(4097)));
  assert.ok(epError("abc\r\nX-Evil: 1"));
});

test("E8 parseEpText carries itop of each pair into the stored item", () => {
  const r = parseEpText('[{"label":"A","value":"x","at":1,"itop":"ii"},{"label":"B","value":"y","at":2}]', 5);
  assert.deepEqual(r, [{ label: "A", value: "x", at: 1, itop: "ii" }, { label: "B", value: "y", at: 2 }]);
});

test("E9 itopError is optional but rejects oversized and control characters", () => {
  assert.equal(itopError(undefined), null);
  assert.equal(itopError(""), null);
  assert.equal(itopError("ABC123"), null);
  assert.ok(itopError(5));
  assert.ok(itopError("a".repeat(4097)));
  assert.ok(itopError("abc\r\nX-Evil: 1"));
});
