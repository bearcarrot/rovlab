import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mediaError, parseVideo, embedUrl, isOwnBucketUrl } from "../../src/features/announcements/media.ts";

// Run: node --experimental-strip-types --test tests/announcements/media.test.ts  (Node >= 22.6)
// The SQL integration script (supabase/tests/announcements.sql) reads the same vectors so SQL and TS cannot drift silently.
type Vector = { name: string; mediaType: "none" | "image" | "video" | "link"; mediaUrl: string | null; linkUrl: string | null; linkLabel: string | null; expected: string | null };
const vectors: Vector[] = JSON.parse(readFileSync(new URL("./media-vectors.json", import.meta.url), "utf8"));

test("M1 every shared vector returns its expected code", () => {
  assert.ok(vectors.length >= 40);
  for (const v of vectors) {
    assert.equal(mediaError({ mediaType: v.mediaType, mediaUrl: v.mediaUrl, linkUrl: v.linkUrl, linkLabel: v.linkLabel }), v.expected, v.name);
  }
});
test("M2 URL longer than 2048 characters is invalid, exactly 2048 is valid", () => {
  const base = "https://example.com/";
  const ok = base + "a".repeat(2048 - base.length);
  assert.equal(mediaError({ mediaType: "image", mediaUrl: ok, linkUrl: null, linkLabel: null }), null);
  assert.equal(mediaError({ mediaType: "image", mediaUrl: ok + "a", linkUrl: null, linkLabel: null }), "MEDIA_URL_INVALID");
});
test("M3 parseVideo extracts ids and direct urls", () => {
  assert.deepEqual(parseVideo("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=5"), { kind: "youtube", id: "dQw4w9WgXcQ" });
  assert.deepEqual(parseVideo("https://youtu.be/dQw4w9WgXcQ?t=5"), { kind: "youtube", id: "dQw4w9WgXcQ" });
  assert.deepEqual(parseVideo("https://www.youtube.com/embed/dQw4w9WgXcQ"), { kind: "youtube", id: "dQw4w9WgXcQ" });
  assert.deepEqual(parseVideo("https://vimeo.com/76979871"), { kind: "vimeo", id: "76979871" });
  assert.deepEqual(parseVideo("https://player.vimeo.com/video/76979871"), { kind: "vimeo", id: "76979871" });
  assert.deepEqual(parseVideo("https://cdn.example.com/v.mp4?sig=abc"), { kind: "direct", url: "https://cdn.example.com/v.mp4?sig=abc" });
  assert.equal(parseVideo("https://example.com/page"), null);
  assert.equal(parseVideo("javascript:alert(1)"), null);
});
test("M4 embedUrl is rebuilt from constants and the parsed id only", () => {
  assert.equal(embedUrl({ kind: "youtube", id: "dQw4w9WgXcQ" }), "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0");
  assert.equal(embedUrl({ kind: "vimeo", id: "76979871" }), "https://player.vimeo.com/video/76979871?autoplay=1");
});
test("M5 isOwnBucketUrl recognises the public announcements bucket path only", () => {
  assert.equal(isOwnBucketUrl("https://abc.supabase.co/storage/v1/object/public/announcements/x.png"), true);
  assert.equal(isOwnBucketUrl("https://abc.supabase.co/storage/v1/object/public/avatars/x.png"), false);
  assert.equal(isOwnBucketUrl("https://example.com/a.png"), false);
});
