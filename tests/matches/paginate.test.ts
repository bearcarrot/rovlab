import { test } from "node:test";
import assert from "node:assert/strict";
import { PAGE_SIZE, clampPage, pageCount, pageSlice } from "../../src/features/matches/paginate.ts";

// Run: node --experimental-strip-types --test tests/matches/paginate.test.ts
const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

test("page size is 20 and there is always at least one page", () => {
  assert.equal(PAGE_SIZE, 20);
  assert.equal(pageCount(0), 1);
  assert.equal(pageCount(1), 1);
  assert.equal(pageCount(20), 1);
  assert.equal(pageCount(21), 2);
  assert.equal(pageCount(100), 5);
  assert.equal(pageCount(101), 6);
  assert.equal(pageCount(-5), 1);
});

test("slices 20 per page and the last page holds the rest", () => {
  const all = range(45);
  assert.deepEqual(pageSlice(all, 1), range(20));
  assert.deepEqual(pageSlice(all, 2), range(40).slice(20));
  assert.deepEqual(pageSlice(all, 3), [41, 42, 43, 44, 45]);
});

test("exactly one full page gives no second page", () => {
  assert.equal(pageSlice(range(20), 1).length, 20);
  assert.deepEqual(pageSlice(range(20), 2), range(20)); // out of range falls back to the last page
});

test("an out-of-range page is clamped (deleting the last item of the last page, refetch shrinking the list)", () => {
  assert.equal(clampPage(3, 40), 2);
  assert.equal(clampPage(5, 0), 1);
  assert.equal(clampPage(0, 100), 1);
  assert.equal(clampPage(-2, 100), 1);
  assert.equal(clampPage(Number.NaN, 100), 1);
  assert.equal(clampPage(2.7, 100), 2);
  assert.deepEqual(pageSlice(range(40), 3), range(40).slice(20));
});

test("an empty list gives an empty page, and the input is not modified", () => {
  assert.deepEqual(pageSlice([], 1), []);
  const all = range(25);
  pageSlice(all, 2);
  assert.deepEqual(all, range(25));
});

test("a custom page size works", () => {
  assert.equal(pageCount(10, 3), 4);
  assert.deepEqual(pageSlice(range(10), 4, 3), [10]);
});
