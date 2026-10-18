import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_IMAGE_BYTES, sniffImageType, checkImageFile, objectName, objectNameFromUrl } from "../../src/features/announcements/upload.ts";

// Run: node --experimental-strip-types --test tests/announcements/upload.test.ts  (Node >= 22.6)
const bytes = (...b: number[]) => Uint8Array.from(b);
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d);
const WEBP = bytes(...ascii("RIFF"), 0x24, 0, 0, 0, ...ascii("WEBP"));
const UUID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const BASE = "https://abc.supabase.co/storage/v1/object/public/announcements/";

test("U1 sniffImageType recognises JPEG, PNG and WebP by their first bytes", () => {
  assert.equal(sniffImageType(JPEG), "image/jpeg");
  assert.equal(sniffImageType(PNG), "image/png");
  assert.equal(sniffImageType(WEBP), "image/webp");
});
test("U2 sniffImageType rejects GIF, SVG, HTML, WAV-in-RIFF and short input", () => {
  assert.equal(sniffImageType(bytes(...ascii("GIF89a"), 0, 0, 0, 0, 0, 0)), null);
  assert.equal(sniffImageType(bytes(...ascii("<svg xmlns=\"x\">"))), null);
  assert.equal(sniffImageType(bytes(...ascii("<!DOCTYPE html>"))), null);
  assert.equal(sniffImageType(bytes(...ascii("RIFF"), 0x24, 0, 0, 0, ...ascii("WAVE"))), null);
  assert.equal(sniffImageType(bytes(0xff, 0xd8)), null);
  assert.equal(sniffImageType(new Uint8Array(0)), null);
});
test("U3 checkImageFile accepts matching type + bytes at exactly 2 MB", () => {
  assert.equal(checkImageFile({ type: "image/png", size: MAX_IMAGE_BYTES }, PNG), null);
  assert.equal(checkImageFile({ type: "image/jpeg", size: 1000 }, JPEG), null);
  assert.equal(checkImageFile({ type: "image/webp", size: 1 }, WEBP), null);
});
test("U4 checkImageFile rejects oversize, empty, wrong MIME, SVG and MIME/bytes mismatch with a Thai message", () => {
  const messages = [
    checkImageFile({ type: "image/png", size: MAX_IMAGE_BYTES + 1 }, PNG),
    checkImageFile({ type: "image/png", size: 0 }, PNG),
    checkImageFile({ type: "image/gif", size: 10 }, bytes(...ascii("GIF89a"))),
    checkImageFile({ type: "image/svg+xml", size: 10 }, bytes(...ascii("<svg/>"))),
    checkImageFile({ type: "text/html", size: 10 }, bytes(...ascii("<html>"))),
    checkImageFile({ type: "image/jpeg", size: 10 }, PNG), // claims JPEG, is PNG
    checkImageFile({ type: "image/png", size: 10 }, bytes(...ascii("<script>alert(1)</script>"))),
  ];
  for (const m of messages) assert.ok(typeof m === "string" && /[\u0E00-\u0E7F]/.test(m), String(m));
  assert.equal(new Set(messages.slice(0, 2)).size, 2, "oversize and empty have different messages");
});
test("U5 objectName builds <uuid>.<ext> from the validated MIME type only", () => {
  assert.equal(objectName("image/jpeg", UUID), `${UUID}.jpg`);
  assert.equal(objectName("image/png", UUID), `${UUID}.png`);
  assert.equal(objectName("image/webp", UUID), `${UUID}.webp`);
});
test("U6 objectNameFromUrl returns the object name only for our own bucket and our own naming scheme", () => {
  assert.equal(objectNameFromUrl(`${BASE}${UUID}.webp`), `${UUID}.webp`);
  assert.equal(objectNameFromUrl(`${BASE}${UUID}.png?v=2`), `${UUID}.png`);
  assert.equal(objectNameFromUrl(`${BASE}${UUID}.gif`), null);
  assert.equal(objectNameFromUrl(`${BASE}not-a-uuid.png`), null);
  assert.equal(objectNameFromUrl(`${BASE}../avatars/${UUID}.png`), null);
  assert.equal(objectNameFromUrl(`${BASE}sub/${UUID}.png`), null);
  assert.equal(objectNameFromUrl(`https://abc.supabase.co/storage/v1/object/public/avatars/${UUID}.png`), null);
  assert.equal(objectNameFromUrl(`https://example.com/${UUID}.png`), null);
  assert.equal(objectNameFromUrl(`http://abc.supabase.co/storage/v1/object/public/announcements/${UUID}.png`), null);
});
