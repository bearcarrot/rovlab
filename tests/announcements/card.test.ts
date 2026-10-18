import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Run: node --experimental-strip-types --test tests/announcements/card.test.ts  (Node >= 22.6)
// STATIC CHECKS on the presentational components. React rendering itself is not unit-testable under strip-types; see the manual checklist in the spec.
const read = (f: string) => readFileSync(new URL(`../../src/features/announcements/${f}`, import.meta.url), "utf8").replace(/\/\/.*$/gm, "");
const card = read("AnnouncementCard.tsx");
const media = read("MediaView.tsx");
const importsOf = (code: string) => [...code.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);

test("K1 card and media view are presentational: no service, store, hook or Supabase import", () => {
  for (const code of [card, media]) {
    for (const spec of importsOf(code)) assert.equal(/services|store|useAnnouncements|supabase|toast/i.test(spec), false, spec);
  }
});
test("K2 nothing is ever rendered as HTML (text only)", () => {
  for (const code of [card, media]) assert.equal(/dangerouslySetInnerHTML|innerHTML|insertAdjacentHTML/.test(code), false);
  assert.ok(card.includes("whitespace-pre-wrap"), "line breaks preserved as text");
});
test("K3 preview mode is inert: every onClick/onChange in the card is guarded by `live ?` and `live` requires mode === 'live'", () => {
  assert.match(card, /mode === "live"/);
  const handlers = [...card.matchAll(/\b(onClick|onChange)=\{([^}]*)\}/g)];
  assert.ok(handlers.length >= 2, "dismiss button and checkbox have handlers");
  for (const [, name, expr] of handlers) assert.ok(/^\s*live \?/.test(expr), `${name}={${expr}} must be guarded`);
  assert.ok(card.includes("aria-disabled"), "inert controls are marked aria-disabled");
  assert.ok(card.includes("ตัวอย่าง"), "preview badge");
});
test("K4 dismiss controls exist only for dismissible announcements: X button and 'ซ่อนประกาศนี้' checkbox", () => {
  assert.ok(card.includes("is_dismissible"));
  assert.ok(card.includes("ซ่อนประกาศนี้"));
  assert.match(card, /aria-label="ปิดประกาศ"/);
  assert.match(card, /type="checkbox"/);
});
test("K5 urgent announcements are announced to assistive tech; priority is shown as text, not colour alone", () => {
  assert.match(card, /role=\{[^}]*"alert"/);
  for (const label of ["ด่วน", "สำคัญ", "ประกาศ"]) assert.ok(card.includes(label), label);
});
test("K6 external links open safely", () => {
  for (const code of [card, media]) {
    const targets = (code.match(/target="_blank"/g) ?? []).length;
    const rels = (code.match(/rel="noopener noreferrer"/g) ?? []).length;
    assert.ok(rels >= targets, "every target=_blank has rel=noopener noreferrer");
  }
  assert.ok(card.includes("target=\"_blank\"") || media.includes("target=\"_blank\""));
});
test("K7 embeds: iframe src is built only from the parsed id via embedUrl(), sandboxed, lazy, click-to-play; direct video does not preload", () => {
  assert.ok(importsOf(media).includes("./media"));
  assert.ok(media.includes("parseVideo(") && media.includes("embedUrl("));
  const iframe = /<iframe[\s\S]*?\/>/.exec(media);
  assert.ok(iframe, "iframe present");
  assert.match(iframe![0], /src=\{embedSrc\}/);
  assert.equal(/media_url/.test(iframe![0]), false, "raw media_url never reaches the iframe");
  assert.match(iframe![0], /sandbox="allow-scripts allow-same-origin allow-presentation"/);
  assert.match(iframe![0], /referrerPolicy="strict-origin-when-cross-origin"/);
  assert.match(iframe![0], /loading="lazy"/);
  assert.ok(/<video[^>]*preload="none"[^>]*controls|<video[^>]*controls[^>]*preload="none"/.test(media), "video: controls + preload none");
  assert.ok(media.includes("playing"), "iframe appears only after the viewer clicks the facade");
});
test("K8 broken images fall back to a placeholder", () => {
  assert.ok(media.includes("onError"));
  assert.ok(media.includes("loading=\"lazy\""));
});
