import { test } from "node:test";
import assert from "node:assert/strict";
import { bangkokLocalToIso, isoToBangkokLocal } from "../../src/features/announcements/time.ts";

// Run: node --experimental-strip-types --test tests/announcements/time.test.ts  (Node >= 22.6)
test("T1 Bangkok local midnight maps to the previous UTC day at 17:00", () => {
  assert.equal(bangkokLocalToIso("2026-10-17T00:00"), "2026-10-16T17:00:00.000Z");
});
test("T1 times just before and after Bangkok midnight", () => {
  assert.equal(bangkokLocalToIso("2026-10-16T23:59"), "2026-10-16T16:59:00.000Z");
  assert.equal(bangkokLocalToIso("2026-10-17T00:30"), "2026-10-16T17:30:00.000Z");
});
test("T1 UTC instant converts back to Bangkok local", () => {
  assert.equal(isoToBangkokLocal("2026-10-16T17:00:00.000Z"), "2026-10-17T00:00");
});
test("T1 round trip over several values (incl. month/year boundaries)", () => {
  for (const v of ["2026-01-01T00:00", "2026-12-31T23:59", "2026-02-28T06:15", "2028-02-29T00:00", "2026-10-17T12:00", "2026-03-01T03:07"]) {
    assert.equal(isoToBangkokLocal(bangkokLocalToIso(v)), v);
  }
});
test("T1 malformed input throws", () => {
  assert.throws(() => bangkokLocalToIso(""));
  assert.throws(() => bangkokLocalToIso("2026-13-01T00:00"));
  assert.throws(() => bangkokLocalToIso("2026-02-30T00:00"));
});
