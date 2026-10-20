import { test } from "node:test";
import assert from "node:assert/strict";
import { getDocumentPip } from "../../src/features/draft/documentPip.ts";

test("no API (Firefox, Safari, mobile) = unsupported", () => {
  assert.equal(getDocumentPip({}), null);
});

test("an object without requestWindow is not treated as supported", () => {
  assert.equal(getDocumentPip({ documentPictureInPicture: {} }), null);
});

test("API with requestWindow is supported", () => {
  const api = { requestWindow: async () => ({}) as Window, window: null };
  assert.equal(getDocumentPip({ documentPictureInPicture: api }), api);
});
