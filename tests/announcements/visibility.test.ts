import { test } from "node:test";
import assert from "node:assert/strict";
import { isVisible, sortAnnouncements, selectVisible } from "../../src/features/announcements/visibility.ts";
import type { Announcement } from "../../src/features/announcements/types.ts";

// Run: node --experimental-strip-types --test tests/announcements/visibility.test.ts  (Node >= 22.6)
const NOW = Date.parse("2026-10-17T05:00:00.000Z");
const none = new Set<string>();
const mk = (o: Partial<Announcement> & { id: string }): Announcement => ({
  title: "t", content: "", media_type: "none", media_url: null, link_url: null, link_label: null,
  status: "published", priority: "normal", is_dismissible: true, starts_at: null, ends_at: null,
  created_at: "2026-10-01T00:00:00.000Z", updated_at: "2026-10-01T00:00:00.000Z", ...o,
});

test("V1 only published announcements are visible", () => {
  assert.equal(isVisible(mk({ id: "a" }), NOW, none), true);
  assert.equal(isVisible(mk({ id: "a", status: "draft" }), NOW, none), false);
  assert.equal(isVisible(mk({ id: "a", status: "archived" }), NOW, none), false);
});
test("V2 schedule window: start inclusive, end exclusive, null dates open", () => {
  assert.equal(isVisible(mk({ id: "a", starts_at: "2026-10-17T05:00:00.000Z" }), NOW, none), true);
  assert.equal(isVisible(mk({ id: "a", starts_at: "2026-10-17T05:00:00.001Z" }), NOW, none), false);
  assert.equal(isVisible(mk({ id: "a", ends_at: "2026-10-17T05:00:00.000Z" }), NOW, none), false);
  assert.equal(isVisible(mk({ id: "a", ends_at: "2026-10-17T05:00:00.001Z" }), NOW, none), true);
  assert.equal(isVisible(mk({ id: "a", ends_at: "2026-10-16T00:00:00.000Z" }), NOW, none), false);
  assert.equal(isVisible(mk({ id: "a", starts_at: null, ends_at: null }), NOW, none), true);
});
test("V3 a dismissed id is hidden while a new id stays visible", () => {
  const dismissed = new Set(["old"]);
  assert.equal(isVisible(mk({ id: "old" }), NOW, dismissed), false);
  assert.equal(isVisible(mk({ id: "new" }), NOW, dismissed), true);
});
test("V4 dismissal survives status changes of the same id (draft -> published)", () => {
  const dismissed = new Set(["x"]);
  assert.equal(isVisible(mk({ id: "x", status: "draft" }), NOW, dismissed), false);
  assert.equal(isVisible(mk({ id: "x", status: "published" }), NOW, dismissed), false);
});
test("V5 is_dismissible does not change isVisible; the dismissed set alone decides", () => {
  assert.equal(isVisible(mk({ id: "a", is_dismissible: false }), NOW, none), true);
  assert.equal(isVisible(mk({ id: "a", is_dismissible: false }), NOW, new Set(["a"])), false);
});
test("V6 order: urgent, important, normal; then newest starts_at ?? created_at; then id", () => {
  const list = [
    mk({ id: "n-old", priority: "normal", created_at: "2026-10-01T00:00:00.000Z" }),
    mk({ id: "u", priority: "urgent", created_at: "2026-09-01T00:00:00.000Z" }),
    mk({ id: "n-new", priority: "normal", starts_at: "2026-10-10T00:00:00.000Z" }),
    mk({ id: "i", priority: "important" }),
    mk({ id: "tie-b", priority: "important", created_at: "2026-10-05T00:00:00.000Z", starts_at: "2026-10-12T00:00:00.000Z" }),
    mk({ id: "tie-a", priority: "important", created_at: "2026-10-06T00:00:00.000Z", starts_at: "2026-10-12T00:00:00.000Z" }),
  ];
  const ids = sortAnnouncements(list).map((a) => a.id);
  assert.deepEqual(ids, ["u", "tie-a", "tie-b", "i", "n-new", "n-old"]);
  assert.deepEqual(sortAnnouncements([...list].reverse()).map((a) => a.id), ids); // deterministic regardless of input order
});
test("V7 sortAnnouncements does not mutate its input", () => {
  const list = [mk({ id: "b" }), mk({ id: "a" })];
  sortAnnouncements(list);
  assert.deepEqual(list.map((a) => a.id), ["b", "a"]);
});
test("V8 selectVisible shows at most 3 and puts the rest in `more`; hidden items are excluded", () => {
  const list = [1, 2, 3, 4, 5].map((n) => mk({ id: `p${n}`, created_at: `2026-10-0${n}T00:00:00.000Z` }));
  list.push(mk({ id: "draft", status: "draft" }), mk({ id: "gone" }));
  const r = selectVisible(list, NOW, new Set(["gone"]));
  assert.deepEqual(r.shown.map((a) => a.id), ["p5", "p4", "p3"]);
  assert.deepEqual(r.more.map((a) => a.id), ["p2", "p1"]);
});
