import { test } from "node:test";
import assert from "node:assert/strict";
import { codePointLength, switchMediaType, validateForm, ERROR_TH, type FormValues } from "../../src/features/announcements/form.ts";
import { mediaError } from "../../src/features/announcements/media.ts";
import { bangkokLocalToIso } from "../../src/features/announcements/time.ts";

// Run: node --experimental-strip-types --test tests/announcements/form.test.ts  (Node >= 22.6)
const deps = { mediaError, bangkokLocalToIso };
const base: FormValues = { title: "ประกาศ", content: "", mediaType: "none", mediaUrl: "", linkUrl: "", linkLabel: "", priority: "normal", isDismissible: true, startsLocal: "", endsLocal: "" };
const v = (o: Partial<FormValues>): FormValues => ({ ...base, ...o });

test("F1 codePointLength counts code points, not UTF-16 units", () => {
  assert.equal(codePointLength("😀"), 1);
  assert.equal(codePointLength("ที่"), Array.from("ที่").length);
  assert.equal(codePointLength(""), 0);
});
test("F2 title: 120 emoji code points valid, 121 invalid, empty invalid", () => {
  assert.equal(validateForm(v({ title: "😀".repeat(120) }), deps).ok, true);
  const r121 = validateForm(v({ title: "😀".repeat(121) }), deps);
  assert.equal(r121.ok, false);
  if (!r121.ok) assert.equal(r121.errors.title, ERROR_TH.INVALID_TITLE);
  const empty = validateForm(v({ title: "   " }), deps);
  assert.equal(empty.ok, false);
});
test("F3 content over 4000 code points is rejected; padding is trimmed on all text fields", () => {
  const long = validateForm(v({ content: "a".repeat(4001) }), deps);
  assert.equal(long.ok, false);
  if (!long.ok) assert.equal(long.errors.content, ERROR_TH.INVALID_CONTENT);
  const ok = validateForm(v({ title: "  hi\n", content: "\n line1\nline2  ", mediaType: "image", mediaUrl: "  https://example.com/a.png\n" }), deps);
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.input.title, "hi");
    assert.equal(ok.input.content, "line1\nline2");
    assert.equal(ok.input.mediaUrl, "https://example.com/a.png");
  }
});
test("F4 switchMediaType clears fields the new type does not allow", () => {
  const img = v({ mediaType: "image", mediaUrl: "https://example.com/a.png", linkUrl: "https://example.com/x", linkLabel: "ดู" });
  const none = switchMediaType(img, "none");
  assert.equal(none.mediaType, "none");
  assert.equal(none.mediaUrl, "");
  assert.equal(none.linkUrl, "https://example.com/x");
  const link = switchMediaType(img, "link");
  assert.equal(link.mediaUrl, "https://example.com/a.png");
  assert.equal(link.linkUrl, "");
  assert.equal(link.linkLabel, "ดู");
});
test("F5 schedule: end must be after start; empty means null; Bangkok conversion applied", () => {
  const bad = validateForm(v({ startsLocal: "2026-10-17T10:00", endsLocal: "2026-10-17T10:00" }), deps);
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.equal(bad.errors.endsLocal, ERROR_TH.INVALID_SCHEDULE);
  const earlier = validateForm(v({ startsLocal: "2026-10-17T10:00", endsLocal: "2026-10-17T09:59" }), deps);
  assert.equal(earlier.ok, false);
  const none = validateForm(v({}), deps);
  assert.ok(none.ok && none.input.startsAt === null && none.input.endsAt === null);
  const ok = validateForm(v({ startsLocal: "2026-10-17T00:00", endsLocal: "2026-10-18T00:00" }), deps);
  assert.ok(ok.ok);
  if (ok.ok) { assert.equal(ok.input.startsAt, "2026-10-16T17:00:00.000Z"); assert.equal(ok.input.endsAt, "2026-10-17T17:00:00.000Z"); }
  const junk = validateForm(v({ startsLocal: "not-a-date" }), deps);
  assert.equal(junk.ok, false);
  if (!junk.ok) assert.equal(junk.errors.startsLocal, ERROR_TH.INVALID_SCHEDULE);
});
test("F6 media errors land on the right field", () => {
  const a = validateForm(v({ mediaType: "image", mediaUrl: "http://example.com/a.png" }), deps);
  assert.ok(!a.ok && a.errors.mediaUrl === ERROR_TH.MEDIA_URL_INVALID);
  const b = validateForm(v({ linkUrl: "http://example.com/x" }), deps);
  assert.ok(!b.ok && b.errors.linkUrl === ERROR_TH.MEDIA_URL_INVALID && b.errors.mediaUrl === undefined);
  const c = validateForm(v({ linkLabel: "ดูเพิ่มเติม" }), deps);
  assert.ok(!c.ok && c.errors.linkLabel === ERROR_TH.LABEL_WITHOUT_LINK);
  const d = validateForm(v({ linkUrl: "https://example.com/x", linkLabel: "a".repeat(41) }), deps);
  assert.ok(!d.ok && d.errors.linkLabel === ERROR_TH.LABEL_TOO_LONG);
  const e = validateForm(v({ mediaType: "video", mediaUrl: "https://example.com/page" }), deps);
  assert.ok(!e.ok && e.errors.mediaUrl === ERROR_TH.VIDEO_UNSUPPORTED);
});
test("F7 a valid link announcement builds the RPC input with nulls for empty optionals", () => {
  const r = validateForm(v({ mediaType: "link", mediaUrl: "https://example.com/page", linkLabel: "อ่านต่อ", priority: "urgent", isDismissible: false }), deps);
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(r.input, { title: "ประกาศ", content: "", mediaType: "link", mediaUrl: "https://example.com/page", linkUrl: null, linkLabel: "อ่านต่อ", priority: "urgent", isDismissible: false, startsAt: null, endsAt: null });
});
