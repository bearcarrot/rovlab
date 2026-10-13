import { test } from "node:test";
import assert from "node:assert/strict";
import { pickVideos, titleMentionsHero, decodeEntities, type YtSearchItem } from "../../supabase/functions/hero-videos/filter.ts";

// Run: node --experimental-strip-types --test tests/videos/filter.test.ts  (Node >= 22.6, no extra deps)
const vid = (id: string, title: string, publishedAt: string, extra: Partial<NonNullable<YtSearchItem["snippet"]>> = {}): YtSearchItem => ({
  id: { videoId: id },
  snippet: {
    title,
    description: "",
    channelTitle: "Chan",
    channelId: "c1",
    publishedAt,
    thumbnails: { medium: { url: `https://i.ytimg.com/vi/${id}/mqdefault.jpg` } },
    ...extra,
  },
});

test("V1 keeps only videos naming the hero AND RoV, newest first", () => {
  const items = [
    vid("a", "Airi ROV build guide", "2026-10-01T00:00:00Z"),
    vid("b", "Airi cosplay", "2026-10-10T00:00:00Z"), // no RoV marker
    vid("c", "สอนเล่น Airi RoV season 40", "2026-10-05T00:00:00Z"),
    vid("d", "Valhein RoV montage", "2026-10-12T00:00:00Z"), // other hero
  ];
  assert.deepEqual(pickVideos(items, ["Airi"]).map((v) => v.id), ["c", "a"]);
});

test("V2 hero name needs word boundaries (Ata must not match 'data')", () => {
  assert.equal(titleMentionsHero("Big data RoV tips", ["Ata"]), false);
  assert.equal(titleMentionsHero("Ata RoV tips", ["Ata"]), true);
  assert.equal(titleMentionsHero("Arena of Valor ata", ["Ata"]), true);
});

test("V3 marker can come from the description; names shorter than 3 chars are ignored", () => {
  const items = [vid("a", "Airi guide", "2026-10-01T00:00:00Z", { description: "Arena of Valor tips" })];
  assert.equal(pickVideos(items, ["Airi"]).length, 1);
  assert.equal(pickVideos([vid("x", "Ow RoV", "2026-10-01T00:00:00Z")], ["Ow"]).length, 0);
  assert.equal(pickVideos(items, []).length, 0);
});

test("V4 dedupes, drops upcoming streams, bad dates and non-https thumbnails", () => {
  const items = [
    vid("a", "Airi RoV", "2026-10-01T00:00:00Z"),
    vid("a", "Airi RoV", "2026-10-01T00:00:00Z"),
    vid("u", "Airi RoV live soon", "2026-10-02T00:00:00Z", { liveBroadcastContent: "upcoming" }),
    vid("d", "Airi RoV", "not-a-date"),
    vid("t", "Airi RoV", "2026-10-03T00:00:00Z", { thumbnails: { medium: { url: "http://x/y.jpg" } } }),
  ];
  assert.deepEqual(pickVideos(items, ["Airi"]).map((v) => v.id), ["a"]);
});

test("V5 decodes HTML entities, matches curly apostrophes, respects limit", () => {
  assert.equal(decodeEntities("Airi &amp; Zill&#39;s RoV"), "Airi & Zill's RoV");
  assert.equal(titleMentionsHero("Kil’Groth RoV", ["Kil'Groth"]), true);
  const many = Array.from({ length: 10 }, (_, i) => vid(`v${i}`, "Airi RoV", `2026-10-${String(i + 1).padStart(2, "0")}T00:00:00Z`));
  const got = pickVideos(many, ["Airi"], 3);
  assert.equal(got.length, 3);
  assert.equal(got[0].id, "v9");
});
