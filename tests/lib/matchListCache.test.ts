import { test } from "node:test";
import assert from "node:assert/strict";
import { createMatchListCache, MATCH_LIST_TTL_MS } from "../../src/lib/matchListCache.ts";
import type { MatchRecord } from "../../src/types/match.ts";

// Run: node --experimental-strip-types --test tests/lib/matchListCache.test.ts
const rec = (id: string, playedAt: string) => ({ id, playedAt }) as unknown as MatchRecord;
const ids = (rows: MatchRecord[] | null) => (rows ? rows.map((r) => r.id) : null);
// newest first, like listMyMatches
const m3 = () => [rec("c", "2026-10-03T20:00:00"), rec("b", "2026-10-02T20:00:00"), rec("a", "2026-10-01T20:00:00")];

function setup() {
  let t = 1_000;
  const cache = createMatchListCache(MATCH_LIST_TTL_MS, () => t);
  return { cache, tick: (ms: number) => (t += ms) };
}
const fill = (cache: ReturnType<typeof createMatchListCache>, limit: number, rows: MatchRecord[], u = "u1") =>
  cache.put(u, limit, rows, cache.begin());

test("nothing cached: the caller has to fetch", () => {
  assert.equal(setup().cache.get("u1", 20), null);
});

test("a complete list (fewer rows than the limit it was fetched with) answers any limit", () => {
  const { cache } = setup();
  fill(cache, 100, m3());
  assert.deepEqual(ids(cache.get("u1", 20)), ["c", "b", "a"]);
  assert.deepEqual(ids(cache.get("u1", 100)), ["c", "b", "a"]);
  assert.deepEqual(ids(cache.get("u1", 2)), ["c", "b"]);
});

test("a full list answers only up to its own size (it may hide older matches)", () => {
  const { cache } = setup();
  fill(cache, 3, m3());
  assert.deepEqual(ids(cache.get("u1", 2)), ["c", "b"]);
  assert.deepEqual(ids(cache.get("u1", 3)), ["c", "b", "a"]);
  assert.equal(cache.get("u1", 5), null);
});

test("the copy expires after the lifetime", () => {
  const { cache, tick } = setup();
  fill(cache, 100, m3());
  tick(MATCH_LIST_TTL_MS - 1);
  assert.notEqual(cache.get("u1", 20), null);
  tick(1);
  assert.equal(cache.get("u1", 20), null);
});

test("never served to another user, and that user's copy is dropped", () => {
  const { cache } = setup();
  fill(cache, 100, m3());
  assert.equal(cache.get("u2", 20), null);
  assert.equal(cache.get("u1", 20), null);
});

test("a saved match goes in newest-first and the list stays within its limit", () => {
  const { cache } = setup();
  fill(cache, 3, m3());
  cache.add("u1", rec("d", "2026-10-04T20:00:00"));
  assert.deepEqual(ids(cache.get("u1", 3)), ["d", "c", "b"]);
  cache.add("u1", rec("old", "2026-09-01T20:00:00")); // older than everything kept: not in the newest 3
  assert.deepEqual(ids(cache.get("u1", 3)), ["d", "c", "b"]);
  cache.add("u1", rec("mid", "2026-10-03T21:00:00"));
  assert.deepEqual(ids(cache.get("u1", 3)), ["d", "mid", "c"]);
});

test("a saved match in a complete list simply joins it; saving the same id twice does not duplicate it", () => {
  const { cache } = setup();
  fill(cache, 100, m3());
  cache.add("u1", rec("d", "2026-10-04T20:00:00"));
  cache.add("u1", rec("d", "2026-10-04T20:00:00"));
  assert.deepEqual(ids(cache.get("u1", 100)), ["d", "c", "b", "a"]);
});

test("saving with nothing cached does not create a partial copy", () => {
  const { cache } = setup();
  cache.add("u1", rec("d", "2026-10-04T20:00:00"));
  assert.equal(cache.get("u1", 20), null);
});

test("a deleted match leaves a complete list; a full list is forgotten instead", () => {
  const { cache } = setup();
  fill(cache, 100, m3());
  cache.remove("u1", "b");
  assert.deepEqual(ids(cache.get("u1", 100)), ["c", "a"]);

  fill(cache, 3, m3());
  cache.remove("u1", "b");
  assert.equal(cache.get("u1", 3), null); // an older match may now belong in the list: fetch again
});

test("an answer that was already on its way when a save/delete happened is not stored", () => {
  const { cache } = setup();
  const started = cache.begin();
  cache.add("u1", rec("d", "2026-10-04T20:00:00"));
  cache.put("u1", 100, m3(), started); // stale: fetched before the save
  assert.equal(cache.get("u1", 20), null);

  const started2 = cache.begin();
  cache.put("u1", 100, m3(), started2);
  assert.notEqual(cache.get("u1", 20), null);
});

test("saving or deleting does not extend the lifetime of the copy", () => {
  const { cache, tick } = setup();
  fill(cache, 100, m3());
  tick(MATCH_LIST_TTL_MS - 10);
  cache.add("u1", rec("d", "2026-10-04T20:00:00"));
  tick(10);
  assert.equal(cache.get("u1", 20), null);
});

test("clear forgets everything; callers cannot change the stored copy", () => {
  const { cache } = setup();
  fill(cache, 100, m3());
  const got = cache.get("u1", 20)!;
  got.pop();
  assert.deepEqual(ids(cache.get("u1", 20)), ["c", "b", "a"]);
  cache.clear();
  assert.equal(cache.get("u1", 20), null);
});
