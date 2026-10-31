import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isHalloweenActive,
  msUntilHalloweenEnd,
  HALLOWEEN_START_MS,
  HALLOWEEN_END_MS,
} from "../../src/features/seasonal/halloween.ts";

// Run: node --experimental-strip-types --test tests/seasonal/halloween.test.ts  (Node >= 22.6)
// ช่วงเปิด = 31 ต.ค. 2026 00:00 → ก่อน 1 พ.ย. 2026 00:00 ตามเวลาท้องถิ่นของเครื่อง (ทดสอบด้วย new Date(y,m,d,...) แบบ local เหมือนโค้ดจริง)
const local = (m: number, d: number, h = 0, mi = 0, s = 0, ms = 0) => new Date(2026, m, d, h, mi, s, ms);

test("H1 window is exactly one local day and start < end", () => {
  assert.ok(HALLOWEEN_START_MS < HALLOWEEN_END_MS);
  assert.equal(HALLOWEEN_START_MS, local(9, 31).getTime());
  assert.equal(HALLOWEEN_END_MS, local(10, 1).getTime());
});
test("H2 30 Oct 23:59:59.999 is not active", () => {
  assert.equal(isHalloweenActive(local(9, 30, 23, 59, 59, 999)), false);
});
test("H3 31 Oct 00:00:00.000 is active (start inclusive)", () => {
  assert.equal(isHalloweenActive(local(9, 31)), true);
});
test("H4 midday 31 Oct is active", () => {
  assert.equal(isHalloweenActive(local(9, 31, 12)), true);
});
test("H5 31 Oct 23:59:59.999 is active", () => {
  assert.equal(isHalloweenActive(local(9, 31, 23, 59, 59, 999)), true);
});
test("H6 1 Nov 00:00:00.000 is not active (end exclusive)", () => {
  assert.equal(isHalloweenActive(local(10, 1)), false);
});
test("H7 later dates and other years are not active", () => {
  assert.equal(isHalloweenActive(local(10, 15)), false);
  assert.equal(isHalloweenActive(new Date(2027, 9, 31, 12)), false);
  assert.equal(isHalloweenActive(new Date(2025, 9, 31, 12)), false);
});
test("H8 kill switch: enabled=false is never active, even inside the window", () => {
  assert.equal(isHalloweenActive(local(9, 31, 12), false), false);
  assert.equal(msUntilHalloweenEnd(local(9, 31, 12), false), null);
});
test("H9 accepts Date or epoch ms; invalid time is not active", () => {
  assert.equal(isHalloweenActive(local(9, 31, 12).getTime()), true);
  assert.equal(isHalloweenActive(new Date(NaN)), false);
  assert.equal(isHalloweenActive(NaN), false);
});
test("H10 msUntilHalloweenEnd: remaining ms inside window, null outside", () => {
  assert.equal(msUntilHalloweenEnd(HALLOWEEN_END_MS - 1000), 1000);
  assert.equal(msUntilHalloweenEnd(HALLOWEEN_START_MS), HALLOWEEN_END_MS - HALLOWEEN_START_MS);
  assert.equal(msUntilHalloweenEnd(HALLOWEEN_START_MS - 1), null);
  assert.equal(msUntilHalloweenEnd(HALLOWEEN_END_MS), null);
});
